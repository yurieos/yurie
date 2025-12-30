/**
 * Search Router
 * 
 * Classifies queries to determine the best search provider.
 * Uses a data-driven pattern configuration for efficient matching.
 * 
 * REFACTORED: Reduced from ~1400 lines to ~300 lines by using
 * declarative pattern configuration in router-patterns.ts
 */

import { MODEL_CONFIG } from "../config";
import { ResponsesAPIClient, ResponseMessage } from "../openai-responses";
import { ResearchDomain } from "../types";
import { detectResearchDomain } from "../research-prompt";
import { 
  getCompiledPatterns, 
  DEFAULT_CLASSIFICATION,
  SuggestedMode,
  FirecrawlOperation as PatternFirecrawlOperation 
} from "./router-patterns";
import { loggers } from "../utils/logger";

const log = loggers.search;

// =============================================================================
// Type Definitions
// =============================================================================

// Extended provider types - includes all free APIs
export type SearchProvider = 
  // Original providers (require API keys)
  | 'tavily' 
  | 'exa' 
  | 'firecrawl' 
  | 'semantic-scholar'
  // FREE providers (no API key required or optional for higher limits)
  | 'openalex'        // Academic research (FREE)
  | 'arxiv'           // Scientific preprints (FREE)
  | 'wikipedia'       // General knowledge (FREE)
  | 'pubmed'          // Medical/biomedical (FREE)
  | 'nasa'            // Space/astronomy (FREE)
  | 'gbif'            // Biodiversity/nature (FREE)
  | 'crossref'        // DOI/citations (FREE)
  // NEW EXPANDED FREE providers
  | 'core'            // Open access papers (FREE)
  | 'clinicaltrials'  // Clinical studies (FREE)
  | 'openfda'         // Drug/device/food data (FREE)
  | 'usgs'            // Earthquakes/geology (FREE)
  | 'inaturalist'     // Species/observations (FREE)
  | 'courtlistener'   // Legal opinions (FREE)
  | 'fred'            // Economic data (FREE with key)
  | 'worldbank'       // Global development (FREE)
  | 'europeana'       // Cultural heritage (FREE with key)
  | 'pubchem'         // Chemistry (FREE)
  // NEW HISTORY RESEARCH providers (100% FREE, no API key)
  | 'loc'             // Library of Congress (FREE)
  | 'internetarchive' // Historical books/media (FREE)
  // NEW TREASURE HUNTING providers (100% FREE, no API key)
  | 'pas'             // Portable Antiquities Scheme - UK archaeological finds (FREE)
  | 'pleiades'        // Ancient world locations gazetteer (FREE)
  | 'shipwrecks'      // NOAA shipwrecks database (FREE)
  | 'nominatim'       // OpenStreetMap geocoding (FREE)
  | 'wikidatatreasure' // Wikidata SPARQL for treasures (FREE)
  // COMPUTATIONAL KNOWLEDGE (Requires API Key)
  | 'wolframalpha';   // Wolfram Alpha - Math, Science, Conversions, Data

/**
 * Firecrawl operation types for deep content extraction
 */
export type FirecrawlOperation = 'search' | 'scrape' | 'crawl' | 'map';

/**
 * Extended query classification with research domain detection
 */
export interface QueryClassification {
  provider: SearchProvider;
  confidence: number;
  reason: string;
  suggestedMode?: SuggestedMode;
  firecrawlOperation?: FirecrawlOperation;
  // Research Intelligence Protocol fields
  researchDomain: ResearchDomain;
  requiresQuantitativeData?: boolean;
  temporalSensitivity?: 'high' | 'medium' | 'low';
}

/**
 * Partial classification returned by quick classify (before augmentation)
 */
type PartialClassification = Omit<QueryClassification, 'researchDomain' | 'requiresQuantitativeData' | 'temporalSensitivity'> & {
  researchDomain?: ResearchDomain;
};

// =============================================================================
// LLM Classification Prompt (fallback for ambiguous queries)
// =============================================================================

const CLASSIFICATION_PROMPT = `You are a search query router. Classify this query to determine the best search provider.

**Available Providers:**
- tavily: Current events, news, real-time data
- wikipedia: General knowledge, definitions, history
- openalex/arxiv: Academic research, papers
- pubmed: Medical/health research
- nasa: Space, astronomy
- gbif/inaturalist: Nature, biodiversity
- clinicaltrials: Clinical studies
- openfda: Drug safety, FDA data
- usgs: Earthquakes, geology
- courtlistener: Legal cases
- fred/worldbank: Economic data
- metmuseum/artic/loc: Art, museums, archives
- pas/pleiades/shipwrecks: Archaeology, treasure
- wolframalpha: Math, calculations, conversions
- exa: Similarity searches ("like X")
- firecrawl: URLs, documentation

**Response Format (JSON only):**
{
  "provider": "<provider_name>",
  "confidence": 0.0-1.0,
  "reason": "brief explanation",
  "suggestedMode": "search" | "similar" | "research" | "academic" | "technical" | "medical" | "nature" | "legal" | "economic" | "cultural"
}`;

// =============================================================================
// Search Router Class
// =============================================================================

export class SearchRouter {
  private llm: ResponsesAPIClient;
  private cache: Map<string, QueryClassification> = new Map();

  constructor() {
    this.llm = new ResponsesAPIClient({
      model: MODEL_CONFIG.FAST_MODEL,
      reasoning: { effort: MODEL_CONFIG.REASONING_EFFORT },
      text: { verbosity: MODEL_CONFIG.VERBOSITY },
      temperature: MODEL_CONFIG.TEMPERATURE,
    });
  }

  /**
   * Augment classification with research domain and related fields
   */
  private augmentWithResearchDomain(
    classification: PartialClassification,
    query: string
  ): QueryClassification {
    const researchDomain = classification.researchDomain || 
      detectResearchDomain(classification.provider, classification.suggestedMode);
    
    // Determine temporal sensitivity based on domain
    let temporalSensitivity: 'high' | 'medium' | 'low' = 'low';
    if (['medical_drug', 'economic'].includes(researchDomain)) {
      temporalSensitivity = 'high';
    } else if (['scientific_discovery', 'legal'].includes(researchDomain)) {
      temporalSensitivity = 'medium';
    }
    
    // Determine if quantitative data is needed
    const requiresQuantitativeData = /how many|percentage|rate|statistics|data|numbers|figures|count|measure/i.test(query);
    
    return {
      ...classification,
      researchDomain,
      temporalSensitivity,
      requiresQuantitativeData,
      suggestedMode: classification.suggestedMode,
    } as QueryClassification;
  }

  /**
   * Classify a query to determine the best search provider
   */
  async classifyQuery(query: string): Promise<QueryClassification> {
    // Check cache first
    const cacheKey = query.toLowerCase().trim();
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Quick heuristic checks before LLM call
    const quickClassification = this.quickClassify(query);
    if (quickClassification.confidence >= 0.9) {
      const augmented = this.augmentWithResearchDomain(quickClassification, query);
      this.cache.set(cacheKey, augmented);
      return augmented;
    }

    try {
      const messages: ResponseMessage[] = [
        { role: 'system', content: CLASSIFICATION_PROMPT },
        { role: 'user', content: `Query: "${query}"` },
      ];
      
      const response = await this.llm.generateWithMessages(messages);

      let content = response.text;
      
      // Strip markdown code blocks if present
      content = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
      
      const parsed = JSON.parse(content) as Partial<QueryClassification>;
      
      // Ensure all required fields are present and augment with research domain
      const classification = this.augmentWithResearchDomain({
        provider: parsed.provider || 'wikipedia',
        confidence: parsed.confidence || 0.5,
        reason: parsed.reason || 'LLM classification',
        suggestedMode: parsed.suggestedMode,
        firecrawlOperation: parsed.firecrawlOperation,
      }, query);
      
      // Cache the result
      this.cache.set(cacheKey, classification);
      
      return classification;
    } catch (error) {
      log.debug('Query classification error:', error);
      
      // Fallback to quick classification or default
      const fallback = quickClassification.confidence > 0.5 
        ? quickClassification 
        : {
            provider: 'tavily' as SearchProvider,
            confidence: 0.5,
            reason: 'Fallback to default provider',
            suggestedMode: 'search' as const,
          };
      
      return this.augmentWithResearchDomain(fallback, query);
    }
  }

  /**
   * Quick heuristic-based classification using pattern configuration
   * REFACTORED: Uses data-driven patterns instead of 1000+ lines of if/else
   */
  private quickClassify(query: string): PartialClassification {
    const q = query.toLowerCase();
    const compiledPatterns = getCompiledPatterns();

    // Check each pattern configuration in priority order
    for (const { config, allPatterns } of compiledPatterns) {
      // Check if any pattern matches
      const matched = allPatterns.some(pattern => pattern.test(q));
      
      if (matched) {
        return {
          provider: config.provider,
          confidence: config.confidence,
          reason: config.reason,
          suggestedMode: config.mode,
          firecrawlOperation: config.firecrawlOperation as FirecrawlOperation | undefined,
        };
      }
    }

    // No pattern matched, return default
    return {
      provider: DEFAULT_CLASSIFICATION.provider,
      confidence: DEFAULT_CLASSIFICATION.confidence,
      reason: DEFAULT_CLASSIFICATION.reason,
      suggestedMode: DEFAULT_CLASSIFICATION.mode,
    };
  }

  /**
   * Clear the classification cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let routerInstance: SearchRouter | null = null;

export function getSearchRouter(): SearchRouter {
  if (!routerInstance) {
    routerInstance = new SearchRouter();
  }
  return routerInstance;
}

/**
 * Reset the router instance (useful for testing)
 */
export function resetSearchRouter(): void {
  routerInstance = null;
}
