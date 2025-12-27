/**
 * Metropolitan Museum of Art API Client
 * 
 * Access to 470,000+ artworks from one of the world's largest art museums.
 * Includes high-resolution images of open access artworks spanning 5,000 years.
 * 
 * Coverage: 470K+ objects (paintings, sculptures, armor, artifacts, textiles)
 * Rate Limit: 80 requests/second
 * 100% FREE - No API key required
 * 
 * @see https://metmuseum.github.io/
 */

export interface MetMuseumSearchResult {
  url: string;
  title: string;
  content: string;
  objectId: number;
  artistName?: string;
  artistDisplayBio?: string;
  objectDate?: string;
  medium?: string;
  dimensions?: string;
  department?: string;
  culture?: string;
  period?: string;
  dynasty?: string;
  reign?: string;
  creditLine?: string;
  geographyType?: string;
  city?: string;
  country?: string;
  primaryImageUrl?: string;
  isPublicDomain: boolean;
}

export interface MetMuseumSearchResponse {
  results: MetMuseumSearchResult[];
  total: number;
}

interface MetObject {
  objectID: number;
  isHighlight: boolean;
  accessionNumber: string;
  accessionYear: string;
  isPublicDomain: boolean;
  primaryImage: string;
  primaryImageSmall: string;
  additionalImages: string[];
  constituents: Array<{
    constituentID: number;
    role: string;
    name: string;
  }> | null;
  department: string;
  objectName: string;
  title: string;
  culture: string;
  period: string;
  dynasty: string;
  reign: string;
  portfolio: string;
  artistRole: string;
  artistPrefix: string;
  artistDisplayName: string;
  artistDisplayBio: string;
  artistSuffix: string;
  artistAlphaSort: string;
  artistNationality: string;
  artistBeginDate: string;
  artistEndDate: string;
  artistGender: string;
  artistWikidata_URL: string;
  artistULAN_URL: string;
  objectDate: string;
  objectBeginDate: number;
  objectEndDate: number;
  medium: string;
  dimensions: string;
  measurements: Array<{
    elementName: string;
    elementDescription: string | null;
    elementMeasurements: {
      Height?: number;
      Width?: number;
      Depth?: number;
    };
  }> | null;
  creditLine: string;
  geographyType: string;
  city: string;
  state: string;
  county: string;
  country: string;
  region: string;
  subregion: string;
  locale: string;
  locus: string;
  excavation: string;
  river: string;
  classification: string;
  rightsAndReproduction: string;
  linkResource: string;
  metadataDate: string;
  repository: string;
  objectURL: string;
  tags: Array<{ term: string; AAT_URL: string; Wikidata_URL: string }> | null;
  objectWikidata_URL: string;
  isTimelineWork: boolean;
  GalleryNumber: string;
}

interface MetSearchResponse {
  total: number;
  objectIDs: number[] | null;
}

interface MetDepartment {
  departmentId: number;
  displayName: string;
}

const MET_API = 'https://collectionapi.metmuseum.org/public/collection/v1';

export class MetMuseumClient {
  /**
   * Search the Met collection
   */
  async search(
    query: string,
    options?: {
      limit?: number;
      hasImages?: boolean;
      isHighlight?: boolean;
      departmentId?: number;
      geoLocation?: string;
      dateBegin?: number;
      dateEnd?: number;
      isOnView?: boolean;
      artistOrCulture?: boolean;
      medium?: string;
    }
  ): Promise<MetMuseumSearchResponse> {
    try {
      const params = new URLSearchParams({ q: query });
      
      if (options?.hasImages) params.set('hasImages', 'true');
      if (options?.isHighlight) params.set('isHighlight', 'true');
      if (options?.isOnView) params.set('isOnView', 'true');
      if (options?.artistOrCulture) params.set('artistOrCulture', 'true');
      if (options?.departmentId) params.set('departmentId', String(options.departmentId));
      if (options?.geoLocation) params.set('geoLocation', options.geoLocation);
      if (options?.dateBegin) params.set('dateBegin', String(options.dateBegin));
      if (options?.dateEnd) params.set('dateEnd', String(options.dateEnd));
      if (options?.medium) params.set('medium', options.medium);

      const response = await fetch(`${MET_API}/search?${params}`);
      if (!response.ok) throw new Error(`Met API error: ${response.status}`);

      const data: MetSearchResponse = await response.json();
      const objectIds = data.objectIDs || [];
      const limit = options?.limit ?? 10;
      
      // Fetch details for top results (in parallel with concurrency limit)
      const results = await this.fetchObjectsBatch(objectIds.slice(0, limit));

      return {
        results: results.filter((r): r is MetMuseumSearchResult => r !== null),
        total: data.total || objectIds.length,
      };
    } catch (error) {
      console.error('Met Museum search error:', error);
      throw error;
    }
  }

  /**
   * Fetch multiple objects with concurrency control
   */
  private async fetchObjectsBatch(objectIds: number[]): Promise<(MetMuseumSearchResult | null)[]> {
    const BATCH_SIZE = 5;
    const results: (MetMuseumSearchResult | null)[] = [];
    
    for (let i = 0; i < objectIds.length; i += BATCH_SIZE) {
      const batch = objectIds.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(id => this.getObject(id))
      );
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * Get object by ID
   */
  async getObject(objectId: number): Promise<MetMuseumSearchResult | null> {
    try {
      const response = await fetch(`${MET_API}/objects/${objectId}`);
      if (!response.ok) return null;

      const obj: MetObject = await response.json();
      
      const contentParts = [
        obj.objectName,
        obj.artistDisplayName ? `by ${obj.artistDisplayName}` : '',
        obj.objectDate ? `(${obj.objectDate})` : '',
        obj.medium || '',
        obj.culture ? `Culture: ${obj.culture}` : '',
        obj.period ? `Period: ${obj.period}` : '',
        obj.dynasty ? `Dynasty: ${obj.dynasty}` : '',
        obj.department ? `Department: ${obj.department}` : '',
        obj.classification ? `Classification: ${obj.classification}` : '',
      ].filter(Boolean);

      return {
        url: obj.objectURL || `https://www.metmuseum.org/art/collection/search/${objectId}`,
        title: obj.title || obj.objectName || 'Untitled',
        content: contentParts.join('. '),
        objectId: obj.objectID,
        artistName: obj.artistDisplayName || undefined,
        artistDisplayBio: obj.artistDisplayBio || undefined,
        objectDate: obj.objectDate || undefined,
        medium: obj.medium || undefined,
        dimensions: obj.dimensions || undefined,
        department: obj.department || undefined,
        culture: obj.culture || undefined,
        period: obj.period || undefined,
        dynasty: obj.dynasty || undefined,
        reign: obj.reign || undefined,
        creditLine: obj.creditLine || undefined,
        geographyType: obj.geographyType || undefined,
        city: obj.city || undefined,
        country: obj.country || undefined,
        primaryImageUrl: obj.primaryImageSmall || obj.primaryImage || undefined,
        isPublicDomain: obj.isPublicDomain,
      };
    } catch (error) {
      console.error('Met Museum object fetch error:', error);
      return null;
    }
  }

  /**
   * Get all departments
   */
  async getDepartments(): Promise<MetDepartment[]> {
    try {
      const response = await fetch(`${MET_API}/departments`);
      if (!response.ok) throw new Error(`Met API error: ${response.status}`);
      
      const data = await response.json();
      return data.departments || [];
    } catch (error) {
      console.error('Met Museum departments fetch error:', error);
      return [];
    }
  }

  /**
   * Get objects by department
   */
  async getByDepartment(
    departmentId: number,
    options?: { limit?: number }
  ): Promise<MetMuseumSearchResponse> {
    try {
      const response = await fetch(`${MET_API}/objects?departmentIds=${departmentId}`);
      if (!response.ok) throw new Error(`Met API error: ${response.status}`);
      
      const data: { total: number; objectIDs: number[] } = await response.json();
      const limit = options?.limit ?? 10;
      
      const results = await this.fetchObjectsBatch(data.objectIDs.slice(0, limit));

      return {
        results: results.filter((r): r is MetMuseumSearchResult => r !== null),
        total: data.total,
      };
    } catch (error) {
      console.error('Met Museum department fetch error:', error);
      throw error;
    }
  }

  /**
   * Search by culture or period (optimized for historical research)
   */
  async searchByPeriod(
    period: string,
    options?: { limit?: number; hasImages?: boolean }
  ): Promise<MetMuseumSearchResponse> {
    return this.search(period, { 
      ...options, 
      hasImages: options?.hasImages ?? true,
      artistOrCulture: true,
    });
  }

  /**
   * Search by date range (e.g., ancient artifacts)
   */
  async searchByDateRange(
    query: string,
    dateBegin: number,
    dateEnd: number,
    options?: { limit?: number }
  ): Promise<MetMuseumSearchResponse> {
    return this.search(query, {
      ...options,
      dateBegin,
      dateEnd,
      hasImages: true,
    });
  }

  /**
   * Get highlighted/notable works
   */
  async getHighlights(
    query?: string,
    options?: { limit?: number }
  ): Promise<MetMuseumSearchResponse> {
    return this.search(query || '*', {
      ...options,
      isHighlight: true,
      hasImages: true,
    });
  }

  /**
   * Search public domain works only (free to use images)
   */
  async searchPublicDomain(
    query: string,
    options?: { limit?: number }
  ): Promise<MetMuseumSearchResponse> {
    const results = await this.search(query, {
      ...options,
      hasImages: true,
      limit: (options?.limit ?? 10) * 2, // Fetch more to filter
    });

    return {
      results: results.results.filter(r => r.isPublicDomain).slice(0, options?.limit ?? 10),
      total: results.total,
    };
  }
}


