// Search Engine Configuration
export const SEARCH_CONFIG = {
  // Search Settings
  MAX_SEARCH_QUERIES: 4,        // Maximum number of search queries to generate
  MAX_SOURCES_PER_SEARCH: 6,     // Maximum sources to return per search query
  MAX_SOURCES_TO_SCRAPE: 6,      // Maximum sources to scrape for additional content
  
  // Content Processing
  MIN_CONTENT_LENGTH: 100,       // Minimum content length to consider valid
  SUMMARY_CHAR_LIMIT: 100,       // Character limit for source summaries
  CONTEXT_PREVIEW_LENGTH: 500,   // Preview length for previous context
  ANSWER_CHECK_PREVIEW: 2500,    // Content preview length for answer checking
  MAX_SOURCES_TO_CHECK: 10,      // Maximum sources to check for answers
  
  // Retry Logic
  MAX_RETRIES: 2,                // Maximum retry attempts for failed operations
  MAX_SEARCH_ATTEMPTS: 3,        // Maximum attempts to find answers via search
  MIN_ANSWER_CONFIDENCE: 0.3,    // Minimum confidence (0-1) that a question was answered
  EARLY_TERMINATION_CONFIDENCE: 0.8, // Confidence level to skip additional searches
  
  // Timeouts
  SCRAPE_TIMEOUT: 15000,         // Timeout for scraping operations (ms)
  
  // Performance
  SOURCE_ANIMATION_DELAY: 50,    // Delay between source animations (ms) - reduced from 150
  PARALLEL_SUMMARY_GENERATION: true, // Generate summaries in parallel
} as const;

// Multi-Provider Search Configuration
export const PROVIDER_CONFIG = {
  // Enable/disable multi-provider routing
  ENABLE_MULTI_PROVIDER: true,
  
  // Default provider when routing is disabled or classification fails
  DEFAULT_PROVIDER: 'wikipedia' as const, // Changed to free provider
  
  // ==========================================================================
  // PAID PROVIDERS (Require API Keys)
  // ==========================================================================
  
  FIRECRAWL: {
    MAX_RESULTS: 10,
    SCRAPE_WITH_SEARCH: true,             // Get markdown content with search results
    ENABLE_DEEP_EXTRACTION: true,         // Use scrape/crawl/map when beneficial
    AUTO_SCRAPE_THRESHOLD: 3,             // Auto-scrape top N results for more content
    CRAWL_FOR_DOCUMENTATION: true,        // Use crawl for documentation sites
    MAP_BEFORE_CRAWL: true,               // Map site structure before crawling
  },
  
  TAVILY: {
    SEARCH_DEPTH: 'advanced' as const,  // 'basic' | 'advanced'
    INCLUDE_ANSWER: true,                // Get pre-synthesized answer
    MAX_RESULTS: 8,
  },
  
  EXA: {
    SEARCH_TYPE: 'auto' as const,        // 'neural' | 'keyword' | 'auto'
    USE_AUTOPROMPT: true,                // Let Exa enhance the query
    MAX_RESULTS: 10,
    HIGHLIGHT_SENTENCES: 5,
  },
  
  SEMANTIC_SCHOLAR: {
    MAX_RESULTS: 10,
    INCLUDE_ABSTRACTS: true,
    // Fields to request from API
    FIELDS: ['title', 'abstract', 'authors', 'year', 'citationCount', 'url', 'venue', 'openAccessPdf'],
  },
  
  // ==========================================================================
  // FREE PROVIDERS (Optional API Keys for Higher Rate Limits)
  // ==========================================================================
  
  // OpenAlex - Academic research (209M+ works)
  // ENV: OPENALEX_API_KEY (premium) or OPENALEX_EMAIL (polite pool)
  // Rate: 1 req/sec (anonymous) → 10 req/sec (with email) → higher (with API key)
  OPENALEX: {
    MAX_RESULTS: 10,
    INCLUDE_OPEN_ACCESS: true,           // Prefer open access papers
    SORT_BY: 'relevance_score' as const, // 'relevance_score' | 'cited_by_count' | 'publication_date'
  },
  
  // Wikipedia - General knowledge (no API key needed)
  WIKIPEDIA: {
    MAX_RESULTS: 5,
    LANGUAGE: 'en',                      // Default language
    INCLUDE_SUMMARIES: true,             // Fetch article summaries
  },
  
  // arXiv - Scientific preprints (no API key needed)
  // Rate: 3 requests/second (be respectful)
  ARXIV: {
    MAX_RESULTS: 10,
    REQUEST_DELAY_MS: 350,               // Rate limit delay (3 req/sec)
    DEFAULT_SORT: 'relevance' as const,  // 'relevance' | 'lastUpdatedDate' | 'submittedDate'
  },
  
  // PubMed/NCBI - Medical research
  // ENV: NCBI_API_KEY or PUBMED_API_KEY (FREE - register at NCBI)
  // Rate: 3 req/sec (anonymous) → 10 req/sec (with API key)
  // Register: https://www.ncbi.nlm.nih.gov/account/settings/
  PUBMED: {
    MAX_RESULTS: 10,
    INCLUDE_MESH_TERMS: true,            // Include MeSH (Medical Subject Headings)
  },
  
  // NASA - Space and astronomy
  // ENV: NASA_API_KEY (FREE - register at api.nasa.gov)
  // Rate: 30 req/hour (DEMO_KEY) → 1000 req/hour (with API key)
  // Register: https://api.nasa.gov/
  NASA: {
    MAX_RESULTS: 10,
  },
  
  // GBIF - Biodiversity (no API key needed)
  GBIF: {
    MAX_RESULTS: 10,
    INCLUDE_VERNACULAR_NAMES: true,      // Include common names
  },
  
  // Crossref - DOI and citations
  // ENV: CROSSREF_API_TOKEN (Crossref Plus) or CROSSREF_EMAIL (polite pool)
  // Rate: 50 req/sec (polite pool with email gets priority)
  CROSSREF: {
    MAX_RESULTS: 10,
    SORT_BY: 'relevance' as const,       // 'relevance' | 'published' | 'is-referenced-by-count'
  },
  
  // ==========================================================================
  // NEW EXPANDED FREE PROVIDERS
  // ==========================================================================
  
  // CORE - Open Access Papers (207M+ papers)
  // ENV: CORE_API_KEY (optional - higher rate limits)
  // Rate: 10 req/sec (no key) → higher with API key
  // Register: https://core.ac.uk/services/api
  CORE: {
    MAX_RESULTS: 10,
  },
  
  // ClinicalTrials.gov - Clinical Studies (400K+ studies)
  // No API key required
  CLINICAL_TRIALS: {
    MAX_RESULTS: 10,
    DEFAULT_STATUS: undefined,           // Filter by status if needed
  },
  
  // OpenFDA - Drug/Device/Food Data
  // ENV: OPENFDA_API_KEY (optional - higher rate limits)
  // Rate: 240 req/min (no key) → 120K/day (with key)
  // Register: https://open.fda.gov/apis/authentication/
  OPENFDA: {
    MAX_RESULTS: 10,
  },
  
  // USGS - Earthquake Data
  // No API key required
  USGS: {
    MAX_RESULTS: 20,
    DEFAULT_MIN_MAGNITUDE: 2.5,          // Minimum magnitude to show
  },
  
  // Open Library - Books (20M+ books)
  // No API key required
  OPENLIBRARY: {
    MAX_RESULTS: 10,
  },
  
  // iNaturalist - Species/Observations (150M+ observations)
  // No API key required for read operations
  // Rate: 60 req/min
  INATURALIST: {
    MAX_RESULTS: 10,
    REQUEST_DELAY_MS: 1000,              // Rate limiting delay
  },
  
  // CourtListener - Legal Opinions (8M+ opinions)
  // ENV: COURTLISTENER_API_KEY (optional - higher rate limits)
  // Rate: 5000 req/hour
  // Register: https://www.courtlistener.com/sign-in/
  COURTLISTENER: {
    MAX_RESULTS: 10,
  },
  
  // FRED - Economic Data (800K+ series)
  // ENV: FRED_API_KEY (required)
  // Rate: 120 req/min
  // Register: https://fred.stlouisfed.org/docs/api/api_key.html
  FRED: {
    MAX_RESULTS: 10,
  },
  
  // World Bank - Global Development Data
  // No API key required
  WORLDBANK: {
    MAX_RESULTS: 10,
  },
  
  // Open-Meteo - Weather Data
  // No API key required, truly free
  // Rate: 10,000 req/day
  OPENMETEO: {
    INCLUDE_FORECAST: true,              // Include weather forecast
    FORECAST_DAYS: 7,                    // Days of forecast to fetch
  },
  
  // Europeana - Cultural Heritage (50M+ items)
  // ENV: EUROPEANA_API_KEY (required)
  // Register: https://pro.europeana.eu/page/get-api
  EUROPEANA: {
    MAX_RESULTS: 10,
  },
  
  // PubChem - Chemistry (115M+ compounds)
  // No API key required
  // Rate: 5 req/sec
  PUBCHEM: {
    MAX_RESULTS: 10,
    REQUEST_DELAY_MS: 200,               // Rate limiting delay
  },
  
  // ==========================================================================
  // NEW TREASURE HUNTING PROVIDERS (100% FREE, no API key)
  // ==========================================================================
  
  // Portable Antiquities Scheme - UK Archaeological Finds (1.6M+ finds)
  // No API key required
  PAS: {
    MAX_RESULTS: 15,
    REQUEST_DELAY_MS: 500,               // Be respectful to the service
  },
  
  // Pleiades - Ancient World Locations Gazetteer (35K+ places)
  // No API key required
  PLEIADES: {
    MAX_RESULTS: 15,
    REQUEST_DELAY_MS: 500,               // Be respectful to the service
  },
  
  // NOAA Shipwrecks - Maritime Treasure Database (10K+ wrecks)
  // No API key required
  SHIPWRECKS: {
    MAX_RESULTS: 25,
    DEFAULT_RADIUS_MILES: 50,            // Default search radius for location queries
  },
  
  // Nominatim - OpenStreetMap Geocoding
  // No API key required, but respect rate limits
  // Rate: 1 request/second (strict!)
  NOMINATIM: {
    MAX_RESULTS: 10,
    REQUEST_DELAY_MS: 1100,              // Must be >1 second between requests
    USER_AGENT: 'YurieResearchEngine/1.0 (treasure-hunting-research)',
  },
  
  // Wikidata SPARQL - Treasure Queries
  // No API key required
  WIKIDATA_TREASURE: {
    MAX_RESULTS: 50,
    REQUEST_DELAY_MS: 200,               // Be respectful
  },
  
  // ==========================================================================
  // COMPUTATIONAL KNOWLEDGE ENGINE (Requires API Key)
  // ==========================================================================
  
  // Wolfram Alpha - Computational Knowledge Engine
  // ENV: WOLFRAM_ALPHA_APP_ID (required)
  // Rate: 2,000 calls/month (free tier)
  // Register: https://developer.wolframalpha.com/portal/myapps/
  WOLFRAM_ALPHA: {
    MAX_RESULTS: 5,                      // Usually returns structured pods, not many results
    REQUEST_DELAY_MS: 100,               // Be respectful
    DEFAULT_FORMAT: 'plaintext,image' as const,  // Response format
    INCLUDE_STEP_BY_STEP: true,          // Request step-by-step solutions when available
    TIMEOUT_SECONDS: 10,                 // Query timeout
  },
  
  // ==========================================================================
  // Query Routing Configuration
  // ==========================================================================
  
  ROUTING: {
    MIN_CONFIDENCE_FOR_OVERRIDE: 0.7,    // Minimum confidence to use classified provider
    CACHE_CLASSIFICATIONS: true,          // Cache query classifications
    // Provider priority for fallbacks (prefer free providers)
    FALLBACK_ORDER: ['openalex', 'wikipedia', 'core', 'wolframalpha', 'pas', 'pleiades', 'arxiv', 'pubmed', 'openlibrary', 'worldbank', 'firecrawl'],
  },
} as const;

// You can also export individual configs for different components
export const UI_CONFIG = {
  ANIMATION_DURATION: 300,       // Default animation duration (ms)
  SOURCE_FADE_DELAY: 50,         // Delay between source animations (ms)
  MESSAGE_CYCLE_DELAY: 2000,     // Delay for cycling through messages (ms)
} as const;

// Model Configuration
// GPT-5.2 with Responses API - https://platform.openai.com/docs/guides/latest-model
export const MODEL_CONFIG = {
  // GPT-5.2 is best for complex reasoning, broad world knowledge, and agentic tasks
  FAST_MODEL: "gpt-5-mini-2025-08-07",
  QUALITY_MODEL: "gpt-5-mini-2025-08-07",
  
  // Reasoning effort: controls how many reasoning tokens the model generates
  // 'none' = minimal reasoning, lowest latency (default for GPT-5.2)
  // 'low' | 'medium' | 'high' | 'xhigh' for more thorough reasoning
  REASONING_EFFORT: "low" as const,
  
  // Verbosity: controls output token generation
  // 'low' = concise (SQL, simple answers)
  // 'medium' = balanced (default)
  // 'high' = thorough explanations, detailed code
  VERBOSITY: "high" as const,
  
  // Temperature: only valid when REASONING_EFFORT is 'none'
  // With 'medium' or higher reasoning effort, this is automatically ignored
  // Use REASONING_EFFORT and VERBOSITY to control output instead
  TEMPERATURE: 1,
} as const;