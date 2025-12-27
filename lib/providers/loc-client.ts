/**
 * Library of Congress API Client
 * 
 * Access to 170+ million items from the Library of Congress including
 * photographs, maps, manuscripts, newspapers, audio, and more.
 * 
 * Coverage: 170M+ items (photos, newspapers, maps, manuscripts, audio)
 * Rate Limit: Generous, reasonable use
 * 100% FREE - No API key required
 * 
 * @see https://www.loc.gov/apis/
 * @see https://chroniclingamerica.loc.gov/about/api/
 */

export interface LOCSearchResult {
  url: string;
  title: string;
  content: string;
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

export interface ChroniclingAmericaResult {
  url: string;
  title: string;
  content: string;
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
  access_restricted?: boolean;
}

interface LOCAPIResponse {
  results: LOCItem[];
  pagination: {
    total: number;
    pages: number;
    current: number;
    next?: string;
    previous?: string;
  };
}

interface ChroniclingAmericaPage {
  id: string;
  title: string;
  date: string;
  url: string;
  sequence: number;
  county: string[];
  city: string[];
  state: string[];
  edition_label: string;
  lccn: string;
  ocr_eng?: string;
  page_url: string;
  pdf_url: string;
  jp2_url: string;
}

interface ChroniclingAmericaAPIResponse {
  totalItems: number;
  endIndex: number;
  startIndex: number;
  itemsPerPage: number;
  items: ChroniclingAmericaPage[];
}

const LOC_API = 'https://www.loc.gov';
const CHRONICLING_AMERICA_API = 'https://chroniclingamerica.loc.gov';

export class LOCClient {
  /**
   * Search the Library of Congress collections
   */
  async search(
    query: string,
    options?: {
      limit?: number;
      page?: number;
      format?: 'photos' | 'maps' | 'manuscripts' | 'newspapers' | 'audio' | 'film' | 'books';
      dates?: string; // e.g., "1800/1900"
      location?: string;
      subject?: string;
      language?: string;
    }
  ): Promise<LOCSearchResponse> {
    try {
      const params = new URLSearchParams({
        q: query,
        fo: 'json',
        c: String(options?.limit ?? 10),
        sp: String(options?.page ?? 1),
      });

      if (options?.dates) params.set('dates', options.dates);
      if (options?.location) params.set('fa', `location:${options.location}`);
      if (options?.subject) params.set('fa', `subject:${options.subject}`);
      if (options?.language) params.set('fa', `language:${options.language}`);

      // Build URL based on format filter
      let endpoint = `${LOC_API}/search`;
      if (options?.format) {
        const formatMap: Record<string, string> = {
          photos: 'photos',
          maps: 'maps',
          manuscripts: 'manuscripts',
          newspapers: 'newspapers',
          audio: 'audio',
          film: 'film-and-videos',
          books: 'books',
        };
        endpoint = `${LOC_API}/${formatMap[options.format]}`;
      }

      const response = await fetch(`${endpoint}/?${params}`);
      if (!response.ok) throw new Error(`LOC API error: ${response.status}`);

      const data: LOCAPIResponse = await response.json();

      return {
        results: (data.results || []).map(item => this.transformItem(item)),
        total: data.pagination?.total || 0,
        pages: data.pagination?.pages || 1,
      };
    } catch (error) {
      console.error('LOC search error:', error);
      throw error;
    }
  }

  /**
   * Search historical photographs
   */
  async searchPhotos(
    query: string,
    options?: {
      limit?: number;
      dates?: string;
    }
  ): Promise<LOCSearchResponse> {
    return this.search(query, { ...options, format: 'photos' });
  }

  /**
   * Search historical maps
   */
  async searchMaps(
    query: string,
    options?: {
      limit?: number;
      dates?: string;
    }
  ): Promise<LOCSearchResponse> {
    return this.search(query, { ...options, format: 'maps' });
  }

  /**
   * Search manuscripts and documents
   */
  async searchManuscripts(
    query: string,
    options?: {
      limit?: number;
      dates?: string;
    }
  ): Promise<LOCSearchResponse> {
    return this.search(query, { ...options, format: 'manuscripts' });
  }

  /**
   * Get item details by ID
   */
  async getItem(locId: string): Promise<LOCSearchResult | null> {
    try {
      const response = await fetch(`${LOC_API}/item/${locId}/?fo=json`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`LOC API error: ${response.status}`);
      }

      const data = await response.json();
      const item = data.item || data;
      
      return this.transformItem(item);
    } catch (error) {
      console.error('LOC get item error:', error);
      return null;
    }
  }

  /**
   * Transform LOC item to our format
   */
  private transformItem(item: LOCItem): LOCSearchResult {
    const description = Array.isArray(item.description) 
      ? item.description.join(' ') 
      : (item.description || '');
    
    const title = typeof item.title === 'string' 
      ? item.title 
      : (Array.isArray(item.title) ? item.title[0] : 'Untitled');

    return {
      url: item.url || `https://www.loc.gov/item/${item.id}/`,
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
}

/**
 * Chronicling America Client - Historical Newspapers (1690-1963)
 */
export class ChroniclingAmericaClient {
  /**
   * Search historical newspapers
   */
  async search(
    query: string,
    options?: {
      limit?: number;
      page?: number;
      state?: string;
      dateFrom?: string; // YYYY-MM-DD
      dateTo?: string; // YYYY-MM-DD
      language?: string;
      lccn?: string; // Library of Congress Control Number
    }
  ): Promise<ChroniclingAmericaResponse> {
    try {
      const params = new URLSearchParams({
        andtext: query,
        format: 'json',
        rows: String(options?.limit ?? 10),
        page: String(options?.page ?? 1),
      });

      if (options?.state) params.set('state', options.state);
      if (options?.dateFrom) params.set('date1', options.dateFrom.replace(/-/g, ''));
      if (options?.dateTo) params.set('date2', options.dateTo.replace(/-/g, ''));
      if (options?.language) params.set('language', options.language);
      if (options?.lccn) params.set('lccn', options.lccn);

      const response = await fetch(`${CHRONICLING_AMERICA_API}/search/pages/results/?${params}`);
      if (!response.ok) throw new Error(`Chronicling America API error: ${response.status}`);

      const data: ChroniclingAmericaAPIResponse = await response.json();

      return {
        results: (data.items || []).map(item => this.transformPage(item)),
        total: data.totalItems,
        pages: Math.ceil(data.totalItems / (options?.limit ?? 10)),
      };
    } catch (error) {
      console.error('Chronicling America search error:', error);
      throw error;
    }
  }

  /**
   * Search newspapers by state
   */
  async searchByState(
    query: string,
    state: string,
    options?: {
      limit?: number;
      dateFrom?: string;
      dateTo?: string;
    }
  ): Promise<ChroniclingAmericaResponse> {
    return this.search(query, { ...options, state });
  }

  /**
   * Search newspapers by date range
   */
  async searchByDateRange(
    query: string,
    dateFrom: string,
    dateTo: string,
    options?: {
      limit?: number;
      state?: string;
    }
  ): Promise<ChroniclingAmericaResponse> {
    return this.search(query, { ...options, dateFrom, dateTo });
  }

  /**
   * Get available newspapers (titles)
   */
  async getNewspapers(
    options?: {
      state?: string;
      limit?: number;
    }
  ): Promise<Array<{ title: string; lccn: string; state: string; startYear: string; endYear: string }>> {
    try {
      let url = `${CHRONICLING_AMERICA_API}/newspapers.json`;
      if (options?.state) {
        url = `${CHRONICLING_AMERICA_API}/newspapers/?state=${options.state}&format=json`;
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error(`Chronicling America API error: ${response.status}`);

      const data = await response.json();
      const newspapers = data.newspapers || [];
      
      return newspapers.slice(0, options?.limit ?? 50).map((paper: {
        title: string;
        lccn: string;
        state: string;
        start_year: string;
        end_year: string;
      }) => ({
        title: paper.title,
        lccn: paper.lccn,
        state: paper.state,
        startYear: paper.start_year,
        endYear: paper.end_year,
      }));
    } catch (error) {
      console.error('Chronicling America newspapers fetch error:', error);
      return [];
    }
  }

  /**
   * Get OCR text for a specific page
   */
  async getPageText(pageUrl: string): Promise<string | null> {
    try {
      // Convert page URL to OCR text URL
      const ocrUrl = pageUrl.replace(/\/$/, '') + '/ocr.txt';
      const response = await fetch(ocrUrl);
      
      if (!response.ok) return null;
      return await response.text();
    } catch (error) {
      console.error('Chronicling America OCR fetch error:', error);
      return null;
    }
  }

  /**
   * Transform newspaper page to our format
   */
  private transformPage(page: ChroniclingAmericaPage): ChroniclingAmericaResult {
    const content = page.ocr_eng || 
      `Historical newspaper page from ${page.title}, ${page.date}`;

    return {
      url: page.url || `${CHRONICLING_AMERICA_API}/lccn/${page.lccn}/${page.date}/ed-1/seq-${page.sequence}/`,
      title: `${page.title} - ${page.date}`,
      content: content.slice(0, 2000), // Truncate OCR text
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
}

/**
 * Combined Library of Congress client
 */
export class LibraryOfCongressClient {
  public loc: LOCClient;
  public newspapers: ChroniclingAmericaClient;

  constructor() {
    this.loc = new LOCClient();
    this.newspapers = new ChroniclingAmericaClient();
  }

  /**
   * Unified search across all LOC resources
   */
  async search(
    query: string,
    options?: {
      limit?: number;
      includeNewspapers?: boolean;
    }
  ): Promise<LOCSearchResponse> {
    return this.loc.search(query, options);
  }

  /**
   * Search historical newspapers
   */
  async searchNewspapers(
    query: string,
    options?: {
      limit?: number;
      state?: string;
      dateFrom?: string;
      dateTo?: string;
    }
  ): Promise<ChroniclingAmericaResponse> {
    return this.newspapers.search(query, options);
  }
}

