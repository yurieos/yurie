// Search Providers
export { TavilyClient, type TavilySearchResult, type TavilySearchResponse } from './tavily-client';
export { ExaClient, type ExaSearchResult, type ExaSearchResponse, type ExaResearchResponse } from './exa-client';
export { 
  SemanticScholarClient, 
  type SemanticScholarSearchResult, 
  type SemanticScholarSearchResponse,
  type SemanticScholarPaper,
  type SemanticScholarAuthor,
  type SemanticScholarAuthorDetails,
} from './semantic-scholar-client';
export { SearchRouter, getSearchRouter, type SearchProvider, type QueryClassification } from './search-router';
export { UnifiedSearchProvider, type UnifiedSearchResult, type UnifiedSearchOptions } from './unified-search';

