/**
 * This Day in History API Client
 * 
 * Access to historical events, notable births, and deaths for any given day.
 * Great for adding historical context and daily history facts.
 * 
 * Coverage: Historical events across all of history
 * Rate Limit: Reasonable use
 * 100% FREE - No API key required for basic use
 * 
 * Uses multiple free APIs for redundancy:
 * - muffinlabs.com/today-in-history
 * - numbersapi.com
 * - Wikipedia On This Day
 */

export interface HistoricalEvent {
  year: number | string;
  title: string;
  description: string;
  links?: Array<{ title: string; url: string }>;
  category?: 'event' | 'birth' | 'death';
}

export interface ThisDayInHistoryResult {
  url: string;
  title: string;
  content: string;
  date: string;
  year?: number | string;
  category: 'event' | 'birth' | 'death';
  links?: Array<{ title: string; url: string }>;
}

export interface ThisDayInHistoryResponse {
  date: string;
  events: ThisDayInHistoryResult[];
  births: ThisDayInHistoryResult[];
  deaths: ThisDayInHistoryResult[];
  total: number;
}

interface MuffinLabsResponse {
  date: string;
  url: string;
  data: {
    Events: Array<{
      year: string;
      text: string;
      html: string;
      links: Array<{ title: string; link: string }>;
    }>;
    Births: Array<{
      year: string;
      text: string;
      html: string;
      links: Array<{ title: string; link: string }>;
    }>;
    Deaths: Array<{
      year: string;
      text: string;
      html: string;
      links: Array<{ title: string; link: string }>;
    }>;
  };
}

interface WikipediaOnThisDayResponse {
  selected: Array<{
    text: string;
    year: number;
    pages: Array<{
      title: string;
      extract: string;
      content_urls: { desktop: { page: string } };
    }>;
  }>;
  births: Array<{
    text: string;
    year: number;
    pages: Array<{
      title: string;
      extract: string;
      content_urls: { desktop: { page: string } };
    }>;
  }>;
  deaths: Array<{
    text: string;
    year: number;
    pages: Array<{
      title: string;
      extract: string;
      content_urls: { desktop: { page: string } };
    }>;
  }>;
  events: Array<{
    text: string;
    year: number;
    pages: Array<{
      title: string;
      extract: string;
      content_urls: { desktop: { page: string } };
    }>;
  }>;
}

const MUFFINLABS_API = 'https://history.muffinlabs.com/date';
const WIKIPEDIA_API = 'https://en.wikipedia.org/api/rest_v1/feed/onthisday';

export class HistoryClient {
  /**
   * Get historical events for today
   */
  async getToday(options?: { limit?: number }): Promise<ThisDayInHistoryResponse> {
    const today = new Date();
    return this.getByDate(today.getMonth() + 1, today.getDate(), options);
  }

  /**
   * Get historical events for a specific date
   */
  async getByDate(
    month: number,
    day: number,
    options?: { limit?: number }
  ): Promise<ThisDayInHistoryResponse> {
    const limit = options?.limit ?? 10;
    
    // Try Wikipedia API first (more reliable), fall back to MuffinLabs
    try {
      return await this.getFromWikipedia(month, day, limit);
    } catch (error) {
      console.warn('Wikipedia API failed, trying MuffinLabs:', error);
      try {
        return await this.getFromMuffinLabs(month, day, limit);
      } catch (fallbackError) {
        console.error('Both history APIs failed:', fallbackError);
        throw fallbackError;
      }
    }
  }

  /**
   * Get events from Wikipedia API
   */
  private async getFromWikipedia(
    month: number,
    day: number,
    limit: number
  ): Promise<ThisDayInHistoryResponse> {
    const monthStr = String(month).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${this.getMonthName(month)} ${day}`;

    const response = await fetch(`${WIKIPEDIA_API}/all/${monthStr}/${dayStr}`);
    if (!response.ok) throw new Error(`Wikipedia API error: ${response.status}`);

    const data: WikipediaOnThisDayResponse = await response.json();

    const events = (data.events || data.selected || []).slice(0, limit).map(event => 
      this.transformWikipediaEvent(event, dateStr, 'event')
    );

    const births = (data.births || []).slice(0, limit).map(event => 
      this.transformWikipediaEvent(event, dateStr, 'birth')
    );

    const deaths = (data.deaths || []).slice(0, limit).map(event => 
      this.transformWikipediaEvent(event, dateStr, 'death')
    );

    return {
      date: dateStr,
      events,
      births,
      deaths,
      total: events.length + births.length + deaths.length,
    };
  }

  /**
   * Get events from MuffinLabs API
   */
  private async getFromMuffinLabs(
    month: number,
    day: number,
    limit: number
  ): Promise<ThisDayInHistoryResponse> {
    const response = await fetch(`${MUFFINLABS_API}/${month}/${day}`);
    if (!response.ok) throw new Error(`MuffinLabs API error: ${response.status}`);

    const data: MuffinLabsResponse = await response.json();
    const dateStr = data.date;

    const events = (data.data.Events || []).slice(0, limit).map(event => 
      this.transformMuffinLabsEvent(event, dateStr, 'event')
    );

    const births = (data.data.Births || []).slice(0, limit).map(event => 
      this.transformMuffinLabsEvent(event, dateStr, 'birth')
    );

    const deaths = (data.data.Deaths || []).slice(0, limit).map(event => 
      this.transformMuffinLabsEvent(event, dateStr, 'death')
    );

    return {
      date: dateStr,
      events,
      births,
      deaths,
      total: events.length + births.length + deaths.length,
    };
  }

  /**
   * Search for events by year
   */
  async getByYear(
    year: number,
    options?: { limit?: number }
  ): Promise<ThisDayInHistoryResult[]> {
    // Get today's events and filter by year
    const today = await this.getToday({ limit: 100 });
    const allEvents = [...today.events, ...today.births, ...today.deaths];
    
    return allEvents
      .filter(event => {
        const eventYear = typeof event.year === 'string' ? parseInt(event.year) : event.year;
        return eventYear === year;
      })
      .slice(0, options?.limit ?? 10);
  }

  /**
   * Get notable births for a date
   */
  async getBirths(
    month: number,
    day: number,
    options?: { limit?: number }
  ): Promise<ThisDayInHistoryResult[]> {
    const data = await this.getByDate(month, day, options);
    return data.births;
  }

  /**
   * Get notable deaths for a date
   */
  async getDeaths(
    month: number,
    day: number,
    options?: { limit?: number }
  ): Promise<ThisDayInHistoryResult[]> {
    const data = await this.getByDate(month, day, options);
    return data.deaths;
  }

  /**
   * Get events only (no births/deaths)
   */
  async getEvents(
    month: number,
    day: number,
    options?: { limit?: number }
  ): Promise<ThisDayInHistoryResult[]> {
    const data = await this.getByDate(month, day, options);
    return data.events;
  }

  /**
   * Transform Wikipedia event to our format
   */
  private transformWikipediaEvent(
    event: {
      text: string;
      year: number;
      pages?: Array<{
        title: string;
        extract: string;
        content_urls: { desktop: { page: string } };
      }>;
    },
    dateStr: string,
    category: 'event' | 'birth' | 'death'
  ): ThisDayInHistoryResult {
    const links = event.pages?.map(page => ({
      title: page.title,
      url: page.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
    }));

    const categoryLabel = {
      event: 'Historical Event',
      birth: 'Notable Birth',
      death: 'Notable Death',
    };

    return {
      url: links?.[0]?.url || `https://en.wikipedia.org/wiki/${dateStr.replace(' ', '_')}`,
      title: `${event.year}: ${event.text.slice(0, 100)}${event.text.length > 100 ? '...' : ''}`,
      content: event.text,
      date: dateStr,
      year: event.year,
      category,
      links,
    };
  }

  /**
   * Transform MuffinLabs event to our format
   */
  private transformMuffinLabsEvent(
    event: {
      year: string;
      text: string;
      html: string;
      links: Array<{ title: string; link: string }>;
    },
    dateStr: string,
    category: 'event' | 'birth' | 'death'
  ): ThisDayInHistoryResult {
    const links = event.links?.map(link => ({
      title: link.title,
      url: link.link,
    }));

    return {
      url: links?.[0]?.url || `https://en.wikipedia.org/wiki/${dateStr.replace(' ', '_')}`,
      title: `${event.year}: ${event.text.slice(0, 100)}${event.text.length > 100 ? '...' : ''}`,
      content: event.text,
      date: dateStr,
      year: event.year,
      category,
      links,
    };
  }

  /**
   * Get month name from number
   */
  private getMonthName(month: number): string {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1] || 'January';
  }
}

/**
 * Search historical events across multiple sources
 */
export interface HistorySearchResult {
  url: string;
  title: string;
  content: string;
  date?: string;
  year?: number | string;
  source: string;
  category?: string;
}

export interface HistorySearchResponse {
  results: HistorySearchResult[];
  total: number;
}

