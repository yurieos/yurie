/**
 * Portable Antiquities Scheme (PAS) API Client
 * 
 * Access to 1.6M+ archaeological finds reported by metal detectorists
 * and members of the public in England and Wales. Excellent resource
 * for treasure hunting research and understanding find patterns.
 * 
 * Coverage: 1.6M+ finds (coins, jewelry, artifacts, hoards, treasure)
 * Rate Limit: Reasonable use
 * 100% FREE - No API key required
 * 
 * @see https://finds.org.uk/database
 * @see https://finds.org.uk/database/search/results/format/json
 */

import { loggers } from '../utils/logger';

const log = loggers.provider;

export interface PASSearchResult {
  url: string;
  title: string;
  content: string;
  findId: string;
  objectType: string;
  broadPeriod?: string;
  dateFrom?: number;
  dateTo?: number;
  county?: string;
  district?: string;
  parish?: string;
  material?: string;
  description?: string;
  notes?: string;
  classification?: string;
  subClassification?: string;
  weight?: number;
  height?: number;
  width?: number;
  thickness?: number;
  diameter?: number;
  quantity?: number;
  imageUrl?: string;
  thumbnail?: string;
  latitude?: number;
  longitude?: number;
  gridReference?: string;
  finder?: string;
  discoveryMethod?: string;
  dateDiscovered?: string;
  isTreasure?: boolean;
}

export interface PASSearchResponse {
  results: PASSearchResult[];
  total: number;
  pages: number;
}

// Available broad periods for filtering
export const PAS_PERIODS = [
  'PALAEOLITHIC',
  'MESOLITHIC', 
  'NEOLITHIC',
  'BRONZE AGE',
  'IRON AGE',
  'ROMAN',
  'EARLY MEDIEVAL',
  'MEDIEVAL',
  'POST MEDIEVAL',
  'MODERN',
  'UNKNOWN',
] as const;

// Common object types
export const PAS_OBJECT_TYPES = [
  'COIN',
  'COIN HOARD',
  'BROOCH',
  'RING',
  'BUCKLE',
  'SEAL MATRIX',
  'SWORD',
  'AXE',
  'SPEAR',
  'INGOT',
  'VESSEL',
  'FIGURINE',
  'WEIGHT',
  'KEY',
  'MOUNT',
  'PENDANT',
  'AMULET',
] as const;

// Common materials
export const PAS_MATERIALS = [
  'GOLD',
  'SILVER',
  'COPPER ALLOY',
  'BRONZE',
  'IRON',
  'LEAD',
  'PEWTER',
  'GOLD AND SILVER',
] as const;

interface PASAPIResult {
  id: string;
  old_findID?: string;
  objecttype?: string;
  objecttypecert?: string;
  classification?: string;
  subclass?: string;
  broadperiod?: string;
  periodFromName?: string;
  periodToName?: string;
  fromdate?: number;
  todate?: number;
  county?: string;
  district?: string;
  parish?: string;
  gridref?: string;
  fourFigureLat?: string;
  fourFigureLon?: string;
  knownas?: string;
  description?: string;
  notes?: string;
  material?: string;
  materialTerm?: string;
  weight?: number;
  height?: number;
  width?: number;
  thickness?: number;
  diameter?: number;
  quantity?: number;
  thumbnail?: string;
  filename?: string;
  finderID?: string;
  discoveryMethod?: string;
  datefound1?: string;
  datefound2?: string;
  treasure?: number;
  treasureID?: string;
  created?: string;
  updated?: string;
}

interface PASAPIResponse {
  meta?: {
    totalResults?: number;
    resultsPerPage?: number;
    page?: number;
    numPages?: number;
  };
  results?: PASAPIResult[];
}

const PAS_API = 'https://finds.org.uk/database/search/results';
const PAS_BASE = 'https://finds.org.uk';

export class PASClient {
  /**
   * Search the Portable Antiquities Scheme database
   */
  async search(
    query: string,
    options?: {
      limit?: number;
      page?: number;
      objectType?: string;
      broadPeriod?: string;
      county?: string;
      district?: string;
      material?: string;
      treasureOnly?: boolean;
      fromDate?: number;
      toDate?: number;
      hasImage?: boolean;
    }
  ): Promise<PASSearchResponse> {
    try {
      const params = new URLSearchParams({
        format: 'json',
        show: String(options?.limit ?? 10),
        page: String(options?.page ?? 1),
      });

      // Add search query
      if (query && query !== '*') {
        params.set('q', query);
      }

      // Add filters
      if (options?.objectType) params.set('objecttype', options.objectType);
      if (options?.broadPeriod) params.set('broadperiod', options.broadPeriod);
      if (options?.county) params.set('county', options.county);
      if (options?.district) params.set('district', options.district);
      if (options?.material) params.set('material', options.material);
      if (options?.treasureOnly) params.set('treasure', '1');
      if (options?.fromDate) params.set('fromdate', String(options.fromDate));
      if (options?.toDate) params.set('todate', String(options.toDate));
      if (options?.hasImage) params.set('hasImage', '1');

      const response = await fetch(`${PAS_API}?${params}`, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`PAS API error: ${response.status}`);
      }

      const data: PASAPIResponse = await response.json();

      return {
        results: (data.results || []).map(find => this.transformFind(find)),
        total: data.meta?.totalResults || 0,
        pages: data.meta?.numPages || 1,
      };
    } catch (error) {
      log.debug('PAS search error:', error);
      throw error;
    }
  }

  /**
   * Search for treasure hoards
   */
  async searchHoards(
    options?: {
      limit?: number;
      period?: string;
      county?: string;
    }
  ): Promise<PASSearchResponse> {
    return this.search('hoard', {
      ...options,
      broadPeriod: options?.period,
    });
  }

  /**
   * Search for official treasure finds
   */
  async searchTreasure(
    query?: string,
    options?: {
      limit?: number;
      period?: string;
      county?: string;
    }
  ): Promise<PASSearchResponse> {
    return this.search(query || '*', {
      ...options,
      broadPeriod: options?.period,
      treasureOnly: true,
    });
  }

  /**
   * Search by historical period
   */
  async searchByPeriod(
    period: typeof PAS_PERIODS[number],
    options?: {
      limit?: number;
      objectType?: string;
      material?: string;
    }
  ): Promise<PASSearchResponse> {
    return this.search('*', {
      ...options,
      broadPeriod: period,
    });
  }

  /**
   * Search for gold and silver finds
   */
  async searchPreciousMetals(
    options?: {
      limit?: number;
      period?: string;
      county?: string;
    }
  ): Promise<PASSearchResponse> {
    // Search for gold items
    const goldResults = await this.search('*', {
      limit: Math.ceil((options?.limit ?? 10) / 2),
      broadPeriod: options?.period,
      county: options?.county,
      material: 'GOLD',
    });

    // Search for silver items
    const silverResults = await this.search('*', {
      limit: Math.ceil((options?.limit ?? 10) / 2),
      broadPeriod: options?.period,
      county: options?.county,
      material: 'SILVER',
    });

    return {
      results: [...goldResults.results, ...silverResults.results].slice(0, options?.limit ?? 10),
      total: goldResults.total + silverResults.total,
      pages: Math.max(goldResults.pages, silverResults.pages),
    };
  }

  /**
   * Search for Roman coins (common treasure hunting target)
   */
  async searchRomanCoins(
    options?: {
      limit?: number;
      county?: string;
    }
  ): Promise<PASSearchResponse> {
    return this.search('*', {
      ...options,
      broadPeriod: 'ROMAN',
      objectType: 'COIN',
    });
  }

  /**
   * Search for Medieval artifacts
   */
  async searchMedieval(
    options?: {
      limit?: number;
      objectType?: string;
      county?: string;
    }
  ): Promise<PASSearchResponse> {
    return this.search('*', {
      ...options,
      broadPeriod: 'MEDIEVAL',
    });
  }

  /**
   * Search by location (county)
   */
  async searchByCounty(
    county: string,
    options?: {
      limit?: number;
      period?: string;
      objectType?: string;
    }
  ): Promise<PASSearchResponse> {
    return this.search('*', {
      ...options,
      county,
      broadPeriod: options?.period,
    });
  }

  /**
   * Get finds with images
   */
  async searchWithImages(
    query: string,
    options?: {
      limit?: number;
      period?: string;
    }
  ): Promise<PASSearchResponse> {
    return this.search(query, {
      ...options,
      broadPeriod: options?.period,
      hasImage: true,
    });
  }

  /**
   * Transform API result to our format
   */
  private transformFind(find: PASAPIResult): PASSearchResult {
    const objectType = find.objecttype || 'Unknown Object';
    const period = find.broadperiod || find.periodFromName || 'Unknown Period';
    
    // Build comprehensive content description
    const contentParts = [
      find.description || '',
      find.notes ? `Notes: ${find.notes}` : '',
      find.material ? `Material: ${find.material}` : '',
      find.county ? `Found in: ${find.county}` : '',
      find.datefound1 ? `Discovered: ${find.datefound1}` : '',
    ].filter(Boolean);

    const content = contentParts.join('. ') || 
      `${objectType} from the ${period} period found in ${find.county || 'Unknown location'}`;

    // Build title
    const title = find.classification 
      ? `${objectType} - ${find.classification}`
      : `${objectType} (${period})`;

    // Get image URL if available
    let imageUrl: string | undefined;
    let thumbnail: string | undefined;
    if (find.thumbnail) {
      thumbnail = find.thumbnail.startsWith('http') 
        ? find.thumbnail 
        : `${PAS_BASE}${find.thumbnail}`;
      imageUrl = thumbnail;
    } else if (find.filename) {
      imageUrl = `${PAS_BASE}/images/thumbnails/${find.filename}`;
      thumbnail = imageUrl;
    }

    // Parse coordinates
    let latitude: number | undefined;
    let longitude: number | undefined;
    if (find.fourFigureLat && find.fourFigureLon) {
      latitude = parseFloat(find.fourFigureLat);
      longitude = parseFloat(find.fourFigureLon);
    }

    return {
      url: `${PAS_BASE}/database/artefacts/record/id/${find.id}`,
      title,
      content,
      findId: find.id,
      objectType,
      broadPeriod: find.broadperiod,
      dateFrom: find.fromdate,
      dateTo: find.todate,
      county: find.county,
      district: find.district,
      parish: find.parish,
      material: find.material || find.materialTerm,
      description: find.description,
      notes: find.notes,
      classification: find.classification,
      subClassification: find.subclass,
      weight: find.weight,
      height: find.height,
      width: find.width,
      thickness: find.thickness,
      diameter: find.diameter,
      quantity: find.quantity,
      imageUrl,
      thumbnail,
      latitude,
      longitude,
      gridReference: find.gridref,
      discoveryMethod: find.discoveryMethod,
      dateDiscovered: find.datefound1,
      isTreasure: find.treasure === 1 || Boolean(find.treasureID),
    };
  }
}


