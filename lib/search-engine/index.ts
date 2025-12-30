/**
 * Search Engine Module
 * 
 * Exports the LangGraph search engine and related types.
 */

// Export state
export { SearchStateAnnotation, type SearchState } from './state';

// Export helpers
export {
  extractUrlsFromQuery,
  isCrawlOrMapQuery,
  scoreContent,
  summarizeContent,
  getInitialSteps,
  getCurrentDateContext,
  type GraphConfig,
} from './helpers';

// Export node handlers for modular graph construction
export * from './nodes';

// Re-export the main engine from the original file for backward compatibility
export { LangGraphSearchEngine } from '../langgraph-search-engine';

// Re-export types
export type { 
  Source, 
  SearchResult, 
  SearchPhase, 
  SearchEvent, 
  ErrorType, 
  SearchStep 
} from '../types';

