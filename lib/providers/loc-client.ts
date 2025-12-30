/**
 * Library of Congress API Client
 * 
 * Access to 170+ million items from the Library of Congress including
 * photographs, maps, manuscripts, newspapers, audio, and more.
 * 
 * REFACTORED: Consolidated common patterns, reduced duplication.
 * 
 * Coverage: 170M+ items (photos, newspapers, maps, manuscripts, audio)
 * Rate Limit: Generous, reasonable use
 * 100% FREE - No API key required
 * 
 * @see https://www.loc.gov/apis/
 * @see https://chroniclingamerica.loc.gov/about/api/
 */

import { Source } from '../types';
import { BaseProviderClient, BaseSearchResult, BaseSearchResponse } from './base-client';

// =============================================================================
// Types
// =============================================================================

export interface LOCSearchResult extends BaseSearchResult {
  date?: string;
  contributor?: string[];
  subject?: string[];
  type?: string;
  format?: string[];
  language?: string[];
  location?: string[];
  imageUrl?: string;
  rights?: string;
  collection?: string[];
  locId: string;
}

export interface LOCSearchResponse {
  results: LOCSearchResult[];
  total: number;
  pages: number;
}

export interface ChroniclingAmericaResult extends BaseSearchResult {
  date: string;
  newspaper: string;
  state?: string;
  city?: string;
  pageNumber?: number;
  sequence?: number;
  ocrText?: string;
  pdfUrl?: string;
  jpgUrl?: string;
  lccn: string;
}

export interface ChroniclingAmericaResponse {
  results: ChroniclingAmericaResult[];
  total: number;
  pages: number;
}

// Internal API types
interface LOCItem {
  id: string;
  title?: string;
  description?: string[];
  date?: string;
  dates?: string[];
  contributor?: string[];
  subject?: string[];
  type?: string[];
  original_format?: string[];
  language?: string[];
  location?: string[];
  image_url?: string[];
  rights?: string;
  partof?: string[];
  url?: string;
}

interface ChroniclingAmericaPage {
  id: string;
  title: string;
  date: string;
  url: string;
  sequence: number;
  city: string[];
  state: string[];
  lccn: string;
  ocr_eng?: string;
  pdf_url: string;
  jp2_url: string;
}

// =============================================================================
// Constants
// =============================================================================

const LOC_API = 'https://www.loc.gov';
const CHRONICLING_AMERICA_API = 'https://chroniclingamerica.loc.gov';

const FORMAT_MAP: Record<string, string> = {
  photos: 'photos',
  maps: 'maps',
  manuscripts: 'manuscripts',
  newspapers: 'newspapers',
  audio: 'audio',
  film: 'film-and-videos',
  books: 'books',
};

// =============================================================================
// LOC Client (Main Collections)
// =============================================================================

export class LOCClient extends BaseProviderClient<LOCSearchResult> {
  constructor() {
    super('loc', { rateLimitMs: 100, maxResults: 25 });
  }

  protected async executeSearch(query: string, limit: number): Promise<BaseSearchResponse<LOCSearchResult>> {
    const params = new URLSearchParams({ q: query, fo: 'json', c: String(limit), sp: '1' });
    const data = await this.fetchWithTimeout<{
      results: LOCItem[];
      pagination: { total: number; pages: number };
    }>(`${LOC_API}/search/?${params}`);

    return {
      results: (data.results || []).map(item => this.transformItem(item)),
      total: data.pagination?.total || 0,
    };
  }

  protected transformResult(result: LOCSearchResult): Source {
    return {
      url: result.url,
      title: result.title,
      content: result.content || '',
      quality: 0.85,
      summary: result.content?.slice(0, 300),
    };
  }

  private transformItem(item: LOCItem): LOCSearchResult {
    const description = Array.isArray(item.description) ? item.description.join(' ') : '';
    const title = typeof item.title === 'string' ? item.title : (Array.isArray(item.title) ? item.title[0] : 'Untitled');

    return {
      url: item.url || `${LOC_API}/item/${item.id}/`,
      title,
      content: description || `${item.type?.[0] || 'Item'} from the Library of Congress collection`,
      date: item.date || item.dates?.[0],
      contributor: item.contributor,
      subject: item.subject,
      type: item.type?.[0],
      format: item.original_format,
      language: item.language,
      location: item.location,
      imageUrl: item.image_url?.[0],
      rights: item.rights,
      collection: item.partof,
      locId: item.id,
    };
  }

  // Public API (backward compatibility)
  async searchItems(
    query: string,
    options?: {
      limit?: number;
      page?: number;
      format?: 'photos' | 'maps' | 'manuscripts' | 'newspapers' | 'audio' | 'film' | 'books';
      dates?: string;
    }
  ): Promise<LOCSearchResponse> {
    const limit = options?.limit ?? 10;
    const params = new URLSearchParams({ q: query, fo: 'json', c: String(limit), sp: String(options?.page ?? 1) });
    if (options?.dates) params.set('dates', options.dates);

    const endpoint = options?.format ? `${LOC_API}/${FORMAT_MAP[options.format]}` : `${LOC_API}/search`;
    const data = await this.fetchWithTimeout<{
      results: LOCItem[];
      pagination: { total: number; pages: number };
    }>(`${endpoint}/?${params}`);

    return {
      results: (data.results || []).map(item => this.transformItem(item)),
      total: data.pagination?.total || 0,
      pages: data.pagination?.pages || 1,
    };
  }

  async searchPhotos(query: string, options?: { limit?: number; dates?: string }): Promise<LOCSearchResponse> {
    return this.searchItems(query, { ...options, format: 'photos' });
  }

  async searchMaps(query: string, options?: { limit?: number; dates?: string }): Promise<LOCSearchResponse> {
    return this.searchItems(query, { ...options, format: 'maps' });
  }

  async searchManuscripts(query: string, options?: { limit?: number; dates?: string }): Promise<LOCSearchResponse> {
    return this.searchItems(query, { ...options, format: 'manuscripts' });
  }

  async getItem(locId: string): Promise<LOCSearchResult | null> {
    try {
      const data = await this.fetchWithTimeout<{ item?: LOCItem }>(`${LOC_API}/item/${locId}/?fo=json`);
      return data.item ? this.transformItem(data.item) : null;
    } catch {
      return null;
    }
  }
}

// =============================================================================
// Chronicling America Client (Historical Newspapers)
// =============================================================================

export class ChroniclingAmericaClient extends BaseProviderClient<ChroniclingAmericaResult> {
  constructor() {
    super('chronicling-america', { rateLimitMs: 100, maxResults: 25 });
  }

  protected async executeSearch(query: string, limit: number): Promise<BaseSearchResponse<ChroniclingAmericaResult>> {
    const params = new URLSearchParams({ andtext: query, format: 'json', rows: String(limit), page: '1' });
    const data = await this.fetchWithTimeout<{
      items: ChroniclingAmericaPage[];
      totalItems: number;
    }>(`${CHRONICLING_AMERICA_API}/search/pages/results/?${params}`);

    return {
      results: (data.items || []).map(item => this.transformPage(item)),
      total: data.totalItems || 0,
    };
  }

  protected transformResult(result: ChroniclingAmericaResult): Source {
    return {
      url: result.url,
      title: result.title,
      content: result.content || '',
      quality: 0.85,
      summary: `${result.newspaper} - ${result.date}`,
    };
  }

  private transformPage(page: ChroniclingAmericaPage): ChroniclingAmericaResult {
    const content = page.ocr_eng || `Historical newspaper page from ${page.title}, ${page.date}`;
    return {
      url: page.url || `${CHRONICLING_AMERICA_API}/lccn/${page.lccn}/${page.date}/ed-1/seq-${page.sequence}/`,
      title: `${page.title} - ${page.date}`,
      content: content.slice(0, 2000),
      date: page.date,
      newspaper: page.title,
      state: page.state?.[0],
      city: page.city?.[0],
      pageNumber: page.sequence,
      sequence: page.sequence,
      ocrText: page.ocr_eng,
      pdfUrl: page.pdf_url,
      jpgUrl: page.jp2_url?.replace('.jp2', '.jpg'),
      lccn: page.lccn,
    };
  }

  // Public API (backward compatibility)
  async searchPages(
    query: string,
    options?: {
      limit?: number;
      page?: number;
      state?: string;
      dateFrom?: string;
      dateTo?: string;
    }
  ): Promise<ChroniclingAmericaResponse> {
    const limit = options?.limit ?? 10;
    const params = new URLSearchParams({ andtext: query, format: 'json', rows: String(limit), page: String(options?.page ?? 1) });
    if (options?.state) params.set('state', options.state);
    if (options?.dateFrom) params.set('date1', options.dateFrom.replace(/-/g, ''));
    if (options?.dateTo) params.set('date2', options.dateTo.replace(/-/g, ''));

    const data = await this.fetchWithTimeout<{
      items: ChroniclingAmericaPage[];
      totalItems: number;
    }>(`${CHRONICLING_AMERICA_API}/search/pages/results/?${params}`);

    return {
      results: (data.items || []).map(item => this.transformPage(item)),
      total: data.totalItems,
      pages: Math.ceil(data.totalItems / limit),
    };
  }

  async searchByState(query: string, state: string, options?: { limit?: number }): Promise<ChroniclingAmericaResponse> {
    return this.searchPages(query, { ...options, state });
  }

  async searchByDateRange(query: string, dateFrom: string, dateTo: string, options?: { limit?: number }): Promise<ChroniclingAmericaResponse> {
    return this.searchPages(query, { ...options, dateFrom, dateTo });
  }

  async getNewspapers(options?: { state?: string; limit?: number }): Promise<Array<{ title: string; lccn: string; state: string; startYear: string; endYear: string }>> {
    try {
      const url = options?.state ? `${CHRONICLING_AMERICA_API}/newspapers/?state=${options.state}&format=json` : `${CHRONICLING_AMERICA_API}/newspapers.json`;
      const data = await this.fetchWithTimeout<{ newspapers: Array<{ title: string; lccn: string; state: string; start_year: string; end_year: string }> }>(url);
      return (data.newspapers || []).slice(0, options?.limit ?? 50).map(p => ({
        title: p.title, lccn: p.lccn, state: p.state, startYear: p.start_year, endYear: p.end_year,
      }));
    } catch {
      return [];
    }
  }

  async getPageText(pageUrl: string): Promise<string | null> {
    try {
      const response = await fetch(pageUrl.replace(/\/$/, '') + '/ocr.txt');
      return response.ok ? response.text() : null;
    } catch {
      return null;
    }
  }
}

// =============================================================================
// Combined Client (Convenience Wrapper)
// =============================================================================

export class LibraryOfCongressClient {
  public loc: LOCClient;
  public newspapers: ChroniclingAmericaClient;

  constructor() {
    this.loc = new LOCClient();
    this.newspapers = new ChroniclingAmericaClient();
  }

  async search(query: string, options?: { limit?: number }): Promise<LOCSearchResponse> {
    return this.loc.searchItems(query, options);
  }

  async searchNewspapers(query: string, options?: { limit?: number; state?: string; dateFrom?: string; dateTo?: string }): Promise<ChroniclingAmericaResponse> {
    return this.newspapers.searchPages(query, options);
  }
}
