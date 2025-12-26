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
  DEFAULT_PROVIDER: 'tavily' as const,
  
  // Provider-specific settings
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
  
  // Query routing thresholds
  ROUTING: {
    MIN_CONFIDENCE_FOR_OVERRIDE: 0.7,    // Minimum confidence to use classified provider
    CACHE_CLASSIFICATIONS: true,          // Cache query classifications
  },
} as const;

// You can also export individual configs for different components
export const UI_CONFIG = {
  ANIMATION_DURATION: 300,       // Default animation duration (ms)
  SOURCE_FADE_DELAY: 50,         // Delay between source animations (ms)
  MESSAGE_CYCLE_DELAY: 2000,     // Delay for cycling through messages (ms)
} as const;

// Model Configuration
export const MODEL_CONFIG = {
  FAST_MODEL: "gpt-5-nano-2025-08-07",  // Fast model for quick operations
  QUALITY_MODEL: "gpt-5.2-2025-12-11",  // High-quality model for final synthesis
  TEMPERATURE: 1,                        // Model temperature (1 = default, required by newer models)
} as const;