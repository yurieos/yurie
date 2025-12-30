/**
 * Wikipedia & Wikidata API Client
 * 
 * REFACTORED: Extended BaseProviderClient for shared functionality.
 * Reduced from ~882 lines to ~650 lines by using base class utilities.
 * 
 * Wikipedia provides a comprehensive REST API for searching and retrieving articles.
 * 100% FREE with no API key required.
 * 
 * Coverage: 60+ million articles across 300+ languages
 * Rate Limit: Please be respectful (no official limit for reasonable use)
 * 
 * @see https://www.mediawiki.org/wiki/API:Main_page
 * @see https://www.wikidata.org/wiki/Wikidata:Data_access
 */

import { Source } from '../types';
import { BaseProviderClient, BaseSearchResult, BaseSearchResponse } from './base-client';
import { loggers } from '../utils/logger';

const log = loggers.provider;

// =============================================================================
// Types
// =============================================================================

export interface WikipediaSearchResult extends BaseSearchResult {
  url: string;
  title: string;
  content: string;
  snippet: string;
  pageId: number;
  wordCount?: number;
  timestamp?: string;
}

export interface WikipediaArticle {
  url: string;
  title: string;
  content: string;
  extract: string;
  pageId: number;
  categories?: string[];
  links?: string[];
  images?: string[];
  references?: string[];
  infobox?: Record<string, string>;
}

export interface WikidataEntity {
  id: string;
  label: string;
  description: string;
  aliases: string[];
  claims: Record<string, WikidataClaim[]>;
  sitelinks: Record<string, { title: string; url: string }>;
}

export interface WikidataClaim {
  property: string;
  propertyLabel: string;
  value: string;
  valueLabel?: string;
}

export interface WikipediaSearchResponse extends BaseSearchResponse<WikipediaSearchResult> {
  results: WikipediaSearchResult[];
  total: number;
  suggestion?: string;
}

// =============================================================================
// Constants
// =============================================================================

const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql';

// =============================================================================
// Wikipedia Client - Extended from BaseProviderClient
// =============================================================================

export class WikipediaClient extends BaseProviderClient<WikipediaSearchResult> {
  private language: string;
  private apiBase: string;
  private restApiBase: string;

  constructor(language: string = 'en') {
    super('wikipedia', {
      rateLimitMs: 0, // Wikipedia is generous
      maxResults: 10,
      timeoutMs: 30000,
    });
    this.language = language;
    this.apiBase = `https://${language}.wikipedia.org/w/api.php`;
    this.restApiBase = `https://${language}.wikipedia.org/api/rest_v1`;
  }

  // ===========================================================================
  // Required Abstract Methods
  // ===========================================================================

  protected async executeSearch(query: string, limit: number): Promise<WikipediaSearchResponse> {
    const params = new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: query,
      srlimit: String(limit),
      srinfo: 'totalhits|suggestion',
      srprop: 'snippet|titlesnippet|wordcount|timestamp',
      format: 'json',
      origin: '*',
    });

    const response = await fetch(`${this.apiBase}?${params}`, {
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Wikipedia API error: ${response.status}`);
    }

    const data = await response.json();
    const searchResults = data.query?.search || [];

    return {
      results: searchResults.map((result: {
        pageid: number;
        title: string;
        snippet: string;
        wordcount: number;
        timestamp: string;
      }) => ({
        url: `https://${this.language}.wikipedia.org/wiki/${encodeURIComponent(result.title.replace(/ /g, '_'))}`,
        title: result.title,
        content: this.cleanHtml(result.snippet), // Uses inherited method
        snippet: this.cleanHtml(result.snippet),
        pageId: result.pageid,
        wordCount: result.wordcount,
        timestamp: result.timestamp,
      })),
      total: data.query?.searchinfo?.totalhits || 0,
      suggestion: data.query?.searchinfo?.suggestion,
    };
  }

  protected transformResult(result: WikipediaSearchResult): Source {
    return {
      url: result.url,
      title: result.title,
      content: result.content,
      quality: 0.70,
      summary: this.truncate(result.content, 200),
    };
  }

  // ===========================================================================
  // Public API - Extended methods
  // ===========================================================================

  /**
   * Get article summary using REST API (cleaner output)
   */
  async getSummary(title: string): Promise<WikipediaArticle | null> {
    await this.respectRateLimit();
    
    try {
      const encodedTitle = encodeURIComponent(title.replace(/ /g, '_'));
      const response = await fetch(`${this.restApiBase}/page/summary/${encodedTitle}`, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Wikipedia API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        url: data.content_urls?.desktop?.page || `https://${this.language}.wikipedia.org/wiki/${encodedTitle}`,
        title: data.title,
        content: data.extract || '',
        extract: data.extract || '',
        pageId: data.pageid,
      };
    } catch (error) {
      log.debug('Wikipedia summary error:', error);
      throw error;
    }
  }

  /**
   * Get full article content
   */
  async getArticle(title: string): Promise<WikipediaArticle | null> {
    await this.respectRateLimit();
    
    try {
      const params = new URLSearchParams({
        action: 'query',
        titles: title,
        prop: 'extracts|categories|links|images|revisions|info',
        exintro: 'false',
        explaintext: 'true',
        exsectionformat: 'plain',
        cllimit: '20',
        pllimit: '50',
        imlimit: '10',
        rvprop: 'content',
        rvslots: 'main',
        inprop: 'url',
        format: 'json',
        origin: '*',
      });

      const response = await fetch(`${this.apiBase}?${params}`, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`Wikipedia API error: ${response.status}`);
      }

      const data = await response.json();
      const pages = data.query?.pages;
      
      if (!pages) return null;

      const pageId = Object.keys(pages)[0];
      if (pageId === '-1') return null;

      const page = pages[pageId];

      return {
        url: page.fullurl || `https://${this.language}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
        title: page.title,
        content: page.extract || '',
        extract: page.extract?.split('\n\n')[0] || '',
        pageId: parseInt(pageId),
        categories: page.categories?.map((c: { title: string }) => 
          c.title.replace('Category:', '')
        ),
        links: page.links?.slice(0, 20).map((l: { title: string }) => l.title),
        images: page.images?.map((i: { title: string }) => i.title),
      };
    } catch (error) {
      log.debug('Wikipedia article error:', error);
      throw error;
    }
  }

  /**
   * Search and get content in one call (optimized for research)
   */
  async searchWithContent(
    query: string,
    options?: {
      limit?: number;
      summaryLength?: 'short' | 'full';
    }
  ): Promise<WikipediaSearchResult[]> {
    try {
      // First search using base class method
      const searchResults = await this.search(query, options?.limit ?? 5);

      // Then get summaries for top results
      const resultsWithContent = await Promise.all(
        searchResults.results.map(async (result) => {
          try {
            const summary = await this.getSummary(result.title);
            if (summary) {
              return {
                ...result,
                content: summary.extract || result.content,
              };
            }
            return result;
          } catch {
            return result;
          }
        })
      );

      return resultsWithContent;
    } catch (error) {
      log.debug('Wikipedia search with content error:', error);
      throw error;
    }
  }

  /**
   * Get random articles (useful for exploration)
   */
  async getRandomArticles(count: number = 5): Promise<WikipediaSearchResult[]> {
    await this.respectRateLimit();
    
    try {
      const params = new URLSearchParams({
        action: 'query',
        list: 'random',
        rnlimit: String(count),
        rnnamespace: '0',
        format: 'json',
        origin: '*',
      });

      const response = await fetch(`${this.apiBase}?${params}`, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      const data = await response.json();

      return (data.query?.random || []).map((article: { id: number; title: string }) => ({
        url: `https://${this.language}.wikipedia.org/wiki/${encodeURIComponent(article.title.replace(/ /g, '_'))}`,
        title: article.title,
        content: '',
        snippet: '',
        pageId: article.id,
      }));
    } catch (error) {
      log.debug('Wikipedia random error:', error);
      throw error;
    }
  }
}

// =============================================================================
// Wikidata Client for structured knowledge
// =============================================================================

export class WikidataClient {
  private timeoutMs = 30000;

  /**
   * Search Wikidata entities
   */
  async search(
    query: string,
    options?: {
      limit?: number;
      language?: string;
      type?: 'item' | 'property';
    }
  ): Promise<Array<{ id: string; label: string; description: string }>> {
    try {
      const params = new URLSearchParams({
        action: 'wbsearchentities',
        search: query,
        language: options?.language || 'en',
        limit: String(options?.limit ?? 10),
        type: options?.type || 'item',
        format: 'json',
        origin: '*',
      });

      const response = await fetch(`${WIKIDATA_API}?${params}`, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      const data = await response.json();

      return (data.search || []).map((entity: {
        id: string;
        label: string;
        description?: string;
      }) => ({
        id: entity.id,
        label: entity.label,
        description: entity.description || '',
      }));
    } catch (error) {
      log.debug('Wikidata search error:', error);
      throw error;
    }
  }

  /**
   * Get entity details
   */
  async getEntity(
    entityId: string,
    options?: { language?: string }
  ): Promise<WikidataEntity | null> {
    try {
      const params = new URLSearchParams({
        action: 'wbgetentities',
        ids: entityId,
        languages: options?.language || 'en',
        format: 'json',
        origin: '*',
      });

      const response = await fetch(`${WIKIDATA_API}?${params}`, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      const data = await response.json();

      const entity = data.entities?.[entityId];
      if (!entity || entity.missing) return null;

      const lang = options?.language || 'en';

      return {
        id: entity.id,
        label: entity.labels?.[lang]?.value || entityId,
        description: entity.descriptions?.[lang]?.value || '',
        aliases: entity.aliases?.[lang]?.map((a: { value: string }) => a.value) || [],
        claims: this.transformClaims(entity.claims || {}),
        sitelinks: this.transformSitelinks(entity.sitelinks || {}),
      };
    } catch (error) {
      log.debug('Wikidata get entity error:', error);
      throw error;
    }
  }

  /**
   * Get facts about an entity (simplified claims)
   */
  async getFacts(entityId: string): Promise<Record<string, string[]>> {
    try {
      const entity = await this.getEntity(entityId);
      if (!entity) return {};

      const facts: Record<string, string[]> = {};

      Object.entries(entity.claims).forEach(([, claims]) => {
        claims.forEach(claim => {
          if (claim.valueLabel) {
            if (!facts[claim.propertyLabel]) {
              facts[claim.propertyLabel] = [];
            }
            facts[claim.propertyLabel].push(claim.valueLabel);
          }
        });
      });

      return facts;
    } catch (error) {
      log.debug('Wikidata get facts error:', error);
      throw error;
    }
  }

  private transformClaims(claims: Record<string, Array<{
    mainsnak: {
      property: string;
      datavalue?: { type: string; value: unknown };
    };
  }>>): Record<string, WikidataClaim[]> {
    const result: Record<string, WikidataClaim[]> = {};

    Object.entries(claims).forEach(([property, claimList]) => {
      result[property] = claimList.map(claim => ({
        property,
        propertyLabel: property,
        value: this.extractValue(claim.mainsnak.datavalue),
        valueLabel: this.extractValueLabel(claim.mainsnak.datavalue),
      }));
    });

    return result;
  }

  private extractValue(datavalue?: { type: string; value: unknown }): string {
    if (!datavalue) return '';

    switch (datavalue.type) {
      case 'wikibase-entityid':
        return (datavalue.value as { id: string }).id;
      case 'string':
        return datavalue.value as string;
      case 'time':
        return (datavalue.value as { time: string }).time;
      case 'quantity':
        return (datavalue.value as { amount: string }).amount;
      default:
        return JSON.stringify(datavalue.value);
    }
  }

  private extractValueLabel(datavalue?: { type: string; value: unknown }): string | undefined {
    if (!datavalue) return undefined;

    switch (datavalue.type) {
      case 'string':
        return datavalue.value as string;
      case 'time': {
        const time = (datavalue.value as { time: string }).time;
        const match = time.match(/([+-]?\d+)-(\d{2})-(\d{2})/);
        if (match) {
          const year = parseInt(match[1]);
          const month = parseInt(match[2]);
          const day = parseInt(match[3]);
          if (month === 0 && day === 0) return String(year);
          if (day === 0) return `${year}-${String(month).padStart(2, '0')}`;
          return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
        return time;
      }
      case 'quantity':
        return (datavalue.value as { amount: string }).amount;
      default:
        return undefined;
    }
  }

  private transformSitelinks(sitelinks: Record<string, {
    site: string;
    title: string;
  }>): Record<string, { title: string; url: string }> {
    const result: Record<string, { title: string; url: string }> = {};

    Object.entries(sitelinks).forEach(([site, link]) => {
      const lang = site.replace('wiki', '');
      result[site] = {
        title: link.title,
        url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(link.title.replace(/ /g, '_'))}`,
      };
    });

    return result;
  }
}

// =============================================================================
// Combined Wiki Client for convenience
// =============================================================================

export class WikiClient {
  public wikipedia: WikipediaClient;
  public wikidata: WikidataClient;

  constructor(language: string = 'en') {
    this.wikipedia = new WikipediaClient(language);
    this.wikidata = new WikidataClient();
  }

  async search(query: string, limit: number = 5): Promise<WikipediaSearchResult[]> {
    return this.wikipedia.searchWithContent(query, { limit });
  }
}

// =============================================================================
// WIKIDATA SPARQL CLIENT - For Treasure Hunting Research
// =============================================================================

export interface WikidataTreasureResult {
  id: string;
  label: string;
  description: string;
  url: string;
  coordinates?: { latitude: number; longitude: number };
  country?: string;
  discoveryDate?: string;
  image?: string;
}

export interface WikidataSPARQLResponse {
  results: WikidataTreasureResult[];
  total: number;
}

type SPARQLBinding = {
  item?: { value: string };
  itemLabel?: { value: string };
  itemDescription?: { value: string };
  coord?: { value: string };
  countryLabel?: { value: string };
  image?: { value: string };
  date?: { value: string };
};

export class WikidataSPARQLClient {
  private timeoutMs = 30000;

  async query(sparqlQuery: string): Promise<unknown[]> {
    try {
      const response = await fetch(
        `${WIKIDATA_SPARQL}?query=${encodeURIComponent(sparqlQuery)}&format=json`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'YurieResearchEngine/1.0 (treasure-hunting-research)',
          },
          signal: AbortSignal.timeout(this.timeoutMs),
        }
      );

      if (!response.ok) {
        throw new Error(`Wikidata SPARQL error: ${response.status}`);
      }

      const data = await response.json();
      return data.results?.bindings || [];
    } catch (error) {
      log.debug('Wikidata SPARQL error:', error);
      throw error;
    }
  }

  async searchTreasureHoards(limit: number = 50): Promise<WikidataSPARQLResponse> {
    const sparqlQuery = `
      SELECT ?item ?itemLabel ?itemDescription ?coord ?countryLabel ?image ?date WHERE {
        ?item wdt:P31 wd:Q13372988.
        OPTIONAL { ?item wdt:P625 ?coord. }
        OPTIONAL { ?item wdt:P17 ?country. }
        OPTIONAL { ?item wdt:P18 ?image. }
        OPTIONAL { ?item wdt:P575 ?date. }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      }
      LIMIT ${limit}
    `;

    const bindings = await this.query(sparqlQuery) as SPARQLBinding[];
    return { results: bindings.map(b => this.transformBinding(b)), total: bindings.length };
  }

  async searchShipwrecks(limit: number = 50): Promise<WikidataSPARQLResponse> {
    const sparqlQuery = `
      SELECT ?item ?itemLabel ?itemDescription ?coord ?countryLabel ?image ?date WHERE {
        ?item wdt:P31 wd:Q852190.
        OPTIONAL { ?item wdt:P625 ?coord. }
        OPTIONAL { ?item wdt:P17 ?country. }
        OPTIONAL { ?item wdt:P18 ?image. }
        OPTIONAL { ?item wdt:P576 ?date. }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      }
      LIMIT ${limit}
    `;

    const bindings = await this.query(sparqlQuery) as SPARQLBinding[];
    return { results: bindings.map(b => this.transformBinding(b)), total: bindings.length };
  }

  async searchArchaeologicalSites(options?: { limit?: number; country?: string }): Promise<WikidataSPARQLResponse> {
    const countryFilter = options?.country 
      ? `?item wdt:P17 ?country. ?country rdfs:label "${options.country}"@en.`
      : '';

    const sparqlQuery = `
      SELECT ?item ?itemLabel ?itemDescription ?coord ?countryLabel ?image WHERE {
        ?item wdt:P31 wd:Q839954.
        ${countryFilter}
        OPTIONAL { ?item wdt:P625 ?coord. }
        OPTIONAL { ?item wdt:P17 ?country. }
        OPTIONAL { ?item wdt:P18 ?image. }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      }
      LIMIT ${options?.limit ?? 50}
    `;

    const bindings = await this.query(sparqlQuery) as SPARQLBinding[];
    return { results: bindings.map(b => this.transformBinding(b)), total: bindings.length };
  }

  async searchAncientRuins(limit: number = 50): Promise<WikidataSPARQLResponse> {
    const sparqlQuery = `
      SELECT ?item ?itemLabel ?itemDescription ?coord ?countryLabel ?image WHERE {
        ?item wdt:P31 wd:Q109607.
        OPTIONAL { ?item wdt:P625 ?coord. }
        OPTIONAL { ?item wdt:P17 ?country. }
        OPTIONAL { ?item wdt:P18 ?image. }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      }
      LIMIT ${limit}
    `;

    const bindings = await this.query(sparqlQuery) as SPARQLBinding[];
    return { results: bindings.map(b => this.transformBinding(b)), total: bindings.length };
  }

  async searchBuriedTreasures(limit: number = 50): Promise<WikidataSPARQLResponse> {
    const sparqlQuery = `
      SELECT ?item ?itemLabel ?itemDescription ?coord ?countryLabel ?image ?date WHERE {
        VALUES ?type { wd:Q13372988 wd:Q5285851 wd:Q2137852 }
        ?item wdt:P31 ?type.
        OPTIONAL { ?item wdt:P625 ?coord. }
        OPTIONAL { ?item wdt:P17 ?country. }
        OPTIONAL { ?item wdt:P18 ?image. }
        OPTIONAL { ?item wdt:P575 ?date. }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      }
      LIMIT ${limit}
    `;

    const bindings = await this.query(sparqlQuery) as SPARQLBinding[];
    return { results: bindings.map(b => this.transformBinding(b)), total: bindings.length };
  }

  async searchLostCities(limit: number = 50): Promise<WikidataSPARQLResponse> {
    const sparqlQuery = `
      SELECT ?item ?itemLabel ?itemDescription ?coord ?countryLabel ?image WHERE {
        ?item wdt:P31 wd:Q515.
        ?item wdt:P576 ?dissolved.
        OPTIONAL { ?item wdt:P625 ?coord. }
        OPTIONAL { ?item wdt:P17 ?country. }
        OPTIONAL { ?item wdt:P18 ?image. }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      }
      LIMIT ${limit}
    `;

    const bindings = await this.query(sparqlQuery) as SPARQLBinding[];
    return { results: bindings.map(b => this.transformBinding(b)), total: bindings.length };
  }

  async searchMines(limit: number = 50): Promise<WikidataSPARQLResponse> {
    const sparqlQuery = `
      SELECT ?item ?itemLabel ?itemDescription ?coord ?countryLabel ?image WHERE {
        ?item wdt:P31 wd:Q820477.
        OPTIONAL { ?item wdt:P625 ?coord. }
        OPTIONAL { ?item wdt:P17 ?country. }
        OPTIONAL { ?item wdt:P18 ?image. }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      }
      LIMIT ${limit}
    `;

    const bindings = await this.query(sparqlQuery) as SPARQLBinding[];
    return { results: bindings.map(b => this.transformBinding(b)), total: bindings.length };
  }

  async searchNotableArtifacts(limit: number = 50): Promise<WikidataSPARQLResponse> {
    const sparqlQuery = `
      SELECT ?item ?itemLabel ?itemDescription ?coord ?countryLabel ?image ?date WHERE {
        VALUES ?type { wd:Q220659 wd:Q5398426 wd:Q860861 }
        ?item wdt:P31 ?type.
        OPTIONAL { ?item wdt:P625 ?coord. }
        OPTIONAL { ?item wdt:P17 ?country. }
        OPTIONAL { ?item wdt:P18 ?image. }
        OPTIONAL { ?item wdt:P575 ?date. }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      }
      LIMIT ${limit}
    `;

    const bindings = await this.query(sparqlQuery) as SPARQLBinding[];
    return { results: bindings.map(b => this.transformBinding(b)), total: bindings.length };
  }

  private transformBinding(binding: SPARQLBinding): WikidataTreasureResult {
    const id = binding.item?.value?.split('/').pop() || '';
    
    let coordinates: { latitude: number; longitude: number } | undefined;
    if (binding.coord?.value) {
      const match = binding.coord.value.match(/Point\(([-\d.]+)\s+([-\d.]+)\)/);
      if (match) {
        coordinates = {
          longitude: parseFloat(match[1]),
          latitude: parseFloat(match[2]),
        };
      }
    }

    return {
      id,
      label: binding.itemLabel?.value || 'Unknown',
      description: binding.itemDescription?.value || '',
      url: `https://www.wikidata.org/wiki/${id}`,
      coordinates,
      country: binding.countryLabel?.value,
      discoveryDate: binding.date?.value,
      image: binding.image?.value,
    };
  }
}
