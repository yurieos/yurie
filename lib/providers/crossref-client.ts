/**
 * Crossref API Client
 * 
 * REFACTORED: Extended BaseProviderClient for shared functionality.
 * Reduced from ~500 lines to ~400 lines by using base class utilities.
 * 
 * Crossref is a not-for-profit membership organization for scholarly publishing.
 * They maintain a comprehensive database of DOIs and publication metadata.
 * 
 * Coverage: 140+ million DOIs, journals, books, conference proceedings
 * Rate Limit: 50 requests/second (polite pool with email/token gets priority)
 * 
 * @see https://www.crossref.org/documentation/retrieve-metadata/rest-api/
 */

import { Source } from '../types';
import { BaseProviderClient, BaseSearchResult, BaseSearchResponse } from './base-client';
import { loggers } from '../utils/logger';

const log = loggers.provider;

// =============================================================================
// Types
// =============================================================================

export interface CrossrefWork {
  DOI: string;
  title: string[];
  author?: Array<{
    given?: string;
    family?: string;
    name?: string;
    affiliation?: Array<{ name: string }>;
    ORCID?: string;
  }>;
  'container-title'?: string[];
  publisher?: string;
  type: string;
  published?: { 'date-parts': number[][] };
  'published-print'?: { 'date-parts': number[][] };
  'published-online'?: { 'date-parts': number[][] };
  abstract?: string;
  subject?: string[];
  'is-referenced-by-count': number;
  'references-count': number;
  URL: string;
  link?: Array<{ URL: string; 'content-type': string; 'intended-application': string }>;
  license?: Array<{ URL: string; 'content-version': string }>;
  ISSN?: string[];
  ISBN?: string[];
  volume?: string;
  issue?: string;
  page?: string;
  score?: number;
}

export interface CrossrefSearchResult extends BaseSearchResult {
  url: string;
  title: string;
  content: string;
  authors: string[];
  year?: number;
  doi: string;
  journal?: string;
  publisher?: string;
  citationCount?: number;
  type: string;
  pdfUrl?: string;
}

export interface CrossrefSearchResponse extends BaseSearchResponse<CrossrefSearchResult> {
  results: CrossrefSearchResult[];
  total: number;
  query?: string;
}

// =============================================================================
// Constants
// =============================================================================

const CROSSREF_API_BASE = 'https://api.crossref.org';

// =============================================================================
// Client Implementation
// =============================================================================

export class CrossrefClient extends BaseProviderClient<CrossrefSearchResult> {
  private apiToken?: string;
  private politeEmail?: string;
  private userAgent: string;

  constructor(apiTokenOrEmail?: string) {
    super('crossref', {
      rateLimitMs: 20, // 50 requests/sec
      maxResults: 25,
      timeoutMs: 30000,
    });
    
    this.apiToken = process.env.CROSSREF_API_TOKEN || process.env.CROSSREF_PLUS_TOKEN;
    this.politeEmail = apiTokenOrEmail || process.env.CROSSREF_API_KEY || process.env.CROSSREF_EMAIL;
    this.userAgent = 'YurieResearch/1.0 (https://yurie.app; mailto:research@yurie.app)';
  }

  // ===========================================================================
  // Required Abstract Methods
  // ===========================================================================

  protected async executeSearch(query: string, limit: number): Promise<CrossrefSearchResponse> {
    const url = this.buildCrossrefUrl('/works', { query, rows: String(limit) });
    const response = await this.crossrefRequest<{
      message: { items: CrossrefWork[]; 'total-results': number; query?: { 'search-terms': string } };
    }>(url);

    return {
      results: (response.message.items || []).map(work => this.transformWorkToResult(work)),
      total: response.message['total-results'] || 0,
      query: response.message.query?.['search-terms'],
    };
  }

  protected transformResult(result: CrossrefSearchResult): Source {
    const quality = result.citationCount 
      ? Math.min(0.5 + (result.citationCount / 500) * 0.5, 1) 
      : 0.80;
    
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

  private buildCrossrefUrl(endpoint: string, params: Record<string, string | undefined>): string {
    const url = new URL(`${CROSSREF_API_BASE}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) url.searchParams.set(key, value);
    });
    if (this.politeEmail && !this.apiToken) {
      url.searchParams.set('mailto', this.politeEmail);
    }
    return url.toString();
  }

  private async crossrefRequest<T>(url: string): Promise<T> {
    const headers: Record<string, string> = { 'User-Agent': this.userAgent };
    if (this.apiToken) {
      headers['Crossref-Plus-API-Token'] = `Bearer ${this.apiToken}`;
    }
    
    const response = await fetch(url, { 
      headers, 
      signal: AbortSignal.timeout(this.timeoutMs) 
    });

    if (!response.ok) {
      throw new Error(`Crossref API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  private transformWorkToResult(work: CrossrefWork): CrossrefSearchResult {
    const authors = (work.author || []).map(a => {
      if (a.name) return a.name;
      if (a.family && a.given) return `${a.family}, ${a.given}`;
      return a.family || a.given || 'Unknown';
    });

    const dateParts = work.published?.['date-parts']?.[0] 
      || work['published-print']?.['date-parts']?.[0]
      || work['published-online']?.['date-parts']?.[0];
    const year = dateParts?.[0];

    const contentParts: string[] = [];
    if (work.abstract) {
      contentParts.push(this.cleanHtml(work.abstract));
    }
    if (authors.length > 0) contentParts.push(`\nAuthors: ${authors.slice(0, 10).join(', ')}`);
    if (work['container-title']?.[0]) contentParts.push(`Journal: ${work['container-title'][0]}`);
    if (year) contentParts.push(`Year: ${year}`);
    if (work['is-referenced-by-count'] > 0) contentParts.push(`Citations: ${work['is-referenced-by-count']}`);
    if (work.subject?.length) contentParts.push(`Subjects: ${work.subject.slice(0, 5).join(', ')}`);

    const pdfLink = work.link?.find(l => 
      l['content-type'] === 'application/pdf' || l['intended-application'] === 'text-mining'
    );

    return {
      url: work.URL || `https://doi.org/${work.DOI}`,
      title: work.title?.[0] || 'Untitled',
      content: contentParts.join('\n'),
      authors,
      year,
      doi: work.DOI,
      journal: work['container-title']?.[0],
      publisher: work.publisher,
      citationCount: work['is-referenced-by-count'],
      type: work.type,
      pdfUrl: pdfLink?.URL,
    };
  }

  // ===========================================================================
  // Public API - Extended Methods
  // ===========================================================================

  /**
   * Search works with advanced options
   */
  async searchWorks(
    query: string,
    options?: {
      limit?: number;
      offset?: number;
      sort?: 'relevance' | 'published' | 'is-referenced-by-count';
      order?: 'asc' | 'desc';
      type?: 'journal-article' | 'book' | 'book-chapter' | 'proceedings-article' | 'dissertation';
      fromYear?: number;
      toYear?: number;
    }
  ): Promise<CrossrefSearchResponse> {
    await this.respectRateLimit();
    
    try {
      const params: Record<string, string | undefined> = {
        query,
        rows: String(options?.limit ?? 10),
        offset: String(options?.offset ?? 0),
      };

      if (options?.sort) {
        params.sort = options.sort;
        params.order = options.order || 'desc';
      }

      const filters: string[] = [];
      if (options?.type) filters.push(`type:${options.type}`);
      if (options?.fromYear) filters.push(`from-pub-date:${options.fromYear}`);
      if (options?.toYear) filters.push(`until-pub-date:${options.toYear}`);
      if (filters.length > 0) params.filter = filters.join(',');

      const url = this.buildCrossrefUrl('/works', params);
      const response = await this.crossrefRequest<{
        message: { items: CrossrefWork[]; 'total-results': number; query?: { 'search-terms': string } };
      }>(url);

      return {
        results: (response.message.items || []).map(work => this.transformWorkToResult(work)),
        total: response.message['total-results'] || 0,
        query: response.message.query?.['search-terms'],
      };
    } catch (error) {
      log.debug('Crossref search error:', error);
      throw error;
    }
  }

  /**
   * Get work by DOI
   */
  async getByDoi(doi: string): Promise<CrossrefSearchResult | null> {
    await this.respectRateLimit();
    
    try {
      const cleanDoi = doi.replace(/^(https?:\/\/)?(dx\.)?doi\.org\//i, '');
      const url = this.buildCrossrefUrl(`/works/${encodeURIComponent(cleanDoi)}`, {});
      const response = await this.crossrefRequest<{ message: CrossrefWork }>(url);
      
      if (!response.message) return null;
      return this.transformWorkToResult(response.message);
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) return null;
      log.debug('Crossref get DOI error:', error);
      throw error;
    }
  }

  /**
   * Search by title
   */
  async searchByTitle(title: string, options?: { limit?: number }): Promise<CrossrefSearchResponse> {
    await this.respectRateLimit();
    
    try {
      const url = this.buildCrossrefUrl('/works', {
        'query.title': title,
        rows: String(options?.limit ?? 10),
      });
      const response = await this.crossrefRequest<{
        message: { items: CrossrefWork[]; 'total-results': number };
      }>(url);

      return {
        results: (response.message.items || []).map(work => this.transformWorkToResult(work)),
        total: response.message['total-results'] || 0,
      };
    } catch (error) {
      log.debug('Crossref title search error:', error);
      throw error;
    }
  }

  /**
   * Search by author
   */
  async searchByAuthor(authorName: string, options?: { limit?: number }): Promise<CrossrefSearchResponse> {
    await this.respectRateLimit();
    
    try {
      const url = this.buildCrossrefUrl('/works', {
        'query.author': authorName,
        rows: String(options?.limit ?? 10),
        sort: 'is-referenced-by-count',
        order: 'desc',
      });
      const response = await this.crossrefRequest<{
        message: { items: CrossrefWork[]; 'total-results': number };
      }>(url);

      return {
        results: (response.message.items || []).map(work => this.transformWorkToResult(work)),
        total: response.message['total-results'] || 0,
      };
    } catch (error) {
      log.debug('Crossref author search error:', error);
      throw error;
    }
  }

  /**
   * Get most cited works
   */
  async getMostCited(query: string, options?: { limit?: number; fromYear?: number }): Promise<CrossrefSearchResponse> {
    return this.searchWorks(query, {
      limit: options?.limit ?? 10,
      sort: 'is-referenced-by-count',
      order: 'desc',
      fromYear: options?.fromYear,
    });
  }

  /**
   * Get references cited by a work
   */
  async getReferences(doi: string): Promise<string[]> {
    await this.respectRateLimit();
    
    try {
      const cleanDoi = doi.replace(/^(https?:\/\/)?(dx\.)?doi\.org\//i, '');
      const url = this.buildCrossrefUrl(`/works/${encodeURIComponent(cleanDoi)}`, {});
      const response = await this.crossrefRequest<{ 
        message: CrossrefWork & { reference?: Array<{ DOI?: string }> } 
      }>(url);

      return (response.message.reference || []).filter(r => r.DOI).map(r => r.DOI as string);
    } catch (error) {
      log.debug('Crossref get references error:', error);
      return [];
    }
  }

  /**
   * Get works citing a specific DOI
   */
  async getCitations(doi: string, options?: { limit?: number }): Promise<CrossrefSearchResponse> {
    await this.respectRateLimit();
    
    try {
      const cleanDoi = doi.replace(/^(https?:\/\/)?(dx\.)?doi\.org\//i, '');
      const url = this.buildCrossrefUrl('/works', {
        filter: `references:${cleanDoi}`,
        rows: String(options?.limit ?? 10),
        sort: 'is-referenced-by-count',
        order: 'desc',
      });
      const response = await this.crossrefRequest<{
        message: { items: CrossrefWork[]; 'total-results': number };
      }>(url);

      return {
        results: (response.message.items || []).map(work => this.transformWorkToResult(work)),
        total: response.message['total-results'] || 0,
      };
    } catch (error) {
      log.debug('Crossref get citations error:', error);
      throw error;
    }
  }

  /**
   * Search for journal metadata
   */
  async searchJournals(query: string, options?: { limit?: number }): Promise<Array<{
    title: string;
    publisher: string;
    issn: string[];
    subjects: string[];
    worksCount: number;
  }>> {
    await this.respectRateLimit();
    
    try {
      const url = this.buildCrossrefUrl('/journals', {
        query,
        rows: String(options?.limit ?? 10),
      });
      const response = await this.crossrefRequest<{
        message: {
          items: Array<{
            title: string;
            publisher: string;
            ISSN: string[];
            subjects: Array<{ name: string }>;
            counts: { 'total-dois': number };
          }>;
        };
      }>(url);

      return (response.message.items || []).map(journal => ({
        title: journal.title,
        publisher: journal.publisher,
        issn: journal.ISSN || [],
        subjects: journal.subjects?.map(s => s.name) || [],
        worksCount: journal.counts?.['total-dois'] || 0,
      }));
    } catch (error) {
      log.debug('Crossref journal search error:', error);
      throw error;
    }
  }

  /**
   * Resolve a DOI to get the redirect URL
   */
  async resolveDoi(doi: string): Promise<string | null> {
    try {
      const cleanDoi = doi.replace(/^(https?:\/\/)?(dx\.)?doi\.org\//i, '');
      const response = await fetch(`https://doi.org/${cleanDoi}`, {
        method: 'HEAD',
        redirect: 'manual',
      });
      return response.headers.get('location');
    } catch {
      return null;
    }
  }
}
