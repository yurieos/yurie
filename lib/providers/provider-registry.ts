/**
 * Provider Registry
 * 
 * REFACTORED: Now uses dynamic imports for lazy loading.
 * - Lazy client initialization (clients are created on first use)
 * - Dynamic imports (modules are loaded on first use)
 * - Declarative pattern for clean configuration
 * 
 * This reduces the initial bundle size significantly as provider
 * modules are only loaded when actually needed.
 */

import { Source } from '../types';
import { SEARCH_CONFIG } from '../config';
import { QueryClassification, SearchProvider } from './search-router';
import {
  createProviderRegistry,
  ProviderRegistry,
  UnifiedSearchResult,
} from './provider-factory';
import { 
  PROVIDER_DEFINITIONS, 
  type ProviderDefinition 
} from './provider-definitions';
import { loggers } from '../utils/logger';

const log = loggers.provider;

// =============================================================================
// Dynamic Import Map
// =============================================================================

type ClientImporter = () => Promise<unknown>;

/**
 * Dynamic import map - modules are only loaded when first accessed
 */
const DYNAMIC_IMPORTS: Record<string, ClientImporter> = {
  wikipedia: async () => (await import('./wikipedia-client')).WikipediaClient,
  wikidata: async () => (await import('./wikipedia-client')).WikidataSPARQLClient,
  arxiv: async () => (await import('./arxiv-client')).ArxivClient,
  pubmed: async () => (await import('./pubmed-client')).PubMedClient,
  openalex: async () => (await import('./openalex-client')).OpenAlexClient,
  nasa: async () => (await import('./nasa-client')).NasaClient,
  gbif: async () => (await import('./gbif-client')).GbifClient,
  crossref: async () => (await import('./crossref-client')).CrossrefClient,
  core: async () => (await import('./core-client')).CoreClient,
  clinicaltrials: async () => (await import('./clinicaltrials-client')).ClinicalTrialsClient,
  openfda: async () => (await import('./openfda-client')).OpenFDAClient,
  usgs: async () => (await import('./usgs-client')).USGSClient,
  inaturalist: async () => (await import('./inaturalist-client')).INaturalistClient,
  courtlistener: async () => (await import('./courtlistener-client')).CourtListenerClient,
  fred: async () => (await import('./fred-client')).FREDClient,
  worldbank: async () => (await import('./worldbank-client')).WorldBankClient,
  europeana: async () => (await import('./europeana-client')).EuropeanaClient,
  pubchem: async () => (await import('./pubchem-client')).PubChemClient,
  loc: async () => (await import('./loc-client')).LibraryOfCongressClient,
  internetarchive: async () => (await import('./internet-archive-client')).InternetArchiveClient,
  pas: async () => (await import('./pas-client')).PASClient,
  pleiades: async () => (await import('./pleiades-client')).PleiadesClient,
  shipwrecks: async () => (await import('./noaa-shipwrecks-client')).NOAAShipwrecksClient,
  nominatim: async () => (await import('./nominatim-client')).NominatimClient,
  wolframalpha: async () => (await import('./wolfram-alpha-client')).WolframAlphaClient,
  tavily: async () => (await import('./tavily-client')).TavilyClient,
  exa: async () => (await import('./exa-client')).ExaClient,
  semanticscholar: async () => (await import('./semantic-scholar-client')).SemanticScholarClient,
};

// =============================================================================
// Lazy Client Cache
// =============================================================================

type ClientConstructor = new (...args: unknown[]) => unknown;

const clientCache: Record<string, unknown> = {};
const constructorCache: Record<string, ClientConstructor> = {};

/**
 * Get or create a client instance (lazy initialization with dynamic imports)
 */
async function getClient<T>(key: string): Promise<T | null> {
  // Return cached instance if available
  if (clientCache[key]) {
    return clientCache[key] as T;
  }

  const importer = DYNAMIC_IMPORTS[key];
  if (!importer) {
    log.debug(`No dynamic import found for client: ${key}`);
    return null;
  }

  try {
    // Load constructor if not cached
    if (!constructorCache[key]) {
      constructorCache[key] = await importer() as ClientConstructor;
    }
    
    // Create and cache instance
    const ClientClass = constructorCache[key];
    clientCache[key] = new ClientClass();
    return clientCache[key] as T;
  } catch (error) {
    log.debug(`Failed to initialize client ${key}:`, error);
    return null;
  }
}

// =============================================================================
// Search Method Executor
// =============================================================================

interface SearchResult {
  url: string;
  title: string;
  content?: string;
  label?: string;
  description?: string;
}

interface SearchResponse {
  results: SearchResult[];
  total?: number;
  events?: SearchResult[];
  births?: SearchResult[];
  deaths?: SearchResult[];
}

/**
 * Execute search on a client based on provider definition
 */
async function executeClientSearch(
  def: ProviderDefinition,
  query: string,
  limit: number
): Promise<{ results: SearchResult[]; total: number }> {
  const client = await getClient<Record<string, (...args: unknown[]) => Promise<unknown>>>(def.clientKey);
  if (!client) {
    log.debug(`[${def.name}] Client not available for ${def.clientKey}`);
    return { results: [], total: 0 };
  }

  // Check if provider requires API key and if available
  if (def.requiresApiKey) {
    const hasKey = !!process.env[def.requiresApiKey];
    if (!hasKey) {
      log.debug(`[${def.name}] Missing API key: ${def.requiresApiKey}`);
      return { results: [], total: 0 };
    }
    // Check isAvailable method for clients that have it
    if ('isAvailable' in client && typeof client.isAvailable === 'function') {
      if (!client.isAvailable()) {
        log.debug(`[${def.name}] Client reports not available`);
        return { results: [], total: 0 };
      }
    }
  }

  const method = client[def.searchMethod];
  if (typeof method !== 'function') {
    log.warn(`[${def.name}] Method ${def.searchMethod} not found on client ${def.clientKey}`);
    return { results: [], total: 0 };
  }

  try {
    let response: SearchResponse;

    // Handle different argument patterns
    switch (def.argsTransformer) {
      case 'searchWithContent':
        // Wikipedia: returns array directly
        const wikiResults = await method.call(client, query, { limit });
        return { 
          results: Array.isArray(wikiResults) ? wikiResults : [], 
          total: Array.isArray(wikiResults) ? wikiResults.length : 0 
        };

      case 'searchTreasureHoards':
        // Wikidata: special method
        response = await method.call(client, limit) as SearchResponse;
        return { 
          results: (response.results || []).map((r: SearchResult) => ({
            url: r.url,
            title: r.label || r.title || '',
            content: r.description || r.content || '',
          })),
          total: response.total || 0 
        };

      case 'searchWorks':
      case 'searchSpecies':
      case 'searchPapers':
      case 'withOptions':
      default:
        // Standard pattern: (query, { limit }) => { results, total }
        response = await method.call(client, query, { limit }) as SearchResponse;
        return { 
          results: response.results || [], 
          total: response.total || (response.results?.length || 0) 
        };
    }
  } catch (error) {
    log.debug(`[${def.name}] Search error for query "${query}":`, error);
    throw error; // Re-throw so retry/circuit-breaker can handle it
  }
}

// =============================================================================
// Provider Registration
// =============================================================================

/**
 * Register a provider from its definition
 */
function registerFromDefinition(
  registry: ProviderRegistry,
  def: ProviderDefinition
): void {
  const quality = def.quality;

  registry.register({
    provider: def.name,
    searchFn: async (query: string, limit: number) => {
      const { results, total } = await executeClientSearch(def, query, limit);
      return {
        results: results.map(r => ({
          url: r.url,
          title: r.title,
          content: r.content || '',
        })),
        total,
      };
    },
    transformer: (r) => ({
      url: r.url,
      title: r.title,
      content: r.content || '',
      quality,
    }),
    defaultQuality: quality,
  });
}

// =============================================================================
// Global Registry Instance
// =============================================================================

let registryInstance: ProviderRegistry | null = null;

/**
 * Get or create the global provider registry
 */
export function getProviderRegistry(): ProviderRegistry {
  if (registryInstance) {
    return registryInstance;
  }

  registryInstance = createProviderRegistry();

  // Auto-register all providers from definitions
  for (const def of PROVIDER_DEFINITIONS) {
    try {
      registerFromDefinition(registryInstance, def);
    } catch (error) {
      log.debug(`Failed to register provider ${def.name}:`, error);
    }
  }

  // Log summary
  const availableCount = PROVIDER_DEFINITIONS.filter(
    d => !d.requiresApiKey || !!process.env[d.requiresApiKey!]
  ).length;
  log.info(`Provider registry initialized: ${availableCount}/${PROVIDER_DEFINITIONS.length} providers available`);

  return registryInstance;
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Execute a search using the provider registry
 */
export async function executeProviderSearch(
  provider: SearchProvider,
  query: string,
  classification: QueryClassification,
  maxResults?: number
): Promise<UnifiedSearchResult> {
  const registry = getProviderRegistry();
  return registry.execute(
    provider,
    query,
    classification,
    maxResults ?? SEARCH_CONFIG.MAX_SOURCES_PER_SEARCH
  );
}

/**
 * Check if a provider is available
 */
export function isProviderAvailable(provider: SearchProvider): boolean {
  const def = PROVIDER_DEFINITIONS.find(d => d.name === provider);
  if (!def) {
    // Firecrawl is always available (special case)
    return provider === 'firecrawl';
  }
  
  if (def.requiresApiKey) {
    return !!process.env[def.requiresApiKey];
  }
  
  return true;
}

/**
 * Get a list of all available providers
 */
export function getAvailableProviders(): SearchProvider[] {
  const available: SearchProvider[] = [];
  
  for (const def of PROVIDER_DEFINITIONS) {
    if (!def.requiresApiKey || !!process.env[def.requiresApiKey!]) {
      available.push(def.name);
    }
  }
  
  // Always include firecrawl
  if (!available.includes('firecrawl')) {
    available.push('firecrawl');
  }
  
  return available;
}

/**
 * Preload specific providers (useful for critical paths)
 */
export async function preloadProviders(providers: string[]): Promise<void> {
  await Promise.all(
    providers.map(async (provider) => {
      const def = PROVIDER_DEFINITIONS.find(d => d.name === provider);
      if (def) {
        await getClient(def.clientKey);
      }
    })
  );
}

/**
 * Reset the registry (useful for testing)
 */
export function resetProviderRegistry(): void {
  registryInstance = null;
  // Clear cached clients
  Object.keys(clientCache).forEach(key => delete clientCache[key]);
  Object.keys(constructorCache).forEach(key => delete constructorCache[key]);
}
