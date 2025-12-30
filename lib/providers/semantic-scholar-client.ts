/**
 * Semantic Scholar API Client
 * 
 * REFACTORED: Extended BaseProviderClient for shared functionality.
 * Reduced from ~396 lines to ~320 lines by using base class utilities.
 * 
 * API Documentation: https://api.semanticscholar.org/api-docs/
 * 
 * Free tier: 100 requests/5 minutes
 * With API key: Higher limits
 */

import { Source } from '../types';
import { BaseProviderClient, BaseSearchResult, BaseSearchResponse } from './base-client';
import { loggers } from '../utils/logger';

const log = loggers.provider;

// =============================================================================
// Types
// =============================================================================

export interface SemanticScholarAuthor {
  authorId: string;
  name: string;
  url?: string;
}

export interface SemanticScholarPaper {
  paperId: string;
  title: string;
  abstract?: string;
  url?: string;
  year?: number;
  authors: SemanticScholarAuthor[];
  citationCount?: number;
  referenceCount?: number;
  venue?: string;
  publicationDate?: string;
  openAccessPdf?: { url: string; status: string };
  externalIds?: { DOI?: string; ArXiv?: string; PubMed?: string };
}

export interface SemanticScholarSearchResult extends BaseSearchResult {
  url: string;
  title: string;
  content: string;
  authors: string[];
  year?: number;
  citationCount?: number;
  venue?: string;
  paperId: string;
  pdfUrl?: string;
}

export interface SemanticScholarSearchResponse extends BaseSearchResponse<SemanticScholarSearchResult> {
  results: SemanticScholarSearchResult[];
  total: number;
  offset: number;
}

export interface SemanticScholarAuthorDetails {
  authorId: string;
  name: string;
  url?: string;
  affiliations?: string[];
  paperCount?: number;
  citationCount?: number;
  hIndex?: number;
}

// =============================================================================
// Constants
// =============================================================================

const API_BASE_URL = 'https://api.semanticscholar.org/graph/v1';

const DEFAULT_PAPER_FIELDS = [
  'paperId', 'title', 'abstract', 'url', 'year', 'authors',
  'citationCount', 'referenceCount', 'venue', 'publicationDate',
  'openAccessPdf', 'externalIds',
].join(',');

const DEFAULT_AUTHOR_FIELDS = [
  'authorId', 'name', 'url', 'affiliations', 'paperCount', 'citationCount', 'hIndex',
].join(',');

// =============================================================================
// Client Implementation
// =============================================================================

export class SemanticScholarClient extends BaseProviderClient<SemanticScholarSearchResult> {
  private apiKey?: string;
  private baseHeaders: HeadersInit;

  constructor(apiKey?: string) {
    const hasKey = apiKey || process.env.SEMANTIC_SCHOLAR_API_KEY;
    super('semantic-scholar', {
      // Free: 100 requests/5min = ~3s between requests
      // With key: much higher
      rateLimitMs: hasKey ? 200 : 3000,
      maxResults: 20,
      timeoutMs: 30000,
    });
    
    this.apiKey = apiKey || process.env.SEMANTIC_SCHOLAR_API_KEY;
    this.baseHeaders = { 'Content-Type': 'application/json' };
    if (this.apiKey) {
      this.baseHeaders['x-api-key'] = this.apiKey;
    }
  }

  // ===========================================================================
  // Required Abstract Methods
  // ===========================================================================

  protected async executeSearch(query: string, limit: number): Promise<SemanticScholarSearchResponse> {
    const params = new URLSearchParams({
      query,
      limit: String(limit),
      offset: '0',
      fields: DEFAULT_PAPER_FIELDS,
    });

    const response = await fetch(
      `${API_BASE_URL}/paper/search?${params.toString()}`,
      { headers: this.baseHeaders, signal: AbortSignal.timeout(this.timeoutMs) }
    );

    if (!response.ok) {
      throw new Error(`Semantic Scholar API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      results: (data.data || []).map((paper: SemanticScholarPaper) => this.transformPaperToResult(paper)),
      total: data.total || 0,
      offset: data.offset || 0,
    };
  }

  protected transformResult(result: SemanticScholarSearchResult): Source {
    const quality = result.citationCount 
      ? Math.min(0.5 + (result.citationCount / 500) * 0.5, 1) 
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

  private transformPaperToResult(paper: SemanticScholarPaper): SemanticScholarSearchResult {
    const authors = paper.authors?.map(a => a.name) || [];
    const authorStr = authors.length > 0 ? `Authors: ${authors.join(', ')}` : '';
    const yearStr = paper.year ? `Year: ${paper.year}` : '';
    const venueStr = paper.venue ? `Venue: ${paper.venue}` : '';
    const citationStr = paper.citationCount !== undefined ? `Citations: ${paper.citationCount}` : '';
    
    const contentParts = [
      paper.abstract || '',
      '',
      [authorStr, yearStr, venueStr, citationStr].filter(Boolean).join(' | '),
    ].filter(Boolean);

    return {
      url: paper.url || `https://www.semanticscholar.org/paper/${paper.paperId}`,
      title: paper.title,
      content: contentParts.join('\n'),
      authors,
      year: paper.year,
      citationCount: paper.citationCount,
      venue: paper.venue,
      paperId: paper.paperId,
      pdfUrl: paper.openAccessPdf?.url,
    };
  }

  // ===========================================================================
  // Public API - Extended Methods
  // ===========================================================================

  /**
   * Search for academic papers with advanced options
   */
  async searchPapers(
    query: string,
    options?: {
      limit?: number;
      offset?: number;
      year?: string;
      fieldsOfStudy?: string[];
      openAccessOnly?: boolean;
    }
  ): Promise<SemanticScholarSearchResponse> {
    await this.respectRateLimit();
    
    try {
      const params = new URLSearchParams({
        query,
        limit: String(options?.limit ?? 10),
        offset: String(options?.offset ?? 0),
        fields: DEFAULT_PAPER_FIELDS,
      });

      if (options?.year) params.append('year', options.year);
      if (options?.fieldsOfStudy?.length) params.append('fieldsOfStudy', options.fieldsOfStudy.join(','));
      if (options?.openAccessOnly) params.append('openAccessPdf', '');

      const response = await fetch(
        `${API_BASE_URL}/paper/search?${params.toString()}`,
        { headers: this.baseHeaders, signal: AbortSignal.timeout(this.timeoutMs) }
      );

      if (!response.ok) {
        throw new Error(`Semantic Scholar API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        results: (data.data || []).map((paper: SemanticScholarPaper) => this.transformPaperToResult(paper)),
        total: data.total || 0,
        offset: data.offset || 0,
      };
    } catch (error) {
      log.debug('Semantic Scholar search error:', error);
      throw error;
    }
  }

  /**
   * Get paper details by paper ID
   */
  async getPaper(paperId: string): Promise<SemanticScholarPaper | null> {
    await this.respectRateLimit();
    
    try {
      const response = await fetch(
        `${API_BASE_URL}/paper/${paperId}?fields=${DEFAULT_PAPER_FIELDS}`,
        { headers: this.baseHeaders, signal: AbortSignal.timeout(this.timeoutMs) }
      );

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Semantic Scholar API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      log.debug('Semantic Scholar get paper error:', error);
      throw error;
    }
  }

  /**
   * Get paper recommendations
   */
  async getRecommendations(
    paperId: string,
    options?: { limit?: number; from?: 'all-cs' | 'recent' }
  ): Promise<SemanticScholarSearchResult[]> {
    await this.respectRateLimit();
    
    try {
      const params = new URLSearchParams({
        fields: DEFAULT_PAPER_FIELDS,
        limit: String(options?.limit ?? 10),
      });
      if (options?.from) params.append('from', options.from);

      const response = await fetch(
        `${API_BASE_URL}/paper/${paperId}/recommendations?${params.toString()}`,
        { headers: this.baseHeaders, signal: AbortSignal.timeout(this.timeoutMs) }
      );

      if (!response.ok) throw new Error(`Semantic Scholar API error: ${response.status}`);

      const data = await response.json();
      return (data.recommendedPapers || []).map((paper: SemanticScholarPaper) => 
        this.transformPaperToResult(paper)
      );
    } catch (error) {
      log.debug('Semantic Scholar recommendations error:', error);
      throw error;
    }
  }

  /**
   * Search for authors
   */
  async searchAuthors(
    query: string,
    options?: { limit?: number; offset?: number }
  ): Promise<SemanticScholarAuthorDetails[]> {
    await this.respectRateLimit();
    
    try {
      const params = new URLSearchParams({
        query,
        limit: String(options?.limit ?? 10),
        offset: String(options?.offset ?? 0),
        fields: DEFAULT_AUTHOR_FIELDS,
      });

      const response = await fetch(
        `${API_BASE_URL}/author/search?${params.toString()}`,
        { headers: this.baseHeaders, signal: AbortSignal.timeout(this.timeoutMs) }
      );

      if (!response.ok) throw new Error(`Semantic Scholar API error: ${response.status}`);

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      log.debug('Semantic Scholar author search error:', error);
      throw error;
    }
  }

  /**
   * Get papers by author
   */
  async getAuthorPapers(
    authorId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<SemanticScholarSearchResult[]> {
    await this.respectRateLimit();
    
    try {
      const params = new URLSearchParams({
        fields: DEFAULT_PAPER_FIELDS,
        limit: String(options?.limit ?? 10),
        offset: String(options?.offset ?? 0),
      });

      const response = await fetch(
        `${API_BASE_URL}/author/${authorId}/papers?${params.toString()}`,
        { headers: this.baseHeaders, signal: AbortSignal.timeout(this.timeoutMs) }
      );

      if (!response.ok) throw new Error(`Semantic Scholar API error: ${response.status}`);

      const data = await response.json();
      return (data.data || []).map((item: { paper: SemanticScholarPaper }) => 
        this.transformPaperToResult(item.paper || item)
      );
    } catch (error) {
      log.debug('Semantic Scholar author papers error:', error);
      throw error;
    }
  }

  /**
   * Get citations for a paper
   */
  async getCitations(
    paperId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<SemanticScholarSearchResult[]> {
    await this.respectRateLimit();
    
    try {
      const params = new URLSearchParams({
        fields: DEFAULT_PAPER_FIELDS,
        limit: String(options?.limit ?? 10),
        offset: String(options?.offset ?? 0),
      });

      const response = await fetch(
        `${API_BASE_URL}/paper/${paperId}/citations?${params.toString()}`,
        { headers: this.baseHeaders, signal: AbortSignal.timeout(this.timeoutMs) }
      );

      if (!response.ok) throw new Error(`Semantic Scholar API error: ${response.status}`);

      const data = await response.json();
      return (data.data || []).map((item: { citingPaper: SemanticScholarPaper }) => 
        this.transformPaperToResult(item.citingPaper)
      );
    } catch (error) {
      log.debug('Semantic Scholar citations error:', error);
      throw error;
    }
  }

  /**
   * Get references from a paper
   */
  async getReferences(
    paperId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<SemanticScholarSearchResult[]> {
    await this.respectRateLimit();
    
    try {
      const params = new URLSearchParams({
        fields: DEFAULT_PAPER_FIELDS,
        limit: String(options?.limit ?? 10),
        offset: String(options?.offset ?? 0),
      });

      const response = await fetch(
        `${API_BASE_URL}/paper/${paperId}/references?${params.toString()}`,
        { headers: this.baseHeaders, signal: AbortSignal.timeout(this.timeoutMs) }
      );

      if (!response.ok) throw new Error(`Semantic Scholar API error: ${response.status}`);

      const data = await response.json();
      return (data.data || []).map((item: { citedPaper: SemanticScholarPaper }) => 
        this.transformPaperToResult(item.citedPaper)
      );
    } catch (error) {
      log.debug('Semantic Scholar references error:', error);
      throw error;
    }
  }
}
