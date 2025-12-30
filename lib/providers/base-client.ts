/**
 * Base Provider Client
 * 
 * Abstract base class that all provider clients should extend.
 * Provides common functionality:
 * - Rate limiting
 * - Error handling
 * - Response transformation
 * - Health checking
 * 
 * This reduces code duplication across 37+ provider clients.
 */

import { Source } from '../types';

// =============================================================================
// Types
// =============================================================================

export interface BaseSearchResult {
  url: string;
  title: string;
  content?: string;
  [key: string]: unknown;
}

export interface BaseSearchResponse<T extends BaseSearchResult = BaseSearchResult> {
  results: T[];
  total?: number;
}

export interface ProviderHealthStatus {
  healthy: boolean;
  lastCheck: number;
  errorCount: number;
  lastError?: string;
}

export interface BaseClientOptions {
  /** Rate limit delay in milliseconds */
  rateLimitMs?: number;
  /** Maximum results per request */
  maxResults?: number;
  /** Custom headers */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds */
  timeoutMs?: number;
}

// =============================================================================
// Base Client Class
// =============================================================================

export abstract class BaseProviderClient<
  TResult extends BaseSearchResult = BaseSearchResult,
  TOptions extends BaseClientOptions = BaseClientOptions
> {
  protected readonly providerName: string;
  protected readonly rateLimitMs: number;
  protected readonly maxResults: number;
  protected readonly timeoutMs: number;
  protected readonly headers: Record<string, string>;
  
  protected lastRequestTime = 0;
  protected health: ProviderHealthStatus = {
    healthy: true,
    lastCheck: Date.now(),
    errorCount: 0,
  };

  constructor(providerName: string, options: TOptions = {} as TOptions) {
    this.providerName = providerName;
    this.rateLimitMs = options.rateLimitMs ?? 0;
    this.maxResults = options.maxResults ?? 10;
    this.timeoutMs = options.timeoutMs ?? 30000;
    this.headers = options.headers ?? {};
  }

  // ===========================================================================
  // Abstract Methods - Must be implemented by subclasses
  // ===========================================================================

  /**
   * Execute the search against the provider's API
   */
  protected abstract executeSearch(
    query: string,
    limit: number
  ): Promise<BaseSearchResponse<TResult>>;

  /**
   * Transform a provider-specific result to a Source
   */
  protected abstract transformResult(result: TResult): Source;

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Search the provider with rate limiting and error handling
   */
  async search(query: string, limit?: number): Promise<BaseSearchResponse<TResult>> {
    const effectiveLimit = Math.min(limit ?? this.maxResults, this.maxResults);

    try {
      await this.respectRateLimit();
      const response = await this.executeSearch(query, effectiveLimit);
      this.recordSuccess();
      return response;
    } catch (error) {
      this.recordError(error);
      throw error;
    }
  }

  /**
   * Search and transform results to Source array
   */
  async searchAndTransform(query: string, limit?: number): Promise<Source[]> {
    const response = await this.search(query, limit);
    return response.results.map(result => this.transformResult(result));
  }

  /**
   * Get the health status of this provider
   */
  getHealthStatus(): ProviderHealthStatus {
    return { ...this.health };
  }

  /**
   * Check if the provider is currently healthy
   */
  isHealthy(): boolean {
    return this.health.healthy;
  }

  /**
   * Get the provider name
   */
  getName(): string {
    return this.providerName;
  }

  // ===========================================================================
  // Protected Helpers
  // ===========================================================================

  /**
   * Respect rate limit before making a request
   */
  protected async respectRateLimit(): Promise<void> {
    if (this.rateLimitMs <= 0) return;

    const elapsed = Date.now() - this.lastRequestTime;
    if (elapsed < this.rateLimitMs) {
      await this.sleep(this.rateLimitMs - elapsed);
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Make a fetch request with timeout and error handling
   */
  protected async fetchWithTimeout<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.headers,
          ...options.headers,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`${this.providerName} API error: ${response.status} ${response.statusText}`);
      }

      return await response.json() as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Build URL with query parameters
   */
  protected buildUrl(base: string, params: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(base);
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });

    return url.toString();
  }

  /**
   * Sleep for specified milliseconds
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clean HTML from text
   */
  protected cleanHtml(text: string): string {
    return text
      .replace(/<[^>]*>/g, '')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Truncate text to specified length
   */
  protected truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
  }

  // ===========================================================================
  // Health Tracking
  // ===========================================================================

  private recordSuccess(): void {
    this.health = {
      healthy: true,
      lastCheck: Date.now(),
      errorCount: 0,
    };
  }

  private recordError(error: unknown): void {
    this.health = {
      healthy: false,
      lastCheck: Date.now(),
      errorCount: this.health.errorCount + 1,
      lastError: error instanceof Error ? error.message : String(error),
    };
  }
}

// =============================================================================
// Simple Fetch-Based Client for REST APIs
// =============================================================================

export interface SimpleRestOptions extends BaseClientOptions {
  baseUrl: string;
  searchEndpoint?: string;
  apiKey?: string;
  apiKeyHeader?: string;
  apiKeyParam?: string;
}

/**
 * A simpler base class for REST APIs that follow common patterns
 */
export abstract class SimpleRestClient<
  TResult extends BaseSearchResult = BaseSearchResult
> extends BaseProviderClient<TResult, SimpleRestOptions> {
  protected readonly baseUrl: string;
  protected readonly searchEndpoint: string;
  protected readonly apiKey?: string;
  protected readonly apiKeyHeader?: string;
  protected readonly apiKeyParam?: string;

  constructor(providerName: string, options: SimpleRestOptions) {
    super(providerName, options);
    this.baseUrl = options.baseUrl;
    this.searchEndpoint = options.searchEndpoint ?? '/search';
    this.apiKey = options.apiKey;
    this.apiKeyHeader = options.apiKeyHeader;
    this.apiKeyParam = options.apiKeyParam;
  }

  /**
   * Build request headers including API key if configured
   */
  protected getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      ...this.headers,
    };

    if (this.apiKey && this.apiKeyHeader) {
      headers[this.apiKeyHeader] = this.apiKey;
    }

    return headers;
  }

  /**
   * Add API key to URL params if configured
   */
  protected addApiKeyToParams(params: Record<string, string | number | boolean | undefined>): Record<string, string | number | boolean | undefined> {
    if (this.apiKey && this.apiKeyParam) {
      return { ...params, [this.apiKeyParam]: this.apiKey };
    }
    return params;
  }
}

