// =============================================================================
// ORIGINAL PROVIDERS (Require API Keys)
// =============================================================================

export { TavilyClient, type TavilySearchResult, type TavilySearchResponse } from './tavily-client';
export { ExaClient, type ExaSearchResult, type ExaSearchResponse, type ExaResearchResponse } from './exa-client';
export { 
  SemanticScholarClient, 
  type SemanticScholarSearchResult, 
  type SemanticScholarSearchResponse,
  type SemanticScholarPaper,
  type SemanticScholarAuthor,
  type SemanticScholarAuthorDetails,
} from './semantic-scholar-client';

// =============================================================================
// NEW FREE PROVIDERS (No API Key Required)
// =============================================================================

// OpenAlex - Academic research (209M+ works, FREE)
export { 
  OpenAlexClient, 
  type OpenAlexSearchResult, 
  type OpenAlexSearchResponse,
  type OpenAlexWork,
  type OpenAlexAuthorResult,
} from './openalex-client';

// Wikipedia/Wikidata - General knowledge (FREE)
export { 
  WikipediaClient,
  WikidataClient,
  WikiClient,
  type WikipediaSearchResult,
  type WikipediaSearchResponse,
  type WikipediaArticle,
  type WikidataEntity,
} from './wikipedia-client';

// arXiv - Scientific preprints (FREE)
export {
  ArxivClient,
  type ArxivSearchResult,
  type ArxivSearchResponse,
  type ArxivPaper,
  ARXIV_CATEGORIES,
} from './arxiv-client';

// PubMed - Medical/biomedical research (FREE)
export {
  PubMedClient,
  type PubMedSearchResult,
  type PubMedSearchResponse,
  type PubMedArticle,
} from './pubmed-client';

// NASA - Space and astronomy (FREE)
export {
  NasaClient,
  type NasaSearchResult,
  type NasaSearchResponse,
  type NasaApodResult,
  type NasaMarsPhoto,
  type NasaNeoObject,
} from './nasa-client';

// GBIF - Biodiversity and nature (FREE)
export {
  GbifClient,
  type GbifSearchResult,
  type GbifSearchResponse,
  type GbifSpecies,
  type GbifOccurrence,
} from './gbif-client';

// Crossref - DOI and citations (FREE)
export {
  CrossrefClient,
  type CrossrefSearchResult,
  type CrossrefSearchResponse,
  type CrossrefWork,
} from './crossref-client';

// =============================================================================
// NEW EXPANDED FREE PROVIDERS
// =============================================================================

// CORE - Open Access Research Papers (207M+ papers, FREE)
export {
  CoreClient,
  type CoreSearchResult,
  type CoreSearchResponse,
} from './core-client';

// ClinicalTrials.gov - Clinical Studies (400K+ studies, FREE)
export {
  ClinicalTrialsClient,
  type ClinicalTrialSearchResult,
  type ClinicalTrialSearchResponse,
} from './clinicaltrials-client';

// OpenFDA - Drug/Device/Food Data (FREE)
export {
  OpenFDAClient,
  type OpenFDASearchResult,
  type OpenFDASearchResponse,
} from './openfda-client';

// USGS - Earthquake Data (FREE)
export {
  USGSClient,
  type USGSEarthquakeResult,
  type USGSSearchResponse as USGSEarthquakeSearchResponse,
} from './usgs-client';

// iNaturalist - Species & Biodiversity (150M+ observations, FREE)
export {
  INaturalistClient,
  type INaturalistSearchResult,
  type INaturalistSearchResponse,
  type INaturalistObservation,
} from './inaturalist-client';

// CourtListener - Legal Opinions (8M+ opinions, FREE)
export {
  CourtListenerClient,
  type CourtListenerSearchResult,
  type CourtListenerSearchResponse,
} from './courtlistener-client';

// FRED - Economic Data (800K+ series, FREE with key)
export {
  FREDClient,
  type FREDSearchResult,
  type FREDSearchResponse,
  type FREDObservation,
} from './fred-client';

// World Bank - Global Development Data (16K+ indicators, FREE)
export {
  WorldBankClient,
  type WorldBankSearchResult,
  type WorldBankSearchResponse,
  type WorldBankIndicator,
  type WorldBankCountry,
} from './worldbank-client';

// Europeana - Cultural Heritage (50M+ items, FREE with key)
export {
  EuropeanaClient,
  type EuropeanaSearchResult,
  type EuropeanaSearchResponse,
} from './europeana-client';

// PubChem - Chemistry (115M+ compounds, FREE)
export {
  PubChemClient,
  type PubChemSearchResult,
  type PubChemSearchResponse,
} from './pubchem-client';

// =============================================================================
// HISTORY RESEARCH PROVIDERS (No API Key Required)
// =============================================================================

// Library of Congress - Primary Sources (170M+ items, FREE)
export {
  LOCClient,
  ChroniclingAmericaClient,
  LibraryOfCongressClient,
  type LOCSearchResult,
  type LOCSearchResponse,
  type ChroniclingAmericaResult,
  type ChroniclingAmericaResponse,
} from './loc-client';

// Internet Archive - Historical Books & Media (40M+ items, FREE)
export {
  InternetArchiveClient,
  type InternetArchiveSearchResult,
  type InternetArchiveSearchResponse,
  type InternetArchiveItem,
} from './internet-archive-client';

// =============================================================================
// TREASURE HUNTING PROVIDERS (No API Key Required)
// =============================================================================

// Portable Antiquities Scheme - UK Archaeological Finds (1.6M+ finds, FREE)
export {
  PASClient,
  type PASSearchResult,
  type PASSearchResponse,
  PAS_PERIODS,
  PAS_OBJECT_TYPES,
  PAS_MATERIALS,
} from './pas-client';

// Pleiades - Ancient World Locations Gazetteer (35K+ places, FREE)
export {
  PleiadesClient,
  type PleiadesSearchResult,
  type PleiadesSearchResponse,
  type PleiadesPlacelName,
  type PleiadesConnection,
  PLEIADES_PERIODS,
  PLEIADES_FEATURE_TYPES,
} from './pleiades-client';

// NOAA Shipwrecks - Maritime Treasure Database (10K+ wrecks, FREE)
export {
  NOAAShipwrecksClient,
  type ShipwreckSearchResult,
  type ShipwreckSearchResponse,
  NOAA_FEATURE_TYPES,
} from './noaa-shipwrecks-client';

// Nominatim - OpenStreetMap Geocoding (FREE)
export {
  NominatimClient,
  type NominatimSearchResult,
  type NominatimSearchResponse,
  type NominatimReverseResult,
  type NominatimAddress,
} from './nominatim-client';

// Wikidata SPARQL - Treasure Queries (FREE)
export {
  WikidataSPARQLClient,
  type WikidataTreasureResult,
  type WikidataSPARQLResponse,
} from './wikipedia-client';

// =============================================================================
// COMPUTATIONAL KNOWLEDGE ENGINE (Requires API Key)
// =============================================================================

// Wolfram Alpha - Computational Knowledge Engine (Math, Science, Data)
export {
  WolframAlphaClient,
  type WolframAlphaSearchResult,
  type WolframAlphaSearchResponse,
  type WolframPod,
  type WolframSubpod,
  type WolframAssumption,
  WOLFRAM_ALPHA_CATEGORIES,
} from './wolfram-alpha-client';

// =============================================================================
// ROUTING & UNIFIED SEARCH
// =============================================================================

export { 
  SearchRouter, 
  getSearchRouter,
  resetSearchRouter,
  type SearchProvider, 
  type QueryClassification,
  type FirecrawlOperation,
} from './search-router';
export { UnifiedSearchProvider, type UnifiedSearchResult, type UnifiedSearchOptions } from './unified-search';

// =============================================================================
// NEW: PROVIDER FACTORY & REGISTRY (Code Reduction Architecture)
// =============================================================================

export {
  createProviderRegistry,
  createProviderSearch,
  defaultTransformer,
  academicTransformer,
  createQualityTransformer,
  searchMultipleProviders,
  type ProviderConfig,
  type ProviderRegistry,
  type ProviderSearchFn,
  type SearchClientResult,
  type SearchClientResponse,
} from './provider-factory';

export {
  getProviderRegistry,
  executeProviderSearch,
  isProviderAvailable,
  getAvailableProviders,
  resetProviderRegistry,
} from './provider-registry';

export {
  PROVIDER_DEFINITIONS,
  getProviderDefinition,
  getAllProviderNames,
  getApiKeyProviders,
  getFreeProviders,
  providerRequiresApiKey,
  getProviderQuality,
  type ProviderDefinition,
} from './provider-definitions';

export {
  getCompiledPatterns,
  clearPatternsCache,
  PROVIDER_PATTERNS,
  DEFAULT_CLASSIFICATION,
  type ProviderPatternConfig,
  type SuggestedMode,
} from './router-patterns';

export {
  BaseProviderClient,
  SimpleRestClient,
  type BaseSearchResult,
  type BaseSearchResponse,
  type ProviderHealthStatus,
  type BaseClientOptions,
  type SimpleRestOptions,
} from './base-client';

// =============================================================================
// FIRECRAWL TOOLS
// =============================================================================

export {
  FirecrawlClient,
  firecrawlTools,
  getFirecrawlTools,
  scrapeTool,
  crawlTool,
  mapTool,
  searchTool,
  type ScrapeToolResult,
  type CrawlToolResult,
  type MapToolResult,
  type SearchToolResult,
  type FirecrawlMetadata,
  type FirecrawlDocument,
} from '../firecrawl';

