import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { MODEL_CONFIG } from "../config";

export type SearchProvider = 'tavily' | 'exa' | 'firecrawl' | 'semantic-scholar';

/**
 * Firecrawl operation types for deep content extraction
 */
export type FirecrawlOperation = 'search' | 'scrape' | 'crawl' | 'map';

export interface QueryClassification {
  provider: SearchProvider;
  confidence: number;
  reason: string;
  suggestedMode?: 'search' | 'similar' | 'research' | 'academic' | 'technical';
  firecrawlOperation?: FirecrawlOperation;
}

const CLASSIFICATION_PROMPT = `You are a search query router. Classify this query to determine the best search provider.

**Available Providers (use each appropriately based on query type):**

1. **tavily** - Best for:
   - Factual questions ("Who founded X?", "When did Y happen?")
   - Current events and news
   - Real-time information (prices, weather, stocks)
   - Quick Q&A style queries
   - General knowledge lookups
   - "What is X?" questions

2. **firecrawl** - Best for:
   - Technical documentation and tutorials
   - Deep content extraction from specific websites
   - How-to guides and explanations
   - Product comparisons requiring detailed analysis
   - Explicit URL scraping requests
   - When user provides a specific website to analyze
   - Full page content extraction

3. **exa** - Best for:
   - Similarity searches ("Find companies like X", "Similar papers to Y")
   - Deep investigation requiring multiple sources
   - Finding related content or alternatives
   - Company/startup research
   - Historical analysis requiring semantic understanding

4. **semantic-scholar** - Best for:
   - Academic paper searches ("papers on X", "research about Y")
   - Scientific literature and citations
   - Finding papers by specific authors
   - Conference papers (NeurIPS, ICML, ACL, CVPR, etc.)
   - ArXiv, PubMed, and peer-reviewed journal content
   - DOI lookups

**Choose the provider that best matches the query intent. Each provider has its strengths.**

**Response Format (JSON only):**
{
  "provider": "tavily" | "firecrawl" | "exa" | "semantic-scholar",
  "confidence": 0.0-1.0,
  "reason": "brief explanation",
  "suggestedMode": "search" | "similar" | "research" | "academic" | "technical"
}

**Suggested Modes:**
- "search": Standard search
- "similar": Find similar content (when query contains "like", "similar to", "alternatives")
- "research": Deep multi-hop research
- "academic": Academic paper search (use semantic-scholar)
- "technical": Code and documentation search

**Examples:**
- "Who is the CEO of Apple?" → tavily, search
- "How does React's useEffect hook work?" → firecrawl, technical
- "Find startups similar to Stripe" → exa, similar
- "Papers on transformer architecture" → semantic-scholar, academic
- "Latest AI news" → tavily, search
- "Compare Next.js vs Remix in detail" → firecrawl, research
- "Companies like Notion" → exa, similar
- "Current Bitcoin price" → tavily, search
- "Scrape https://docs.example.com" → firecrawl, search`;

export class SearchRouter {
  private llm: ChatOpenAI;
  private cache: Map<string, QueryClassification> = new Map();

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required for SearchRouter');
    }

    this.llm = new ChatOpenAI({
      modelName: MODEL_CONFIG.FAST_MODEL,
      temperature: MODEL_CONFIG.TEMPERATURE,
      openAIApiKey: apiKey,
    });
  }

  /**
   * Classify a query to determine the best search provider
   */
  async classifyQuery(query: string): Promise<QueryClassification> {
    // Check cache first (queries often repeat)
    const cacheKey = query.toLowerCase().trim();
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Quick heuristic checks before LLM call
    const quickClassification = this.quickClassify(query);
    if (quickClassification.confidence >= 0.9) {
      this.cache.set(cacheKey, quickClassification);
      return quickClassification;
    }

    try {
      const response = await this.llm.invoke([
        new SystemMessage(CLASSIFICATION_PROMPT),
        new HumanMessage(`Query: "${query}"`),
      ]);

      let content = response.content.toString();
      
      // Strip markdown code blocks if present
      content = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
      
      const classification = JSON.parse(content) as QueryClassification;
      
      // Cache the result
      this.cache.set(cacheKey, classification);
      
      return classification;
    } catch (error) {
      console.error('Query classification error:', error);
      
      // Fallback to quick classification or default
      const fallback = quickClassification.confidence > 0.5 
        ? quickClassification 
        : {
            provider: 'tavily' as SearchProvider,
            confidence: 0.5,
            reason: 'Fallback to default provider',
            suggestedMode: 'search' as const,
          };
      
      return fallback;
    }
  }

  /**
   * Quick heuristic-based classification to avoid LLM calls for obvious queries
   */
  private quickClassify(query: string): QueryClassification {
    const q = query.toLowerCase();

    // Firecrawl patterns - explicit URLs with scrape/crawl/map operations
    if (q.includes('http://') || q.includes('https://')) {
      // Determine specific Firecrawl operation
      if (q.includes('crawl') || q.includes('all pages') || q.includes('entire site') || q.includes('full site')) {
        return {
          provider: 'firecrawl',
          confidence: 0.98,
          reason: 'Request to crawl entire website',
          suggestedMode: 'research',
          firecrawlOperation: 'crawl',
        };
      }
      if (q.includes('map') || q.includes('structure') || q.includes('sitemap') || q.includes('list all urls') || q.includes('discover pages')) {
        return {
          provider: 'firecrawl',
          confidence: 0.98,
          reason: 'Request to map website structure',
          suggestedMode: 'search',
          firecrawlOperation: 'map',
        };
      }
      if (q.includes('scrape') || q.includes('extract') || q.includes('get content from') || q.includes('read page')) {
        return {
          provider: 'firecrawl',
          confidence: 0.98,
          reason: 'Request to scrape specific URL',
          suggestedMode: 'search',
          firecrawlOperation: 'scrape',
        };
      }
      // Default to scrape for bare URL mentions
      return {
        provider: 'firecrawl',
        confidence: 0.95,
        reason: 'Query contains URL for content extraction',
        suggestedMode: 'search',
        firecrawlOperation: 'scrape',
      };
    }

    // Firecrawl patterns - explicit commands without URL
    if (q.includes('scrape ') || q.includes('crawl ') || q.includes('map ')) {
      let operation: FirecrawlOperation = 'search';
      if (q.includes('scrape ')) operation = 'scrape';
      else if (q.includes('crawl ')) operation = 'crawl';
      else if (q.includes('map ')) operation = 'map';
      
      return {
        provider: 'firecrawl',
        confidence: 0.95,
        reason: 'Explicit web extraction command',
        suggestedMode: 'search',
        firecrawlOperation: operation,
      };
    }

    // Exa patterns - similarity
    if (q.includes('similar to') || q.includes('like ') || q.includes('alternatives to') || q.includes('companies like')) {
      return {
        provider: 'exa',
        confidence: 0.9,
        reason: 'Similarity search query',
        suggestedMode: 'similar',
      };
    }

    // Semantic Scholar patterns - academic papers, citations, authors
    if (q.includes('paper') || q.includes('papers') || q.includes('citation') || 
        q.includes('citations') || q.includes('arxiv') || q.includes('pubmed') ||
        q.includes('journal') || q.includes('doi:') || q.includes('10.') ||
        q.includes('neurips') || q.includes('icml') || q.includes('acl ') ||
        q.includes('cvpr') || q.includes('iclr') || q.includes('aaai') ||
        q.includes('publications by') || q.includes('papers by') ||
        q.includes('peer-reviewed') || q.includes('scholarly')) {
      return {
        provider: 'semantic-scholar',
        confidence: 0.92,
        reason: 'Academic paper/citation query',
        suggestedMode: 'academic',
      };
    }

    // Exa patterns - general research (not specifically papers)
    if (q.includes('research on') || q.includes('studies on') || 
        q.includes('scientific') || q.includes('academic')) {
      return {
        provider: 'exa',
        confidence: 0.85,
        reason: 'General research query',
        suggestedMode: 'academic',
      };
    }

    // Exa patterns - technical
    if (q.includes('documentation') || q.includes('github') || q.includes('stackoverflow') ||
        q.includes('how to implement') || q.includes('code example') || q.includes('api reference')) {
      return {
        provider: 'exa',
        confidence: 0.85,
        reason: 'Technical/code documentation query',
        suggestedMode: 'technical',
      };
    }

    // Exa patterns - similarity
    if (q.includes('similar to') || q.includes('like ') || q.includes('alternatives to') || q.includes('companies like')) {
      return {
        provider: 'exa',
        confidence: 0.90,
        reason: 'Similarity search query',
        suggestedMode: 'similar',
      };
    }

    // Firecrawl patterns - technical/documentation queries
    if (q.includes('how to') || q.includes('tutorial') || q.includes('guide') ||
        q.includes('documentation') || q.includes('example') || q.includes('best practices')) {
      return {
        provider: 'firecrawl',
        confidence: 0.88,
        reason: 'Technical/educational query benefits from deep content extraction',
        suggestedMode: 'technical',
        firecrawlOperation: 'search',
      };
    }

    // Firecrawl patterns - comparison and detailed research
    if (q.includes('compare') || q.includes('vs') || q.includes('versus') ||
        q.includes('difference between') || q.includes('in detail') ||
        q.includes('comprehensive') || q.includes('deep dive')) {
      return {
        provider: 'firecrawl',
        confidence: 0.88,
        reason: 'Comparison/detailed query benefits from comprehensive content',
        suggestedMode: 'research',
        firecrawlOperation: 'search',
      };
    }

    // Tavily patterns - factual questions
    if (q.startsWith('who ') || q.startsWith('what is ') || q.startsWith('when ') || 
        q.startsWith('where ') || q.startsWith('how many ') || q.startsWith('how much ')) {
      return {
        provider: 'tavily',
        confidence: 0.85,
        reason: 'Factual question pattern',
        suggestedMode: 'search',
      };
    }

    // Tavily patterns - current events and real-time data
    if (q.includes('latest') || q.includes('current') || q.includes('today') || 
        q.includes('now') || q.includes('price') || q.includes('news') ||
        q.includes('weather') || q.includes('stock')) {
      return {
        provider: 'tavily',
        confidence: 0.85,
        reason: 'Current/real-time information query',
        suggestedMode: 'search',
      };
    }

    // Exa patterns - research and investigation
    if (q.includes('research on') || q.includes('studies on') || 
        q.includes('companies') || q.includes('startups')) {
      return {
        provider: 'exa',
        confidence: 0.82,
        reason: 'Research/investigation query',
        suggestedMode: 'research',
      };
    }

    // Default - low confidence, let LLM decide
    return {
      provider: 'tavily',
      confidence: 0.4,
      reason: 'No clear pattern match',
      suggestedMode: 'search',
    };
  }

  /**
   * Clear the classification cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Singleton instance
let routerInstance: SearchRouter | null = null;

export function getSearchRouter(): SearchRouter {
  if (!routerInstance) {
    routerInstance = new SearchRouter();
  }
  return routerInstance;
}

