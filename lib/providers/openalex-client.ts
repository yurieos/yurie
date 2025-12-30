/**
 * OpenAlex API Client
 * 
 * REFACTORED: Extended BaseProviderClient for shared functionality.
 * Reduced from ~496 lines to ~380 lines by using base class utilities.
 * 
 * OpenAlex is a fully open catalog of the global research system.
 * 
 * Authentication Options:
 * - FREE tier: Add email to requests for "polite pool" (10 req/sec vs 1 req/sec)
 * - Premium tier: API key for higher limits and priority access
 * 
 * Coverage: 209+ million scholarly works, authors, venues, institutions, concepts
 * Rate Limit: 
 *   - Anonymous: 1 request/second
 *   - With email: 10 requests/second (100,000/day)
 *   - With API key: Higher limits
 * 
 * @see https://docs.openalex.org/how-to-use-the-api/rate-limits-and-authentication
 */

import { Source } from '../types';
import { BaseProviderClient, BaseSearchResult, BaseSearchResponse } from './base-client';
import { loggers } from '../utils/logger';

const log = loggers.provider;

// =============================================================================
// Types
// =============================================================================

export interface OpenAlexAuthor {
  id: string;
  display_name: string;
  orcid?: string;
}

export interface OpenAlexAuthorship {
  author: OpenAlexAuthor;
  institutions: Array<{
    id: string;
    display_name: string;
    country_code?: string;
  }>;
  author_position: 'first' | 'middle' | 'last';
}

export interface OpenAlexConcept {
  id: string;
  display_name: string;
  level: number;
  score: number;
}

export interface OpenAlexWork {
  id: string;
  doi?: string;
  title: string;
  display_name: string;
  publication_year: number;
  publication_date?: string;
  type: string;
  cited_by_count: number;
  is_retracted: boolean;
  is_paratext: boolean;
  abstract_inverted_index?: Record<string, number[]>;
  open_access: {
    is_oa: boolean;
    oa_status: 'gold' | 'green' | 'hybrid' | 'bronze' | 'closed';
    oa_url?: string;
  };
  authorships: OpenAlexAuthorship[];
  primary_location?: {
    is_oa: boolean;
    landing_page_url?: string;
    pdf_url?: string;
    source?: {
      id: string;
      display_name: string;
      issn_l?: string;
      type: string;
    };
  };
  concepts: OpenAlexConcept[];
  related_works?: string[];
  referenced_works?: string[];
}

export interface OpenAlexSearchResult extends BaseSearchResult {
  url: string;
  title: string;
  content: string;
  authors: string[];
  year?: number;
  citationCount?: number;
  pdfUrl?: string;
  venue?: string;
  doi?: string;
  concepts?: string[];
  openAccessStatus?: string;
}

export interface OpenAlexSearchResponse extends BaseSearchResponse<OpenAlexSearchResult> {
  results: OpenAlexSearchResult[];
  total: number;
  page: number;
  perPage: number;
}

export interface OpenAlexAuthorResult {
  id: string;
  name: string;
  orcid?: string;
  worksCount: number;
  citationCount: number;
  affiliations: string[];
}

// =============================================================================
// Constants
// =============================================================================

const API_BASE = 'https://api.openalex.org';

// =============================================================================
// Client Implementation
// =============================================================================

export class OpenAlexClient extends BaseProviderClient<OpenAlexSearchResult> {
  private apiKey?: string;
  private politeEmail?: string;

  constructor(apiKeyOrEmail?: string) {
    const hasEmail = apiKeyOrEmail || process.env.OPENALEX_API_KEY || process.env.OPENALEX_EMAIL;
    super('openalex', {
      // With email: 10 req/sec, without: 1 req/sec
      rateLimitMs: hasEmail ? 100 : 1000,
      maxResults: 25,
      timeoutMs: 30000,
    });
    
    this.apiKey = process.env.OPENALEX_API_KEY;
    this.politeEmail = apiKeyOrEmail || process.env.OPENALEX_API_KEY || process.env.OPENALEX_EMAIL;
  }

  // ===========================================================================
  // Required Abstract Methods
  // ===========================================================================

  protected async executeSearch(query: string, limit: number): Promise<OpenAlexSearchResponse> {
    const params: Record<string, string | number | boolean | undefined> = {
      search: query,
      'per-page': limit,
      page: 1,
    };

    const url = this.buildOpenAlexUrl('/works', params);
    const response = await fetch(url, {
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`OpenAlex API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return {
      results: (data.results || []).map((work: OpenAlexWork) => 
        this.transformWorkToResult(work)
      ),
      total: data.meta?.count || 0,
      page: data.meta?.page || 1,
      perPage: data.meta?.per_page || 10,
    };
  }

  protected transformResult(result: OpenAlexSearchResult): Source {
    // Citation-based quality scoring
    const quality = result.citationCount 
      ? Math.min(0.5 + (result.citationCount / 1000) * 0.5, 1) 
      : 0.85;
    
    return {
      url: result.url,
      title: result.title,
      content: result.content,
      quality,
      summary: this.truncate(result.content, 200),
    };
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private buildOpenAlexUrl(endpoint: string, params: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(`${API_BASE}${endpoint}`);
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
    
    if (this.apiKey) {
      url.searchParams.set('api_key', this.apiKey);
    } else if (this.politeEmail) {
      url.searchParams.set('mailto', this.politeEmail);
    }
    
    return url.toString();
  }

  private reconstructAbstract(invertedIndex?: Record<string, number[]>): string {
    if (!invertedIndex) return '';
    
    const words: Array<[string, number]> = [];
    
    Object.entries(invertedIndex).forEach(([word, positions]) => {
      positions.forEach(pos => {
        words.push([word, pos]);
      });
    });
    
    words.sort((a, b) => a[1] - b[1]);
    return words.map(w => w[0]).join(' ');
  }

  private transformWorkToResult(work: OpenAlexWork): OpenAlexSearchResult {
    const authors = work.authorships?.slice(0, 10).map(a => a.author.display_name) || [];
    const abstract = this.reconstructAbstract(work.abstract_inverted_index);
    
    const contentParts: string[] = [];
    
    if (abstract) contentParts.push(abstract);
    if (authors.length > 0) contentParts.push(`\nAuthors: ${authors.join(', ')}`);
    if (work.publication_year) contentParts.push(`Year: ${work.publication_year}`);
    if (work.primary_location?.source?.display_name) {
      contentParts.push(`Published in: ${work.primary_location.source.display_name}`);
    }
    if (work.cited_by_count > 0) contentParts.push(`Citations: ${work.cited_by_count}`);
    
    const topConcepts = work.concepts?.slice(0, 5).map(c => c.display_name) || [];
    if (topConcepts.length > 0) contentParts.push(`Topics: ${topConcepts.join(', ')}`);

    const url = work.primary_location?.landing_page_url 
      || work.open_access?.oa_url 
      || (work.doi ? `https://doi.org/${work.doi}` : `https://openalex.org/${work.id}`);

    return {
      url,
      title: work.title || work.display_name,
      content: contentParts.join('\n'),
      authors,
      year: work.publication_year,
      citationCount: work.cited_by_count,
      pdfUrl: work.primary_location?.pdf_url || work.open_access?.oa_url,
      venue: work.primary_location?.source?.display_name,
      doi: work.doi,
      concepts: topConcepts,
      openAccessStatus: work.open_access?.oa_status,
    };
  }

  // ===========================================================================
  // Public API - Extended Methods
  // ===========================================================================

  /**
   * Search for scholarly works with advanced options
   */
  async searchWorks(
    query: string,
    options?: {
      limit?: number;
      page?: number;
      yearFrom?: number;
      yearTo?: number;
      openAccessOnly?: boolean;
      sort?: 'cited_by_count' | 'publication_date' | 'relevance_score';
      type?: 'article' | 'book' | 'dissertation' | 'preprint';
    }
  ): Promise<OpenAlexSearchResponse> {
    await this.respectRateLimit();
    
    try {
      const filters: string[] = [];
      
      if (options?.yearFrom || options?.yearTo) {
        const yearFrom = options.yearFrom || 1900;
        const yearTo = options.yearTo || new Date().getFullYear();
        filters.push(`publication_year:${yearFrom}-${yearTo}`);
      }
      
      if (options?.openAccessOnly) filters.push('is_oa:true');
      if (options?.type) filters.push(`type:${options.type}`);

      const params: Record<string, string | number | boolean | undefined> = {
        search: query,
        'per-page': options?.limit ?? 10,
        page: options?.page ?? 1,
        filter: filters.length > 0 ? filters.join(',') : undefined,
        sort: options?.sort ? `${options.sort}:desc` : undefined,
      };

      const url = this.buildOpenAlexUrl('/works', params);
      const response = await fetch(url, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`OpenAlex API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      return {
        results: (data.results || []).map((work: OpenAlexWork) => 
          this.transformWorkToResult(work)
        ),
        total: data.meta?.count || 0,
        page: data.meta?.page || 1,
        perPage: data.meta?.per_page || 10,
      };
    } catch (error) {
      log.debug('OpenAlex search error:', error);
      throw error;
    }
  }

  /**
   * Get a specific work by OpenAlex ID or DOI
   */
  async getWork(idOrDoi: string): Promise<OpenAlexSearchResult | null> {
    await this.respectRateLimit();
    
    try {
      const identifier = idOrDoi.startsWith('10.') 
        ? `https://doi.org/${idOrDoi}`
        : idOrDoi;

      const url = this.buildOpenAlexUrl(`/works/${encodeURIComponent(identifier)}`, {});
      const response = await fetch(url, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`OpenAlex API error: ${response.status}`);
      }

      const work = await response.json();
      return this.transformWorkToResult(work);
    } catch (error) {
      log.debug('OpenAlex get work error:', error);
      throw error;
    }
  }

  /**
   * Search for authors
   */
  async searchAuthors(
    query: string,
    options?: { limit?: number }
  ): Promise<OpenAlexAuthorResult[]> {
    await this.respectRateLimit();
    
    try {
      const url = this.buildOpenAlexUrl('/authors', {
        search: query,
        'per-page': options?.limit ?? 10,
      });

      const response = await fetch(url, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`OpenAlex API error: ${response.status}`);
      }

      const data = await response.json();

      return (data.results || []).map((author: {
        id: string;
        display_name: string;
        orcid?: string;
        works_count: number;
        cited_by_count: number;
        affiliations?: Array<{ institution: { display_name: string } }>;
      }) => ({
        id: author.id,
        name: author.display_name,
        orcid: author.orcid,
        worksCount: author.works_count,
        citationCount: author.cited_by_count,
        affiliations: author.affiliations?.map(a => a.institution.display_name) || [],
      }));
    } catch (error) {
      log.debug('OpenAlex author search error:', error);
      throw error;
    }
  }

  /**
   * Get works by a specific author
   */
  async getAuthorWorks(
    authorId: string,
    options?: { limit?: number; sort?: 'cited_by_count' | 'publication_date' }
  ): Promise<OpenAlexSearchResponse> {
    await this.respectRateLimit();
    
    try {
      const url = this.buildOpenAlexUrl('/works', {
        filter: `author.id:${authorId}`,
        'per-page': options?.limit ?? 10,
        sort: options?.sort ? `${options.sort}:desc` : 'publication_date:desc',
      });

      const response = await fetch(url, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`OpenAlex API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        results: (data.results || []).map((work: OpenAlexWork) => 
          this.transformWorkToResult(work)
        ),
        total: data.meta?.count || 0,
        page: data.meta?.page || 1,
        perPage: data.meta?.per_page || 10,
      };
    } catch (error) {
      log.debug('OpenAlex author works error:', error);
      throw error;
    }
  }

  /**
   * Get related works (citations and references)
   */
  async getRelatedWorks(
    workId: string,
    type: 'citations' | 'references' = 'citations',
    options?: { limit?: number }
  ): Promise<OpenAlexSearchResponse> {
    await this.respectRateLimit();
    
    try {
      const filter = type === 'citations' ? `cites:${workId}` : `cited_by:${workId}`;

      const url = this.buildOpenAlexUrl('/works', {
        filter,
        'per-page': options?.limit ?? 10,
        sort: 'cited_by_count:desc',
      });

      const response = await fetch(url, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`OpenAlex API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        results: (data.results || []).map((work: OpenAlexWork) => 
          this.transformWorkToResult(work)
        ),
        total: data.meta?.count || 0,
        page: data.meta?.page || 1,
        perPage: data.meta?.per_page || 10,
      };
    } catch (error) {
      log.debug('OpenAlex related works error:', error);
      throw error;
    }
  }

  /**
   * Search by concept/topic
   */
  async searchByTopic(
    topic: string,
    options?: { limit?: number; yearFrom?: number }
  ): Promise<OpenAlexSearchResponse> {
    await this.respectRateLimit();
    
    try {
      const conceptUrl = this.buildOpenAlexUrl('/concepts', {
        search: topic,
        'per-page': 1,
      });
      
      const conceptResponse = await fetch(conceptUrl, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      const conceptData = await conceptResponse.json();
      
      if (!conceptData.results?.length) {
        return this.searchWorks(topic, options);
      }

      const conceptId = conceptData.results[0].id;
      
      const filters = [`concepts.id:${conceptId}`];
      if (options?.yearFrom) filters.push(`publication_year:>${options.yearFrom}`);

      const url = this.buildOpenAlexUrl('/works', {
        filter: filters.join(','),
        'per-page': options?.limit ?? 10,
        sort: 'cited_by_count:desc',
      });

      const response = await fetch(url, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      const data = await response.json();

      return {
        results: (data.results || []).map((work: OpenAlexWork) => 
          this.transformWorkToResult(work)
        ),
        total: data.meta?.count || 0,
        page: 1,
        perPage: options?.limit ?? 10,
      };
    } catch (error) {
      log.debug('OpenAlex topic search error:', error);
      throw error;
    }
  }
}
