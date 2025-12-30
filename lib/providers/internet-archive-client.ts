/**
 * Internet Archive API Client
 * 
 * Access to 40+ million books, texts, audio, video, and more from
 * the world's largest digital library and home of the Wayback Machine.
 * 
 * Coverage: 40M+ books, 15M+ audio recordings, 7M+ videos, 4M+ images
 * Rate Limit: Reasonable use, no strict limit
 * 100% FREE - No API key required
 * 
 * @see https://archive.org/developers/
 * @see https://archive.org/advancedsearch.php
 */

import { loggers } from '../utils/logger';

const log = loggers.provider;

export interface InternetArchiveSearchResult {
  url: string;
  title: string;
  content: string;
  identifier: string;
  creator?: string[];
  date?: string;
  year?: number;
  description?: string;
  subject?: string[];
  mediaType?: string;
  collection?: string[];
  language?: string;
  downloads?: number;
  imageUrl?: string;
  format?: string[];
}

export interface InternetArchiveSearchResponse {
  results: InternetArchiveSearchResult[];
  total: number;
  pages: number;
}

export interface InternetArchiveItem {
  identifier: string;
  title: string;
  description?: string;
  creator?: string | string[];
  date?: string;
  year?: number;
  subject?: string | string[];
  mediatype?: string;
  collection?: string | string[];
  language?: string;
  downloads?: number;
  format?: string[];
  files?: Array<{
    name: string;
    format: string;
    size?: string;
  }>;
}

interface IASearchResponse {
  responseHeader: {
    status: number;
    QTime: number;
    params: Record<string, string>;
  };
  response: {
    numFound: number;
    start: number;
    docs: IASearchDoc[];
  };
}

interface IASearchDoc {
  identifier: string;
  title?: string;
  description?: string | string[];
  creator?: string | string[];
  date?: string;
  year?: number;
  subject?: string | string[];
  mediatype?: string;
  collection?: string | string[];
  language?: string;
  downloads?: number;
  format?: string[];
}

interface IAMetadataResponse {
  created: number;
  d1: string;
  d2: string;
  dir: string;
  files: Array<{
    name: string;
    source: string;
    format: string;
    original?: string;
    md5?: string;
    size?: string;
  }>;
  files_count: number;
  item_last_updated: number;
  item_size: number;
  metadata: {
    identifier: string;
    title?: string;
    description?: string | string[];
    creator?: string | string[];
    date?: string;
    year?: string;
    subject?: string | string[];
    mediatype?: string;
    collection?: string | string[];
    language?: string;
  };
  server: string;
  uniq: number;
  workable_servers: string[];
}

const IA_API = 'https://archive.org';

export class InternetArchiveClient {
  /**
   * Search the Internet Archive
   */
  async search(
    query: string,
    options?: {
      limit?: number;
      page?: number;
      mediaType?: 'texts' | 'audio' | 'movies' | 'image' | 'software' | 'web' | 'collection' | 'data';
      collection?: string;
      creator?: string;
      year?: number | [number, number]; // Single year or [from, to] range
      language?: string;
      sortBy?: 'downloads' | 'date' | 'titleSorter' | 'creatorSorter';
      sortOrder?: 'asc' | 'desc';
    }
  ): Promise<InternetArchiveSearchResponse> {
    try {
      const rows = options?.limit ?? 10;
      const page = options?.page ?? 1;

      // Build query with filters
      let searchQuery = query;
      
      if (options?.mediaType) {
        searchQuery += ` AND mediatype:${options.mediaType}`;
      }
      if (options?.collection) {
        searchQuery += ` AND collection:${options.collection}`;
      }
      if (options?.creator) {
        searchQuery += ` AND creator:"${options.creator}"`;
      }
      if (options?.year) {
        if (Array.isArray(options.year)) {
          searchQuery += ` AND year:[${options.year[0]} TO ${options.year[1]}]`;
        } else {
          searchQuery += ` AND year:${options.year}`;
        }
      }
      if (options?.language) {
        searchQuery += ` AND language:${options.language}`;
      }

      const params = new URLSearchParams({
        q: searchQuery,
        output: 'json',
        rows: String(rows),
        page: String(page),
      });

      // Add sorting
      if (options?.sortBy) {
        const sortOrder = options?.sortOrder || 'desc';
        params.set('sort[]', `${options.sortBy} ${sortOrder}`);
      }

      // Request specific fields
      params.set('fl[]', 'identifier,title,description,creator,date,year,subject,mediatype,collection,language,downloads,format');

      const response = await fetch(`${IA_API}/advancedsearch.php?${params}`);
      if (!response.ok) throw new Error(`Internet Archive API error: ${response.status}`);

      const data: IASearchResponse = await response.json();

      return {
        results: data.response.docs.map(doc => this.transformDoc(doc)),
        total: data.response.numFound,
        pages: Math.ceil(data.response.numFound / rows),
      };
    } catch (error) {
      log.debug('Internet Archive search error:', error);
      throw error;
    }
  }

  /**
   * Search books and texts
   */
  async searchBooks(
    query: string,
    options?: {
      limit?: number;
      year?: number | [number, number];
      language?: string;
      sortBy?: 'downloads' | 'date';
    }
  ): Promise<InternetArchiveSearchResponse> {
    return this.search(query, { ...options, mediaType: 'texts' });
  }

  /**
   * Search historical audio recordings
   */
  async searchAudio(
    query: string,
    options?: {
      limit?: number;
      year?: number | [number, number];
    }
  ): Promise<InternetArchiveSearchResponse> {
    return this.search(query, { ...options, mediaType: 'audio' });
  }

  /**
   * Search historical films and videos
   */
  async searchVideos(
    query: string,
    options?: {
      limit?: number;
      year?: number | [number, number];
    }
  ): Promise<InternetArchiveSearchResponse> {
    return this.search(query, { ...options, mediaType: 'movies' });
  }

  /**
   * Search images
   */
  async searchImages(
    query: string,
    options?: {
      limit?: number;
    }
  ): Promise<InternetArchiveSearchResponse> {
    return this.search(query, { ...options, mediaType: 'image' });
  }

  /**
   * Get item metadata by identifier
   */
  async getItem(identifier: string): Promise<InternetArchiveItem | null> {
    try {
      const response = await fetch(`${IA_API}/metadata/${identifier}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Internet Archive API error: ${response.status}`);
      }

      const data: IAMetadataResponse = await response.json();
      const metadata = data.metadata;

      return {
        identifier: metadata.identifier,
        title: this.toSingleString(metadata.title) || identifier,
        description: this.toSingleString(metadata.description),
        creator: this.toArray(metadata.creator),
        date: this.toSingleString(metadata.date),
        year: metadata.year ? parseInt(this.toSingleString(metadata.year) || '0') : undefined,
        subject: this.toArray(metadata.subject),
        mediatype: this.toSingleString(metadata.mediatype),
        collection: this.toArray(metadata.collection),
        language: this.toSingleString(metadata.language),
        files: data.files.slice(0, 20).map(f => ({
          name: f.name,
          format: f.format,
          size: f.size,
        })),
      };
    } catch (error) {
      log.debug('Internet Archive get item error:', error);
      return null;
    }
  }

  /**
   * Get full text of a book (if available)
   */
  async getBookText(identifier: string): Promise<string | null> {
    try {
      // First get the item to find the text file
      const item = await this.getItem(identifier);
      if (!item) return null;

      // Look for a text file
      const textFile = item.files?.find(f => 
        f.format === 'Text' || f.name.endsWith('.txt') || f.name.endsWith('_djvu.txt')
      );

      if (!textFile) return null;

      const textUrl = `https://archive.org/download/${identifier}/${textFile.name}`;
      const response = await fetch(textUrl);
      
      if (!response.ok) return null;
      return await response.text();
    } catch (error) {
      log.debug('Internet Archive get text error:', error);
      return null;
    }
  }

  /**
   * Search by collection (e.g., 'americana', 'prelinger' for historical films)
   */
  async searchCollection(
    collection: string,
    query?: string,
    options?: {
      limit?: number;
      sortBy?: 'downloads' | 'date';
    }
  ): Promise<InternetArchiveSearchResponse> {
    return this.search(query || '*', { ...options, collection });
  }

  /**
   * Get popular historical collections
   */
  getPopularHistoryCollections(): Array<{ id: string; name: string; description: string }> {
    return [
      { id: 'americana', name: 'American Libraries', description: 'Historical American books and documents' },
      { id: 'prelinger', name: 'Prelinger Archives', description: 'Historical films and ephemeral films' },
      { id: 'library_of_congress', name: 'Library of Congress', description: 'LOC collections on Archive.org' },
      { id: 'smithsonian', name: 'Smithsonian Libraries', description: 'Smithsonian historical collections' },
      { id: 'gutenberg', name: 'Project Gutenberg', description: 'Public domain books' },
      { id: 'historicfilms', name: 'Historic Films', description: 'Rare historical footage' },
      { id: 'usgovernmentdocuments', name: 'US Government Documents', description: 'Historical government publications' },
      { id: 'europeanlibraries', name: 'European Libraries', description: 'European historical texts' },
      { id: 'biodiversity', name: 'Biodiversity Heritage Library', description: 'Historical natural history' },
      { id: 'maps_usgs', name: 'USGS Maps', description: 'Historical US Geological Survey maps' },
    ];
  }

  /**
   * Transform search doc to our format
   */
  private transformDoc(doc: IASearchDoc): InternetArchiveSearchResult {
    const title = this.toSingleString(doc.title) || doc.identifier;
    const description = this.toSingleString(doc.description);
    const creator = this.toArray(doc.creator);
    
    let content = description || '';
    if (!content && creator.length > 0) {
      content = `By ${creator.join(', ')}`;
      if (doc.year) content += ` (${doc.year})`;
    }
    if (!content) {
      content = `${doc.mediatype || 'Item'} from the Internet Archive`;
    }

    return {
      url: `https://archive.org/details/${doc.identifier}`,
      title,
      content,
      identifier: doc.identifier,
      creator,
      date: this.toSingleString(doc.date),
      year: doc.year,
      description,
      subject: this.toArray(doc.subject),
      mediaType: doc.mediatype,
      collection: this.toArray(doc.collection),
      language: this.toSingleString(doc.language),
      downloads: doc.downloads,
      imageUrl: `https://archive.org/services/img/${doc.identifier}`,
      format: doc.format,
    };
  }

  /**
   * Helper to convert string | string[] to string
   */
  private toSingleString(value?: string | string[]): string | undefined {
    if (!value) return undefined;
    return Array.isArray(value) ? value[0] : value;
  }

  /**
   * Helper to convert string | string[] to string[]
   */
  private toArray(value?: string | string[]): string[] {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }
}


