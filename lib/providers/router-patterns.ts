/**
 * Search Router Pattern Configuration
 * 
 * Data-driven configuration for query classification.
 * Replaces 1000+ lines of if/else chains with declarative config.
 * 
 * Each pattern config defines:
 * - provider: Which provider to route to
 * - patterns: Array of RegExp patterns to match
 * - keywords: Array of keywords to match (converted to patterns)
 * - confidence: Confidence score (0-1) when matched
 * - mode: Suggested search mode
 * - priority: Higher priority patterns are checked first
 */

import { SearchProvider } from './search-router';

export type SuggestedMode = 
  | 'search' 
  | 'similar' 
  | 'research' 
  | 'academic' 
  | 'technical' 
  | 'medical' 
  | 'nature' 
  | 'legal' 
  | 'economic' 
  | 'cultural';

export type FirecrawlOperation = 'search' | 'scrape' | 'crawl' | 'map';

export interface ProviderPatternConfig {
  provider: SearchProvider;
  patterns?: RegExp[];
  keywords?: string[];
  confidence: number;
  mode: SuggestedMode;
  reason: string;
  priority?: number;
  firecrawlOperation?: FirecrawlOperation;
}

/**
 * Provider pattern configurations ordered by priority.
 * Higher priority patterns are checked first.
 */
export const PROVIDER_PATTERNS: ProviderPatternConfig[] = [
  // ==========================================================================
  // PRIORITY 100: URL-based routing (Firecrawl)
  // ==========================================================================
  {
    provider: 'firecrawl',
    patterns: [/https?:\/\/.*(crawl|all pages|entire site|full site)/i],
    confidence: 0.98,
    mode: 'research',
    reason: 'Request to crawl entire website',
    priority: 100,
    firecrawlOperation: 'crawl',
  },
  {
    provider: 'firecrawl',
    patterns: [/https?:\/\/.*(map|structure|sitemap|list all urls|discover pages)/i],
    confidence: 0.98,
    mode: 'search',
    reason: 'Request to map website structure',
    priority: 100,
    firecrawlOperation: 'map',
  },
  {
    provider: 'firecrawl',
    patterns: [/https?:\/\//i],
    confidence: 0.95,
    mode: 'search',
    reason: 'Query contains URL for content extraction',
    priority: 99,
    firecrawlOperation: 'scrape',
  },

  // ==========================================================================
  // PRIORITY 95: DOI and Citation Lookups (Crossref)
  // ==========================================================================
  {
    provider: 'crossref',
    patterns: [/doi:/i, /\b10\.\d{4,}\//, /doi\.org\//i],
    confidence: 0.98,
    mode: 'academic',
    reason: 'DOI lookup query',
    priority: 95,
  },

  // ==========================================================================
  // PRIORITY 90: Mathematical & Computational (Wolfram Alpha)
  // ==========================================================================
  {
    provider: 'wolframalpha',
    keywords: [
      'calculate', 'compute', 'solve', 'evaluate', 'simplify', 'factor',
      'integrate', 'derivative', 'differentiate', 'limit', 'sum', 'product',
      'matrix', 'determinant', 'eigenvalue', 'eigenvector',
      'equation', 'inequality', 'system of equations',
      'prime factor', 'gcd', 'lcm', 'factorial', 'fibonacci',
    ],
    patterns: [
      /sin\(|cos\(|tan\(|log\(|ln\(|exp\(|sqrt\(/i,
      /x\^|x²|x³|∫|∂|Σ|∏|lim/i,
      /[\d]+\s*[\+\-\*\/\^\=]\s*[\d\w]/,
      /\b[xyz]\s*[\+\-\*\/\^\=]/i,
    ],
    confidence: 0.95,
    mode: 'search',
    reason: 'Mathematical calculation or equation query',
    priority: 90,
  },
  {
    provider: 'wolframalpha',
    patterns: [/\d+\s*\w+\s*(to|in)\s+\w+/i],
    keywords: [
      'convert', 'to celsius', 'to fahrenheit', 'to kelvin',
      'to miles', 'to kilometers', 'to meters', 'to feet', 'to inches',
      'to pounds', 'to kilograms', 'to grams', 'to ounces',
      'to liters', 'to gallons', 'to cups', 'to tablespoons',
      'to hours', 'to minutes', 'to seconds',
    ],
    confidence: 0.93,
    mode: 'search',
    reason: 'Unit conversion query',
    priority: 89,
  },
  {
    provider: 'wolframalpha',
    keywords: [
      'days until', 'days since', 'days between', 'time between',
      'how long until', 'how long since', 'how many days',
      'what day was', 'what day is', 'what day will',
      'day of the week', 'days from now', 'days ago',
      'time difference', 'time zone', 'sunrise', 'sunset',
    ],
    confidence: 0.92,
    mode: 'search',
    reason: 'Date/time calculation query',
    priority: 88,
  },
  {
    provider: 'wolframalpha',
    keywords: [
      'mean of', 'median of', 'mode of', 'standard deviation',
      'variance of', 'average of', 'sum of', 'statistics of',
      'probability', 'permutation', 'combination', 'binomial',
      'normal distribution', 'regression', 'correlation',
    ],
    confidence: 0.92,
    mode: 'search',
    reason: 'Statistical calculation query',
    priority: 87,
  },
  {
    provider: 'wolframalpha',
    keywords: [
      'compound interest', 'simple interest', 'mortgage', 'loan payment',
      'amortization', 'present value', 'future value', 'roi',
      'return on investment', 'break even', 'profit margin',
    ],
    confidence: 0.90,
    mode: 'search',
    reason: 'Financial calculation query',
    priority: 86,
  },
  {
    provider: 'wolframalpha',
    keywords: [
      'distance from', 'distance between', 'how far from', 'how far is',
      'speed of light', 'speed of sound', 'gravitational',
      'force between', 'energy of', 'wavelength of', 'frequency of',
    ],
    confidence: 0.88,
    mode: 'search',
    reason: 'Physical/distance calculation query',
    priority: 85,
  },

  // ==========================================================================
  // PRIORITY 80: Specialized Domains
  // ==========================================================================
  
  // Space & Astronomy (NASA)
  {
    provider: 'nasa',
    keywords: [
      'nasa', 'space', 'mars', 'jupiter', 'saturn', 'venus', 'mercury', 
      'neptune', 'uranus', 'pluto', 'asteroid', 'meteor', 'comet', 
      'galaxy', 'nebula', 'supernova', 'black hole', 'exoplanet',
      'astronaut', 'spacecraft', 'rocket', 'satellite', 'orbit', 
      'moon', 'lunar', 'solar', 'hubble', 'james webb', 'jwst', 
      'voyager', 'perseverance', 'curiosity', 'rover', 'constellation', 
      'star', 'cosmos', 'universe', 'astronomy', 'astrophysics',
      'international space station', 'iss', 'spacex', 'launch',
    ],
    confidence: 0.92,
    mode: 'search',
    reason: 'Space/astronomy query',
    priority: 80,
  },

  // Clinical Trials (must come before general medical)
  {
    provider: 'clinicaltrials',
    keywords: [
      'clinical trial', 'clinical study', 'recruiting trial', 
      'phase 1', 'phase 2', 'phase 3', 'drug trial', 'intervention study', 
      'randomized controlled', 'placebo controlled', 'clinicaltrials.gov', 
      'nct0', 'nct1', 'nct2', 'trial enrollment', 'recruiting study',
      'ongoing trial', 'completed trial',
    ],
    confidence: 0.95,
    mode: 'medical',
    reason: 'Clinical trial query',
    priority: 82,
  },

  // FDA/Drug Safety (must come before general medical)
  {
    provider: 'openfda',
    keywords: [
      'fda recall', 'fda approval', 'fda warning', 'drug recall', 
      'food recall', 'adverse event', 'drug label', 'drug interaction', 
      'contraindication', 'black box warning', 'medication guide', 
      'drug safety', 'medical device recall', 'fda approved', 'openfda',
    ],
    confidence: 0.95,
    mode: 'medical',
    reason: 'FDA/drug safety query',
    priority: 81,
  },

  // Chemistry (must come before general medical)
  {
    provider: 'pubchem',
    keywords: [
      // Core chemistry terms
      'molecular structure', 'molecular formula', 'molecular weight', 
      'chemical compound', 'chemical formula', 'smiles notation', 
      'pubchem', 'iupac name', 'chemical reaction', 
      'organic synthesis', 'organic chemistry', 'inorganic chemistry', 
      'polymer', 'isomer', 'cation', 'anion', 'covalent bond',
      'ionic bond', 'valence electron', 'chemical element',
      // Common compound-related queries
      'compound structure', 'structure of', 'chemical structure',
      'what is the formula', 'chemical properties of', 'molar mass',
      'compound formula', 'molecule structure', 'chemical name',
      // Common chemicals people search for
      'aspirin', 'caffeine', 'acetaminophen', 'ibuprofen', 'paracetamol',
      'benzene', 'ethanol', 'methanol', 'acetone', 'glucose', 'sucrose',
      'sodium chloride', 'potassium', 'magnesium', 'calcium carbonate',
      'sulfuric acid', 'hydrochloric acid', 'nitric acid', 'acetic acid',
      'ammonia', 'hydrogen peroxide', 'carbon dioxide', 'nitrogen',
      'methane', 'propane', 'butane', 'octane', 'hexane',
      // Drug compounds
      'melatonin', 'dopamine', 'serotonin', 'adrenaline', 'cortisol',
      'insulin', 'testosterone', 'estrogen', 'progesterone',
      'penicillin', 'amoxicillin', 'metformin', 'atorvastatin',
    ],
    patterns: [
      /\b\w+\s+compound\b/i,
      /\bformula\s+(of|for)\s+\w+/i,
      /\bstructure\s+(of|for)\s+\w+/i,
      /\bwhat\s+is\s+\w+\s+made\s+of/i,
      /\b(c\d+h\d+|h2o|co2|nacl|hcl|h2so4)\b/i,  // Chemical formulas
    ],
    confidence: 0.95,
    mode: 'search',
    reason: 'Chemistry/compound query',
    priority: 79,
  },

  // Medical & Health (PubMed)
  {
    provider: 'pubmed',
    keywords: [
      'disease', 'treatment', 'symptom', 'medication', 'patient', 
      'diagnosis', 'therapy', 'cancer', 'diabetes', 'heart disease', 
      'blood pressure', 'brain tumor', 'liver disease', 'kidney disease', 
      'lung disease', 'infection', 'virus', 'bacteria', 'antibiotic', 
      'vaccine', 'surgery', 'medical research', 'medicine', 
      'pharmaceutical', 'prescription', 'dosage', 'gene therapy',
      'genetic', 'dna sequencing', 'rna', 'protein', 'cell biology',
      'longevity', 'aging research', 'anti-aging', 'lifespan', 
      'senescence', 'ncbi', 'nih', 'cdc', 'who', 'pubmed', 'biomedical',
    ],
    confidence: 0.90,
    mode: 'medical',
    reason: 'Medical/health research query',
    priority: 78,
  },

  // Earthquakes & Geology (USGS)
  {
    provider: 'usgs',
    keywords: [
      'earthquake', 'seismic', 'magnitude', 'richter', 'tremor', 
      'aftershock', 'fault line', 'tectonic', 'usgs', 'geological survey', 
      'volcano', 'eruption', 'tsunami warning', 'quake',
    ],
    confidence: 0.95,
    mode: 'search',
    reason: 'Earthquake/geology query',
    priority: 80,
  },

  // Legal (CourtListener)
  {
    provider: 'courtlistener',
    keywords: [
      'court case', 'lawsuit', 'legal opinion', 'court ruling', 'verdict', 
      'supreme court', 'circuit court', 'appeals court', 'district court',
      'case law', 'legal precedent', 'plaintiff', 'defendant', 'litigation', 
      'judicial decision', 'roe v wade', 'brown v board', 'marbury v madison',
      'constitutional law', 'court decision', 'legal ruling', 'courtlistener',
      'scotus', 'court opinion',
    ],
    patterns: [/\b\w+\s+v\.?\s+\w+/i], // Case patterns like "Smith v. Jones"
    confidence: 0.92,
    mode: 'legal',
    reason: 'Legal/court case query',
    priority: 78,
  },

  // US Economics (FRED)
  {
    provider: 'fred',
    keywords: [
      'us gdp', 'us inflation', 'us unemployment', 'federal reserve', 
      'fed rate', 'us interest rate', 'us economic', 'cpi', 
      'consumer price index', 'monetary policy', 'fiscal policy', 
      'recession', 'fred data', 'treasury yield', 'm2 money', 
      'federal funds', 'us economy', 'american economy', 
      'united states gdp', 'united states unemployment',
    ],
    confidence: 0.92,
    mode: 'economic',
    reason: 'US economic data query',
    priority: 77,
  },

  // World Data (World Bank)
  {
    provider: 'worldbank',
    keywords: [
      'world bank', 'global development', 'country statistics', 
      'population of', 'poverty rate', 'life expectancy', 'gdp per capita', 
      'literacy rate', 'development indicator', 'world data', 
      'international statistics', 'global gdp', 'country gdp', 
      'world population', 'country population', 'infant mortality', 
      'global poverty', 'countries by',
    ],
    confidence: 0.90,
    mode: 'economic',
    reason: 'Global development data query',
    priority: 76,
  },

  // ==========================================================================
  // PRIORITY 70: Treasure Hunting & Archaeology
  // ==========================================================================
  
  // PAS (Portable Antiquities Scheme)
  {
    provider: 'pas',
    keywords: [
      // Core metal detecting terms
      'metal detecting', 'metal detector', 'detecting find', 
      'archaeological find', 'found with detector', 'uk find', 
      'england find', 'wales find', 'portable antiquities', 'pas database', 
      'treasure find', 'hoard find', 'roman coin', 'medieval coin',
      'bronze age artifact', 'iron age artifact', 'saxon', 'viking find', 
      'celtic', 'detector hobby', 'detectorist', 'mudlarking',
      // UK archaeological terms
      'uk treasure', 'english treasure', 'british treasure', 'welsh treasure',
      'anglo saxon', 'anglo-saxon', 'roman britain', 'british artifacts',
      'english artifact', 'uk artifact', 'uk hoard', 'english hoard',
      // Coin collecting / numismatics
      'ancient coin', 'old coin', 'coin find', 'coin hoard',
      'roman coins', 'medieval coins', 'saxon coins', 'viking coins',
      // Jewelry and precious items
      'ancient jewelry', 'old jewelry', 'brooch find', 'ring find',
      'gold artifact', 'silver artifact', 'bronze artifact',
      'ancient gold', 'ancient silver', 'ancient bronze',
    ],
    patterns: [
      /\b(metal\s+)?detect(or|ing|ed)\b/i,
      /\b(found|discovered)\s+(artifact|coin|treasure|hoard)/i,
      /\b(roman|medieval|saxon|viking|celtic)\s+(find|artifact|coin|treasure)/i,
    ],
    confidence: 0.92,
    mode: 'research',
    reason: 'Metal detecting / archaeological finds query',
    priority: 72,
  },

  // Pleiades (Ancient World Locations)
  {
    provider: 'pleiades',
    keywords: [
      // Core ancient location terms
      'ancient city', 'ancient town', 'ancient settlement', 'ancient site',
      'greek city', 'roman city', 'roman site', 'roman settlement', 
      'roman fort', 'egyptian temple', 'ancient temple', 'ancient road', 
      'roman road', 'via romana', 'ancient mine', 'ancient harbor', 
      'ancient port', 'amphitheater', 'ancient theater', 'pleiades', 
      'classical antiquity', 'hellenistic', 'ptolemaic',
      'ancient location', 'ancient coordinates',
      // Famous ancient places
      'pompeii', 'herculaneum', 'carthage', 'alexandria', 'petra',
      'ephesus', 'delphi', 'olympia', 'mycenae', 'knossos',
      'troy', 'thebes', 'memphis', 'babylon', 'persepolis',
      'colosseum', 'parthenon', 'acropolis', 'agora', 'forum',
      // Ancient civilizations
      'ancient greece', 'ancient rome', 'ancient egypt', 'ancient persia',
      'mesopotamia', 'sumeria', 'assyria', 'phoenicia', 'minoan',
      // Ancient structures
      'roman villa', 'roman baths', 'roman aqueduct', 'roman bridge',
      'ancient ruins', 'ancient wall', 'ancient fortress', 'ancient palace',
      'necropolis', 'ancient tomb', 'ancient cemetery', 'catacombs',
      'pyramid', 'obelisk', 'ancient monument',
    ],
    patterns: [
      /\bancient\s+(city|town|site|place|location)\b/i,
      /\b(roman|greek|egyptian)\s+(city|site|ruin|temple|fort)/i,
      /\bwhere\s+(was|is)\s+ancient\b/i,
      /\blocation\s+of\s+ancient\b/i,
    ],
    confidence: 0.90,
    mode: 'research',
    reason: 'Ancient world locations query',
    priority: 71,
  },

  // Shipwrecks (NOAA)
  {
    provider: 'shipwrecks',
    keywords: [
      // Core shipwreck terms
      'shipwreck', 'ship wreck', 'shipwrecks', 'sunken ship', 'sunken vessel', 
      'wreck location', 'underwater treasure', 'maritime treasure', 
      'naval disaster', 'ship sinking', 'treasure ship', 'galleon', 
      'spanish treasure', 'pirate ship', 'wreck diving', 'scuba wreck',
      'submerged wreck', 'awois', 'noaa wreck', 'ship graveyard',
      // Location-based queries
      'wrecks near', 'wrecks in', 'sunken ships near', 'ships sunk',
      'maritime disaster', 'vessel wreck', 'boat wreck', 'boat sinking',
      // Famous shipwrecks
      'titanic', 'lusitania', 'andrea doria', 'edmund fitzgerald',
      'uss monitor', 'uss arizona', 'bismarck', 'mary rose',
      // Diving/exploration
      'dive wreck', 'explore wreck', 'wreck site', 'underwater wreck',
      'ocean wreck', 'sea wreck', 'coastal wreck', 'reef wreck',
      // Historical maritime
      'lost ship', 'missing ship', 'sunk ship', 'foundered ship',
      'capsized ship', 'grounded ship', 'stranded ship',
    ],
    patterns: [
      /\bwreck(s|ed)?\s+(near|in|off|at)\b/i,
      /\bship(s)?\s+(sunk|sank|lost|wrecked)\b/i,
      /\bsunken\s+(ship|vessel|boat)s?\b/i,
      /\b(find|search|locate)\s+(shipwreck|wreck)/i,
    ],
    confidence: 0.92,
    mode: 'research',
    reason: 'Shipwreck / maritime treasure query',
    priority: 71,
  },

  // Wikidata Treasures
  {
    provider: 'wikidatatreasure',
    keywords: [
      'treasure hoard', 'buried treasure', 'hidden treasure', 'lost treasure',
      'famous treasure', 'treasure location', 'hoard location', 
      'treasure coordinates', 'lost gold', 'buried gold', 'hidden gold', 
      'treasure map location', 'legendary treasure', 'treasure discovery',
    ],
    confidence: 0.88,
    mode: 'research',
    reason: 'Treasure hoard / buried treasure query',
    priority: 70,
  },

  // Geocoding (Nominatim)
  {
    provider: 'nominatim',
    keywords: [
      'coordinates for', 'coordinates of', 'gps coordinates', 'lat long',
      'latitude longitude', 'geocode', 'where is located', 
      'exact location of', 'address to coordinates', 'find location',
    ],
    confidence: 0.85,
    mode: 'search',
    reason: 'Geocoding / coordinates query',
    priority: 69,
  },

  // General Treasure Hunting
  {
    provider: 'pas',
    keywords: [
      'treasure hunting', 'treasure hunt', 'gold prospecting', 'gold panning',
      'artifact hunting', 'relic hunting', 'cache hunting', 'geocaching treasure',
      'buried cache', 'hidden cache', 'lost mine', 'abandoned mine', 'ghost town',
    ],
    confidence: 0.80,
    mode: 'research',
    reason: 'General treasure hunting query',
    priority: 68,
  },

  // ==========================================================================
  // PRIORITY 65: Archives & Cultural Heritage
  // ==========================================================================
  
  // Library of Congress
  {
    provider: 'loc',
    keywords: [
      'library of congress', 'loc.gov', 'chronicling america', 
      'historical newspaper', 'old newspaper', 'newspaper archive', 
      'historical photograph', 'civil war photo', 'primary source', 
      'historical document', 'american history', 'historical map',
      'vintage photograph', 'old photograph', 'newspaper from', 
      'wwi newspaper', 'wwii newspaper', 'historical archives',
    ],
    confidence: 0.92,
    mode: 'cultural',
    reason: 'Library of Congress/primary source query',
    priority: 65,
  },

  // Internet Archive
  {
    provider: 'internetarchive',
    keywords: [
      'internet archive', 'archive.org', 'wayback machine', 'historical book',
      'old book', 'public domain book', 'historical text', 'vintage film',
      'historical recording', 'old recording', 'historical video', 
      'digitized book', 'out of print', 'rare book', 'historical audio',
    ],
    confidence: 0.92,
    mode: 'cultural',
    reason: 'Internet Archive/historical media query',
    priority: 65,
  },

  // European Cultural Heritage
  {
    provider: 'europeana',
    keywords: [
      'europeana', 'european cultural heritage', 'european museum',
      'european art history', 'european artifact',
    ],
    confidence: 0.88,
    mode: 'cultural',
    reason: 'European cultural heritage query',
    priority: 64,
  },

  // ==========================================================================
  // PRIORITY 60: Nature & Biodiversity
  // ==========================================================================
  
  // iNaturalist (species with photos)
  {
    provider: 'inaturalist',
    keywords: [
      'species observation', 'wildlife photo', 'identify species', 
      'what bird is this', 'what animal is this', 'inaturalist', 
      'species sighting', 'nature observation', 'wildlife sighting', 
      'spotted animal', 'wildlife near', 'nature photo', 'identify bird', 
      'identify plant', 'species identification', 'citizen science',
    ],
    confidence: 0.92,
    mode: 'nature',
    reason: 'Species observation/identification query',
    priority: 62,
  },

  // GBIF (taxonomy data)
  {
    provider: 'gbif',
    keywords: [
      'species data', 'taxonomy', 'taxonomic', 'genus', 'phylum', 'kingdom',
      'scientific name', 'binomial name', 'gbif', 'biodiversity data',
      'species distribution', 'occurrence data', 'specimen data', 'herbarium',
      'endemic species', 'native species', 'invasive species',
    ],
    confidence: 0.92,
    mode: 'nature',
    reason: 'Biodiversity/taxonomy query',
    priority: 61,
  },

  // General Nature (fallback to iNaturalist)
  {
    provider: 'inaturalist',
    keywords: [
      'animal', 'bird', 'mammal', 'reptile', 'amphibian', 'insect', 
      'butterfly', 'fish', 'wildlife', 'endangered species', 'conservation', 
      'ecosystem', 'flora', 'fauna', 'marine life', 'ocean life', 
      'rainforest animal',
    ],
    confidence: 0.85,
    mode: 'nature',
    reason: 'Nature/wildlife query',
    priority: 60,
  },

  // ==========================================================================
  // PRIORITY 55: Academic Research
  // ==========================================================================
  
  // AI/ML & Computer Science (arXiv)
  {
    provider: 'arxiv',
    keywords: [
      'transformer', 'neural network', 'deep learning', 'machine learning', 
      'llm', 'large language model', 'gpt', 'bert', 'diffusion model', 
      'gan', 'reinforcement learning', 'computer vision', 'nlp', 
      'natural language processing', 'arxiv', 'preprint',
      'attention mechanism', 'backpropagation', 'gradient descent', 
      'loss function', 'convolutional', 'recurrent', 'autoencoder', 
      'embedding', 'fine-tuning', 'quantum computing', 'algorithm', 
      'complexity theory', 'cryptography',
    ],
    confidence: 0.92,
    mode: 'academic',
    reason: 'AI/ML or computer science research query',
    priority: 56,
  },

  // Open Access Papers (CORE)
  {
    provider: 'core',
    keywords: [
      'open access', 'full text paper', 'free paper', 'core.ac.uk',
      'open research', 'repository paper', 'institutional repository',
      'download paper', 'pdf paper',
    ],
    confidence: 0.92,
    mode: 'academic',
    reason: 'Open access research query',
    priority: 55,
  },

  // General Academic (OpenAlex)
  {
    provider: 'openalex',
    keywords: [
      'paper', 'papers', 'study', 'studies', 'research', 'journal', 
      'publication', 'citation', 'citations', 'peer-reviewed', 'scholarly', 
      'academic', 'thesis', 'dissertation', 'professor', 'university', 
      'conference', 'proceedings', 'literature review', 'meta-analysis', 
      'systematic review',
    ],
    confidence: 0.88,
    mode: 'academic',
    reason: 'Academic research query',
    priority: 54,
  },

  // ==========================================================================
  // PRIORITY 50: General Knowledge (Wikipedia)
  // ==========================================================================
  {
    provider: 'wikipedia',
    patterns: [
      /^what is /i, /^who is /i, /^who was /i,
      /^define /i, /^meaning of /i, /^definition of /i,
    ],
    confidence: 0.88,
    mode: 'search',
    reason: 'General knowledge/definition query',
    priority: 52,
  },
  {
    provider: 'wikipedia',
    keywords: [
      'history of', 'when was', 'when did', 'founded', 'invented', 
      'discovered', 'ancient', 'medieval', 'century', 'war', 'revolution', 
      'empire', 'civilization', 'biography', 'born', 'died', 'famous', 
      'notable',
    ],
    confidence: 0.85,
    mode: 'search',
    reason: 'Historical/biographical query',
    priority: 51,
  },

  // ==========================================================================
  // PRIORITY 45: Current Events (Tavily)
  // ==========================================================================
  {
    provider: 'tavily',
    keywords: [
      'latest', 'breaking', 'today', 'yesterday', 'this week', 'this month',
      'current', 'now', 'recently', 'just announced', 'news', 'update',
      'stock price', 'election', 'trending',
    ],
    confidence: 0.90,
    mode: 'search',
    reason: 'Current events/real-time query',
    priority: 45,
  },

  // ==========================================================================
  // PRIORITY 40: Similarity Search (Exa)
  // ==========================================================================
  {
    provider: 'exa',
    keywords: [
      'similar to', 'like ', 'alternatives to', 'companies like', 
      'startups like', 'tools like',
    ],
    confidence: 0.92,
    mode: 'similar',
    reason: 'Similarity search query',
    priority: 40,
  },

  // ==========================================================================
  // PRIORITY 35: Technical Documentation (Firecrawl)
  // ==========================================================================
  {
    provider: 'firecrawl',
    keywords: [
      'how to', 'tutorial', 'guide', 'documentation', 'example', 
      'best practices', 'compare', 'vs', 'versus', 'difference between', 
      'step by step',
    ],
    confidence: 0.85,
    mode: 'technical',
    reason: 'Technical/documentation query',
    priority: 35,
    firecrawlOperation: 'search',
  },

  // ==========================================================================
  // PRIORITY 30: Simple Questions (Wikipedia fallback)
  // ==========================================================================
  {
    provider: 'wikipedia',
    patterns: [
      /^what /i, /^who /i, /^where /i, /^when /i, /^why /i, /^how /i,
    ],
    confidence: 0.6,
    mode: 'search',
    reason: 'General factual question',
    priority: 30,
  },
];

// =============================================================================
// Default classification when no patterns match
// =============================================================================

export const DEFAULT_CLASSIFICATION = {
  provider: 'tavily' as SearchProvider,
  confidence: 0.4,
  reason: 'No clear pattern match - using general web search',
  mode: 'search' as SuggestedMode,
};

// =============================================================================
// Helper function to compile patterns
// =============================================================================

/**
 * Convert keywords to regex patterns for matching
 * Uses word boundaries to prevent substring matches (e.g., "cation" matching "location")
 */
function keywordsToPatterns(keywords: string[]): RegExp[] {
  return keywords.map(kw => {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Use word boundaries for single words, but not for phrases (which already have implicit boundaries)
    const hasSpaces = kw.includes(' ');
    if (hasSpaces) {
      // Phrases: just match the phrase anywhere (spaces provide natural word separation)
      return new RegExp(escaped, 'i');
    } else {
      // Single words: use word boundaries to prevent substring matches
      return new RegExp(`\\b${escaped}\\b`, 'i');
    }
  });
}

/**
 * Compiled patterns cache for performance
 */
interface CompiledPattern {
  config: ProviderPatternConfig;
  allPatterns: RegExp[];
}

let compiledPatternsCache: CompiledPattern[] | null = null;

/**
 * Get compiled patterns sorted by priority
 */
export function getCompiledPatterns(): CompiledPattern[] {
  if (compiledPatternsCache) {
    return compiledPatternsCache;
  }

  // Sort by priority (higher first) and compile patterns
  compiledPatternsCache = [...PROVIDER_PATTERNS]
    .sort((a, b) => (b.priority ?? 50) - (a.priority ?? 50))
    .map(config => ({
      config,
      allPatterns: [
        ...(config.patterns ?? []),
        ...keywordsToPatterns(config.keywords ?? []),
      ],
    }));

  return compiledPatternsCache;
}

/**
 * Clear the compiled patterns cache (useful for testing)
 */
export function clearPatternsCache(): void {
  compiledPatternsCache = null;
}

