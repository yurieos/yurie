import { StateGraph, END, START, Annotation, MemorySaver } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { FirecrawlClient } from './firecrawl';
import { ContextProcessor } from './context-processor';
import { SEARCH_CONFIG, MODEL_CONFIG, PROVIDER_CONFIG } from './config';
import { UnifiedSearchProvider, SearchProvider } from './providers';
import { Source, SearchResult, SearchPhase, SearchEvent, ErrorType, SearchStep } from './types';

// Re-export types for backwards compatibility
export type { Source, SearchResult, SearchPhase, SearchEvent, ErrorType, SearchStep };

// Helper to extract URLs from a query string
function extractUrlsFromQuery(query: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"')\]]+/gi;
  const matches = query.match(urlRegex) || [];
  // Clean up URLs (remove trailing punctuation)
  return matches.map(url => url.replace(/[.,;:!?]+$/, ''));
}

// Helper to determine if query is asking for crawl/map operations (vs simple scrape)
function isCrawlOrMapQuery(query: string): boolean {
  const q = query.toLowerCase();
  return (
    q.includes('crawl') || 
    q.includes('all pages') || 
    q.includes('entire site') || 
    q.includes('full site') ||
    q.includes('map') ||
    q.includes('structure') ||
    q.includes('sitemap') ||
    q.includes('list all urls') ||
    q.includes('discover pages')
  );
}

// Proper LangGraph state using Annotation with reducers
const SearchStateAnnotation = Annotation.Root({
  // Input fields
  query: Annotation<string>({
    reducer: (_, y) => y ?? "",
    default: () => ""
  }),
  context: Annotation<{ query: string; response: string }[] | undefined>({
    reducer: (_, y) => y,
    default: () => undefined
  }),
  // Pre-scraped URL content (when user provides explicit URLs)
  urlSources: Annotation<Source[] | undefined>({
    reducer: (x, y) => y ?? x,
    default: () => undefined
  }),
  
  // Process fields
  understanding: Annotation<string | undefined>({
    reducer: (x, y) => y ?? x,
    default: () => undefined
  }),
  searchQueries: Annotation<string[] | undefined>({
    reducer: (x, y) => y ?? x,
    default: () => undefined
  }),
  currentSearchIndex: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => 0
  }),
  
  // Results fields - with proper array reducers
  sources: Annotation<Source[]>({
    reducer: (existing: Source[], update: Source[] | undefined) => {
      if (!update) return existing;
      // Deduplicate sources by URL
      const sourceMap = new Map<string, Source>();
      [...existing, ...update].forEach(source => {
        sourceMap.set(source.url, source);
      });
      return Array.from(sourceMap.values());
    },
    default: () => []
  }),
  scrapedSources: Annotation<Source[]>({
    reducer: (existing: Source[], update: Source[] | undefined) => {
      if (!update) return existing;
      return [...existing, ...update];
    },
    default: () => []
  }),
  processedSources: Annotation<Source[] | undefined>({
    reducer: (x, y) => y ?? x,
    default: () => undefined
  }),
  finalAnswer: Annotation<string | undefined>({
    reducer: (x, y) => y ?? x,
    default: () => undefined
  }),
  followUpQuestions: Annotation<string[] | undefined>({
    reducer: (x, y) => y ?? x,
    default: () => undefined
  }),
  
  // Answer tracking
  subQueries: Annotation<Array<{
    question: string;
    searchQuery: string;
    answered: boolean;
    answer?: string;
    confidence: number;
    sources: string[];
  }> | undefined>({
    reducer: (x, y) => y ?? x,
    default: () => undefined
  }),
  searchAttempt: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => 0
  }),
  
  // Control fields
  phase: Annotation<SearchPhase>({
    reducer: (x, y) => y ?? x,
    default: () => 'understanding' as SearchPhase
  }),
  error: Annotation<string | undefined>({
    reducer: (x, y) => y ?? x,
    default: () => undefined
  }),
  errorType: Annotation<ErrorType | undefined>({
    reducer: (x, y) => y ?? x,
    default: () => undefined
  }),
  maxRetries: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => SEARCH_CONFIG.MAX_RETRIES
  }),
  retryCount: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => 0
  }),
  
  // Multi-provider search fields
  searchProvider: Annotation<SearchProvider | undefined>({
    reducer: (x, y) => y ?? x,
    default: () => undefined
  }),
  providerReason: Annotation<string | undefined>({
    reducer: (x, y) => y ?? x,
    default: () => undefined
  }),
  preAnswer: Annotation<string | undefined>({
    reducer: (x, y) => y ?? x,
    default: () => undefined
  })
});

type SearchState = typeof SearchStateAnnotation.State;

// Define config type for proper event handling
interface GraphConfig {
  configurable?: {
    eventCallback?: (event: SearchEvent) => void;
    checkpointId?: string;
  };
}

export class LangGraphSearchEngine {
  private firecrawl: FirecrawlClient;
  private unifiedSearch: UnifiedSearchProvider;
  private contextProcessor: ContextProcessor;
  private graph: ReturnType<typeof this.buildGraph>;
  private llm: ChatOpenAI;
  private streamingLlm: ChatOpenAI;
  private checkpointer?: MemorySaver;

  constructor(firecrawl: FirecrawlClient, options?: { enableCheckpointing?: boolean }) {
    this.firecrawl = firecrawl;
    this.unifiedSearch = new UnifiedSearchProvider(firecrawl);
    this.contextProcessor = new ContextProcessor();
    
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    
    // Initialize LangChain models
    this.llm = new ChatOpenAI({
      modelName: MODEL_CONFIG.FAST_MODEL,
      temperature: MODEL_CONFIG.TEMPERATURE,
      openAIApiKey: apiKey,
    });
    
    this.streamingLlm = new ChatOpenAI({
      modelName: MODEL_CONFIG.QUALITY_MODEL,
      temperature: MODEL_CONFIG.TEMPERATURE,
      streaming: true,
      openAIApiKey: apiKey,
    });

    // Enable checkpointing if requested
    if (options?.enableCheckpointing) {
      this.checkpointer = new MemorySaver();
    }
    
    // Log available search providers
    const providerStatus = this.unifiedSearch.getProviderStatus();
    console.log('Search providers:', Object.entries(providerStatus)
      .map(([p, s]) => `${p}: ${s ? '✓' : '✗'}`)
      .join(', ')
    );
    
    this.graph = this.buildGraph();
  }

  getInitialSteps(): SearchStep[] {
    return [
      { id: 'understanding', label: 'Understanding request', status: 'pending' },
      { id: 'planning', label: 'Planning search', status: 'pending' },
      { id: 'searching', label: 'Searching sources', status: 'pending' },
      { id: 'analyzing', label: 'Analyzing content', status: 'pending' },
      { id: 'synthesizing', label: 'Synthesizing answer', status: 'pending' },
      { id: 'complete', label: 'Complete', status: 'pending' }
    ];
  }

  private buildGraph() {
    // Create closures for helper methods
    const analyzeQuery = this.analyzeQuery.bind(this);
    const scoreContent = this.scoreContent.bind(this);
    const summarizeContent = this.summarizeContent.bind(this);
    const generateStreamingAnswer = this.generateStreamingAnswer.bind(this);
    const generateFollowUpQuestions = this.generateFollowUpQuestions.bind(this);
    const firecrawl = this.firecrawl;
    const contextProcessor = this.contextProcessor;
    
    const workflow = new StateGraph(SearchStateAnnotation)
      // Understanding node
      .addNode("understand", async (state: SearchState, config?: GraphConfig): Promise<Partial<SearchState>> => {
        const eventCallback = config?.configurable?.eventCallback;
        
        if (eventCallback) {
          eventCallback({
            type: 'phase-update',
            phase: 'understanding',
            message: 'Analyzing your request...'
          });
        }
        
        try {
          // Check if the user provided any URLs - if so, scrape them first
          // BUT skip this for crawl/map operations (let the search node handle those)
          const urls = extractUrlsFromQuery(state.query);
          const isCrawlMap = isCrawlOrMapQuery(state.query);
          let urlSources: Source[] | undefined = undefined;
          
          if (urls.length > 0 && !isCrawlMap) {
            if (eventCallback) {
              eventCallback({
                type: 'provider-selected',
                provider: 'firecrawl',
                reason: 'User provided explicit URL(s) - scraping directly with Firecrawl'
              });
            }
            
            // Scrape URLs in parallel
            const scrapeResults = await Promise.allSettled(
              urls.slice(0, 3).map(async (url, index) => {
                if (eventCallback) {
                  eventCallback({
                    type: 'scraping',
                    url,
                    index: index + 1,
                    total: Math.min(urls.length, 3),
                    query: state.query
                  });
                }
                
                const result = await firecrawl.scrapeForLLM(url, {
                  onlyMainContent: true,
                  includeLinks: false,
                });
                
                if (result.success && result.markdown) {
                  const source: Source = {
                    url,
                    title: result.title || url,
                    content: result.markdown,
                    quality: 1.0, // High quality since it's directly scraped
                  };
                  
                  // Generate summary for the scraped content
                  const summary = await summarizeContent(result.markdown, state.query);
                  if (summary) {
                    source.summary = summary;
                    if (eventCallback) {
                      eventCallback({
                        type: 'source-complete',
                        url,
                        summary
                      });
                    }
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
              eventCallback({
                type: 'found',
                sources: urlSources,
                query: `Scraped ${urlSources.length} URL(s)`,
                provider: 'firecrawl'
              });
            }
          }
          
          const understanding = await analyzeQuery(state.query, state.context);
          
          if (eventCallback) {
            eventCallback({
              type: 'thinking',
              message: understanding
            });
          }
          
          return {
            understanding,
            urlSources,
            phase: 'planning' as SearchPhase
          };
        } catch (error) {
          return {
            error: error instanceof Error ? error.message : 'Failed to understand query',
            errorType: 'llm' as ErrorType,
            phase: 'error' as SearchPhase
          };
        }
      })
      
      // Planning node
      .addNode("plan", async (state: SearchState, config?: GraphConfig): Promise<Partial<SearchState>> => {
        const eventCallback = config?.configurable?.eventCallback;
        
        if (eventCallback) {
          eventCallback({
            type: 'phase-update',
            phase: 'planning',
            message: 'Planning search strategy...'
          });
        }
        
        try {
          // Extract sub-queries if not already done
          let subQueries = state.subQueries;
          if (!subQueries) {
            const extractSubQueries = this.extractSubQueries.bind(this);
            const extracted = await extractSubQueries(state.query);
            subQueries = extracted.map(sq => ({
              question: sq.question,
              searchQuery: sq.searchQuery,
              answered: false,
              confidence: 0,
              sources: []
            }));
          }
          
          // If we have URL sources scraped from user-provided URLs, check if they answer the questions
          if (state.urlSources && state.urlSources.length > 0 && state.searchAttempt === 0) {
            const checkAnswersInSources = this.checkAnswersInSources.bind(this);
            const updatedSubQueries = await checkAnswersInSources(subQueries, state.urlSources);
            
            const answeredCount = updatedSubQueries.filter(sq => sq.answered).length;
            const totalQuestions = updatedSubQueries.length;
            
            if (eventCallback) {
              if (answeredCount === totalQuestions) {
                eventCallback({
                  type: 'thinking',
                  message: `Found answers to all ${totalQuestions} questions in the provided URL(s)`
                });
              } else if (answeredCount > 0) {
                eventCallback({
                  type: 'thinking',
                  message: `Found answers to ${answeredCount} of ${totalQuestions} questions in the URL. Searching for more info...`
                });
              }
            }
            
            // If all questions are answered, skip to analysis
            if (answeredCount === totalQuestions) {
              return {
                subQueries: updatedSubQueries,
                sources: state.urlSources,
                phase: 'analyzing' as SearchPhase
              };
            }
            
            // Update subQueries with what we found
            subQueries = updatedSubQueries;
          }
          
          // Generate search queries for unanswered questions
          const unansweredQueries = subQueries.filter(sq => !sq.answered || sq.confidence < SEARCH_CONFIG.MIN_ANSWER_CONFIDENCE);
          
          if (unansweredQueries.length === 0) {
            // All questions answered, skip to analysis
            return {
              subQueries,
              phase: 'analyzing' as SearchPhase
            };
          }
          
          // Use alternative search queries if this is a retry
          let searchQueries: string[];
          if (state.searchAttempt > 0) {
            const generateAlternativeSearchQueries = this.generateAlternativeSearchQueries.bind(this);
            searchQueries = await generateAlternativeSearchQueries(subQueries, state.searchAttempt);
            
            // Update sub-queries with new search queries
            let alternativeIndex = 0;
            subQueries.forEach(sq => {
              if (!sq.answered || sq.confidence < SEARCH_CONFIG.MIN_ANSWER_CONFIDENCE) {
                if (alternativeIndex < searchQueries.length) {
                  sq.searchQuery = searchQueries[alternativeIndex];
                  alternativeIndex++;
                }
              }
            });
          } else {
            // First attempt - use the search queries from sub-queries
            searchQueries = unansweredQueries.map(sq => sq.searchQuery);
          }
          
          if (eventCallback) {
            if (state.searchAttempt === 0) {
              eventCallback({
                type: 'thinking',
                message: searchQueries.length > 3 
                  ? `I detected ${subQueries.length} different questions. I'll search for each one separately.`
                  : `I'll search for information to answer your question.`
              });
            } else {
              eventCallback({
                type: 'thinking',
                message: `Trying alternative search strategies for: ${unansweredQueries.map(sq => sq.question).join(', ')}`
              });
            }
          }
          
          return {
            searchQueries,
            subQueries,
            currentSearchIndex: 0,
            phase: 'searching' as SearchPhase
          };
        } catch (error) {
          return {
            error: error instanceof Error ? error.message : 'Failed to plan search',
            errorType: 'llm' as ErrorType,
            phase: 'error' as SearchPhase
          };
        }
      })
      
      // Search node (handles one search at a time with multi-provider support)
      .addNode("search", async (state: SearchState, config?: GraphConfig): Promise<Partial<SearchState>> => {
        const eventCallback = config?.configurable?.eventCallback;
        const searchQueries = state.searchQueries || [];
        const currentIndex = state.currentSearchIndex || 0;
        const unifiedSearch = this.unifiedSearch;
        
        if (currentIndex === 0 && eventCallback) {
          eventCallback({
            type: 'phase-update',
            phase: 'searching',
            message: 'Searching the web...'
          });
        }
        
        if (currentIndex >= searchQueries.length) {
          return {
            phase: 'scrape' as SearchPhase
          };
        }
        
        const searchQuery = searchQueries[currentIndex];
        
        try {
          // Use unified search with automatic provider routing
          const searchResult = PROVIDER_CONFIG.ENABLE_MULTI_PROVIDER
            ? await unifiedSearch.search(searchQuery, {
                maxResults: SEARCH_CONFIG.MAX_SOURCES_PER_SEARCH,
              })
            : await unifiedSearch.searchWithProvider(searchQuery, 'firecrawl', {
                maxResults: SEARCH_CONFIG.MAX_SOURCES_PER_SEARCH,
              });
          
          const usedProvider = searchResult.provider;
          const providerReason = searchResult.classification.reason;
          
          // Notify about provider selection (only on first query)
          if (currentIndex === 0 && eventCallback) {
            eventCallback({
              type: 'provider-selected',
              provider: usedProvider,
              reason: providerReason
            });
          }
          
          if (eventCallback) {
            eventCallback({
              type: 'searching',
              query: searchQuery,
              index: currentIndex + 1,
              total: searchQueries.length,
              provider: usedProvider
            });
          }
          
          const newSources: Source[] = searchResult.sources;
          
          if (eventCallback) {
            eventCallback({
              type: 'found',
              sources: newSources,
              query: searchQuery,
              provider: usedProvider
            });
          }
          
          // Process sources in parallel for better performance
          if (SEARCH_CONFIG.PARALLEL_SUMMARY_GENERATION) {
            await Promise.all(newSources.map(async (source) => {
              if (eventCallback) {
                eventCallback({
                  type: 'source-processing',
                  url: source.url,
                  title: source.title,
                  stage: 'browsing'
                });
              }
              
              // Score the content
              source.quality = scoreContent(source.content || '', state.query);
              
              // Generate summary if content is available and no summary exists
              if (!source.summary && source.content && source.content.length > SEARCH_CONFIG.MIN_CONTENT_LENGTH) {
                const summary = await summarizeContent(source.content, searchQuery);
                
                // Store the summary in the source object
                if (summary && !summary.toLowerCase().includes('no specific')) {
                  source.summary = summary;
                  
                  if (eventCallback) {
                    eventCallback({
                      type: 'source-complete',
                      url: source.url,
                      summary: summary
                    });
                  }
                }
              } else if (source.summary && eventCallback) {
                // Source already has a summary from the provider
                eventCallback({
                  type: 'source-complete',
                  url: source.url,
                  summary: source.summary
                });
              }
            }));
          } else {
            // Original sequential processing
            for (const source of newSources) {
              if (eventCallback) {
                eventCallback({
                  type: 'source-processing',
                  url: source.url,
                  title: source.title,
                  stage: 'browsing'
                });
              }
              
              // Small delay for animation
              await new Promise(resolve => setTimeout(resolve, SEARCH_CONFIG.SOURCE_ANIMATION_DELAY));
              
              // Score the content
              source.quality = scoreContent(source.content || '', state.query);
              
              // Generate summary if content is available and no summary exists
              if (!source.summary && source.content && source.content.length > SEARCH_CONFIG.MIN_CONTENT_LENGTH) {
                const summary = await summarizeContent(source.content, searchQuery);
                
                // Store the summary in the source object
                if (summary && !summary.toLowerCase().includes('no specific')) {
                  source.summary = summary;
                  
                  if (eventCallback) {
                    eventCallback({
                      type: 'source-complete',
                      url: source.url,
                      summary: summary
                    });
                  }
                }
              } else if (source.summary && eventCallback) {
                eventCallback({
                  type: 'source-complete',
                  url: source.url,
                  summary: source.summary
                });
              }
            }
          }
          
          return {
            sources: newSources,
            currentSearchIndex: currentIndex + 1,
            searchProvider: usedProvider,
            providerReason: providerReason,
            preAnswer: searchResult.preAnswer, // Tavily may provide this
          };
        } catch {
          return {
            currentSearchIndex: currentIndex + 1,
            errorType: 'search' as ErrorType
          };
        }
      })
      
      // Scraping node - Enhanced with Firecrawl deep extraction
      .addNode("scrape", async (state: SearchState, config?: GraphConfig): Promise<Partial<SearchState>> => {
        const eventCallback = config?.configurable?.eventCallback;
        const sourcesToScrape = state.sources?.filter(s => 
          !s.content || s.content.length < SEARCH_CONFIG.MIN_CONTENT_LENGTH
        ) || [];
        const newScrapedSources: Source[] = [];
        
        // Sources with content were already processed in search node, just pass them through
        const sourcesWithContent = state.sources?.filter(s => 
          s.content && s.content.length >= SEARCH_CONFIG.MIN_CONTENT_LENGTH
        ) || [];
        newScrapedSources.push(...sourcesWithContent);
        
        // Determine if we should use deep extraction based on config
        const useDeepExtraction = PROVIDER_CONFIG.FIRECRAWL?.ENABLE_DEEP_EXTRACTION ?? true;
        const autoScrapeThreshold = PROVIDER_CONFIG.FIRECRAWL?.AUTO_SCRAPE_THRESHOLD ?? 3;
        
        // Also auto-scrape top sources even if they have some content (for richer data)
        const topSourcesToEnrich = useDeepExtraction 
          ? state.sources?.slice(0, autoScrapeThreshold).filter(s => 
              !newScrapedSources.some(ns => ns.url === s.url)
            ) || []
          : [];
        
        const allSourcesToProcess = [...sourcesToScrape, ...topSourcesToEnrich];
        const uniqueSources = allSourcesToProcess.filter((s, i, arr) => 
          arr.findIndex(x => x.url === s.url) === i
        );
        
        if (eventCallback && uniqueSources.length > 0) {
          eventCallback({
            type: 'thinking',
            message: `Extracting deep content from ${uniqueSources.length} sources using Firecrawl...`
          });
        }
        
        // Process sources in parallel for better performance
        const scrapePromises = uniqueSources
          .slice(0, SEARCH_CONFIG.MAX_SOURCES_TO_SCRAPE)
          .map(async (source, i) => {
            if (eventCallback) {
              eventCallback({
                type: 'scraping',
                url: source.url,
                index: newScrapedSources.length + i + 1,
                total: sourcesWithContent.length + Math.min(uniqueSources.length, SEARCH_CONFIG.MAX_SOURCES_TO_SCRAPE),
                query: state.query
              });
            }
            
            try {
              // Use the enhanced scrapeForLLM method for better formatting
              const scraped = await firecrawl.scrapeForLLM(source.url, {
                onlyMainContent: true,
                includeLinks: false,
              });
              
              if (scraped.success && scraped.markdown) {
                const enrichedSource: Source = {
                  ...source,
                  title: scraped.title || source.title,
                  content: scraped.markdown,
                  quality: scoreContent(scraped.markdown, state.query)
                };
                
                // Show processing animation
                if (eventCallback) {
                  eventCallback({
                    type: 'source-processing',
                    url: source.url,
                    title: enrichedSource.title,
                    stage: 'extracting'
                  });
                }
                
                // Generate summary
                const summary = await summarizeContent(scraped.markdown, state.query);
                if (summary) {
                  enrichedSource.summary = summary;
                  
                  if (eventCallback) {
                    eventCallback({
                      type: 'source-complete',
                      url: source.url,
                      summary: summary
                    });
                  }
                }
                
                return enrichedSource;
              } else if (scraped.error) {
                if (eventCallback) {
                  const hostname = new URL(source.url).hostname;
                  eventCallback({
                    type: 'thinking',
                    message: `Couldn't fully extract ${hostname}, using available content...`
                  });
                }
                // Return original source if scrape failed
                return source.content ? source : null;
              }
            } catch {
              if (eventCallback) {
                try {
                  const hostname = new URL(source.url).hostname;
                  eventCallback({
                    type: 'thinking',
                    message: `Couldn't access ${hostname}, trying other sources...`
                  });
                } catch {
                  // Ignore URL parsing errors
                }
              }
            }
            return null;
          });
        
        // Wait for all scrapes to complete
        const results = await Promise.allSettled(scrapePromises);
        
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value) {
            newScrapedSources.push(result.value);
          }
        }
        
        return {
          scrapedSources: newScrapedSources,
          phase: 'analyzing' as SearchPhase
        };
      })
      
      // Analyzing node
      .addNode("analyze", async (state: SearchState, config?: GraphConfig): Promise<Partial<SearchState>> => {
        const eventCallback = config?.configurable?.eventCallback;
        
        if (eventCallback) {
          eventCallback({
            type: 'phase-update',
            phase: 'analyzing',
            message: 'Analyzing gathered information...'
          });
        }
        
        // Combine sources and remove duplicates by URL
        const sourceMap = new Map<string, Source>();
        
        // Add URL sources first (highest quality - directly scraped from user-provided URLs)
        (state.urlSources || []).forEach(s => sourceMap.set(s.url, s));
        
        // Add all sources (not just those with long content, since summaries contain key info)
        (state.sources || []).forEach(s => sourceMap.set(s.url, s));
        
        // Add scraped sources (may override with better content)
        (state.scrapedSources || []).forEach(s => sourceMap.set(s.url, s));
        
        const allSources = Array.from(sourceMap.values());
        
        // Check which questions have been answered
        if (state.subQueries) {
          const checkAnswersInSources = this.checkAnswersInSources.bind(this);
          const updatedSubQueries = await checkAnswersInSources(state.subQueries, allSources);
          
          const answeredCount = updatedSubQueries.filter(sq => sq.answered).length;
          const totalQuestions = updatedSubQueries.length;
          const searchAttempt = (state.searchAttempt || 0) + 1;
          
          // Check if we have partial answers with decent confidence
          const partialAnswers = updatedSubQueries.filter(sq => sq.confidence >= 0.3);
          const hasPartialInfo = partialAnswers.length > answeredCount;
          
          if (eventCallback) {
            if (answeredCount === totalQuestions) {
              eventCallback({
                type: 'thinking',
                message: `Found answers to all ${totalQuestions} questions across ${allSources.length} sources`
              });
            } else if (answeredCount > 0) {
              eventCallback({
                type: 'thinking',
                message: `Found answers to ${answeredCount} of ${totalQuestions} questions. Still missing: ${updatedSubQueries.filter(sq => !sq.answered).map(sq => sq.question).join(', ')}`
              });
            } else if (searchAttempt >= SEARCH_CONFIG.MAX_SEARCH_ATTEMPTS) {
              // Only show "could not find" message when we've exhausted all attempts
              eventCallback({
                type: 'thinking',
                message: `Could not find specific answers in ${allSources.length} sources. The information may not be publicly available.`
              });
            } else if (hasPartialInfo && searchAttempt >= 3) {
              // If we have partial info and tried 3+ times, stop searching
              eventCallback({
                type: 'thinking',
                message: `Found partial information. Moving forward with what's available.`
              });
            } else {
              // For intermediate attempts, show a different message
              eventCallback({
                type: 'thinking',
                message: `Searching for more specific information...`
              });
            }
          }
          
          // If we haven't found all answers and haven't exceeded attempts, try again
          // BUT stop if we have partial info and already tried 2+ times
          if (answeredCount < totalQuestions && 
              searchAttempt < SEARCH_CONFIG.MAX_SEARCH_ATTEMPTS &&
              !(hasPartialInfo && searchAttempt >= 2)) {
            return {
              sources: allSources,
              subQueries: updatedSubQueries,
              searchAttempt,
              phase: 'planning' as SearchPhase  // Go back to planning for retry
            };
          }
          
          // Otherwise proceed with what we have
          try {
            const processedSources = await contextProcessor.processSources(
              state.query,
              allSources,
              state.searchQueries || []
            );
            
            return {
              sources: allSources,
              processedSources,
              subQueries: updatedSubQueries,
              searchAttempt,
              phase: 'synthesizing' as SearchPhase
            };
          } catch {
            return {
              sources: allSources,
              processedSources: allSources,
              subQueries: updatedSubQueries,
              searchAttempt,
              phase: 'synthesizing' as SearchPhase
            };
          }
        } else {
          // Fallback for queries without sub-queries
          if (eventCallback && allSources.length > 0) {
            eventCallback({
              type: 'thinking',
              message: `Found ${allSources.length} sources with quality information`
            });
          }
          
          try {
            const processedSources = await contextProcessor.processSources(
              state.query,
              allSources,
              state.searchQueries || []
            );
            
            return {
              sources: allSources,
              processedSources,
              phase: 'synthesizing' as SearchPhase
            };
          } catch {
            return {
              sources: allSources,
              processedSources: allSources,
              phase: 'synthesizing' as SearchPhase
            };
          }
        }
      })
      
      // Synthesizing node with streaming
      .addNode("synthesize", async (state: SearchState, config?: GraphConfig): Promise<Partial<SearchState>> => {
        const eventCallback = config?.configurable?.eventCallback;
        
        if (eventCallback) {
          eventCallback({
            type: 'phase-update',
            phase: 'synthesizing',
            message: 'Creating comprehensive answer...'
          });
        }
        
        try {
          const sourcesToUse = state.processedSources || state.sources || [];
          
          const answer = await generateStreamingAnswer(
            state.query,
            sourcesToUse,
            (chunk) => {
              if (eventCallback) {
                eventCallback({ type: 'content-chunk', chunk });
              }
            },
            state.context
          );
          
          // Generate follow-up questions
          const followUpQuestions = await generateFollowUpQuestions(
            state.query,
            answer,
            sourcesToUse,
            state.context
          );
          
          return {
            finalAnswer: answer,
            followUpQuestions,
            phase: 'complete' as SearchPhase
          };
        } catch (error) {
          return {
            error: error instanceof Error ? error.message : 'Failed to generate answer',
            errorType: 'llm' as ErrorType,
            phase: 'error' as SearchPhase
          };
        }
      })
      
      // Error handling node
      .addNode("handleError", async (state: SearchState, config?: GraphConfig): Promise<Partial<SearchState>> => {
        const eventCallback = config?.configurable?.eventCallback;
        
        if (eventCallback) {
          eventCallback({
            type: 'error',
            error: state.error || 'An unknown error occurred',
            errorType: state.errorType
          });
        }
        
        // Retry logic based on error type
        if ((state.retryCount || 0) < (state.maxRetries || SEARCH_CONFIG.MAX_RETRIES)) {
              
          // Different retry strategies based on error type
          const retryPhase = state.errorType === 'search' ? 'searching' : 'understanding';
          
          return {
            retryCount: (state.retryCount || 0) + 1,
            phase: retryPhase as SearchPhase,
            error: undefined,
            errorType: undefined
          };
        }
        
        return {
          phase: 'error' as SearchPhase
        };
      })
      
      // Complete node
      .addNode("complete", async (state: SearchState, config?: GraphConfig): Promise<Partial<SearchState>> => {
        const eventCallback = config?.configurable?.eventCallback;
        
        if (eventCallback) {
          eventCallback({
            type: 'phase-update',
            phase: 'complete',
            message: 'Search complete!'
          });
          
          eventCallback({
            type: 'final-result',
            content: state.finalAnswer || '',
            sources: state.sources || [],
            followUpQuestions: state.followUpQuestions
          });
        }
        
        return {
          phase: 'complete' as SearchPhase
        };
      });

    // Add edges with proper conditional routing
    workflow
      .addEdge(START, "understand")
      .addConditionalEdges(
        "understand",
        (state: SearchState) => state.phase === 'error' ? "handleError" : "plan",
        {
          handleError: "handleError",
          plan: "plan"
        }
      )
      .addConditionalEdges(
        "plan",
        (state: SearchState) => state.phase === 'error' ? "handleError" : "search",
        {
          handleError: "handleError",
          search: "search"
        }
      )
      .addConditionalEdges(
        "search",
        (state: SearchState) => {
          if (state.phase === 'error') return "handleError";
          if ((state.currentSearchIndex || 0) < (state.searchQueries?.length || 0)) {
            return "search"; // Continue searching
          }
          return "scrape"; // Move to scraping
        },
        {
          handleError: "handleError",
          search: "search",
          scrape: "scrape"
        }
      )
      .addConditionalEdges(
        "scrape",
        (state: SearchState) => state.phase === 'error' ? "handleError" : "analyze",
        {
          handleError: "handleError",
          analyze: "analyze"
        }
      )
      .addConditionalEdges(
        "analyze",
        (state: SearchState) => {
          if (state.phase === 'error') return "handleError";
          if (state.phase === 'planning') return "plan";  // Retry with new searches
          return "synthesize";
        },
        {
          handleError: "handleError",
          plan: "plan",
          synthesize: "synthesize"
        }
      )
      .addConditionalEdges(
        "synthesize",
        (state: SearchState) => state.phase === 'error' ? "handleError" : "complete",
        {
          handleError: "handleError",
          complete: "complete"
        }
      )
      .addConditionalEdges(
        "handleError",
        (state: SearchState) => state.phase === 'error' ? END : "understand",
        {
          [END]: END,
          understand: "understand"
        }
      )
      .addEdge("complete", END);

    // Compile with optional checkpointing
    return workflow.compile(this.checkpointer ? { checkpointer: this.checkpointer } : undefined);
  }

  async search(
    query: string,
    onEvent: (event: SearchEvent) => void,
    context?: { query: string; response: string }[],
    checkpointId?: string
  ): Promise<void> {
    try {
      const initialState: SearchState = {
        query,
        context,
        sources: [],
        scrapedSources: [],
        processedSources: undefined,
        phase: 'understanding',
        currentSearchIndex: 0,
        maxRetries: SEARCH_CONFIG.MAX_RETRIES,
        retryCount: 0,
        understanding: undefined,
        searchQueries: undefined,
        finalAnswer: undefined,
        followUpQuestions: undefined,
        error: undefined,
        errorType: undefined,
        subQueries: undefined,
        searchAttempt: 0,
        // Multi-provider fields
        searchProvider: undefined,
        providerReason: undefined,
        preAnswer: undefined,
        // URL sources (when user provides explicit URLs)
        urlSources: undefined,
      };

      // Configure with event callback
      const config: GraphConfig = {
        configurable: {
          eventCallback: onEvent,
          ...(checkpointId && this.checkpointer ? { thread_id: checkpointId } : {})
        }
      };

      // Invoke the graph with increased recursion limit
      await this.graph.invoke(initialState, {
        ...config,
        recursionLimit: 35  // Increased from default 25 to handle MAX_SEARCH_ATTEMPTS=5
      });
    } catch (error) {
      onEvent({
        type: 'error',
        error: error instanceof Error ? error.message : 'Search failed',
        errorType: 'unknown'
      });
    }
  }


  // Get current date for context
  private getCurrentDateContext(): string {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    
    return `Today's date is ${dateStr}. The current year is ${year} and it's currently ${month}/${year}.`;
  }

  // Pure helper methods (no side effects)
  private async analyzeQuery(query: string, context?: { query: string; response: string }[]): Promise<string> {
    let contextPrompt = '';
    if (context && context.length > 0) {
      contextPrompt = '\n\nPrevious conversation:\n';
      context.forEach(c => {
        contextPrompt += `User: ${c.query}\nAssistant: ${c.response.substring(0, SEARCH_CONFIG.CONTEXT_PREVIEW_LENGTH)}...\n\n`;
      });
    }
    
    const messages = [
      new SystemMessage(`${this.getCurrentDateContext()}

Analyze the query. Output in this markdown format:

### [Short descriptive title]
**What we need to find:** [Key concepts as descriptive phrases, comma-separated. Cover: core concepts, mechanisms, use cases, tradeoffs. 10-15 phrases max.]

Example:
### Neural network learning mechanisms
**What we need to find:** forward propagation, backpropagation algorithm, gradient descent variants (SGD, Adam), loss functions (MSE, cross-entropy), weight initialization, activation functions (ReLU, sigmoid), batch vs online learning, learning rate tuning, regularization, overfitting prevention

Rules:
- Use short descriptive phrases, not full sentences
- Never ask clarifying questions—proceed with reasonable assumptions
- Refuse harmful/illegal requests
- Do NOT include "Connection to prior topic" unless there is actual conversation history`),
      new HumanMessage(`Query: "${query}"${contextPrompt}`)
    ];
    
    const response = await this.llm.invoke(messages);
    return response.content.toString();
  }

  private async checkAnswersInSources(
    subQueries: Array<{ question: string; searchQuery: string; answered: boolean; answer?: string; confidence: number; sources: string[] }>,
    sources: Source[]
  ): Promise<typeof subQueries> {
    if (sources.length === 0) return subQueries;
    
    const messages = [
      new SystemMessage(`Check which questions have been answered by the provided sources.

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

Version number matching:
- "0528" in the question matches "0528", "-0528", "May 28", or "May 28, 2025" in sources
- Example: Question about "DeepSeek R1 0528" is ANSWERED if sources mention:
  - "DeepSeek R1-0528" (exact match)
  - "DeepSeek R1 was updated on May 28" (date match)
  - "DeepSeek's R1 model was updated on May 28, 2025" (date match)
- Hyphens and spaces in version numbers should be ignored when matching
- If the summary mentions the product and a matching date/version, that's a full answer

Special cases:
- If asking about a product/model with a version number (e.g., "ModelX v2.5.1" or "Product 0528"), check BOTH:
  1. If sources mention the EXACT version → mark as answered with high confidence (0.8+)
  2. If sources only mention the base product → mark as answered with medium confidence (0.6+)
- Example: Question "What is ProductX 1234?" 
  - If sources mention "ProductX 1234" specifically → confidence: 0.9
  - If sources only mention "ProductX" → confidence: 0.6
- IMPORTANT: For questions like "What is DeepSeek R1 0528?", if sources contain "DeepSeek R1-0528" or "DeepSeek R1 0528", that's a DIRECT match (confidence 0.9+)
- If multiple sources contradict whether something exists, use low confidence (0.3) but still provide what information was found

Important: Be generous in recognizing answers. If the source clearly provides the information asked for (e.g., "The founders are X, Y, and Z"), mark it as answered with high confidence.

Return ONLY a JSON array, no markdown formatting or code blocks:
[
  {
    "question": "the original question",
    "answered": true/false,
    "confidence": 0.0-1.0,
    "answer": "brief answer if found",
    "sources": ["urls that contain the answer"]
  }
]`),
      new HumanMessage(`Questions to check:
${subQueries.map(sq => sq.question).join('\n')}

Sources:
${sources.slice(0, SEARCH_CONFIG.MAX_SOURCES_TO_CHECK).map(s => {
  let sourceInfo = `URL: ${s.url}\nTitle: ${s.title}\n`;
  
  // Include summary if available (this is the key insight from the search)
  if (s.summary) {
    sourceInfo += `Summary: ${s.summary}\n`;
  }
  
  // Include content preview
  if (s.content) {
    sourceInfo += `Content: ${s.content.slice(0, SEARCH_CONFIG.ANSWER_CHECK_PREVIEW)}\n`;
  }
  
  return sourceInfo;
}).join('\n---\n')}`)
    ];

    try {
      const response = await this.llm.invoke(messages);
      let content = response.content.toString();
      
      // Strip markdown code blocks if present
      content = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
      
      const results = JSON.parse(content);
      
      // Update sub-queries with results
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
      console.error('Error checking answers:', error);
      return subQueries;
    }
  }

  private async extractSubQueries(query: string): Promise<Array<{ question: string; searchQuery: string }>> {
    const messages = [
      new SystemMessage(`You are Yurie, an AI search assistant. Extract the individual factual questions from this query.

IMPORTANT: 
- If the user asks about YOU (your name, who you are, your capabilities), interpret this as a question about "Yurie".
- Do NOT assume you are ChatGPT, OpenAI, or any other model. You are Yurie.
- If the query is "what is your name", the question is "Who is Yurie?" and the search query is "Yurie AI search assistant".
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
  {"question": "Who is Yurie?", "searchQuery": "Yurie AI search assistant"}
]

Return ONLY a JSON array of {question, searchQuery} objects.`),
      new HumanMessage(`Query: "${query}"`)
    ];

    try {
      const response = await this.llm.invoke(messages);
      return JSON.parse(response.content.toString());
    } catch {
      // Fallback: treat as single query
      return [{ question: query, searchQuery: query }];
    }
  }

  // This method was removed as it's not used in the current implementation
  // Search queries are now generated from sub-queries in the plan node

  private async generateAlternativeSearchQueries(
    subQueries: Array<{ question: string; searchQuery: string; answered: boolean; answer?: string; confidence: number; sources: string[] }>,
    previousAttempts: number
  ): Promise<string[]> {
    const unansweredQueries = subQueries.filter(sq => !sq.answered || sq.confidence < SEARCH_CONFIG.MIN_ANSWER_CONFIDENCE);
    
    // If we're on attempt 3 and still searching for the same thing, just give up on that specific query
    if (previousAttempts >= 2) {
      const problematicQueries = unansweredQueries.filter(sq => {
        // Check if the question contains a version number or specific identifier that might not exist
        const hasVersionPattern = /\b\d{3,4}\b|\bv\d+\.\d+|\bversion\s+\d+/i.test(sq.question);
        const hasFailedMultipleTimes = previousAttempts >= 2;
        return hasVersionPattern && hasFailedMultipleTimes;
      });
      
      if (problematicQueries.length > 0) {
        // Return generic searches that might find partial info
        return problematicQueries.map(sq => {
          const baseTerm = sq.question.replace(/0528|specific version/gi, '').trim();
          return baseTerm.substring(0, 50); // Keep it short
        });
      }
    }
    
    const messages = [
      new SystemMessage(`${this.getCurrentDateContext()}

Generate ALTERNATIVE search queries for questions that weren't answered in previous attempts.

Previous search attempts: ${previousAttempts}
Previous queries that didn't find answers:
${unansweredQueries.map(sq => `- Question: "${sq.question}"\n  Previous search: "${sq.searchQuery}"`).join('\n')}

IMPORTANT: If searching for something with a specific version/date that keeps failing (like "R1 0528"), try searching for just the base product without the version.

Generate NEW search queries using these strategies:
1. Try broader or more general terms
2. Try different phrasings or synonyms
3. Remove specific qualifiers (like years or versions) if they're too restrictive
4. Try searching for related concepts that might contain the answer
5. For products that might not exist, search for the company or base product name

Examples of alternative searches:
- Original: "ModelX 2024.05" → Alternative: "ModelX latest version"
- Original: "OpenAI Q3 2024 revenue" → Alternative: "OpenAI financial results 2024"
- Original: "iPhone 15 Pro features" → Alternative: "latest iPhone specifications"

Return one alternative search query per unanswered question, one per line.`),
      new HumanMessage(`Generate alternative searches for these ${unansweredQueries.length} unanswered questions.`)
    ];

    try {
      const response = await this.llm.invoke(messages);
      const result = response.content.toString();
      
      const queries = result
        .split('\n')
        .map(q => q.trim())
        .map(q => q.replace(/^["']|["']$/g, ''))
        .map(q => q.replace(/^\d+\.\s*/, ''))
        .map(q => q.replace(/^[-*#]\s*/, ''))
        .filter(q => q.length > 0)
        .filter(q => !q.match(/^```/))
        .filter(q => q.length > 3);
      
      return queries.slice(0, SEARCH_CONFIG.MAX_SEARCH_QUERIES);
    } catch {
      // Fallback: return original queries with slight modifications
      return unansweredQueries.map(sq => sq.searchQuery + " news reports").slice(0, SEARCH_CONFIG.MAX_SEARCH_QUERIES);
    }
  }

  private scoreContent(content: string, query: string): number {
    const queryWords = query.toLowerCase().split(' ');
    const contentLower = content.toLowerCase();
    
    let score = 0;
    for (const word of queryWords) {
      if (contentLower.includes(word)) score += 0.2;
    }
    
    return Math.min(score, 1);
  }

  private async summarizeContent(content: string, query: string): Promise<string> {
    try {
      const messages = [
        new SystemMessage(`${this.getCurrentDateContext()}

Extract ONE key finding from this content that's SPECIFICALLY relevant to the search query.

CRITICAL: Only summarize information that directly relates to the search query.
- If searching for "Samsung phones", only mention Samsung phone information
- If searching for "Firecrawl founders", only mention founder information
- If no relevant information is found, just return the most relevant fact from the page

Instructions:
- Return just ONE sentence with a specific finding
- Include numbers, dates, or specific details when available
- Keep it under ${SEARCH_CONFIG.SUMMARY_CHAR_LIMIT} characters
- Don't say "No relevant information was found" - find something relevant to the current search`),
        new HumanMessage(`Query: "${query}"\n\nContent: ${content.slice(0, 2000)}`)
      ];
      
      const response = await this.llm.invoke(messages);
      return response.content.toString().trim();
    } catch {
      return '';
    }
  }

  private async generateStreamingAnswer(
    query: string,
    sources: Source[],
    onChunk: (chunk: string) => void,
    context?: { query: string; response: string }[]
  ): Promise<string> {
    const sourcesText = sources
      .map((s, i) => {
        if (!s.content) return `[${i + 1}] ${s.title}\n[No content available]`;
        return `[${i + 1}] ${s.title}\n${s.content}`;
      })
      .join('\n\n');
    
    let contextPrompt = '';
    if (context && context.length > 0) {
      contextPrompt = '\n\nPrevious conversation for context:\n';
      context.forEach(c => {
        contextPrompt += `User: ${c.query}\nAssistant: ${c.response.substring(0, 300)}...\n\n`;
      });
    }
    
    const messages = [
      new SystemMessage(`${this.getCurrentDateContext()}

You are Yurie, an elite research assistant producing publication-quality academic research papers. Your outputs follow the structure and conventions of peer-reviewed scholarly articles.

---

# ACADEMIC RESEARCH PAPER FORMAT

Your response MUST follow this exact structure:

---

# [Research Paper Title]

Create a formal, descriptive academic title. Use title case. May include a colon with subtitle for specificity.

**Examples:**
- "Quantum Entanglement in Biological Systems: Evidence, Mechanisms, and Implications"
- "The Economic Impact of Climate Change on Agricultural Productivity: A Meta-Analysis"
- "Neural Network Architectures for Natural Language Processing: A Comparative Study"

---

## Abstract

A single, dense paragraph (150-250 words) containing:
- **Background**: One sentence establishing the research context
- **Objective**: The specific question or problem addressed
- **Methods**: Brief mention of the approach or sources analyzed
- **Results**: Key findings with specific data points when available
- **Conclusion**: Primary implications and significance

---

## 1. Introduction

Write in formal academic prose (no bullet points in this section):
- Open with the broader context and significance of the topic
- Narrow to the specific research question or problem
- Define essential terminology and concepts
- State the scope and objectives of this analysis
- Briefly outline the structure of the paper

---

## 2. Background & Literature Review

Synthesize existing knowledge on the topic:
- Present foundational theories and established facts
- Discuss key prior research and findings with citations
- Identify gaps, debates, or unresolved questions in the literature
- Use ### subsections to organize thematically

### 2.1 [Thematic Subsection Title]
### 2.2 [Another Thematic Subsection]

---

## 3. Methodology

Describe the analytical approach:
- Sources examined and selection criteria
- Analytical framework or lens applied
- Limitations of available data or sources
- (For empirical topics) Research design, data collection, analysis methods

---

## 4. Findings & Analysis

Present the core research findings organized logically:
- Use ### subsections for distinct themes or findings
- Present evidence with inline citations [1], [2]
- Include specific data: dates, figures, statistics, quotes
- Use tables for comparative data when appropriate
- Maintain objective, analytical tone

### 4.1 [Finding Category One]
### 4.2 [Finding Category Two]
### 4.3 [Finding Category Three]

---

## 5. Discussion

Interpret and contextualize the findings:
- Synthesize results across multiple sources
- Compare findings with existing literature
- Address contradictions or conflicting evidence
- Discuss theoretical and practical implications
- Acknowledge limitations of the current analysis

---

## 6. Conclusion

Summarize in formal prose:
- Restate the primary findings and their significance
- Address the original research question directly
- Suggest directions for future research
- End with broader implications or final insight

---

## ACADEMIC WRITING STANDARDS

**Voice & Tone:**
- Third person, objective voice preferred
- Formal academic register throughout
- Avoid colloquialisms, contractions, and casual language
- Use hedging language appropriately ("suggests," "indicates," "appears to")

**Citations:**
- Cite every factual claim: [1], [2], [3]
- Multiple citations for well-supported claims: [1], [4], [7]
- Synthesize across sources; avoid over-reliance on single sources
- Note when sources conflict: "While [1] argues X, [3] contends Y"

**Structure:**
- Use # for title, ## for main sections, ### for subsections
- Number main sections (1. Introduction, 2. Background, etc.)
- Use paragraphs, not bullet points, for core arguments
- Reserve bullet points for lists, enumerations, or summaries only

**Evidence:**
- Prioritize specificity: names, dates, quantities, measurements
- Include direct quotes sparingly and with attribution
- Present data in tables when comparing multiple items
- Distinguish between established facts and interpretations

**Integrity:**
- Never fabricate information or citations
- If sources lack information: "The available literature does not address..."
- Acknowledge uncertainty: "Further research is needed to determine..."
- Present multiple perspectives on contested topics

---

**Identity:** You are Yurie. Never claim to be another AI system.
**Safety:** Decline requests for harmful, illegal, or unethical content.`),
      new HumanMessage(`Question: "${query}"${contextPrompt}\n\nBased on these sources:\n${sourcesText}`)
    ];
    
    let fullText = '';
    
    try {
      const stream = await this.streamingLlm.stream(messages);
      
      for await (const chunk of stream) {
        const content = chunk.content;
        if (typeof content === 'string') {
          fullText += content;
          onChunk(content);
        }
      }
    } catch {
      // Fallback to non-streaming if streaming fails
      const response = await this.llm.invoke(messages);
      fullText = response.content.toString();
      onChunk(fullText);
    }
    
    return fullText;
  }

  private async generateFollowUpQuestions(
    originalQuery: string,
    answer: string,
    _sources: Source[],
    context?: { query: string; response: string }[]
  ): Promise<string[]> {
    try {
      let contextPrompt = '';
      if (context && context.length > 0) {
        contextPrompt = '\n\nPrevious conversation topics:\n';
        context.forEach(c => {
          contextPrompt += `- ${c.query}\n`;
        });
        contextPrompt += '\nConsider the full conversation flow when generating follow-ups.\n';
      }
      
      const messages = [
        new SystemMessage(`${this.getCurrentDateContext()}

You are Yurie, a researcher anticipating the next logical steps in this investigation.

**Guidelines:**
1. **Relevance**: Questions must directly follow from the previous answer.
2. **Depth**: Focus on "how", "why", and "what if" rather than simple facts.
3. **Safety**: Do not generate questions that lead to harmful or policy-violating topics.
4. **Natural Tone**: Phrase questions as a curious human researcher would.

Instructions:
- Generate exactly 3 follow-up questions
- Each question should explore a different aspect or dig deeper into the topic
- Questions should be natural and conversational
- They should build upon the information provided in the answer
- Make them specific and actionable
- Keep each question under 80 characters
- Return only the questions, one per line, no numbering or bullets
- Consider the entire conversation context when generating questions
- Only include time-relevant questions if the original query was about current events or trends

Examples of good follow-up questions:
- "How does this compare to [alternative]?"
- "Can you explain [technical term] in more detail?"
- "What are the practical applications of this?"
- "What are the main benefits and drawbacks?"
- "How is this typically implemented?"`),
        new HumanMessage(`Original query: "${originalQuery}"\n\nAnswer summary: ${answer.length > 1000 ? answer.slice(0, 1000) + '...' : answer}${contextPrompt}`)
      ];
      
      const response = await this.llm.invoke(messages);
      const questions = response.content.toString()
        .split('\n')
        .map(q => q.trim())
        .filter(q => q.length > 0 && q.length < 80)
        .slice(0, 3);
      
      return questions.length > 0 ? questions : [];
    } catch {
      return [];
    }
  }
}