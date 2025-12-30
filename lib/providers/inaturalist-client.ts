/**
 * iNaturalist API Client
 * 
 * Access to observations and species data from the world's largest 
 * community science biodiversity platform. 150M+ observations with photos.
 * 
 * Coverage: 150M+ observations, 400K+ species
 * Rate Limit: 60 requests/minute
 * 100% FREE - No API key required for read operations
 * 
 * @see https://api.inaturalist.org/v1/docs/
 */

import { loggers } from '../utils/logger';

const log = loggers.provider;

export interface INaturalistSearchResult {
  url: string;
  title: string;
  content: string;
  scientificName: string;
  commonName?: string;
  taxonRank: string;
  observationsCount: number;
  imageUrl?: string;
  wikipediaSummary?: string;
  conservationStatus?: string;
  ancestors?: string[];
  taxonId: number;
}

export interface INaturalistSearchResponse {
  results: INaturalistSearchResult[];
  total: number;
}

export interface INaturalistObservation {
  url: string;
  species: string;
  location: string;
  observedOn: string;
  imageUrl?: string;
  quality: string;
  userId: number;
  userName: string;
}

interface INatTaxon {
  id: number;
  name: string;
  preferred_common_name?: string;
  rank: string;
  observations_count: number;
  default_photo?: {
    medium_url?: string;
    square_url?: string;
  };
  wikipedia_summary?: string;
  conservation_status?: {
    status_name?: string;
    iucn?: number;
  };
  ancestors?: Array<{
    name: string;
    rank: string;
  }>;
  wikipedia_url?: string;
}

interface INatObservation {
  id: number;
  uri: string;
  taxon?: {
    name: string;
    preferred_common_name?: string;
  };
  place_guess?: string;
  observed_on_string?: string;
  photos?: Array<{
    url?: string;
  }>;
  quality_grade: string;
  user: {
    id: number;
    login: string;
  };
}

const INAT_API = 'https://api.inaturalist.org/v1';

export class INaturalistClient {
  private requestDelay = 1000; // 60 req/min = 1 req/sec

  /**
   * Search for species/taxa
   */
  async searchSpecies(
    query: string,
    options?: {
      limit?: number;
      rank?: 'kingdom' | 'phylum' | 'class' | 'order' | 'family' | 'genus' | 'species';
      isActive?: boolean;
    }
  ): Promise<INaturalistSearchResponse> {
    try {
      await this.rateLimit();

      const params = new URLSearchParams({
        q: query,
        per_page: String(options?.limit ?? 10),
        is_active: String(options?.isActive ?? true),
      });

      if (options?.rank) {
        params.set('rank', options.rank);
      }

      const response = await fetch(`${INAT_API}/taxa?${params}`);

      if (!response.ok) {
        throw new Error(`iNaturalist API error: ${response.status}`);
      }

      const data = await response.json();
      const taxa: INatTaxon[] = data.results || [];

      return {
        results: taxa.map(taxon => this.transformTaxon(taxon)),
        total: data.total_results || taxa.length,
      };
    } catch (error) {
      log.debug('iNaturalist search error:', error);
      throw error;
    }
  }

  /**
   * Get species by ID
   */
  async getSpecies(taxonId: number): Promise<INaturalistSearchResult | null> {
    try {
      await this.rateLimit();

      const response = await fetch(`${INAT_API}/taxa/${taxonId}`);

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`iNaturalist API error: ${response.status}`);
      }

      const data = await response.json();
      const taxon = data.results?.[0];

      if (!taxon) return null;

      return this.transformTaxon(taxon);
    } catch (error) {
      log.debug('iNaturalist get species error:', error);
      throw error;
    }
  }

  /**
   * Search observations
   */
  async searchObservations(
    query: string,
    options?: {
      limit?: number;
      qualityGrade?: 'research' | 'needs_id' | 'casual';
      hasPhotos?: boolean;
      latitude?: number;
      longitude?: number;
      radius?: number; // km
    }
  ): Promise<{ results: INaturalistObservation[]; total: number }> {
    try {
      await this.rateLimit();

      const params = new URLSearchParams({
        q: query,
        per_page: String(options?.limit ?? 10),
        order: 'desc',
        order_by: 'created_at',
      });

      if (options?.qualityGrade) {
        params.set('quality_grade', options.qualityGrade);
      }
      if (options?.hasPhotos) {
        params.set('photos', 'true');
      }
      if (options?.latitude && options?.longitude) {
        params.set('lat', String(options.latitude));
        params.set('lng', String(options.longitude));
        params.set('radius', String(options?.radius ?? 50));
      }

      const response = await fetch(`${INAT_API}/observations?${params}`);

      if (!response.ok) {
        throw new Error(`iNaturalist API error: ${response.status}`);
      }

      const data = await response.json();
      const observations: INatObservation[] = data.results || [];

      return {
        results: observations.map(obs => this.transformObservation(obs)),
        total: data.total_results || observations.length,
      };
    } catch (error) {
      log.debug('iNaturalist observations search error:', error);
      throw error;
    }
  }

  /**
   * Get observations for a specific species
   */
  async getSpeciesObservations(
    taxonId: number,
    options?: {
      limit?: number;
      qualityGrade?: 'research' | 'needs_id' | 'casual';
    }
  ): Promise<{ results: INaturalistObservation[]; total: number }> {
    try {
      await this.rateLimit();

      const params = new URLSearchParams({
        taxon_id: String(taxonId),
        per_page: String(options?.limit ?? 10),
        order: 'desc',
        order_by: 'created_at',
        photos: 'true',
      });

      if (options?.qualityGrade) {
        params.set('quality_grade', options.qualityGrade);
      }

      const response = await fetch(`${INAT_API}/observations?${params}`);

      if (!response.ok) {
        throw new Error(`iNaturalist API error: ${response.status}`);
      }

      const data = await response.json();
      const observations: INatObservation[] = data.results || [];

      return {
        results: observations.map(obs => this.transformObservation(obs)),
        total: data.total_results || observations.length,
      };
    } catch (error) {
      log.debug('iNaturalist species observations error:', error);
      throw error;
    }
  }

  /**
   * Get iconic taxa (categories)
   */
  async getIconicTaxa(): Promise<INaturalistSearchResult[]> {
    try {
      await this.rateLimit();

      const response = await fetch(`${INAT_API}/taxa?iconic_taxa=true&per_page=20`);

      if (!response.ok) {
        throw new Error(`iNaturalist API error: ${response.status}`);
      }

      const data = await response.json();
      const taxa: INatTaxon[] = data.results || [];

      return taxa.map(taxon => this.transformTaxon(taxon));
    } catch (error) {
      log.debug('iNaturalist iconic taxa error:', error);
      throw error;
    }
  }

  /**
   * Search by location
   */
  async searchByLocation(
    latitude: number,
    longitude: number,
    options?: {
      limit?: number;
      radius?: number; // km
      hasPhotos?: boolean;
    }
  ): Promise<INaturalistSearchResponse> {
    try {
      await this.rateLimit();

      const params = new URLSearchParams({
        lat: String(latitude),
        lng: String(longitude),
        radius: String(options?.radius ?? 50),
        per_page: String(options?.limit ?? 10),
        order: 'desc',
        order_by: 'observations_count',
      });

      if (options?.hasPhotos) {
        params.set('photos', 'true');
      }

      const response = await fetch(`${INAT_API}/taxa?${params}`);

      if (!response.ok) {
        throw new Error(`iNaturalist API error: ${response.status}`);
      }

      const data = await response.json();
      const taxa: INatTaxon[] = data.results || [];

      return {
        results: taxa.map(taxon => this.transformTaxon(taxon)),
        total: data.total_results || taxa.length,
      };
    } catch (error) {
      log.debug('iNaturalist location search error:', error);
      throw error;
    }
  }

  /**
   * Transform taxon to our format
   */
  private transformTaxon(taxon: INatTaxon): INaturalistSearchResult {
    const content = taxon.wikipedia_summary || 
      `${taxon.preferred_common_name || taxon.name} is a ${taxon.rank}. ` +
      `${taxon.observations_count.toLocaleString()} observations recorded.` +
      (taxon.conservation_status?.status_name 
        ? ` Conservation status: ${taxon.conservation_status.status_name}.`
        : '');

    return {
      url: `https://www.inaturalist.org/taxa/${taxon.id}`,
      title: taxon.preferred_common_name 
        ? `${taxon.preferred_common_name} (${taxon.name})`
        : taxon.name,
      content,
      scientificName: taxon.name,
      commonName: taxon.preferred_common_name,
      taxonRank: taxon.rank,
      observationsCount: taxon.observations_count,
      imageUrl: taxon.default_photo?.medium_url || taxon.default_photo?.square_url,
      wikipediaSummary: taxon.wikipedia_summary,
      conservationStatus: taxon.conservation_status?.status_name,
      ancestors: taxon.ancestors?.map(a => `${a.rank}: ${a.name}`),
      taxonId: taxon.id,
    };
  }

  /**
   * Transform observation to our format
   */
  private transformObservation(obs: INatObservation): INaturalistObservation {
    return {
      url: obs.uri,
      species: obs.taxon?.preferred_common_name || obs.taxon?.name || 'Unknown',
      location: obs.place_guess || 'Unknown location',
      observedOn: obs.observed_on_string || 'Unknown date',
      imageUrl: obs.photos?.[0]?.url?.replace('square', 'medium'),
      quality: obs.quality_grade,
      userId: obs.user.id,
      userName: obs.user.login,
    };
  }

  /**
   * Simple rate limiting
   */
  private lastRequest = 0;
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequest;
    if (elapsed < this.requestDelay) {
      await new Promise(resolve => setTimeout(resolve, this.requestDelay - elapsed));
    }
    this.lastRequest = Date.now();
  }
}


