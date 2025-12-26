import Exa from "exa-js";

export interface ExaSearchResult {
  url: string;
  title: string;
  content?: string;
  highlights?: string[];
  score?: number;
  publishedDate?: string;
  author?: string;
}

export interface ExaSearchResponse {
  results: ExaSearchResult[];
  autopromptString?: string;
}

export interface ExaResearchResponse {
  summary: string;
  sources: Array<{
    url: string;
    title: string;
    snippet: string;
  }>;
}

export class ExaClient {
  private client: Exa;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.EXA_API_KEY;
    if (!key) {
      throw new Error('EXA_API_KEY is required');
    }
    this.client = new Exa(key);
  }

  /**
   * Semantic search with Exa - great for finding similar content
   */
  async search(
    query: string,
    options?: {
      numResults?: number;
      type?: 'neural' | 'keyword' | 'auto';
      useAutoprompt?: boolean;
      includeDomains?: string[];
      excludeDomains?: string[];
      startPublishedDate?: string;
      endPublishedDate?: string;
      category?: string;
    }
  ): Promise<ExaSearchResponse> {
    try {
      // Build search options
      const searchOptions: Parameters<typeof this.client.searchAndContents>[1] = {
        numResults: options?.numResults ?? 10,
        type: options?.type ?? 'auto',
        useAutoprompt: options?.useAutoprompt ?? true,
        includeDomains: options?.includeDomains,
        excludeDomains: options?.excludeDomains,
        startPublishedDate: options?.startPublishedDate,
        endPublishedDate: options?.endPublishedDate,
        text: { maxCharacters: 4000 },
        highlights: { numSentences: 5, highlightsPerUrl: 3 },
      };
      
      // Add category if provided (cast to any to handle potential API version differences)
      if (options?.category) {
        (searchOptions as Record<string, unknown>).category = options.category;
      }
      
      const response = await this.client.searchAndContents(query, searchOptions);

      return {
        autopromptString: response.autopromptString,
        results: response.results.map((r) => ({
          url: r.url,
          title: r.title || '',
          content: r.text,
          highlights: (r as unknown as { highlights?: string[] }).highlights,
          score: r.score,
          publishedDate: r.publishedDate,
          author: r.author,
        })),
      };
    } catch (error) {
      console.error('Exa search error:', error);
      throw error;
    }
  }

  /**
   * Find similar content to a given URL - unique Exa capability
   */
  async findSimilar(
    url: string,
    options?: {
      numResults?: number;
      includeDomains?: string[];
      excludeDomains?: string[];
    }
  ): Promise<ExaSearchResult[]> {
    try {
      const response = await this.client.findSimilarAndContents(url, {
        numResults: options?.numResults ?? 10,
        includeDomains: options?.includeDomains,
        excludeDomains: options?.excludeDomains,
        text: { maxCharacters: 3000 },
        highlights: { numSentences: 3 },
      });

      return response.results.map((r) => ({
        url: r.url,
        title: r.title || '',
        content: r.text,
        highlights: r.highlights,
        score: r.score,
        publishedDate: r.publishedDate,
        author: r.author,
      }));
    } catch (error) {
      console.error('Exa findSimilar error:', error);
      throw error;
    }
  }

  /**
   * Deep research with agentic multi-hop search
   * This is Exa's most powerful feature for complex research
   */
  async research(query: string): Promise<ExaResearchResponse> {
    try {
      // Note: The research endpoint may have different API structure
      // Adjust based on actual Exa API documentation
      const response = await (this.client as unknown as { 
        research: (query: string) => Promise<{
          summary: string;
          sources: Array<{ url: string; title: string; snippet: string }>;
        }>;
      }).research(query);

      return {
        summary: response.summary,
        sources: response.sources,
      };
    } catch {
      // Fallback to regular search if research endpoint not available
      console.warn('Exa research endpoint not available, falling back to search');
      const searchResults = await this.search(query, { numResults: 15 });
      
      return {
        summary: '',
        sources: searchResults.results.map(r => ({
          url: r.url,
          title: r.title,
          snippet: r.highlights?.[0] || r.content?.slice(0, 200) || '',
        })),
      };
    }
  }

  /**
   * Search for academic/research papers
   */
  async searchAcademic(query: string, numResults = 10): Promise<ExaSearchResult[]> {
    const academicDomains = [
      'arxiv.org',
      'semanticscholar.org',
      'scholar.google.com',
      'pubmed.ncbi.nlm.nih.gov',
      'nature.com',
      'science.org',
      'springer.com',
      'wiley.com',
      'ieee.org',
      'acm.org',
    ];

    const response = await this.search(query, {
      numResults,
      type: 'neural',
      includeDomains: academicDomains,
      useAutoprompt: true,
    });

    return response.results;
  }

  /**
   * Search for code and technical documentation
   */
  async searchTechnical(query: string, numResults = 10): Promise<ExaSearchResult[]> {
    const technicalDomains = [
      'github.com',
      'stackoverflow.com',
      'docs.python.org',
      'developer.mozilla.org',
      'docs.microsoft.com',
      'cloud.google.com',
      'docs.aws.amazon.com',
      'rust-lang.org',
      'go.dev',
      'typescriptlang.org',
    ];

    const response = await this.search(query, {
      numResults,
      type: 'auto',
      includeDomains: technicalDomains,
      useAutoprompt: true,
    });

    return response.results;
  }
}

