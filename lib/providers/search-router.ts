import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { MODEL_CONFIG } from "../config";

export type SearchProvider = 'tavily' | 'exa' | 'firecrawl' | 'semantic-scholar';

export interface QueryClassification {
  provider: SearchProvider;
  confidence: number;
  reason: string;
  suggestedMode?: 'search' | 'similar' | 'research' | 'academic' | 'technical';
}

const CLASSIFICATION_PROMPT = `You are a search query router. Classify this query to determine the best search provider.

**Available Providers:**

1. **tavily** - Best for:
   - Factual questions ("Who founded X?", "When did Y happen?")
   - Current events and news
   - Real-time information (prices, weather, stocks)
   - Quick Q&A style queries
   - General knowledge lookups
   - "What is X?" questions

2. **exa** - Best for:
   - Similarity searches ("Find companies like X", "Similar papers to Y")
   - Deep investigation requiring multiple sources
   - Technical documentation and code
   - Finding related content or alternatives
   - Historical analysis requiring semantic understanding
   - Company/startup research

3. **semantic-scholar** - Best for:
   - Academic paper searches ("papers on X", "research about Y")
   - Scientific literature and citations
   - Finding papers by specific authors
   - Conference papers (NeurIPS, ICML, ACL, CVPR, etc.)
   - ArXiv, PubMed, and peer-reviewed journal content
   - Citation analysis and paper recommendations
   - DOI lookups

4. **firecrawl** - Best for:
   - Explicit URL scraping requests
   - When user provides a specific website to analyze
   - Domain-specific deep crawling
   - Full page content extraction

**Response Format (JSON only):**
{
  "provider": "tavily" | "exa" | "firecrawl" | "semantic-scholar",
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
- "Find startups similar to Stripe" → exa, similar
- "Latest research on CRISPR gene editing" → semantic-scholar, academic
- "What are the current Bitcoin prices?" → tavily, search
- "How does React's useEffect hook work?" → exa, technical
- "Compare iPhone 16 and Galaxy S25" → tavily, search (current factual comparison)
- "Papers on transformer architecture attention mechanisms" → semantic-scholar, academic
- "Attention is All You Need paper citations" → semantic-scholar, academic
- "Yann LeCun publications" → semantic-scholar, academic
- "Scrape https://example.com pricing page" → firecrawl, search`;

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
      temperature: 0,
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

    // Firecrawl patterns - explicit URLs
    if (q.includes('http://') || q.includes('https://') || q.includes('scrape ') || q.includes('crawl ')) {
      return {
        provider: 'firecrawl',
        confidence: 0.95,
        reason: 'Query contains URL or explicit scraping request',
        suggestedMode: 'search',
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

    // Tavily patterns - factual
    if (q.startsWith('who ') || q.startsWith('what is ') || q.startsWith('when ') || 
        q.startsWith('where ') || q.startsWith('how many ') || q.startsWith('how much ')) {
      return {
        provider: 'tavily',
        confidence: 0.85,
        reason: 'Factual question pattern',
        suggestedMode: 'search',
      };
    }

    // Tavily patterns - current events
    if (q.includes('latest') || q.includes('current') || q.includes('today') || 
        q.includes('now') || q.includes('price') || q.includes('news')) {
      return {
        provider: 'tavily',
        confidence: 0.85,
        reason: 'Current/real-time information query',
        suggestedMode: 'search',
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

