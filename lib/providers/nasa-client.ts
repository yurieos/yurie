/**
 * NASA APIs Client
 * 
 * REFACTORED: Extended BaseProviderClient for shared functionality.
 * Reduced from ~421 lines to ~340 lines by using base class utilities.
 * 
 * NASA provides a wide range of free APIs for space and astronomy data.
 * 
 * Authentication:
 * - DEMO_KEY: 30 requests/hour, 50/day per IP (no registration)
 * - FREE API Key: 1000 requests/hour (register at https://api.nasa.gov/)
 * 
 * Coverage: Astronomy photos, Mars rovers, asteroids, exoplanets, Earth imagery
 * 
 * @see https://api.nasa.gov/
 */

import { Source } from '../types';
import { BaseProviderClient, BaseSearchResult, BaseSearchResponse } from './base-client';
import { loggers } from '../utils/logger';

const log = loggers.provider;

// =============================================================================
// Types
// =============================================================================

export interface NasaApodResult {
  date: string;
  title: string;
  explanation: string;
  url: string;
  hdurl?: string;
  media_type: 'image' | 'video';
  copyright?: string;
}

export interface NasaMarsPhoto {
  id: number;
  sol: number;
  earth_date: string;
  camera: {
    id: number;
    name: string;
    rover_id: number;
    full_name: string;
  };
  img_src: string;
  rover: {
    id: number;
    name: string;
    landing_date: string;
    launch_date: string;
    status: string;
  };
}

export interface NasaNeoObject {
  id: string;
  name: string;
  nasa_jpl_url: string;
  absolute_magnitude_h: number;
  estimated_diameter: {
    kilometers: { min: number; max: number };
    meters: { min: number; max: number };
  };
  is_potentially_hazardous_asteroid: boolean;
  close_approach_data: Array<{
    close_approach_date: string;
    relative_velocity: { kilometers_per_second: string };
    miss_distance: { kilometers: string };
  }>;
}

export interface NasaSearchResult extends BaseSearchResult {
  url: string;
  title: string;
  content: string;
  mediaType?: string;
  date?: string;
  imageUrl?: string;
  source: string;
}

export interface NasaSearchResponse extends BaseSearchResponse<NasaSearchResult> {
  results: NasaSearchResult[];
  total: number;
}

// =============================================================================
// Constants
// =============================================================================

const NASA_API_BASE = 'https://api.nasa.gov';
const NASA_IMAGES_API = 'https://images-api.nasa.gov';

// =============================================================================
// Client Implementation
// =============================================================================

export class NasaClient extends BaseProviderClient<NasaSearchResult> {
  private apiKey: string;

  constructor(apiKey?: string) {
    super('nasa', {
      rateLimitMs: apiKey && apiKey !== 'DEMO_KEY' ? 4 : 1200, // 1000/hr vs 30/hr
      maxResults: 25,
      timeoutMs: 30000,
    });
    this.apiKey = apiKey || process.env.NASA_API_KEY || 'DEMO_KEY';
  }

  // ===========================================================================
  // Required Abstract Methods
  // ===========================================================================

  protected async executeSearch(query: string, limit: number): Promise<NasaSearchResponse> {
    // Use the images API as primary search
    const params = new URLSearchParams({ q: query });
    const url = `${NASA_IMAGES_API}/search?${params}`;
    
    const response = await fetch(url, {
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`NASA Images search error: ${response.status}`);
    }

    const data = await response.json();
    const items = data.collection?.items || [];

    const results: NasaSearchResult[] = items.slice(0, limit).map((item: {
      data: Array<{
        title: string;
        description: string;
        media_type: string;
        date_created: string;
        nasa_id: string;
      }>;
      links?: Array<{ href: string; rel: string }>;
    }) => {
      const itemData = item.data?.[0] || {};
      const thumbnail = item.links?.find(l => l.rel === 'preview')?.href;

      return {
        url: `https://images.nasa.gov/details-${itemData.nasa_id}`,
        title: itemData.title || 'NASA Image',
        content: itemData.description || '',
        mediaType: itemData.media_type,
        date: itemData.date_created,
        imageUrl: thumbnail,
        source: 'NASA Image Library',
      };
    });

    return {
      results,
      total: data.collection?.metadata?.total_hits || results.length,
    };
  }

  protected transformResult(result: NasaSearchResult): Source {
    return {
      url: result.url,
      title: result.title,
      content: result.content,
      quality: 0.80,
      summary: this.truncate(result.content, 200),
    };
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private buildNasaUrl(endpoint: string, params: Record<string, string> = {}): string {
    const url = new URL(`${NASA_API_BASE}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });
    url.searchParams.set('api_key', this.apiKey);
    return url.toString();
  }

  // ===========================================================================
  // Public API - Extended Methods
  // ===========================================================================

  /**
   * Astronomy Picture of the Day (APOD)
   */
  async getApod(options?: {
    date?: string;
    startDate?: string;
    endDate?: string;
    count?: number;
  }): Promise<NasaApodResult[]> {
    await this.respectRateLimit();
    
    try {
      const params: Record<string, string> = {};
      if (options?.date) {
        params.date = options.date;
      } else if (options?.startDate && options?.endDate) {
        params.start_date = options.startDate;
        params.end_date = options.endDate;
      } else if (options?.count) {
        params.count = String(options.count);
      }

      const url = this.buildNasaUrl('/planetary/apod', params);
      const response = await fetch(url, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`NASA APOD error: ${response.status}`);
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [data];
    } catch (error) {
      log.debug('NASA APOD error:', error);
      throw error;
    }
  }

  /**
   * Mars Rover Photos
   */
  async getMarsPhotos(options?: {
    rover?: 'curiosity' | 'opportunity' | 'spirit' | 'perseverance';
    sol?: number;
    earthDate?: string;
    camera?: string;
    page?: number;
  }): Promise<NasaMarsPhoto[]> {
    await this.respectRateLimit();
    
    try {
      const rover = options?.rover || 'curiosity';
      const params: Record<string, string> = {};
      
      if (options?.sol !== undefined) {
        params.sol = String(options.sol);
      } else if (options?.earthDate) {
        params.earth_date = options.earthDate;
      } else {
        params.sol = '1000';
      }
      
      if (options?.camera) params.camera = options.camera;
      if (options?.page) params.page = String(options.page);

      const url = this.buildNasaUrl(`/mars-photos/api/v1/rovers/${rover}/photos`, params);
      const response = await fetch(url, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`NASA Mars Photos error: ${response.status}`);
      }

      const data = await response.json();
      return data.photos || [];
    } catch (error) {
      log.debug('NASA Mars Photos error:', error);
      throw error;
    }
  }

  /**
   * Near Earth Objects (Asteroids)
   */
  async getNearEarthObjects(options?: {
    startDate?: string;
    endDate?: string;
  }): Promise<{ count: number; objects: NasaNeoObject[] }> {
    await this.respectRateLimit();
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0];

      const params: Record<string, string> = {
        start_date: options?.startDate || today,
        end_date: options?.endDate || weekFromNow,
      };

      const url = this.buildNasaUrl('/neo/rest/v1/feed', params);
      const response = await fetch(url, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`NASA NEO error: ${response.status}`);
      }

      const data = await response.json();
      const objects: NasaNeoObject[] = [];
      Object.values(data.near_earth_objects || {}).forEach((dateObjects) => {
        objects.push(...(dateObjects as NasaNeoObject[]));
      });

      return { count: data.element_count || objects.length, objects };
    } catch (error) {
      log.debug('NASA NEO error:', error);
      throw error;
    }
  }

  /**
   * Search NASA Image and Video Library with options
   */
  async searchImages(
    query: string,
    options?: {
      limit?: number;
      mediaType?: 'image' | 'video' | 'audio';
      yearStart?: number;
      yearEnd?: number;
    }
  ): Promise<NasaSearchResponse> {
    await this.respectRateLimit();
    
    try {
      const params = new URLSearchParams({ q: query });
      if (options?.mediaType) params.set('media_type', options.mediaType);
      if (options?.yearStart) params.set('year_start', String(options.yearStart));
      if (options?.yearEnd) params.set('year_end', String(options.yearEnd));

      const url = `${NASA_IMAGES_API}/search?${params}`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`NASA Images search error: ${response.status}`);
      }

      const data = await response.json();
      const items = data.collection?.items || [];
      const limit = options?.limit ?? 10;

      const results: NasaSearchResult[] = items.slice(0, limit).map((item: {
        data: Array<{
          title: string;
          description: string;
          media_type: string;
          date_created: string;
          nasa_id: string;
        }>;
        links?: Array<{ href: string; rel: string }>;
      }) => {
        const itemData = item.data?.[0] || {};
        const thumbnail = item.links?.find(l => l.rel === 'preview')?.href;

        return {
          url: `https://images.nasa.gov/details-${itemData.nasa_id}`,
          title: itemData.title || 'NASA Image',
          content: itemData.description || '',
          mediaType: itemData.media_type,
          date: itemData.date_created,
          imageUrl: thumbnail,
          source: 'NASA Image Library',
        };
      });

      return {
        results,
        total: data.collection?.metadata?.total_hits || results.length,
      };
    } catch (error) {
      log.debug('NASA Images search error:', error);
      throw error;
    }
  }

  /**
   * Get exoplanet data
   */
  async searchExoplanets(query: string): Promise<NasaSearchResult[]> {
    await this.respectRateLimit();
    
    try {
      const url = new URL('https://exoplanetarchive.ipac.caltech.edu/TAP/sync');
      const adqlQuery = `SELECT TOP 20 pl_name, hostname, discoverymethod, disc_year, pl_orbper, pl_bmasse, pl_rade 
        FROM pscomppars 
        WHERE pl_name LIKE '%${query.replace(/'/g, "''")}%' 
        OR hostname LIKE '%${query.replace(/'/g, "''")}%'`;
      
      url.searchParams.set('query', adqlQuery);
      url.searchParams.set('format', 'json');

      const response = await fetch(url.toString(), {
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        return (await this.searchImages(`exoplanet ${query}`, { limit: 10 })).results;
      }

      const data = await response.json();

      return (data || []).map((planet: {
        pl_name: string;
        hostname: string;
        discoverymethod: string;
        disc_year: number;
        pl_orbper: number;
        pl_bmasse: number;
        pl_rade: number;
      }) => ({
        url: `https://exoplanetarchive.ipac.caltech.edu/overview/${encodeURIComponent(planet.pl_name)}`,
        title: planet.pl_name,
        content: `Exoplanet ${planet.pl_name} orbiting ${planet.hostname}. ` +
          `Discovery method: ${planet.discoverymethod || 'Unknown'}. ` +
          `Discovered: ${planet.disc_year || 'Unknown'}. ` +
          `Orbital period: ${planet.pl_orbper ? planet.pl_orbper.toFixed(2) + ' days' : 'Unknown'}. ` +
          `Mass: ${planet.pl_bmasse ? planet.pl_bmasse.toFixed(2) + ' Earth masses' : 'Unknown'}. ` +
          `Radius: ${planet.pl_rade ? planet.pl_rade.toFixed(2) + ' Earth radii' : 'Unknown'}.`,
        source: 'NASA Exoplanet Archive',
      }));
    } catch (error) {
      log.debug('NASA Exoplanet search error:', error);
      return (await this.searchImages(`exoplanet ${query}`, { limit: 10 })).results;
    }
  }

  /**
   * Transform APOD to search result format
   */
  apodToSearchResult(apod: NasaApodResult): NasaSearchResult {
    return {
      url: apod.url,
      title: apod.title,
      content: apod.explanation,
      mediaType: apod.media_type,
      date: apod.date,
      imageUrl: apod.media_type === 'image' ? apod.url : undefined,
      source: 'NASA APOD',
    };
  }

  /**
   * Transform Mars photo to search result format
   */
  marsPhotoToSearchResult(photo: NasaMarsPhoto): NasaSearchResult {
    return {
      url: photo.img_src,
      title: `Mars Rover Photo - ${photo.rover.name} (${photo.camera.full_name})`,
      content: `Photo taken by ${photo.rover.name} rover using ${photo.camera.full_name} camera. ` +
        `Sol: ${photo.sol}. Earth date: ${photo.earth_date}. ` +
        `Rover status: ${photo.rover.status}. Launch date: ${photo.rover.launch_date}.`,
      mediaType: 'image',
      date: photo.earth_date,
      imageUrl: photo.img_src,
      source: 'NASA Mars Rovers',
    };
  }
}
