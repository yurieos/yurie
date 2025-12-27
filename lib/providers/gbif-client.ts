/**
 * GBIF (Global Biodiversity Information Facility) API Client
 * 
 * GBIF is an international network and data infrastructure providing 
 * open access to biodiversity data from around the world.
 * 
 * 100% FREE with no API key required.
 * 
 * Coverage: 2.3+ billion species occurrence records, 400k+ datasets
 * Rate Limit: No strict limit (be respectful)
 * 
 * Perfect for: Biodiversity research, species identification, nature,
 * animal research, ecological studies, conservation
 * 
 * @see https://www.gbif.org/developer/summary
 */

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

export interface GbifSearchResult {
  url: string;
  title: string;
  content: string;
  scientificName: string;
  commonName?: string;
  taxonomy?: string;
  occurrenceCount?: number;
  imageUrl?: string;
}

export interface GbifSearchResponse {
  results: GbifSearchResult[];
  total: number;
  offset: number;
}

const GBIF_API_BASE = 'https://api.gbif.org/v1';

export class GbifClient {
  /**
   * Search for species
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
    try {
      const params = new URLSearchParams({
        q: query,
        limit: String(options?.limit ?? 10),
        offset: String(options?.offset ?? 0),
      });

      if (options?.rank) {
        params.set('rank', options.rank);
      }
      if (options?.status) {
        params.set('status', options.status);
      }
      if (options?.highertaxonKey) {
        params.set('highertaxonKey', String(options.highertaxonKey));
      }

      const response = await fetch(`${GBIF_API_BASE}/species/search?${params}`);

      if (!response.ok) {
        throw new Error(`GBIF API error: ${response.status}`);
      }

      const data = await response.json();

      const results: GbifSearchResult[] = await Promise.all(
        (data.results || []).map(async (species: GbifSpecies) => {
          // Try to get vernacular names
          let commonName: string | undefined;
          try {
            const vernaculars = await this.getVernacularNames(species.key);
            const englishName = vernaculars.find(v => v.language === 'eng' || v.language === 'en');
            commonName = englishName?.vernacularName || vernaculars[0]?.vernacularName;
          } catch {
            // Ignore errors fetching vernacular names
          }

          // Build taxonomy string
          const taxonomyParts = [
            species.kingdom,
            species.phylum,
            species.class,
            species.order,
            species.family,
            species.genus,
          ].filter(Boolean);

          const taxonomy = taxonomyParts.length > 0 
            ? taxonomyParts.join(' > ') 
            : undefined;

          // Build content
          const contentParts: string[] = [];
          
          if (species.vernacularName || commonName) {
            contentParts.push(`Common name: ${species.vernacularName || commonName}`);
          }
          
          if (taxonomy) {
            contentParts.push(`Taxonomy: ${taxonomy}`);
          }
          
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
    } catch (error) {
      console.error('GBIF species search error:', error);
      throw error;
    }
  }

  /**
   * Get species details by key
   */
  async getSpecies(speciesKey: number): Promise<GbifSpecies | null> {
    try {
      const response = await fetch(`${GBIF_API_BASE}/species/${speciesKey}`);

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`GBIF API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('GBIF get species error:', error);
      throw error;
    }
  }

  /**
   * Get vernacular (common) names for a species
   */
  async getVernacularNames(speciesKey: number): Promise<GbifVernacularName[]> {
    try {
      const response = await fetch(
        `${GBIF_API_BASE}/species/${speciesKey}/vernacularNames`
      );

      if (!response.ok) {
        return [];
      }

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
      hasGeospatialIssue?: boolean;
      year?: number | string; // Can be range like "2020,2024"
      basisOfRecord?: 'OBSERVATION' | 'HUMAN_OBSERVATION' | 'MACHINE_OBSERVATION' | 
                      'MATERIAL_SAMPLE' | 'PRESERVED_SPECIMEN' | 'LIVING_SPECIMEN' |
                      'FOSSIL_SPECIMEN' | 'OCCURRENCE';
      mediaType?: 'StillImage' | 'MovingImage' | 'Sound';
    }
  ): Promise<{ results: GbifOccurrence[]; total: number }> {
    try {
      const params = new URLSearchParams({
        q: query,
        limit: String(options?.limit ?? 20),
        offset: String(options?.offset ?? 0),
      });

      if (options?.country) {
        params.set('country', options.country);
      }
      if (options?.hasCoordinate !== undefined) {
        params.set('hasCoordinate', String(options.hasCoordinate));
      }
      if (options?.year) {
        params.set('year', String(options.year));
      }
      if (options?.basisOfRecord) {
        params.set('basisOfRecord', options.basisOfRecord);
      }
      if (options?.mediaType) {
        params.set('mediaType', options.mediaType);
      }

      const response = await fetch(`${GBIF_API_BASE}/occurrence/search?${params}`);

      if (!response.ok) {
        throw new Error(`GBIF API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        results: data.results || [],
        total: data.count || 0,
      };
    } catch (error) {
      console.error('GBIF occurrence search error:', error);
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
      const occurrences = await this.searchOccurrences('', {
        limit: 50,
      });

      // The occurrence search doesn't directly support taxonKey as a simple param
      // Let's search with the species name instead
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
              media.push({
                url: m.identifier,
                type: m.type || 'StillImage',
              });
            }
          }
        }
      }

      return media.slice(0, options?.limit ?? 10);
    } catch (error) {
      console.error('GBIF get media error:', error);
      return [];
    }
  }

  /**
   * Search for animals
   */
  async searchAnimals(
    query: string,
    options?: { limit?: number }
  ): Promise<GbifSearchResponse> {
    // Animals are in the Animalia kingdom (key: 1)
    return this.searchSpecies(query, {
      limit: options?.limit ?? 10,
      highertaxonKey: 1, // Animalia
    });
  }

  /**
   * Search for plants
   */
  async searchPlants(
    query: string,
    options?: { limit?: number }
  ): Promise<GbifSearchResponse> {
    // Plants are in the Plantae kingdom (key: 6)
    return this.searchSpecies(query, {
      limit: options?.limit ?? 10,
      highertaxonKey: 6, // Plantae
    });
  }

  /**
   * Search for birds
   */
  async searchBirds(
    query: string,
    options?: { limit?: number }
  ): Promise<GbifSearchResponse> {
    // Birds are class Aves (key: 212)
    return this.searchSpecies(query, {
      limit: options?.limit ?? 10,
      highertaxonKey: 212, // Aves
    });
  }

  /**
   * Search for insects
   */
  async searchInsects(
    query: string,
    options?: { limit?: number }
  ): Promise<GbifSearchResponse> {
    // Insects are class Insecta (key: 216)
    return this.searchSpecies(query, {
      limit: options?.limit ?? 10,
      highertaxonKey: 216, // Insecta
    });
  }

  /**
   * Search for marine life
   */
  async searchMarineLife(
    query: string,
    options?: { limit?: number }
  ): Promise<GbifSearchResponse> {
    // Search in multiple marine taxa
    const results = await this.searchSpecies(`${query} marine OR ocean OR sea`, {
      limit: options?.limit ?? 10,
    });
    return results;
  }

  /**
   * Get occurrence statistics by country
   */
  async getCountryStats(countryCode: string): Promise<{
    occurrences: number;
    species: number;
  }> {
    try {
      const response = await fetch(
        `${GBIF_API_BASE}/occurrence/count?country=${countryCode}`
      );

      if (!response.ok) {
        throw new Error(`GBIF API error: ${response.status}`);
      }

      const occurrences = await response.json();

      return {
        occurrences: occurrences || 0,
        species: 0, // Would need additional query
      };
    } catch (error) {
      console.error('GBIF country stats error:', error);
      throw error;
    }
  }

  /**
   * Get endangered species (IUCN Red List threatened categories)
   */
  async searchEndangeredSpecies(
    query: string,
    options?: { limit?: number }
  ): Promise<GbifSearchResponse> {
    // This is a simplified search - for full IUCN data, use IUCN API
    const enhancedQuery = `${query} (endangered OR threatened OR vulnerable OR "critically endangered")`;
    return this.searchSpecies(enhancedQuery, {
      limit: options?.limit ?? 10,
    });
  }
}

