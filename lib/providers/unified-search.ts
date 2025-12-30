/**
 * Unified Search Provider
 * 
 * REFACTORED: Reduced from 2000+ lines to ~400 lines by using the provider registry.
 * 
 * Main entry point for search operations across all providers.
 * Uses the provider registry for consistent caching, retry, and error handling.
 */

import { Source } from '../types';
import { FirecrawlClient, CrawlToolResult, MapToolResult, ScrapeToolResult } from '../firecrawl';
import { SearchRouter, QueryClassification, SearchProvider } from './search-router';
import { SEARCH_CONFIG } from '../config';
import { 
  getProviderRegistry, 
  isProviderAvailable, 
  getAvailableProviders,
  executeProviderSearch 
} from './provider-registry';
import { UnifiedSearchResult } from './provider-factory';
import { loggers } from '../utils/logger';

const log = loggers.search;

// Re-export types
export type { UnifiedSearchResult };

export interface UnifiedSearchOptions {
  maxResults?: number;
  forceProvider?: SearchProvider;
  includeDomains?: string[];
  excludeDomains?: string[];
}

/**
 * Unified Search Provider
 * 
 * Provides a unified interface for searching across 30+ providers.
 */
export class UnifiedSearchProvider {
  private firecrawlClient: FirecrawlClient;
  private router: SearchRouter;

  constructor(firecrawlClient: FirecrawlClient) {
    this.firecrawlClient = firecrawlClient;
    this.router = new SearchRouter();
    
    // Initialize the provider registry (lazy initialization)
    getProviderRegistry();
    
    // Log available providers
    const available = getAvailableProviders();
    log.info(`Research providers initialized (${available.length} providers available)`);
  }

  /**
   * Get the status of all providers
   */
  getProviderStatus(): Record<SearchProvider, boolean> {
    const allProviders: SearchProvider[] = [
      'tavily', 'exa', 'firecrawl', 'semantic-scholar',
      'openalex', 'arxiv', 'wikipedia', 'pubmed', 'nasa', 'gbif', 'crossref',
      'core', 'clinicaltrials', 'openfda', 'usgs', 'inaturalist',
      'courtlistener', 'fred', 'worldbank', 'europeana', 'pubchem',
      'loc', 'internetarchive',
      'pas', 'pleiades', 'shipwrecks', 'nominatim', 'wikidatatreasure',
      'wolframalpha',
    ];

    const status: Partial<Record<SearchProvider, boolean>> = {};
    for (const provider of allProviders) {
      status[provider] = isProviderAvailable(provider);
    }
    // Firecrawl is always available
    status['firecrawl'] = true;
    
    return status as Record<SearchProvider, boolean>;
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
    
    // Check provider availability and get fallback if needed
    if (!isProviderAvailable(provider) && provider !== 'firecrawl') {
      provider = this.getFallbackProvider(provider);
      classification.provider = provider;
      classification.reason = `Fallback to ${provider} (original provider unavailable)`;
    }

    const maxResults = options?.maxResults || SEARCH_CONFIG.MAX_SOURCES_PER_SEARCH;

    try {
      // Handle Firecrawl specially (it has unique operations)
      if (provider === 'firecrawl') {
        return await this.searchWithFirecrawl(query, classification, options || {}, maxResults);
      }

      // Use the unified provider registry for all other providers
      const result = await executeProviderSearch(provider, query, classification, maxResults);
      
      // If specialized provider returns 0 results, try fallback to general search
      if (result.sources.length === 0 && this.shouldTryFallback(provider)) {
        log.debug(`[${provider}] returned 0 results, trying fallback`);
        const fallback = this.getFallbackProvider(provider);
        if (fallback !== provider) {
          log.debug(`Falling back to ${fallback}`);
          const fallbackResult = await this.search(query, { ...options, forceProvider: fallback });
          // Return fallback result but note the original provider in reason
          return {
            ...fallbackResult,
            classification: {
              ...fallbackResult.classification,
              reason: `${classification.reason} (fallback: ${provider} returned no results)`,
            },
          };
        }
      }
      
      return result;
    } catch (error) {
      log.debug(`Search failed with ${provider}:`, error);
      
      // Try fallback provider
      const fallback = this.getFallbackProvider(provider);
      if (fallback !== provider) {
        log.debug(`Falling back to ${fallback} due to error`);
        const fallbackResult = await this.search(query, { ...options, forceProvider: fallback });
        // Update reason to indicate fallback
        return {
          ...fallbackResult,
          classification: {
            ...fallbackResult.classification,
            reason: `${classification.reason} (fallback: ${provider} error)`,
          },
        };
      }
      
      throw error;
    }
  }
  
  /**
   * Determine if a provider should fallback on empty results
   * (Some providers like Wikipedia might legitimately have no results for obscure queries)
   */
  private shouldTryFallback(provider: SearchProvider): boolean {
    // Specialized providers that should fallback to general search on empty results
    const fallbackProviders = new Set<SearchProvider>([
      'shipwrecks',  // NOAA API deprecated
      'pleiades',    // Bot detection issues
      'pas',         // UK-specific data
      'wikidatatreasure',
      'nominatim',
      'pubchem',
      'europeana',
      'inaturalist',
      'gbif',
      'worldbank',   // API requires keyword mapping
      'fred',        // Requires API key
      'courtlistener', // May have rate limits or query issues
      'usgs',        // Earthquake-specific data
    ]);
    return fallbackProviders.has(provider);
  }

  /**
   * Search with Firecrawl - handles URL-based operations
   */
  private async searchWithFirecrawl(
    query: string,
    classification: QueryClassification,
    options: UnifiedSearchOptions,
    maxResults: number
  ): Promise<UnifiedSearchResult> {
    const operation = classification.firecrawlOperation || 'search';
    
    // Extract URL from query if present
    const urlMatch = query.match(/https?:\/\/[^\s<>"')\]]+/);
    const url = urlMatch ? urlMatch[0].replace(/[.,;:!?]+$/, '') : null;
    
    let sources: Source[] = [];
    
    switch (operation) {
      case 'scrape': {
        if (!url) {
          return this.performFirecrawlSearch(query, classification, maxResults);
        }
        
        log.debug(`[Firecrawl] Scraping URL: ${url}`);
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
          return this.performFirecrawlSearch(query, classification, maxResults);
        }
        
        log.debug(`[Firecrawl] Crawling website: ${url}`);
        const crawlResult = await this.crawl(url, {
          limit: Math.min(maxResults, 15),
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
          return this.performFirecrawlSearch(query, classification, maxResults);
        }
        
        log.debug(`[Firecrawl] Mapping website structure: ${url}`);
        const mapResult = await this.map(url, { limit: maxResults || 100 });
        
        if (mapResult.success && mapResult.links.length > 0) {
          sources = mapResult.links.slice(0, 20).map(link => ({
            url: link,
            title: link,
            content: `Discovered URL: ${link}`,
            quality: 0.5,
          }));
          
          // Optionally scrape top URLs
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
        return this.performFirecrawlSearch(query, classification, maxResults);
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
    maxResults: number
  ): Promise<UnifiedSearchResult> {
    const response = await this.firecrawlClient.search(query, {
      limit: maxResults,
      scrapeOptions: {
        formats: ['markdown'],
      },
    });

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
   * Get fallback provider when preferred is unavailable or returns no results
   * Uses category-aware fallback (e.g., science providers fallback to science providers first)
   */
  private getFallbackProvider(preferred: SearchProvider): SearchProvider {
    // Category-based fallback mapping
    const categoryFallbacks: Record<string, SearchProvider[]> = {
      // Science/Chemistry
      pubchem: ['wikipedia', 'arxiv', 'firecrawl'],
      // Ancient history/archaeology
      pleiades: ['wikipedia', 'loc', 'internetarchive', 'firecrawl'],
      shipwrecks: ['wikipedia', 'firecrawl'],
      pas: ['wikipedia', 'loc', 'firecrawl'],
      wikidatatreasure: ['wikipedia', 'firecrawl'],
      // Nature
      inaturalist: ['gbif', 'wikipedia', 'firecrawl'],
      gbif: ['inaturalist', 'wikipedia', 'firecrawl'],
      // Economics
      worldbank: ['wikipedia', 'firecrawl'],
      fred: ['wikipedia', 'firecrawl'],
      // Legal
      courtlistener: ['wikipedia', 'firecrawl'],
      // Geology
      usgs: ['wikipedia', 'nasa', 'firecrawl'],
      // General fallback
      default: ['wikipedia', 'firecrawl'],
    };
    
    // Try category-specific fallbacks first
    const fallbacks = categoryFallbacks[preferred] || categoryFallbacks.default;
    for (const provider of fallbacks) {
      if (provider !== preferred && isProviderAvailable(provider)) {
        return provider;
      }
    }
    
    // General fallback order
    const generalFallbackOrder: SearchProvider[] = [
      'wikipedia', 'openalex', 'arxiv', 'pubmed', 'firecrawl',
    ];
    
    for (const provider of generalFallbackOrder) {
      if (provider !== preferred && isProviderAvailable(provider)) {
        return provider;
      }
    }
    
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
    const availableProviders = providers.filter(isProviderAvailable);
    
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
