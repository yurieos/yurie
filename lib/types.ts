// Shared types to avoid circular dependencies

export interface Source {
  url: string;
  title: string;
  content?: string;
  quality?: number;
  summary?: string;
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
  | { type: 'source-complete'; url: string; summary: string }
  | { type: 'provider-selected'; provider: string; reason: string };

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

