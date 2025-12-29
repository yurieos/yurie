// Shared types to avoid circular dependencies

// Evidence classification for research integrity
export type EvidenceClass = 
  | 'primary'     // 🟢 Direct experimental/observational data
  | 'meta'        // 🔵 Systematic reviews, meta-analyses
  | 'peer'        // 🟡 Peer-reviewed publications
  | 'expert'      // 🟠 Expert opinions, institutional reports
  | 'gray'        // ⚪ Pre-prints, white papers, news
  | 'anecdotal';  // 🔴 Case reports, forum discussions

// Evidence weight mapping
export const EVIDENCE_WEIGHTS: Record<EvidenceClass, number> = {
  primary: 1.0,
  meta: 0.95,
  peer: 0.85,
  expert: 0.70,
  gray: 0.50,
  anecdotal: 0.30,
};

// Evidence symbols for display
export const EVIDENCE_SYMBOLS: Record<EvidenceClass, string> = {
  primary: '🟢',
  meta: '🔵',
  peer: '🟡',
  expert: '🟠',
  gray: '⚪',
  anecdotal: '🔴',
};

// Research domain classification
export type ResearchDomain = 
  | 'scientific_discovery'
  | 'medical_drug'
  | 'historical'
  | 'treasure_archaeological'
  | 'legal'
  | 'economic'
  | 'environmental'
  | 'general';

// Research phase detection
export type ResearchPhase = 'exploratory' | 'confirmatory' | 'review';

// Consensus indicator
export type ConsensusLevel = 
  | 'strong'      // ✓✓✓ 3+ independent sources agree
  | 'moderate'    // ✓✓ 2 sources agree
  | 'conflicting' // ⚔ Sources disagree
  | 'sole';       // ◇ Only 1 source available

export const CONSENSUS_SYMBOLS: Record<ConsensusLevel, string> = {
  strong: '✓✓✓',
  moderate: '✓✓',
  conflicting: '⚔',
  sole: '◇',
};

// Quality flags for research integrity
export type QualityFlag = 
  | 'limited_data'      // 🚧 Fewer than 3 quality sources
  | 'controversy'       // ⚠️ Significant scientific disagreement
  | 'emerging'          // 🕐 Field evolving rapidly
  | 'funding_concern'   // 💰 Potential conflicts of interest
  | 'regional';         // 🌐 Findings may not generalize

export const QUALITY_FLAG_SYMBOLS: Record<QualityFlag, string> = {
  limited_data: '🚧',
  controversy: '⚠️',
  emerging: '🕐',
  funding_concern: '💰',
  regional: '🌐',
};

export interface Source {
  url: string;
  title: string;
  content?: string;
  quality?: number;
  summary?: string;
}

// Enhanced source with research-specific metadata
export interface EnhancedSource extends Source {
  // Evidence classification
  evidenceClass: EvidenceClass;
  evidenceWeight: number;
  
  // Authority scoring (0-1)
  authorityScore: number;
  
  // Publication metadata
  publicationDate?: string;
  authors?: string[];
  publisher?: string;
  doi?: string;
  
  // Research integrity fields
  peerReviewed: boolean;
  openAccess: boolean;
  conflictsOfInterest?: string[];
  fundingSource?: string;
  retractionStatus: 'none' | 'expression_of_concern' | 'retracted';
  
  // Study characteristics (for medical/scientific)
  studyDesign?: string;
  sampleSize?: number;
  populationType?: string;
  
  // Impact metrics
  citationCount?: number;
  altmetricScore?: number;
  
  // Consensus tracking
  consensusLevel?: ConsensusLevel;
  corroboratedBy?: string[]; // URLs of sources that agree
  contradictedBy?: string[]; // URLs of sources that disagree
}

// Research context for query understanding
export interface ResearchContext {
  domain: ResearchDomain;
  phase: ResearchPhase;
  requiresQuantitativeData: boolean;
  temporalSensitivity: 'high' | 'medium' | 'low';
  qualityFlags: QualityFlag[];
  overallConfidence: number; // 0-100
}

export interface SearchResult {
  url: string;
  title: string;
  content?: string;
  markdown?: string;
}

export type SearchPhase = 
  | 'understanding'
  | 'planning' 
  | 'searching'
  | 'analyzing'
  | 'synthesizing'
  | 'complete'
  | 'error';

export type ErrorType = 'search' | 'scrape' | 'llm' | 'unknown';

export interface SearchStep {
  id: SearchPhase | string;
  label: string;
  status: 'pending' | 'active' | 'completed';
  startTime?: number;
}

export type SearchEvent = 
  | { type: 'phase-update'; phase: SearchPhase; message: string }
  | { type: 'thinking'; message: string }
  | { type: 'searching'; query: string; index: number; total: number; provider?: string }
  | { type: 'found'; sources: Source[]; query: string; provider?: string }
  | { type: 'scraping'; url: string; index: number; total: number; query: string }
  | { type: 'content-chunk'; chunk: string }
  | { type: 'final-result'; content: string; sources: Source[]; followUpQuestions?: string[] }
  | { type: 'error'; error: string; errorType?: ErrorType }
  | { type: 'source-processing'; url: string; title: string; stage: 'browsing' | 'extracting' | 'analyzing' }
  | { type: 'source-complete'; url: string; summary: string; screenshot?: string }
  | { type: 'provider-selected'; provider: string; reason: string }
  // Visual Research Mode Events
  | { type: 'screenshot-captured'; url: string; screenshot: string; title?: string }
  | { type: 'visual-scraping'; url: string; index: number; total: number }
  | { type: 'visual-search-results'; results: VisualSearchResult[]; query: string };

// Visual Research Mode Types
export interface VisualSearchResult {
  url: string;
  title: string;
  description?: string;
  screenshot?: string;
  dateFound?: string;
}

// ============================================
// Message Types for Conversations
// ============================================

export type MessageType = 'text' | 'search-display' | 'markdown' | 'error';

// Message type for storage (without React nodes)
export interface StorableMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  searchResults?: string;
  type?: MessageType;
  sources?: Source[];
  followUpQuestions?: string[];
  searchEvents?: SearchEvent[];
}

// Message type for display - stores raw data, not JSX
export interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  type: MessageType;
  content: string;
  isStreaming?: boolean;
  sources?: Source[];
  followUpQuestions?: string[];
  searchEvents?: SearchEvent[];
  searchResults?: string;
}

