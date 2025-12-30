import { tavily } from "@tavily/core";
import { loggers } from '../utils/logger';

const log = loggers.provider;

export interface TavilySearchResult {
  url: string;
  title: string;
  content: string;
  rawContent?: string;
  score: number;
}

export interface TavilySearchResponse {
  answer?: string;
  results: TavilySearchResult[];
  query: string;
}

export class TavilyClient {
  private client: ReturnType<typeof tavily>;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.TAVILY_API_KEY;
    if (!key) {
      throw new Error('TAVILY_API_KEY is required');
    }
    this.client = tavily({ apiKey: key });
  }

  /**
   * Search with Tavily - optimized for factual, real-time queries
   */
  async search(
    query: string,
    options?: {
      maxResults?: number;
      searchDepth?: 'basic' | 'advanced';
      includeAnswer?: boolean;
      includeDomains?: string[];
      excludeDomains?: string[];
    }
  ): Promise<TavilySearchResponse> {
    try {
      const response = await this.client.search(query, {
        maxResults: options?.maxResults ?? 8,
        searchDepth: options?.searchDepth ?? 'advanced',
        includeAnswer: options?.includeAnswer ?? true,
        includeRawContent: 'text',
        includeDomains: options?.includeDomains,
        excludeDomains: options?.excludeDomains,
      });

      return {
        answer: response.answer,
        query: response.query,
        results: response.results.map((r) => ({
          url: r.url,
          title: r.title,
          content: r.rawContent || r.content,
          rawContent: r.rawContent,
          score: r.score,
        })),
      };
    } catch (error) {
      log.debug('Tavily search error:', error);
      throw error;
    }
  }

  /**
   * Extract content from specific URLs
   */
  async extract(urls: string[]): Promise<Array<{ url: string; content: string }>> {
    try {
      const response = await this.client.extract(urls);
      return response.results.map((r) => ({
        url: r.url,
        content: r.rawContent,
      }));
    } catch (error) {
      log.debug('Tavily extract error:', error);
      throw error;
    }
  }
}


