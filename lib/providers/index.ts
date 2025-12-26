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
export { 
  SearchRouter, 
  getSearchRouter, 
  type SearchProvider, 
  type QueryClassification,
  type FirecrawlOperation,
} from './search-router';
export { UnifiedSearchProvider, type UnifiedSearchResult, type UnifiedSearchOptions } from './unified-search';

// Re-export Firecrawl tools and types for convenience
export {
  FirecrawlClient,
  firecrawlTools,
  getFirecrawlTools,
  scrapeTool,
  crawlTool,
  mapTool,
  searchTool,
  type ScrapeToolResult,
  type CrawlToolResult,
  type MapToolResult,
  type SearchToolResult,
  type FirecrawlMetadata,
  type FirecrawlDocument,
} from '../firecrawl';

