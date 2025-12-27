/**
 * Open Library API Client
 * 
 * Access to 20+ million books from the Internet Archive's Open Library.
 * Includes book metadata, covers, and full text for public domain works.
 * 
 * Coverage: 20M+ books
 * Rate Limit: No official limit, be respectful
 * 100% FREE - No API key required
 * 
 * @see https://openlibrary.org/developers/api
 */

export interface OpenLibrarySearchResult {
  url: string;
  title: string;
  content: string;
  authors: string[];
  publishYear?: number;
  isbn?: string[];
  subjects?: string[];
  coverUrl?: string;
  pageCount?: number;
  publisher?: string[];
  language?: string[];
  openLibraryId: string;
  hasFullText: boolean;
}

export interface OpenLibrarySearchResponse {
  results: OpenLibrarySearchResult[];
  total: number;
}

interface OLSearchDoc {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  isbn?: string[];
  subject?: string[];
  cover_i?: number;
  number_of_pages_median?: number;
  publisher?: string[];
  language?: string[];
  has_fulltext?: boolean;
  ia?: string[];
  first_sentence?: string[];
}

interface OLSearchResponse {
  numFound: number;
  start: number;
  docs: OLSearchDoc[];
}

interface OLWork {
  title: string;
  description?: string | { value: string };
  subjects?: string[];
  covers?: number[];
  authors?: Array<{ author: { key: string } }>;
  first_publish_date?: string;
}

interface OLAuthor {
  name: string;
  bio?: string | { value: string };
  birth_date?: string;
  death_date?: string;
}

const OPENLIBRARY_API = 'https://openlibrary.org';

export class OpenLibraryClient {
  /**
   * Search for books
   */
  async search(
    query: string,
    options?: {
      limit?: number;
      offset?: number;
      subject?: string;
      author?: string;
      title?: string;
    }
  ): Promise<OpenLibrarySearchResponse> {
    try {
      const params = new URLSearchParams({
        q: query,
        limit: String(options?.limit ?? 10),
        offset: String(options?.offset ?? 0),
      });

      // Add specific search fields
      if (options?.subject) {
        params.set('subject', options.subject);
      }
      if (options?.author) {
        params.set('author', options.author);
      }
      if (options?.title) {
        params.set('title', options.title);
      }

      const response = await fetch(`${OPENLIBRARY_API}/search.json?${params}`);

      if (!response.ok) {
        throw new Error(`Open Library API error: ${response.status}`);
      }

      const data: OLSearchResponse = await response.json();

      return {
        results: data.docs.map(doc => this.transformDoc(doc)),
        total: data.numFound,
      };
    } catch (error) {
      console.error('Open Library search error:', error);
      throw error;
    }
  }

  /**
   * Search by subject
   */
  async searchBySubject(
    subject: string,
    options?: {
      limit?: number;
    }
  ): Promise<OpenLibrarySearchResponse> {
    try {
      const params = new URLSearchParams({
        limit: String(options?.limit ?? 10),
      });

      const formattedSubject = subject.toLowerCase().replace(/ /g, '_');
      const response = await fetch(
        `${OPENLIBRARY_API}/subjects/${formattedSubject}.json?${params}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          return { results: [], total: 0 };
        }
        throw new Error(`Open Library API error: ${response.status}`);
      }

      const data = await response.json();
      const works = data.works || [];

      return {
        results: works.map((work: {
          key: string;
          title: string;
          authors?: Array<{ name: string }>;
          cover_id?: number;
          first_publish_year?: number;
          subject?: string[];
          has_fulltext?: boolean;
        }) => ({
          url: `https://openlibrary.org${work.key}`,
          title: work.title,
          content: `Book on the subject of ${subject}`,
          authors: work.authors?.map(a => a.name) || [],
          publishYear: work.first_publish_year,
          subjects: work.subject,
          coverUrl: work.cover_id
            ? `https://covers.openlibrary.org/b/id/${work.cover_id}-M.jpg`
            : undefined,
          openLibraryId: work.key.replace('/works/', ''),
          hasFullText: work.has_fulltext ?? false,
        })),
        total: data.work_count || works.length,
      };
    } catch (error) {
      console.error('Open Library subject search error:', error);
      throw error;
    }
  }

  /**
   * Get work details by Open Library ID
   */
  async getWork(workId: string): Promise<OpenLibrarySearchResult | null> {
    try {
      const response = await fetch(`${OPENLIBRARY_API}/works/${workId}.json`);

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Open Library API error: ${response.status}`);
      }

      const work: OLWork = await response.json();

      // Get authors
      const authorNames: string[] = [];
      if (work.authors) {
        for (const authorRef of work.authors.slice(0, 5)) {
          try {
            const authorResponse = await fetch(
              `${OPENLIBRARY_API}${authorRef.author.key}.json`
            );
            if (authorResponse.ok) {
              const author: OLAuthor = await authorResponse.json();
              authorNames.push(author.name);
            }
          } catch {
            // Skip failed author fetches
          }
        }
      }

      const description = typeof work.description === 'string'
        ? work.description
        : work.description?.value || '';

      return {
        url: `https://openlibrary.org/works/${workId}`,
        title: work.title,
        content: description,
        authors: authorNames,
        subjects: work.subjects?.slice(0, 10),
        coverUrl: work.covers?.[0]
          ? `https://covers.openlibrary.org/b/id/${work.covers[0]}-M.jpg`
          : undefined,
        openLibraryId: workId,
        hasFullText: false,
      };
    } catch (error) {
      console.error('Open Library get work error:', error);
      throw error;
    }
  }

  /**
   * Get book by ISBN
   */
  async getByISBN(isbn: string): Promise<OpenLibrarySearchResult | null> {
    try {
      const cleanISBN = isbn.replace(/[-\s]/g, '');
      const response = await fetch(`${OPENLIBRARY_API}/isbn/${cleanISBN}.json`);

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Open Library API error: ${response.status}`);
      }

      const book = await response.json();

      return {
        url: `https://openlibrary.org/isbn/${cleanISBN}`,
        title: book.title,
        content: book.description || '',
        authors: [], // Would need additional fetch
        isbn: [cleanISBN],
        pageCount: book.number_of_pages,
        publisher: book.publishers,
        openLibraryId: book.key?.replace('/books/', '') || cleanISBN,
        hasFullText: false,
      };
    } catch (error) {
      console.error('Open Library ISBN lookup error:', error);
      throw error;
    }
  }

  /**
   * Search for authors
   */
  async searchAuthors(
    name: string,
    options?: {
      limit?: number;
    }
  ): Promise<Array<{ name: string; key: string; workCount: number }>> {
    try {
      const params = new URLSearchParams({
        q: name,
        limit: String(options?.limit ?? 10),
      });

      const response = await fetch(`${OPENLIBRARY_API}/search/authors.json?${params}`);

      if (!response.ok) {
        throw new Error(`Open Library API error: ${response.status}`);
      }

      const data = await response.json();

      return (data.docs || []).map((author: {
        name: string;
        key: string;
        work_count: number;
      }) => ({
        name: author.name,
        key: author.key,
        workCount: author.work_count,
      }));
    } catch (error) {
      console.error('Open Library author search error:', error);
      throw error;
    }
  }

  /**
   * Transform search doc to our format
   */
  private transformDoc(doc: OLSearchDoc): OpenLibrarySearchResult {
    const content = doc.first_sentence?.join(' ') || 
      `Book by ${doc.author_name?.join(', ') || 'Unknown author'}` +
      (doc.first_publish_year ? ` (${doc.first_publish_year})` : '');

    return {
      url: `https://openlibrary.org${doc.key}`,
      title: doc.title,
      content,
      authors: doc.author_name || [],
      publishYear: doc.first_publish_year,
      isbn: doc.isbn?.slice(0, 3),
      subjects: doc.subject?.slice(0, 10),
      coverUrl: doc.cover_i
        ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
        : undefined,
      pageCount: doc.number_of_pages_median,
      publisher: doc.publisher?.slice(0, 3),
      language: doc.language?.slice(0, 3),
      openLibraryId: doc.key.replace('/works/', ''),
      hasFullText: doc.has_fulltext ?? false,
    };
  }
}


