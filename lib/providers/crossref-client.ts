/**
 * Crossref API Client
 * 
 * Crossref is a not-for-profit membership organization for scholarly publishing.
 * They maintain a comprehensive database of DOIs and publication metadata.
 * 
 * Authentication Options:
 * - FREE tier: Add email to requests for "polite pool" (priority access)
 * - Crossref Plus: API token for higher limits and metadata-plus features
 * 
 * Coverage: 140+ million DOIs, journals, books, conference proceedings
 * Rate Limit: 50 requests/second (polite pool with email/token gets priority)
 * 
 * Perfect for: Citation lookups, DOI resolution, publication metadata,
 * reference verification, bibliometric analysis
 * 
 * @see https://www.crossref.org/documentation/retrieve-metadata/rest-api/
 * @see https://www.crossref.org/documentation/metadata-plus/
 */

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
  published?: {
    'date-parts': number[][];
  };
  'published-print'?: {
    'date-parts': number[][];
  };
  'published-online'?: {
    'date-parts': number[][];
  };
  abstract?: string;
  subject?: string[];
  'is-referenced-by-count': number;
  'references-count': number;
  URL: string;
  link?: Array<{
    URL: string;
    'content-type': string;
    'intended-application': string;
  }>;
  license?: Array<{
    URL: string;
    'content-version': string;
  }>;
  ISSN?: string[];
  ISBN?: string[];
  volume?: string;
  issue?: string;
  page?: string;
  score?: number;
}

export interface CrossrefSearchResult {
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

export interface CrossrefSearchResponse {
  results: CrossrefSearchResult[];
  total: number;
  query?: string;
}

const CROSSREF_API_BASE = 'https://api.crossref.org';

export class CrossrefClient {
  private apiToken?: string;
  private politeEmail?: string;
  private userAgent: string;

  constructor(apiTokenOrEmail?: string) {
    // Check for Crossref Plus API token first
    this.apiToken = process.env.CROSSREF_API_TOKEN || process.env.CROSSREF_PLUS_TOKEN;
    
    // Fall back to polite email for polite pool
    this.politeEmail = apiTokenOrEmail || process.env.CROSSREF_API_KEY || process.env.CROSSREF_EMAIL;
    
    this.userAgent = 'YurieResearch/1.0 (https://yurie.app; mailto:research@yurie.app)';
  }

  /**
   * Build URL with authentication parameters
   */
  private buildUrl(endpoint: string, params: Record<string, string | undefined>): string {
    const url = new URL(`${CROSSREF_API_BASE}${endpoint}`);
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, value);
      }
    });
    
    // Add email for polite pool (token is passed via header)
    if (this.politeEmail && !this.apiToken) {
      url.searchParams.set('mailto', this.politeEmail);
    }
    
    return url.toString();
  }

  /**
   * Make request with proper headers
   */
  private async request<T>(url: string): Promise<T> {
    const headers: Record<string, string> = {
      'User-Agent': this.userAgent,
    };
    
    // Add Crossref Plus token if available
    if (this.apiToken) {
      headers['Crossref-Plus-API-Token'] = `Bearer ${this.apiToken}`;
    }
    
    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Crossref API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  }

  /**
   * Transform Crossref work to unified search result
   */
  private transformWorkToResult(work: CrossrefWork): CrossrefSearchResult {
    // Format authors
    const authors = (work.author || []).map(a => {
      if (a.name) return a.name;
      if (a.family && a.given) return `${a.family}, ${a.given}`;
      return a.family || a.given || 'Unknown';
    });

    // Get publication year
    const dateParts = work.published?.['date-parts']?.[0] 
      || work['published-print']?.['date-parts']?.[0]
      || work['published-online']?.['date-parts']?.[0];
    const year = dateParts?.[0];

    // Build content
    const contentParts: string[] = [];

    if (work.abstract) {
      // Clean up JATS XML tags often in abstracts
      const cleanAbstract = work.abstract
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      contentParts.push(cleanAbstract);
    }

    if (authors.length > 0) {
      contentParts.push(`\nAuthors: ${authors.slice(0, 10).join(', ')}`);
    }

    if (work['container-title']?.[0]) {
      contentParts.push(`Journal: ${work['container-title'][0]}`);
    }

    if (year) {
      contentParts.push(`Year: ${year}`);
    }

    if (work['is-referenced-by-count'] > 0) {
      contentParts.push(`Citations: ${work['is-referenced-by-count']}`);
    }

    if (work.subject?.length) {
      contentParts.push(`Subjects: ${work.subject.slice(0, 5).join(', ')}`);
    }

    // Find PDF link
    const pdfLink = work.link?.find(l => 
      l['content-type'] === 'application/pdf' ||
      l['intended-application'] === 'text-mining'
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

  /**
   * Search works (articles, books, etc.)
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
    try {
      const params: Record<string, string | undefined> = {
        query: query,
        rows: String(options?.limit ?? 10),
        offset: String(options?.offset ?? 0),
      };

      if (options?.sort) {
        params.sort = options.sort;
        params.order = options.order || 'desc';
      }

      // Build filter string
      const filters: string[] = [];
      
      if (options?.type) {
        filters.push(`type:${options.type}`);
      }
      
      if (options?.fromYear) {
        filters.push(`from-pub-date:${options.fromYear}`);
      }
      
      if (options?.toYear) {
        filters.push(`until-pub-date:${options.toYear}`);
      }

      if (filters.length > 0) {
        params.filter = filters.join(',');
      }

      const url = this.buildUrl('/works', params);
      const response = await this.request<{
        message: {
          items: CrossrefWork[];
          'total-results': number;
          query?: { 'search-terms': string };
        };
      }>(url);

      return {
        results: (response.message.items || []).map(work => 
          this.transformWorkToResult(work)
        ),
        total: response.message['total-results'] || 0,
        query: response.message.query?.['search-terms'],
      };
    } catch (error) {
      console.error('Crossref search error:', error);
      throw error;
    }
  }

  /**
   * Get work by DOI
   */
  async getByDoi(doi: string): Promise<CrossrefSearchResult | null> {
    try {
      // Clean DOI
      const cleanDoi = doi.replace(/^(https?:\/\/)?(dx\.)?doi\.org\//i, '');
      
      const url = this.buildUrl(`/works/${encodeURIComponent(cleanDoi)}`, {});
      const response = await this.request<{ message: CrossrefWork }>(url);

      if (!response.message) return null;

      return this.transformWorkToResult(response.message);
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      console.error('Crossref get DOI error:', error);
      throw error;
    }
  }

  /**
   * Search by title
   */
  async searchByTitle(
    title: string,
    options?: { limit?: number }
  ): Promise<CrossrefSearchResponse> {
    try {
      const params: Record<string, string | undefined> = {
        'query.title': title,
        rows: String(options?.limit ?? 10),
      };

      const url = this.buildUrl('/works', params);
      const response = await this.request<{
        message: { items: CrossrefWork[]; 'total-results': number };
      }>(url);

      return {
        results: (response.message.items || []).map(work => 
          this.transformWorkToResult(work)
        ),
        total: response.message['total-results'] || 0,
      };
    } catch (error) {
      console.error('Crossref title search error:', error);
      throw error;
    }
  }

  /**
   * Search by author
   */
  async searchByAuthor(
    authorName: string,
    options?: { limit?: number }
  ): Promise<CrossrefSearchResponse> {
    try {
      const params: Record<string, string | undefined> = {
        'query.author': authorName,
        rows: String(options?.limit ?? 10),
        sort: 'is-referenced-by-count',
        order: 'desc',
      };

      const url = this.buildUrl('/works', params);
      const response = await this.request<{
        message: { items: CrossrefWork[]; 'total-results': number };
      }>(url);

      return {
        results: (response.message.items || []).map(work => 
          this.transformWorkToResult(work)
        ),
        total: response.message['total-results'] || 0,
      };
    } catch (error) {
      console.error('Crossref author search error:', error);
      throw error;
    }
  }

  /**
   * Get most cited works on a topic
   */
  async getMostCited(
    query: string,
    options?: { limit?: number; fromYear?: number }
  ): Promise<CrossrefSearchResponse> {
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
    try {
      const cleanDoi = doi.replace(/^(https?:\/\/)?(dx\.)?doi\.org\//i, '');
      
      const url = this.buildUrl(`/works/${encodeURIComponent(cleanDoi)}`, {});
      const response = await this.request<{ message: CrossrefWork & { reference?: Array<{ DOI?: string }> } }>(url);

      const references = response.message.reference || [];
      return references
        .filter(r => r.DOI)
        .map(r => r.DOI as string);
    } catch (error) {
      console.error('Crossref get references error:', error);
      return [];
    }
  }

  /**
   * Get works citing a specific DOI
   */
  async getCitations(
    doi: string,
    options?: { limit?: number }
  ): Promise<CrossrefSearchResponse> {
    try {
      const cleanDoi = doi.replace(/^(https?:\/\/)?(dx\.)?doi\.org\//i, '');
      
      const params: Record<string, string | undefined> = {
        filter: `references:${cleanDoi}`,
        rows: String(options?.limit ?? 10),
        sort: 'is-referenced-by-count',
        order: 'desc',
      };

      const url = this.buildUrl('/works', params);
      const response = await this.request<{
        message: { items: CrossrefWork[]; 'total-results': number };
      }>(url);

      return {
        results: (response.message.items || []).map(work => 
          this.transformWorkToResult(work)
        ),
        total: response.message['total-results'] || 0,
      };
    } catch (error) {
      console.error('Crossref get citations error:', error);
      throw error;
    }
  }

  /**
   * Search for journal metadata
   */
  async searchJournals(
    query: string,
    options?: { limit?: number }
  ): Promise<Array<{
    title: string;
    publisher: string;
    issn: string[];
    subjects: string[];
    worksCount: number;
  }>> {
    try {
      const params: Record<string, string | undefined> = {
        query: query,
        rows: String(options?.limit ?? 10),
      };

      const url = this.buildUrl('/journals', params);
      const response = await this.request<{
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
      console.error('Crossref journal search error:', error);
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

