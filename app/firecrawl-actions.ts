'use server';

import { FirecrawlClient, ScrapeToolResult, CrawlToolResult, MapToolResult } from '@/lib/firecrawl';

// =============================================================================
// Search Types
// =============================================================================

export interface FirecrawlSearchResult {
  url: string;
  title: string;
  description: string;
  markdown: string;
  content: string;
  favicon: string | null;
  scraped: boolean;
  metadata?: Record<string, unknown>;
}

export interface FirecrawlSearchResponse {
  success: boolean;
  query: string;
  results: FirecrawlSearchResult[];
  total: number;
  error?: string;
}

// =============================================================================
// Search Actions
// =============================================================================

/**
 * Search the web using Firecrawl and get content from results.
 * Returns search results with scraped markdown content.
 */
export async function searchWeb(
  query: string,
  options?: {
    limit?: number;
    scrapeContent?: boolean;
    apiKey?: string;
  }
): Promise<FirecrawlSearchResponse> {
  try {
    const firecrawl = new FirecrawlClient(options?.apiKey);
    const result = await firecrawl.search(query, {
      limit: Math.min(options?.limit ?? 10, 20),
      scrapeOptions: options?.scrapeContent !== false ? {
        formats: ['markdown'],
      } : false,
    });

    return {
      success: true,
      query,
      results: result.data,
      total: result.data.length,
    };
  } catch (error) {
    return {
      success: false,
      query,
      results: [],
      total: 0,
      error: error instanceof Error ? error.message : 'Search failed',
    };
  }
}

/**
 * Search and extract: Combines search with deep content extraction.
 * First searches, then extracts full content from top results.
 */
export async function searchAndExtract(
  query: string,
  options?: {
    limit?: number;
    extractTop?: number;
    apiKey?: string;
  }
): Promise<{
  success: boolean;
  query: string;
  results: Array<{
    url: string;
    title: string;
    description: string;
    markdown: string;
    wordCount: number;
  }>;
  totalFound: number;
  extracted: number;
  error?: string;
}> {
  try {
    const firecrawl = new FirecrawlClient(options?.apiKey);
    
    // First, search
    const searchResult = await firecrawl.search(query, {
      limit: Math.min(options?.limit ?? 10, 20),
      scrapeOptions: {
        formats: ['markdown'],
      },
    });

    const extractTop = options?.extractTop ?? 5;
    const topResults = searchResult.data.slice(0, extractTop);

    // Results already have content from search with scrape
    const results = topResults.map((r: FirecrawlSearchResult) => ({
      url: r.url,
      title: r.title,
      description: r.description || '',
      markdown: r.markdown || r.content || '',
      wordCount: (r.markdown || r.content || '').trim().split(/\s+/).length,
    }));

    return {
      success: true,
      query,
      results,
      totalFound: searchResult.data.length,
      extracted: results.length,
    };
  } catch (error) {
    return {
      success: false,
      query,
      results: [],
      totalFound: 0,
      extracted: 0,
      error: error instanceof Error ? error.message : 'Search and extract failed',
    };
  }
}

/**
 * Scrape a single URL and convert it to clean, LLM-ready markdown.
 * Use this for deep extraction of specific pages like documentation, articles, or research papers.
 */
export async function scrapeUrl(
  url: string,
  options?: {
    onlyMainContent?: boolean;
    includeLinks?: boolean;
    apiKey?: string;
  }
): Promise<ScrapeToolResult> {
  const firecrawl = new FirecrawlClient(options?.apiKey);
  return firecrawl.scrapeForLLM(url, {
    onlyMainContent: options?.onlyMainContent ?? true,
    includeLinks: options?.includeLinks ?? false,
  });
}

/**
 * Crawl an entire website or subsection and convert all pages to markdown.
 * Use this for comprehensive research across documentation sites, research series, or technical wikis.
 * WARNING: This is a heavier operation - use 'mapUrl' first to scout the site structure if unsure.
 */
export async function crawlWebsite(
  url: string,
  options?: {
    limit?: number;
    maxDepth?: number;
    allowBackwardLinks?: boolean;
    apiKey?: string;
  }
): Promise<CrawlToolResult> {
  const firecrawl = new FirecrawlClient(options?.apiKey);
  return firecrawl.crawl(url, {
    limit: Math.min(options?.limit ?? 10, 25),
    maxDepth: Math.min(options?.maxDepth ?? 2, 5),
    allowBackwardLinks: options?.allowBackwardLinks ?? false,
  });
}

/**
 * Scout a website's structure by mapping all discoverable URLs.
 * Use this BEFORE crawling to understand what content is available.
 * Returns a list of URLs that can then be selectively scraped or crawled.
 * This is fast and lightweight - the Explorer's reconnaissance tool.
 */
export async function mapWebsite(
  url: string,
  options?: {
    search?: string;
    limit?: number;
    apiKey?: string;
  }
): Promise<MapToolResult> {
  const firecrawl = new FirecrawlClient(options?.apiKey);
  return firecrawl.mapUrl(url, {
    search: options?.search,
    limit: Math.min(options?.limit ?? 100, 1000),
  });
}

/**
 * Deep extract content from a URL - combines scraping with LLM-ready formatting.
 * Returns the content in a format optimized for AI processing.
 */
export async function deepExtract(
  url: string,
  options?: {
    apiKey?: string;
  }
): Promise<{
  success: boolean;
  url: string;
  title?: string;
  markdown: string;
  wordCount: number;
  error?: string;
}> {
  const firecrawl = new FirecrawlClient(options?.apiKey);
  const result = await firecrawl.scrapeForLLM(url, {
    onlyMainContent: true,
    includeLinks: false,
  });

  const wordCount = result.markdown
    ? result.markdown.trim().split(/\s+/).length
    : 0;

  return {
    ...result,
    wordCount,
  };
}

/**
 * Batch scrape multiple URLs in parallel.
 * Returns results for all URLs, with failures marked individually.
 */
export async function batchScrape(
  urls: string[],
  options?: {
    onlyMainContent?: boolean;
    apiKey?: string;
  }
): Promise<ScrapeToolResult[]> {
  const firecrawl = new FirecrawlClient(options?.apiKey);
  
  const results = await Promise.allSettled(
    urls.map(url => 
      firecrawl.scrapeForLLM(url, {
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

