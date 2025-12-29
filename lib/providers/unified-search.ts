import { Source } from '../types';
import { FirecrawlClient, CrawlToolResult, MapToolResult, ScrapeToolResult } from '../firecrawl';
import { TavilyClient, TavilySearchResponse } from './tavily-client';
import { ExaClient, ExaSearchResult } from './exa-client';
import { SemanticScholarClient, SemanticScholarSearchResult } from './semantic-scholar-client';
import { SearchRouter, QueryClassification, SearchProvider } from './search-router';
import { SEARCH_CONFIG, PROVIDER_CONFIG } from '../config';

// NEW: Import free API clients
import { OpenAlexClient, OpenAlexSearchResult } from './openalex-client';
import { WikipediaClient, WikipediaSearchResult } from './wikipedia-client';
import { ArxivClient, ArxivSearchResult } from './arxiv-client';
import { PubMedClient, PubMedSearchResult } from './pubmed-client';
import { NasaClient, NasaSearchResult } from './nasa-client';
import { GbifClient, GbifSearchResult } from './gbif-client';
import { CrossrefClient, CrossrefSearchResult } from './crossref-client';

// NEW EXPANDED: Import additional free API clients
import { CoreClient, CoreSearchResult } from './core-client';
import { ClinicalTrialsClient, ClinicalTrialSearchResult } from './clinicaltrials-client';
import { OpenFDAClient, OpenFDASearchResult } from './openfda-client';
import { USGSClient, USGSEarthquakeResult } from './usgs-client';
import { OpenLibraryClient, OpenLibrarySearchResult } from './openlibrary-client';
import { INaturalistClient, INaturalistSearchResult } from './inaturalist-client';
import { CourtListenerClient, CourtListenerSearchResult } from './courtlistener-client';
import { FREDClient, FREDSearchResult } from './fred-client';
import { WorldBankClient, WorldBankSearchResult } from './worldbank-client';
import { OpenMeteoClient, OpenMeteoSearchResult } from './openmeteo-client';
import { EuropeanaClient, EuropeanaSearchResult } from './europeana-client';
import { PubChemClient, PubChemSearchResult } from './pubchem-client';

// NEW HISTORY: Import history research API clients (100% FREE, no API key)
import { MetMuseumClient, MetMuseumSearchResult } from './met-client';
import { LibraryOfCongressClient, LOCSearchResult, ChroniclingAmericaResult } from './loc-client';
import { InternetArchiveClient, InternetArchiveSearchResult } from './internet-archive-client';
import { ArticClient, ArticSearchResult } from './artic-client';
import { HistoryClient, ThisDayInHistoryResult } from './history-client';

// NEW TREASURE HUNTING: Import treasure hunting API clients (100% FREE, no API key)
import { PASClient, PASSearchResult } from './pas-client';
import { PleiadesClient, PleiadesSearchResult } from './pleiades-client';
import { NOAAShipwrecksClient, ShipwreckSearchResult } from './noaa-shipwrecks-client';
import { NominatimClient, NominatimSearchResult } from './nominatim-client';
import { WikidataSPARQLClient, WikidataTreasureResult } from './wikipedia-client';

// COMPUTATIONAL KNOWLEDGE: Wolfram Alpha (Requires API Key)
import { WolframAlphaClient, WolframAlphaSearchResult } from './wolfram-alpha-client';

export interface UnifiedSearchResult {
  sources: Source[];
  provider: SearchProvider;
  classification: QueryClassification;
  preAnswer?: string; // Tavily can provide a pre-synthesized answer
  metadata?: {
    exaContext?: string;
    totalResults?: number;
  };
}

export interface UnifiedSearchOptions {
  maxResults?: number;
  forceProvider?: SearchProvider;
  includeDomains?: string[];
  excludeDomains?: string[];
}

export class UnifiedSearchProvider {
  // Original providers (require API keys)
  private tavilyClient: TavilyClient | null = null;
  private exaClient: ExaClient | null = null;
  private semanticScholarClient: SemanticScholarClient | null = null;
  private firecrawlClient: FirecrawlClient;
  private router: SearchRouter;
  
  // NEW: Free providers (no API key required)
  private openAlexClient: OpenAlexClient;
  private wikipediaClient: WikipediaClient;
  private arxivClient: ArxivClient;
  private pubmedClient: PubMedClient;
  private nasaClient: NasaClient;
  private gbifClient: GbifClient;
  private crossrefClient: CrossrefClient;
  
  // NEW EXPANDED: Additional free providers
  private coreClient: CoreClient;
  private clinicalTrialsClient: ClinicalTrialsClient;
  private openFDAClient: OpenFDAClient;
  private usgsClient: USGSClient;
  private openLibraryClient: OpenLibraryClient;
  private iNaturalistClient: INaturalistClient;
  private courtListenerClient: CourtListenerClient;
  private fredClient: FREDClient;
  private worldBankClient: WorldBankClient;
  private openMeteoClient: OpenMeteoClient;
  private europeanaClient: EuropeanaClient;
  private pubChemClient: PubChemClient;
  
  // NEW HISTORY: History research providers (100% FREE, no API key)
  private metMuseumClient: MetMuseumClient;
  private locClient: LibraryOfCongressClient;
  private internetArchiveClient: InternetArchiveClient;
  private articClient: ArticClient;
  private historyClient: HistoryClient;
  
  // NEW TREASURE HUNTING: Treasure hunting providers (100% FREE, no API key)
  private pasClient: PASClient;
  private pleiadesClient: PleiadesClient;
  private shipwrecksClient: NOAAShipwrecksClient;
  private nominatimClient: NominatimClient;
  private wikidataTreasureClient: WikidataSPARQLClient;
  
  // COMPUTATIONAL KNOWLEDGE: Wolfram Alpha (Requires API Key)
  private wolframAlphaClient: WolframAlphaClient;
  
  // Track provider availability
  private providerStatus: Record<SearchProvider, boolean> = {
    // Original (require API keys)
    tavily: false,
    exa: false,
    'semantic-scholar': false,
    firecrawl: true, // Always available (required)
    // NEW: Free providers (always available)
    openalex: true,
    arxiv: true,
    wikipedia: true,
    pubmed: true,
    nasa: true,
    gbif: true,
    crossref: true,
    // NEW EXPANDED: Additional free providers
    core: true,
    clinicaltrials: true,
    openfda: true,
    usgs: true,
    openlibrary: true,
    inaturalist: true,
    courtlistener: true,
    fred: false,       // Requires API key
    worldbank: true,
    openmeteo: true,
    europeana: false,  // Requires API key
    pubchem: true,
    // NEW HISTORY: History research providers (100% FREE, no API key)
    metmuseum: true,
    loc: true,
    internetarchive: true,
    artic: true,
    historyapi: true,
    // NEW TREASURE HUNTING: Treasure hunting providers (100% FREE, no API key)
    pas: true,
    pleiades: true,
    shipwrecks: true,
    nominatim: true,
    wikidatatreasure: true,
    // COMPUTATIONAL KNOWLEDGE: Wolfram Alpha (Requires API Key)
    wolframalpha: false,  // Requires API key
  };

  constructor(firecrawlClient: FirecrawlClient) {
    this.firecrawlClient = firecrawlClient;
    this.router = new SearchRouter();
    
    // Initialize FREE providers (optional API keys for higher rate limits)
    this.openAlexClient = new OpenAlexClient();  // Uses OPENALEX_API_KEY or OPENALEX_EMAIL
    this.wikipediaClient = new WikipediaClient();
    this.arxivClient = new ArxivClient();
    this.pubmedClient = new PubMedClient();      // Uses NCBI_API_KEY or PUBMED_API_KEY
    this.nasaClient = new NasaClient();          // Uses NASA_API_KEY or DEMO_KEY
    this.gbifClient = new GbifClient();
    this.crossrefClient = new CrossrefClient();  // Uses CROSSREF_API_TOKEN or CROSSREF_EMAIL
    
    // Initialize NEW EXPANDED free providers
    this.coreClient = new CoreClient();                  // Uses CORE_API_KEY (optional)
    this.clinicalTrialsClient = new ClinicalTrialsClient(); // No API key needed
    this.openFDAClient = new OpenFDAClient();            // Uses OPENFDA_API_KEY (optional)
    this.usgsClient = new USGSClient();                  // No API key needed
    this.openLibraryClient = new OpenLibraryClient();    // No API key needed
    this.iNaturalistClient = new INaturalistClient();    // No API key needed
    this.courtListenerClient = new CourtListenerClient(); // Uses COURTLISTENER_API_KEY (optional)
    this.fredClient = new FREDClient();                  // Uses FRED_API_KEY (required)
    this.worldBankClient = new WorldBankClient();        // No API key needed
    this.openMeteoClient = new OpenMeteoClient();        // No API key needed
    this.europeanaClient = new EuropeanaClient();        // Uses EUROPEANA_API_KEY (required)
    this.pubChemClient = new PubChemClient();            // No API key needed
    
    // Initialize NEW HISTORY free providers (100% FREE, no API key)
    this.metMuseumClient = new MetMuseumClient();        // No API key needed
    this.locClient = new LibraryOfCongressClient();      // No API key needed
    this.internetArchiveClient = new InternetArchiveClient(); // No API key needed
    this.articClient = new ArticClient();                // No API key needed
    this.historyClient = new HistoryClient();            // No API key needed
    
    // Initialize NEW TREASURE HUNTING free providers (100% FREE, no API key)
    this.pasClient = new PASClient();                    // No API key needed
    this.pleiadesClient = new PleiadesClient();          // No API key needed
    this.shipwrecksClient = new NOAAShipwrecksClient();  // No API key needed
    this.nominatimClient = new NominatimClient();        // No API key needed
    this.wikidataTreasureClient = new WikidataSPARQLClient(); // No API key needed
    
    // Initialize COMPUTATIONAL KNOWLEDGE providers (Requires API Key)
    this.wolframAlphaClient = new WolframAlphaClient();  // Uses WOLFRAM_ALPHA_APP_ID
    
    // Check optional provider availability
    if (this.fredClient.isAvailable()) {
      this.providerStatus.fred = true;
    }
    if (this.europeanaClient.isAvailable()) {
      this.providerStatus.europeana = true;
    }
    if (this.wolframAlphaClient.isAvailable()) {
      this.providerStatus.wolframalpha = true;
    }
    
    console.log('✓ Research providers initialized (34 providers: OpenAlex, Wikipedia, arXiv, PubMed, NASA, GBIF, Crossref, CORE, ClinicalTrials, OpenFDA, USGS, OpenLibrary, iNaturalist, CourtListener, FRED, WorldBank, Open-Meteo, Europeana, PubChem, Met Museum, Library of Congress, Internet Archive, Art Institute of Chicago, History API, PAS, Pleiades, Shipwrecks, Nominatim, WikidataTreasure, Wolfram Alpha)');
    
    // Initialize optional providers that require API keys
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Try to initialize Tavily
    if (process.env.TAVILY_API_KEY) {
      try {
        this.tavilyClient = new TavilyClient();
        this.providerStatus.tavily = true;
        console.log('✓ Tavily provider initialized');
      } catch (error) {
        console.warn('Tavily initialization failed:', error);
      }
    }

    // Try to initialize Exa
    if (process.env.EXA_API_KEY) {
      try {
        this.exaClient = new ExaClient();
        this.providerStatus.exa = true;
        console.log('✓ Exa provider initialized');
      } catch (error) {
        console.warn('Exa initialization failed:', error);
      }
    }

    // Initialize Semantic Scholar (always available, API key optional for higher rate limits)
    try {
      this.semanticScholarClient = new SemanticScholarClient();
      this.providerStatus['semantic-scholar'] = true;
      console.log('✓ Semantic Scholar provider initialized');
    } catch (error) {
      console.warn('Semantic Scholar initialization failed:', error);
    }

    // Log available providers
    const available = Object.entries(this.providerStatus)
      .filter(([, status]) => status)
      .map(([provider]) => provider);
    console.log('Available search providers:', available.join(', '));
  }

  /**
   * Get the status of all providers
   */
  getProviderStatus(): Record<SearchProvider, boolean> {
    return { ...this.providerStatus };
  }

  /**
   * Main search method with automatic routing
   */
  async search(
    query: string,
    options?: UnifiedSearchOptions
  ): Promise<UnifiedSearchResult> {
    // Classify the query to determine best provider
    const classification = await this.router.classifyQuery(query);
    
    // Use forced provider or classified provider
    let provider = options?.forceProvider || classification.provider;
    
    // Fallback if preferred provider is not available
    if (!this.providerStatus[provider]) {
      provider = this.getFallbackProvider(provider);
      classification.provider = provider;
      classification.reason = `Fallback to ${provider} (original provider unavailable)`;
    }

    const maxResults = options?.maxResults || SEARCH_CONFIG.MAX_SOURCES_PER_SEARCH;

    try {
      switch (provider) {
        case 'tavily':
          return await this.searchWithTavily(query, classification, {
            ...options,
            maxResults,
          });
        
        case 'exa':
          return await this.searchWithExa(query, classification, {
            ...options,
            maxResults,
          });
        
        case 'semantic-scholar':
          return await this.searchWithSemanticScholar(query, classification, {
            ...options,
            maxResults,
          });
        
        // NEW: Free providers
        case 'openalex':
          return await this.searchWithOpenAlex(query, classification, maxResults);
        
        case 'wikipedia':
          return await this.searchWithWikipedia(query, classification, maxResults);
        
        case 'arxiv':
          return await this.searchWithArxiv(query, classification, maxResults);
        
        case 'pubmed':
          return await this.searchWithPubMed(query, classification, maxResults);
        
        case 'nasa':
          return await this.searchWithNasa(query, classification, maxResults);
        
        case 'gbif':
          return await this.searchWithGbif(query, classification, maxResults);
        
        case 'crossref':
          return await this.searchWithCrossref(query, classification, maxResults);
        
        // NEW EXPANDED providers
        case 'core':
          return await this.searchWithCore(query, classification, maxResults);
        
        case 'clinicaltrials':
          return await this.searchWithClinicalTrials(query, classification, maxResults);
        
        case 'openfda':
          return await this.searchWithOpenFDA(query, classification, maxResults);
        
        case 'usgs':
          return await this.searchWithUSGS(query, classification, maxResults);
        
        case 'openlibrary':
          return await this.searchWithOpenLibrary(query, classification, maxResults);
        
        case 'inaturalist':
          return await this.searchWithINaturalist(query, classification, maxResults);
        
        case 'courtlistener':
          return await this.searchWithCourtListener(query, classification, maxResults);
        
        case 'fred':
          return await this.searchWithFRED(query, classification, maxResults);
        
        case 'worldbank':
          return await this.searchWithWorldBank(query, classification, maxResults);
        
        case 'openmeteo':
          return await this.searchWithOpenMeteo(query, classification, maxResults);
        
        case 'europeana':
          return await this.searchWithEuropeana(query, classification, maxResults);
        
        case 'pubchem':
          return await this.searchWithPubChem(query, classification, maxResults);
        
        // NEW HISTORY providers
        case 'metmuseum':
          return await this.searchWithMetMuseum(query, classification, maxResults);
        
        case 'loc':
          return await this.searchWithLOC(query, classification, maxResults);
        
        case 'internetarchive':
          return await this.searchWithInternetArchive(query, classification, maxResults);
        
        case 'artic':
          return await this.searchWithArtic(query, classification, maxResults);
        
        case 'historyapi':
          return await this.searchWithHistoryAPI(query, classification, maxResults);
        
        // NEW TREASURE HUNTING providers
        case 'pas':
          return await this.searchWithPAS(query, classification, maxResults);
        
        case 'pleiades':
          return await this.searchWithPleiades(query, classification, maxResults);
        
        case 'shipwrecks':
          return await this.searchWithShipwrecks(query, classification, maxResults);
        
        case 'nominatim':
          return await this.searchWithNominatim(query, classification, maxResults);
        
        case 'wikidatatreasure':
          return await this.searchWithWikidataTreasure(query, classification, maxResults);
        
        // COMPUTATIONAL KNOWLEDGE providers
        case 'wolframalpha':
          return await this.searchWithWolframAlpha(query, classification, maxResults);
        
        case 'firecrawl':
        default:
          return await this.searchWithFirecrawl(query, classification, {
            ...options,
            maxResults,
          });
      }
    } catch (error) {
      console.error(`Search failed with ${provider}:`, error);
      
      // Try fallback provider
      const fallback = this.getFallbackProvider(provider);
      if (fallback !== provider) {
        console.log(`Falling back to ${fallback}`);
        return this.search(query, { ...options, forceProvider: fallback });
      }
      
      throw error;
    }
  }

  /**
   * Search with Tavily
   */
  private async searchWithTavily(
    query: string,
    classification: QueryClassification,
    options: UnifiedSearchOptions
  ): Promise<UnifiedSearchResult> {
    if (!this.tavilyClient) {
      throw new Error('Tavily client not available');
    }

    const response: TavilySearchResponse = await this.tavilyClient.search(query, {
      maxResults: options.maxResults,
      searchDepth: 'advanced',
      includeAnswer: true,
      includeDomains: options.includeDomains,
      excludeDomains: options.excludeDomains,
    });

    // Convert to unified Source format
    const sources: Source[] = response.results.map((r) => ({
      url: r.url,
      title: r.title,
      content: r.content,
      quality: r.score,
      summary: r.content?.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT),
    }));

    return {
      sources,
      provider: 'tavily',
      classification,
      preAnswer: response.answer,
      metadata: {
        totalResults: response.results.length,
      },
    };
  }

  /**
   * Search with Exa
   */
  private async searchWithExa(
    query: string,
    classification: QueryClassification,
    options: UnifiedSearchOptions
  ): Promise<UnifiedSearchResult> {
    if (!this.exaClient) {
      throw new Error('Exa client not available');
    }

    let results: ExaSearchResult[];
    let exaContext: string | undefined;

    // Use different Exa modes based on classification
    switch (classification.suggestedMode) {
      case 'academic':
        results = await this.exaClient.searchAcademic(query, options.maxResults);
        break;
      
      case 'technical':
        results = await this.exaClient.searchTechnical(query, options.maxResults);
        break;
      
      case 'similar':
        // Extract URL from query if present
        const urlMatch = query.match(/https?:\/\/[^\s]+/);
        if (urlMatch) {
          results = await this.exaClient.findSimilar(urlMatch[0], {
            numResults: options.maxResults,
          });
        } else {
          // Fallback to regular search
          const response = await this.exaClient.search(query, {
            numResults: options.maxResults,
            includeDomains: options.includeDomains,
            excludeDomains: options.excludeDomains,
          });
          results = response.results;
          exaContext = response.context;
        }
        break;
      
      case 'research':
        // Use deep research if available
        try {
          const researchResponse = await this.exaClient.research(query);
          // Convert research response to search results
          results = researchResponse.sources.map(s => ({
            url: s.url,
            title: s.title,
            content: s.snippet,
            highlights: [s.snippet],
          }));
        } catch {
          // Fallback to regular search
          const response = await this.exaClient.search(query, {
            numResults: options.maxResults,
          });
          results = response.results;
        }
        break;
      
      default:
        const response = await this.exaClient.search(query, {
          numResults: options.maxResults,
          includeDomains: options.includeDomains,
          excludeDomains: options.excludeDomains,
        });
        results = response.results;
        exaContext = response.context;
    }

    // Convert to unified Source format
    const sources: Source[] = results.map((r) => ({
      url: r.url,
      title: r.title,
      content: r.content || r.highlights?.join('\n\n') || '',
      quality: r.score,
      summary: r.highlights?.[0] || r.content?.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT),
    }));

    return {
      sources,
      provider: 'exa',
      classification,
      metadata: {
        exaContext,
        totalResults: results.length,
      },
    };
  }

  /**
   * Search with Semantic Scholar
   */
  private async searchWithSemanticScholar(
    query: string,
    classification: QueryClassification,
    options: UnifiedSearchOptions
  ): Promise<UnifiedSearchResult> {
    if (!this.semanticScholarClient) {
      throw new Error('Semantic Scholar client not available');
    }

    const maxResults = options.maxResults || PROVIDER_CONFIG.SEMANTIC_SCHOLAR?.MAX_RESULTS || 10;
    
    const response = await this.semanticScholarClient.searchPapers(query, {
      limit: maxResults,
    });

    // Convert to unified Source format
    const sources: Source[] = response.results.map((r: SemanticScholarSearchResult) => ({
      url: r.url,
      title: r.title,
      content: r.content,
      quality: r.citationCount ? Math.min(r.citationCount / 1000, 1) : 0, // Normalize citation count as quality
      summary: r.content?.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT),
    }));

    return {
      sources,
      provider: 'semantic-scholar',
      classification,
      metadata: {
        totalResults: response.total,
      },
    };
  }

  /**
   * Search with Firecrawl - routes to appropriate operation based on classification
   */
  private async searchWithFirecrawl(
    query: string,
    classification: QueryClassification,
    options: UnifiedSearchOptions
  ): Promise<UnifiedSearchResult> {
    const operation = classification.firecrawlOperation || 'search';
    
    // Extract URL from query if present (for scrape/crawl/map operations)
    const urlMatch = query.match(/https?:\/\/[^\s<>"')\]]+/);
    const url = urlMatch ? urlMatch[0].replace(/[.,;:!?]+$/, '') : null;
    
    let sources: Source[] = [];
    
    switch (operation) {
      case 'scrape': {
        if (!url) {
          // Fall back to search if no URL provided
          return this.performFirecrawlSearch(query, classification, options);
        }
        
        console.log(`[Firecrawl] Scraping URL: ${url}`);
        const scrapeResult = await this.scrape(url, { onlyMainContent: true });
        
        if (scrapeResult.success && scrapeResult.markdown) {
          sources = [{
            url: scrapeResult.url,
            title: scrapeResult.title || url,
            content: scrapeResult.markdown,
            quality: 1.0,
          }];
        }
        break;
      }
      
      case 'crawl': {
        if (!url) {
          return this.performFirecrawlSearch(query, classification, options);
        }
        
        console.log(`[Firecrawl] Crawling website: ${url}`);
        const crawlResult = await this.crawl(url, {
          limit: Math.min(options.maxResults || 10, 15),
          maxDepth: 2,
        });
        
        if (crawlResult.success && crawlResult.pages.length > 0) {
          sources = crawlResult.pages.map(page => ({
            url: page.url,
            title: page.title || page.url,
            content: page.markdown,
            quality: 0.9,
          }));
        }
        break;
      }
      
      case 'map': {
        if (!url) {
          return this.performFirecrawlSearch(query, classification, options);
        }
        
        console.log(`[Firecrawl] Mapping website structure: ${url}`);
        const mapResult = await this.map(url, {
          limit: options.maxResults || 100,
        });
        
        if (mapResult.success && mapResult.links.length > 0) {
          // For map, return the discovered URLs as sources
          sources = mapResult.links.slice(0, 20).map(link => ({
            url: link,
            title: link,
            content: `Discovered URL: ${link}`,
            quality: 0.5,
          }));
          
          // Optionally scrape a few of the discovered URLs
          const topUrls = mapResult.links.slice(0, 3);
          const scrapePromises = topUrls.map(async (linkUrl) => {
            try {
              const result = await this.scrape(linkUrl, { onlyMainContent: true });
              if (result.success && result.markdown) {
                return {
                  url: result.url,
                  title: result.title || linkUrl,
                  content: result.markdown,
                  quality: 0.8,
                };
              }
            } catch {
              // Ignore scrape errors
            }
            return null;
          });
          
          const scrapedResults = await Promise.allSettled(scrapePromises);
          for (const result of scrapedResults) {
            if (result.status === 'fulfilled' && result.value) {
              sources.unshift(result.value);
            }
          }
        }
        break;
      }
      
      case 'search':
      default: {
        return this.performFirecrawlSearch(query, classification, options);
      }
    }
    
    return {
      sources,
      provider: 'firecrawl',
      classification,
      metadata: {
        totalResults: sources.length,
      },
    };
  }

  /**
   * Perform a standard Firecrawl search operation
   */
  private async performFirecrawlSearch(
    query: string,
    classification: QueryClassification,
    options: UnifiedSearchOptions
  ): Promise<UnifiedSearchResult> {
    const response = await this.firecrawlClient.search(query, {
      limit: options.maxResults,
      scrapeOptions: {
        formats: ['markdown'],
      },
    });

    // Convert to unified Source format
    const sources: Source[] = response.data.map((r: { url: string; title: string; markdown?: string; content?: string }) => ({
      url: r.url,
      title: r.title,
      content: r.markdown || r.content || '',
      quality: 0,
    }));

    return {
      sources,
      provider: 'firecrawl',
      classification,
      metadata: {
        totalResults: sources.length,
      },
    };
  }

  // ==========================================================================
  // NEW: Free Provider Search Methods
  // ==========================================================================

  /**
   * Search with OpenAlex (FREE - 209M+ academic works)
   */
  private async searchWithOpenAlex(
    query: string,
    classification: QueryClassification,
    maxResults: number
  ): Promise<UnifiedSearchResult> {
    const response = await this.openAlexClient.searchWorks(query, {
      limit: maxResults,
    });

    const sources: Source[] = response.results.map((r: OpenAlexSearchResult) => ({
      url: r.url,
      title: r.title,
      content: r.content,
      quality: r.citationCount ? Math.min(r.citationCount / 1000, 1) : 0.5,
      summary: r.content?.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT),
    }));

    return {
      sources,
      provider: 'openalex',
      classification,
      metadata: {
        totalResults: response.total,
      },
    };
  }

  /**
   * Search with Wikipedia (FREE - General knowledge)
   */
  private async searchWithWikipedia(
    query: string,
    classification: QueryClassification,
    maxResults: number
  ): Promise<UnifiedSearchResult> {
    const results = await this.wikipediaClient.searchWithContent(query, {
      limit: maxResults,
    });

    const sources: Source[] = results.map((r: WikipediaSearchResult) => ({
      url: r.url,
      title: r.title,
      content: r.content,
      quality: 0.8, // Wikipedia is generally reliable
      summary: r.snippet,
    }));

    return {
      sources,
      provider: 'wikipedia',
      classification,
      metadata: {
        totalResults: sources.length,
      },
    };
  }

  /**
   * Search with arXiv (FREE - Scientific preprints)
   */
  private async searchWithArxiv(
    query: string,
    classification: QueryClassification,
    maxResults: number
  ): Promise<UnifiedSearchResult> {
    const response = await this.arxivClient.search(query, {
      limit: maxResults,
    });

    const sources: Source[] = response.results.map((r: ArxivSearchResult) => ({
      url: r.url,
      title: r.title,
      content: r.content,
      quality: 0.9, // arXiv papers are high quality
      summary: r.content?.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT),
    }));

    return {
      sources,
      provider: 'arxiv',
      classification,
      metadata: {
        totalResults: response.total,
      },
    };
  }

  /**
   * Search with PubMed (FREE - Medical/biomedical research)
   */
  private async searchWithPubMed(
    query: string,
    classification: QueryClassification,
    maxResults: number
  ): Promise<UnifiedSearchResult> {
    const response = await this.pubmedClient.search(query, {
      limit: maxResults,
    });

    const sources: Source[] = response.results.map((r: PubMedSearchResult) => ({
      url: r.url,
      title: r.title,
      content: r.content,
      quality: 0.95, // PubMed is peer-reviewed
      summary: r.content?.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT),
    }));

    return {
      sources,
      provider: 'pubmed',
      classification,
      metadata: {
        totalResults: response.total,
      },
    };
  }

  /**
   * Search with NASA (FREE - Space and astronomy)
   */
  private async searchWithNasa(
    query: string,
    classification: QueryClassification,
    maxResults: number
  ): Promise<UnifiedSearchResult> {
    const response = await this.nasaClient.search(query, {
      limit: maxResults,
    });

    const sources: Source[] = response.results.map((r: NasaSearchResult) => ({
      url: r.url,
      title: r.title,
      content: r.content,
      quality: 0.9, // NASA is authoritative
      summary: r.content?.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT),
    }));

    return {
      sources,
      provider: 'nasa',
      classification,
      metadata: {
        totalResults: response.total,
      },
    };
  }

  /**
   * Search with GBIF (FREE - Biodiversity and nature)
   */
  private async searchWithGbif(
    query: string,
    classification: QueryClassification,
    maxResults: number
  ): Promise<UnifiedSearchResult> {
    const response = await this.gbifClient.searchSpecies(query, {
      limit: maxResults,
    });

    const sources: Source[] = response.results.map((r: GbifSearchResult) => ({
      url: r.url,
      title: r.title,
      content: r.content,
      quality: 0.85, // GBIF is scientific
      summary: r.content?.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT),
    }));

    return {
      sources,
      provider: 'gbif',
      classification,
      metadata: {
        totalResults: response.total,
      },
    };
  }

  /**
   * Search with Crossref (FREE - DOI and citations)
   */
  private async searchWithCrossref(
    query: string,
    classification: QueryClassification,
    maxResults: number
  ): Promise<UnifiedSearchResult> {
    // Check if it's a DOI lookup
    const doiMatch = query.match(/10\.\d{4,}\/[^\s]+/);
    
    let sources: Source[] = [];
    let total = 0;

    if (doiMatch) {
      // Direct DOI lookup
      const result = await this.crossrefClient.getByDoi(doiMatch[0]);
      if (result) {
        sources = [{
          url: result.url,
          title: result.title,
          content: result.content,
          quality: 1.0,
          summary: result.content?.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT),
        }];
        total = 1;
      }
    } else {
      // Regular search
      const response = await this.crossrefClient.searchWorks(query, {
        limit: maxResults,
      });
      sources = response.results.map((r: CrossrefSearchResult) => ({
        url: r.url,
        title: r.title,
        content: r.content,
        quality: r.citationCount ? Math.min(r.citationCount / 500, 1) : 0.5,
        summary: r.content?.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT),
      }));
      total = response.total;
    }

    return {
      sources,
      provider: 'crossref',
      classification,
      metadata: {
        totalResults: total,
      },
    };
  }

  // ==========================================================================
  // NEW EXPANDED: Additional Free Provider Search Methods
  // ==========================================================================

  /**
   * Search with CORE (FREE - 207M+ open access papers)
   */
  private async searchWithCore(
    query: string,
    classification: QueryClassification,
    maxResults: number
  ): Promise<UnifiedSearchResult> {
    const response = await this.coreClient.search(query, {
      limit: maxResults,
    });

    const sources: Source[] = response.results.map((r: CoreSearchResult) => ({
      url: r.url,
      title: r.title,
      content: r.content,
      quality: 0.85,
      summary: r.content?.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT),
    }));

    return {
      sources,
      provider: 'core',
      classification,
      metadata: {
        totalResults: response.total,
      },
    };
  }

  /**
   * Search with ClinicalTrials.gov (FREE - Clinical studies)
   */
  private async searchWithClinicalTrials(
    query: string,
    classification: QueryClassification,
    maxResults: number
  ): Promise<UnifiedSearchResult> {
    const response = await this.clinicalTrialsClient.search(query, {
      limit: maxResults,
    });

    const sources: Source[] = response.results.map((r: ClinicalTrialSearchResult) => ({
      url: r.url,
      title: r.title,
      content: r.content,
      quality: 0.9,
      summary: `${r.status} - ${r.conditions.join(', ')}`.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT),
    }));

    return {
      sources,
      provider: 'clinicaltrials',
      classification,
      metadata: {
        totalResults: response.total,
      },
    };
  }

  /**
   * Search with OpenFDA (FREE - Drug/device/food data)
   */
  private async searchWithOpenFDA(
    query: string,
    classification: QueryClassification,
    maxResults: number
  ): Promise<UnifiedSearchResult> {
    const response = await this.openFDAClient.search(query, {
      limit: maxResults,
    });

    const sources: Source[] = response.results.map((r: OpenFDASearchResult) => ({
      url: r.url,
      title: r.title,
      content: r.content,
      quality: 0.85,
      summary: r.content?.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT),
    }));

    return {
      sources,
      provider: 'openfda',
      classification,
      metadata: {
        totalResults: response.total,
      },
    };
  }

  /**
   * Search with USGS (FREE - Earthquake data)
   */
  private async searchWithUSGS(
    query: string,
    classification: QueryClassification,
    maxResults: number
  ): Promise<UnifiedSearchResult> {
    const response = await this.usgsClient.search(query, {
      limit: maxResults,
    });

    const sources: Source[] = response.results.map((r: USGSEarthquakeResult) => ({
      url: r.url,
      title: r.title,
      content: r.content,
      quality: 0.9,
      summary: `M${r.magnitude} - ${r.place}`.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT),
    }));

    return {
      sources,
      provider: 'usgs',
      classification,
      metadata: {
        totalResults: response.total,
      },
    };
  }

  /**
   * Search with Open Library (FREE - Books)
   */
  private async searchWithOpenLibrary(
    query: string,
    classification: QueryClassification,
    maxResults: number
  ): Promise<UnifiedSearchResult> {
    const response = await this.openLibraryClient.search(query, {
      limit: maxResults,
    });

    const sources: Source[] = response.results.map((r: OpenLibrarySearchResult) => ({
      url: r.url,
      title: r.title,
      content: r.content,
      quality: 0.8,
      summary: r.authors?.join(', ') || r.content?.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT),
    }));

    return {
      sources,
      provider: 'openlibrary',
      classification,
      metadata: {
        totalResults: response.total,
      },
    };
  }

  /**
   * Search with iNaturalist (FREE - Species/observations)
   */
  private async searchWithINaturalist(
    query: string,
    classification: QueryClassification,
    maxResults: number
  ): Promise<UnifiedSearchResult> {
    const response = await this.iNaturalistClient.searchSpecies(query, {
      limit: maxResults,
    });

    const sources: Source[] = response.results.map((r: INaturalistSearchResult) => ({
      url: r.url,
      title: r.title,
      content: r.content,
      quality: 0.85,
      summary: r.wikipediaSummary?.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT) || r.content?.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT),
    }));

    return {
      sources,
      provider: 'inaturalist',
      classification,
      metadata: {
        totalResults: response.total,
      },
    };
  }

  /**
   * Search with CourtListener (FREE - Legal opinions)
   */
  private async searchWithCourtListener(
    query: string,
    classification: QueryClassification,
    maxResults: number
  ): Promise<UnifiedSearchResult> {
    const response = await this.courtListenerClient.search(query, {
      limit: maxResults,
    });

    const sources: Source[] = response.results.map((r: CourtListenerSearchResult) => ({
      url: r.url,
      title: r.title,
      content: r.content,
      quality: 0.9,
      summary: `${r.court} - ${r.dateFiled || 'Unknown date'}`.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT),
    }));

    return {
      sources,
      provider: 'courtlistener',
      classification,
      metadata: {
        totalResults: response.total,
      },
    };
  }

  /**
   * Search with FRED (FREE with key - Economic data)
   */
  private async searchWithFRED(
    query: string,
    classification: QueryClassification,
    maxResults: number
  ): Promise<UnifiedSearchResult> {
    if (!this.fredClient.isAvailable()) {
      throw new Error('FRED API key not configured');
    }

    const response = await this.fredClient.search(query, {
      limit: maxResults,
    });

    const sources: Source[] = response.results.map((r: FREDSearchResult) => ({
      url: r.url,
      title: r.title,
      content: r.content,
      quality: 0.9,
      summary: `${r.frequency} - Last updated: ${r.lastUpdated}`.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT),
    }));

    return {
      sources,
      provider: 'fred',
      classification,
      metadata: {
        totalResults: response.total,
      },
    };
  }

  /**
   * Search with World Bank (FREE - Global development data)
   */
  private async searchWithWorldBank(
    query: string,
    classification: QueryClassification,
    maxResults: number
  ): Promise<UnifiedSearchResult> {
    const response = await this.worldBankClient.search(query, {
      limit: maxResults,
    });

    const sources: Source[] = response.results.map((r: WorldBankSearchResult) => ({
      url: r.url,
      title: r.title,
      content: r.content,
      quality: 0.85,
      summary: r.sourceNote?.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT) || r.content?.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT),
    }));

    return {
      sources,
      provider: 'worldbank',
      classification,
      metadata: {
        totalResults: response.total,
      },
    };
  }

  /**
   * Search with Open-Meteo (FREE - Weather data)
   */
  private async searchWithOpenMeteo(
    query: string,
    classification: QueryClassification,
    maxResults: number
  ): Promise<UnifiedSearchResult> {
    const response = await this.openMeteoClient.search(query, {
      limit: maxResults,
      includeForecast: true,
    });

    const sources: Source[] = response.results.map((r: OpenMeteoSearchResult) => ({
      url: r.url,
      title: r.title,
      content: r.content,
      quality: 0.9,
      summary: r.current ? `${r.current.temperature}°C - ${r.current.weatherDescription}` : r.content?.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT),
    }));

    return {
      sources,
      provider: 'openmeteo',
      classification,
      metadata: {
        totalResults: response.total,
      },
    };
  }

  /**
   * Search with Europeana (FREE with key - Cultural heritage)
   */
  private async searchWithEuropeana(
    query: string,
    classification: QueryClassification,
    maxResults: number
  ): Promise<UnifiedSearchResult> {
    if (!this.europeanaClient.isAvailable()) {
      throw new Error('Europeana API key not configured');
    }

    const response = await this.europeanaClient.search(query, {
      limit: maxResults,
    });

    const sources: Source[] = response.results.map((r: EuropeanaSearchResult) => ({
      url: r.url,
      title: r.title,
      content: r.content,
      quality: 0.85,
      summary: `${r.type} - ${r.dataProvider || 'Unknown provider'}`.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT),
    }));

    return {
      sources,
      provider: 'europeana',
      classification,
      metadata: {
        totalResults: response.total,
      },
    };
  }

  /**
   * Search with PubChem (FREE - Chemistry compounds)
   */
  private async searchWithPubChem(
    query: string,
    classification: QueryClassification,
    maxResults: number
  ): Promise<UnifiedSearchResult> {
    const response = await this.pubChemClient.search(query, {
      limit: maxResults,
    });

    const sources: Source[] = response.results.map((r: PubChemSearchResult) => ({
      url: r.url,
      title: r.title,
      content: r.content,
      quality: 0.9,
      summary: r.molecularFormula ? `Formula: ${r.molecularFormula}` : r.content?.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT),
    }));

    return {
      sources,
      provider: 'pubchem',
      classification,
      metadata: {
        totalResults: response.total,
      },
    };
  }

  // ==========================================================================
  // NEW HISTORY: History Research Provider Search Methods
  // ==========================================================================

  /**
   * Search with Metropolitan Museum of Art (FREE - 470K+ artworks)
   */
  private async searchWithMetMuseum(
    query: string,
    classification: QueryClassification,
    maxResults: number
  ): Promise<UnifiedSearchResult> {
    const response = await this.metMuseumClient.search(query, {
      limit: maxResults,
      hasImages: true,
    });

    const sources: Source[] = response.results.map((r: MetMuseumSearchResult) => ({
      url: r.url,
      title: r.title,
      content: r.content,
      quality: 0.9,
      summary: `${r.artistName || 'Unknown artist'} - ${r.objectDate || 'Date unknown'}. ${r.department || ''}`.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT),
    }));

    return {
      sources,
      provider: 'metmuseum',
      classification,
      metadata: {
        totalResults: response.total,
      },
    };
  }

  /**
   * Search with Library of Congress (FREE - 170M+ items)
   */
  private async searchWithLOC(
    query: string,
    classification: QueryClassification,
    maxResults: number
  ): Promise<UnifiedSearchResult> {
    // Check if query is specifically about newspapers
    const isNewspaperQuery = query.toLowerCase().includes('newspaper') || 
                            query.toLowerCase().includes('chronicling america');
    
    if (isNewspaperQuery) {
      const response = await this.locClient.searchNewspapers(query.replace(/newspaper|chronicling america/gi, '').trim() || query, {
        limit: maxResults,
      });

      const sources: Source[] = response.results.map((r: ChroniclingAmericaResult) => ({
        url: r.url,
        title: r.title,
        content: r.content,
        quality: 0.9,
        summary: `${r.newspaper} - ${r.date}. ${r.state || ''}`.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT),
      }));

      return {
        sources,
        provider: 'loc',
        classification,
        metadata: {
          totalResults: response.total,
        },
      };
    }

    const response = await this.locClient.search(query, {
      limit: maxResults,
    });

    const sources: Source[] = response.results.map((r: LOCSearchResult) => ({
      url: r.url,
      title: r.title,
      content: r.content,
      quality: 0.9,
      summary: `${r.type || 'Item'} - ${r.date || 'Date unknown'}`.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT),
    }));

    return {
      sources,
      provider: 'loc',
      classification,
      metadata: {
        totalResults: response.total,
      },
    };
  }

  /**
   * Search with Internet Archive (FREE - 40M+ books/media)
   */
  private async searchWithInternetArchive(
    query: string,
    classification: QueryClassification,
    maxResults: number
  ): Promise<UnifiedSearchResult> {
    const response = await this.internetArchiveClient.search(query, {
      limit: maxResults,
      sortBy: 'downloads',
    });

    const sources: Source[] = response.results.map((r: InternetArchiveSearchResult) => ({
      url: r.url,
      title: r.title,
      content: r.content,
      quality: 0.85,
      summary: `${r.mediaType || 'Item'} - ${r.creator?.join(', ') || 'Unknown creator'}`.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT),
    }));

    return {
      sources,
      provider: 'internetarchive',
      classification,
      metadata: {
        totalResults: response.total,
      },
    };
  }

  /**
   * Search with Art Institute of Chicago (FREE - 120K+ artworks)
   */
  private async searchWithArtic(
    query: string,
    classification: QueryClassification,
    maxResults: number
  ): Promise<UnifiedSearchResult> {
    const response = await this.articClient.search(query, {
      limit: maxResults,
    });

    const sources: Source[] = response.results.map((r: ArticSearchResult) => ({
      url: r.url,
      title: r.title,
      content: r.content,
      quality: 0.9,
      summary: `${r.artistName || 'Unknown artist'} - ${r.dateDisplay || 'Date unknown'}. ${r.department || ''}`.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT),
    }));

    return {
      sources,
      provider: 'artic',
      classification,
      metadata: {
        totalResults: response.total,
      },
    };
  }

  /**
   * Search with History API (FREE - Historical events by date)
   */
  private async searchWithHistoryAPI(
    query: string,
    classification: QueryClassification,
    maxResults: number
  ): Promise<UnifiedSearchResult> {
    // Try to extract date from query
    const dateMatch = query.match(/(\w+)\s+(\d{1,2})/i) || 
                     query.match(/(\d{1,2})\s+(\w+)/i);
    
    let month = new Date().getMonth() + 1;
    let day = new Date().getDate();
    
    if (dateMatch) {
      const monthNames: Record<string, number> = {
        january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
        july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
        jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
      };
      
      const monthStr = dateMatch[1].toLowerCase();
      const dayStr = dateMatch[2];
      
      if (monthNames[monthStr]) {
        month = monthNames[monthStr];
        day = parseInt(dayStr);
      } else if (monthNames[dateMatch[2]?.toLowerCase()]) {
        month = monthNames[dateMatch[2].toLowerCase()];
        day = parseInt(dateMatch[1]);
      }
    }

    const response = await this.historyClient.getByDate(month, day, {
      limit: maxResults,
    });

    const allEvents = [
      ...response.events,
      ...response.births,
      ...response.deaths,
    ].slice(0, maxResults);

    const sources: Source[] = allEvents.map((r: ThisDayInHistoryResult) => ({
      url: r.url,
      title: r.title,
      content: r.content,
      quality: 0.85,
      summary: `${r.category === 'birth' ? 'Born' : r.category === 'death' ? 'Died' : 'Event'}: ${r.year} - ${r.content.slice(0, 100)}`.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT),
    }));

    return {
      sources,
      provider: 'historyapi',
      classification,
      metadata: {
        totalResults: response.total,
      },
    };
  }

  // ==========================================================================
  // NEW TREASURE HUNTING: Treasure Hunting Provider Search Methods
  // ==========================================================================

  /**
   * Search with Portable Antiquities Scheme (FREE - 1.6M+ archaeological finds)
   */
  private async searchWithPAS(
    query: string,
    classification: QueryClassification,
    maxResults: number
  ): Promise<UnifiedSearchResult> {
    const response = await this.pasClient.search(query, {
      limit: maxResults,
    });

    const sources: Source[] = response.results.map((r: PASSearchResult) => ({
      url: r.url,
      title: r.title,
      content: r.content,
      quality: r.isTreasure ? 1.0 : 0.85,
      summary: `${r.objectType} - ${r.broadPeriod || 'Unknown period'}. ${r.county || 'Unknown location'}`.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT),
    }));

    return {
      sources,
      provider: 'pas',
      classification,
      metadata: {
        totalResults: response.total,
      },
    };
  }

  /**
   * Search with Pleiades (FREE - Ancient world locations)
   */
  private async searchWithPleiades(
    query: string,
    classification: QueryClassification,
    maxResults: number
  ): Promise<UnifiedSearchResult> {
    const response = await this.pleiadesClient.search(query, {
      limit: maxResults,
    });

    const sources: Source[] = response.results.map((r: PleiadesSearchResult) => ({
      url: r.url,
      title: r.title,
      content: r.content,
      quality: r.latitude && r.longitude ? 0.95 : 0.8,
      summary: r.description?.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT) || r.content?.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT),
    }));

    return {
      sources,
      provider: 'pleiades',
      classification,
      metadata: {
        totalResults: response.total,
      },
    };
  }

  /**
   * Search with NOAA Shipwrecks (FREE - Maritime treasure database)
   */
  private async searchWithShipwrecks(
    query: string,
    classification: QueryClassification,
    maxResults: number
  ): Promise<UnifiedSearchResult> {
    const response = await this.shipwrecksClient.search(query, {
      limit: maxResults,
    });

    const sources: Source[] = response.results.map((r: ShipwreckSearchResult) => ({
      url: r.url,
      title: r.title,
      content: r.content,
      quality: r.yearSunk ? 0.9 : 0.75,
      summary: `${r.featureType} - ${r.region || 'Unknown region'}${r.yearSunk ? ` (${r.yearSunk})` : ''}`.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT),
    }));

    return {
      sources,
      provider: 'shipwrecks',
      classification,
      metadata: {
        totalResults: response.total,
      },
    };
  }

  /**
   * Search with Nominatim (FREE - OpenStreetMap geocoding)
   */
  private async searchWithNominatim(
    query: string,
    classification: QueryClassification,
    maxResults: number
  ): Promise<UnifiedSearchResult> {
    const response = await this.nominatimClient.search(query, {
      limit: maxResults,
      addressDetails: true,
    });

    const sources: Source[] = response.results.map((r: NominatimSearchResult) => ({
      url: r.url,
      title: r.title,
      content: r.content,
      quality: r.importance,
      summary: r.displayName?.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT),
    }));

    return {
      sources,
      provider: 'nominatim',
      classification,
      metadata: {
        totalResults: response.total,
      },
    };
  }

  /**
   * Search with Wikidata SPARQL for treasures (FREE - Treasure hoards & sites)
   */
  private async searchWithWikidataTreasure(
    query: string,
    classification: QueryClassification,
    maxResults: number
  ): Promise<UnifiedSearchResult> {
    // Determine which type of treasure to search for based on query
    const q = query.toLowerCase();
    
    let response;
    if (q.includes('shipwreck') || q.includes('ship')) {
      response = await this.wikidataTreasureClient.searchShipwrecks(maxResults);
    } else if (q.includes('ruin') || q.includes('ancient')) {
      response = await this.wikidataTreasureClient.searchAncientRuins(maxResults);
    } else if (q.includes('archaeological') || q.includes('site')) {
      response = await this.wikidataTreasureClient.searchArchaeologicalSites({ limit: maxResults });
    } else if (q.includes('mine') || q.includes('mining')) {
      response = await this.wikidataTreasureClient.searchMines(maxResults);
    } else if (q.includes('artifact')) {
      response = await this.wikidataTreasureClient.searchNotableArtifacts(maxResults);
    } else if (q.includes('lost city') || q.includes('city')) {
      response = await this.wikidataTreasureClient.searchLostCities(maxResults);
    } else {
      // Default to treasure hoards
      response = await this.wikidataTreasureClient.searchTreasureHoards(maxResults);
    }

    const sources: Source[] = response.results.map((r: WikidataTreasureResult) => ({
      url: r.url,
      title: r.label,
      content: r.description || `${r.label}${r.country ? ` - ${r.country}` : ''}`,
      quality: r.coordinates ? 0.95 : 0.8,
      summary: `${r.description || 'Wikidata entry'}${r.country ? ` - ${r.country}` : ''}`.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT),
    }));

    return {
      sources,
      provider: 'wikidatatreasure',
      classification,
      metadata: {
        totalResults: response.total,
      },
    };
  }

  // ==========================================================================
  // COMPUTATIONAL KNOWLEDGE: Wolfram Alpha
  // ==========================================================================

  /**
   * Search with Wolfram Alpha (Computational Knowledge Engine)
   * Best for: Math, science, conversions, data computations
   */
  private async searchWithWolframAlpha(
    query: string,
    classification: QueryClassification,
    maxResults: number
  ): Promise<UnifiedSearchResult> {
    if (!this.wolframAlphaClient.isAvailable()) {
      throw new Error('Wolfram Alpha App ID not configured. Set WOLFRAM_ALPHA_APP_ID environment variable.');
    }

    const response = await this.wolframAlphaClient.search(query, {
      limit: maxResults,
    });

    const sources: Source[] = response.results.map((r: WolframAlphaSearchResult) => ({
      url: r.url,
      title: r.title,
      content: r.content,
      quality: response.success ? 0.95 : 0.5,
      summary: r.result || r.inputInterpretation || r.content?.slice(0, SEARCH_CONFIG.SUMMARY_CHAR_LIMIT),
    }));

    // If we have a pre-computed answer, include it in the metadata
    let preAnswer: string | undefined;
    if (response.success && response.results.length > 0) {
      const mainResult = response.results[0];
      if (mainResult.result) {
        preAnswer = `**${mainResult.inputInterpretation || query}** = ${mainResult.result}`;
        
        // Add additional context if available
        if (mainResult.pods && mainResult.pods.length > 1) {
          const additionalInfo = mainResult.pods
            .filter(p => p.id !== 'Input' && !p.primary)
            .slice(0, 3)
            .map(p => {
              const text = p.subpods[0]?.plaintext;
              return text ? `• **${p.title}**: ${text}` : null;
            })
            .filter(Boolean)
            .join('\n');
          
          if (additionalInfo) {
            preAnswer += `\n\n${additionalInfo}`;
          }
        }
      }
    }

    return {
      sources,
      provider: 'wolframalpha',
      classification,
      preAnswer,
      metadata: {
        totalResults: response.total,
      },
    };
  }

  /**
   * Get fallback provider when preferred is unavailable
   */
  private getFallbackProvider(preferred: SearchProvider): SearchProvider {
    // Prioritize free providers in fallback order
    const fallbackOrder: SearchProvider[] = [
      'openalex',       // Free academic (best general fallback)
      'wikipedia',      // Free general knowledge
      'core',           // Free open access papers
      'wolframalpha',   // Computational knowledge (if available)
      'metmuseum',      // Free art history
      'loc',            // Free primary sources
      'internetarchive', // Free historical books
      'pas',            // Free treasure hunting
      'pleiades',       // Free ancient world
      'shipwrecks',     // Free maritime
      'tavily',         // Paid but comprehensive
      'firecrawl',      // Always available
      'arxiv',          // Free scientific
      'pubmed',         // Free medical
      'openlibrary',    // Free books
      'worldbank',      // Free global data
      'artic',          // Free art
      'nominatim',      // Free geocoding
    ];
    
    for (const provider of fallbackOrder) {
      if (provider !== preferred && this.providerStatus[provider]) {
        return provider;
      }
    }
    
    // Last resort - firecrawl is always available
    return 'firecrawl';
  }

  /**
   * Search with a specific provider (bypass routing)
   */
  async searchWithProvider(
    query: string,
    provider: SearchProvider,
    options?: Omit<UnifiedSearchOptions, 'forceProvider'>
  ): Promise<UnifiedSearchResult> {
    return this.search(query, { ...options, forceProvider: provider });
  }

  /**
   * Parallel search across multiple providers
   */
  async searchMultiple(
    query: string,
    providers: SearchProvider[],
    options?: Omit<UnifiedSearchOptions, 'forceProvider'>
  ): Promise<UnifiedSearchResult[]> {
    const availableProviders = providers.filter(p => this.providerStatus[p]);
    
    const results = await Promise.allSettled(
      availableProviders.map(provider =>
        this.search(query, { ...options, forceProvider: provider })
      )
    );

    return results
      .filter((r): r is PromiseFulfilledResult<UnifiedSearchResult> => r.status === 'fulfilled')
      .map(r => r.value);
  }

  // ==========================================================================
  // Firecrawl Deep Extraction Tools
  // ==========================================================================

  /**
   * Scrape a single URL and convert it to clean, LLM-ready markdown.
   * Use this for deep extraction of specific pages like documentation, articles, or research papers.
   */
  async scrape(
    url: string,
    options?: {
      onlyMainContent?: boolean;
      includeLinks?: boolean;
    }
  ): Promise<ScrapeToolResult> {
    return this.firecrawlClient.scrapeForLLM(url, {
      onlyMainContent: options?.onlyMainContent ?? true,
      includeLinks: options?.includeLinks ?? false,
    });
  }

  /**
   * Crawl an entire website or subsection and convert all pages to markdown.
   * Use this for comprehensive research across documentation sites, research series, or technical wikis.
   * WARNING: This is a heavier operation - use 'map' first to scout the site structure if unsure.
   */
  async crawl(
    url: string,
    options?: {
      limit?: number;
      maxDepth?: number;
      allowBackwardLinks?: boolean;
    }
  ): Promise<CrawlToolResult> {
    return this.firecrawlClient.crawl(url, {
      limit: Math.min(options?.limit ?? 10, 25),
      maxDepth: Math.min(options?.maxDepth ?? 2, 5),
      allowBackwardLinks: options?.allowBackwardLinks ?? false,
    });
  }

  /**
   * Scout a website's structure by mapping all discoverable URLs.
   * Use this BEFORE crawling to understand what content is available.
   * Returns a list of URLs that can then be selectively scraped or crawled.
   */
  async map(
    url: string,
    options?: {
      search?: string;
      limit?: number;
    }
  ): Promise<MapToolResult> {
    return this.firecrawlClient.mapUrl(url, {
      search: options?.search,
      limit: Math.min(options?.limit ?? 100, 1000),
    });
  }

  /**
   * Batch scrape multiple URLs in parallel.
   * Returns results for all URLs, with failures marked individually.
   */
  async batchScrape(
    urls: string[],
    options?: {
      onlyMainContent?: boolean;
    }
  ): Promise<ScrapeToolResult[]> {
    const results = await Promise.allSettled(
      urls.map(url =>
        this.firecrawlClient.scrapeForLLM(url, {
          onlyMainContent: options?.onlyMainContent ?? true,
          includeLinks: false,
        })
      )
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        success: false,
        url: urls[index],
        markdown: '',
        error: result.reason instanceof Error ? result.reason.message : 'Failed to scrape',
      };
    });
  }

  /**
   * Deep research a website: first map its structure, then selectively crawl relevant pages.
   * This is useful for comprehensive documentation or wiki research.
   */
  async deepResearch(
    url: string,
    options?: {
      searchFilter?: string;
      maxPages?: number;
      maxDepth?: number;
    }
  ): Promise<{
    success: boolean;
    baseUrl: string;
    discoveredUrls: number;
    crawledPages: number;
    pages: Array<{
      url: string;
      title?: string;
      markdown: string;
    }>;
    error?: string;
  }> {
    try {
      // First, map the website structure
      const mapResult = await this.map(url, {
        search: options?.searchFilter,
        limit: 100,
      });

      if (!mapResult.success || mapResult.links.length === 0) {
        return {
          success: false,
          baseUrl: url,
          discoveredUrls: 0,
          crawledPages: 0,
          pages: [],
          error: mapResult.error || 'No pages found to crawl',
        };
      }

      // Then crawl the discovered URLs
      const crawlResult = await this.crawl(url, {
        limit: options?.maxPages ?? 10,
        maxDepth: options?.maxDepth ?? 2,
      });

      return {
        success: crawlResult.success,
        baseUrl: url,
        discoveredUrls: mapResult.totalLinks,
        crawledPages: crawlResult.pagesCrawled,
        pages: crawlResult.pages,
        error: crawlResult.error,
      };
    } catch (error) {
      return {
        success: false,
        baseUrl: url,
        discoveredUrls: 0,
        crawledPages: 0,
        pages: [],
        error: error instanceof Error ? error.message : 'Deep research failed',
      };
    }
  }
}

