/**
 * Provider Factory Pattern
 * 
 * Consolidates repetitive provider search implementations into a generic factory.
 * Reduces ~40 similar 30-line methods into ~40 10-line configurations.
 */

import { Source } from '../types';
import { SEARCH_CONFIG } from '../config';
import { QueryClassification, SearchProvider } from './search-router';
import { withRetry, RetryOptions } from '../utils/retry';
import { providerCircuitBreakers } from '../utils/circuit-breaker';
import { 
  searchCache, 
  searchDeduplicator, 
  createSearchCacheKey,
  type CachedSearchResult 
} from '../utils/cache';

// =============================================================================
// Types
// =============================================================================

export interface UnifiedSearchResult {
  sources: Source[];
  provider: SearchProvider;
  classification: QueryClassification;
  preAnswer?: string;
  metadata?: {
    autopromptString?: string;
    totalResults?: number;
  };
}

export interface SearchClientResult {
  url: string;
  title: string;
  content?: string;
  [key: string]: unknown;
}

export interface SearchClientResponse<T = SearchClientResult> {
  results: T[];
  total?: number;
}

export interface ProviderConfig<T extends SearchClientResult = SearchClientResult> {
  /** The provider identifier */
  provider: SearchProvider;
  /** Function to execute the search */
  searchFn: (query: string, limit: number) => Promise<SearchClientResponse<T>>;
  /** Transform search result to Source */
  transformer: (result: T) => Source;
  /** Default quality score (0-1) */
  defaultQuality?: number;
  /** Whether to use caching (default: true) */
  useCache?: boolean;
  /** Whether to use circuit breaker (default: true) */
  useCircuitBreaker?: boolean;
  /** Retry options */
  retryOptions?: RetryOptions;
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a standardized search function for a provider
 */
export function createProviderSearch<T extends SearchClientResult>(
  config: ProviderConfig<T>
): (query: string, classification: QueryClassification, maxResults: number) => Promise<UnifiedSearchResult> {
  const {
    provider,
    searchFn,
    transformer,
    defaultQuality = 0.5,
    useCache = true,
    useCircuitBreaker = true,
    retryOptions = { maxRetries: 2, baseDelay: 500 },
  } = config;

  return async (query: string, classification: QueryClassification, maxResults: number): Promise<UnifiedSearchResult> => {
    // Check cache first
    if (useCache) {
      const cacheKey = createSearchCacheKey(query, provider, { maxResults });
      const cached = searchCache.get(cacheKey);
      
      if (cached && !cached.stale) {
        return {
          sources: cached.value.sources,
          provider: cached.value.provider,
          classification,
          preAnswer: cached.value.preAnswer,
          metadata: { totalResults: cached.value.sources.length },
        };
      }
    }

    // Execute search with optional circuit breaker and retry
    const executeSearch = async (): Promise<SearchClientResponse<T>> => {
      if (useCircuitBreaker) {
        const breaker = providerCircuitBreakers.get(provider);
        return breaker.execute(() => searchFn(query, maxResults));
      }
      return searchFn(query, maxResults);
    };

    // Wrap with retry
    const retryableSearch = () => withRetry(executeSearch, retryOptions);

    // Deduplicate concurrent requests
    const cacheKey = createSearchCacheKey(query, provider, { maxResults });
    
    const response = await searchDeduplicator.execute(
      cacheKey,
      async () => {
        const searchResponse = await retryableSearch();
        
        const sources: Source[] = searchResponse.results.map((result) => {
          const source = transformer(result);
          // Ensure quality is set
          if (source.quality === undefined) {
            source.quality = defaultQuality;
          }
          // Truncate summary if needed
          if (source.summary && source.summary.length > SEARCH_CONFIG.SUMMARY_CHAR_LIMIT) {
            source.summary = source.summary.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT);
          }
          return source;
        });

        return {
          sources,
          provider,
          timestamp: Date.now(),
        };
      }
    );

    // Cache the result
    if (useCache) {
      searchCache.set(cacheKey, response);
    }

    return {
      sources: response.sources,
      provider,
      classification,
      metadata: { totalResults: response.sources.length },
    };
  };
}

// =============================================================================
// Common Transformers
// =============================================================================

/**
 * Default transformer for simple search results
 */
export function defaultTransformer(result: SearchClientResult): Source {
  return {
    url: result.url,
    title: result.title,
    content: result.content || '',
    summary: result.content?.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT),
  };
}

/**
 * Academic paper transformer with citation-based quality
 */
export function academicTransformer(result: SearchClientResult & { citationCount?: number }): Source {
  return {
    url: result.url,
    title: result.title,
    content: result.content || '',
    quality: result.citationCount ? Math.min(result.citationCount / 1000, 1) : 0.5,
    summary: result.content?.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT),
  };
}

/**
 * Create a transformer with custom quality logic
 */
export function createQualityTransformer(
  qualityFn: (result: SearchClientResult) => number
): (result: SearchClientResult) => Source {
  return (result) => ({
    url: result.url,
    title: result.title,
    content: result.content || '',
    quality: qualityFn(result),
    summary: result.content?.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT),
  });
}

// =============================================================================
// Provider Registration Helper
// =============================================================================

export type ProviderSearchFn = (
  query: string,
  classification: QueryClassification,
  maxResults: number
) => Promise<UnifiedSearchResult>;

export interface ProviderRegistry {
  providers: Map<SearchProvider, ProviderSearchFn>;
  register: <T extends SearchClientResult>(config: ProviderConfig<T>) => void;
  get: (provider: SearchProvider) => ProviderSearchFn | undefined;
  execute: (
    provider: SearchProvider,
    query: string,
    classification: QueryClassification,
    maxResults: number
  ) => Promise<UnifiedSearchResult>;
}

/**
 * Create a provider registry for managing all search providers
 */
export function createProviderRegistry(): ProviderRegistry {
  const providers = new Map<SearchProvider, ProviderSearchFn>();

  return {
    providers,
    
    register<T extends SearchClientResult>(config: ProviderConfig<T>) {
      const searchFn = createProviderSearch(config);
      providers.set(config.provider, searchFn);
    },
    
    get(provider: SearchProvider) {
      return providers.get(provider);
    },
    
    async execute(
      provider: SearchProvider,
      query: string,
      classification: QueryClassification,
      maxResults: number
    ) {
      const searchFn = providers.get(provider);
      if (!searchFn) {
        throw new Error(`Provider ${provider} not registered`);
      }
      return searchFn(query, classification, maxResults);
    },
  };
}

// =============================================================================
// Batch Search Helper
// =============================================================================

/**
 * Execute searches across multiple providers in parallel
 */
export async function searchMultipleProviders(
  registry: ProviderRegistry,
  providers: SearchProvider[],
  query: string,
  classification: QueryClassification,
  maxResults: number
): Promise<UnifiedSearchResult[]> {
  const results = await Promise.allSettled(
    providers.map(provider => registry.execute(provider, query, classification, maxResults))
  );

  return results
    .filter((r): r is PromiseFulfilledResult<UnifiedSearchResult> => r.status === 'fulfilled')
    .map(r => r.value);
}

