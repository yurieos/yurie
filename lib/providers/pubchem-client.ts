/**
 * PubChem API Client
 * 
 * Access to the world's largest collection of freely accessible
 * chemical information - compounds, substances, bioassays, and more.
 * 
 * Coverage: 115M+ compounds, 300M+ substances
 * Rate Limit: 5 requests/second
 * 100% FREE - No API key required
 * 
 * @see https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest
 */

import { loggers } from '../utils/logger';

const log = loggers.provider;

export interface PubChemSearchResult {
  url: string;
  title: string;
  content: string;
  cid: number;
  molecularFormula?: string;
  molecularWeight?: number;
  iupacName?: string;
  synonyms?: string[];
  description?: string;
  imageUrl?: string;
  smiles?: string;
}

export interface PubChemSearchResponse {
  results: PubChemSearchResult[];
  total: number;
}

interface PubChemCompound {
  CID: number;
  MolecularFormula?: string;
  MolecularWeight?: number;
  IUPACName?: string;
  Title?: string;
  CanonicalSMILES?: string;
}

interface PubChemPropertyTable {
  Properties: PubChemCompound[];
}

interface PubChemDescriptionResponse {
  InformationList?: {
    Information?: Array<{
      CID: number;
      Title?: string;
      Description?: string;
    }>;
  };
}

interface PubChemSynonymResponse {
  InformationList?: {
    Information?: Array<{
      CID: number;
      Synonym?: string[];
    }>;
  };
}

const PUBCHEM_API = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';
const PUBCHEM_VIEW_API = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug_view';

export class PubChemClient {
  private requestDelay = 200; // 5 req/sec

  /**
   * Extract compound names from natural language queries
   * e.g., "aspirin chemical structure" -> ["aspirin"]
   *       "molecular formula of glucose" -> ["glucose"]
   */
  private extractCompoundNames(query: string): string[] {
    const q = query.toLowerCase();
    
    // Common patterns to extract compound names
    const patterns = [
      /(?:structure|formula|properties|composition|molecule)\s+(?:of|for)\s+(\w+)/i,
      /(\w+)\s+(?:structure|formula|chemical|molecule|compound)/i,
      /what\s+is\s+(\w+)\s+made\s+of/i,
      /(\w+)\s+molecular/i,
    ];
    
    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        return [match[1]];
      }
    }
    
    // Known compound names to look for
    const knownCompounds = [
      'aspirin', 'caffeine', 'acetaminophen', 'ibuprofen', 'paracetamol',
      'benzene', 'ethanol', 'methanol', 'acetone', 'glucose', 'sucrose',
      'sodium', 'potassium', 'magnesium', 'calcium', 'chloride',
      'ammonia', 'water', 'oxygen', 'nitrogen', 'hydrogen',
      'methane', 'propane', 'butane', 'octane', 'hexane',
      'melatonin', 'dopamine', 'serotonin', 'adrenaline', 'cortisol',
      'insulin', 'testosterone', 'estrogen', 'progesterone',
      'penicillin', 'amoxicillin', 'metformin', 'atorvastatin',
      'nicotine', 'morphine', 'cocaine', 'heroin', 'thc', 'cbd',
      'vitamin', 'amino', 'protein', 'acid', 'salt',
    ];
    
    // Look for known compound names in the query
    for (const compound of knownCompounds) {
      if (q.includes(compound)) {
        // Extract the word that contains or matches the compound
        const words = q.split(/\s+/);
        for (const word of words) {
          if (word.includes(compound) || compound.includes(word)) {
            return [word.replace(/[^a-z]/g, '')];
          }
        }
        return [compound];
      }
    }
    
    // Fallback: try the first significant word (skip common words)
    const skipWords = new Set(['what', 'is', 'the', 'of', 'for', 'a', 'an', 'structure', 
      'formula', 'chemical', 'molecular', 'compound', 'molecule', 'properties', 'find']);
    const words = q.split(/\s+/).filter(w => w.length > 2 && !skipWords.has(w));
    
    if (words.length > 0) {
      return [words[0]];
    }
    
    return [query];
  }

  /**
   * Search for compounds by name
   */
  async search(
    query: string,
    options?: {
      limit?: number;
    }
  ): Promise<PubChemSearchResponse> {
    try {
      await this.rateLimit();

      // Extract compound names from the query
      const compoundNames = this.extractCompoundNames(query);
      log.debug(`PubChem: extracted compounds from "${query}": ${compoundNames.join(', ')}`);
      
      // Try each extracted compound name
      for (const compoundName of compoundNames) {
        const searchResponse = await fetch(
          `${PUBCHEM_API}/compound/name/${encodeURIComponent(compoundName)}/cids/JSON`
        );

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          const cids: number[] = searchData.IdentifierList?.CID || [];

          if (cids.length > 0) {
            // Limit results
            const limitedCids = cids.slice(0, options?.limit ?? 10);
            // Get properties for these compounds
            const results = await this.getCompoundsInfo(limitedCids);
            return {
              results,
              total: cids.length,
            };
          }
        }
      }
      
      // No compounds found with any extracted name
      return { results: [], total: 0 };
    } catch (error) {
      log.debug('PubChem search error:', error);
      throw error;
    }
  }

  /**
   * Get compound by CID
   */
  async getCompound(cid: number): Promise<PubChemSearchResult | null> {
    try {
      await this.rateLimit();

      const results = await this.getCompoundsInfo([cid]);
      return results[0] || null;
    } catch (error) {
      log.debug('PubChem get compound error:', error);
      throw error;
    }
  }

  /**
   * Search by molecular formula
   */
  async searchByFormula(
    formula: string,
    options?: {
      limit?: number;
    }
  ): Promise<PubChemSearchResponse> {
    try {
      await this.rateLimit();

      const response = await fetch(
        `${PUBCHEM_API}/compound/formula/${encodeURIComponent(formula)}/cids/JSON`
      );

      if (!response.ok) {
        if (response.status === 404) {
          return { results: [], total: 0 };
        }
        throw new Error(`PubChem API error: ${response.status}`);
      }

      const data = await response.json();
      const cids: number[] = data.IdentifierList?.CID || [];

      if (cids.length === 0) {
        return { results: [], total: 0 };
      }

      const limitedCids = cids.slice(0, options?.limit ?? 10);
      const results = await this.getCompoundsInfo(limitedCids);

      return {
        results,
        total: cids.length,
      };
    } catch (error) {
      log.debug('PubChem formula search error:', error);
      throw error;
    }
  }

  /**
   * Search by SMILES string
   */
  async searchBySmiles(
    smiles: string,
    options?: {
      limit?: number;
      searchType?: 'substructure' | 'superstructure' | 'similarity' | 'identity';
    }
  ): Promise<PubChemSearchResponse> {
    try {
      await this.rateLimit();

      const searchType = options?.searchType || 'similarity';
      const response = await fetch(
        `${PUBCHEM_API}/compound/${searchType}/smiles/${encodeURIComponent(smiles)}/cids/JSON`
      );

      if (!response.ok) {
        if (response.status === 404) {
          return { results: [], total: 0 };
        }
        throw new Error(`PubChem API error: ${response.status}`);
      }

      const data = await response.json();
      const cids: number[] = data.IdentifierList?.CID || [];

      if (cids.length === 0) {
        return { results: [], total: 0 };
      }

      const limitedCids = cids.slice(0, options?.limit ?? 10);
      const results = await this.getCompoundsInfo(limitedCids);

      return {
        results,
        total: cids.length,
      };
    } catch (error) {
      log.debug('PubChem SMILES search error:', error);
      throw error;
    }
  }

  /**
   * Get compound properties
   */
  private async getCompoundsInfo(cids: number[]): Promise<PubChemSearchResult[]> {
    if (cids.length === 0) return [];

    await this.rateLimit();

    const cidList = cids.join(',');

    // Get properties
    const propsResponse = await fetch(
      `${PUBCHEM_API}/compound/cid/${cidList}/property/MolecularFormula,MolecularWeight,IUPACName,CanonicalSMILES,Title/JSON`
    );

    if (!propsResponse.ok) {
      throw new Error(`PubChem properties API error: ${propsResponse.status}`);
    }

    const propsData: { PropertyTable: PubChemPropertyTable } = await propsResponse.json();
    const properties = propsData.PropertyTable?.Properties || [];

    // Get descriptions (rate limited)
    await this.rateLimit();
    
    let descriptions: Map<number, string> = new Map();
    try {
      const descResponse = await fetch(
        `${PUBCHEM_API}/compound/cid/${cidList}/description/JSON`
      );
      
      if (descResponse.ok) {
        const descData: PubChemDescriptionResponse = await descResponse.json();
        const infos = descData.InformationList?.Information || [];
        for (const info of infos) {
          if (info.Description) {
            descriptions.set(info.CID, info.Description);
          }
        }
      }
    } catch {
      // Descriptions are optional
    }

    // Get synonyms (rate limited)
    await this.rateLimit();
    
    let synonyms: Map<number, string[]> = new Map();
    try {
      const synResponse = await fetch(
        `${PUBCHEM_API}/compound/cid/${cidList}/synonyms/JSON`
      );
      
      if (synResponse.ok) {
        const synData: PubChemSynonymResponse = await synResponse.json();
        const infos = synData.InformationList?.Information || [];
        for (const info of infos) {
          if (info.Synonym) {
            synonyms.set(info.CID, info.Synonym.slice(0, 10));
          }
        }
      }
    } catch {
      // Synonyms are optional
    }

    return properties.map(prop => {
      const description = descriptions.get(prop.CID);
      const syns = synonyms.get(prop.CID);
      
      const content = description || 
        `Chemical compound with formula ${prop.MolecularFormula || 'unknown'}. ` +
        (prop.MolecularWeight ? `Molecular weight: ${prop.MolecularWeight} g/mol. ` : '') +
        (prop.IUPACName ? `IUPAC name: ${prop.IUPACName}. ` : '') +
        (syns?.length ? `Also known as: ${syns.slice(0, 5).join(', ')}.` : '');

      return {
        url: `https://pubchem.ncbi.nlm.nih.gov/compound/${prop.CID}`,
        title: prop.Title || prop.IUPACName || `Compound CID ${prop.CID}`,
        content,
        cid: prop.CID,
        molecularFormula: prop.MolecularFormula,
        molecularWeight: prop.MolecularWeight,
        iupacName: prop.IUPACName,
        synonyms: syns,
        description,
        imageUrl: `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${prop.CID}/PNG`,
        smiles: prop.CanonicalSMILES,
      };
    });
  }

  /**
   * Get compound safety information
   */
  async getSafetyInfo(cid: number): Promise<{
    hazards?: string[];
    ghs?: string[];
    signal?: string;
  } | null> {
    try {
      await this.rateLimit();

      const response = await fetch(
        `${PUBCHEM_VIEW_API}/data/compound/${cid}/JSON?heading=Safety+and+Hazards`
      );

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`PubChem View API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Parse safety data (complex nested structure)
      // Simplified for now
      return {
        hazards: [],
        ghs: [],
      };
    } catch (error) {
      log.debug('PubChem safety info error:', error);
      return null;
    }
  }

  /**
   * Simple rate limiting
   */
  private lastRequest = 0;
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequest;
    if (elapsed < this.requestDelay) {
      await new Promise(resolve => setTimeout(resolve, this.requestDelay - elapsed));
    }
    this.lastRequest = Date.now();
  }
}


