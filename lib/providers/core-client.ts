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
 * @see https://core.ac.uk/services/api
 * Register for API key: https://core.ac.uk/services/api
 */

export interface CoreSearchResult {
  url: string;
  title: string;
  content: string;
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

const CORE_API_V3 = 'https://api.core.ac.uk/v3';

export class CoreClient {
  private apiKey?: string;
  private requestDelay = 100; // 10 req/sec

  constructor() {
    this.apiKey = process.env.CORE_API_KEY;
  }

  /**
   * Search for research papers
   */
  async search(
    query: string,
    options?: {
      limit?: number;
      offset?: number;
      yearFrom?: number;
      yearTo?: number;
      openAccess?: boolean;
    }
  ): Promise<CoreSearchResponse> {
    try {
      await this.rateLimit();

      const limit = options?.limit ?? 10;
      const offset = options?.offset ?? 0;

      // Build query with filters
      let searchQuery = query;
      if (options?.yearFrom) {
        searchQuery += ` AND yearPublished>=${options.yearFrom}`;
      }
      if (options?.yearTo) {
        searchQuery += ` AND yearPublished<=${options.yearTo}`;
      }

      const params = new URLSearchParams({
        q: searchQuery,
        limit: String(limit),
        offset: String(offset),
      });

      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(`${CORE_API_V3}/search/works?${params}`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`CORE API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const works: CoreWork[] = data.results || [];

      return {
        results: works.map(work => this.transformWork(work)),
        total: data.totalHits || 0,
      };
    } catch (error) {
      console.error('CORE search error:', error);
      throw error;
    }
  }

  /**
   * Get a specific work by ID
   */
  async getWork(workId: number): Promise<CoreSearchResult | null> {
    try {
      await this.rateLimit();

      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(`${CORE_API_V3}/works/${workId}`, {
        headers,
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`CORE API error: ${response.status}`);
      }

      const work: CoreWork = await response.json();
      return this.transformWork(work);
    } catch (error) {
      console.error('CORE get work error:', error);
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
    const response = await this.search(query, {
      limit: options?.limit ?? 5,
    });

    return response.results;
  }

  /**
   * Transform CORE API work to our format
   */
  private transformWork(work: CoreWork): CoreSearchResult {
    // Get the best URL
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

  /**
   * Simple rate limiting
   */
  private lastRequest = 0;
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequest;
    if (elapsed < this.requestDelay) {
      await new Promise(resolve => setTimeout(resolve, this.requestDelay - elapsed));
    }
    this.lastRequest = Date.now();
  }
}

