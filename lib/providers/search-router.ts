import { MODEL_CONFIG } from "../config";
import { ResponsesAPIClient, ResponseMessage } from "../openai-responses";
import { ResearchDomain } from "../types";
import { detectResearchDomain } from "../research-prompt";

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
  | 'openlibrary'     // Books (FREE)
  | 'inaturalist'     // Species/observations (FREE)
  | 'courtlistener'   // Legal opinions (FREE)
  | 'fred'            // Economic data (FREE with key)
  | 'worldbank'       // Global development (FREE)
  | 'openmeteo'       // Weather (FREE)
  | 'europeana'       // Cultural heritage (FREE with key)
  | 'pubchem'         // Chemistry (FREE)
  // NEW HISTORY RESEARCH providers (100% FREE, no API key)
  | 'metmuseum'       // Art history (FREE)
  | 'loc'             // Library of Congress (FREE)
  | 'internetarchive' // Historical books/media (FREE)
  | 'artic'           // Art Institute of Chicago (FREE)
  | 'historyapi'      // This Day in History (FREE)
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
  suggestedMode?: 'search' | 'similar' | 'research' | 'academic' | 'technical' | 'medical' | 'nature' | 'legal' | 'economic' | 'cultural';
  firecrawlOperation?: FirecrawlOperation;
  // NEW: Research Intelligence Protocol fields
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

const CLASSIFICATION_PROMPT = `You are a search query router. Classify this query to determine the best search provider.

**Available Providers (use each appropriately based on query type):**

1. **tavily** - Best for:
   - Current events and breaking news
   - Real-time information (prices, weather, stocks)
   - Quick Q&A style queries needing fresh data
   - Trending topics and recent developments

2. **wikipedia** - Best for:
   - General knowledge and definitions ("What is X?")
   - Historical facts and events
   - Biographies and notable people
   - Countries, cities, organizations
   - Encyclopedic information

3. **openalex** - Best for:
   - Academic research across all fields
   - Scholarly papers and publications
   - Finding research by topic or author
   - Citation analysis
   - Interdisciplinary research

4. **arxiv** - Best for:
   - AI/ML and computer science papers
   - Physics, mathematics, and quantitative sciences
   - Cutting-edge preprints and recent research
   - Technical deep-dives

5. **pubmed** - Best for:
   - Medical and health research
   - Clinical studies and trials
   - Drug and treatment information
   - Diseases and conditions
   - Genetics and biology
   - Longevity and aging research

6. **nasa** - Best for:
   - Space and astronomy
   - Planets, stars, galaxies
   - Space missions and exploration
   - Mars rovers and imagery
   - Exoplanets

7. **gbif** - Best for:
   - Animals and wildlife (scientific data)
   - Plants and botany
   - Species identification
   - Biodiversity and ecology
   - Nature and conservation

8. **crossref** - Best for:
   - DOI lookups
   - Citation verification
   - Publication metadata
   - Journal information

9. **firecrawl** - Best for:
   - Technical documentation and tutorials
   - Deep content extraction from specific websites
   - When user provides a specific URL to analyze
   - Full page content extraction

10. **exa** - Best for:
    - Similarity searches ("Find companies like X")
    - Deep investigation requiring multiple sources
    - Company/startup research
    - Historical analysis requiring semantic understanding

11. **core** - Best for:
    - Open access research papers
    - Full-text academic articles
    - Research from global repositories

12. **clinicaltrials** - Best for:
    - Clinical trial information
    - Drug trials and studies
    - Recruiting studies for conditions
    - Medical intervention research

13. **openfda** - Best for:
    - Drug information and labels
    - Drug adverse events and recalls
    - Medical device events
    - Food recalls and safety

14. **usgs** - Best for:
    - Earthquakes and seismic activity
    - Geology and earth science
    - Natural hazards
    - Geological surveys

15. **openlibrary** - Best for:
    - Books and literature
    - Finding books by author or subject
    - Book metadata and ISBNs
    - Literary research

16. **inaturalist** - Best for:
    - Species observations with photos
    - Wildlife sightings and identification
    - Community science data
    - Biodiversity with imagery

17. **courtlistener** - Best for:
    - Legal cases and opinions
    - Court decisions and rulings
    - Case law research
    - Judicial history

18. **fred** - Best for:
    - Economic data and indicators
    - GDP, inflation, unemployment
    - Financial statistics
    - Federal Reserve data

19. **worldbank** - Best for:
    - Global development data
    - Country statistics
    - International indicators
    - Poverty and development

20. **openmeteo** - Best for:
    - Weather forecasts
    - Historical weather data
    - Climate information
    - Meteorological queries

21. **europeana** - Best for:
    - European cultural heritage
    - Art and museum collections
    - Historical artifacts
    - Cultural history research

22. **pubchem** - Best for:
    - Chemical compounds
    - Molecular structures
    - Drug chemistry
    - Chemical properties

23. **metmuseum** - Best for:
    - Art history and artworks
    - Ancient artifacts and antiquities
    - Historical art from all cultures
    - Museum collections
    - Paintings, sculptures, armor, textiles

24. **loc** - Best for:
    - Primary source documents
    - Historical photographs
    - Historical maps
    - Historical newspapers (via Chronicling America)
    - American history
    - Manuscripts and archives

25. **internetarchive** - Best for:
    - Historical books and texts
    - Public domain works
    - Historical audio and video
    - Archived web pages
    - Digital library research

26. **artic** - Best for:
    - Art Institute of Chicago collection
    - European and American art
    - Ancient and Asian art
    - Art history research

27. **historyapi** - Best for:
    - "On this day" historical events
    - Historical facts by date
    - Notable births and deaths
    - Daily history context

28. **pas** - Best for:
    - Metal detecting finds
    - Archaeological artifacts found in UK
    - Treasure hunting research
    - Roman coins, medieval jewelry, hoards
    - Portable antiquities

29. **pleiades** - Best for:
    - Ancient world locations
    - Greek, Roman, Egyptian sites
    - Archaeological sites coordinates
    - Ancient cities and settlements
    - Historical trade routes

30. **shipwrecks** - Best for:
    - Shipwreck locations
    - Maritime history
    - Underwater treasure sites
    - Naval disasters
    - Sunken ships

31. **nominatim** - Best for:
    - Geocoding historical places
    - Converting addresses to coordinates
    - Finding locations by name
    - Reverse geocoding

32. **wikidatatreasure** - Best for:
    - Treasure hoards with coordinates
    - Famous buried treasures
    - Lost cities
    - Notable artifacts locations

33. **wolframalpha** - Best for:
    - Mathematical calculations and equations (solve, integrate, differentiate)
    - Unit conversions (miles to km, Celsius to Fahrenheit)
    - Scientific computations (physics, chemistry formulas)
    - Step-by-step math solutions
    - Real-time data computations (distance between cities, time zones)
    - Statistical calculations (mean, median, standard deviation)
    - Financial calculations (compound interest, loan payments)
    - Date/time calculations (days between dates, day of week)
    - Element properties and molecular data
    - Astronomical data (planet distances, star magnitudes)

**Response Format (JSON only):**
{
  "provider": "<provider_name>",
  "confidence": 0.0-1.0,
  "reason": "brief explanation",
  "suggestedMode": "search" | "similar" | "research" | "academic" | "technical" | "medical" | "nature" | "legal" | "economic" | "cultural"
}

**Examples:**
- "Who was Albert Einstein?" → wikipedia
- "What is photosynthesis?" → wikipedia
- "Latest AI news" → tavily
- "Current Bitcoin price" → tavily
- "Papers on transformer architecture" → openalex
- "Machine learning research 2024" → arxiv
- "Treatment for diabetes" → pubmed
- "Side effects of aspirin" → openfda
- "Mars rover latest photos" → nasa
- "How many moons does Jupiter have?" → nasa
- "Information about African elephants" → inaturalist
- "Endangered species list" → gbif
- "doi:10.1000/xyz123" → crossref
- "How does React hooks work?" → firecrawl
- "Companies like Stripe" → exa
- "Recruiting clinical trials for cancer" → clinicaltrials
- "Recent earthquake in California" → usgs
- "Books by Stephen King" → openlibrary
- "Roe v Wade court case" → courtlistener
- "US GDP growth rate" → fred
- "Population of India" → worldbank
- "Weather in Tokyo" → openmeteo
- "Van Gogh paintings" → europeana
- "Molecular structure of caffeine" → pubchem
- "Ancient Egyptian artifacts" → metmuseum
- "Civil War photographs" → loc
- "Historical newspaper 1920s" → loc
- "Old books about Renaissance" → internetarchive
- "Impressionist paintings" → artic
- "What happened on this day in history" → historyapi
- "Notable deaths January 15" → historyapi
- "Roman coins found in England" → pas
- "Metal detecting finds" → pas
- "Ancient Roman city" → pleiades
- "Location of Pompeii" → pleiades
- "Shipwrecks in Florida" → shipwrecks
- "Sunken treasure ships" → shipwrecks
- "Coordinates for old town" → nominatim
- "Famous treasure hoards" → wikidatatreasure
- "Calculate integral of x^2" → wolframalpha
- "Solve 2x + 5 = 15" → wolframalpha
- "Convert 100 miles to kilometers" → wolframalpha
- "What is the derivative of sin(x)" → wolframalpha
- "Distance from New York to London" → wolframalpha
- "Days until Christmas" → wolframalpha
- "Standard deviation of 1,2,3,4,5" → wolframalpha
- "Compound interest calculator" → wolframalpha
- "What day was January 1, 2000" → wolframalpha`;

export class SearchRouter {
  private llm: ResponsesAPIClient;
  private cache: Map<string, QueryClassification> = new Map();

  constructor() {
    // Initialize GPT-5.2 Responses API client for query classification
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
    // Check cache first (queries often repeat)
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
      console.error('Query classification error:', error);
      
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
   * Quick heuristic-based classification to avoid LLM calls for obvious queries
   * Returns a partial classification that will be augmented with research domain
   */
  private quickClassify(query: string): PartialClassification {
    const q = query.toLowerCase();

    // ==========================================================================
    // URL-BASED ROUTING (Firecrawl)
    // ==========================================================================
    
    if (q.includes('http://') || q.includes('https://')) {
      if (q.includes('crawl') || q.includes('all pages') || q.includes('entire site') || q.includes('full site')) {
        return {
          provider: 'firecrawl',
          confidence: 0.98,
          reason: 'Request to crawl entire website',
          suggestedMode: 'research',
          firecrawlOperation: 'crawl',
        };
      }
      if (q.includes('map') || q.includes('structure') || q.includes('sitemap') || q.includes('list all urls') || q.includes('discover pages')) {
        return {
          provider: 'firecrawl',
          confidence: 0.98,
          reason: 'Request to map website structure',
          suggestedMode: 'search',
          firecrawlOperation: 'map',
        };
      }
      return {
        provider: 'firecrawl',
        confidence: 0.95,
        reason: 'Query contains URL for content extraction',
        suggestedMode: 'search',
        firecrawlOperation: 'scrape',
      };
    }

    // ==========================================================================
    // DOI AND CITATION LOOKUPS (Crossref)
    // ==========================================================================
    
    if (q.includes('doi:') || q.match(/\b10\.\d{4,}\//) || q.includes('doi.org/')) {
      return {
        provider: 'crossref',
        confidence: 0.98,
        reason: 'DOI lookup query',
        suggestedMode: 'academic',
      };
    }

    // ==========================================================================
    // WOLFRAM ALPHA - Mathematical & Computational Queries
    // ==========================================================================
    
    // Mathematical expressions and calculations
    const mathPatterns = [
      'calculate', 'compute', 'solve', 'evaluate', 'simplify', 'factor',
      'integrate', 'derivative', 'differentiate', 'limit', 'sum', 'product',
      'matrix', 'determinant', 'eigenvalue', 'eigenvector',
      'equation', 'inequality', 'system of equations',
      'prime factor', 'gcd', 'lcm', 'factorial', 'fibonacci',
      'sin(', 'cos(', 'tan(', 'log(', 'ln(', 'exp(', 'sqrt(',
      'x^', 'x²', 'x³', '∫', '∂', 'Σ', '∏', 'lim',
    ];
    
    // Check for mathematical expressions (numbers with operators)
    const mathExpressionPattern = /[\d]+\s*[\+\-\*\/\^\=]\s*[\d\w]/;
    const algebraPattern = /\b[xyz]\s*[\+\-\*\/\^\=]/i;
    
    if (mathPatterns.some(p => q.includes(p)) || 
        mathExpressionPattern.test(query) || 
        algebraPattern.test(query)) {
      return {
        provider: 'wolframalpha',
        confidence: 0.95,
        reason: 'Mathematical calculation or equation query',
        suggestedMode: 'search',
      };
    }

    // Unit conversions
    const conversionPatterns = [
      'convert', 'to celsius', 'to fahrenheit', 'to kelvin',
      'to miles', 'to kilometers', 'to meters', 'to feet', 'to inches',
      'to pounds', 'to kilograms', 'to grams', 'to ounces',
      'to liters', 'to gallons', 'to cups', 'to tablespoons',
      'to hours', 'to minutes', 'to seconds',
      'in miles', 'in km', 'in meters', 'in feet',
      'how many', 'how much is',
    ];
    
    // Pattern: number + unit + "to" + unit OR number + unit + "in" + unit
    const unitConversionPattern = /\d+\s*\w+\s*(to|in)\s+\w+/i;
    
    if (conversionPatterns.some(p => q.includes(p)) && unitConversionPattern.test(query)) {
      return {
        provider: 'wolframalpha',
        confidence: 0.93,
        reason: 'Unit conversion query',
        suggestedMode: 'search',
      };
    }

    // Date/time calculations
    const dateTimePatterns = [
      'days until', 'days since', 'days between', 'time between',
      'how long until', 'how long since', 'how many days',
      'what day was', 'what day is', 'what day will',
      'day of the week', 'days from now', 'days ago',
      'time difference', 'time zone', 'sunrise', 'sunset',
    ];
    
    if (dateTimePatterns.some(p => q.includes(p))) {
      return {
        provider: 'wolframalpha',
        confidence: 0.92,
        reason: 'Date/time calculation query',
        suggestedMode: 'search',
      };
    }

    // Statistical calculations
    const statsPatterns = [
      'mean of', 'median of', 'mode of', 'standard deviation',
      'variance of', 'average of', 'sum of', 'statistics of',
      'probability', 'permutation', 'combination', 'binomial',
      'normal distribution', 'regression', 'correlation',
    ];
    
    if (statsPatterns.some(p => q.includes(p))) {
      return {
        provider: 'wolframalpha',
        confidence: 0.92,
        reason: 'Statistical calculation query',
        suggestedMode: 'search',
      };
    }

    // Financial calculations
    const financeCalcPatterns = [
      'compound interest', 'simple interest', 'mortgage', 'loan payment',
      'amortization', 'present value', 'future value', 'roi',
      'return on investment', 'break even', 'profit margin',
    ];
    
    if (financeCalcPatterns.some(p => q.includes(p))) {
      return {
        provider: 'wolframalpha',
        confidence: 0.90,
        reason: 'Financial calculation query',
        suggestedMode: 'search',
      };
    }

    // Distance and physical calculations
    const physicsCalcPatterns = [
      'distance from', 'distance between', 'how far from', 'how far is',
      'speed of light', 'speed of sound', 'gravitational',
      'force between', 'energy of', 'wavelength of', 'frequency of',
    ];
    
    if (physicsCalcPatterns.some(p => q.includes(p))) {
      return {
        provider: 'wolframalpha',
        confidence: 0.88,
        reason: 'Physical/distance calculation query',
        suggestedMode: 'search',
      };
    }

    // ==========================================================================
    // SPACE & ASTRONOMY (NASA)
    // ==========================================================================
    
    const spacePatterns = [
      'nasa', 'space', 'mars', 'jupiter', 'saturn', 'venus', 'mercury', 'neptune', 'uranus', 'pluto',
      'asteroid', 'meteor', 'comet', 'galaxy', 'nebula', 'supernova', 'black hole', 'exoplanet',
      'astronaut', 'spacecraft', 'rocket', 'satellite', 'orbit', 'moon', 'lunar', 'solar',
      'hubble', 'james webb', 'jwst', 'voyager', 'perseverance', 'curiosity', 'rover',
      'constellation', 'star', 'cosmos', 'universe', 'astronomy', 'astrophysics',
      'international space station', 'iss', 'spacex', 'launch'
    ];
    
    if (spacePatterns.some(p => q.includes(p))) {
      return {
        provider: 'nasa',
        confidence: 0.92,
        reason: 'Space/astronomy query',
        suggestedMode: 'search',
      };
    }

    // ==========================================================================
    // CLINICAL TRIALS (must come BEFORE general medical)
    // ==========================================================================
    
    const clinicalTrialPatterns = [
      'clinical trial', 'clinical study', 'recruiting trial', 'phase 1', 'phase 2', 'phase 3',
      'drug trial', 'intervention study', 'randomized controlled', 'placebo controlled', 
      'clinicaltrials.gov', 'nct0', 'nct1', 'nct2', 'trial enrollment', 'recruiting study',
      'ongoing trial', 'completed trial'
    ];
    
    if (clinicalTrialPatterns.some(p => q.includes(p))) {
      return {
        provider: 'clinicaltrials',
        confidence: 0.95,
        reason: 'Clinical trial query',
        suggestedMode: 'medical',
      };
    }

    // ==========================================================================
    // FDA/DRUG SAFETY (must come BEFORE general medical)
    // ==========================================================================
    
    const fdaPatterns = [
      'fda recall', 'fda approval', 'fda warning', 'drug recall', 'food recall', 
      'adverse event', 'drug label', 'drug interaction', 'contraindication', 
      'black box warning', 'medication guide', 'drug safety', 'medical device recall',
      'fda approved', 'openfda'
    ];
    
    if (fdaPatterns.some(p => q.includes(p))) {
      return {
        provider: 'openfda',
        confidence: 0.95,
        reason: 'FDA/drug safety query',
        suggestedMode: 'medical',
      };
    }

    // ==========================================================================
    // CHEMISTRY (must come BEFORE general medical - for molecular queries)
    // ==========================================================================
    
    const chemistryPatterns = [
      'molecular structure', 'molecular formula', 'molecular weight', 'chemical compound',
      'chemical formula', 'smiles notation', 'pubchem', 'iupac name',
      'periodic table', 'chemical reaction', 'organic synthesis', 'organic chemistry',
      'inorganic chemistry', 'polymer', 'isomer', 'cation', 'anion', 'covalent bond',
      'ionic bond', 'valence electron', 'chemical element'
    ];
    
    if (chemistryPatterns.some(p => q.includes(p))) {
      return {
        provider: 'pubchem',
        confidence: 0.95,
        reason: 'Chemistry/compound query',
        suggestedMode: 'search',
      };
    }
    
    // Check for specific compound names that should go to PubChem
    const compoundNames = [
      'caffeine', 'aspirin', 'acetaminophen', 'ibuprofen', 'penicillin', 
      'morphine', 'codeine', 'glucose', 'fructose', 'sucrose', 'ethanol',
      'methanol', 'benzene', 'toluene', 'acetone', 'ammonia', 'sulfuric acid',
      'hydrochloric acid', 'sodium chloride', 'calcium carbonate'
    ];
    
    // Only match if asking about the molecule/structure specifically
    if (compoundNames.some(c => q.includes(c)) && 
        (q.includes('structure') || q.includes('formula') || q.includes('molecule') || 
         q.includes('compound') || q.includes('chemical'))) {
      return {
        provider: 'pubchem',
        confidence: 0.92,
        reason: 'Chemical compound query',
        suggestedMode: 'search',
      };
    }

    // ==========================================================================
    // MEDICAL & HEALTH (PubMed) - General medical research
    // ==========================================================================
    
    const medicalPatterns = [
      'disease', 'treatment', 'symptom', 'medication', 'patient', 'diagnosis', 
      'therapy', 'cancer', 'diabetes', 'heart disease', 'blood pressure', 'brain tumor',
      'liver disease', 'kidney disease', 'lung disease', 'infection', 'virus', 
      'bacteria', 'antibiotic', 'vaccine', 'surgery', 'medical research', 
      'medicine', 'pharmaceutical', 'prescription', 'dosage', 'gene therapy',
      'genetic', 'dna sequencing', 'rna', 'protein', 'cell biology',
      'longevity', 'aging research', 'anti-aging', 'lifespan', 'immortality', 
      'senescence', 'ncbi', 'nih', 'cdc', 'who', 'pubmed', 'biomedical'
    ];
    
    if (medicalPatterns.some(p => q.includes(p))) {
      return {
        provider: 'pubmed',
        confidence: 0.90,
        reason: 'Medical/health research query',
        suggestedMode: 'medical',
      };
    }

    // ==========================================================================
    // EARTHQUAKES & GEOLOGY (USGS)
    // ==========================================================================
    
    const usgsPatterns = [
      'earthquake', 'seismic', 'magnitude', 'richter', 'tremor', 'aftershock',
      'fault line', 'tectonic', 'usgs', 'geological survey', 'volcano', 'eruption',
      'tsunami warning', 'quake'
    ];
    
    if (usgsPatterns.some(p => q.includes(p))) {
      return {
        provider: 'usgs',
        confidence: 0.95,
        reason: 'Earthquake/geology query',
        suggestedMode: 'search',
      };
    }

    // ==========================================================================
    // WEATHER (Open-Meteo)
    // ==========================================================================
    
    const weatherPatterns = [
      'weather', 'forecast', 'temperature', 'rain', 'snow', 'humidity',
      'wind speed', 'precipitation', 'climate today', 'weather tomorrow',
      'will it rain', 'how cold', 'how hot', 'weather in'
    ];
    
    if (weatherPatterns.some(p => q.includes(p))) {
      return {
        provider: 'openmeteo',
        confidence: 0.92,
        reason: 'Weather/forecast query',
        suggestedMode: 'search',
      };
    }

    // ==========================================================================
    // LEGAL (CourtListener)
    // ==========================================================================
    
    const legalPatterns = [
      'court case', 'lawsuit', 'legal opinion', 'court ruling', 'verdict', 
      'supreme court', 'circuit court', 'appeals court', 'district court',
      'case law', 'legal precedent', 'plaintiff', 'defendant', 'litigation', 
      'judicial decision', 'roe v wade', 'brown v board', 'marbury v madison',
      'constitutional law', 'court decision', 'legal ruling', 'courtlistener',
      'scotus', 'court opinion'
    ];
    
    // Check for "v." or "vs." case patterns (e.g., "Smith v. Jones")
    const casePattern = /\b\w+\s+v\.?\s+\w+/i;
    
    if (legalPatterns.some(p => q.includes(p)) || casePattern.test(query)) {
      return {
        provider: 'courtlistener',
        confidence: 0.92,
        reason: 'Legal/court case query',
        suggestedMode: 'search',
      };
    }

    // ==========================================================================
    // ECONOMICS (FRED) - US Economic Data
    // ==========================================================================
    
    const fredPatterns = [
      'us gdp', 'us inflation', 'us unemployment', 'federal reserve', 'fed rate',
      'us interest rate', 'us economic', 'cpi', 'consumer price index', 
      'monetary policy', 'fiscal policy', 'recession', 'fred data', 
      'treasury yield', 'm2 money', 'federal funds', 'us economy',
      'american economy', 'united states gdp', 'united states unemployment'
    ];
    
    if (fredPatterns.some(p => q.includes(p))) {
      return {
        provider: 'fred',
        confidence: 0.92,
        reason: 'US economic data query',
        suggestedMode: 'search',
      };
    }

    // ==========================================================================
    // WORLD DATA (World Bank) - International/Global Data
    // ==========================================================================
    
    const worldbankPatterns = [
      'world bank', 'global development', 'country statistics', 'population of',
      'poverty rate', 'life expectancy', 'gdp per capita', 'literacy rate',
      'development indicator', 'world data', 'international statistics',
      'global gdp', 'country gdp', 'world population', 'country population',
      'infant mortality', 'global poverty', 'countries by'
    ];
    
    if (worldbankPatterns.some(p => q.includes(p))) {
      return {
        provider: 'worldbank',
        confidence: 0.90,
        reason: 'Global development data query',
        suggestedMode: 'search',
      };
    }

    // ==========================================================================
    // BOOKS (Open Library)
    // ==========================================================================
    
    const bookPatterns = [
      'book by', 'books by', 'books about', 'novel by', 'novels by', 
      'isbn', 'book titled', 'find book', 'open library', 'bestseller',
      'fiction book', 'non-fiction book', 'literary work', 'bibliography of',
      'published books', 'book search', 'ebook', 'audiobook'
    ];
    
    if (bookPatterns.some(p => q.includes(p))) {
      return {
        provider: 'openlibrary',
        confidence: 0.90,
        reason: 'Book/literature query',
        suggestedMode: 'search',
      };
    }

    // ==========================================================================
    // THIS DAY IN HISTORY (HistoryAPI)
    // ==========================================================================
    
    const thisDayPatterns = [
      'on this day', 'today in history', 'what happened on', 'this day in history',
      'born on', 'died on', 'events on', 'notable births', 'notable deaths',
      'historical events on', 'history of today', 'daily history'
    ];
    
    if (thisDayPatterns.some(p => q.includes(p))) {
      return {
        provider: 'historyapi',
        confidence: 0.95,
        reason: 'This day in history query',
        suggestedMode: 'search',
      };
    }

    // ==========================================================================
    // TREASURE HUNTING - PAS (Portable Antiquities Scheme)
    // ==========================================================================
    
    const pasPatterns = [
      'metal detecting', 'metal detector', 'detecting find', 'archaeological find',
      'found with detector', 'uk find', 'england find', 'wales find', 'portable antiquities',
      'pas database', 'treasure find', 'hoard find', 'roman coin', 'medieval coin',
      'bronze age artifact', 'iron age artifact', 'saxon', 'viking find', 'celtic',
      'detector hobby', 'detectorist', 'mudlarking'
    ];
    
    if (pasPatterns.some(p => q.includes(p))) {
      return {
        provider: 'pas',
        confidence: 0.92,
        reason: 'Metal detecting / archaeological finds query',
        suggestedMode: 'research',
      };
    }

    // ==========================================================================
    // TREASURE HUNTING - PLEIADES (Ancient World Locations)
    // ==========================================================================
    
    const pleiadesPatterns = [
      'ancient city', 'ancient town', 'ancient settlement', 'ancient site',
      'greek city', 'roman city', 'roman site', 'roman settlement', 'roman fort',
      'egyptian temple', 'ancient temple', 'ancient road', 'roman road', 'via romana',
      'ancient mine', 'ancient harbor', 'ancient port', 'amphitheater', 'ancient theater',
      'pleiades', 'classical antiquity', 'hellenistic', 'ptolemaic',
      'ancient location', 'ancient coordinates'
    ];
    
    if (pleiadesPatterns.some(p => q.includes(p))) {
      return {
        provider: 'pleiades',
        confidence: 0.90,
        reason: 'Ancient world locations query',
        suggestedMode: 'research',
      };
    }

    // ==========================================================================
    // TREASURE HUNTING - SHIPWRECKS (NOAA)
    // ==========================================================================
    
    const shipwreckPatterns = [
      'shipwreck', 'ship wreck', 'sunken ship', 'sunken vessel', 'wreck location',
      'underwater treasure', 'maritime treasure', 'naval disaster', 'ship sinking',
      'treasure ship', 'galleon', 'spanish treasure', 'pirate ship', 'wreck diving',
      'submerged wreck', 'awois', 'noaa wreck', 'ship graveyard'
    ];
    
    if (shipwreckPatterns.some(p => q.includes(p))) {
      return {
        provider: 'shipwrecks',
        confidence: 0.92,
        reason: 'Shipwreck / maritime treasure query',
        suggestedMode: 'research',
      };
    }

    // ==========================================================================
    // TREASURE HUNTING - WIKIDATA TREASURES
    // ==========================================================================
    
    const wikidataTreasurePatterns = [
      'treasure hoard', 'buried treasure', 'hidden treasure', 'lost treasure',
      'famous treasure', 'treasure location', 'hoard location', 'treasure coordinates',
      'lost gold', 'buried gold', 'hidden gold', 'treasure map location',
      'legendary treasure', 'treasure discovery'
    ];
    
    if (wikidataTreasurePatterns.some(p => q.includes(p))) {
      return {
        provider: 'wikidatatreasure',
        confidence: 0.88,
        reason: 'Treasure hoard / buried treasure query',
        suggestedMode: 'research',
      };
    }

    // ==========================================================================
    // GEOCODING - NOMINATIM
    // ==========================================================================
    
    const nominatimPatterns = [
      'coordinates for', 'coordinates of', 'gps coordinates', 'lat long',
      'latitude longitude', 'geocode', 'where is located', 'exact location of',
      'address to coordinates', 'find location'
    ];
    
    if (nominatimPatterns.some(p => q.includes(p))) {
      return {
        provider: 'nominatim',
        confidence: 0.85,
        reason: 'Geocoding / coordinates query',
        suggestedMode: 'search',
      };
    }

    // ==========================================================================
    // GENERAL TREASURE HUNTING - Route to best provider
    // ==========================================================================
    
    const generalTreasurePatterns = [
      'treasure hunting', 'treasure hunt', 'gold prospecting', 'gold panning',
      'artifact hunting', 'relic hunting', 'cache hunting', 'geocaching treasure',
      'buried cache', 'hidden cache', 'lost mine', 'abandoned mine', 'ghost town'
    ];
    
    if (generalTreasurePatterns.some(p => q.includes(p))) {
      // Route to PAS for general treasure hunting queries
      return {
        provider: 'pas',
        confidence: 0.80,
        reason: 'General treasure hunting query',
        suggestedMode: 'research',
      };
    }

    // ==========================================================================
    // ART HISTORY & MUSEUMS (Met Museum, Art Institute of Chicago)
    // ==========================================================================
    
    const artMuseumPatterns = [
      'met museum', 'metropolitan museum', 'ancient artifact', 'ancient art',
      'egyptian artifact', 'greek art', 'roman art', 'medieval armor', 
      'antiquities', 'ancient sculpture', 'historical artwork', 'art collection',
      'museum collection', 'art object', 'decorative art', 'asian art',
      'islamic art', 'american art', 'european painting'
    ];
    
    if (artMuseumPatterns.some(p => q.includes(p))) {
      return {
        provider: 'metmuseum',
        confidence: 0.92,
        reason: 'Art museum/artifact query',
        suggestedMode: 'search',
      };
    }
    
    const articPatterns = [
      'art institute', 'chicago art', 'artic'
    ];
    
    if (articPatterns.some(p => q.includes(p))) {
      return {
        provider: 'artic',
        confidence: 0.95,
        reason: 'Art Institute of Chicago query',
        suggestedMode: 'search',
      };
    }

    // ==========================================================================
    // LIBRARY OF CONGRESS & PRIMARY SOURCES
    // ==========================================================================
    
    const locPatterns = [
      'library of congress', 'loc.gov', 'chronicling america', 'historical newspaper',
      'old newspaper', 'newspaper archive', 'historical photograph', 'civil war photo',
      'primary source', 'historical document', 'american history', 'historical map',
      'vintage photograph', 'old photograph', 'newspaper from', 'wwi newspaper',
      'wwii newspaper', 'historical archives'
    ];
    
    if (locPatterns.some(p => q.includes(p))) {
      return {
        provider: 'loc',
        confidence: 0.92,
        reason: 'Library of Congress/primary source query',
        suggestedMode: 'search',
      };
    }

    // ==========================================================================
    // INTERNET ARCHIVE (Historical Books & Media)
    // ==========================================================================
    
    const archivePatterns = [
      'internet archive', 'archive.org', 'wayback machine', 'historical book',
      'old book', 'public domain book', 'historical text', 'vintage film',
      'historical recording', 'old recording', 'historical video', 'digitized book',
      'out of print', 'rare book', 'historical audio'
    ];
    
    if (archivePatterns.some(p => q.includes(p))) {
      return {
        provider: 'internetarchive',
        confidence: 0.92,
        reason: 'Internet Archive/historical media query',
        suggestedMode: 'search',
      };
    }

    // ==========================================================================
    // CULTURAL HERITAGE (Europeana)
    // ==========================================================================
    
    const culturePatterns = [
      'europeana', 'european cultural heritage', 'european museum',
      'european art history', 'european artifact'
    ];
    
    if (culturePatterns.some(p => q.includes(p))) {
      return {
        provider: 'europeana',
        confidence: 0.88,
        reason: 'European cultural heritage query',
        suggestedMode: 'search',
      };
    }
    
    // General art/museum queries - route to Met Museum
    const generalArtPatterns = [
      'painting', 'sculpture', 'artwork', 'masterpiece', 'gallery',
      'artifact', 'renaissance', 'baroque', 'impressionist', 'modern art',
      'classical art', 'fine art'
    ];
    
    if (generalArtPatterns.some(p => q.includes(p))) {
      return {
        provider: 'metmuseum',
        confidence: 0.85,
        reason: 'Art/museum query',
        suggestedMode: 'search',
      };
    }

    // ==========================================================================
    // SPECIES OBSERVATIONS & PHOTOS (iNaturalist) - Must come before GBIF
    // ==========================================================================
    
    const inatPatterns = [
      'species observation', 'wildlife photo', 'identify species', 'what bird is this',
      'what animal is this', 'inaturalist', 'species sighting', 'nature observation',
      'wildlife sighting', 'spotted animal', 'wildlife near', 'nature photo',
      'identify bird', 'identify plant', 'species identification', 'citizen science'
    ];
    
    if (inatPatterns.some(p => q.includes(p))) {
      return {
        provider: 'inaturalist',
        confidence: 0.92,
        reason: 'Species observation/identification query',
        suggestedMode: 'nature',
      };
    }

    // ==========================================================================
    // NATURE & BIODIVERSITY (GBIF) - Scientific taxonomy data
    // ==========================================================================
    
    const gbifPatterns = [
      'species data', 'taxonomy', 'taxonomic', 'genus', 'phylum', 'kingdom',
      'scientific name', 'binomial name', 'gbif', 'biodiversity data',
      'species distribution', 'occurrence data', 'specimen data', 'herbarium',
      'endemic species', 'native species', 'invasive species'
    ];
    
    if (gbifPatterns.some(p => q.includes(p))) {
      return {
        provider: 'gbif',
        confidence: 0.92,
        reason: 'Biodiversity/taxonomy query',
        suggestedMode: 'nature',
      };
    }
    
    // General nature queries - route to iNaturalist for better user experience (photos)
    const generalNaturePatterns = [
      'animal', 'bird', 'mammal', 'reptile', 'amphibian', 'insect', 'butterfly',
      'fish', 'wildlife', 'endangered species', 'conservation', 'ecosystem',
      'flora', 'fauna', 'marine life', 'ocean life', 'rainforest animal'
    ];
    
    if (generalNaturePatterns.some(p => q.includes(p))) {
      return {
        provider: 'inaturalist',
        confidence: 0.85,
        reason: 'Nature/wildlife query',
        suggestedMode: 'nature',
      };
    }

    // ==========================================================================
    // AI/ML & COMPUTER SCIENCE (arXiv)
    // ==========================================================================
    
    const arxivPatterns = [
      'transformer', 'neural network', 'deep learning', 'machine learning', 'llm',
      'large language model', 'gpt', 'bert', 'diffusion model', 'gan', 'reinforcement learning',
      'computer vision', 'nlp', 'natural language processing', 'arxiv', 'preprint',
      'attention mechanism', 'backpropagation', 'gradient descent', 'loss function',
      'convolutional', 'recurrent', 'autoencoder', 'embedding', 'fine-tuning',
      'quantum computing', 'algorithm', 'complexity theory', 'cryptography'
    ];
    
    if (arxivPatterns.some(p => q.includes(p))) {
      return {
        provider: 'arxiv',
        confidence: 0.92,
        reason: 'AI/ML or computer science research query',
        suggestedMode: 'academic',
      };
    }

    // ==========================================================================
    // OPEN ACCESS PAPERS (CORE)
    // ==========================================================================
    
    const corePatterns = [
      'open access', 'full text paper', 'free paper', 'core.ac.uk',
      'open research', 'repository paper', 'institutional repository',
      'download paper', 'pdf paper'
    ];
    
    if (corePatterns.some(p => q.includes(p))) {
      return {
        provider: 'core',
        confidence: 0.92,
        reason: 'Open access research query',
        suggestedMode: 'academic',
      };
    }

    // ==========================================================================
    // ACADEMIC RESEARCH (OpenAlex)
    // ==========================================================================
    
    const academicPatterns = [
      'paper', 'papers', 'study', 'studies', 'research', 'journal', 'publication',
      'citation', 'citations', 'peer-reviewed', 'scholarly', 'academic', 'thesis',
      'dissertation', 'professor', 'university', 'conference', 'proceedings',
      'literature review', 'meta-analysis', 'systematic review'
    ];
    
    if (academicPatterns.some(p => q.includes(p))) {
      return {
        provider: 'openalex',
        confidence: 0.88,
        reason: 'Academic research query',
        suggestedMode: 'academic',
      };
    }

    // ==========================================================================
    // GENERAL KNOWLEDGE (Wikipedia)
    // ==========================================================================
    
    // Definition queries
    if (q.startsWith('what is ') || q.startsWith('who is ') || q.startsWith('who was ') ||
        q.startsWith('define ') || q.startsWith('meaning of ') || q.startsWith('definition of ')) {
      return {
        provider: 'wikipedia',
        confidence: 0.88,
        reason: 'General knowledge/definition query',
        suggestedMode: 'search',
      };
    }
    
    // Historical queries
    const historyPatterns = [
      'history of', 'when was', 'when did', 'founded', 'invented', 'discovered',
      'ancient', 'medieval', 'century', 'war', 'revolution', 'empire', 'civilization',
      'biography', 'born', 'died', 'famous', 'notable'
    ];
    
    if (historyPatterns.some(p => q.includes(p))) {
      return {
        provider: 'wikipedia',
        confidence: 0.85,
        reason: 'Historical/biographical query',
        suggestedMode: 'search',
      };
    }

    // ==========================================================================
    // CURRENT EVENTS & REAL-TIME (Tavily)
    // ==========================================================================
    
    const currentPatterns = [
      'latest', 'breaking', 'today', 'yesterday', 'this week', 'this month',
      'current', 'now', 'recently', 'just announced', 'news', 'update',
      'stock price', 'weather', 'score', 'election', 'trending'
    ];
    
    if (currentPatterns.some(p => q.includes(p))) {
      return {
        provider: 'tavily',
        confidence: 0.90,
        reason: 'Current events/real-time query',
        suggestedMode: 'search',
      };
    }

    // ==========================================================================
    // SIMILARITY SEARCH (Exa)
    // ==========================================================================
    
    if (q.includes('similar to') || q.includes('like ') || q.includes('alternatives to') || 
        q.includes('companies like') || q.includes('startups like') || q.includes('tools like')) {
      return {
        provider: 'exa',
        confidence: 0.92,
        reason: 'Similarity search query',
        suggestedMode: 'similar',
      };
    }

    // ==========================================================================
    // TECHNICAL DOCUMENTATION (Firecrawl)
    // ==========================================================================
    
    const techPatterns = [
      'how to', 'tutorial', 'guide', 'documentation', 'example', 'best practices',
      'compare', 'vs', 'versus', 'difference between', 'step by step'
    ];
    
    if (techPatterns.some(p => q.includes(p))) {
      return {
        provider: 'firecrawl',
        confidence: 0.85,
        reason: 'Technical/documentation query',
        suggestedMode: 'technical',
        firecrawlOperation: 'search',
      };
    }

    // ==========================================================================
    // DEFAULT - Use Wikipedia for general queries, LLM for ambiguous ones
    // ==========================================================================
    
    // Simple factual questions default to Wikipedia
    if (q.startsWith('what ') || q.startsWith('who ') || q.startsWith('where ') || 
        q.startsWith('when ') || q.startsWith('why ') || q.startsWith('how ')) {
      return {
        provider: 'wikipedia',
        confidence: 0.6,
        reason: 'General factual question',
        suggestedMode: 'search',
      };
    }

    // Default - low confidence, let LLM decide
    return {
      provider: 'tavily',
      confidence: 0.4,
      reason: 'No clear pattern match - using general web search',
      suggestedMode: 'search',
    };
  }

  /**
   * Clear the classification cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Singleton instance
let routerInstance: SearchRouter | null = null;

export function getSearchRouter(): SearchRouter {
  if (!routerInstance) {
    routerInstance = new SearchRouter();
  }
  return routerInstance;
}

