/**
 * Europeana API Client
 * 
 * Access to 50+ million digitized cultural heritage items from
 * European museums, libraries, galleries, and archives.
 * 
 * Coverage: 50M+ items from 3,700+ institutions
 * Rate Limit: Reasonable use
 * FREE - API key required (free registration)
 * 
 * @see https://pro.europeana.eu/page/apis
 * Register for API key: https://pro.europeana.eu/page/get-api
 */

export interface EuropeanaSearchResult {
  url: string;
  title: string;
  content: string;
  creator?: string[];
  year?: string;
  type: string;
  provider?: string;
  dataProvider?: string;
  country?: string[];
  language?: string[];
  thumbnailUrl?: string;
  rights?: string;
  europeanaId: string;
}

export interface EuropeanaSearchResponse {
  results: EuropeanaSearchResult[];
  total: number;
}

interface EuropeanaItem {
  id: string;
  type: string;
  title: string[];
  dcCreator?: string[];
  year?: string[];
  dcDescription?: string[];
  edmPreview?: string[];
  edmDataProvider?: string[];
  edmProvider?: string[];
  edmCountry?: string[];
  dcLanguage?: string[];
  edmRights?: string[];
  guid: string;
}

interface EuropeanaAPIResponse {
  success: boolean;
  itemsCount: number;
  totalResults: number;
  items?: EuropeanaItem[];
}

const EUROPEANA_API = 'https://api.europeana.eu/record/v2';

export class EuropeanaClient {
  private apiKey: string;

  constructor() {
    const apiKey = process.env.EUROPEANA_API_KEY;
    if (!apiKey) {
      console.warn('EUROPEANA_API_KEY not set - Europeana provider will not work. Get a free key at https://pro.europeana.eu/page/get-api');
    }
    this.apiKey = apiKey || '';
  }

  /**
   * Check if client is available
   */
  isAvailable(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Search for cultural heritage items
   */
  async search(
    query: string,
    options?: {
      limit?: number;
      start?: number;
      type?: 'IMAGE' | 'TEXT' | 'VIDEO' | 'SOUND' | '3D';
      reusability?: 'open' | 'restricted' | 'permission';
      country?: string;
      language?: string;
    }
  ): Promise<EuropeanaSearchResponse> {
    if (!this.apiKey) {
      throw new Error('Europeana API key not configured');
    }

    try {
      const params = new URLSearchParams({
        wskey: this.apiKey,
        query,
        rows: String(options?.limit ?? 10),
        start: String(options?.start ?? 1),
        profile: 'standard',
      });

      // Add filters
      if (options?.type) {
        params.set('qf', `TYPE:${options.type}`);
      }
      if (options?.reusability) {
        params.set('reusability', options.reusability);
      }
      if (options?.country) {
        params.append('qf', `COUNTRY:${options.country}`);
      }
      if (options?.language) {
        params.append('qf', `LANGUAGE:${options.language}`);
      }

      const response = await fetch(`${EUROPEANA_API}/search.json?${params}`);

      if (!response.ok) {
        throw new Error(`Europeana API error: ${response.status}`);
      }

      const data: EuropeanaAPIResponse = await response.json();

      if (!data.success) {
        throw new Error('Europeana API returned unsuccessful response');
      }

      return {
        results: (data.items || []).map(item => this.transformItem(item)),
        total: data.totalResults,
      };
    } catch (error) {
      console.error('Europeana search error:', error);
      throw error;
    }
  }

  /**
   * Get item by ID
   */
  async getItem(europeanaId: string): Promise<EuropeanaSearchResult | null> {
    if (!this.apiKey) {
      throw new Error('Europeana API key not configured');
    }

    try {
      const params = new URLSearchParams({
        wskey: this.apiKey,
      });

      // Europeana IDs start with /
      const id = europeanaId.startsWith('/') ? europeanaId : `/${europeanaId}`;

      const response = await fetch(`${EUROPEANA_API}${id}.json?${params}`);

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Europeana API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success || !data.object) {
        return null;
      }

      return this.transformFullItem(data.object);
    } catch (error) {
      console.error('Europeana get item error:', error);
      throw error;
    }
  }

  /**
   * Search by subject
   */
  async searchBySubject(
    subject: string,
    options?: {
      limit?: number;
    }
  ): Promise<EuropeanaSearchResponse> {
    return this.search(`what:"${subject}"`, options);
  }

  /**
   * Search by creator/artist
   */
  async searchByCreator(
    creator: string,
    options?: {
      limit?: number;
    }
  ): Promise<EuropeanaSearchResponse> {
    return this.search(`who:"${creator}"`, options);
  }

  /**
   * Search by time period
   */
  async searchByTimePeriod(
    query: string,
    startYear: number,
    endYear: number,
    options?: {
      limit?: number;
    }
  ): Promise<EuropeanaSearchResponse> {
    return this.search(`${query} AND YEAR:[${startYear} TO ${endYear}]`, options);
  }

  /**
   * Search for images only
   */
  async searchImages(
    query: string,
    options?: {
      limit?: number;
      reusability?: 'open' | 'restricted' | 'permission';
    }
  ): Promise<EuropeanaSearchResponse> {
    return this.search(query, {
      ...options,
      type: 'IMAGE',
    });
  }

  /**
   * Search for historical documents
   */
  async searchDocuments(
    query: string,
    options?: {
      limit?: number;
    }
  ): Promise<EuropeanaSearchResponse> {
    return this.search(query, {
      ...options,
      type: 'TEXT',
    });
  }

  /**
   * Transform search item to our format
   */
  private transformItem(item: EuropeanaItem): EuropeanaSearchResult {
    const title = item.title?.[0] || 'Untitled';
    const description = item.dcDescription?.[0] || '';

    const content = description || 
      `${item.type} from ${item.edmDataProvider?.[0] || 'Unknown provider'}. ` +
      (item.year?.[0] ? `Year: ${item.year[0]}. ` : '') +
      (item.dcCreator?.[0] ? `Creator: ${item.dcCreator[0]}. ` : '');

    return {
      url: item.guid || `https://www.europeana.eu/item${item.id}`,
      title,
      content,
      creator: item.dcCreator,
      year: item.year?.[0],
      type: item.type,
      provider: item.edmProvider?.[0],
      dataProvider: item.edmDataProvider?.[0],
      country: item.edmCountry,
      language: item.dcLanguage,
      thumbnailUrl: item.edmPreview?.[0],
      rights: item.edmRights?.[0],
      europeanaId: item.id,
    };
  }

  /**
   * Transform full item to our format
   */
  private transformFullItem(item: {
    about: string;
    title?: { def?: string[] };
    dcCreator?: { def?: string[] };
    year?: { def?: string[] };
    dcDescription?: { def?: string[] };
    edmPreview?: string[];
    edmDataProvider?: { def?: string[] };
    edmProvider?: { def?: string[] };
    edmCountry?: { def?: string[] };
    dcLanguage?: { def?: string[] };
    edmRights?: { def?: string[] };
    type?: string;
    europeanaAggregation?: { edmLandingPage?: string };
  }): EuropeanaSearchResult {
    const title = item.title?.def?.[0] || 'Untitled';
    const description = item.dcDescription?.def?.[0] || '';

    return {
      url: item.europeanaAggregation?.edmLandingPage || 
        `https://www.europeana.eu/item${item.about}`,
      title,
      content: description,
      creator: item.dcCreator?.def,
      year: item.year?.def?.[0],
      type: item.type || 'Unknown',
      provider: item.edmProvider?.def?.[0],
      dataProvider: item.edmDataProvider?.def?.[0],
      country: item.edmCountry?.def,
      language: item.dcLanguage?.def,
      thumbnailUrl: item.edmPreview?.[0],
      rights: item.edmRights?.def?.[0],
      europeanaId: item.about,
    };
  }
}

