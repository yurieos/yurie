/**
 * CourtListener API Client
 * 
 * Access to millions of legal opinions from federal and state courts.
 * Essential for legal research, case law analysis, and judicial history.
 * 
 * Coverage: 8M+ legal opinions, PACER data
 * Rate Limit: 5000 requests/hour
 * 100% FREE - API key optional for higher limits
 * 
 * @see https://www.courtlistener.com/help/api/
 * Register for API key: https://www.courtlistener.com/sign-in/
 */

import { loggers } from '../utils/logger';

const log = loggers.provider;

export interface CourtListenerSearchResult {
  url: string;
  title: string;
  content: string;
  caseName: string;
  court: string;
  dateFiled?: string;
  docketNumber?: string;
  citation?: string[];
  judges?: string[];
  status: string;
  absoluteUrl: string;
}

export interface CourtListenerSearchResponse {
  results: CourtListenerSearchResult[];
  total: number;
  nextPage?: string;
}

interface CLOpinion {
  id: number;
  absolute_url: string;
  caseName?: string;
  case_name?: string;
  court?: string;
  court_id?: string;
  dateFiled?: string;
  date_filed?: string;
  docketNumber?: string;
  docket_number?: string;
  citation?: string[];
  judge?: string;
  status?: string;
  snippet?: string;
  text?: string;
}

interface CLSearchResponse {
  count: number;
  next?: string;
  previous?: string;
  results: CLOpinion[];
}

const COURTLISTENER_API = 'https://www.courtlistener.com/api/rest/v3';

export class CourtListenerClient {
  private apiKey?: string;

  constructor() {
    this.apiKey = process.env.COURTLISTENER_API_KEY;
  }

  /**
   * Search opinions (case law)
   */
  async searchOpinions(
    query: string,
    options?: {
      limit?: number;
      court?: string;
      dateFiled_gte?: string; // YYYY-MM-DD
      dateFiled_lte?: string;
      status?: 'Published' | 'Unpublished' | 'Errata' | 'Separate' | 'In-chambers';
    }
  ): Promise<CourtListenerSearchResponse> {
    try {
      const params = new URLSearchParams({
        q: query,
        page_size: String(options?.limit ?? 10),
        type: 'o', // opinions
      });

      // Add filters
      if (options?.court) {
        params.set('court', options.court);
      }
      if (options?.dateFiled_gte) {
        params.set('date_filed__gte', options.dateFiled_gte);
      }
      if (options?.dateFiled_lte) {
        params.set('date_filed__lte', options.dateFiled_lte);
      }
      if (options?.status) {
        params.set('status', options.status);
      }

      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      if (this.apiKey) {
        headers['Authorization'] = `Token ${this.apiKey}`;
      }

      const response = await fetch(`${COURTLISTENER_API}/search/?${params}`, {
        headers,
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        // Return empty results for fallback instead of throwing
        log.debug(`CourtListener API returned ${response.status}, returning empty results for fallback`);
        return { results: [], total: 0 };
      }

      const data: CLSearchResponse = await response.json();

      return {
        results: data.results.map(opinion => this.transformOpinion(opinion)),
        total: data.count,
        nextPage: data.next,
      };
    } catch (error) {
      // Return empty results for fallback instead of throwing
      log.debug('CourtListener search error:', error);
      return { results: [], total: 0 };
    }
  }

  /**
   * Search by citation
   */
  async searchByCitation(citation: string): Promise<CourtListenerSearchResponse> {
    // CourtListener uses a specific citation lookup
    return this.searchOpinions(`citation:(${citation})`);
  }

  /**
   * Search by court
   */
  async searchByCourt(
    court: string,
    query?: string,
    options?: {
      limit?: number;
    }
  ): Promise<CourtListenerSearchResponse> {
    const searchQuery = query ? `${query} court:${court}` : `court:${court}`;
    return this.searchOpinions(searchQuery, { limit: options?.limit });
  }

  /**
   * Get opinion by ID
   */
  async getOpinion(opinionId: number): Promise<CourtListenerSearchResult | null> {
    try {
      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers['Authorization'] = `Token ${this.apiKey}`;
      }

      const response = await fetch(`${COURTLISTENER_API}/opinions/${opinionId}/`, {
        headers,
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`CourtListener API error: ${response.status}`);
      }

      const opinion: CLOpinion = await response.json();
      return this.transformOpinion(opinion);
    } catch (error) {
      log.debug('CourtListener get opinion error:', error);
      throw error;
    }
  }

  /**
   * Get available courts
   */
  async getCourts(): Promise<Array<{ id: string; name: string; shortName: string }>> {
    try {
      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers['Authorization'] = `Token ${this.apiKey}`;
      }

      const response = await fetch(`${COURTLISTENER_API}/courts/?page_size=200`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`CourtListener API error: ${response.status}`);
      }

      const data = await response.json();

      return (data.results || []).map((court: {
        id: string;
        full_name: string;
        short_name: string;
      }) => ({
        id: court.id,
        name: court.full_name,
        shortName: court.short_name,
      }));
    } catch (error) {
      log.debug('CourtListener get courts error:', error);
      throw error;
    }
  }

  /**
   * Search dockets (cases)
   */
  async searchDockets(
    query: string,
    options?: {
      limit?: number;
      court?: string;
    }
  ): Promise<CourtListenerSearchResponse> {
    try {
      const params = new URLSearchParams({
        q: query,
        page_size: String(options?.limit ?? 10),
        type: 'r', // RECAP dockets
      });

      if (options?.court) {
        params.set('court', options.court);
      }

      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers['Authorization'] = `Token ${this.apiKey}`;
      }

      const response = await fetch(`${COURTLISTENER_API}/search/?${params}`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`CourtListener API error: ${response.status}`);
      }

      const data: CLSearchResponse = await response.json();

      return {
        results: data.results.map(docket => this.transformOpinion(docket)),
        total: data.count,
        nextPage: data.next,
      };
    } catch (error) {
      log.debug('CourtListener docket search error:', error);
      throw error;
    }
  }

  /**
   * Search by judge
   */
  async searchByJudge(
    judgeName: string,
    options?: {
      limit?: number;
    }
  ): Promise<CourtListenerSearchResponse> {
    return this.searchOpinions(`judge:"${judgeName}"`, { limit: options?.limit });
  }

  /**
   * Unified search for legal research
   */
  async search(
    query: string,
    options?: {
      limit?: number;
    }
  ): Promise<CourtListenerSearchResponse> {
    return this.searchOpinions(query, options);
  }

  /**
   * Transform opinion to our format
   */
  private transformOpinion(opinion: CLOpinion): CourtListenerSearchResult {
    const caseName = opinion.caseName || opinion.case_name || 'Unknown Case';
    const dateFiled = opinion.dateFiled || opinion.date_filed;
    const docketNumber = opinion.docketNumber || opinion.docket_number;

    const content = opinion.snippet || opinion.text?.slice(0, 2000) || 
      `Legal opinion: ${caseName}` +
      (dateFiled ? `. Filed: ${dateFiled}` : '') +
      (opinion.court ? `. Court: ${opinion.court}` : '');

    return {
      url: `https://www.courtlistener.com${opinion.absolute_url}`,
      title: caseName,
      content,
      caseName,
      court: opinion.court || opinion.court_id || 'Unknown Court',
      dateFiled,
      docketNumber,
      citation: opinion.citation,
      judges: opinion.judge ? [opinion.judge] : undefined,
      status: opinion.status || 'Unknown',
      absoluteUrl: opinion.absolute_url,
    };
  }
}


