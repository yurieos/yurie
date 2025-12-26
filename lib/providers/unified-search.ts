import { Source } from '../types';
import { FirecrawlClient, CrawlToolResult, MapToolResult, ScrapeToolResult } from '../firecrawl';
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
   * Search with Firecrawl - routes to appropriate operation based on classification
   */
  private async searchWithFirecrawl(
    query: string,
    classification: QueryClassification,
    options: UnifiedSearchOptions
  ): Promise<UnifiedSearchResult> {
    const operation = classification.firecrawlOperation || 'search';
    
    // Extract URL from query if present (for scrape/crawl/map operations)
    const urlMatch = query.match(/https?:\/\/[^\s<>"')\]]+/);
    const url = urlMatch ? urlMatch[0].replace(/[.,;:!?]+$/, '') : null;
    
    let sources: Source[] = [];
    
    switch (operation) {
      case 'scrape': {
        if (!url) {
          // Fall back to search if no URL provided
          return this.performFirecrawlSearch(query, classification, options);
        }
        
        console.log(`[Firecrawl] Scraping URL: ${url}`);
        const scrapeResult = await this.scrape(url, { onlyMainContent: true });
        
        if (scrapeResult.success && scrapeResult.markdown) {
          sources = [{
            url: scrapeResult.url,
            title: scrapeResult.title || url,
            content: scrapeResult.markdown,
            quality: 1.0,
          }];
        }
        break;
      }
      
      case 'crawl': {
        if (!url) {
          return this.performFirecrawlSearch(query, classification, options);
        }
        
        console.log(`[Firecrawl] Crawling website: ${url}`);
        const crawlResult = await this.crawl(url, {
          limit: Math.min(options.maxResults || 10, 15),
          maxDepth: 2,
        });
        
        if (crawlResult.success && crawlResult.pages.length > 0) {
          sources = crawlResult.pages.map(page => ({
            url: page.url,
            title: page.title || page.url,
            content: page.markdown,
            quality: 0.9,
          }));
        }
        break;
      }
      
      case 'map': {
        if (!url) {
          return this.performFirecrawlSearch(query, classification, options);
        }
        
        console.log(`[Firecrawl] Mapping website structure: ${url}`);
        const mapResult = await this.map(url, {
          limit: options.maxResults || 100,
        });
        
        if (mapResult.success && mapResult.links.length > 0) {
          // For map, return the discovered URLs as sources
          sources = mapResult.links.slice(0, 20).map(link => ({
            url: link,
            title: link,
            content: `Discovered URL: ${link}`,
            quality: 0.5,
          }));
          
          // Optionally scrape a few of the discovered URLs
          const topUrls = mapResult.links.slice(0, 3);
          const scrapePromises = topUrls.map(async (linkUrl) => {
            try {
              const result = await this.scrape(linkUrl, { onlyMainContent: true });
              if (result.success && result.markdown) {
                return {
                  url: result.url,
                  title: result.title || linkUrl,
                  content: result.markdown,
                  quality: 0.8,
                };
              }
            } catch {
              // Ignore scrape errors
            }
            return null;
          });
          
          const scrapedResults = await Promise.allSettled(scrapePromises);
          for (const result of scrapedResults) {
            if (result.status === 'fulfilled' && result.value) {
              sources.unshift(result.value);
            }
          }
        }
        break;
      }
      
      case 'search':
      default: {
        return this.performFirecrawlSearch(query, classification, options);
      }
    }
    
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
   * Perform a standard Firecrawl search operation
   */
  private async performFirecrawlSearch(
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
    // Balanced fallback order - try each provider fairly
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

  // ==========================================================================
  // Firecrawl Deep Extraction Tools
  // ==========================================================================

  /**
   * Scrape a single URL and convert it to clean, LLM-ready markdown.
   * Use this for deep extraction of specific pages like documentation, articles, or research papers.
   */
  async scrape(
    url: string,
    options?: {
      onlyMainContent?: boolean;
      includeLinks?: boolean;
    }
  ): Promise<ScrapeToolResult> {
    return this.firecrawlClient.scrapeForLLM(url, {
      onlyMainContent: options?.onlyMainContent ?? true,
      includeLinks: options?.includeLinks ?? false,
    });
  }

  /**
   * Crawl an entire website or subsection and convert all pages to markdown.
   * Use this for comprehensive research across documentation sites, research series, or technical wikis.
   * WARNING: This is a heavier operation - use 'map' first to scout the site structure if unsure.
   */
  async crawl(
    url: string,
    options?: {
      limit?: number;
      maxDepth?: number;
      allowBackwardLinks?: boolean;
    }
  ): Promise<CrawlToolResult> {
    return this.firecrawlClient.crawl(url, {
      limit: Math.min(options?.limit ?? 10, 25),
      maxDepth: Math.min(options?.maxDepth ?? 2, 5),
      allowBackwardLinks: options?.allowBackwardLinks ?? false,
    });
  }

  /**
   * Scout a website's structure by mapping all discoverable URLs.
   * Use this BEFORE crawling to understand what content is available.
   * Returns a list of URLs that can then be selectively scraped or crawled.
   */
  async map(
    url: string,
    options?: {
      search?: string;
      limit?: number;
    }
  ): Promise<MapToolResult> {
    return this.firecrawlClient.mapUrl(url, {
      search: options?.search,
      limit: Math.min(options?.limit ?? 100, 1000),
    });
  }

  /**
   * Batch scrape multiple URLs in parallel.
   * Returns results for all URLs, with failures marked individually.
   */
  async batchScrape(
    urls: string[],
    options?: {
      onlyMainContent?: boolean;
    }
  ): Promise<ScrapeToolResult[]> {
    const results = await Promise.allSettled(
      urls.map(url =>
        this.firecrawlClient.scrapeForLLM(url, {
          onlyMainContent: options?.onlyMainContent ?? true,
          includeLinks: false,
        })
      )
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        success: false,
        url: urls[index],
        markdown: '',
        error: result.reason instanceof Error ? result.reason.message : 'Failed to scrape',
      };
    });
  }

  /**
   * Deep research a website: first map its structure, then selectively crawl relevant pages.
   * This is useful for comprehensive documentation or wiki research.
   */
  async deepResearch(
    url: string,
    options?: {
      searchFilter?: string;
      maxPages?: number;
      maxDepth?: number;
    }
  ): Promise<{
    success: boolean;
    baseUrl: string;
    discoveredUrls: number;
    crawledPages: number;
    pages: Array<{
      url: string;
      title?: string;
      markdown: string;
    }>;
    error?: string;
  }> {
    try {
      // First, map the website structure
      const mapResult = await this.map(url, {
        search: options?.searchFilter,
        limit: 100,
      });

      if (!mapResult.success || mapResult.links.length === 0) {
        return {
          success: false,
          baseUrl: url,
          discoveredUrls: 0,
          crawledPages: 0,
          pages: [],
          error: mapResult.error || 'No pages found to crawl',
        };
      }

      // Then crawl the discovered URLs
      const crawlResult = await this.crawl(url, {
        limit: options?.maxPages ?? 10,
        maxDepth: options?.maxDepth ?? 2,
      });

      return {
        success: crawlResult.success,
        baseUrl: url,
        discoveredUrls: mapResult.totalLinks,
        crawledPages: crawlResult.pagesCrawled,
        pages: crawlResult.pages,
        error: crawlResult.error,
      };
    } catch (error) {
      return {
        success: false,
        baseUrl: url,
        discoveredUrls: 0,
        crawledPages: 0,
        pages: [],
        error: error instanceof Error ? error.message : 'Deep research failed',
      };
    }
  }
}

