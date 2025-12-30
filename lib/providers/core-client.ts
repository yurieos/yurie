/**
 * CORE API Client - Open Access Research Papers
 * 
 * CORE aggregates open access research outputs from repositories 
 * and journals worldwide. One of the world's largest collections 
 * of open access research papers.
 * 
 * Coverage: 207M+ research papers
 * Rate Limit: 10 req/sec (anonymous) → higher with API key
 * 100% FREE - API key optional for higher rate limits
 * 
 * REFACTORED: Now extends BaseProviderClient for shared functionality.
 * 
 * @see https://core.ac.uk/services/api
 * Register for API key: https://core.ac.uk/services/api
 */

import { Source } from '../types';
import { 
  BaseProviderClient, 
  BaseSearchResult, 
  BaseSearchResponse 
} from './base-client';
import { loggers } from '../utils/logger';

const log = loggers.provider;

// =============================================================================
// Types
// =============================================================================

export interface CoreSearchResult extends BaseSearchResult {
  authors: string[];
  year?: number;
  doi?: string;
  downloadUrl?: string;
  publisher?: string;
  journal?: string;
  subjects?: string[];
}

export interface CoreSearchResponse {
  results: CoreSearchResult[];
  total: number;
}

export interface CoreWork {
  id: number;
  title: string;
  abstract?: string;
  authors?: Array<{ name: string }>;
  yearPublished?: number;
  doi?: string;
  downloadUrl?: string;
  publisher?: string;
  journals?: Array<{ title: string }>;
  subjects?: string[];
  links?: Array<{ type: string; url: string }>;
  fullText?: string;
}

// =============================================================================
// Client Implementation
// =============================================================================

const CORE_API_V3 = 'https://api.core.ac.uk/v3';

export class CoreClient extends BaseProviderClient<CoreSearchResult> {
  private apiKey?: string;

  constructor() {
    super('core', {
      rateLimitMs: 100, // 10 req/sec
      maxResults: 20,
      timeoutMs: 30000,
    });
    this.apiKey = process.env.CORE_API_KEY;
  }

  /**
   * Execute search against CORE API
   */
  protected async executeSearch(
    query: string,
    limit: number
  ): Promise<BaseSearchResponse<CoreSearchResult>> {
    const params = new URLSearchParams({
      q: query,
      limit: String(limit),
      offset: '0',
    });

    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const data = await this.fetchWithTimeout<{
      results: CoreWork[];
      totalHits?: number;
    }>(`${CORE_API_V3}/search/works?${params}`, { headers });

    const works = data.results || [];

    return {
      results: works.map(work => this.transformWork(work)),
      total: data.totalHits || 0,
    };
  }

  /**
   * Transform CORE result to Source
   */
  protected transformResult(result: CoreSearchResult): Source {
    return {
      url: result.url,
      title: result.title,
      content: result.content || '',
      quality: 0.85,
      summary: result.content?.slice(0, 300),
    };
  }

  /**
   * Transform CORE API work to our format
   */
  private transformWork(work: CoreWork): CoreSearchResult {
    const url = work.doi 
      ? `https://doi.org/${work.doi}`
      : work.downloadUrl 
        || work.links?.find(l => l.type === 'download')?.url
        || work.links?.find(l => l.type === 'display')?.url
        || `https://core.ac.uk/works/${work.id}`;

    return {
      url,
      title: work.title || 'Untitled',
      content: work.abstract || work.fullText?.slice(0, 2000) || '',
      authors: work.authors?.map(a => a.name) || [],
      year: work.yearPublished,
      doi: work.doi,
      downloadUrl: work.downloadUrl,
      publisher: work.publisher,
      journal: work.journals?.[0]?.title,
      subjects: work.subjects,
    };
  }

  // ===========================================================================
  // Public API Methods (maintaining backward compatibility)
  // ===========================================================================

  /**
   * Search for research papers with advanced options
   */
  async searchPapers(
    query: string,
    options?: {
      limit?: number;
      offset?: number;
      yearFrom?: number;
      yearTo?: number;
      openAccess?: boolean;
    }
  ): Promise<CoreSearchResponse> {
    // Build query with filters
    let searchQuery = query;
    if (options?.yearFrom) {
      searchQuery += ` AND yearPublished>=${options.yearFrom}`;
    }
    if (options?.yearTo) {
      searchQuery += ` AND yearPublished<=${options.yearTo}`;
    }

    const response = await super.search(searchQuery, options?.limit);
    
    return {
      results: response.results,
      total: response.total || 0,
    };
  }

  /**
   * Get a specific work by ID
   */
  async getWork(workId: number): Promise<CoreSearchResult | null> {
    try {
      await this.respectRateLimit();

      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const work = await this.fetchWithTimeout<CoreWork>(
        `${CORE_API_V3}/works/${workId}`,
        { headers }
      );

      return this.transformWork(work);
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      log.debug('CORE get work error:', error);
      throw error;
    }
  }

  /**
   * Search with full text content
   */
  async searchWithContent(
    query: string,
    options?: {
      limit?: number;
    }
  ): Promise<CoreSearchResult[]> {
    const response = await this.searchPapers(query, {
      limit: options?.limit ?? 5,
    });

    return response.results;
  }
}
