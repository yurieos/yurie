/**
 * NOAA Shipwrecks & Wrecks and Obstructions API Client
 * 
 * Access to NOAA's Automated Wreck and Obstruction Information System (AWOIS)
 * and Wrecks and Obstructions database. Contains thousands of shipwreck
 * locations in US waters - excellent for maritime treasure hunting research.
 * 
 * Coverage: 10,000+ shipwrecks and obstructions in US waters
 * Rate Limit: Reasonable use
 * 100% FREE - No API key required
 * 
 * @see https://nauticalcharts.noaa.gov/data/wrecks-and-obstructions.html
 * @see https://www.ngdc.noaa.gov/
 */

export interface ShipwreckSearchResult {
  url: string;
  title: string;
  content: string;
  wreckId: string;
  vesselName?: string;
  vesselType?: string;
  featureType: string;
  latitude: number;
  longitude: number;
  depth?: number;
  depthUnits?: string;
  yearSunk?: number;
  yearBuilt?: number;
  condition?: string;
  history?: string;
  source?: string;
  chartNumber?: string;
  region?: string;
  state?: string;
  waterBody?: string;
  gp_quality?: string;
  sounding?: number;
  lastUpdate?: string;
}

export interface ShipwreckSearchResponse {
  results: ShipwreckSearchResult[];
  total: number;
}

// Feature types from NOAA
export const NOAA_FEATURE_TYPES = [
  'Wreck - Dangerous',
  'Wreck - Non-Dangerous',
  'Wreck - Submerged',
  'Wreck - Visible',
  'Obstruction',
  'Rock - Awash',
  'Rock - Submerged',
  'Foul Ground',
  'Foul Area',
] as const;

interface NOAAWreckFeature {
  type: 'Feature';
  id: number;
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  properties: {
    OBJECTID: number;
    RECRD?: string;
    VESSLTERMS?: string;
    FEATURE_TYPE?: string;
    CHART?: string;
    LATDEC?: number;
    LONDEC?: number;
    GP_QUALITY?: string;
    DEPTH?: number;
    SOUNDING?: number;
    SOUNDING_TYPE?: string;
    HISTORY?: string;
    QUESSION?: string;
    YEARSUNK?: string | number;
    QUESSION2?: string;
    SOURCE?: string;
    CAESSION?: string;
    CAESSION2?: string;
    DESESSION?: string;
    DESESSION2?: string;
    WATLEV?: string;
    SORDAT?: string;
    SORIND?: string;
    IMAGE_LINK?: string;
    REGION?: string;
    STATE?: string;
    WATER_BODY?: string;
    [key: string]: unknown;
  };
}

interface NOAAWrecksResponse {
  type: 'FeatureCollection';
  features: NOAAWreckFeature[];
  totalFeatures?: number;
  numberMatched?: number;
  numberReturned?: number;
}

// NOAA GeoServer WFS endpoint for wrecks
const NOAA_WFS_URL = 'https://gis.charttools.noaa.gov/arcgis/rest/services/MCS/WrecksAndObstructions/MapServer/0/query';

export class NOAAShipwrecksClient {
  /**
   * Search for shipwrecks by location (bounding box)
   */
  async searchByBoundingBox(
    bbox: {
      minLon: number;
      minLat: number;
      maxLon: number;
      maxLat: number;
    },
    options?: {
      limit?: number;
      featureType?: string;
    }
  ): Promise<ShipwreckSearchResponse> {
    try {
      const params = new URLSearchParams({
        where: '1=1',
        geometry: `${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat}`,
        geometryType: 'esriGeometryEnvelope',
        spatialRel: 'esriSpatialRelIntersects',
        outFields: '*',
        returnGeometry: 'true',
        f: 'geojson',
        resultRecordCount: String(options?.limit ?? 50),
      });

      if (options?.featureType) {
        params.set('where', `FEATURE_TYPE = '${options.featureType}'`);
      }

      const response = await fetch(`${NOAA_WFS_URL}?${params}`);

      if (!response.ok) {
        throw new Error(`NOAA API error: ${response.status}`);
      }

      const data: NOAAWrecksResponse = await response.json();

      return {
        results: (data.features || []).map(f => this.transformFeature(f)),
        total: data.numberMatched || data.features?.length || 0,
      };
    } catch (error) {
      console.error('NOAA shipwrecks search error:', error);
      throw error;
    }
  }

  /**
   * Search for shipwrecks by name/keyword
   */
  async search(
    query: string,
    options?: {
      limit?: number;
      region?: string;
      state?: string;
    }
  ): Promise<ShipwreckSearchResponse> {
    try {
      // Build WHERE clause for text search
      const conditions = [];

      if (query && query !== '*') {
        const escapedQuery = query.replace(/'/g, "''");
        conditions.push(
          `(UPPER(VESSLTERMS) LIKE UPPER('%${escapedQuery}%') OR ` +
          `UPPER(HISTORY) LIKE UPPER('%${escapedQuery}%') OR ` +
          `UPPER(FEATURE_TYPE) LIKE UPPER('%${escapedQuery}%'))`
        );
      }

      if (options?.region) {
        conditions.push(`REGION = '${options.region}'`);
      }

      if (options?.state) {
        conditions.push(`STATE = '${options.state}'`);
      }

      const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '1=1';

      const params = new URLSearchParams({
        where: whereClause,
        outFields: '*',
        returnGeometry: 'true',
        f: 'geojson',
        resultRecordCount: String(options?.limit ?? 25),
        orderByFields: 'YEARSUNK DESC',
      });

      const response = await fetch(`${NOAA_WFS_URL}?${params}`);

      if (!response.ok) {
        throw new Error(`NOAA API error: ${response.status}`);
      }

      const data: NOAAWrecksResponse = await response.json();

      return {
        results: (data.features || []).map(f => this.transformFeature(f)),
        total: data.numberMatched || data.features?.length || 0,
      };
    } catch (error) {
      console.error('NOAA shipwrecks search error:', error);
      throw error;
    }
  }

  /**
   * Search for wrecks near a point
   */
  async searchNearPoint(
    latitude: number,
    longitude: number,
    radiusMiles: number = 50,
    options?: {
      limit?: number;
      featureType?: string;
    }
  ): Promise<ShipwreckSearchResponse> {
    // Convert miles to degrees (approximate)
    const radiusDegrees = radiusMiles / 69; // 1 degree ≈ 69 miles

    return this.searchByBoundingBox({
      minLon: longitude - radiusDegrees,
      minLat: latitude - radiusDegrees,
      maxLon: longitude + radiusDegrees,
      maxLat: latitude + radiusDegrees,
    }, options);
  }

  /**
   * Search for wrecks by state
   */
  async searchByState(
    state: string,
    options?: {
      limit?: number;
    }
  ): Promise<ShipwreckSearchResponse> {
    return this.search('*', {
      ...options,
      state,
    });
  }

  /**
   * Get dangerous wrecks (navigation hazards, but historically interesting)
   */
  async searchDangerousWrecks(
    options?: {
      limit?: number;
      region?: string;
    }
  ): Promise<ShipwreckSearchResponse> {
    try {
      const conditions = [`FEATURE_TYPE = 'Wreck - Dangerous'`];

      if (options?.region) {
        conditions.push(`REGION = '${options.region}'`);
      }

      const params = new URLSearchParams({
        where: conditions.join(' AND '),
        outFields: '*',
        returnGeometry: 'true',
        f: 'geojson',
        resultRecordCount: String(options?.limit ?? 25),
      });

      const response = await fetch(`${NOAA_WFS_URL}?${params}`);

      if (!response.ok) {
        throw new Error(`NOAA API error: ${response.status}`);
      }

      const data: NOAAWrecksResponse = await response.json();

      return {
        results: (data.features || []).map(f => this.transformFeature(f)),
        total: data.numberMatched || data.features?.length || 0,
      };
    } catch (error) {
      console.error('NOAA dangerous wrecks search error:', error);
      throw error;
    }
  }

  /**
   * Search for wrecks with known sinking year (better documented)
   */
  async searchHistoricalWrecks(
    yearFrom?: number,
    yearTo?: number,
    options?: {
      limit?: number;
    }
  ): Promise<ShipwreckSearchResponse> {
    try {
      const conditions = [`YEARSUNK IS NOT NULL`];

      if (yearFrom) {
        conditions.push(`YEARSUNK >= ${yearFrom}`);
      }
      if (yearTo) {
        conditions.push(`YEARSUNK <= ${yearTo}`);
      }

      const params = new URLSearchParams({
        where: conditions.join(' AND '),
        outFields: '*',
        returnGeometry: 'true',
        f: 'geojson',
        resultRecordCount: String(options?.limit ?? 25),
        orderByFields: 'YEARSUNK DESC',
      });

      const response = await fetch(`${NOAA_WFS_URL}?${params}`);

      if (!response.ok) {
        throw new Error(`NOAA API error: ${response.status}`);
      }

      const data: NOAAWrecksResponse = await response.json();

      return {
        results: (data.features || []).map(f => this.transformFeature(f)),
        total: data.numberMatched || data.features?.length || 0,
      };
    } catch (error) {
      console.error('NOAA historical wrecks search error:', error);
      throw error;
    }
  }

  /**
   * Search for deep water wrecks (potentially more preserved)
   */
  async searchDeepWrecks(
    minDepth: number = 100,
    options?: {
      limit?: number;
      region?: string;
    }
  ): Promise<ShipwreckSearchResponse> {
    try {
      const conditions = [`DEPTH >= ${minDepth}`];

      if (options?.region) {
        conditions.push(`REGION = '${options.region}'`);
      }

      const params = new URLSearchParams({
        where: conditions.join(' AND '),
        outFields: '*',
        returnGeometry: 'true',
        f: 'geojson',
        resultRecordCount: String(options?.limit ?? 25),
        orderByFields: 'DEPTH DESC',
      });

      const response = await fetch(`${NOAA_WFS_URL}?${params}`);

      if (!response.ok) {
        throw new Error(`NOAA API error: ${response.status}`);
      }

      const data: NOAAWrecksResponse = await response.json();

      return {
        results: (data.features || []).map(f => this.transformFeature(f)),
        total: data.numberMatched || data.features?.length || 0,
      };
    } catch (error) {
      console.error('NOAA deep wrecks search error:', error);
      throw error;
    }
  }

  /**
   * Get all regions available
   */
  getAvailableRegions(): string[] {
    return [
      'Atlantic Coast',
      'Gulf of Mexico', 
      'Pacific Coast',
      'Great Lakes',
      'Alaska',
      'Hawaii',
      'Caribbean',
      'Puerto Rico',
    ];
  }

  /**
   * Transform NOAA feature to our format
   */
  private transformFeature(feature: NOAAWreckFeature): ShipwreckSearchResult {
    const props = feature.properties;
    const [longitude, latitude] = feature.geometry.coordinates;

    // Parse year sunk
    let yearSunk: number | undefined;
    if (props.YEARSUNK) {
      const year = typeof props.YEARSUNK === 'string' 
        ? parseInt(props.YEARSUNK) 
        : props.YEARSUNK;
      if (!isNaN(year)) yearSunk = year;
    }

    // Build vessel name
    const vesselName = props.VESSLTERMS || 'Unknown Vessel';

    // Build title
    const title = vesselName !== 'Unknown Vessel'
      ? `${vesselName}${yearSunk ? ` (${yearSunk})` : ''}`
      : `${props.FEATURE_TYPE || 'Wreck'}${yearSunk ? ` - ${yearSunk}` : ''}`;

    // Build content description
    const contentParts = [
      props.HISTORY || '',
      props.FEATURE_TYPE ? `Type: ${props.FEATURE_TYPE}` : '',
      props.DEPTH ? `Depth: ${props.DEPTH} feet` : '',
      props.REGION ? `Region: ${props.REGION}` : '',
      props.STATE ? `State: ${props.STATE}` : '',
      props.WATER_BODY ? `Water Body: ${props.WATER_BODY}` : '',
      props.SOURCE ? `Source: ${props.SOURCE}` : '',
    ].filter(Boolean);

    const content = contentParts.join('. ') || 
      `${props.FEATURE_TYPE || 'Wreck'} located at ${latitude.toFixed(4)}°N, ${Math.abs(longitude).toFixed(4)}°W`;

    return {
      url: `https://nauticalcharts.noaa.gov/data/wrecks-and-obstructions.html#${props.OBJECTID}`,
      title,
      content,
      wreckId: String(props.OBJECTID || feature.id),
      vesselName: vesselName !== 'Unknown Vessel' ? vesselName : undefined,
      vesselType: props.VESSLTERMS,
      featureType: props.FEATURE_TYPE || 'Unknown',
      latitude,
      longitude,
      depth: props.DEPTH,
      depthUnits: 'feet',
      yearSunk,
      condition: props.WATLEV,
      history: props.HISTORY,
      source: props.SOURCE,
      chartNumber: props.CHART,
      region: props.REGION,
      state: props.STATE,
      waterBody: props.WATER_BODY,
      gp_quality: props.GP_QUALITY,
      sounding: props.SOUNDING,
      lastUpdate: props.SORDAT,
    };
  }
}

