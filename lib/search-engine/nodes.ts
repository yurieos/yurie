/**
 * LangGraph Node Handlers
 * 
 * REFACTORED: Extracted from langgraph-search-engine.ts (~800 lines reduced to modular handlers)
 * 
 * Each node function handles a specific phase of the search workflow.
 * This module exports factory functions that create node handlers with
 * the necessary dependencies injected.
 */

import { FirecrawlClient } from '../firecrawl';
import { ContextProcessor } from '../context-processor';
import { UnifiedSearchProvider, SearchProvider } from '../providers';
import { SEARCH_CONFIG, PROVIDER_CONFIG } from '../config';
import { 
  Source, 
  SearchPhase, 
  ErrorType,
  EnhancedSource,
  ResearchDomain,
  ResearchContext,
  EVIDENCE_SYMBOLS
} from '../types';
import { ResponsesAPIClient, ResponseMessage } from '../openai-responses';
import { YURIE_QUERY_ANALYSIS, YURIE_FOLLOWUP_PROMPT } from '../yurie-system-prompt';
import { detectResearchDomain } from '../research-prompt';
import { enrichSources, buildResearchContext } from '../evidence-classifier';
import { type SearchState } from './state';
import { 
  extractUrlsFromQuery, 
  isCrawlOrMapQuery, 
  scoreContent,
  getCurrentDateContext,
  type GraphConfig
} from './helpers';
import { loggers } from '../utils/logger';

const log = loggers.core;

// =============================================================================
// Types
// =============================================================================

export interface NodeDependencies {
  firecrawl: FirecrawlClient;
  unifiedSearch: UnifiedSearchProvider;
  contextProcessor: ContextProcessor;
  llm: ResponsesAPIClient;
  streamingLlm: ResponsesAPIClient;
}

type NodeHandler = (state: SearchState, config?: GraphConfig) => Promise<Partial<SearchState>>;

// =============================================================================
// Helper Functions (used by multiple nodes)
// =============================================================================

export async function analyzeQuery(
  llm: ResponsesAPIClient,
  query: string, 
  context?: { query: string; response: string }[]
): Promise<string> {
  let contextPrompt = '';
  if (context && context.length > 0) {
    contextPrompt = '\n\nPrevious conversation:\n';
    context.forEach(c => {
      contextPrompt += `User: ${c.query}\nAssistant: ${c.response.substring(0, SEARCH_CONFIG.CONTEXT_PREVIEW_LENGTH)}...\n\n`;
    });
  }
  
  const messages: ResponseMessage[] = [
    { role: 'system', content: `${getCurrentDateContext()}

${YURIE_QUERY_ANALYSIS}` },
    { role: 'user', content: `Query: "${query}"${contextPrompt}` }
  ];
  
  const response = await llm.generateWithMessages(messages);
  return response.text;
}

export async function summarizeContent(
  llm: ResponsesAPIClient,
  content: string, 
  query: string
): Promise<string> {
  try {
    const messages: ResponseMessage[] = [
      { role: 'system', content: `${getCurrentDateContext()}

You're Yurie. Extract ONE key finding from this content that's SPECIFICALLY relevant to the search query.

CRITICAL: Only summarize information that directly relates to the search query.
- If searching for "Samsung phones", only mention Samsung phone information
- If searching for "Firecrawl founders", only mention founder information
- If no relevant information is found, just return the most relevant fact from the page

Instructions:
- Return just ONE sentence with a specific finding
- Include numbers, dates, or specific details when available
- Keep it under ${SEARCH_CONFIG.SUMMARY_CHAR_LIMIT} characters
- Don't say "No relevant information was found" - find something relevant to the current search` },
      { role: 'user', content: `Query: "${query}"\n\nContent: ${content.slice(0, 2000)}` }
    ];
    
    const response = await llm.generateWithMessages(messages);
    return response.text.trim();
  } catch {
    return '';
  }
}

export async function extractSubQueries(
  llm: ResponsesAPIClient,
  query: string
): Promise<Array<{ question: string; searchQuery: string }>> {
  const messages: ResponseMessage[] = [
    { role: 'system', content: `You're Yurie—a researcher, friend, and collaborator. Extract the individual factual questions from this query.

IMPORTANT: 
- If the user asks about YOU (your name, who you are, your capabilities), interpret this as a question about "Yurie".
- You're not ChatGPT, OpenAI, Claude, or any other model. You're Yurie—a one-of-a-kind research intelligence.
- If the query is "what is your name", the question is "Who is Yurie?" and the search query is "Yurie AI research assistant".
- When the user mentions something with a version/number (like "deepseek r1 0528"), include the FULL version in the question
- For the search query, you can simplify slightly but keep key identifiers

Examples:
"Who founded Anthropic and when" → 
[
  {"question": "Who founded Anthropic?", "searchQuery": "Anthropic founders"},
  {"question": "When was Anthropic founded?", "searchQuery": "Anthropic founded date year"}
]

"What is your name?" →
[
  {"question": "Who is Yurie?", "searchQuery": "Yurie AI research intelligence"}
]

Return ONLY a JSON array of {question, searchQuery} objects.` },
    { role: 'user', content: `Query: "${query}"` }
  ];

  try {
    const response = await llm.generateWithMessages(messages);
    return JSON.parse(response.text);
  } catch {
    return [{ question: query, searchQuery: query }];
  }
}

export async function checkAnswersInSources(
  llm: ResponsesAPIClient,
  subQueries: Array<{ question: string; searchQuery: string; answered: boolean; answer?: string; confidence: number; sources: string[] }>,
  sources: Source[]
): Promise<typeof subQueries> {
  if (sources.length === 0) return subQueries;
  
  const messages: ResponseMessage[] = [
    { role: 'system', content: `Check which questions have been answered by the provided sources.

For each question, determine:
1. If the sources contain a direct answer
2. The confidence level (0.0-1.0) that the question was fully answered
3. A brief answer summary if found

Guidelines:
- For "who" questions about people/founders: Mark as answered (0.8+ confidence) if you find names of specific people
- For "what" questions: Mark as answered (0.8+ confidence) if you find the specific information requested
- For "when" questions: Mark as answered (0.8+ confidence) if you find dates or time periods
- For "how many" questions: Require specific numbers (0.8+ confidence)
- For comparison questions: Require information about all items being compared
- If sources clearly answer the question but lack some minor details, use medium confidence (0.6-0.7)
- If sources mention the topic but don't answer the specific question, use low confidence (< 0.3)

Important: Be generous in recognizing answers. If the source clearly provides the information asked for, mark it as answered with high confidence.

Return ONLY a JSON array, no markdown formatting or code blocks:
[
  {
    "question": "the original question",
    "answered": true/false,
    "confidence": 0.0-1.0,
    "answer": "brief answer if found",
    "sources": ["urls that contain the answer"]
  }
]` },
    { role: 'user', content: `Questions to check:
${subQueries.map(sq => sq.question).join('\n')}

Sources:
${sources.slice(0, SEARCH_CONFIG.MAX_SOURCES_TO_CHECK).map(s => {
  let sourceInfo = `URL: ${s.url}\nTitle: ${s.title}\n`;
  if (s.summary) sourceInfo += `Summary: ${s.summary}\n`;
  if (s.content) sourceInfo += `Content: ${s.content.slice(0, SEARCH_CONFIG.ANSWER_CHECK_PREVIEW)}\n`;
  return sourceInfo;
}).join('\n---\n')}` }
  ];

  try {
    const response = await llm.generateWithMessages(messages);
    let content = response.text;
    content = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
    const results = JSON.parse(content);
    
    return subQueries.map(sq => {
      const result = results.find((r: { question: string }) => r.question === sq.question);
      if (result && result.confidence > sq.confidence) {
        return {
          ...sq,
          answered: result.confidence >= SEARCH_CONFIG.MIN_ANSWER_CONFIDENCE,
          answer: result.answer,
          confidence: result.confidence,
          sources: [...new Set([...sq.sources, ...(result.sources || [])])]
        };
      }
      return sq;
    });
  } catch (error) {
    log.debug('Error checking answers:', error);
    return subQueries;
  }
}

export async function generateAlternativeSearchQueries(
  llm: ResponsesAPIClient,
  subQueries: Array<{ question: string; searchQuery: string; answered: boolean; answer?: string; confidence: number; sources: string[] }>,
  previousAttempts: number
): Promise<string[]> {
  const unansweredQueries = subQueries.filter(sq => !sq.answered || sq.confidence < SEARCH_CONFIG.MIN_ANSWER_CONFIDENCE);
  
  if (previousAttempts >= 2) {
    const problematicQueries = unansweredQueries.filter(sq => {
      const hasVersionPattern = /\b\d{3,4}\b|\bv\d+\.\d+|\bversion\s+\d+/i.test(sq.question);
      return hasVersionPattern;
    });
    
    if (problematicQueries.length > 0) {
      return problematicQueries.map(sq => {
        const baseTerm = sq.question.replace(/0528|specific version/gi, '').trim();
        return baseTerm.substring(0, 50);
      });
    }
  }
  
  const messages: ResponseMessage[] = [
    { role: 'system', content: `${getCurrentDateContext()}

Generate ALTERNATIVE search queries for questions that weren't answered in previous attempts.

Previous search attempts: ${previousAttempts}
Previous queries that didn't find answers:
${unansweredQueries.map(sq => `- Question: "${sq.question}"\n  Previous search: "${sq.searchQuery}"`).join('\n')}

Generate NEW search queries using these strategies:
1. Try broader or more general terms
2. Try different phrasings or synonyms
3. Remove specific qualifiers (like years or versions) if they're too restrictive
4. Try searching for related concepts that might contain the answer
5. For products that might not exist, search for the company or base product name

Return one alternative search query per unanswered question, one per line.` },
    { role: 'user', content: `Generate alternative searches for these ${unansweredQueries.length} unanswered questions.` }
  ];

  try {
    const response = await llm.generateWithMessages(messages);
    const queries = response.text
      .split('\n')
      .map(q => q.trim())
      .map(q => q.replace(/^["']|["']$/g, ''))
      .map(q => q.replace(/^\d+\.\s*/, ''))
      .map(q => q.replace(/^[-*#]\s*/, ''))
      .filter(q => q.length > 3 && !q.match(/^```/));
    
    return queries.slice(0, SEARCH_CONFIG.MAX_SEARCH_QUERIES);
  } catch {
    return unansweredQueries.map(sq => sq.searchQuery + " news reports").slice(0, SEARCH_CONFIG.MAX_SEARCH_QUERIES);
  }
}

export async function generateStreamingAnswer(
  streamingLlm: ResponsesAPIClient,
  llm: ResponsesAPIClient,
  query: string,
  sources: Source[],
  onChunk: (chunk: string) => void,
  context?: { query: string; response: string }[],
  previousResponseId?: string,
  researchDomain?: ResearchDomain,
  researchContext?: ResearchContext
): Promise<{ text: string; responseId?: string }> {
  const enrichedSources = researchContext 
    ? sources as EnhancedSource[]
    : enrichSources(sources);
  
  const sourcesText = enrichedSources
    .map((s, i) => {
      const dateInfo = 'publicationDate' in s && (s as EnhancedSource).publicationDate
        ? ` (${(s as EnhancedSource).publicationDate})`
        : '';
      const peerReviewed = 'peerReviewed' in s && (s as EnhancedSource).peerReviewed
        ? ' [Peer-Reviewed]'
        : '';
      
      if (!s.content) return `[${i + 1}] ${s.title}${dateInfo}${peerReviewed}\n[No content available]`;
      return `[${i + 1}] ${s.title}${dateInfo}${peerReviewed}\nURL: ${s.url}\n${s.content}`;
    })
    .join('\n\n');
  
  let contextPrompt = '';
  if (context && context.length > 0) {
    contextPrompt = '\n\nPrevious conversation for context:\n';
    context.forEach(c => {
      contextPrompt += `User: ${c.query}\nAssistant: ${c.response.substring(0, 300)}...\n\n`;
    });
  }
  
  // Clean, focused system prompt that encourages prose-based responses
  const systemPrompt = `${getCurrentDateContext()}

You are Yurie, a thoughtful researcher. Answer the user's question based on the provided sources.

WRITING STYLE:
- Write in flowing prose paragraphs, not bullet points
- Lead with the direct answer, then provide supporting evidence
- Use 2-4 section headers (##) maximum for organization
- Keep paragraphs short and dense with meaning
- Cite sources inline: "Studies show X [1]" or "According to research [2]"

STRICT FORMATTING RULES:
- NO bullet points or lists unless listing specific items (like steps or options)
- NO horizontal rules (---) or visual separators
- NO tables unless presenting actual tabular data
- NO emoji in headers or text
- NO source lists at the end - citations are inline only
- NO follow-up questions or suggestions at the end - the UI handles this separately

VOICE:
- First person ("I found...", "The evidence suggests...")
- Conversational but substantive
- Honest about uncertainty when evidence is limited

End your response naturally after addressing the question. Do not add follow-up suggestions, next steps, or "let me know if you want..." prompts.`;
  
  const messages: ResponseMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Question: "${query}"${contextPrompt}

Based on these ${enrichedSources.length} sources:

${sourcesText}` }
  ];
  
  try {
    const result = await streamingLlm.streamWithMessages(messages, onChunk, previousResponseId);
    return { text: result.text, responseId: result.id };
  } catch {
    const response = await llm.generateWithMessages(messages, previousResponseId);
    onChunk(response.text);
    return { text: response.text, responseId: response.id };
  }
}

export async function generateFollowUpQuestions(
  llm: ResponsesAPIClient,
  originalQuery: string,
  answer: string,
  context?: { query: string; response: string }[]
): Promise<string[]> {
  try {
    let contextPrompt = '';
    if (context && context.length > 0) {
      contextPrompt = '\n\nPrevious conversation topics:\n';
      context.forEach(c => { contextPrompt += `- ${c.query}\n`; });
      contextPrompt += '\nConsider the full conversation flow when generating follow-ups.\n';
    }
    
    const messages: ResponseMessage[] = [
      { role: 'system', content: `${getCurrentDateContext()}

${YURIE_FOLLOWUP_PROMPT}

Additional context:
- Keep each question under 80 characters
- Consider the entire conversation context when generating questions
- Only include time-relevant questions if the original query was about current events or trends` },
      { role: 'user', content: `Original query: "${originalQuery}"\n\nAnswer summary: ${answer.length > 1000 ? answer.slice(0, 1000) + '...' : answer}${contextPrompt}` }
    ];
    
    const response = await llm.generateWithMessages(messages);
    const questions = response.text
      .split('\n')
      .map(q => q.trim())
      .filter(q => q.length > 0 && q.length < 80)
      .slice(0, 3);
    
    return questions.length > 0 ? questions : [];
  } catch {
    return [];
  }
}

// =============================================================================
// Node Factory Functions
// =============================================================================

export function createUnderstandNode(deps: NodeDependencies): NodeHandler {
  return async (state: SearchState, config?: GraphConfig): Promise<Partial<SearchState>> => {
    const eventCallback = config?.configurable?.eventCallback;
    
    if (eventCallback) {
      eventCallback({ type: 'phase-update', phase: 'understanding', message: 'Analyzing your request...' });
    }
    
    try {
      const urls = extractUrlsFromQuery(state.query);
      const isCrawlMap = isCrawlOrMapQuery(state.query);
      let urlSources: Source[] | undefined = undefined;
      
      if (urls.length > 0 && !isCrawlMap) {
        if (eventCallback) {
          eventCallback({ type: 'provider-selected', provider: 'firecrawl', reason: 'User provided explicit URL(s) - scraping directly with Firecrawl' });
        }
        
        const scrapeResults = await Promise.allSettled(
          urls.slice(0, 3).map(async (url, index) => {
            if (eventCallback) {
              eventCallback({ type: 'scraping', url, index: index + 1, total: Math.min(urls.length, 3), query: state.query });
            }
            
            const result = await deps.firecrawl.scrapeForLLM(url, { onlyMainContent: true, includeLinks: false });
            
            if (result.success && result.markdown) {
              const source: Source = { url, title: result.title || url, content: result.markdown, quality: 1.0 };
              const summary = await summarizeContent(deps.llm, result.markdown, state.query);
              if (summary) {
                source.summary = summary;
                if (eventCallback) eventCallback({ type: 'source-complete', url, summary });
              }
              return source;
            }
            return null;
          })
        );
        
        urlSources = scrapeResults
          .filter((r): r is PromiseFulfilledResult<Source | null> => r.status === 'fulfilled')
          .map(r => r.value)
          .filter((s): s is Source => s !== null);
        
        if (urlSources.length > 0 && eventCallback) {
          eventCallback({ type: 'found', sources: urlSources, query: `Scraped ${urlSources.length} URL(s)`, provider: 'firecrawl' });
        }
      }
      
      const understanding = await analyzeQuery(deps.llm, state.query, state.context);
      
      if (eventCallback) eventCallback({ type: 'thinking', message: understanding });
      
      return { understanding, urlSources, phase: 'planning' as SearchPhase };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to understand query', errorType: 'llm' as ErrorType, phase: 'error' as SearchPhase };
    }
  };
}

export function createPlanNode(deps: NodeDependencies): NodeHandler {
  return async (state: SearchState, config?: GraphConfig): Promise<Partial<SearchState>> => {
    const eventCallback = config?.configurable?.eventCallback;
    
    if (eventCallback) {
      eventCallback({ type: 'phase-update', phase: 'planning', message: 'Planning search strategy...' });
    }
    
    try {
      let subQueries = state.subQueries;
      if (!subQueries) {
        const extracted = await extractSubQueries(deps.llm, state.query);
        subQueries = extracted.map(sq => ({ question: sq.question, searchQuery: sq.searchQuery, answered: false, confidence: 0, sources: [] }));
      }
      
      if (state.urlSources && state.urlSources.length > 0 && state.searchAttempt === 0) {
        const updatedSubQueries = await checkAnswersInSources(deps.llm, subQueries, state.urlSources);
        const answeredCount = updatedSubQueries.filter(sq => sq.answered).length;
        
        if (eventCallback) {
          if (answeredCount === updatedSubQueries.length) {
            eventCallback({ type: 'thinking', message: `Found answers to all ${updatedSubQueries.length} questions in the provided URL(s)` });
          } else if (answeredCount > 0) {
            eventCallback({ type: 'thinking', message: `Found answers to ${answeredCount} of ${updatedSubQueries.length} questions in the URL. Searching for more info...` });
          }
        }
        
        if (answeredCount === updatedSubQueries.length) {
          return { subQueries: updatedSubQueries, sources: state.urlSources, phase: 'analyzing' as SearchPhase };
        }
        subQueries = updatedSubQueries;
      }
      
      const unansweredQueries = subQueries.filter(sq => !sq.answered || sq.confidence < SEARCH_CONFIG.MIN_ANSWER_CONFIDENCE);
      
      if (unansweredQueries.length === 0) {
        return { subQueries, phase: 'analyzing' as SearchPhase };
      }
      
      let searchQueries: string[];
      if (state.searchAttempt > 0) {
        searchQueries = await generateAlternativeSearchQueries(deps.llm, subQueries, state.searchAttempt);
        let altIndex = 0;
        subQueries.forEach(sq => {
          if ((!sq.answered || sq.confidence < SEARCH_CONFIG.MIN_ANSWER_CONFIDENCE) && altIndex < searchQueries.length) {
            sq.searchQuery = searchQueries[altIndex++];
          }
        });
      } else {
        searchQueries = unansweredQueries.map(sq => sq.searchQuery);
      }
      
      if (eventCallback) {
        const message = state.searchAttempt === 0 
          ? (searchQueries.length > 3 ? `I detected ${subQueries.length} different questions. I'll search for each one separately.` : `I'll search for information to answer your question.`)
          : `Trying alternative search strategies for: ${unansweredQueries.map(sq => sq.question).join(', ')}`;
        eventCallback({ type: 'thinking', message });
      }
      
      return { searchQueries, subQueries, currentSearchIndex: 0, phase: 'searching' as SearchPhase };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to plan search', errorType: 'llm' as ErrorType, phase: 'error' as SearchPhase };
    }
  };
}

export function createSearchNode(deps: NodeDependencies): NodeHandler {
  return async (state: SearchState, config?: GraphConfig): Promise<Partial<SearchState>> => {
    const eventCallback = config?.configurable?.eventCallback;
    const searchQueries = state.searchQueries || [];
    const currentIndex = state.currentSearchIndex || 0;
    
    if (currentIndex === 0 && eventCallback) {
      eventCallback({ type: 'phase-update', phase: 'searching', message: 'Searching the web...' });
    }
    
    if (currentIndex >= searchQueries.length) {
      return { phase: 'scrape' as SearchPhase };
    }
    
    const searchQuery = searchQueries[currentIndex];
    
    try {
      const searchResult = PROVIDER_CONFIG.ENABLE_MULTI_PROVIDER
        ? await deps.unifiedSearch.search(searchQuery, { maxResults: SEARCH_CONFIG.MAX_SOURCES_PER_SEARCH })
        : await deps.unifiedSearch.searchWithProvider(searchQuery, 'firecrawl', { maxResults: SEARCH_CONFIG.MAX_SOURCES_PER_SEARCH });
      
      const usedProvider = searchResult.provider;
      const providerReason = searchResult.classification.reason;
      
      if (currentIndex === 0 && eventCallback) {
        eventCallback({ type: 'provider-selected', provider: usedProvider, reason: providerReason });
      }
      
      if (eventCallback) {
        eventCallback({ type: 'searching', query: searchQuery, index: currentIndex + 1, total: searchQueries.length, provider: usedProvider });
      }
      
      const newSources: Source[] = searchResult.sources;
      
      if (eventCallback) {
        eventCallback({ type: 'found', sources: newSources, query: searchQuery, provider: usedProvider });
      }
      
      // Process sources in parallel
      if (SEARCH_CONFIG.PARALLEL_SUMMARY_GENERATION) {
        await Promise.all(newSources.map(async (source) => {
          if (eventCallback) {
            eventCallback({ type: 'source-processing', url: source.url, title: source.title, stage: 'browsing' });
          }
          source.quality = scoreContent(source.content || '', state.query);
          if (!source.summary && source.content && source.content.length > SEARCH_CONFIG.MIN_CONTENT_LENGTH) {
            const summary = await summarizeContent(deps.llm, source.content, searchQuery);
            if (summary && !summary.toLowerCase().includes('no specific')) {
              source.summary = summary;
              if (eventCallback) eventCallback({ type: 'source-complete', url: source.url, summary });
            }
          } else if (source.summary && eventCallback) {
            eventCallback({ type: 'source-complete', url: source.url, summary: source.summary });
          }
        }));
      } else {
        for (const source of newSources) {
          if (eventCallback) {
            eventCallback({ type: 'source-processing', url: source.url, title: source.title, stage: 'browsing' });
          }
          await new Promise(resolve => setTimeout(resolve, SEARCH_CONFIG.SOURCE_ANIMATION_DELAY));
          source.quality = scoreContent(source.content || '', state.query);
          if (!source.summary && source.content && source.content.length > SEARCH_CONFIG.MIN_CONTENT_LENGTH) {
            const summary = await summarizeContent(deps.llm, source.content, searchQuery);
            if (summary && !summary.toLowerCase().includes('no specific')) {
              source.summary = summary;
              if (eventCallback) eventCallback({ type: 'source-complete', url: source.url, summary });
            }
          } else if (source.summary && eventCallback) {
            eventCallback({ type: 'source-complete', url: source.url, summary: source.summary });
          }
        }
      }
      
      return { sources: newSources, currentSearchIndex: currentIndex + 1, searchProvider: usedProvider, providerReason, preAnswer: searchResult.preAnswer };
    } catch {
      return { currentSearchIndex: currentIndex + 1, errorType: 'search' as ErrorType };
    }
  };
}

export function createScrapeNode(deps: NodeDependencies): NodeHandler {
  return async (state: SearchState, config?: GraphConfig): Promise<Partial<SearchState>> => {
    const eventCallback = config?.configurable?.eventCallback;
    const sourcesToScrape = state.sources?.filter(s => !s.content || s.content.length < SEARCH_CONFIG.MIN_CONTENT_LENGTH) || [];
    const newScrapedSources: Source[] = [];
    
    const sourcesWithContent = state.sources?.filter(s => s.content && s.content.length >= SEARCH_CONFIG.MIN_CONTENT_LENGTH) || [];
    newScrapedSources.push(...sourcesWithContent);
    
    const useDeepExtraction = PROVIDER_CONFIG.FIRECRAWL?.ENABLE_DEEP_EXTRACTION ?? true;
    const autoScrapeThreshold = PROVIDER_CONFIG.FIRECRAWL?.AUTO_SCRAPE_THRESHOLD ?? 3;
    
    const topSourcesToEnrich = useDeepExtraction 
      ? state.sources?.slice(0, autoScrapeThreshold).filter(s => !newScrapedSources.some(ns => ns.url === s.url)) || []
      : [];
    
    const allSourcesToProcess = [...sourcesToScrape, ...topSourcesToEnrich];
    const uniqueSources = allSourcesToProcess.filter((s, i, arr) => arr.findIndex(x => x.url === s.url) === i);
    
    if (eventCallback && uniqueSources.length > 0) {
      eventCallback({ type: 'thinking', message: `Extracting deep content from ${uniqueSources.length} sources using Firecrawl...` });
    }
    
    const scrapePromises = uniqueSources.slice(0, SEARCH_CONFIG.MAX_SOURCES_TO_SCRAPE).map(async (source, i) => {
      if (eventCallback) {
        eventCallback({ type: 'scraping', url: source.url, index: newScrapedSources.length + i + 1, total: sourcesWithContent.length + Math.min(uniqueSources.length, SEARCH_CONFIG.MAX_SOURCES_TO_SCRAPE), query: state.query });
      }
      
      try {
        const scraped = await deps.firecrawl.scrapeForLLM(source.url, { onlyMainContent: true, includeLinks: false });
        
        if (scraped.success && scraped.markdown) {
          const enrichedSource: Source = { ...source, title: scraped.title || source.title, content: scraped.markdown, quality: scoreContent(scraped.markdown, state.query) };
          
          if (eventCallback) {
            eventCallback({ type: 'source-processing', url: source.url, title: enrichedSource.title, stage: 'extracting' });
          }
          
          const summary = await summarizeContent(deps.llm, scraped.markdown, state.query);
          if (summary) {
            enrichedSource.summary = summary;
            if (eventCallback) eventCallback({ type: 'source-complete', url: source.url, summary });
          }
          
          return enrichedSource;
        } else if (scraped.error && eventCallback) {
          const hostname = new URL(source.url).hostname;
          eventCallback({ type: 'thinking', message: `Couldn't fully extract ${hostname}, using available content...` });
        }
        return source.content ? source : null;
      } catch {
        return null;
      }
    });
    
    const results = await Promise.allSettled(scrapePromises);
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        newScrapedSources.push(result.value);
      }
    }
    
    return { scrapedSources: newScrapedSources, phase: 'analyzing' as SearchPhase };
  };
}

export function createAnalyzeNode(deps: NodeDependencies): NodeHandler {
  return async (state: SearchState, config?: GraphConfig): Promise<Partial<SearchState>> => {
    const eventCallback = config?.configurable?.eventCallback;
    
    if (eventCallback) {
      eventCallback({ type: 'phase-update', phase: 'analyzing', message: 'Analyzing gathered information...' });
    }
    
    const sourceMap = new Map<string, Source>();
    (state.urlSources || []).forEach(s => sourceMap.set(s.url, s));
    (state.sources || []).forEach(s => sourceMap.set(s.url, s));
    (state.scrapedSources || []).forEach(s => sourceMap.set(s.url, s));
    const allSources = Array.from(sourceMap.values());
    
    if (state.subQueries) {
      const updatedSubQueries = await checkAnswersInSources(deps.llm, state.subQueries, allSources);
      const answeredCount = updatedSubQueries.filter(sq => sq.answered).length;
      const totalQuestions = updatedSubQueries.length;
      const searchAttempt = (state.searchAttempt || 0) + 1;
      const partialAnswers = updatedSubQueries.filter(sq => sq.confidence >= 0.3);
      const hasPartialInfo = partialAnswers.length > answeredCount;
      
      if (eventCallback) {
        if (answeredCount === totalQuestions) {
          eventCallback({ type: 'thinking', message: `Found answers to all ${totalQuestions} questions across ${allSources.length} sources` });
        } else if (answeredCount > 0) {
          eventCallback({ type: 'thinking', message: `Found answers to ${answeredCount} of ${totalQuestions} questions.` });
        } else if (searchAttempt >= SEARCH_CONFIG.MAX_SEARCH_ATTEMPTS) {
          eventCallback({ type: 'thinking', message: `Could not find specific answers in ${allSources.length} sources.` });
        } else if (hasPartialInfo && searchAttempt >= 3) {
          eventCallback({ type: 'thinking', message: `Found partial information. Moving forward with what's available.` });
        } else {
          eventCallback({ type: 'thinking', message: `Searching for more specific information...` });
        }
      }
      
      if (answeredCount < totalQuestions && searchAttempt < SEARCH_CONFIG.MAX_SEARCH_ATTEMPTS && !(hasPartialInfo && searchAttempt >= 2)) {
        return { sources: allSources, subQueries: updatedSubQueries, searchAttempt, phase: 'planning' as SearchPhase };
      }
      
      try {
        const processedSources = await deps.contextProcessor.processSources(state.query, allSources, state.searchQueries || []);
        return { sources: allSources, processedSources, subQueries: updatedSubQueries, searchAttempt, phase: 'synthesizing' as SearchPhase };
      } catch {
        return { sources: allSources, processedSources: allSources, subQueries: updatedSubQueries, searchAttempt, phase: 'synthesizing' as SearchPhase };
      }
    } else {
      if (eventCallback && allSources.length > 0) {
        eventCallback({ type: 'thinking', message: `Found ${allSources.length} sources with quality information` });
      }
      
      try {
        const processedSources = await deps.contextProcessor.processSources(state.query, allSources, state.searchQueries || []);
        return { sources: allSources, processedSources, phase: 'synthesizing' as SearchPhase };
      } catch {
        return { sources: allSources, processedSources: allSources, phase: 'synthesizing' as SearchPhase };
      }
    }
  };
}

export function createSynthesizeNode(deps: NodeDependencies): NodeHandler {
  return async (state: SearchState, config?: GraphConfig): Promise<Partial<SearchState>> => {
    const eventCallback = config?.configurable?.eventCallback;
    
    if (eventCallback) {
      eventCallback({ type: 'phase-update', phase: 'synthesizing', message: 'Creating comprehensive research synthesis...' });
    }
    
    try {
      const sourcesToUse = state.processedSources || state.sources || [];
      const researchDomain = state.researchDomain || detectResearchDomain(state.searchProvider || 'wikipedia', undefined);
      const enrichedSources = state.enrichedSources || enrichSources(sourcesToUse);
      const researchContext = state.researchContext || buildResearchContext(enrichedSources, researchDomain, state.query);
      
      const answerResult = await generateStreamingAnswer(
        deps.streamingLlm,
        deps.llm,
        state.query,
        enrichedSources,
        (chunk) => { if (eventCallback) eventCallback({ type: 'content-chunk', chunk }); },
        state.context,
        state.previousResponseId,
        researchDomain,
        researchContext
      );
      
      const followUpQuestions = await generateFollowUpQuestions(deps.llm, state.query, answerResult.text, state.context);
      
      return { finalAnswer: answerResult.text, previousResponseId: answerResult.responseId, followUpQuestions, researchDomain, researchContext, enrichedSources, phase: 'complete' as SearchPhase };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to generate answer', errorType: 'llm' as ErrorType, phase: 'error' as SearchPhase };
    }
  };
}

export function createHandleErrorNode(): NodeHandler {
  return async (state: SearchState, config?: GraphConfig): Promise<Partial<SearchState>> => {
    const eventCallback = config?.configurable?.eventCallback;
    
    if (eventCallback) {
      eventCallback({ type: 'error', error: state.error || 'An unknown error occurred', errorType: state.errorType });
    }
    
    if ((state.retryCount || 0) < (state.maxRetries || SEARCH_CONFIG.MAX_RETRIES)) {
      const retryPhase = state.errorType === 'search' ? 'searching' : 'understanding';
      return { retryCount: (state.retryCount || 0) + 1, phase: retryPhase as SearchPhase, error: undefined, errorType: undefined };
    }
    
    return { phase: 'error' as SearchPhase };
  };
}

export function createCompleteNode(): NodeHandler {
  return async (state: SearchState, config?: GraphConfig): Promise<Partial<SearchState>> => {
    const eventCallback = config?.configurable?.eventCallback;
    
    if (eventCallback) {
      eventCallback({ type: 'phase-update', phase: 'complete', message: 'Search complete!' });
      eventCallback({ type: 'final-result', content: state.finalAnswer || '', sources: state.sources || [], followUpQuestions: state.followUpQuestions });
    }
    
    return { phase: 'complete' as SearchPhase };
  };
}

