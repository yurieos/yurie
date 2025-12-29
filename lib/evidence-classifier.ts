/**
 * Evidence Classifier
 * 
 * Automatically classifies sources by evidence type and calculates authority scores
 * for the Research Intelligence Protocol
 */

import { 
  Source, 
  EnhancedSource, 
  EvidenceClass, 
  EVIDENCE_WEIGHTS,
  ConsensusLevel,
  QualityFlag,
  ResearchContext,
  ResearchDomain,
  ResearchPhase
} from './types';

// =============================================================================
// URL PATTERN MATCHERS
// =============================================================================

const PRIMARY_SOURCE_PATTERNS = [
  // Clinical trial registries
  /clinicaltrials\.gov/i,
  /who\.int\/clinical-trials/i,
  /isrctn\.com/i,
  
  // Government data
  /data\.gov/i,
  /census\.gov/i,
  /bls\.gov/i,
  /cdc\.gov\/data/i,
  /fda\.gov/i,
  
  // Scientific databases with original data
  /ncbi\.nlm\.nih\.gov\/geo/i, // Gene Expression Omnibus
  /ebi\.ac\.uk\/arrayexpress/i,
  /wwpdb\.org/i, // Protein Data Bank
  
  // Archaeological databases
  /finds\.org\.uk/i, // PAS
  /awois\.noaa\.gov/i, // Shipwrecks
];

const META_ANALYSIS_PATTERNS = [
  /cochrane/i,
  /systematic.?review/i,
  /meta.?analysis/i,
  /prisma/i,
];

const PEER_REVIEWED_DOMAINS = [
  // Major publishers
  'nature.com',
  'science.org',
  'sciencedirect.com',
  'springer.com',
  'wiley.com',
  'tandfonline.com',
  'sagepub.com',
  'oup.com', // Oxford University Press
  'cambridge.org',
  'cell.com',
  'nejm.org',
  'thelancet.com',
  'bmj.com',
  'jamanetwork.com',
  'pnas.org',
  'plos.org',
  'frontiersin.org',
  'mdpi.com',
  'hindawi.com',
  'acs.org', // American Chemical Society
  'rsc.org', // Royal Society of Chemistry
  'iop.org', // Institute of Physics
  'aps.org', // American Physical Society
  'ieee.org',
  'acm.org',
  
  // Academic repositories
  'jstor.org',
  'pubmed.ncbi.nlm.nih.gov',
  'ncbi.nlm.nih.gov/pmc',
  'europepmc.org',
  'doaj.org',
  
  // Institutional
  'arxiv.org', // Pre-print but high quality
  'biorxiv.org',
  'medrxiv.org',
  'ssrn.com',
];

const EXPERT_INSTITUTIONAL_PATTERNS = [
  // Government agencies
  /\.gov($|\/)/i,
  /\.gov\.[a-z]{2}($|\/)/i,
  
  // International organizations
  /who\.int/i,
  /worldbank\.org/i,
  /imf\.org/i,
  /un\.org/i,
  /oecd\.org/i,
  /europa\.eu/i,
  
  // Professional societies
  /ama-assn\.org/i,
  /heart\.org/i,
  /cancer\.org/i,
  /diabetes\.org/i,
  
  // Research institutions
  /\.edu($|\/)/i,
  /\.ac\.[a-z]{2}($|\/)/i,
  /nih\.gov/i,
  /nasa\.gov/i,
  /noaa\.gov/i,
  /usgs\.gov/i,
  
  // Think tanks
  /brookings\.edu/i,
  /rand\.org/i,
  /pewresearch\.org/i,
];

const GRAY_LITERATURE_PATTERNS = [
  // Pre-print servers (also peer but not yet reviewed)
  /arxiv\.org/i,
  /biorxiv\.org/i,
  /medrxiv\.org/i,
  /ssrn\.com/i,
  /preprints\.org/i,
  /osf\.io\/preprints/i,
  
  // News sources
  /reuters\.com/i,
  /apnews\.com/i,
  /bbc\.com|bbc\.co\.uk/i,
  /nytimes\.com/i,
  /washingtonpost\.com/i,
  /theguardian\.com/i,
  /economist\.com/i,
  /nature\.com\/news/i,
  /sciencemag\.org\/news/i,
  
  // Tech news
  /techcrunch\.com/i,
  /wired\.com/i,
  /arstechnica\.com/i,
  /theverge\.com/i,
  
  // White papers / company blogs
  /blog\./i,
  /medium\.com/i,
  /substack\.com/i,
];

const ANECDOTAL_PATTERNS = [
  // Forums
  /reddit\.com/i,
  /quora\.com/i,
  /stackexchange\.com/i,
  /stackoverflow\.com/i,
  
  // Social media
  /twitter\.com|x\.com/i,
  /facebook\.com/i,
  /linkedin\.com/i,
  
  // User-generated wikis
  /fandom\.com/i,
  /wikia\.com/i,
];

// =============================================================================
// CLASSIFICATION FUNCTIONS
// =============================================================================

/**
 * Classify a source's evidence type based on URL and content analysis
 */
export function classifyEvidenceType(source: Source): EvidenceClass {
  const url = source.url.toLowerCase();
  const content = (source.content || '').toLowerCase();
  const title = (source.title || '').toLowerCase();
  
  // Check for meta-analyses first (highest quality)
  if (META_ANALYSIS_PATTERNS.some(p => p.test(title) || p.test(content.slice(0, 1000)))) {
    return 'meta';
  }
  
  // Check for primary data sources
  if (PRIMARY_SOURCE_PATTERNS.some(p => p.test(url))) {
    return 'primary';
  }
  
  // Check for anecdotal sources (forums, social media)
  if (ANECDOTAL_PATTERNS.some(p => p.test(url))) {
    return 'anecdotal';
  }
  
  // Check for gray literature (pre-prints, news)
  if (GRAY_LITERATURE_PATTERNS.some(p => p.test(url))) {
    // Pre-prints are gray but higher quality than news
    if (/arxiv|biorxiv|medrxiv|ssrn|preprint/i.test(url)) {
      return 'gray'; // Could be upgraded to 'peer' after review
    }
    return 'gray';
  }
  
  // Check for peer-reviewed domains
  const domain = extractDomain(url);
  if (PEER_REVIEWED_DOMAINS.some(d => domain.includes(d))) {
    return 'peer';
  }
  
  // Check for expert/institutional sources
  if (EXPERT_INSTITUTIONAL_PATTERNS.some(p => p.test(url))) {
    return 'expert';
  }
  
  // Check Wikipedia separately (reliable but secondary)
  if (/wikipedia\.org/i.test(url)) {
    return 'expert'; // Wikipedia is a tertiary source but generally reliable
  }
  
  // Default to gray literature for unknown sources
  return 'gray';
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Calculate authority score (0-1) based on multiple factors
 */
export function calculateAuthorityScore(source: Source, evidenceClass: EvidenceClass): number {
  let score = EVIDENCE_WEIGHTS[evidenceClass];
  
  const url = source.url.toLowerCase();
  const content = source.content || '';
  
  // Boost for .gov, .edu domains
  if (/\.gov($|\/)/i.test(url)) {
    score = Math.min(score + 0.1, 1.0);
  }
  if (/\.edu($|\/)/i.test(url)) {
    score = Math.min(score + 0.05, 1.0);
  }
  
  // Boost for DOI presence (indicates formal publication)
  if (/doi\.org|doi:/i.test(content) || /doi\.org|doi:/i.test(url)) {
    score = Math.min(score + 0.05, 1.0);
  }
  
  // Boost for citation indicators
  if (/cited by|citations?:\s*\d+/i.test(content)) {
    score = Math.min(score + 0.03, 1.0);
  }
  
  // Penalty for very short content (likely incomplete)
  if (content.length < 500) {
    score = Math.max(score - 0.1, 0.1);
  }
  
  // Penalty for error indicators
  if (/page not found|404|access denied|paywall/i.test(content.slice(0, 500))) {
    score = Math.max(score - 0.3, 0.1);
  }
  
  return Math.round(score * 100) / 100; // Round to 2 decimal places
}

/**
 * Detect if source is peer-reviewed
 */
export function isPeerReviewed(source: Source): boolean {
  const url = source.url.toLowerCase();
  const content = (source.content || '').toLowerCase();
  
  // Check domain
  const domain = extractDomain(url);
  if (PEER_REVIEWED_DOMAINS.some(d => domain.includes(d))) {
    // Exclude news sections of journals
    if (!/\/news\//i.test(url) && !/\/blog\//i.test(url)) {
      return true;
    }
  }
  
  // Check for peer review indicators in content
  const peerReviewIndicators = [
    'peer-reviewed',
    'peer reviewed',
    'refereed',
    'accepted for publication',
    'manuscript received',
    'revised manuscript',
  ];
  
  return peerReviewIndicators.some(indicator => content.includes(indicator));
}

/**
 * Detect if source is open access
 */
export function isOpenAccess(source: Source): boolean {
  const url = source.url.toLowerCase();
  const content = (source.content || '').toLowerCase();
  
  // Open access indicators
  const openAccessPatterns = [
    /plos\./i,
    /frontiersin\.org/i,
    /mdpi\.com/i,
    /hindawi\.com/i,
    /bmc[a-z]*\.biomedcentral\.com/i,
    /ncbi\.nlm\.nih\.gov\/pmc/i,
    /europepmc\.org/i,
    /doaj\.org/i,
    /arxiv\.org/i,
    /biorxiv\.org/i,
    /medrxiv\.org/i,
    /wikipedia\.org/i,
    /wikimedia\.org/i,
  ];
  
  if (openAccessPatterns.some(p => p.test(url))) {
    return true;
  }
  
  // Check content for OA indicators
  const oaIndicators = [
    'open access',
    'creative commons',
    'cc by',
    'cc-by',
    'freely available',
    'public domain',
  ];
  
  return oaIndicators.some(indicator => content.includes(indicator));
}

/**
 * Extract publication date from content
 */
export function extractPublicationDate(source: Source): string | undefined {
  const content = source.content || '';
  
  // Common date patterns
  const datePatterns = [
    // ISO format: 2024-01-15
    /(?:published|date|posted|updated)[:\s]+(\d{4}-\d{2}-\d{2})/i,
    // Month DD, YYYY: January 15, 2024
    /(?:published|date|posted)[:\s]+([A-Z][a-z]+ \d{1,2},? \d{4})/i,
    // DD Month YYYY: 15 January 2024
    /(?:published|date|posted)[:\s]+(\d{1,2} [A-Z][a-z]+ \d{4})/i,
    // Year-Month: 2024-01
    /(?:published|date)[:\s]+(\d{4}-\d{2})(?!\d)/i,
  ];
  
  for (const pattern of datePatterns) {
    const match = content.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  // Try to find any year in title or first part of content
  const yearMatch = content.slice(0, 1000).match(/\b(20[0-2]\d)\b/);
  if (yearMatch) {
    return yearMatch[1];
  }
  
  return undefined;
}

/**
 * Detect potential conflicts of interest
 */
export function detectConflictsOfInterest(content: string): string[] {
  const conflicts: string[] = [];
  const lowerContent = content.toLowerCase();
  
  // Funding disclosure patterns
  const fundingPatterns = [
    /funded by ([^.]+)/gi,
    /supported by ([^.]+)/gi,
    /grant from ([^.]+)/gi,
    /financial support from ([^.]+)/gi,
  ];
  
  for (const pattern of fundingPatterns) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const funder = match[1].trim();
      // Check if it's industry funding
      if (/pharma|inc\.|corp\.|ltd\.|llc|company|industry/i.test(funder)) {
        conflicts.push(`Industry funding: ${funder.slice(0, 100)}`);
      }
    }
  }
  
  // Conflict of interest statements
  if (/conflict.{0,20}interest/i.test(lowerContent)) {
    const coiMatch = content.match(/conflict.{0,20}interest[:\s]+([^.]+)/i);
    if (coiMatch && !/no conflict|none declared|nothing to declare/i.test(coiMatch[1])) {
      conflicts.push(`Declared COI: ${coiMatch[1].slice(0, 100)}`);
    }
  }
  
  // Author affiliations with industry
  if (/author.{0,30}(pharma|biotech|inc\.|corp\.)/i.test(lowerContent)) {
    conflicts.push('Author affiliated with industry');
  }
  
  return conflicts;
}

/**
 * Extract DOI from content
 */
export function extractDOI(source: Source): string | undefined {
  const content = source.content || '';
  const url = source.url;
  
  // DOI patterns
  const doiPatterns = [
    /doi[:\s]+?(10\.\d{4,}\/[^\s"'<>]+)/i,
    /doi\.org\/(10\.\d{4,}\/[^\s"'<>]+)/i,
    /https?:\/\/dx\.doi\.org\/(10\.\d{4,}\/[^\s"'<>]+)/i,
  ];
  
  // Check URL first
  for (const pattern of doiPatterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  // Check content
  for (const pattern of doiPatterns) {
    const match = content.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return undefined;
}

// =============================================================================
// CONSENSUS DETECTION
// =============================================================================

/**
 * Determine consensus level by comparing sources on a topic
 */
export function determineConsensus(
  sources: EnhancedSource[],
  topic: string
): ConsensusLevel {
  if (sources.length === 0) return 'sole';
  if (sources.length === 1) return 'sole';
  
  // For now, use a simple heuristic based on source count
  // In production, this would use semantic similarity
  const relevantSources = sources.filter(s => 
    s.content && s.content.toLowerCase().includes(topic.toLowerCase())
  );
  
  if (relevantSources.length >= 3) return 'strong';
  if (relevantSources.length === 2) return 'moderate';
  return 'sole';
}

/**
 * Cross-reference sources to find agreements and disagreements
 */
export function crossReferenceSources(sources: EnhancedSource[]): EnhancedSource[] {
  // Group sources by similar content themes
  // For each source, identify which other sources corroborate or contradict
  
  return sources.map(source => {
    const corroboratedBy: string[] = [];
    const contradictedBy: string[] = [];
    
    // Simple keyword overlap for corroboration detection
    const sourceKeywords = extractKeywords(source.content || '');
    
    for (const other of sources) {
      if (other.url === source.url) continue;
      
      const otherKeywords = extractKeywords(other.content || '');
      const overlap = sourceKeywords.filter(k => otherKeywords.includes(k));
      
      // High overlap = likely corroboration
      if (overlap.length > sourceKeywords.length * 0.3) {
        corroboratedBy.push(other.url);
      }
    }
    
    return {
      ...source,
      corroboratedBy,
      contradictedBy,
      consensusLevel: corroboratedBy.length >= 2 ? 'strong' : 
                      corroboratedBy.length === 1 ? 'moderate' : 'sole',
    };
  });
}

/**
 * Extract keywords from content for comparison
 */
function extractKeywords(content: string): string[] {
  // Simple keyword extraction - in production, use NLP
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that',
    'these', 'those', 'it', 'its', 'they', 'their', 'them', 'we', 'our',
  ]);
  
  return content
    .toLowerCase()
    .split(/\W+/)
    .filter(word => word.length > 3 && !stopWords.has(word))
    .slice(0, 50); // Limit to first 50 keywords
}

// =============================================================================
// QUALITY FLAGS DETECTION
// =============================================================================

/**
 * Detect quality flags for the research context
 */
export function detectQualityFlags(
  sources: EnhancedSource[],
  domain: ResearchDomain
): QualityFlag[] {
  const flags: QualityFlag[] = [];
  
  // Limited data check
  const qualitySources = sources.filter(s => 
    s.evidenceClass === 'primary' || 
    s.evidenceClass === 'meta' || 
    s.evidenceClass === 'peer'
  );
  if (qualitySources.length < 3) {
    flags.push('limited_data');
  }
  
  // Funding concern check
  const sourcesWithConflicts = sources.filter(s => 
    s.conflictsOfInterest && s.conflictsOfInterest.length > 0
  );
  if (sourcesWithConflicts.length > sources.length * 0.5) {
    flags.push('funding_concern');
  }
  
  // Emerging field check (many pre-prints, recent dates)
  const grayLitCount = sources.filter(s => s.evidenceClass === 'gray').length;
  if (grayLitCount > sources.length * 0.5) {
    flags.push('emerging');
  }
  
  // Regional check (if most sources are from one region)
  // This would require more sophisticated analysis in production
  
  return flags;
}

// =============================================================================
// MAIN ENRICHMENT FUNCTION
// =============================================================================

/**
 * Enrich a source with research-specific metadata
 */
export function enrichSource(source: Source): EnhancedSource {
  const evidenceClass = classifyEvidenceType(source);
  const authorityScore = calculateAuthorityScore(source, evidenceClass);
  
  return {
    ...source,
    evidenceClass,
    evidenceWeight: EVIDENCE_WEIGHTS[evidenceClass],
    authorityScore,
    publicationDate: extractPublicationDate(source),
    peerReviewed: isPeerReviewed(source),
    openAccess: isOpenAccess(source),
    conflictsOfInterest: detectConflictsOfInterest(source.content || ''),
    doi: extractDOI(source),
    retractionStatus: 'none', // Would need external API to verify
    consensusLevel: 'sole', // Will be updated after cross-referencing
  };
}

/**
 * Enrich multiple sources and cross-reference them
 */
export function enrichSources(sources: Source[]): EnhancedSource[] {
  // First, enrich each source individually
  const enrichedSources = sources.map(enrichSource);
  
  // Then cross-reference for consensus detection
  return crossReferenceSources(enrichedSources);
}

/**
 * Build complete research context from enriched sources
 */
export function buildResearchContext(
  enrichedSources: EnhancedSource[],
  domain: ResearchDomain,
  query: string
): ResearchContext {
  const qualityFlags = detectQualityFlags(enrichedSources, domain);
  
  // Calculate overall confidence based on source quality
  let confidence = 0;
  if (enrichedSources.length > 0) {
    const avgAuthority = enrichedSources.reduce((sum, s) => sum + s.authorityScore, 0) / enrichedSources.length;
    const sourceCountBonus = Math.min(enrichedSources.length * 5, 25); // Up to 25% bonus for multiple sources
    const qualityPenalty = qualityFlags.length * 10; // 10% penalty per quality flag
    
    confidence = Math.min(Math.max(
      (avgAuthority * 75) + sourceCountBonus - qualityPenalty,
      10
    ), 95); // Cap between 10-95%
  }
  
  // Determine research phase from query
  let phase: ResearchPhase = 'exploratory';
  if (/review|meta-analysis|systematic|compare|versus/i.test(query)) {
    phase = 'review';
  } else if (/confirm|validate|replicate|verify/i.test(query)) {
    phase = 'confirmatory';
  }
  
  // Determine if quantitative data is required
  const requiresQuantitativeData = /how many|percentage|rate|statistics|data|numbers|figures/i.test(query);
  
  // Determine temporal sensitivity
  let temporalSensitivity: 'high' | 'medium' | 'low' = 'low';
  if (['medical_drug', 'economic'].includes(domain)) {
    temporalSensitivity = 'high';
  } else if (['scientific_discovery', 'legal'].includes(domain)) {
    temporalSensitivity = 'medium';
  }
  
  return {
    domain,
    phase,
    requiresQuantitativeData,
    temporalSensitivity,
    qualityFlags,
    overallConfidence: Math.round(confidence),
  };
}

