/**
 * GBIF (Global Biodiversity Information Facility) API Client
 * 
 * REFACTORED: Extended BaseProviderClient for shared functionality.
 * Reduced from ~450 lines to ~380 lines by using base class utilities.
 * 
 * GBIF is an international network and data infrastructure providing 
 * open access to biodiversity data from around the world.
 * 
 * 100% FREE with no API key required.
 * 
 * Coverage: 2.3+ billion species occurrence records, 400k+ datasets
 * Rate Limit: No strict limit (be respectful)
 * 
 * @see https://www.gbif.org/developer/summary
 */

import { Source } from '../types';
import { BaseProviderClient, BaseSearchResult, BaseSearchResponse } from './base-client';
import { loggers } from '../utils/logger';

const log = loggers.provider;

// =============================================================================
// Types
// =============================================================================

export interface GbifSpecies {
  key: number;
  scientificName: string;
  canonicalName: string;
  vernacularName?: string;
  rank: string;
  kingdom?: string;
  phylum?: string;
  class?: string;
  order?: string;
  family?: string;
  genus?: string;
  species?: string;
  taxonomicStatus: string;
  numDescendants?: number;
  numOccurrences?: number;
}

export interface GbifOccurrence {
  key: number;
  scientificName: string;
  decimalLatitude?: number;
  decimalLongitude?: number;
  country?: string;
  countryCode?: string;
  locality?: string;
  eventDate?: string;
  year?: number;
  month?: number;
  day?: number;
  basisOfRecord: string;
  institutionCode?: string;
  collectionCode?: string;
  catalogNumber?: string;
  recordedBy?: string;
  media?: Array<{
    type: string;
    format?: string;
    identifier: string;
  }>;
}

export interface GbifVernacularName {
  vernacularName: string;
  language: string;
  source?: string;
  country?: string;
}

export interface GbifSearchResult extends BaseSearchResult {
  url: string;
  title: string;
  content: string;
  scientificName: string;
  commonName?: string;
  taxonomy?: string;
  occurrenceCount?: number;
  imageUrl?: string;
}

export interface GbifSearchResponse extends BaseSearchResponse<GbifSearchResult> {
  results: GbifSearchResult[];
  total: number;
  offset: number;
}

// =============================================================================
// Constants
// =============================================================================

const GBIF_API_BASE = 'https://api.gbif.org/v1';

// =============================================================================
// Client Implementation
// =============================================================================

export class GbifClient extends BaseProviderClient<GbifSearchResult> {
  constructor() {
    super('gbif', {
      rateLimitMs: 100, // Be respectful
      maxResults: 20,
      timeoutMs: 30000,
    });
  }

  // ===========================================================================
  // Required Abstract Methods
  // ===========================================================================

  protected async executeSearch(query: string, limit: number): Promise<GbifSearchResponse> {
    const params = new URLSearchParams({
      q: query,
      limit: String(limit),
      offset: '0',
    });

    const response = await fetch(`${GBIF_API_BASE}/species/search?${params}`, {
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`GBIF API error: ${response.status}`);
    }

    const data = await response.json();

    const results: GbifSearchResult[] = await Promise.all(
      (data.results || []).map(async (species: GbifSpecies) => {
        let commonName: string | undefined;
        try {
          const vernaculars = await this.getVernacularNames(species.key);
          const englishName = vernaculars.find(v => v.language === 'eng' || v.language === 'en');
          commonName = englishName?.vernacularName || vernaculars[0]?.vernacularName;
        } catch {
          // Ignore errors
        }

        const taxonomyParts = [
          species.kingdom, species.phylum, species.class,
          species.order, species.family, species.genus,
        ].filter(Boolean);

        const taxonomy = taxonomyParts.length > 0 ? taxonomyParts.join(' > ') : undefined;

        const contentParts: string[] = [];
        if (species.vernacularName || commonName) {
          contentParts.push(`Common name: ${species.vernacularName || commonName}`);
        }
        if (taxonomy) contentParts.push(`Taxonomy: ${taxonomy}`);
        contentParts.push(`Rank: ${species.rank}`);
        contentParts.push(`Status: ${species.taxonomicStatus}`);
        if (species.numOccurrences) {
          contentParts.push(`Occurrences: ${species.numOccurrences.toLocaleString()}`);
        }

        return {
          url: `https://www.gbif.org/species/${species.key}`,
          title: commonName 
            ? `${commonName} (${species.scientificName})` 
            : species.scientificName,
          content: contentParts.join('\n'),
          scientificName: species.scientificName,
          commonName: commonName || species.vernacularName,
          taxonomy,
          occurrenceCount: species.numOccurrences,
        };
      })
    );

    return {
      results,
      total: data.count || 0,
      offset: data.offset || 0,
    };
  }

  protected transformResult(result: GbifSearchResult): Source {
    return {
      url: result.url,
      title: result.title,
      content: result.content,
      quality: 0.75,
      summary: this.truncate(result.content, 200),
    };
  }

  // ===========================================================================
  // Public API - Extended Methods
  // ===========================================================================

  /**
   * Search for species with options
   */
  async searchSpecies(
    query: string,
    options?: {
      limit?: number;
      offset?: number;
      rank?: 'KINGDOM' | 'PHYLUM' | 'CLASS' | 'ORDER' | 'FAMILY' | 'GENUS' | 'SPECIES';
      status?: 'ACCEPTED' | 'SYNONYM';
      highertaxonKey?: number;
    }
  ): Promise<GbifSearchResponse> {
    await this.respectRateLimit();
    
    try {
      const params = new URLSearchParams({
        q: query,
        limit: String(options?.limit ?? 10),
        offset: String(options?.offset ?? 0),
      });

      if (options?.rank) params.set('rank', options.rank);
      if (options?.status) params.set('status', options.status);
      if (options?.highertaxonKey) params.set('highertaxonKey', String(options.highertaxonKey));

      const response = await fetch(`${GBIF_API_BASE}/species/search?${params}`, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`GBIF API error: ${response.status}`);
      }

      const data = await response.json();

      const results: GbifSearchResult[] = await Promise.all(
        (data.results || []).map(async (species: GbifSpecies) => {
          let commonName: string | undefined;
          try {
            const vernaculars = await this.getVernacularNames(species.key);
            const englishName = vernaculars.find(v => v.language === 'eng' || v.language === 'en');
            commonName = englishName?.vernacularName || vernaculars[0]?.vernacularName;
          } catch {
            // Ignore
          }

          const taxonomyParts = [
            species.kingdom, species.phylum, species.class,
            species.order, species.family, species.genus,
          ].filter(Boolean);
          const taxonomy = taxonomyParts.length > 0 ? taxonomyParts.join(' > ') : undefined;

          const contentParts: string[] = [];
          if (species.vernacularName || commonName) {
            contentParts.push(`Common name: ${species.vernacularName || commonName}`);
          }
          if (taxonomy) contentParts.push(`Taxonomy: ${taxonomy}`);
          contentParts.push(`Rank: ${species.rank}`);
          contentParts.push(`Status: ${species.taxonomicStatus}`);
          if (species.numOccurrences) {
            contentParts.push(`Occurrences: ${species.numOccurrences.toLocaleString()}`);
          }

          return {
            url: `https://www.gbif.org/species/${species.key}`,
            title: commonName 
              ? `${commonName} (${species.scientificName})` 
              : species.scientificName,
            content: contentParts.join('\n'),
            scientificName: species.scientificName,
            commonName: commonName || species.vernacularName,
            taxonomy,
            occurrenceCount: species.numOccurrences,
          };
        })
      );

      return { results, total: data.count || 0, offset: data.offset || 0 };
    } catch (error) {
      log.debug('GBIF species search error:', error);
      throw error;
    }
  }

  /**
   * Get species details by key
   */
  async getSpecies(speciesKey: number): Promise<GbifSpecies | null> {
    await this.respectRateLimit();
    
    try {
      const response = await fetch(`${GBIF_API_BASE}/species/${speciesKey}`, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`GBIF API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      log.debug('GBIF get species error:', error);
      throw error;
    }
  }

  /**
   * Get vernacular (common) names for a species
   */
  async getVernacularNames(speciesKey: number): Promise<GbifVernacularName[]> {
    try {
      const response = await fetch(
        `${GBIF_API_BASE}/species/${speciesKey}/vernacularNames`,
        { signal: AbortSignal.timeout(this.timeoutMs) }
      );
      if (!response.ok) return [];
      const data = await response.json();
      return data.results || [];
    } catch {
      return [];
    }
  }

  /**
   * Search occurrences (where species have been observed/collected)
   */
  async searchOccurrences(
    query: string,
    options?: {
      limit?: number;
      offset?: number;
      country?: string;
      hasCoordinate?: boolean;
      year?: number | string;
      basisOfRecord?: string;
      mediaType?: 'StillImage' | 'MovingImage' | 'Sound';
    }
  ): Promise<{ results: GbifOccurrence[]; total: number }> {
    await this.respectRateLimit();
    
    try {
      const params = new URLSearchParams({
        q: query,
        limit: String(options?.limit ?? 20),
        offset: String(options?.offset ?? 0),
      });

      if (options?.country) params.set('country', options.country);
      if (options?.hasCoordinate !== undefined) params.set('hasCoordinate', String(options.hasCoordinate));
      if (options?.year) params.set('year', String(options.year));
      if (options?.basisOfRecord) params.set('basisOfRecord', options.basisOfRecord);
      if (options?.mediaType) params.set('mediaType', options.mediaType);

      const response = await fetch(`${GBIF_API_BASE}/occurrence/search?${params}`, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`GBIF API error: ${response.status}`);
      }

      const data = await response.json();
      return { results: data.results || [], total: data.count || 0 };
    } catch (error) {
      log.debug('GBIF occurrence search error:', error);
      throw error;
    }
  }

  /**
   * Get species images/media
   */
  async getSpeciesMedia(
    speciesKey: number,
    options?: { limit?: number }
  ): Promise<Array<{ url: string; type: string }>> {
    try {
      const species = await this.getSpecies(speciesKey);
      if (!species) return [];

      const withMedia = await this.searchOccurrences(species.scientificName, {
        limit: options?.limit ?? 10,
        mediaType: 'StillImage',
      });

      const media: Array<{ url: string; type: string }> = [];
      for (const occurrence of withMedia.results) {
        if (occurrence.media) {
          for (const m of occurrence.media) {
            if (m.identifier) {
              media.push({ url: m.identifier, type: m.type || 'StillImage' });
            }
          }
        }
      }

      return media.slice(0, options?.limit ?? 10);
    } catch (error) {
      log.debug('GBIF get media error:', error);
      return [];
    }
  }

  // Convenience methods for specific taxa
  async searchAnimals(query: string, options?: { limit?: number }): Promise<GbifSearchResponse> {
    return this.searchSpecies(query, { limit: options?.limit ?? 10, highertaxonKey: 1 });
  }

  async searchPlants(query: string, options?: { limit?: number }): Promise<GbifSearchResponse> {
    return this.searchSpecies(query, { limit: options?.limit ?? 10, highertaxonKey: 6 });
  }

  async searchBirds(query: string, options?: { limit?: number }): Promise<GbifSearchResponse> {
    return this.searchSpecies(query, { limit: options?.limit ?? 10, highertaxonKey: 212 });
  }

  async searchInsects(query: string, options?: { limit?: number }): Promise<GbifSearchResponse> {
    return this.searchSpecies(query, { limit: options?.limit ?? 10, highertaxonKey: 216 });
  }

  async searchMarineLife(query: string, options?: { limit?: number }): Promise<GbifSearchResponse> {
    return this.searchSpecies(`${query} marine OR ocean OR sea`, { limit: options?.limit ?? 10 });
  }

  async getCountryStats(countryCode: string): Promise<{ occurrences: number; species: number }> {
    await this.respectRateLimit();
    
    try {
      const response = await fetch(`${GBIF_API_BASE}/occurrence/count?country=${countryCode}`, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) throw new Error(`GBIF API error: ${response.status}`);
      const occurrences = await response.json();
      return { occurrences: occurrences || 0, species: 0 };
    } catch (error) {
      log.debug('GBIF country stats error:', error);
      throw error;
    }
  }

  async searchEndangeredSpecies(query: string, options?: { limit?: number }): Promise<GbifSearchResponse> {
    const enhancedQuery = `${query} (endangered OR threatened OR vulnerable OR "critically endangered")`;
    return this.searchSpecies(enhancedQuery, { limit: options?.limit ?? 10 });
  }
}
