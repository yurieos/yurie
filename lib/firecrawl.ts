/**
 * Firecrawl Tools for Deep Research
 *
 * These tools complement other search providers by providing deep content extraction capabilities:
 * - scrape: Convert a single URL into clean LLM-ready markdown
 * - crawl: Ingest an entire site (or subsection) for comprehensive analysis
 * - map: Scout a website's structure to identify promising content trails
 * - search: Find and extract content from the web
 *
 * @see https://docs.firecrawl.dev/introduction
 */
import { tool } from "ai";
import { z } from "zod";
import FirecrawlApp from '@mendable/firecrawl-js';

// =============================================================================
// Types
// =============================================================================

export type FirecrawlMetadata = {
  title?: string;
  description?: string;
  language?: string;
  sourceURL?: string;
  statusCode?: number;
  robots?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  favicon?: string;
};

export type FirecrawlDocument = {
  markdown?: string;
  html?: string;
  metadata?: FirecrawlMetadata;
  links?: string[];
};

export type ScrapeResponse = {
  success: boolean;
  data?: FirecrawlDocument;
  error?: string;
};

export type CrawlResponse = {
  success: boolean;
  id?: string;
  url?: string;
  status?: string;
  total?: number;
  completed?: number;
  data?: FirecrawlDocument[];
  error?: string;
};

export type MapResponse = {
  success: boolean;
  links?: string[];
  error?: string;
};

// =============================================================================
// Configuration
// =============================================================================

const FIRECRAWL_API_BASE = "https://api.firecrawl.dev/v1";
const MAX_CRAWL_PAGES = 25; // Reasonable limit for deep research
const MAX_MARKDOWN_LENGTH = 15_000; // Truncate very long pages
const CRAWL_POLL_INTERVAL_MS = 2000;
const CRAWL_MAX_WAIT_MS = 120_000; // 2 minute timeout for crawls
const DEFAULT_SCRAPE_TIMEOUT = 15_000;

// =============================================================================
// Helpers
// =============================================================================

function getApiKey(): string {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Firecrawl is enabled, but FIRECRAWL_API_KEY is not set. " +
        "Add FIRECRAWL_API_KEY to your environment to use deep site analysis."
    );
  }
  return apiKey;
}

function truncateMarkdown(markdown: string, maxLength: number): string {
  if (markdown.length <= maxLength) {
    return markdown;
  }
  const truncated = markdown.slice(0, maxLength);
  // Try to cut at a reasonable boundary (paragraph or heading)
  const lastNewline = truncated.lastIndexOf("\n\n");
  const cutPoint = lastNewline > maxLength * 0.7 ? lastNewline : maxLength;
  return `${truncated.slice(0, cutPoint)}\n\n[... content truncated for length ...]`;
}

function formatDocumentForLLM(doc: FirecrawlDocument): string {
  const parts: string[] = [];

  if (doc.metadata?.title) {
    parts.push(`# ${doc.metadata.title}`);
  }

  if (doc.metadata?.description) {
    parts.push(`> ${doc.metadata.description}`);
  }

  if (doc.metadata?.sourceURL) {
    parts.push(`**Source:** ${doc.metadata.sourceURL}`);
  }

  parts.push("---");

  if (doc.markdown) {
    parts.push(truncateMarkdown(doc.markdown, MAX_MARKDOWN_LENGTH));
  }

  return parts.join("\n\n");
}

async function firecrawlRequest<T>(
  endpoint: string,
  options: RequestInit
): Promise<T> {
  const apiKey = getApiKey();

  const response = await fetch(`${FIRECRAWL_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Firecrawl API error (${response.status}): ${errorText || response.statusText}`
    );
  }

  return response.json() as Promise<T>;
}

async function pollCrawlStatus(crawlId: string): Promise<CrawlResponse> {
  const startTime = Date.now();

  while (Date.now() - startTime < CRAWL_MAX_WAIT_MS) {
    const status = await firecrawlRequest<CrawlResponse>(`/crawl/${crawlId}`, {
      method: "GET",
    });

    if (status.status === "completed") {
      return status;
    }

    if (status.status === "failed") {
      throw new Error(`Crawl failed: ${status.error || "Unknown error"}`);
    }

    // Wait before polling again
    await new Promise((resolve) => setTimeout(resolve, CRAWL_POLL_INTERVAL_MS));
  }

  throw new Error(
    `Crawl timed out after ${CRAWL_MAX_WAIT_MS / 1000} seconds. ` +
      "The site may be too large or slow to crawl."
  );
}

// =============================================================================
// Tool Result Types
// =============================================================================

export type ScrapeToolResult = {
  success: boolean;
  url: string;
  title?: string;
  markdown: string;
  error?: string;
};

export type CrawlToolResult = {
  success: boolean;
  baseUrl: string;
  pagesCrawled: number;
  pages: Array<{
    url: string;
    title?: string;
    markdown: string;
  }>;
  error?: string;
};

export type MapToolResult = {
  success: boolean;
  baseUrl: string;
  totalLinks: number;
  links: string[];
  error?: string;
};

export type SearchToolResult = {
  success: boolean;
  query: string;
  totalResults: number;
  results: Array<{
    url: string;
    title: string;
    description: string;
    content: string;
  }>;
  error?: string;
};

// =============================================================================
// AI SDK Tools
// =============================================================================

/**
 * Scrape a single URL and convert to clean, LLM-ready markdown
 */
export const scrapeTool = tool({
  description:
    "Scrape a single URL and convert it to clean, LLM-ready markdown. " +
    "Use this for deep extraction of specific pages like documentation, articles, or research papers. " +
    "Returns structured markdown with preserved headers, tables, and formatting.",
  parameters: z.object({
    url: z
      .string()
      .url()
      .describe("The full URL to scrape (must be publicly accessible)."),
    onlyMainContent: z
      .boolean()
      .optional()
      .default(true)
      .describe(
        "If true (default), extract only the main content, excluding navigation, footers, and sidebars."
      ),
    includeLinks: z
      .boolean()
      .optional()
      .default(false)
      .describe("If true, include a list of all links found on the page."),
  }),
  execute: async ({ url, onlyMainContent, includeLinks }) => {
    try {
      const response = await firecrawlRequest<ScrapeResponse>("/scrape", {
        method: "POST",
        body: JSON.stringify({
          url,
          formats: ["markdown"],
          onlyMainContent: onlyMainContent ?? true,
          includeTags: includeLinks ? ["a"] : undefined,
        }),
      });

      if (!(response.success && response.data)) {
        return {
          success: false,
          url,
          markdown: "",
          error: response.error || "Failed to scrape the page.",
        } satisfies ScrapeToolResult;
      }

      const markdown = formatDocumentForLLM(response.data);

      const result: ScrapeToolResult = {
        success: true,
        url,
        title: response.data.metadata?.title,
        markdown,
      };

      if (includeLinks && response.data.links?.length) {
        result.markdown += `\n\n## Links Found\n${response.data.links.map((link) => `- ${link}`).join("\n")}`;
      }

      return result;
    } catch (error) {
      return {
        success: false,
        url,
        markdown: "",
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      } satisfies ScrapeToolResult;
    }
  },
});

/**
 * Crawl an entire website or subsection
 */
export const crawlTool = tool({
  description:
    "Crawl an entire website or subsection and convert all pages to markdown. " +
    "Use this for comprehensive research across documentation sites, research series, or technical wikis. " +
    "Returns multiple pages as structured markdown, enabling cross-reference analysis. " +
    "WARNING: This is a heavier operation - use 'map' first to scout the site structure if unsure.",
  parameters: z.object({
    url: z
      .string()
      .url()
      .describe(
        "The base URL to start crawling from. The crawl will follow links within this domain/path."
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(MAX_CRAWL_PAGES)
      .optional()
      .default(10)
      .describe(
        `Maximum pages to crawl (1-${MAX_CRAWL_PAGES}). Start small and increase if needed.`
      ),
    maxDepth: z
      .number()
      .int()
      .min(1)
      .max(5)
      .optional()
      .default(2)
      .describe(
        "Maximum link depth to crawl from the starting URL (1-5). Default is 2."
      ),
    allowBackwardLinks: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "If true, allow crawling pages that link back to already-visited pages. " +
          "Useful for wiki-style sites with interconnected content."
      ),
  }),
  execute: async ({ url, limit, maxDepth, allowBackwardLinks }) => {
    try {
      // Start the crawl job
      const startResponse = await firecrawlRequest<CrawlResponse>("/crawl", {
        method: "POST",
        body: JSON.stringify({
          url,
          limit: limit ?? 10,
          maxDepth: maxDepth ?? 2,
          allowBackwardLinks: allowBackwardLinks ?? false,
          scrapeOptions: {
            formats: ["markdown"],
            onlyMainContent: true,
          },
        }),
      });

      if (!(startResponse.success && startResponse.id)) {
        return {
          success: false,
          baseUrl: url,
          pagesCrawled: 0,
          pages: [],
          error: startResponse.error || "Failed to start crawl.",
        } satisfies CrawlToolResult;
      }

      // Poll for completion
      const finalResponse = await pollCrawlStatus(startResponse.id);

      if (!finalResponse.data?.length) {
        return {
          success: true,
          baseUrl: url,
          pagesCrawled: 0,
          pages: [],
          error: "Crawl completed but no pages were extracted.",
        } satisfies CrawlToolResult;
      }

      const pages = finalResponse.data.map((doc) => ({
        url: doc.metadata?.sourceURL || url,
        title: doc.metadata?.title,
        markdown: formatDocumentForLLM(doc),
      }));

      return {
        success: true,
        baseUrl: url,
        pagesCrawled: pages.length,
        pages,
      } satisfies CrawlToolResult;
    } catch (error) {
      return {
        success: false,
        baseUrl: url,
        pagesCrawled: 0,
        pages: [],
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      } satisfies CrawlToolResult;
    }
  },
});

/**
 * Map a website's structure to discover available URLs
 */
export const mapTool = tool({
  description:
    "Scout a website's structure by mapping all discoverable URLs. " +
    "Use this BEFORE crawling to understand what content is available. " +
    "Returns a list of URLs that can then be selectively scraped or crawled. " +
    "This is fast and lightweight - the Explorer's reconnaissance tool.",
  parameters: z.object({
    url: z
      .string()
      .url()
      .describe("The base URL to map. Will discover all linked pages."),
    search: z
      .string()
      .optional()
      .describe(
        "Optional search query to filter discovered URLs. " +
          "Only returns URLs whose paths contain this text."
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(1000)
      .optional()
      .default(100)
      .describe("Maximum URLs to return (1-1000). Default is 100."),
  }),
  execute: async ({ url, search, limit }) => {
    try {
      const response = await firecrawlRequest<MapResponse>("/map", {
        method: "POST",
        body: JSON.stringify({
          url,
          search: search || undefined,
          limit: limit ?? 100,
        }),
      });

      if (!response.success) {
        return {
          success: false,
          baseUrl: url,
          totalLinks: 0,
          links: [],
          error: response.error || "Failed to map the website.",
        } satisfies MapToolResult;
      }

      const links = response.links || [];

      return {
        success: true,
        baseUrl: url,
        totalLinks: links.length,
        links,
      } satisfies MapToolResult;
    } catch (error) {
      return {
        success: false,
        baseUrl: url,
        totalLinks: 0,
        links: [],
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      } satisfies MapToolResult;
    }
  },
});

/**
 * Search the web and get content from results
 */
export const searchTool = tool({
  description:
    "Search the web using Firecrawl and get content from results. " +
    "Returns search results with scraped markdown content for each result. " +
    "Use this for finding and extracting information from multiple web sources at once.",
  parameters: z.object({
    query: z
      .string()
      .describe("The search query to find relevant web pages."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .default(10)
      .describe("Maximum number of results to return (1-20). Default is 10."),
    scrapeContent: z
      .boolean()
      .optional()
      .default(true)
      .describe(
        "If true (default), scrape and include markdown content from each result."
      ),
  }),
  execute: async ({ query, limit, scrapeContent }) => {
    try {
      const apiKey = getApiKey();
      const client = new FirecrawlApp({ apiKey });
      
      const searchParams: Record<string, unknown> = {
        limit: limit ?? 10,
      };
      
      if (scrapeContent !== false) {
        searchParams.scrapeOptions = {
          formats: ['markdown'],
        };
      }
      
      const result = await client.search(query, searchParams);
      
      // Handle API response
      if (result && typeof result === 'object' && 'success' in result) {
        if (!(result as { success: boolean }).success) {
          return {
            success: false,
            query,
            totalResults: 0,
            results: [],
            error: (result as { error?: string }).error || 'Search failed',
          } satisfies SearchToolResult;
        }
      }
      
      const data = (result as { data?: Array<{
        url: string;
        title?: string;
        description?: string;
        markdown?: string;
        content?: string;
        metadata?: { title?: string; description?: string };
      }> })?.data || [];
      
      const results = data.map((item) => ({
        url: item.url,
        title: item.title || item.metadata?.title || 'Untitled',
        description: item.description || item.metadata?.description || '',
        content: truncateMarkdown(item.markdown || item.content || '', MAX_MARKDOWN_LENGTH),
      }));

      return {
        success: true,
        query,
        totalResults: results.length,
        results,
      } satisfies SearchToolResult;
    } catch (error) {
      return {
        success: false,
        query,
        totalResults: 0,
        results: [],
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      } satisfies SearchToolResult;
    }
  },
});

// =============================================================================
// FirecrawlClient Class (for direct use without AI SDK)
// =============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
export class FirecrawlClient {
  private client: FirecrawlApp;

  constructor(providedApiKey?: string) {
    const apiKey = providedApiKey || process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      throw new Error('FIRECRAWL_API_KEY is required - either provide it or set it as an environment variable');
    }
    this.client = new FirecrawlApp({ apiKey });
  }

  /**
   * Scrape a single URL and return clean markdown content
   */
  async scrapeUrl(url: string, timeoutMs: number = DEFAULT_SCRAPE_TIMEOUT) {
    try {
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Scraping timeout')), timeoutMs);
      });
      
      // Race the scraping against the timeout
      const scrapePromise = this.client.scrapeUrl(url, {
        formats: ['markdown', 'html'],
      });
      
      const result = await Promise.race([scrapePromise, timeoutPromise]) as any;
      
      if ('success' in result && !result.success) {
        throw new Error(result.error || 'Scrape failed');
      }
      
      return {
        markdown: (result as any).markdown || '',
        html: (result as any).html || '',
        metadata: (result as any).metadata || {},
        success: true,
      };
    } catch (error: any) {
      // Handle timeout errors
      if (error?.message === 'Scraping timeout') {
        return {
          markdown: '',
          html: '',
          metadata: {
            error: 'Scraping took too long and was stopped',
            timeout: true,
          },
          success: false,
          error: 'timeout',
        };
      }
      
      // Handle 403 errors gracefully
      if (error?.statusCode === 403 || error?.message?.includes('403')) {
        return {
          markdown: '',
          html: '',
          metadata: {
            error: 'This website is not supported by Firecrawl',
            statusCode: 403,
          },
          success: false,
          error: 'unsupported',
        };
      }
      
      // Return error info for other failures
      return {
        markdown: '',
        html: '',
        metadata: {
          error: error?.message || 'Failed to scrape URL',
          statusCode: error?.statusCode,
        },
        success: false,
        error: 'failed',
      };
    }
  }

  /**
   * Scrape with LLM-ready formatting
   */
  async scrapeForLLM(url: string, options?: { 
    onlyMainContent?: boolean; 
    includeLinks?: boolean;
    timeoutMs?: number;
  }): Promise<ScrapeToolResult> {
    try {
      const response = await firecrawlRequest<ScrapeResponse>("/scrape", {
        method: "POST",
        body: JSON.stringify({
          url,
          formats: ["markdown"],
          onlyMainContent: options?.onlyMainContent ?? true,
          includeTags: options?.includeLinks ? ["a"] : undefined,
        }),
      });

      if (!(response.success && response.data)) {
        return {
          success: false,
          url,
          markdown: "",
          error: response.error || "Failed to scrape the page.",
        };
      }

      const markdown = formatDocumentForLLM(response.data);

      const result: ScrapeToolResult = {
        success: true,
        url,
        title: response.data.metadata?.title,
        markdown,
      };

      if (options?.includeLinks && response.data.links?.length) {
        result.markdown += `\n\n## Links Found\n${response.data.links.map((link) => `- ${link}`).join("\n")}`;
      }

      return result;
    } catch (error) {
      return {
        success: false,
        url,
        markdown: "",
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Crawl a website and return multiple pages as structured markdown
   */
  async crawl(url: string, options?: {
    limit?: number;
    maxDepth?: number;
    allowBackwardLinks?: boolean;
  }): Promise<CrawlToolResult> {
    try {
      // Start the crawl job
      const startResponse = await firecrawlRequest<CrawlResponse>("/crawl", {
        method: "POST",
        body: JSON.stringify({
          url,
          limit: options?.limit ?? 10,
          maxDepth: options?.maxDepth ?? 2,
          allowBackwardLinks: options?.allowBackwardLinks ?? false,
          scrapeOptions: {
            formats: ["markdown"],
            onlyMainContent: true,
          },
        }),
      });

      if (!(startResponse.success && startResponse.id)) {
        return {
          success: false,
          baseUrl: url,
          pagesCrawled: 0,
          pages: [],
          error: startResponse.error || "Failed to start crawl.",
        };
      }

      // Poll for completion
      const finalResponse = await pollCrawlStatus(startResponse.id);

      if (!finalResponse.data?.length) {
        return {
          success: true,
          baseUrl: url,
          pagesCrawled: 0,
          pages: [],
          error: "Crawl completed but no pages were extracted.",
        };
      }

      const pages = finalResponse.data.map((doc) => ({
        url: doc.metadata?.sourceURL || url,
        title: doc.metadata?.title,
        markdown: formatDocumentForLLM(doc),
      }));

      return {
        success: true,
        baseUrl: url,
        pagesCrawled: pages.length,
        pages,
      };
    } catch (error) {
      return {
        success: false,
        baseUrl: url,
        pagesCrawled: 0,
        pages: [],
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Map a website's structure to discover available URLs
   */
  async mapUrl(url: string, options?: { search?: string; limit?: number }): Promise<MapToolResult> {
    try {
      const response = await firecrawlRequest<MapResponse>("/map", {
        method: "POST",
        body: JSON.stringify({
          url,
          search: options?.search || undefined,
          limit: options?.limit ?? 100,
        }),
      });

      if (!response.success) {
        return {
          success: false,
          baseUrl: url,
          totalLinks: 0,
          links: [],
          error: response.error || "Failed to map the website.",
        };
      }

      const links = response.links || [];

      return {
        success: true,
        baseUrl: url,
        totalLinks: links.length,
        links,
      };
    } catch (error) {
      return {
        success: false,
        baseUrl: url,
        totalLinks: 0,
        links: [],
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Search the web and get content from results
   */
  async search(query: string, options?: { limit?: number; scrapeOptions?: any }) {
    try {
      // Search with scrape - this gets us content immediately!
      const searchParams: any = {
        limit: options?.limit || 10,
      };
      
      // Add scrapeOptions to get content with search results
      if (options?.scrapeOptions !== false) {
        searchParams.scrapeOptions = {
          formats: ['markdown'],
          ...options?.scrapeOptions
        };
      }
      
      const result = await this.client.search(query, searchParams);
      
      // Handle the actual Firecrawl v1 API response format
      if (result && typeof result === 'object' && 'success' in result) {
        if (!(result as any).success) {
          throw new Error((result as any).error || 'Search failed');
        }
      }
      
      // Extract data - search with scrape returns data with content
      const data = (result as any)?.data || [];
      
      // Transform to include scraped content
      const enrichedData = data.map((item: any) => {
        // Try to extract favicon from metadata or construct default
        let favicon = item.metadata?.favicon || null;
        if (!favicon && item.metadata?.ogImage) {
          favicon = item.metadata.ogImage;
        } else if (!favicon && item.url) {
          // Default favicon URL
          const domain = new URL(item.url).hostname;
          favicon = `https://${domain}/favicon.ico`;
        }
        
        return {
          url: item.url,
          title: item.title || item.metadata?.title || 'Untitled',
          description: item.description || item.metadata?.description || '',
          markdown: item.markdown || '',
          html: item.html || '',
          links: item.links || [],
          screenshot: item.screenshot || null,
          metadata: {
            ...item.metadata,
            favicon: favicon,
            screenshot: item.screenshot
          },
          scraped: true, // Mark as already scraped
          content: item.markdown || '', // For compatibility
          favicon: favicon // Add at top level for easy access
        };
      });
      
      return {
        data: enrichedData,
        results: enrichedData, // For backward compatibility
        metadata: (result as any)?.metadata || {},
      };
    } catch (error) {
      throw error;
    }
  }
}

// =============================================================================
// Export AI Tools Bundle
// =============================================================================

/**
 * All Firecrawl tools for use with AI SDK
 */
export const firecrawlTools = {
  scrape: scrapeTool,
  crawl: crawlTool,
  map: mapTool,
  search: searchTool,
};

/**
 * Helper to get all tools as an array
 */
export function getFirecrawlTools() {
  return [scrapeTool, crawlTool, mapTool, searchTool];
}
