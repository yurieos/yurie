/**
 * Provider Definitions
 * 
 * Declarative configuration for all search providers.
 * Replaces ~700 lines of repetitive registration code with ~100 lines of config.
 * 
 * Each provider definition specifies:
 * - name: The provider identifier
 * - clientKey: Key to access the client instance
 * - searchMethod: Method name to call on the client
 * - quality: Default quality score (0-1)
 * - requiresApiKey: Optional env var name if API key is required
 * - searchMethodArgs: Optional function to transform (query, limit) to method args
 */

import { SearchProvider } from './search-router';

// =============================================================================
// Types
// =============================================================================

export interface ProviderDefinition {
  /** Provider identifier */
  name: SearchProvider;
  /** Key to access client in clients object */
  clientKey: string;
  /** Method name to call for search */
  searchMethod: string;
  /** Default quality score (0-1) */
  quality: number;
  /** Environment variable name if API key is required */
  requiresApiKey?: string;
  /** Transform args for non-standard search methods */
  argsTransformer?: 'standard' | 'withOptions' | 'searchWithContent' | 'searchWorks' | 'searchSpecies' | 'searchPapers' | 'searchTreasureHoards';
  /** Whether this provider returns total count */
  hasTotal?: boolean;
}

// =============================================================================
// Provider Definitions
// =============================================================================

/**
 * All provider definitions in a single declarative array.
 * Order doesn't matter - providers are looked up by name.
 */
export const PROVIDER_DEFINITIONS: ProviderDefinition[] = [
  // =========================================================================
  // FREE PROVIDERS (No API Key Required)
  // =========================================================================
  
  // General Knowledge
  { name: 'wikipedia', clientKey: 'wikipedia', searchMethod: 'searchWithContent', quality: 0.70, argsTransformer: 'searchWithContent' },
  
  // Academic Research
  { name: 'arxiv', clientKey: 'arxiv', searchMethod: 'search', quality: 0.85, argsTransformer: 'withOptions', hasTotal: true },
  { name: 'pubmed', clientKey: 'pubmed', searchMethod: 'search', quality: 0.90, argsTransformer: 'withOptions', hasTotal: true },
  { name: 'openalex', clientKey: 'openalex', searchMethod: 'searchWorks', quality: 0.85, argsTransformer: 'searchWorks', hasTotal: true },
  { name: 'crossref', clientKey: 'crossref', searchMethod: 'searchWorks', quality: 0.85, argsTransformer: 'searchWorks', hasTotal: true },
  { name: 'core', clientKey: 'core', searchMethod: 'searchPapers', quality: 0.80, argsTransformer: 'searchPapers', hasTotal: true },
  { name: 'semantic-scholar', clientKey: 'semanticscholar', searchMethod: 'searchPapers', quality: 0.85, argsTransformer: 'searchPapers', hasTotal: true },
  
  // Space & Science
  { name: 'nasa', clientKey: 'nasa', searchMethod: 'search', quality: 0.85, argsTransformer: 'withOptions', hasTotal: true },
  { name: 'usgs', clientKey: 'usgs', searchMethod: 'search', quality: 0.85, argsTransformer: 'withOptions', hasTotal: true },
  { name: 'pubchem', clientKey: 'pubchem', searchMethod: 'search', quality: 0.80, argsTransformer: 'withOptions', hasTotal: true },
  
  // Nature & Biodiversity
  { name: 'gbif', clientKey: 'gbif', searchMethod: 'searchSpecies', quality: 0.80, argsTransformer: 'searchSpecies', hasTotal: true },
  { name: 'inaturalist', clientKey: 'inaturalist', searchMethod: 'searchSpecies', quality: 0.75, argsTransformer: 'searchSpecies', hasTotal: true },
  
  // Medical & Health
  { name: 'clinicaltrials', clientKey: 'clinicaltrials', searchMethod: 'search', quality: 0.85, argsTransformer: 'withOptions', hasTotal: true },
  { name: 'openfda', clientKey: 'openfda', searchMethod: 'search', quality: 0.85, argsTransformer: 'withOptions', hasTotal: true },
  
  // Legal
  { name: 'courtlistener', clientKey: 'courtlistener', searchMethod: 'search', quality: 0.80, argsTransformer: 'withOptions', hasTotal: true },
  
  // Economics & Data
  { name: 'worldbank', clientKey: 'worldbank', searchMethod: 'search', quality: 0.85, argsTransformer: 'withOptions', hasTotal: true },
  
  // Art & Museums
  { name: 'loc', clientKey: 'loc', searchMethod: 'search', quality: 0.85, argsTransformer: 'withOptions', hasTotal: true },
  { name: 'internetarchive', clientKey: 'internetarchive', searchMethod: 'search', quality: 0.75, argsTransformer: 'withOptions', hasTotal: true },
  
  // Treasure Hunting & Archaeology
  { name: 'pas', clientKey: 'pas', searchMethod: 'search', quality: 0.75, argsTransformer: 'withOptions', hasTotal: true },
  { name: 'pleiades', clientKey: 'pleiades', searchMethod: 'search', quality: 0.80, argsTransformer: 'withOptions', hasTotal: true },
  { name: 'shipwrecks', clientKey: 'shipwrecks', searchMethod: 'search', quality: 0.75, argsTransformer: 'withOptions', hasTotal: true },
  { name: 'nominatim', clientKey: 'nominatim', searchMethod: 'search', quality: 0.75, argsTransformer: 'withOptions', hasTotal: true },
  { name: 'wikidatatreasure', clientKey: 'wikidata', searchMethod: 'searchTreasureHoards', quality: 0.70, argsTransformer: 'searchTreasureHoards', hasTotal: true },
  
  // =========================================================================
  // PROVIDERS REQUIRING API KEYS
  // =========================================================================
  
  { name: 'fred', clientKey: 'fred', searchMethod: 'search', quality: 0.85, requiresApiKey: 'FRED_API_KEY', argsTransformer: 'withOptions', hasTotal: true },
  { name: 'europeana', clientKey: 'europeana', searchMethod: 'search', quality: 0.80, requiresApiKey: 'EUROPEANA_API_KEY', argsTransformer: 'withOptions', hasTotal: true },
  { name: 'wolframalpha', clientKey: 'wolframalpha', searchMethod: 'search', quality: 0.90, requiresApiKey: 'WOLFRAM_ALPHA_APP_ID', argsTransformer: 'withOptions', hasTotal: true },
  { name: 'tavily', clientKey: 'tavily', searchMethod: 'search', quality: 0.70, requiresApiKey: 'TAVILY_API_KEY' },
  { name: 'exa', clientKey: 'exa', searchMethod: 'search', quality: 0.75, requiresApiKey: 'EXA_API_KEY' },
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get provider definition by name
 */
export function getProviderDefinition(name: SearchProvider): ProviderDefinition | undefined {
  return PROVIDER_DEFINITIONS.find(p => p.name === name);
}

/**
 * Get all provider names
 */
export function getAllProviderNames(): SearchProvider[] {
  return PROVIDER_DEFINITIONS.map(p => p.name);
}

/**
 * Get providers that require API keys
 */
export function getApiKeyProviders(): ProviderDefinition[] {
  return PROVIDER_DEFINITIONS.filter(p => p.requiresApiKey);
}

/**
 * Get free providers (no API key required)
 */
export function getFreeProviders(): ProviderDefinition[] {
  return PROVIDER_DEFINITIONS.filter(p => !p.requiresApiKey);
}

/**
 * Check if a provider requires an API key
 */
export function providerRequiresApiKey(name: SearchProvider): string | undefined {
  const def = getProviderDefinition(name);
  return def?.requiresApiKey;
}

/**
 * Get quality score for a provider
 */
export function getProviderQuality(name: SearchProvider): number {
  const def = getProviderDefinition(name);
  return def?.quality ?? 0.5;
}

