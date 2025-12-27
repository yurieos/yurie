/**
 * arXiv API Client
 * 
 * arXiv is a free distribution service for scholarly articles in physics, 
 * mathematics, computer science, quantitative biology, quantitative finance, 
 * statistics, electrical engineering and systems science, and economics.
 * 
 * 100% FREE with no API key required.
 * 
 * Coverage: 2.4+ million articles
 * Rate Limit: ~3 requests per second (be respectful)
 * 
 * @see https://info.arxiv.org/help/api/index.html
 */

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

export interface ArxivSearchResult {
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

export interface ArxivSearchResponse {
  results: ArxivSearchResult[];
  total: number;
  startIndex: number;
}

const ARXIV_API_BASE = 'http://export.arxiv.org/api/query';

// arXiv category mappings for better routing
export const ARXIV_CATEGORIES = {
  // Physics
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
  
  // Mathematics
  'math': 'Mathematics',
  
  // Computer Science
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
  
  // Quantitative Biology
  'q-bio': 'Quantitative Biology',
  
  // Quantitative Finance
  'q-fin': 'Quantitative Finance',
  
  // Statistics
  'stat': 'Statistics',
  'stat.ML': 'Machine Learning (Statistics)',
  
  // Electrical Engineering
  'eess': 'Electrical Engineering and Systems Science',
  
  // Economics
  'econ': 'Economics',
} as const;

export class ArxivClient {
  private requestDelay: number;
  private lastRequestTime: number = 0;

  constructor(options?: { requestDelay?: number }) {
    // Default to 350ms delay between requests (~3 requests/second)
    this.requestDelay = options?.requestDelay ?? 350;
  }

  /**
   * Rate limit helper
   */
  private async respectRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.requestDelay) {
      await new Promise(resolve => 
        setTimeout(resolve, this.requestDelay - timeSinceLastRequest)
      );
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Parse arXiv Atom feed response
   */
  private parseAtomFeed(xmlText: string): { entries: ArxivPaper[]; totalResults: number; startIndex: number } {
    // Simple XML parsing without external dependencies
    const getTagContent = (xml: string, tag: string): string => {
      const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
      const match = xml.match(regex);
      return match ? match[1].trim() : '';
    };

    const getAllTagContents = (xml: string, tag: string): string[] => {
      const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
      const matches: string[] = [];
      let match;
      while ((match = regex.exec(xml)) !== null) {
        matches.push(match[1].trim());
      }
      return matches;
    };

    const getAttributeValue = (xml: string, tag: string, attr: string): string => {
      const regex = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"[^>]*>`, 'i');
      const match = xml.match(regex);
      return match ? match[1] : '';
    };

    // Parse total results and start index
    const totalResults = parseInt(getTagContent(xmlText, 'opensearch:totalResults')) || 0;
    const startIndex = parseInt(getTagContent(xmlText, 'opensearch:startIndex')) || 0;

    // Split into entries
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
    const entries: ArxivPaper[] = [];
    let entryMatch;

    while ((entryMatch = entryRegex.exec(xmlText)) !== null) {
      const entry = entryMatch[1];

      // Extract ID (format: http://arxiv.org/abs/2401.12345v1)
      const idUrl = getTagContent(entry, 'id');
      const arxivId = idUrl.replace('http://arxiv.org/abs/', '');

      // Extract authors
      const authorMatches = entry.match(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/gi) || [];
      const authors = authorMatches.map(a => {
        const nameMatch = a.match(/<name>([\s\S]*?)<\/name>/i);
        return nameMatch ? nameMatch[1].trim() : '';
      }).filter(Boolean);

      // Extract categories
      const categoryMatches = entry.match(/<category[^>]*term="([^"]*)"[^>]*\/>/gi) || [];
      const categories = categoryMatches.map(c => {
        const termMatch = c.match(/term="([^"]*)"/i);
        return termMatch ? termMatch[1] : '';
      }).filter(Boolean);

      // Extract PDF link
      const linkMatches = entry.match(/<link[^>]*>/gi) || [];
      let pdfUrl = '';
      for (const link of linkMatches) {
        if (link.includes('title="pdf"') || link.includes('type="application/pdf"')) {
          const hrefMatch = link.match(/href="([^"]*)"/i);
          if (hrefMatch) {
            pdfUrl = hrefMatch[1];
            break;
          }
        }
      }

      // If no explicit PDF link, construct it
      if (!pdfUrl && arxivId) {
        pdfUrl = `https://arxiv.org/pdf/${arxivId.replace('v', '.v')}.pdf`;
      }

      const paper: ArxivPaper = {
        id: arxivId,
        title: getTagContent(entry, 'title').replace(/\s+/g, ' ').trim(),
        summary: getTagContent(entry, 'summary').replace(/\s+/g, ' ').trim(),
        authors,
        published: getTagContent(entry, 'published'),
        updated: getTagContent(entry, 'updated'),
        categories,
        primaryCategory: getAttributeValue(entry, 'arxiv:primary_category', 'term') || categories[0] || '',
        pdfUrl,
        arxivUrl: `https://arxiv.org/abs/${arxivId}`,
        doi: getTagContent(entry, 'arxiv:doi') || undefined,
        comment: getTagContent(entry, 'arxiv:comment') || undefined,
        journalRef: getTagContent(entry, 'arxiv:journal_ref') || undefined,
      };

      entries.push(paper);
    }

    return { entries, totalResults, startIndex };
  }

  /**
   * Transform arXiv paper to unified search result
   */
  private transformToSearchResult(paper: ArxivPaper): ArxivSearchResult {
    const year = paper.published ? new Date(paper.published).getFullYear() : undefined;

    // Build rich content
    const contentParts: string[] = [paper.summary];

    if (paper.authors.length > 0) {
      contentParts.push(`\nAuthors: ${paper.authors.slice(0, 10).join(', ')}`);
    }

    if (year) {
      contentParts.push(`Published: ${year}`);
    }

    if (paper.primaryCategory) {
      const categoryName = ARXIV_CATEGORIES[paper.primaryCategory as keyof typeof ARXIV_CATEGORIES];
      contentParts.push(`Category: ${categoryName || paper.primaryCategory}`);
    }

    if (paper.comment) {
      contentParts.push(`Note: ${paper.comment}`);
    }

    if (paper.journalRef) {
      contentParts.push(`Journal: ${paper.journalRef}`);
    }

    return {
      url: paper.arxivUrl,
      title: paper.title,
      content: contentParts.join('\n'),
      authors: paper.authors,
      year,
      pdfUrl: paper.pdfUrl,
      arxivId: paper.id,
      categories: paper.categories,
      publishedDate: paper.published,
    };
  }

  /**
   * Search arXiv papers
   */
  async search(
    query: string,
    options?: {
      limit?: number;
      start?: number;
      sortBy?: 'relevance' | 'lastUpdatedDate' | 'submittedDate';
      sortOrder?: 'ascending' | 'descending';
      category?: string;
    }
  ): Promise<ArxivSearchResponse> {
    await this.respectRateLimit();

    try {
      // Build search query
      let searchQuery = query;
      
      // Add category filter if specified
      if (options?.category) {
        searchQuery = `cat:${options.category} AND (${query})`;
      }

      const params = new URLSearchParams({
        search_query: `all:${searchQuery}`,
        start: String(options?.start ?? 0),
        max_results: String(options?.limit ?? 10),
        sortBy: options?.sortBy || 'relevance',
        sortOrder: options?.sortOrder || 'descending',
      });

      const response = await fetch(`${ARXIV_API_BASE}?${params}`);

      if (!response.ok) {
        throw new Error(`arXiv API error: ${response.status}`);
      }

      const xmlText = await response.text();
      const { entries, totalResults, startIndex } = this.parseAtomFeed(xmlText);

      return {
        results: entries.map(paper => this.transformToSearchResult(paper)),
        total: totalResults,
        startIndex,
      };
    } catch (error) {
      console.error('arXiv search error:', error);
      throw error;
    }
  }

  /**
   * Search for AI/ML papers specifically
   */
  async searchAI(
    query: string,
    options?: { limit?: number }
  ): Promise<ArxivSearchResponse> {
    const aiCategories = ['cs.AI', 'cs.LG', 'cs.CL', 'cs.CV', 'cs.NE', 'stat.ML'];
    const categoryQuery = aiCategories.map(c => `cat:${c}`).join(' OR ');
    
    return this.search(`(${categoryQuery}) AND (${query})`, {
      limit: options?.limit ?? 10,
      sortBy: 'submittedDate',
      sortOrder: 'descending',
    });
  }

  /**
   * Search for physics papers
   */
  async searchPhysics(
    query: string,
    options?: { limit?: number; subcategory?: string }
  ): Promise<ArxivSearchResponse> {
    const category = options?.subcategory || 'physics';
    return this.search(query, {
      limit: options?.limit ?? 10,
      category,
    });
  }

  /**
   * Search for math papers
   */
  async searchMath(
    query: string,
    options?: { limit?: number }
  ): Promise<ArxivSearchResponse> {
    return this.search(query, {
      limit: options?.limit ?? 10,
      category: 'math',
    });
  }

  /**
   * Get paper by arXiv ID
   */
  async getPaper(arxivId: string): Promise<ArxivSearchResult | null> {
    await this.respectRateLimit();

    try {
      // Clean the ID (remove version if present for lookup)
      const cleanId = arxivId.replace(/v\d+$/, '');
      
      const params = new URLSearchParams({
        id_list: cleanId,
      });

      const response = await fetch(`${ARXIV_API_BASE}?${params}`);

      if (!response.ok) {
        throw new Error(`arXiv API error: ${response.status}`);
      }

      const xmlText = await response.text();
      const { entries } = this.parseAtomFeed(xmlText);

      if (entries.length === 0) return null;

      return this.transformToSearchResult(entries[0]);
    } catch (error) {
      console.error('arXiv get paper error:', error);
      throw error;
    }
  }

  /**
   * Get recent papers in a category
   */
  async getRecent(
    category: string,
    options?: { limit?: number }
  ): Promise<ArxivSearchResponse> {
    return this.search('*', {
      limit: options?.limit ?? 20,
      category,
      sortBy: 'submittedDate',
      sortOrder: 'descending',
    });
  }

  /**
   * Search by author
   */
  async searchByAuthor(
    authorName: string,
    options?: { limit?: number }
  ): Promise<ArxivSearchResponse> {
    await this.respectRateLimit();

    try {
      const params = new URLSearchParams({
        search_query: `au:"${authorName}"`,
        start: '0',
        max_results: String(options?.limit ?? 10),
        sortBy: 'submittedDate',
        sortOrder: 'descending',
      });

      const response = await fetch(`${ARXIV_API_BASE}?${params}`);

      if (!response.ok) {
        throw new Error(`arXiv API error: ${response.status}`);
      }

      const xmlText = await response.text();
      const { entries, totalResults, startIndex } = this.parseAtomFeed(xmlText);

      return {
        results: entries.map(paper => this.transformToSearchResult(paper)),
        total: totalResults,
        startIndex,
      };
    } catch (error) {
      console.error('arXiv author search error:', error);
      throw error;
    }
  }
}


