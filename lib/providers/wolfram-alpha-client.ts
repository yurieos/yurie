/**
 * Wolfram Alpha API Client
 * 
 * Access to Wolfram Alpha's computational knowledge engine for:
 * - Mathematical calculations and equations
 * - Unit conversions
 * - Scientific data and computations
 * - Statistics and data analysis
 * - Physics, chemistry, engineering calculations
 * - Step-by-step solutions
 * - Real-time factual data
 * 
 * API Types:
 * - Full Results API: Complete computational results
 * - Short Answers API: Concise text answers
 * - Spoken Results API: Natural language answers
 * - Simple API: Single image result
 * 
 * Rate Limit: 2,000 calls/month (free tier)
 * Requires: WOLFRAM_ALPHA_APP_ID environment variable
 * 
 * @see https://products.wolframalpha.com/api/documentation
 */

export interface WolframAlphaSearchResult {
  url: string;
  title: string;
  content: string;
  inputInterpretation?: string;
  result?: string;
  pods?: WolframPod[];
  assumptions?: WolframAssumption[];
  warnings?: string[];
  relatedQueries?: string[];
  imageUrl?: string;
  stepByStep?: string;
}

export interface WolframAlphaSearchResponse {
  results: WolframAlphaSearchResult[];
  total: number;
  success: boolean;
  inputInterpretation?: string;
  timing?: number;
}

export interface WolframPod {
  id: string;
  title: string;
  scanner: string;
  position: number;
  primary?: boolean;
  subpods: WolframSubpod[];
}

export interface WolframSubpod {
  title: string;
  plaintext?: string;
  img?: {
    src: string;
    alt: string;
    width: number;
    height: number;
  };
  mathml?: string;
}

export interface WolframAssumption {
  type: string;
  word: string;
  template: string;
  values: Array<{
    name: string;
    desc: string;
    input: string;
  }>;
}

interface WolframFullResultsResponse {
  queryresult: {
    success: boolean;
    error: boolean | { code: string; msg: string };
    numpods: number;
    datatypes: string;
    timedout: string;
    timedoutpods: string;
    timing: number;
    parsetiming: number;
    parsetimedout: boolean;
    recalculate: string;
    id: string;
    host: string;
    server: string;
    related: string;
    version: string;
    inputstring: string;
    pods?: Array<{
      title: string;
      scanner: string;
      id: string;
      position: number;
      error: boolean;
      numsubpods: number;
      primary?: boolean;
      subpods: Array<{
        title: string;
        img?: {
          src: string;
          alt: string;
          title: string;
          width: number;
          height: number;
        };
        plaintext?: string;
        mathml?: string;
      }>;
    }>;
    assumptions?: Array<{
      type: string;
      word: string;
      template: string;
      count: number;
      values: Array<{
        name: string;
        desc: string;
        input: string;
      }>;
    }>;
    warnings?: {
      delimiters?: string;
      spellcheck?: {
        word: string;
        suggestion: string;
        text: string;
      };
    };
    sources?: Array<{
      url: string;
      text: string;
    }>;
    didyoumeans?: Array<{
      score: number;
      level: string;
      val: string;
    }>;
  };
}

const WOLFRAM_API_BASE = 'https://api.wolframalpha.com/v2';
const WOLFRAM_SHORT_API = 'https://api.wolframalpha.com/v1/result';
const WOLFRAM_SPOKEN_API = 'https://api.wolframalpha.com/v1/spoken';

export class WolframAlphaClient {
  private appId: string | null = null;
  private requestDelay = 100; // Respectful rate limiting
  private lastRequest = 0;

  constructor() {
    this.appId = process.env.WOLFRAM_ALPHA_APP_ID || process.env.WOLFRAM_APP_ID || null;
    
    if (this.appId) {
      console.log('✓ Wolfram Alpha client initialized');
    }
  }

  /**
   * Check if the client is available (has API key)
   */
  isAvailable(): boolean {
    return !!this.appId;
  }

  /**
   * Main search/query method - uses Full Results API
   */
  async search(
    query: string,
    options?: {
      limit?: number;
      format?: 'plaintext' | 'image' | 'mathml' | 'all';
      units?: 'metric' | 'imperial';
      podState?: string;
      includePodId?: string[];
      excludePodId?: string[];
      timeout?: number;
    }
  ): Promise<WolframAlphaSearchResponse> {
    if (!this.appId) {
      throw new Error('Wolfram Alpha App ID not configured. Set WOLFRAM_ALPHA_APP_ID environment variable.');
    }

    try {
      await this.rateLimit();

      const params = new URLSearchParams({
        appid: this.appId,
        input: query,
        format: options?.format === 'all' ? 'plaintext,image,mathml' : (options?.format || 'plaintext,image'),
        output: 'json',
      });

      // Optional parameters
      if (options?.units) {
        params.set('units', options.units);
      }
      if (options?.podState) {
        params.set('podstate', options.podState);
      }
      if (options?.includePodId) {
        params.set('includepodid', options.includePodId.join(','));
      }
      if (options?.excludePodId) {
        params.set('excludepodid', options.excludePodId.join(','));
      }
      if (options?.timeout) {
        params.set('scantimeout', String(options.timeout));
        params.set('podtimeout', String(options.timeout));
      }

      const response = await fetch(`${WOLFRAM_API_BASE}/query?${params}`);

      if (!response.ok) {
        throw new Error(`Wolfram Alpha API error: ${response.status}`);
      }

      const data: WolframFullResultsResponse = await response.json();
      
      if (!data.queryresult.success) {
        // Check for suggestions
        if (data.queryresult.didyoumeans && data.queryresult.didyoumeans.length > 0) {
          const suggestion = data.queryresult.didyoumeans[0].val;
          return {
            results: [{
              url: `https://www.wolframalpha.com/input?i=${encodeURIComponent(query)}`,
              title: 'No exact match found',
              content: `Wolfram Alpha couldn't interpret your query. Did you mean: "${suggestion}"?`,
              inputInterpretation: query,
              relatedQueries: data.queryresult.didyoumeans.map(d => d.val),
            }],
            total: 0,
            success: false,
            inputInterpretation: query,
          };
        }
        
        return {
          results: [],
          total: 0,
          success: false,
          inputInterpretation: query,
        };
      }

      // Process pods into search results
      const results = this.processPodsToResults(query, data.queryresult);

      return {
        results: results.slice(0, options?.limit || 10),
        total: results.length,
        success: true,
        inputInterpretation: data.queryresult.inputstring,
        timing: data.queryresult.timing,
      };
    } catch (error) {
      console.error('Wolfram Alpha search error:', error);
      throw error;
    }
  }

  /**
   * Get a short text answer (Simple API)
   * Best for: Quick factual answers, calculations
   */
  async getShortAnswer(query: string): Promise<string | null> {
    if (!this.appId) {
      throw new Error('Wolfram Alpha App ID not configured');
    }

    try {
      await this.rateLimit();

      const params = new URLSearchParams({
        appid: this.appId,
        i: query,
      });

      const response = await fetch(`${WOLFRAM_SHORT_API}?${params}`);

      if (!response.ok) {
        if (response.status === 501) {
          // No short answer available
          return null;
        }
        throw new Error(`Wolfram Alpha Short API error: ${response.status}`);
      }

      const text = await response.text();
      return text.trim() || null;
    } catch (error) {
      console.error('Wolfram Alpha short answer error:', error);
      return null;
    }
  }

  /**
   * Get a spoken/natural language answer
   * Best for: Voice assistants, conversational responses
   */
  async getSpokenAnswer(query: string): Promise<string | null> {
    if (!this.appId) {
      throw new Error('Wolfram Alpha App ID not configured');
    }

    try {
      await this.rateLimit();

      const params = new URLSearchParams({
        appid: this.appId,
        i: query,
      });

      const response = await fetch(`${WOLFRAM_SPOKEN_API}?${params}`);

      if (!response.ok) {
        if (response.status === 501) {
          return null;
        }
        throw new Error(`Wolfram Alpha Spoken API error: ${response.status}`);
      }

      const text = await response.text();
      return text.trim() || null;
    } catch (error) {
      console.error('Wolfram Alpha spoken answer error:', error);
      return null;
    }
  }

  /**
   * Calculate a mathematical expression
   */
  async calculate(expression: string): Promise<WolframAlphaSearchResult | null> {
    const response = await this.search(expression, {
      includePodId: ['Input', 'Result', 'DecimalApproximation', 'Derivative', 'Integral', 'Solution'],
    });

    if (!response.success || response.results.length === 0) {
      // Try short answer as fallback
      const shortAnswer = await this.getShortAnswer(expression);
      if (shortAnswer) {
        return {
          url: `https://www.wolframalpha.com/input?i=${encodeURIComponent(expression)}`,
          title: `Calculate: ${expression}`,
          content: shortAnswer,
          result: shortAnswer,
          inputInterpretation: expression,
        };
      }
      return null;
    }

    return response.results[0];
  }

  /**
   * Convert units
   */
  async convertUnits(
    value: number,
    fromUnit: string,
    toUnit: string
  ): Promise<string | null> {
    const query = `convert ${value} ${fromUnit} to ${toUnit}`;
    return this.getShortAnswer(query);
  }

  /**
   * Get step-by-step solution (requires Show Steps capability)
   * Note: Step-by-step is a premium feature
   */
  async getStepByStep(expression: string): Promise<WolframAlphaSearchResult | null> {
    const response = await this.search(expression, {
      podState: 'Step-by-step solution',
      includePodId: ['Input', 'Result', 'Steps'],
    });

    if (!response.success || response.results.length === 0) {
      return null;
    }

    // Look for step-by-step content in pods
    const result = response.results[0];
    if (result.pods) {
      const stepsPod = result.pods.find(p => 
        p.title.toLowerCase().includes('step') || 
        p.id.toLowerCase().includes('step')
      );
      if (stepsPod && stepsPod.subpods.length > 0) {
        result.stepByStep = stepsPod.subpods
          .map(sp => sp.plaintext)
          .filter(Boolean)
          .join('\n\n');
      }
    }

    return result;
  }

  /**
   * Get scientific/factual data
   */
  async getData(query: string): Promise<WolframAlphaSearchResult | null> {
    const response = await this.search(query, {
      excludePodId: ['Input'], // Skip input interpretation
    });

    if (!response.success || response.results.length === 0) {
      return null;
    }

    return response.results[0];
  }

  /**
   * Process Wolfram Alpha pods into search results
   */
  private processPodsToResults(
    query: string,
    queryResult: WolframFullResultsResponse['queryresult']
  ): WolframAlphaSearchResult[] {
    const pods = queryResult.pods || [];
    
    if (pods.length === 0) {
      return [];
    }

    // Find primary/result pod
    const primaryPod = pods.find(p => p.primary) || 
                       pods.find(p => p.id === 'Result') ||
                       pods.find(p => p.id === 'DecimalApproximation') ||
                       pods[1]; // Second pod is often the result

    const inputPod = pods.find(p => p.id === 'Input' || p.title.toLowerCase() === 'input interpretation');

    // Build main result
    const mainContent: string[] = [];
    const allImages: string[] = [];
    const processedPods: WolframPod[] = [];

    for (const pod of pods) {
      const processedPod: WolframPod = {
        id: pod.id,
        title: pod.title,
        scanner: pod.scanner,
        position: pod.position,
        primary: pod.primary,
        subpods: [],
      };

      for (const subpod of pod.subpods) {
        const processedSubpod: WolframSubpod = {
          title: subpod.title,
          plaintext: subpod.plaintext,
          mathml: subpod.mathml,
        };

        if (subpod.img) {
          processedSubpod.img = {
            src: subpod.img.src,
            alt: subpod.img.alt || subpod.img.title,
            width: subpod.img.width,
            height: subpod.img.height,
          };
          allImages.push(subpod.img.src);
        }

        processedPod.subpods.push(processedSubpod);

        // Add to main content
        if (subpod.plaintext) {
          if (pod.id !== 'Input') {
            mainContent.push(`**${pod.title}${subpod.title ? ` - ${subpod.title}` : ''}:**\n${subpod.plaintext}`);
          }
        }
      }

      processedPods.push(processedPod);
    }

    // Extract input interpretation
    const inputInterpretation = inputPod?.subpods[0]?.plaintext || query;

    // Extract primary result
    let primaryResult: string | undefined;
    if (primaryPod && primaryPod.subpods.length > 0) {
      primaryResult = primaryPod.subpods[0].plaintext;
    }

    // Extract assumptions
    const assumptions = queryResult.assumptions?.map(a => ({
      type: a.type,
      word: a.word,
      template: a.template,
      values: a.values,
    }));

    // Build the main search result
    const mainResult: WolframAlphaSearchResult = {
      url: `https://www.wolframalpha.com/input?i=${encodeURIComponent(query)}`,
      title: primaryResult 
        ? `${inputInterpretation} = ${primaryResult}`
        : `Wolfram Alpha: ${inputInterpretation}`,
      content: mainContent.join('\n\n'),
      inputInterpretation,
      result: primaryResult,
      pods: processedPods,
      assumptions,
      imageUrl: allImages[0],
    };

    // Create additional results for each major pod
    const additionalResults: WolframAlphaSearchResult[] = [];
    
    for (const pod of pods.slice(0, 5)) {
      if (pod.id === 'Input') continue;
      if (pod === primaryPod) continue;
      
      const podContent = pod.subpods
        .map(sp => sp.plaintext)
        .filter(Boolean)
        .join('\n');

      if (podContent) {
        additionalResults.push({
          url: `https://www.wolframalpha.com/input?i=${encodeURIComponent(query)}`,
          title: pod.title,
          content: podContent,
          inputInterpretation,
          imageUrl: pod.subpods[0]?.img?.src,
        });
      }
    }

    return [mainResult, ...additionalResults];
  }

  /**
   * Simple rate limiting
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequest;
    if (elapsed < this.requestDelay) {
      await new Promise(resolve => setTimeout(resolve, this.requestDelay - elapsed));
    }
    this.lastRequest = Date.now();
  }
}

// Export query categories for intelligent routing
export const WOLFRAM_ALPHA_CATEGORIES = {
  MATH: ['calculate', 'solve', 'equation', 'derivative', 'integral', 'factor', 'simplify', 'limit', 'sum', 'matrix'],
  SCIENCE: ['physics', 'chemistry', 'biology', 'element', 'compound', 'force', 'energy', 'molecule'],
  CONVERSIONS: ['convert', 'to', 'in', 'miles', 'kilometers', 'pounds', 'kilograms', 'fahrenheit', 'celsius'],
  DATA: ['population', 'gdp', 'distance', 'height', 'speed', 'mass', 'density', 'boiling point'],
  FINANCE: ['stock', 'currency', 'exchange rate', 'inflation', 'interest rate'],
  DATES: ['days until', 'days since', 'what day was', 'how long until', 'time between'],
} as const;


