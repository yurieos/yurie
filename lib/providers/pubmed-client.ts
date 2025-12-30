/**
 * PubMed/NCBI E-Utilities API Client
 * 
 * REFACTORED: Extended BaseProviderClient for shared functionality.
 * Reduced from ~507 lines to ~320 lines.
 * 
 * PubMed is a free search engine accessing primarily the MEDLINE database 
 * of references and abstracts on life sciences and biomedical topics.
 * 
 * Authentication:
 * - Without API key: 3 requests/second
 * - With API key: 10 requests/second (FREE - register at NCBI)
 * 
 * Set NCBI_API_KEY or PUBMED_API_KEY environment variable.
 * Register for free at: https://www.ncbi.nlm.nih.gov/account/settings/
 * 
 * Coverage: 35+ million citations for biomedical literature
 * 
 * @see https://www.ncbi.nlm.nih.gov/books/NBK25501/
 */

import { Source } from '../types';
import { BaseProviderClient, BaseSearchResult, BaseSearchResponse } from './base-client';

// =============================================================================
// Types
// =============================================================================

export interface PubMedArticle {
  pmid: string;
  title: string;
  abstract: string;
  authors: string[];
  journal: string;
  publicationDate: string;
  year?: number;
  doi?: string;
  pmcid?: string;
  keywords?: string[];
  meshTerms?: string[];
  publicationType?: string[];
}

export interface PubMedSearchResult extends BaseSearchResult {
  url: string;
  title: string;
  content: string;
  authors: string[];
  year?: number;
  pmid: string;
  journal?: string;
  doi?: string;
  pdfUrl?: string;
}

export interface PubMedSearchResponse extends BaseSearchResponse<PubMedSearchResult> {
  results: PubMedSearchResult[];
  total: number;
  queryTranslation?: string;
}

// =============================================================================
// Constants
// =============================================================================

const EUTILS_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

// =============================================================================
// Client Implementation
// =============================================================================

export class PubMedClient extends BaseProviderClient<PubMedSearchResult> {
  private apiKey?: string;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.NCBI_API_KEY || process.env.PUBMED_API_KEY;
    super('pubmed', {
      // 3 requests/sec without key, 10 with key
      rateLimitMs: key ? 100 : 350,
      maxResults: 20,
      timeoutMs: 30000,
    });
    this.apiKey = key;
  }

  // ===========================================================================
  // Required Abstract Methods
  // ===========================================================================

  protected async executeSearch(query: string, limit: number): Promise<PubMedSearchResponse> {
    // Step 1: Search to get PMIDs
    const searchParams: Record<string, string | undefined> = {
      db: 'pubmed',
      term: query,
      retmax: String(limit),
      retstart: '0',
      retmode: 'json',
      sort: 'relevance',
      usehistory: 'y',
    };

    const searchUrl = this.buildPubMedUrl('esearch.fcgi', searchParams);
    const searchResponse = await fetch(searchUrl, {
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!searchResponse.ok) {
      throw new Error(`PubMed search error: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    const pmids = searchData.esearchresult?.idlist || [];
    const total = parseInt(searchData.esearchresult?.count || '0');
    const queryTranslation = searchData.esearchresult?.querytranslation;

    if (pmids.length === 0) {
      return { results: [], total: 0, queryTranslation };
    }

    // Step 2: Fetch article details
    await this.respectRateLimit();

    const fetchUrl = this.buildPubMedUrl('efetch.fcgi', {
      db: 'pubmed',
      id: pmids.join(','),
      rettype: 'xml',
      retmode: 'xml',
    });

    const fetchResponse = await fetch(fetchUrl, {
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const xmlText = await fetchResponse.text();
    const articles = this.parseArticlesXml(xmlText);

    return {
      results: articles.map(article => this.transformArticle(article)),
      total,
      queryTranslation,
    };
  }

  protected transformResult(result: PubMedSearchResult): Source {
    return {
      url: result.url,
      title: result.title,
      content: result.content,
      quality: 0.90,
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
      sortBy?: 'relevance' | 'pub_date' | 'most_recent';
      dateRange?: { from?: string; to?: string };
    }
  ): Promise<PubMedSearchResponse> {
    await this.respectRateLimit();

    // Handle both signatures: search(query, limit) and search(query, options)
    const opts = typeof options === 'number' ? { limit: options } : (options ?? {});

    const searchParams: Record<string, string | undefined> = {
      db: 'pubmed',
      term: query,
      retmax: String(opts.limit ?? 10),
      retstart: String(opts.start ?? 0),
      retmode: 'json',
      sort: opts.sortBy === 'pub_date' ? 'pub_date' : 
            opts.sortBy === 'most_recent' ? 'most_recent' : 'relevance',
      usehistory: 'y',
    };

    if (opts.dateRange?.from || opts.dateRange?.to) {
      searchParams.datetype = 'pdat';
      searchParams.mindate = opts.dateRange.from || '1900';
      searchParams.maxdate = opts.dateRange.to || '3000';
    }

    const searchUrl = this.buildPubMedUrl('esearch.fcgi', searchParams);
    const searchResponse = await fetch(searchUrl, {
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!searchResponse.ok) {
      throw new Error(`PubMed search error: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    const pmids = searchData.esearchresult?.idlist || [];
    const total = parseInt(searchData.esearchresult?.count || '0');
    const queryTranslation = searchData.esearchresult?.querytranslation;

    if (pmids.length === 0) {
      return { results: [], total: 0, queryTranslation };
    }

    await this.respectRateLimit();

    const fetchUrl = this.buildPubMedUrl('efetch.fcgi', {
      db: 'pubmed',
      id: pmids.join(','),
      rettype: 'xml',
      retmode: 'xml',
    });

    const fetchResponse = await fetch(fetchUrl, {
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const xmlText = await fetchResponse.text();
    const articles = this.parseArticlesXml(xmlText);

    return {
      results: articles.map(article => this.transformArticle(article)),
      total,
      queryTranslation,
    };
  }

  /**
   * Get article by PMID
   */
  async getArticle(pmid: string): Promise<PubMedSearchResult | null> {
    await this.respectRateLimit();

    const fetchUrl = this.buildPubMedUrl('efetch.fcgi', {
      db: 'pubmed',
      id: pmid,
      rettype: 'xml',
      retmode: 'xml',
    });

    const response = await fetch(fetchUrl, {
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const xmlText = await response.text();
    const articles = this.parseArticlesXml(xmlText);

    return articles.length > 0 ? this.transformArticle(articles[0]) : null;
  }

  /**
   * Convenience searches with enhanced queries
   */
  async searchMedical(query: string, options?: { limit?: number }): Promise<PubMedSearchResponse> {
    const enhancedQuery = `${query} AND (clinical trial[pt] OR randomized controlled trial[pt] OR meta-analysis[pt] OR systematic review[pt])`;
    return this.search(enhancedQuery, { limit: options?.limit ?? 10 });
  }

  async searchDrugs(drugName: string, options?: { limit?: number; condition?: string }): Promise<PubMedSearchResponse> {
    let query = `${drugName}[Title/Abstract]`;
    if (options?.condition) {
      query += ` AND ${options.condition}[Title/Abstract]`;
    }
    query += ' AND (drug therapy[MeSH] OR treatment outcome[MeSH])';
    return this.search(query, { limit: options?.limit ?? 10, sortBy: 'pub_date' });
  }

  async searchLongevity(query: string, options?: { limit?: number }): Promise<PubMedSearchResponse> {
    const enhancedQuery = `${query} AND (longevity[MeSH] OR aging[MeSH] OR lifespan[Title/Abstract] OR senescence[MeSH])`;
    return this.search(enhancedQuery, { limit: options?.limit ?? 10, sortBy: 'pub_date' });
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private buildPubMedUrl(endpoint: string, params: Record<string, string | undefined>): string {
    const url = new URL(`${EUTILS_BASE}/${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, value);
      }
    });
    if (this.apiKey) {
      url.searchParams.set('api_key', this.apiKey);
    }
    return url.toString();
  }

  private transformArticle(article: PubMedArticle): PubMedSearchResult {
    const contentParts: string[] = [];
    if (article.abstract) contentParts.push(article.abstract);
    if (article.authors.length > 0) {
      contentParts.push(`\nAuthors: ${article.authors.slice(0, 10).join(', ')}`);
    }
    if (article.journal) contentParts.push(`Journal: ${article.journal}`);
    if (article.year) contentParts.push(`Year: ${article.year}`);
    if (article.meshTerms?.length) {
      contentParts.push(`Topics: ${article.meshTerms.slice(0, 5).join(', ')}`);
    }

    return {
      url: `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`,
      title: article.title,
      content: contentParts.join('\n'),
      authors: article.authors,
      year: article.year,
      pmid: article.pmid,
      journal: article.journal,
      doi: article.doi,
      pdfUrl: article.pmcid ? `https://www.ncbi.nlm.nih.gov/pmc/articles/${article.pmcid}/pdf/` : undefined,
    };
  }

  private parseArticlesXml(xmlText: string): PubMedArticle[] {
    const articles: PubMedArticle[] = [];
    const articleRegex = /<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/gi;
    let match;

    const getTag = (xml: string, tag: string): string => {
      const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
      const m = xml.match(regex);
      return m ? m[1].trim() : '';
    };

    const getAllTags = (xml: string, tag: string): string[] => {
      const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
      const results: string[] = [];
      let m;
      while ((m = regex.exec(xml)) !== null) {
        results.push(m[1].trim());
      }
      return results;
    };

    while ((match = articleRegex.exec(xmlText)) !== null) {
      const articleXml = match[1];
      const pmid = getTag(articleXml, 'PMID');
      const title = this.cleanHtml(getTag(articleXml, 'ArticleTitle'));
      const abstractTexts = getAllTags(articleXml, 'AbstractText');
      const abstract = abstractTexts.map(t => this.cleanHtml(t)).join(' ');

      const authorList = getTag(articleXml, 'AuthorList');
      const authors: string[] = [];
      const authorRegex = /<Author[^>]*>([\s\S]*?)<\/Author>/gi;
      let authorMatch;
      while ((authorMatch = authorRegex.exec(authorList)) !== null) {
        const lastName = getTag(authorMatch[1], 'LastName');
        const foreName = getTag(authorMatch[1], 'ForeName');
        if (lastName) {
          authors.push(foreName ? `${lastName} ${foreName}` : lastName);
        }
      }

      const journal = getTag(articleXml, 'Title') || getTag(articleXml, 'ISOAbbreviation');
      const pubDate = getTag(articleXml, 'PubDate');
      const year = parseInt(getTag(pubDate, 'Year')) || undefined;
      const month = getTag(pubDate, 'Month') || '01';
      const day = getTag(pubDate, 'Day') || '01';

      const articleIdList = getTag(articleXml, 'ArticleIdList');
      const doiMatch = articleIdList.match(/<ArticleId IdType="doi">([^<]+)<\/ArticleId>/i);
      const pmcMatch = articleIdList.match(/<ArticleId IdType="pmc">([^<]+)<\/ArticleId>/i);

      articles.push({
        pmid,
        title,
        abstract,
        authors,
        journal,
        publicationDate: year ? `${year}-${month}-${day}` : '',
        year,
        doi: doiMatch?.[1],
        pmcid: pmcMatch?.[1],
        keywords: getAllTags(articleXml, 'Keyword').map(k => this.cleanHtml(k)),
        meshTerms: getAllTags(articleXml, 'DescriptorName').map(m => this.cleanHtml(m)),
        publicationType: getAllTags(articleXml, 'PublicationType').map(t => this.cleanHtml(t)),
      });
    }

    return articles;
  }
}
