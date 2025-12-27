/**
 * PubMed/NCBI E-Utilities API Client
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
 * Perfect for: Medical research, drug discovery, diseases, genetics, 
 * biology, longevity/immortality research
 * 
 * @see https://www.ncbi.nlm.nih.gov/books/NBK25501/
 * @see https://ncbiinsights.ncbi.nlm.nih.gov/2017/11/02/new-api-keys-for-the-e-utilities/
 */

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

export interface PubMedSearchResult {
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

export interface PubMedSearchResponse {
  results: PubMedSearchResult[];
  total: number;
  queryTranslation?: string;
}

const EUTILS_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

export class PubMedClient {
  private apiKey?: string;
  private requestDelay: number;
  private lastRequestTime: number = 0;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.NCBI_API_KEY || process.env.PUBMED_API_KEY;
    // 3 requests/sec without key, 10 with key
    this.requestDelay = this.apiKey ? 100 : 350;
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
   * Build URL with common parameters
   */
  private buildUrl(endpoint: string, params: Record<string, string | undefined>): string {
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

  /**
   * Search PubMed and get article details
   */
  async search(
    query: string,
    options?: {
      limit?: number;
      start?: number;
      sortBy?: 'relevance' | 'pub_date' | 'most_recent';
      dateRange?: {
        from?: string; // YYYY/MM/DD or YYYY
        to?: string;
      };
      articleTypes?: string[];
    }
  ): Promise<PubMedSearchResponse> {
    await this.respectRateLimit();

    try {
      // Step 1: Search to get PMIDs
      const searchParams: Record<string, string | undefined> = {
        db: 'pubmed',
        term: query,
        retmax: String(options?.limit ?? 10),
        retstart: String(options?.start ?? 0),
        retmode: 'json',
        sort: options?.sortBy === 'pub_date' ? 'pub_date' : 
              options?.sortBy === 'most_recent' ? 'most_recent' : 'relevance',
        usehistory: 'y',
      };

      // Add date filter if specified
      if (options?.dateRange?.from || options?.dateRange?.to) {
        const from = options.dateRange.from || '1900';
        const to = options.dateRange.to || '3000';
        searchParams.datetype = 'pdat';
        searchParams.mindate = from;
        searchParams.maxdate = to;
      }

      const searchUrl = this.buildUrl('esearch.fcgi', searchParams);
      const searchResponse = await fetch(searchUrl);

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

      const fetchUrl = this.buildUrl('efetch.fcgi', {
        db: 'pubmed',
        id: pmids.join(','),
        rettype: 'xml',
        retmode: 'xml',
      });

      const fetchResponse = await fetch(fetchUrl);
      const xmlText = await fetchResponse.text();

      // Parse the XML response
      const articles = this.parseArticlesXml(xmlText);

      return {
        results: articles.map(article => this.transformToSearchResult(article)),
        total,
        queryTranslation,
      };
    } catch (error) {
      console.error('PubMed search error:', error);
      throw error;
    }
  }

  /**
   * Parse PubMed XML response
   */
  private parseArticlesXml(xmlText: string): PubMedArticle[] {
    const articles: PubMedArticle[] = [];

    // Split into individual articles
    const articleRegex = /<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/gi;
    let match;

    while ((match = articleRegex.exec(xmlText)) !== null) {
      const articleXml = match[1];

      const getTagContent = (xml: string, tag: string): string => {
        const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
        const tagMatch = xml.match(regex);
        return tagMatch ? tagMatch[1].trim() : '';
      };

      const getAllTagContents = (xml: string, tag: string): string[] => {
        const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
        const results: string[] = [];
        let tagMatch;
        while ((tagMatch = regex.exec(xml)) !== null) {
          results.push(tagMatch[1].trim());
        }
        return results;
      };

      // Extract PMID
      const pmid = getTagContent(articleXml, 'PMID');

      // Extract title
      const title = getTagContent(articleXml, 'ArticleTitle')
        .replace(/<[^>]*>/g, '')
        .trim();

      // Extract abstract
      const abstractTexts = getAllTagContents(articleXml, 'AbstractText');
      const abstract = abstractTexts
        .map(text => text.replace(/<[^>]*>/g, '').trim())
        .join(' ')
        .trim();

      // Extract authors
      const authorList = getTagContent(articleXml, 'AuthorList');
      const authors: string[] = [];
      const authorRegex = /<Author[^>]*>([\s\S]*?)<\/Author>/gi;
      let authorMatch;
      while ((authorMatch = authorRegex.exec(authorList)) !== null) {
        const lastName = getTagContent(authorMatch[1], 'LastName');
        const foreName = getTagContent(authorMatch[1], 'ForeName');
        const initials = getTagContent(authorMatch[1], 'Initials');
        if (lastName) {
          authors.push(foreName ? `${lastName} ${foreName}` : `${lastName} ${initials}`);
        }
      }

      // Extract journal info
      const journal = getTagContent(articleXml, 'Title') || 
                     getTagContent(articleXml, 'ISOAbbreviation');

      // Extract publication date
      const pubDate = getTagContent(articleXml, 'PubDate');
      const year = parseInt(getTagContent(pubDate, 'Year')) || undefined;
      const month = getTagContent(pubDate, 'Month') || '01';
      const day = getTagContent(pubDate, 'Day') || '01';
      const publicationDate = year ? `${year}-${month}-${day}` : '';

      // Extract DOI
      const articleIdList = getTagContent(articleXml, 'ArticleIdList');
      const doiMatch = articleIdList.match(/<ArticleId IdType="doi">([^<]+)<\/ArticleId>/i);
      const doi = doiMatch ? doiMatch[1] : undefined;

      // Extract PMC ID
      const pmcMatch = articleIdList.match(/<ArticleId IdType="pmc">([^<]+)<\/ArticleId>/i);
      const pmcid = pmcMatch ? pmcMatch[1] : undefined;

      // Extract keywords
      const keywords = getAllTagContents(articleXml, 'Keyword')
        .map(k => k.replace(/<[^>]*>/g, '').trim())
        .filter(Boolean);

      // Extract MeSH terms
      const meshTerms = getAllTagContents(articleXml, 'DescriptorName')
        .map(m => m.replace(/<[^>]*>/g, '').trim())
        .filter(Boolean);

      // Extract publication types
      const publicationType = getAllTagContents(articleXml, 'PublicationType')
        .map(t => t.replace(/<[^>]*>/g, '').trim())
        .filter(Boolean);

      articles.push({
        pmid,
        title,
        abstract,
        authors,
        journal,
        publicationDate,
        year,
        doi,
        pmcid,
        keywords,
        meshTerms,
        publicationType,
      });
    }

    return articles;
  }

  /**
   * Transform PubMed article to unified search result
   */
  private transformToSearchResult(article: PubMedArticle): PubMedSearchResult {
    const contentParts: string[] = [];

    if (article.abstract) {
      contentParts.push(article.abstract);
    }

    if (article.authors.length > 0) {
      contentParts.push(`\nAuthors: ${article.authors.slice(0, 10).join(', ')}`);
    }

    if (article.journal) {
      contentParts.push(`Journal: ${article.journal}`);
    }

    if (article.year) {
      contentParts.push(`Year: ${article.year}`);
    }

    if (article.meshTerms && article.meshTerms.length > 0) {
      contentParts.push(`Topics: ${article.meshTerms.slice(0, 5).join(', ')}`);
    }

    // Determine PDF URL (PMC articles have free full text)
    let pdfUrl: string | undefined;
    if (article.pmcid) {
      pdfUrl = `https://www.ncbi.nlm.nih.gov/pmc/articles/${article.pmcid}/pdf/`;
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
      pdfUrl,
    };
  }

  /**
   * Get article by PMID
   */
  async getArticle(pmid: string): Promise<PubMedSearchResult | null> {
    await this.respectRateLimit();

    try {
      const fetchUrl = this.buildUrl('efetch.fcgi', {
        db: 'pubmed',
        id: pmid,
        rettype: 'xml',
        retmode: 'xml',
      });

      const response = await fetch(fetchUrl);
      const xmlText = await response.text();

      const articles = this.parseArticlesXml(xmlText);
      if (articles.length === 0) return null;

      return this.transformToSearchResult(articles[0]);
    } catch (error) {
      console.error('PubMed get article error:', error);
      throw error;
    }
  }

  /**
   * Search for clinical/medical research
   */
  async searchMedical(
    query: string,
    options?: { limit?: number }
  ): Promise<PubMedSearchResponse> {
    // Add filters for high-quality medical research
    const enhancedQuery = `${query} AND (clinical trial[pt] OR randomized controlled trial[pt] OR meta-analysis[pt] OR systematic review[pt])`;
    
    return this.search(enhancedQuery, {
      limit: options?.limit ?? 10,
      sortBy: 'relevance',
    });
  }

  /**
   * Search for drug/treatment research
   */
  async searchDrugs(
    drugName: string,
    options?: { limit?: number; condition?: string }
  ): Promise<PubMedSearchResponse> {
    let query = `${drugName}[Title/Abstract]`;
    
    if (options?.condition) {
      query += ` AND ${options.condition}[Title/Abstract]`;
    }
    
    query += ' AND (drug therapy[MeSH] OR treatment outcome[MeSH])';
    
    return this.search(query, {
      limit: options?.limit ?? 10,
      sortBy: 'pub_date',
    });
  }

  /**
   * Search for genetics/genomics research
   */
  async searchGenetics(
    query: string,
    options?: { limit?: number }
  ): Promise<PubMedSearchResponse> {
    const enhancedQuery = `${query} AND (genetics[MeSH] OR genomics[MeSH] OR gene expression[MeSH])`;
    
    return this.search(enhancedQuery, {
      limit: options?.limit ?? 10,
      sortBy: 'relevance',
    });
  }

  /**
   * Search for longevity/aging research (immortality research)
   */
  async searchLongevity(
    query: string,
    options?: { limit?: number }
  ): Promise<PubMedSearchResponse> {
    const enhancedQuery = `${query} AND (longevity[MeSH] OR aging[MeSH] OR lifespan[Title/Abstract] OR senescence[MeSH] OR anti-aging[Title/Abstract])`;
    
    return this.search(enhancedQuery, {
      limit: options?.limit ?? 10,
      sortBy: 'pub_date',
    });
  }

  /**
   * Search for disease research
   */
  async searchDisease(
    diseaseName: string,
    options?: { limit?: number; includeReviews?: boolean }
  ): Promise<PubMedSearchResponse> {
    let query = `${diseaseName}[MeSH Terms] OR ${diseaseName}[Title/Abstract]`;
    
    if (options?.includeReviews) {
      query = `(${query}) AND (review[pt] OR systematic review[pt])`;
    }
    
    return this.search(query, {
      limit: options?.limit ?? 10,
      sortBy: 'relevance',
    });
  }

  /**
   * Get related articles
   */
  async getRelated(pmid: string, limit: number = 10): Promise<PubMedSearchResponse> {
    await this.respectRateLimit();

    try {
      const linkUrl = this.buildUrl('elink.fcgi', {
        dbfrom: 'pubmed',
        db: 'pubmed',
        id: pmid,
        cmd: 'neighbor_score',
        retmode: 'json',
      });

      const linkResponse = await fetch(linkUrl);
      const linkData = await linkResponse.json();

      const relatedIds = linkData.linksets?.[0]?.linksetdbs?.[0]?.links?.slice(0, limit) || [];

      if (relatedIds.length === 0) {
        return { results: [], total: 0 };
      }

      // Fetch the related articles
      await this.respectRateLimit();

      const fetchUrl = this.buildUrl('efetch.fcgi', {
        db: 'pubmed',
        id: relatedIds.join(','),
        rettype: 'xml',
        retmode: 'xml',
      });

      const fetchResponse = await fetch(fetchUrl);
      const xmlText = await fetchResponse.text();

      const articles = this.parseArticlesXml(xmlText);

      return {
        results: articles.map(article => this.transformToSearchResult(article)),
        total: relatedIds.length,
      };
    } catch (error) {
      console.error('PubMed get related error:', error);
      throw error;
    }
  }
}

