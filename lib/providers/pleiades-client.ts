/**
 * Pleiades Gazetteer API Client
 * 
 * Access to the geographic database of ancient world locations.
 * Contains data on Greek, Roman, Egyptian, and other ancient civilizations'
 * settlements, temples, roads, and archaeological sites.
 * 
 * Coverage: 35,000+ ancient places with coordinates
 * Rate Limit: Reasonable use
 * 100% FREE - No API key required
 * 
 * @see https://pleiades.stoa.org/
 * @see https://pleiades.stoa.org/downloads
 */

import { loggers } from '../utils/logger';

const log = loggers.provider;

export interface PleiadesSearchResult {
  url: string;
  title: string;
  content: string;
  pleiadesId: string;
  featureTypes: string[];
  description?: string;
  details?: string;
  latitude?: number;
  longitude?: number;
  bbox?: [number, number, number, number];
  timePeriodsKeys: string[];
  timePeriodLabels: string[];
  names: PleiadesPlacelName[];
  connections: PleiadesConnection[];
  creators: string[];
  contributors: string[];
  created?: string;
  modified?: string;
}

export interface PleiadesPlacelName {
  name: string;
  language?: string;
  nameType?: string;
  attested?: string;
  romanized?: string;
  timePeriods?: string[];
}

export interface PleiadesConnection {
  id: string;
  title: string;
  connectionType: string;
  uri: string;
}

export interface PleiadesSearchResponse {
  results: PleiadesSearchResult[];
  total: number;
}

// Time period keys used by Pleiades
export const PLEIADES_PERIODS = {
  'archaic': 'Archaic (750-550 BC)',
  'classical': 'Classical (550-330 BC)',
  'hellenistic-republican': 'Hellenistic-Republican (330-30 BC)',
  'roman': 'Roman (30 BC - AD 300)',
  'late-antique': 'Late Antique (AD 300-640)',
  'modern': 'Modern (AD 1700-2100)',
} as const;

// Common feature types
export const PLEIADES_FEATURE_TYPES = [
  'settlement',
  'temple',
  'sanctuary',
  'fort',
  'road',
  'bridge',
  'aqueduct',
  'bath',
  'cemetery',
  'mine',
  'quarry',
  'harbor',
  'villa',
  'theater',
  'amphitheater',
  'stadium',
  'palace',
  'tomb',
  'pyramid',
  'obelisk',
] as const;

interface PleiadesAPIPlace {
  id: string;
  uri: string;
  title: string;
  description?: string;
  details?: string;
  placeTypes?: string[];
  features?: Array<{
    type: string;
    id: string;
    geometry?: {
      type: string;
      coordinates: number[] | number[][];
    };
  }>;
  reprPoint?: [number, number];
  bbox?: [number, number, number, number];
  names?: Array<{
    attested?: string;
    romanized?: string;
    language?: string;
    nameType?: string;
    timePeriods?: Array<{ timePeriod: string }>;
  }>;
  locations?: Array<{
    geometry?: {
      type: string;
      coordinates: number[];
    };
    timePeriods?: Array<{ timePeriod: string }>;
  }>;
  connections?: Array<{
    id: string;
    title: string;
    connectionType: string;
    uri: string;
  }>;
  creators?: Array<{ name: string }>;
  contributors?: Array<{ name: string }>;
  created?: string;
  modified?: string;
  '@type'?: string;
}

interface PleiadesSearchAPIResponse {
  features?: Array<{
    type: string;
    id: string;
    properties: PleiadesAPIPlace;
    geometry?: {
      type: string;
      coordinates: number[];
    };
  }>;
  type?: string;
}

const PLEIADES_API = 'https://pleiades.stoa.org';

export class PleiadesClient {
  /**
   * Search for ancient places
   */
  async search(
    query: string,
    options?: {
      limit?: number;
      featureType?: string;
      timePeriod?: string;
    }
  ): Promise<PleiadesSearchResponse> {
    try {
      // Pleiades uses a simple search endpoint
      const params = new URLSearchParams({
        SearchableText: query,
        portal_type: 'Place',
      });

      if (options?.featureType) {
        params.set('getFeatureType', options.featureType);
      }

      const response = await fetch(`${PLEIADES_API}/search_rss?${params}`, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        // Try alternative JSON endpoint
        return this.searchViaJSON(query, options);
      }

      // Parse RSS response
      const text = await response.text();
      const places = this.parseRSSResponse(text);
      
      const limit = options?.limit ?? 10;
      return {
        results: places.slice(0, limit),
        total: places.length,
      };
    } catch (error) {
      log.debug('Pleiades search error:', error);
      // Try alternative approach
      return this.searchViaJSON(query, options);
    }
  }

  /**
   * Alternative search using JSON downloads
   */
  private async searchViaJSON(
    query: string,
    options?: {
      limit?: number;
      featureType?: string;
    }
  ): Promise<PleiadesSearchResponse> {
    try {
      // Use the places search with JSON format
      const params = new URLSearchParams({
        SearchableText: query,
      });

      const response = await fetch(`${PLEIADES_API}/search?${params}`, {
        headers: {
          'Accept': 'application/json, text/html',
        },
      });

      if (!response.ok) {
        throw new Error(`Pleiades API error: ${response.status}`);
      }

      // Check content type
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        return this.processJSONResponse(data, options?.limit ?? 10);
      }
      
      // HTML response - parse it
      const html = await response.text();
      return this.parseHTMLSearchResults(html, query, options?.limit ?? 10);
    } catch (error) {
      log.debug('Pleiades JSON search error:', error);
      throw error;
    }
  }

  /**
   * Get place by Pleiades ID
   */
  async getPlace(pleiadesId: string): Promise<PleiadesSearchResult | null> {
    try {
      const response = await fetch(`${PLEIADES_API}/places/${pleiadesId}/json`, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Pleiades API error: ${response.status}`);
      }

      const place: PleiadesAPIPlace = await response.json();
      return this.transformPlace(place);
    } catch (error) {
      log.debug('Pleiades get place error:', error);
      return null;
    }
  }

  /**
   * Search for Roman sites
   */
  async searchRomanSites(
    query?: string,
    options?: { limit?: number }
  ): Promise<PleiadesSearchResponse> {
    const searchQuery = query ? `${query} roman` : 'roman';
    return this.search(searchQuery, {
      ...options,
      timePeriod: 'roman',
    });
  }

  /**
   * Search for temples and sanctuaries
   */
  async searchTemples(
    query?: string,
    options?: { limit?: number }
  ): Promise<PleiadesSearchResponse> {
    const searchQuery = query ? `${query} temple sanctuary` : 'temple sanctuary';
    return this.search(searchQuery, {
      ...options,
      featureType: 'temple',
    });
  }

  /**
   * Search for ancient settlements
   */
  async searchSettlements(
    query?: string,
    options?: { limit?: number }
  ): Promise<PleiadesSearchResponse> {
    const searchQuery = query ? `${query} settlement city` : 'settlement city';
    return this.search(searchQuery, {
      ...options,
      featureType: 'settlement',
    });
  }

  /**
   * Search for ancient mines (treasure hunting relevant!)
   */
  async searchMines(
    query?: string,
    options?: { limit?: number }
  ): Promise<PleiadesSearchResponse> {
    const searchQuery = query ? `${query} mine` : 'mine quarry';
    return this.search(searchQuery, {
      ...options,
      featureType: 'mine',
    });
  }

  /**
   * Search for ancient roads (trade routes)
   */
  async searchRoads(
    query?: string,
    options?: { limit?: number }
  ): Promise<PleiadesSearchResponse> {
    const searchQuery = query ? `${query} road via` : 'road via';
    return this.search(searchQuery, {
      ...options,
      featureType: 'road',
    });
  }

  /**
   * Search for tombs and burial sites
   */
  async searchTombs(
    query?: string,
    options?: { limit?: number }
  ): Promise<PleiadesSearchResponse> {
    const searchQuery = query ? `${query} tomb cemetery` : 'tomb cemetery necropolis';
    return this.search(searchQuery, options);
  }

  /**
   * Search by region (e.g., "Egypt", "Greece", "Italy")
   */
  async searchByRegion(
    region: string,
    options?: {
      limit?: number;
      featureType?: string;
    }
  ): Promise<PleiadesSearchResponse> {
    return this.search(region, options);
  }

  /**
   * Parse RSS/RDF response from Pleiades
   */
  private parseRSSResponse(rss: string): PleiadesSearchResult[] {
    const results: PleiadesSearchResult[] = [];
    
    // Parse RDF/RSS format - items have rdf:about attribute
    // Pattern matches: <item rdf:about="...">...</item>
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(rss)) !== null) {
      const itemXml = match[0]; // Include the full tag to extract rdf:about
      const itemContent = match[1];
      
      // Extract URL from rdf:about attribute or link tag
      const aboutMatch = itemXml.match(/rdf:about="([^"]+)"/);
      const link = aboutMatch ? aboutMatch[1] : (this.extractTag(itemContent, 'link') || '');
      
      const title = this.extractTag(itemContent, 'title') || 'Unknown Place';
      const description = this.extractTag(itemContent, 'description') || '';
      
      // Extract Pleiades ID from link
      const idMatch = link.match(/places\/(\d+)/);
      const pleiadesId = idMatch ? idMatch[1] : '';

      // Extract coordinates if available
      const geoLat = this.extractTag(itemContent, 'geo:lat');
      const geoLong = this.extractTag(itemContent, 'geo:long');

      if (pleiadesId || link) {
        results.push({
          url: link || `${PLEIADES_API}/places/${pleiadesId}`,
          title,
          content: description || `Ancient place: ${title}`,
          pleiadesId,
          featureTypes: [],
          description,
          latitude: geoLat ? parseFloat(geoLat) : undefined,
          longitude: geoLong ? parseFloat(geoLong) : undefined,
          timePeriodsKeys: [],
          timePeriodLabels: [],
          names: [],
          connections: [],
          creators: [],
          contributors: [],
        });
      }
    }

    return results;
  }

  /**
   * Parse HTML search results
   */
  private parseHTMLSearchResults(
    html: string,
    query: string,
    limit: number
  ): PleiadesSearchResponse {
    const results: PleiadesSearchResult[] = [];
    
    // Simple HTML parsing for search results
    const linkRegex = /href="(\/places\/(\d+)[^"]*)"[^>]*>([^<]+)</g;
    let match;
    const seen = new Set<string>();

    while ((match = linkRegex.exec(html)) !== null && results.length < limit) {
      const [, path, id, title] = match;
      
      if (seen.has(id)) continue;
      seen.add(id);

      results.push({
        url: `${PLEIADES_API}${path}`,
        title: title.trim(),
        content: `Ancient place: ${title.trim()}`,
        pleiadesId: id,
        featureTypes: [],
        timePeriodsKeys: [],
        timePeriodLabels: [],
        names: [],
        connections: [],
        creators: [],
        contributors: [],
      });
    }

    return {
      results,
      total: results.length,
    };
  }

  /**
   * Process JSON response
   */
  private processJSONResponse(
    data: PleiadesSearchAPIResponse | PleiadesAPIPlace[],
    limit: number
  ): PleiadesSearchResponse {
    let places: PleiadesAPIPlace[] = [];

    if (Array.isArray(data)) {
      places = data;
    } else if (data.features) {
      places = data.features.map(f => ({
        ...f.properties,
        reprPoint: f.geometry?.coordinates as [number, number],
      }));
    }

    return {
      results: places.slice(0, limit).map(p => this.transformPlace(p)),
      total: places.length,
    };
  }

  /**
   * Transform Pleiades place to our format
   */
  private transformPlace(place: PleiadesAPIPlace): PleiadesSearchResult {
    // Get coordinates
    let latitude: number | undefined;
    let longitude: number | undefined;

    if (place.reprPoint) {
      [longitude, latitude] = place.reprPoint;
    } else if (place.locations?.[0]?.geometry?.coordinates) {
      const coords = place.locations[0].geometry.coordinates;
      if (Array.isArray(coords) && coords.length >= 2) {
        [longitude, latitude] = coords as [number, number];
      }
    }

    // Get time periods
    const timePeriodsKeys: string[] = [];
    const timePeriodLabels: string[] = [];

    place.locations?.forEach(loc => {
      loc.timePeriods?.forEach(tp => {
        if (!timePeriodsKeys.includes(tp.timePeriod)) {
          timePeriodsKeys.push(tp.timePeriod);
          const label = PLEIADES_PERIODS[tp.timePeriod as keyof typeof PLEIADES_PERIODS];
          if (label) timePeriodLabels.push(label);
        }
      });
    });

    // Get names
    const names: PleiadesPlacelName[] = (place.names || []).map(n => ({
      name: n.romanized || n.attested || '',
      language: n.language,
      nameType: n.nameType,
      attested: n.attested,
      romanized: n.romanized,
      timePeriods: n.timePeriods?.map(tp => tp.timePeriod),
    }));

    // Get connections
    const connections: PleiadesConnection[] = (place.connections || []).map(c => ({
      id: c.id,
      title: c.title,
      connectionType: c.connectionType,
      uri: c.uri,
    }));

    // Build content
    const contentParts = [
      place.description || '',
      place.details || '',
      place.placeTypes?.length ? `Types: ${place.placeTypes.join(', ')}` : '',
      timePeriodLabels.length ? `Periods: ${timePeriodLabels.join(', ')}` : '',
    ].filter(Boolean);

    const content = contentParts.join('. ') || `Ancient place: ${place.title}`;

    return {
      url: place.uri || `${PLEIADES_API}/places/${place.id}`,
      title: place.title,
      content,
      pleiadesId: place.id,
      featureTypes: place.placeTypes || [],
      description: place.description,
      details: place.details,
      latitude,
      longitude,
      bbox: place.bbox,
      timePeriodsKeys,
      timePeriodLabels,
      names,
      connections,
      creators: place.creators?.map(c => c.name) || [],
      contributors: place.contributors?.map(c => c.name) || [],
      created: place.created,
      modified: place.modified,
    };
  }

  /**
   * Helper to extract tag content from XML
   */
  private extractTag(xml: string, tag: string): string | undefined {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1].trim() : undefined;
  }
}


