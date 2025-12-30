/**
 * OpenStreetMap Nominatim Geocoding API Client
 * 
 * Free geocoding service built on OpenStreetMap data.
 * Convert between place names and coordinates - essential for
 * treasure hunting research when working with historical place descriptions.
 * 
 * Coverage: Global coverage based on OpenStreetMap
 * Rate Limit: 1 request/second (please respect this!)
 * 100% FREE - No API key required
 * 
 * @see https://nominatim.org/
 * @see https://nominatim.org/release-docs/latest/api/Search/
 */

import { loggers } from '../utils/logger';

const log = loggers.provider;

export interface NominatimSearchResult {
  url: string;
  title: string;
  content: string;
  placeId: number;
  osmType: 'node' | 'way' | 'relation';
  osmId: number;
  displayName: string;
  category: string;
  type: string;
  latitude: number;
  longitude: number;
  boundingBox?: [number, number, number, number]; // [south, north, west, east]
  importance: number;
  addressDetails?: NominatimAddress;
  extratags?: Record<string, string>;
  nameDetails?: Record<string, string>;
}

export interface NominatimAddress {
  continent?: string;
  country?: string;
  countryCode?: string;
  state?: string;
  stateDistrict?: string;
  county?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  suburb?: string;
  neighbourhood?: string;
  road?: string;
  houseNumber?: string;
  postcode?: string;
  historicName?: string;
}

export interface NominatimSearchResponse {
  results: NominatimSearchResult[];
  total: number;
}

export interface NominatimReverseResult {
  url: string;
  title: string;
  content: string;
  displayName: string;
  latitude: number;
  longitude: number;
  address: NominatimAddress;
  osmType: string;
  osmId: number;
}

interface NominatimAPIResult {
  place_id: number;
  licence: string;
  osm_type: 'node' | 'way' | 'relation';
  osm_id: number;
  lat: string;
  lon: string;
  class: string;
  type: string;
  place_rank: number;
  importance: number;
  addresstype: string;
  name: string;
  display_name: string;
  boundingbox?: [string, string, string, string];
  address?: {
    continent?: string;
    country?: string;
    country_code?: string;
    state?: string;
    state_district?: string;
    county?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    suburb?: string;
    neighbourhood?: string;
    road?: string;
    house_number?: string;
    postcode?: string;
    historic?: string;
  };
  extratags?: Record<string, string>;
  namedetails?: Record<string, string>;
}

// Rate limiting helper
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1100; // 1.1 seconds between requests

const NOMINATIM_API = 'https://nominatim.openstreetmap.org';

export class NominatimClient {
  private userAgent: string;

  constructor(userAgent?: string) {
    // Nominatim requires a valid User-Agent identifying your application
    this.userAgent = userAgent || 'YurieResearchEngine/1.0 (treasure-hunting-research)';
  }

  /**
   * Rate limit helper - ensures we don't exceed 1 req/sec
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      await new Promise(resolve => 
        setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest)
      );
    }
    
    lastRequestTime = Date.now();
  }

  /**
   * Search for places by name
   */
  async search(
    query: string,
    options?: {
      limit?: number;
      countryCode?: string | string[];
      viewbox?: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
      bounded?: boolean;
      addressDetails?: boolean;
      extraTags?: boolean;
      nameDetails?: boolean;
      featureType?: 'country' | 'state' | 'city' | 'settlement';
    }
  ): Promise<NominatimSearchResponse> {
    await this.rateLimit();

    try {
      const params = new URLSearchParams({
        q: query,
        format: 'jsonv2',
        limit: String(options?.limit ?? 10),
      });

      if (options?.countryCode) {
        const codes = Array.isArray(options.countryCode) 
          ? options.countryCode.join(',')
          : options.countryCode;
        params.set('countrycodes', codes);
      }

      if (options?.viewbox) {
        params.set('viewbox', options.viewbox.join(','));
        if (options?.bounded) {
          params.set('bounded', '1');
        }
      }

      if (options?.addressDetails) params.set('addressdetails', '1');
      if (options?.extraTags) params.set('extratags', '1');
      if (options?.nameDetails) params.set('namedetails', '1');
      if (options?.featureType) params.set('featuretype', options.featureType);

      const response = await fetch(`${NOMINATIM_API}/search?${params}`, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Nominatim API error: ${response.status}`);
      }

      const data: NominatimAPIResult[] = await response.json();

      return {
        results: data.map(result => this.transformResult(result)),
        total: data.length,
      };
    } catch (error) {
      log.debug('Nominatim search error:', error);
      throw error;
    }
  }

  /**
   * Reverse geocode: get place name from coordinates
   */
  async reverse(
    latitude: number,
    longitude: number,
    options?: {
      zoom?: number; // 0-18, level of detail
      addressDetails?: boolean;
    }
  ): Promise<NominatimReverseResult | null> {
    await this.rateLimit();

    try {
      const params = new URLSearchParams({
        lat: String(latitude),
        lon: String(longitude),
        format: 'jsonv2',
        zoom: String(options?.zoom ?? 18),
      });

      if (options?.addressDetails !== false) {
        params.set('addressdetails', '1');
      }

      const response = await fetch(`${NOMINATIM_API}/reverse?${params}`, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Nominatim API error: ${response.status}`);
      }

      const data: NominatimAPIResult = await response.json();
      
      if (!data || data.place_id === undefined) return null;

      return {
        url: `https://www.openstreetmap.org/${data.osm_type}/${data.osm_id}`,
        title: data.name || data.display_name.split(',')[0],
        content: data.display_name,
        displayName: data.display_name,
        latitude: parseFloat(data.lat),
        longitude: parseFloat(data.lon),
        address: this.transformAddress(data.address),
        osmType: data.osm_type,
        osmId: data.osm_id,
      };
    } catch (error) {
      log.debug('Nominatim reverse error:', error);
      throw error;
    }
  }

  /**
   * Lookup by OSM ID
   */
  async lookup(
    osmType: 'N' | 'W' | 'R', // Node, Way, Relation
    osmId: number,
    options?: {
      addressDetails?: boolean;
      extraTags?: boolean;
      nameDetails?: boolean;
    }
  ): Promise<NominatimSearchResult | null> {
    await this.rateLimit();

    try {
      const params = new URLSearchParams({
        osm_ids: `${osmType}${osmId}`,
        format: 'jsonv2',
      });

      if (options?.addressDetails) params.set('addressdetails', '1');
      if (options?.extraTags) params.set('extratags', '1');
      if (options?.nameDetails) params.set('namedetails', '1');

      const response = await fetch(`${NOMINATIM_API}/lookup?${params}`, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Nominatim API error: ${response.status}`);
      }

      const data: NominatimAPIResult[] = await response.json();
      
      if (!data || data.length === 0) return null;

      return this.transformResult(data[0]);
    } catch (error) {
      log.debug('Nominatim lookup error:', error);
      throw error;
    }
  }

  /**
   * Search for historical sites
   */
  async searchHistoricalSites(
    query: string,
    options?: {
      limit?: number;
      countryCode?: string;
    }
  ): Promise<NominatimSearchResponse> {
    // Append "historic" to improve results for treasure hunting
    const historicQuery = `${query} historic`;
    return this.search(historicQuery, {
      ...options,
      addressDetails: true,
      extraTags: true,
    });
  }

  /**
   * Search for castles, forts, ruins
   */
  async searchRuins(
    query?: string,
    options?: {
      limit?: number;
      countryCode?: string;
    }
  ): Promise<NominatimSearchResponse> {
    const ruinsQuery = query 
      ? `${query} ruins castle fort` 
      : 'ruins castle fort';
    return this.search(ruinsQuery, {
      ...options,
      addressDetails: true,
      extraTags: true,
    });
  }

  /**
   * Search for old towns and villages
   */
  async searchHistoricalSettlements(
    query: string,
    options?: {
      limit?: number;
      countryCode?: string;
    }
  ): Promise<NominatimSearchResponse> {
    return this.search(`${query} old town historic`, {
      ...options,
      addressDetails: true,
      featureType: 'settlement',
    });
  }

  /**
   * Search for mines and mining sites
   */
  async searchMines(
    query?: string,
    options?: {
      limit?: number;
      countryCode?: string;
    }
  ): Promise<NominatimSearchResponse> {
    const mineQuery = query ? `${query} mine` : 'abandoned mine';
    return this.search(mineQuery, {
      ...options,
      addressDetails: true,
      extraTags: true,
    });
  }

  /**
   * Get coordinates for a specific address
   */
  async geocodeAddress(
    address: string,
    countryCode?: string
  ): Promise<{ latitude: number; longitude: number } | null> {
    const results = await this.search(address, {
      limit: 1,
      countryCode,
      addressDetails: true,
    });

    if (results.results.length === 0) return null;

    return {
      latitude: results.results[0].latitude,
      longitude: results.results[0].longitude,
    };
  }

  /**
   * Transform API result to our format
   */
  private transformResult(result: NominatimAPIResult): NominatimSearchResult {
    const latitude = parseFloat(result.lat);
    const longitude = parseFloat(result.lon);

    // Build content
    const contentParts = [
      result.display_name,
      result.type ? `Type: ${result.type}` : '',
      result.address?.country ? `Country: ${result.address.country}` : '',
    ].filter(Boolean);

    const content = contentParts.join('. ');

    // Parse bounding box
    let boundingBox: [number, number, number, number] | undefined;
    if (result.boundingbox) {
      boundingBox = result.boundingbox.map(v => parseFloat(v)) as [number, number, number, number];
    }

    return {
      url: `https://www.openstreetmap.org/${result.osm_type}/${result.osm_id}`,
      title: result.name || result.display_name.split(',')[0],
      content,
      placeId: result.place_id,
      osmType: result.osm_type,
      osmId: result.osm_id,
      displayName: result.display_name,
      category: result.class,
      type: result.type,
      latitude,
      longitude,
      boundingBox,
      importance: result.importance,
      addressDetails: result.address ? this.transformAddress(result.address) : undefined,
      extratags: result.extratags,
      nameDetails: result.namedetails,
    };
  }

  /**
   * Transform address details
   */
  private transformAddress(address?: NominatimAPIResult['address']): NominatimAddress {
    if (!address) return {};

    return {
      continent: address.continent,
      country: address.country,
      countryCode: address.country_code,
      state: address.state,
      stateDistrict: address.state_district,
      county: address.county,
      city: address.city,
      town: address.town,
      village: address.village,
      municipality: address.municipality,
      suburb: address.suburb,
      neighbourhood: address.neighbourhood,
      road: address.road,
      houseNumber: address.house_number,
      postcode: address.postcode,
      historicName: address.historic,
    };
  }
}


