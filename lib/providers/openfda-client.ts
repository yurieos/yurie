/**
 * OpenFDA API Client
 * 
 * Access to FDA data on drugs, medical devices, food recalls,
 * adverse events, and more. Essential for medical and health research.
 * 
 * Coverage: Millions of records across drugs, devices, food
 * Rate Limit: 240 requests/minute (no key) → 120,000/day (with key)
 * 100% FREE - API key optional for higher limits
 * 
 * @see https://open.fda.gov/apis/
 * Register for API key: https://open.fda.gov/apis/authentication/
 */

import { loggers } from '../utils/logger';

const log = loggers.provider;

export interface OpenFDASearchResult {
  url: string;
  title: string;
  content: string;
  category: 'drug' | 'device' | 'food';
  brandName?: string;
  genericName?: string;
  manufacturer?: string;
  recallReason?: string;
  recallDate?: string;
  adverseEvents?: number;
}

export interface OpenFDASearchResponse {
  results: OpenFDASearchResult[];
  total: number;
}

interface FDADrugLabel {
  openfda?: {
    brand_name?: string[];
    generic_name?: string[];
    manufacturer_name?: string[];
    product_ndc?: string[];
    spl_id?: string[];
  };
  indications_and_usage?: string[];
  warnings?: string[];
  dosage_and_administration?: string[];
  adverse_reactions?: string[];
  description?: string[];
}

interface FDADrugEvent {
  safetyreportid: string;
  serious?: number;
  receivedate: string;
  patient?: {
    drug?: Array<{
      medicinalproduct?: string;
      drugindication?: string;
    }>;
    reaction?: Array<{
      reactionmeddrapt?: string;
    }>;
  };
}

interface FDADeviceEvent {
  report_number: string;
  event_type?: string;
  device?: Array<{
    brand_name?: string;
    generic_name?: string;
    manufacturer_d_name?: string;
  }>;
  mdr_text?: Array<{
    text?: string;
    text_type_code?: string;
  }>;
  date_received?: string;
}

interface FDAFoodRecall {
  recall_number: string;
  reason_for_recall?: string;
  product_description?: string;
  recalling_firm?: string;
  recall_initiation_date?: string;
  status?: string;
  classification?: string;
}

const OPENFDA_API = 'https://api.fda.gov';

export class OpenFDAClient {
  private apiKey?: string;

  constructor() {
    this.apiKey = process.env.OPENFDA_API_KEY;
  }

  /**
   * Search drug labels (package inserts)
   */
  async searchDrugLabels(
    query: string,
    options?: {
      limit?: number;
    }
  ): Promise<OpenFDASearchResponse> {
    try {
      const params = new URLSearchParams({
        search: query,
        limit: String(options?.limit ?? 10),
      });

      if (this.apiKey) {
        params.set('api_key', this.apiKey);
      }

      const response = await fetch(`${OPENFDA_API}/drug/label.json?${params}`);

      if (!response.ok) {
        if (response.status === 404) {
          return { results: [], total: 0 };
        }
        throw new Error(`OpenFDA API error: ${response.status}`);
      }

      const data = await response.json();
      const results: FDADrugLabel[] = data.results || [];

      return {
        results: results.map(drug => this.transformDrugLabel(drug)),
        total: data.meta?.results?.total || results.length,
      };
    } catch (error) {
      log.debug('OpenFDA drug label search error:', error);
      throw error;
    }
  }

  /**
   * Search drug adverse events
   */
  async searchDrugEvents(
    drugName: string,
    options?: {
      limit?: number;
      serious?: boolean;
    }
  ): Promise<OpenFDASearchResponse> {
    try {
      let searchQuery = `patient.drug.medicinalproduct:"${drugName}"`;
      if (options?.serious) {
        searchQuery += ' AND serious:1';
      }

      const params = new URLSearchParams({
        search: searchQuery,
        limit: String(options?.limit ?? 10),
      });

      if (this.apiKey) {
        params.set('api_key', this.apiKey);
      }

      const response = await fetch(`${OPENFDA_API}/drug/event.json?${params}`);

      if (!response.ok) {
        if (response.status === 404) {
          return { results: [], total: 0 };
        }
        throw new Error(`OpenFDA API error: ${response.status}`);
      }

      const data = await response.json();
      const results: FDADrugEvent[] = data.results || [];

      return {
        results: results.map(event => this.transformDrugEvent(event, drugName)),
        total: data.meta?.results?.total || results.length,
      };
    } catch (error) {
      log.debug('OpenFDA drug event search error:', error);
      throw error;
    }
  }

  /**
   * Search medical device adverse events
   */
  async searchDeviceEvents(
    query: string,
    options?: {
      limit?: number;
    }
  ): Promise<OpenFDASearchResponse> {
    try {
      const params = new URLSearchParams({
        search: query,
        limit: String(options?.limit ?? 10),
      });

      if (this.apiKey) {
        params.set('api_key', this.apiKey);
      }

      const response = await fetch(`${OPENFDA_API}/device/event.json?${params}`);

      if (!response.ok) {
        if (response.status === 404) {
          return { results: [], total: 0 };
        }
        throw new Error(`OpenFDA API error: ${response.status}`);
      }

      const data = await response.json();
      const results: FDADeviceEvent[] = data.results || [];

      return {
        results: results.map(event => this.transformDeviceEvent(event)),
        total: data.meta?.results?.total || results.length,
      };
    } catch (error) {
      log.debug('OpenFDA device event search error:', error);
      throw error;
    }
  }

  /**
   * Search food recalls and enforcement
   */
  async searchFoodRecalls(
    query: string,
    options?: {
      limit?: number;
    }
  ): Promise<OpenFDASearchResponse> {
    try {
      const params = new URLSearchParams({
        search: query,
        limit: String(options?.limit ?? 10),
      });

      if (this.apiKey) {
        params.set('api_key', this.apiKey);
      }

      const response = await fetch(`${OPENFDA_API}/food/enforcement.json?${params}`);

      if (!response.ok) {
        if (response.status === 404) {
          return { results: [], total: 0 };
        }
        throw new Error(`OpenFDA API error: ${response.status}`);
      }

      const data = await response.json();
      const results: FDAFoodRecall[] = data.results || [];

      return {
        results: results.map(recall => this.transformFoodRecall(recall)),
        total: data.meta?.results?.total || results.length,
      };
    } catch (error) {
      log.debug('OpenFDA food recall search error:', error);
      throw error;
    }
  }

  /**
   * Unified search across all FDA data
   */
  async search(
    query: string,
    options?: {
      limit?: number;
      category?: 'drug' | 'device' | 'food';
    }
  ): Promise<OpenFDASearchResponse> {
    // Default to drug labels as most useful for research
    if (options?.category === 'device') {
      return this.searchDeviceEvents(query, options);
    } else if (options?.category === 'food') {
      return this.searchFoodRecalls(query, options);
    } else {
      return this.searchDrugLabels(query, options);
    }
  }

  private transformDrugLabel(drug: FDADrugLabel): OpenFDASearchResult {
    const brandName = drug.openfda?.brand_name?.[0];
    const genericName = drug.openfda?.generic_name?.[0];
    const splId = drug.openfda?.spl_id?.[0];

    const content = [
      drug.description?.[0],
      drug.indications_and_usage?.[0],
      drug.warnings?.[0]?.slice(0, 500),
    ]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 3000);

    return {
      url: splId 
        ? `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${splId}`
        : 'https://open.fda.gov/apis/drug/label/',
      title: brandName || genericName || 'Drug Label',
      content,
      category: 'drug',
      brandName,
      genericName,
      manufacturer: drug.openfda?.manufacturer_name?.[0],
    };
  }

  private transformDrugEvent(event: FDADrugEvent, drugName: string): OpenFDASearchResult {
    const reactions = event.patient?.reaction?.map(r => r.reactionmeddrapt).filter(Boolean) || [];
    
    const content = `Adverse event report for ${drugName}. ` +
      `Reactions: ${reactions.join(', ') || 'Not specified'}. ` +
      `Serious: ${event.serious === 1 ? 'Yes' : 'No'}. ` +
      `Report date: ${event.receivedate}`;

    return {
      url: `https://open.fda.gov/apis/drug/event/`,
      title: `Adverse Event: ${drugName} - ${reactions[0] || 'Report ' + event.safetyreportid}`,
      content,
      category: 'drug',
      brandName: drugName,
    };
  }

  private transformDeviceEvent(event: FDADeviceEvent): OpenFDASearchResult {
    const device = event.device?.[0];
    const description = event.mdr_text?.find(t => t.text_type_code === 'Description of Event or Problem')?.text;

    return {
      url: `https://open.fda.gov/apis/device/event/`,
      title: device?.brand_name || device?.generic_name || `Device Event ${event.report_number}`,
      content: description || `Device event report: ${event.event_type || 'Unknown type'}`,
      category: 'device',
      brandName: device?.brand_name,
      genericName: device?.generic_name,
      manufacturer: device?.manufacturer_d_name,
    };
  }

  private transformFoodRecall(recall: FDAFoodRecall): OpenFDASearchResult {
    return {
      url: `https://open.fda.gov/apis/food/enforcement/`,
      title: `Food Recall: ${recall.product_description?.slice(0, 100) || recall.recall_number}`,
      content: `Recall Reason: ${recall.reason_for_recall || 'Not specified'}. ` +
        `Classification: ${recall.classification || 'Unknown'}. ` +
        `Status: ${recall.status || 'Unknown'}. ` +
        `Initiated: ${recall.recall_initiation_date || 'Unknown'}`,
      category: 'food',
      manufacturer: recall.recalling_firm,
      recallReason: recall.reason_for_recall,
      recallDate: recall.recall_initiation_date,
    };
  }
}


