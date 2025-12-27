/**
 * NASA APIs Client
 * 
 * NASA provides a wide range of free APIs for space and astronomy data.
 * 
 * Authentication:
 * - DEMO_KEY: 30 requests/hour, 50/day per IP (no registration)
 * - FREE API Key: 1000 requests/hour (register at https://api.nasa.gov/)
 * 
 * Set NASA_API_KEY environment variable for higher rate limits.
 * 
 * Coverage: Astronomy photos, Mars rovers, asteroids, exoplanets, Earth imagery
 * 
 * Perfect for: Space research, astronomy, planetary science, Earth observation
 * 
 * @see https://api.nasa.gov/
 */

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

export interface NasaSearchResult {
  url: string;
  title: string;
  content: string;
  mediaType?: string;
  date?: string;
  imageUrl?: string;
  source: string;
}

export interface NasaSearchResponse {
  results: NasaSearchResult[];
  total: number;
}

const NASA_API_BASE = 'https://api.nasa.gov';
const NASA_IMAGES_API = 'https://images-api.nasa.gov';

export class NasaClient {
  private apiKey: string;

  constructor(apiKey?: string) {
    // Use provided key, env var, or fallback to DEMO_KEY
    this.apiKey = apiKey || process.env.NASA_API_KEY || 'DEMO_KEY';
  }

  /**
   * Build URL with API key
   */
  private buildUrl(base: string, endpoint: string, params: Record<string, string> = {}): string {
    const url = new URL(`${base}${endpoint}`);
    
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        url.searchParams.set(key, value);
      }
    });
    
    url.searchParams.set('api_key', this.apiKey);
    
    return url.toString();
  }

  /**
   * Astronomy Picture of the Day (APOD)
   */
  async getApod(options?: {
    date?: string; // YYYY-MM-DD
    startDate?: string;
    endDate?: string;
    count?: number;
  }): Promise<NasaApodResult[]> {
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

      const url = this.buildUrl(NASA_API_BASE, '/planetary/apod', params);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`NASA APOD error: ${response.status}`);
      }

      const data = await response.json();
      
      // API returns array or single object depending on params
      return Array.isArray(data) ? data : [data];
    } catch (error) {
      console.error('NASA APOD error:', error);
      throw error;
    }
  }

  /**
   * Mars Rover Photos
   */
  async getMarsPhotos(options?: {
    rover?: 'curiosity' | 'opportunity' | 'spirit' | 'perseverance';
    sol?: number; // Martian sol (day)
    earthDate?: string; // YYYY-MM-DD
    camera?: string;
    page?: number;
  }): Promise<NasaMarsPhoto[]> {
    try {
      const rover = options?.rover || 'curiosity';
      const params: Record<string, string> = {};
      
      if (options?.sol !== undefined) {
        params.sol = String(options.sol);
      } else if (options?.earthDate) {
        params.earth_date = options.earthDate;
      } else {
        // Default to a recent sol
        params.sol = '1000';
      }
      
      if (options?.camera) {
        params.camera = options.camera;
      }
      
      if (options?.page) {
        params.page = String(options.page);
      }

      const url = this.buildUrl(
        NASA_API_BASE, 
        `/mars-photos/api/v1/rovers/${rover}/photos`,
        params
      );
      
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`NASA Mars Photos error: ${response.status}`);
      }

      const data = await response.json();
      return data.photos || [];
    } catch (error) {
      console.error('NASA Mars Photos error:', error);
      throw error;
    }
  }

  /**
   * Near Earth Objects (Asteroids)
   */
  async getNearEarthObjects(options?: {
    startDate?: string; // YYYY-MM-DD
    endDate?: string;
  }): Promise<{ count: number; objects: NasaNeoObject[] }> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0];

      const params: Record<string, string> = {
        start_date: options?.startDate || today,
        end_date: options?.endDate || weekFromNow,
      };

      const url = this.buildUrl(NASA_API_BASE, '/neo/rest/v1/feed', params);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`NASA NEO error: ${response.status}`);
      }

      const data = await response.json();
      
      // Flatten objects from all dates
      const objects: NasaNeoObject[] = [];
      Object.values(data.near_earth_objects || {}).forEach((dateObjects) => {
        objects.push(...(dateObjects as NasaNeoObject[]));
      });

      return {
        count: data.element_count || objects.length,
        objects,
      };
    } catch (error) {
      console.error('NASA NEO error:', error);
      throw error;
    }
  }

  /**
   * Search NASA Image and Video Library
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
    try {
      const params: Record<string, string> = {
        q: query,
      };
      
      if (options?.mediaType) {
        params.media_type = options.mediaType;
      }
      
      if (options?.yearStart) {
        params.year_start = String(options.yearStart);
      }
      
      if (options?.yearEnd) {
        params.year_end = String(options.yearEnd);
      }

      const url = new URL(`${NASA_IMAGES_API}/search`);
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

      const response = await fetch(url.toString());

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
        href: string;
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
      console.error('NASA Images search error:', error);
      throw error;
    }
  }

  /**
   * Combined search across NASA resources
   */
  async search(
    query: string,
    options?: { limit?: number }
  ): Promise<NasaSearchResponse> {
    try {
      // Search images/videos and get APOD data
      const [imageResults] = await Promise.all([
        this.searchImages(query, { limit: options?.limit ?? 10 }),
      ]);

      return imageResults;
    } catch (error) {
      console.error('NASA search error:', error);
      throw error;
    }
  }

  /**
   * Get exoplanet data
   */
  async searchExoplanets(query: string): Promise<NasaSearchResult[]> {
    try {
      // NASA Exoplanet Archive API
      const url = new URL('https://exoplanetarchive.ipac.caltech.edu/TAP/sync');
      
      // Build a simple ADQL query
      const adqlQuery = `SELECT TOP 20 pl_name, hostname, discoverymethod, disc_year, pl_orbper, pl_bmasse, pl_rade 
        FROM pscomppars 
        WHERE pl_name LIKE '%${query.replace(/'/g, "''")}%' 
        OR hostname LIKE '%${query.replace(/'/g, "''")}%'`;
      
      url.searchParams.set('query', adqlQuery);
      url.searchParams.set('format', 'json');

      const response = await fetch(url.toString());

      if (!response.ok) {
        // Fallback to regular search if exoplanet archive fails
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
      console.error('NASA Exoplanet search error:', error);
      // Fallback
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

