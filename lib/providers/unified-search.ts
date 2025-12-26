import { Source } from '../langgraph-search-engine';
import { FirecrawlClient } from '../firecrawl';
import { TavilyClient, TavilySearchResponse } from './tavily-client';
import { ExaClient, ExaSearchResult } from './exa-client';
import { SemanticScholarClient, SemanticScholarSearchResult } from './semantic-scholar-client';
import { SearchRouter, QueryClassification, SearchProvider } from './search-router';
import { SEARCH_CONFIG, PROVIDER_CONFIG } from '../config';

export interface UnifiedSearchResult {
  sources: Source[];
  provider: SearchProvider;
  classification: QueryClassification;
  preAnswer?: string; // Tavily can provide a pre-synthesized answer
  metadata?: {
    autopromptString?: string;
    totalResults?: number;
  };
}

export interface UnifiedSearchOptions {
  maxResults?: number;
  forceProvider?: SearchProvider;
  includeDomains?: string[];
  excludeDomains?: string[];
}

export class UnifiedSearchProvider {
  private tavilyClient: TavilyClient | null = null;
  private exaClient: ExaClient | null = null;
  private semanticScholarClient: SemanticScholarClient | null = null;
  private firecrawlClient: FirecrawlClient;
  private router: SearchRouter;
  
  // Track provider availability
  private providerStatus: Record<SearchProvider, boolean> = {
    tavily: false,
    exa: false,
    'semantic-scholar': false,
    firecrawl: true, // Always available (required)
  };

  constructor(firecrawlClient: FirecrawlClient) {
    this.firecrawlClient = firecrawlClient;
    this.router = new SearchRouter();
    
    // Initialize optional providers
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Try to initialize Tavily
    if (process.env.TAVILY_API_KEY) {
      try {
        this.tavilyClient = new TavilyClient();
        this.providerStatus.tavily = true;
        console.log('✓ Tavily provider initialized');
      } catch (error) {
        console.warn('Tavily initialization failed:', error);
      }
    }

    // Try to initialize Exa
    if (process.env.EXA_API_KEY) {
      try {
        this.exaClient = new ExaClient();
        this.providerStatus.exa = true;
        console.log('✓ Exa provider initialized');
      } catch (error) {
        console.warn('Exa initialization failed:', error);
      }
    }

    // Initialize Semantic Scholar (always available, API key optional for higher rate limits)
    try {
      this.semanticScholarClient = new SemanticScholarClient();
      this.providerStatus['semantic-scholar'] = true;
      console.log('✓ Semantic Scholar provider initialized');
    } catch (error) {
      console.warn('Semantic Scholar initialization failed:', error);
    }

    // Log available providers
    const available = Object.entries(this.providerStatus)
      .filter(([, status]) => status)
      .map(([provider]) => provider);
    console.log('Available search providers:', available.join(', '));
  }

  /**
   * Get the status of all providers
   */
  getProviderStatus(): Record<SearchProvider, boolean> {
    return { ...this.providerStatus };
  }

  /**
   * Main search method with automatic routing
   */
  async search(
    query: string,
    options?: UnifiedSearchOptions
  ): Promise<UnifiedSearchResult> {
    // Classify the query to determine best provider
    const classification = await this.router.classifyQuery(query);
    
    // Use forced provider or classified provider
    let provider = options?.forceProvider || classification.provider;
    
    // Fallback if preferred provider is not available
    if (!this.providerStatus[provider]) {
      provider = this.getFallbackProvider(provider);
      classification.provider = provider;
      classification.reason = `Fallback to ${provider} (original provider unavailable)`;
    }

    const maxResults = options?.maxResults || SEARCH_CONFIG.MAX_SOURCES_PER_SEARCH;

    try {
      switch (provider) {
        case 'tavily':
          return await this.searchWithTavily(query, classification, {
            ...options,
            maxResults,
          });
        
        case 'exa':
          return await this.searchWithExa(query, classification, {
            ...options,
            maxResults,
          });
        
        case 'semantic-scholar':
          return await this.searchWithSemanticScholar(query, classification, {
            ...options,
            maxResults,
          });
        
        case 'firecrawl':
        default:
          return await this.searchWithFirecrawl(query, classification, {
            ...options,
            maxResults,
          });
      }
    } catch (error) {
      console.error(`Search failed with ${provider}:`, error);
      
      // Try fallback provider
      const fallback = this.getFallbackProvider(provider);
      if (fallback !== provider) {
        console.log(`Falling back to ${fallback}`);
        return this.search(query, { ...options, forceProvider: fallback });
      }
      
      throw error;
    }
  }

  /**
   * Search with Tavily
   */
  private async searchWithTavily(
    query: string,
    classification: QueryClassification,
    options: UnifiedSearchOptions
  ): Promise<UnifiedSearchResult> {
    if (!this.tavilyClient) {
      throw new Error('Tavily client not available');
    }

    const response: TavilySearchResponse = await this.tavilyClient.search(query, {
      maxResults: options.maxResults,
      searchDepth: 'advanced',
      includeAnswer: true,
      includeDomains: options.includeDomains,
      excludeDomains: options.excludeDomains,
    });

    // Convert to unified Source format
    const sources: Source[] = response.results.map((r) => ({
      url: r.url,
      title: r.title,
      content: r.content,
      quality: r.score,
      summary: r.content?.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT),
    }));

    return {
      sources,
      provider: 'tavily',
      classification,
      preAnswer: response.answer,
      metadata: {
        totalResults: response.results.length,
      },
    };
  }

  /**
   * Search with Exa
   */
  private async searchWithExa(
    query: string,
    classification: QueryClassification,
    options: UnifiedSearchOptions
  ): Promise<UnifiedSearchResult> {
    if (!this.exaClient) {
      throw new Error('Exa client not available');
    }

    let results: ExaSearchResult[];
    let autopromptString: string | undefined;

    // Use different Exa modes based on classification
    switch (classification.suggestedMode) {
      case 'academic':
        results = await this.exaClient.searchAcademic(query, options.maxResults);
        break;
      
      case 'technical':
        results = await this.exaClient.searchTechnical(query, options.maxResults);
        break;
      
      case 'similar':
        // Extract URL from query if present
        const urlMatch = query.match(/https?:\/\/[^\s]+/);
        if (urlMatch) {
          results = await this.exaClient.findSimilar(urlMatch[0], {
            numResults: options.maxResults,
          });
        } else {
          // Fallback to regular search
          const response = await this.exaClient.search(query, {
            numResults: options.maxResults,
            includeDomains: options.includeDomains,
            excludeDomains: options.excludeDomains,
          });
          results = response.results;
          autopromptString = response.autopromptString;
        }
        break;
      
      case 'research':
        // Use deep research if available
        try {
          const researchResponse = await this.exaClient.research(query);
          // Convert research response to search results
          results = researchResponse.sources.map(s => ({
            url: s.url,
            title: s.title,
            content: s.snippet,
            highlights: [s.snippet],
          }));
        } catch {
          // Fallback to regular search
          const response = await this.exaClient.search(query, {
            numResults: options.maxResults,
          });
          results = response.results;
        }
        break;
      
      default:
        const response = await this.exaClient.search(query, {
          numResults: options.maxResults,
          includeDomains: options.includeDomains,
          excludeDomains: options.excludeDomains,
        });
        results = response.results;
        autopromptString = response.autopromptString;
    }

    // Convert to unified Source format
    const sources: Source[] = results.map((r) => ({
      url: r.url,
      title: r.title,
      content: r.content || r.highlights?.join('\n\n') || '',
      quality: r.score,
      summary: r.highlights?.[0] || r.content?.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT),
    }));

    return {
      sources,
      provider: 'exa',
      classification,
      metadata: {
        autopromptString,
        totalResults: results.length,
      },
    };
  }

  /**
   * Search with Semantic Scholar
   */
  private async searchWithSemanticScholar(
    query: string,
    classification: QueryClassification,
    options: UnifiedSearchOptions
  ): Promise<UnifiedSearchResult> {
    if (!this.semanticScholarClient) {
      throw new Error('Semantic Scholar client not available');
    }

    const maxResults = options.maxResults || PROVIDER_CONFIG.SEMANTIC_SCHOLAR?.MAX_RESULTS || 10;
    
    const response = await this.semanticScholarClient.searchPapers(query, {
      limit: maxResults,
    });

    // Convert to unified Source format
    const sources: Source[] = response.results.map((r: SemanticScholarSearchResult) => ({
      url: r.url,
      title: r.title,
      content: r.content,
      quality: r.citationCount ? Math.min(r.citationCount / 1000, 1) : 0, // Normalize citation count as quality
      summary: r.content?.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT),
    }));

    return {
      sources,
      provider: 'semantic-scholar',
      classification,
      metadata: {
        totalResults: response.total,
      },
    };
  }

  /**
   * Search with Firecrawl (existing behavior)
   */
  private async searchWithFirecrawl(
    query: string,
    classification: QueryClassification,
    options: UnifiedSearchOptions
  ): Promise<UnifiedSearchResult> {
    const response = await this.firecrawlClient.search(query, {
      limit: options.maxResults,
      scrapeOptions: {
        formats: ['markdown'],
      },
    });

    // Convert to unified Source format
    const sources: Source[] = response.data.map((r: { url: string; title: string; markdown?: string; content?: string }) => ({
      url: r.url,
      title: r.title,
      content: r.markdown || r.content || '',
      quality: 0,
    }));

    return {
      sources,
      provider: 'firecrawl',
      classification,
      metadata: {
        totalResults: sources.length,
      },
    };
  }

  /**
   * Get fallback provider when preferred is unavailable
   */
  private getFallbackProvider(preferred: SearchProvider): SearchProvider {
    // Priority order for fallback
    const fallbackOrder: SearchProvider[] = ['tavily', 'firecrawl', 'exa'];
    
    for (const provider of fallbackOrder) {
      if (provider !== preferred && this.providerStatus[provider]) {
        return provider;
      }
    }
    
    // Last resort - firecrawl is always available
    return 'firecrawl';
  }

  /**
   * Search with a specific provider (bypass routing)
   */
  async searchWithProvider(
    query: string,
    provider: SearchProvider,
    options?: Omit<UnifiedSearchOptions, 'forceProvider'>
  ): Promise<UnifiedSearchResult> {
    return this.search(query, { ...options, forceProvider: provider });
  }

  /**
   * Parallel search across multiple providers
   */
  async searchMultiple(
    query: string,
    providers: SearchProvider[],
    options?: Omit<UnifiedSearchOptions, 'forceProvider'>
  ): Promise<UnifiedSearchResult[]> {
    const availableProviders = providers.filter(p => this.providerStatus[p]);
    
    const results = await Promise.allSettled(
      availableProviders.map(provider =>
        this.search(query, { ...options, forceProvider: provider })
      )
    );

    return results
      .filter((r): r is PromiseFulfilledResult<UnifiedSearchResult> => r.status === 'fulfilled')
      .map(r => r.value);
  }
}

