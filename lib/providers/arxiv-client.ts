/**
 * arXiv API Client
 * 
 * REFACTORED: Extended BaseProviderClient for shared functionality.
 * Reduced from ~450 lines to ~200 lines.
 * 
 * arXiv is a free distribution service for scholarly articles in physics, 
 * mathematics, computer science, quantitative biology, quantitative finance, 
 * statistics, electrical engineering and systems science, and economics.
 * 
 * 100% FREE with no API key required.
 * Coverage: 2.4+ million articles
 * Rate Limit: ~3 requests per second (be respectful)
 * 
 * @see https://info.arxiv.org/help/api/index.html
 */

import { Source } from '../types';
import { BaseProviderClient, BaseSearchResult, BaseSearchResponse } from './base-client';

// =============================================================================
// Types
// =============================================================================

export interface ArxivPaper {
  id: string;
  title: string;
  summary: string;
  authors: string[];
  published: string;
  updated: string;
  categories: string[];
  primaryCategory: string;
  pdfUrl: string;
  arxivUrl: string;
  doi?: string;
  comment?: string;
  journalRef?: string;
}

export interface ArxivSearchResult extends BaseSearchResult {
  url: string;
  title: string;
  content: string;
  authors: string[];
  year?: number;
  pdfUrl?: string;
  arxivId: string;
  categories: string[];
  publishedDate?: string;
}

export interface ArxivSearchResponse extends BaseSearchResponse<ArxivSearchResult> {
  results: ArxivSearchResult[];
  total: number;
  startIndex: number;
}

// =============================================================================
// Constants
// =============================================================================

const ARXIV_API_BASE = 'http://export.arxiv.org/api/query';

export const ARXIV_CATEGORIES = {
  'astro-ph': 'Astrophysics',
  'cond-mat': 'Condensed Matter',
  'gr-qc': 'General Relativity and Quantum Cosmology',
  'hep-ex': 'High Energy Physics - Experiment',
  'hep-lat': 'High Energy Physics - Lattice',
  'hep-ph': 'High Energy Physics - Phenomenology',
  'hep-th': 'High Energy Physics - Theory',
  'math-ph': 'Mathematical Physics',
  'nlin': 'Nonlinear Sciences',
  'nucl-ex': 'Nuclear Experiment',
  'nucl-th': 'Nuclear Theory',
  'physics': 'Physics',
  'quant-ph': 'Quantum Physics',
  'math': 'Mathematics',
  'cs.AI': 'Artificial Intelligence',
  'cs.CL': 'Computation and Language (NLP)',
  'cs.CV': 'Computer Vision',
  'cs.LG': 'Machine Learning',
  'cs.NE': 'Neural and Evolutionary Computing',
  'cs.RO': 'Robotics',
  'cs.SE': 'Software Engineering',
  'cs.CR': 'Cryptography and Security',
  'cs.DS': 'Data Structures and Algorithms',
  'cs.DB': 'Databases',
  'cs.DC': 'Distributed Computing',
  'cs.HC': 'Human-Computer Interaction',
  'cs.IR': 'Information Retrieval',
  'cs.PL': 'Programming Languages',
  'q-bio': 'Quantitative Biology',
  'q-fin': 'Quantitative Finance',
  'stat': 'Statistics',
  'stat.ML': 'Machine Learning (Statistics)',
  'eess': 'Electrical Engineering and Systems Science',
  'econ': 'Economics',
} as const;

// =============================================================================
// Client Implementation
// =============================================================================

export class ArxivClient extends BaseProviderClient<ArxivSearchResult> {
  constructor(options?: { requestDelay?: number }) {
    super('arxiv', {
      rateLimitMs: options?.requestDelay ?? 350, // ~3 requests/second
      maxResults: 20,
      timeoutMs: 30000,
    });
  }

  // ===========================================================================
  // Required Abstract Methods
  // ===========================================================================

  protected async executeSearch(query: string, limit: number): Promise<ArxivSearchResponse> {
    const params = new URLSearchParams({
      search_query: `all:${query}`,
      start: '0',
      max_results: String(limit),
      sortBy: 'relevance',
      sortOrder: 'descending',
    });

    const response = await fetch(`${ARXIV_API_BASE}?${params}`, {
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`arXiv API error: ${response.status}`);
    }

    const xmlText = await response.text();
    return this.parseAtomFeed(xmlText);
  }

  protected transformResult(result: ArxivSearchResult): Source {
    return {
      url: result.url,
      title: result.title,
      content: result.content,
      quality: 0.85,
      summary: result.content.slice(0, 200),
    };
  }

  // ===========================================================================
  // Public API - Override base search to support options object
  // ===========================================================================

  /**
   * Search with additional options (overload with options object)
   */
  async search(
    query: string,
    options?: number | {
      limit?: number;
      start?: number;
      sortBy?: 'relevance' | 'lastUpdatedDate' | 'submittedDate';
      sortOrder?: 'ascending' | 'descending';
      category?: string;
    }
  ): Promise<ArxivSearchResponse> {
    await this.respectRateLimit();

    // Handle both signatures: search(query, limit) and search(query, options)
    const opts = typeof options === 'number' ? { limit: options } : (options ?? {});

    let searchQuery = query;
    if (opts.category) {
      searchQuery = `cat:${opts.category} AND (${query})`;
    }

    const params = new URLSearchParams({
      search_query: `all:${searchQuery}`,
      start: String(opts.start ?? 0),
      max_results: String(opts.limit ?? 10),
      sortBy: opts.sortBy || 'relevance',
      sortOrder: opts.sortOrder || 'descending',
    });

    const response = await fetch(`${ARXIV_API_BASE}?${params}`, {
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`arXiv API error: ${response.status}`);
    }

    const xmlText = await response.text();
    return this.parseAtomFeed(xmlText);
  }

  /**
   * Get paper by arXiv ID
   */
  async getPaper(arxivId: string): Promise<ArxivSearchResult | null> {
    await this.respectRateLimit();

    const cleanId = arxivId.replace(/v\d+$/, '');
    const params = new URLSearchParams({ id_list: cleanId });

    const response = await fetch(`${ARXIV_API_BASE}?${params}`, {
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`arXiv API error: ${response.status}`);
    }

    const xmlText = await response.text();
    const { results } = this.parseAtomFeed(xmlText);
    return results[0] || null;
  }

  // ===========================================================================
  // XML Parsing
  // ===========================================================================

  private parseAtomFeed(xmlText: string): ArxivSearchResponse {
    const getTagContent = (xml: string, tag: string): string => {
      const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
      const match = xml.match(regex);
      return match ? match[1].trim() : '';
    };

    const getAttributeValue = (xml: string, tag: string, attr: string): string => {
      const regex = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"[^>]*>`, 'i');
      const match = xml.match(regex);
      return match ? match[1] : '';
    };

    const totalResults = parseInt(getTagContent(xmlText, 'opensearch:totalResults')) || 0;
    const startIndex = parseInt(getTagContent(xmlText, 'opensearch:startIndex')) || 0;

    const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
    const results: ArxivSearchResult[] = [];
    let entryMatch;

    while ((entryMatch = entryRegex.exec(xmlText)) !== null) {
      const entry = entryMatch[1];

      const idUrl = getTagContent(entry, 'id');
      const arxivId = idUrl.replace('http://arxiv.org/abs/', '');

      const authorMatches = entry.match(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/gi) || [];
      const authors = authorMatches.map(a => {
        const nameMatch = a.match(/<name>([\s\S]*?)<\/name>/i);
        return nameMatch ? nameMatch[1].trim() : '';
      }).filter(Boolean);

      const categoryMatches = entry.match(/<category[^>]*term="([^"]*)"[^>]*\/>/gi) || [];
      const categories = categoryMatches.map(c => {
        const termMatch = c.match(/term="([^"]*)"/i);
        return termMatch ? termMatch[1] : '';
      }).filter(Boolean);

      const title = getTagContent(entry, 'title').replace(/\s+/g, ' ').trim();
      const summary = getTagContent(entry, 'summary').replace(/\s+/g, ' ').trim();
      const published = getTagContent(entry, 'published');
      const year = published ? new Date(published).getFullYear() : undefined;
      const primaryCategory = getAttributeValue(entry, 'arxiv:primary_category', 'term') || categories[0] || '';

      const contentParts: string[] = [summary];
      if (authors.length > 0) {
        contentParts.push(`\nAuthors: ${authors.slice(0, 10).join(', ')}`);
      }
      if (year) {
        contentParts.push(`Published: ${year}`);
      }
      if (primaryCategory) {
        const categoryName = ARXIV_CATEGORIES[primaryCategory as keyof typeof ARXIV_CATEGORIES];
        contentParts.push(`Category: ${categoryName || primaryCategory}`);
      }

      results.push({
        url: `https://arxiv.org/abs/${arxivId}`,
        title,
        content: contentParts.join('\n'),
        authors,
        year,
        pdfUrl: `https://arxiv.org/pdf/${arxivId}.pdf`,
        arxivId,
        categories,
        publishedDate: published,
      });
    }

    return { results, total: totalResults, startIndex };
  }
}
