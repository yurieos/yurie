/**
 * FRED (Federal Reserve Economic Data) API Client
 * 
 * Access to 800,000+ economic data series from the Federal Reserve Bank of St. Louis.
 * Essential for finance, economics, and policy research.
 * 
 * Coverage: 800K+ economic time series
 * Rate Limit: 120 requests/minute
 * FREE - API key required (free registration)
 * 
 * @see https://fred.stlouisfed.org/docs/api/fred/
 * Register for API key: https://fred.stlouisfed.org/docs/api/api_key.html
 */

export interface FREDSearchResult {
  url: string;
  title: string;
  content: string;
  seriesId: string;
  frequency: string;
  units: string;
  seasonalAdjustment: string;
  lastUpdated: string;
  popularity: number;
  observationStart?: string;
  observationEnd?: string;
  latestValue?: number;
  latestDate?: string;
}

export interface FREDSearchResponse {
  results: FREDSearchResult[];
  total: number;
}

export interface FREDObservation {
  date: string;
  value: number | null;
}

interface FREDSeries {
  id: string;
  title: string;
  frequency: string;
  frequency_short: string;
  units: string;
  units_short: string;
  seasonal_adjustment: string;
  seasonal_adjustment_short: string;
  last_updated: string;
  popularity: number;
  observation_start: string;
  observation_end: string;
  notes?: string;
}

interface FREDSeriesResponse {
  seriess: FREDSeries[];
}

interface FREDSearchAPIResponse {
  count: number;
  offset: number;
  limit: number;
  seriess: FREDSeries[];
}

interface FREDObservationsResponse {
  observations: Array<{
    date: string;
    value: string;
  }>;
}

const FRED_API = 'https://api.stlouisfed.org/fred';

export class FREDClient {
  private apiKey: string;

  constructor() {
    const apiKey = process.env.FRED_API_KEY;
    if (!apiKey) {
      console.warn('FRED_API_KEY not set - FRED provider will not work. Get a free key at https://fred.stlouisfed.org/docs/api/api_key.html');
    }
    this.apiKey = apiKey || '';
  }

  /**
   * Check if client is available
   */
  isAvailable(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Search for economic data series
   */
  async search(
    query: string,
    options?: {
      limit?: number;
      offset?: number;
      orderBy?: 'search_rank' | 'series_id' | 'title' | 'popularity' | 'last_updated';
      sortOrder?: 'asc' | 'desc';
    }
  ): Promise<FREDSearchResponse> {
    if (!this.apiKey) {
      throw new Error('FRED API key not configured');
    }

    try {
      const params = new URLSearchParams({
        api_key: this.apiKey,
        search_text: query,
        limit: String(options?.limit ?? 10),
        offset: String(options?.offset ?? 0),
        order_by: options?.orderBy || 'search_rank',
        sort_order: options?.sortOrder || 'desc',
        file_type: 'json',
      });

      const response = await fetch(`${FRED_API}/series/search?${params}`);

      if (!response.ok) {
        throw new Error(`FRED API error: ${response.status}`);
      }

      const data: FREDSearchAPIResponse = await response.json();

      // Get latest observations for each series
      const resultsWithValues = await Promise.all(
        data.seriess.map(async series => {
          const result = this.transformSeries(series);
          try {
            const obs = await this.getLatestObservation(series.id);
            if (obs) {
              result.latestValue = obs.value ?? undefined;
              result.latestDate = obs.date;
            }
          } catch {
            // Ignore errors getting observations
          }
          return result;
        })
      );

      return {
        results: resultsWithValues,
        total: data.count,
      };
    } catch (error) {
      console.error('FRED search error:', error);
      throw error;
    }
  }

  /**
   * Get series info
   */
  async getSeries(seriesId: string): Promise<FREDSearchResult | null> {
    if (!this.apiKey) {
      throw new Error('FRED API key not configured');
    }

    try {
      const params = new URLSearchParams({
        api_key: this.apiKey,
        series_id: seriesId,
        file_type: 'json',
      });

      const response = await fetch(`${FRED_API}/series?${params}`);

      if (!response.ok) {
        if (response.status === 400) return null; // Series not found
        throw new Error(`FRED API error: ${response.status}`);
      }

      const data: FREDSeriesResponse = await response.json();

      if (!data.seriess || data.seriess.length === 0) return null;

      const result = this.transformSeries(data.seriess[0]);

      // Get latest observation
      const obs = await this.getLatestObservation(seriesId);
      if (obs) {
        result.latestValue = obs.value ?? undefined;
        result.latestDate = obs.date;
      }

      return result;
    } catch (error) {
      console.error('FRED get series error:', error);
      throw error;
    }
  }

  /**
   * Get observations (time series data)
   */
  async getObservations(
    seriesId: string,
    options?: {
      startDate?: string; // YYYY-MM-DD
      endDate?: string;
      limit?: number;
    }
  ): Promise<FREDObservation[]> {
    if (!this.apiKey) {
      throw new Error('FRED API key not configured');
    }

    try {
      const params = new URLSearchParams({
        api_key: this.apiKey,
        series_id: seriesId,
        file_type: 'json',
        sort_order: 'desc',
      });

      if (options?.startDate) {
        params.set('observation_start', options.startDate);
      }
      if (options?.endDate) {
        params.set('observation_end', options.endDate);
      }
      if (options?.limit) {
        params.set('limit', String(options.limit));
      }

      const response = await fetch(`${FRED_API}/series/observations?${params}`);

      if (!response.ok) {
        throw new Error(`FRED API error: ${response.status}`);
      }

      const data: FREDObservationsResponse = await response.json();

      return data.observations.map(obs => ({
        date: obs.date,
        value: obs.value === '.' ? null : parseFloat(obs.value),
      }));
    } catch (error) {
      console.error('FRED get observations error:', error);
      throw error;
    }
  }

  /**
   * Get latest observation for a series
   */
  async getLatestObservation(seriesId: string): Promise<FREDObservation | null> {
    const observations = await this.getObservations(seriesId, { limit: 1 });
    return observations[0] || null;
  }

  /**
   * Search by category
   */
  async searchByCategory(
    categoryId: number,
    options?: {
      limit?: number;
    }
  ): Promise<FREDSearchResponse> {
    if (!this.apiKey) {
      throw new Error('FRED API key not configured');
    }

    try {
      const params = new URLSearchParams({
        api_key: this.apiKey,
        category_id: String(categoryId),
        limit: String(options?.limit ?? 10),
        file_type: 'json',
      });

      const response = await fetch(`${FRED_API}/category/series?${params}`);

      if (!response.ok) {
        throw new Error(`FRED API error: ${response.status}`);
      }

      const data: FREDSearchAPIResponse = await response.json();

      return {
        results: data.seriess.map(series => this.transformSeries(series)),
        total: data.count,
      };
    } catch (error) {
      console.error('FRED category search error:', error);
      throw error;
    }
  }

  /**
   * Get popular series (commonly used indicators)
   */
  async getPopularSeries(): Promise<FREDSearchResponse> {
    // Search for common economic indicators
    const popularIds = [
      'GDP',        // Gross Domestic Product
      'UNRATE',     // Unemployment Rate
      'CPIAUCSL',   // Consumer Price Index
      'FEDFUNDS',   // Federal Funds Rate
      'DGS10',      // 10-Year Treasury
      'SP500',      // S&P 500
    ];

    const results: FREDSearchResult[] = [];

    for (const id of popularIds) {
      const series = await this.getSeries(id);
      if (series) {
        results.push(series);
      }
    }

    return {
      results,
      total: results.length,
    };
  }

  /**
   * Transform series to our format
   */
  private transformSeries(series: FREDSeries): FREDSearchResult {
    const content = `${series.title}. ` +
      `Frequency: ${series.frequency}. ` +
      `Units: ${series.units}. ` +
      `Seasonal adjustment: ${series.seasonal_adjustment}. ` +
      `Data range: ${series.observation_start} to ${series.observation_end}. ` +
      (series.notes ? `Notes: ${series.notes.slice(0, 500)}` : '');

    return {
      url: `https://fred.stlouisfed.org/series/${series.id}`,
      title: series.title,
      content,
      seriesId: series.id,
      frequency: series.frequency,
      units: series.units,
      seasonalAdjustment: series.seasonal_adjustment,
      lastUpdated: series.last_updated,
      popularity: series.popularity,
      observationStart: series.observation_start,
      observationEnd: series.observation_end,
    };
  }
}

