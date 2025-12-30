/**
 * World Bank API Client
 * 
 * Access to comprehensive global development data including
 * indicators, country data, and economic statistics.
 * 
 * Coverage: 16,000+ indicators, 200+ countries
 * Rate Limit: No official limit
 * 100% FREE - No API key required
 * 
 * @see https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-api-documentation
 */

import { loggers } from '../utils/logger';

const log = loggers.provider;

export interface WorldBankSearchResult {
  url: string;
  title: string;
  content: string;
  indicatorId?: string;
  countryCode?: string;
  countryName?: string;
  value?: number;
  year?: number;
  unit?: string;
  sourceNote?: string;
}

export interface WorldBankSearchResponse {
  results: WorldBankSearchResult[];
  total: number;
}

export interface WorldBankIndicator {
  id: string;
  name: string;
  sourceNote: string;
  sourceOrganization: string;
  topics: Array<{ id: string; value: string }>;
}

export interface WorldBankCountry {
  id: string;
  iso2Code: string;
  name: string;
  region: { id: string; value: string };
  incomeLevel: { id: string; value: string };
  capitalCity: string;
  longitude: string;
  latitude: string;
}

interface WBIndicatorResponse {
  id: string;
  name: string;
  sourceNote: string;
  sourceOrganization: string;
  topics: Array<{ id: string; value: string }>;
}

interface WBDataResponse {
  indicator: { id: string; value: string };
  country: { id: string; value: string };
  value: number | null;
  date: string;
}

const WORLDBANK_API = 'https://api.worldbank.org/v2';

export class WorldBankClient {
  /**
   * Search for indicators using keyword-based mapping
   * World Bank API doesn't have a true search endpoint, so we use keyword matching
   * to common indicators and fetch actual data
   */
  async searchIndicators(
    query: string,
    options?: {
      limit?: number;
    }
  ): Promise<WorldBankSearchResponse> {
    try {
      // Map common query terms to known indicator IDs
      const indicatorMappings: Record<string, string[]> = {
        // Poverty
        'poverty': ['SI.POV.DDAY', 'SI.POV.GINI', 'SI.POV.NAHC', 'SI.POV.GAPS'],
        'poor': ['SI.POV.DDAY', 'SI.POV.GINI'],
        // Population
        'population': ['SP.POP.TOTL', 'SP.POP.GROW', 'SP.URB.TOTL.IN.ZS'],
        // GDP
        'gdp': ['NY.GDP.MKTP.CD', 'NY.GDP.PCAP.CD', 'NY.GDP.MKTP.KD.ZG'],
        'economic': ['NY.GDP.MKTP.CD', 'NY.GDP.PCAP.CD', 'NE.EXP.GNFS.ZS'],
        // Inflation
        'inflation': ['FP.CPI.TOTL.ZG', 'NY.GDP.DEFL.KD.ZG'],
        'cpi': ['FP.CPI.TOTL.ZG'],
        // Employment
        'unemployment': ['SL.UEM.TOTL.ZS', 'SL.UEM.TOTL.NE.ZS'],
        'employment': ['SL.EMP.TOTL.SP.ZS', 'SL.EMP.WORK.ZS'],
        'labor': ['SL.TLF.TOTL.IN', 'SL.TLF.ACTI.ZS'],
        // Health
        'health': ['SH.XPD.CHEX.GD.ZS', 'SH.DYN.MORT', 'SP.DYN.LE00.IN'],
        'life expectancy': ['SP.DYN.LE00.IN', 'SP.DYN.LE00.MA.IN', 'SP.DYN.LE00.FE.IN'],
        'mortality': ['SH.DYN.MORT', 'SP.DYN.IMRT.IN'],
        // Education
        'education': ['SE.ADT.LITR.ZS', 'SE.PRM.ENRR', 'SE.SEC.ENRR'],
        'literacy': ['SE.ADT.LITR.ZS', 'SE.ADT.LITR.FE.ZS', 'SE.ADT.LITR.MA.ZS'],
        // Trade
        'trade': ['NE.EXP.GNFS.ZS', 'NE.IMP.GNFS.ZS', 'TG.VAL.TOTL.GD.ZS'],
        'export': ['NE.EXP.GNFS.ZS', 'TX.VAL.MRCH.CD.WT'],
        'import': ['NE.IMP.GNFS.ZS', 'TM.VAL.MRCH.CD.WT'],
        // Environment
        'co2': ['EN.ATM.CO2E.PC', 'EN.ATM.CO2E.KT'],
        'emissions': ['EN.ATM.CO2E.PC', 'EN.ATM.CO2E.KT'],
        'energy': ['EG.USE.PCAP.KG.OE', 'EG.ELC.ACCS.ZS'],
        // Internet/Technology
        'internet': ['IT.NET.USER.ZS', 'IT.CEL.SETS.P2'],
        'technology': ['IT.NET.USER.ZS', 'IT.CEL.SETS.P2'],
      };

      // Find matching indicators based on query keywords
      const queryLower = query.toLowerCase();
      const matchedIndicatorIds = new Set<string>();
      
      for (const [keyword, indicators] of Object.entries(indicatorMappings)) {
        if (queryLower.includes(keyword)) {
          indicators.forEach(id => matchedIndicatorIds.add(id));
        }
      }

      // If no matches, use popular indicators as fallback
      if (matchedIndicatorIds.size === 0) {
        ['NY.GDP.MKTP.CD', 'SP.POP.TOTL', 'SI.POV.DDAY', 'FP.CPI.TOTL.ZG', 'SL.UEM.TOTL.ZS']
          .forEach(id => matchedIndicatorIds.add(id));
      }

      // Fetch indicator details for matched IDs
      const limit = options?.limit ?? 10;
      const indicatorIds = Array.from(matchedIndicatorIds).slice(0, limit);
      const results: WorldBankSearchResult[] = [];

      for (const id of indicatorIds) {
        try {
          const indicator = await this.getIndicator(id);
          if (indicator) {
            results.push(indicator);
          }
        } catch {
          // Skip failed individual requests
        }
      }

      return {
        results,
        total: results.length,
      };
    } catch (error) {
      log.debug('World Bank indicator search error:', error);
      throw error;
    }
  }

  /**
   * Get indicator data for a country
   */
  async getIndicatorData(
    indicatorId: string,
    countryCode: string = 'all',
    options?: {
      startYear?: number;
      endYear?: number;
      limit?: number;
    }
  ): Promise<WorldBankSearchResponse> {
    try {
      const currentYear = new Date().getFullYear();
      const startYear = options?.startYear ?? currentYear - 10;
      const endYear = options?.endYear ?? currentYear;

      const params = new URLSearchParams({
        format: 'json',
        per_page: String(options?.limit ?? 50),
        date: `${startYear}:${endYear}`,
      });

      const response = await fetch(
        `${WORLDBANK_API}/country/${countryCode}/indicator/${indicatorId}?${params}`
      );

      if (!response.ok) {
        throw new Error(`World Bank API error: ${response.status}`);
      }

      const data = await response.json();
      const results: WBDataResponse[] = data[1] || [];
      const meta = data[0];

      return {
        results: results
          .filter(r => r.value !== null)
          .map(r => this.transformData(r)),
        total: meta?.total || results.length,
      };
    } catch (error) {
      log.debug('World Bank get indicator data error:', error);
      throw error;
    }
  }

  /**
   * Get country information
   */
  async getCountry(countryCode: string): Promise<WorldBankCountry | null> {
    try {
      const params = new URLSearchParams({
        format: 'json',
      });

      const response = await fetch(
        `${WORLDBANK_API}/country/${countryCode}?${params}`
      );

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`World Bank API error: ${response.status}`);
      }

      const data = await response.json();
      const country = data[1]?.[0];

      if (!country) return null;

      return {
        id: country.id,
        iso2Code: country.iso2Code,
        name: country.name,
        region: country.region,
        incomeLevel: country.incomeLevel,
        capitalCity: country.capitalCity,
        longitude: country.longitude,
        latitude: country.latitude,
      };
    } catch (error) {
      log.debug('World Bank get country error:', error);
      throw error;
    }
  }

  /**
   * Search countries
   */
  async searchCountries(
    query: string,
    options?: {
      limit?: number;
    }
  ): Promise<WorldBankCountry[]> {
    try {
      const params = new URLSearchParams({
        format: 'json',
        per_page: String(options?.limit ?? 50),
      });

      const response = await fetch(
        `${WORLDBANK_API}/country?${params}`
      );

      if (!response.ok) {
        throw new Error(`World Bank API error: ${response.status}`);
      }

      const data = await response.json();
      const countries = data[1] || [];

      // Filter by query
      const q = query.toLowerCase();
      return countries
        .filter((c: WorldBankCountry) =>
          c.name?.toLowerCase().includes(q) ||
          c.id?.toLowerCase().includes(q) ||
          c.iso2Code?.toLowerCase().includes(q)
        )
        .map((country: WorldBankCountry) => ({
          id: country.id,
          iso2Code: country.iso2Code,
          name: country.name,
          region: country.region,
          incomeLevel: country.incomeLevel,
          capitalCity: country.capitalCity,
          longitude: country.longitude,
          latitude: country.latitude,
        }));
    } catch (error) {
      log.debug('World Bank country search error:', error);
      throw error;
    }
  }

  /**
   * Get popular indicators
   */
  async getPopularIndicators(): Promise<WorldBankSearchResponse> {
    const popularIndicators = [
      'NY.GDP.MKTP.CD',       // GDP (current US$)
      'NY.GDP.PCAP.CD',       // GDP per capita
      'SP.POP.TOTL',          // Population
      'SL.UEM.TOTL.ZS',       // Unemployment rate
      'FP.CPI.TOTL.ZG',       // Inflation
      'NY.GNP.PCAP.CD',       // GNI per capita
      'SE.ADT.LITR.ZS',       // Literacy rate
      'SH.XPD.CHEX.GD.ZS',    // Health expenditure
      'EN.ATM.CO2E.PC',       // CO2 emissions per capita
      'IT.NET.USER.ZS',       // Internet users
    ];

    const results: WorldBankSearchResult[] = [];

    for (const id of popularIndicators.slice(0, 5)) {
      try {
        const indicator = await this.getIndicator(id);
        if (indicator) {
          results.push(indicator);
        }
      } catch {
        // Skip failed requests
      }
    }

    return {
      results,
      total: results.length,
    };
  }

  /**
   * Get indicator details
   */
  async getIndicator(indicatorId: string): Promise<WorldBankSearchResult | null> {
    try {
      const params = new URLSearchParams({
        format: 'json',
      });

      const response = await fetch(
        `${WORLDBANK_API}/indicator/${indicatorId}?${params}`
      );

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`World Bank API error: ${response.status}`);
      }

      const data = await response.json();
      const indicator = data[1]?.[0];

      if (!indicator) return null;

      return this.transformIndicator(indicator);
    } catch (error) {
      log.debug('World Bank get indicator error:', error);
      throw error;
    }
  }

  /**
   * Unified search across indicators and data
   */
  async search(
    query: string,
    options?: {
      limit?: number;
    }
  ): Promise<WorldBankSearchResponse> {
    // First search indicators
    return this.searchIndicators(query, options);
  }

  /**
   * Transform indicator to our format
   */
  private transformIndicator(indicator: WBIndicatorResponse): WorldBankSearchResult {
    const topics = indicator.topics?.map(t => t.value).join(', ') || '';

    return {
      url: `https://data.worldbank.org/indicator/${indicator.id}`,
      title: indicator.name,
      content: indicator.sourceNote || 
        `Economic indicator: ${indicator.name}. ` +
        (topics ? `Topics: ${topics}. ` : '') +
        (indicator.sourceOrganization ? `Source: ${indicator.sourceOrganization}` : ''),
      indicatorId: indicator.id,
      sourceNote: indicator.sourceNote,
    };
  }

  /**
   * Transform data point to our format
   */
  private transformData(data: WBDataResponse): WorldBankSearchResult {
    return {
      url: `https://data.worldbank.org/indicator/${data.indicator.id}?locations=${data.country.id}`,
      title: `${data.indicator.value} - ${data.country.value} (${data.date})`,
      content: `${data.indicator.value}: ${data.value?.toLocaleString() ?? 'N/A'} for ${data.country.value} in ${data.date}`,
      indicatorId: data.indicator.id,
      countryCode: data.country.id,
      countryName: data.country.value,
      value: data.value ?? undefined,
      year: parseInt(data.date),
    };
  }
}


