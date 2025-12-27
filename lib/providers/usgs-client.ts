/**
 * USGS Earthquake API Client
 * 
 * Real-time earthquake data from the U.S. Geological Survey.
 * Essential for earth science, geology, and natural disaster research.
 * 
 * Coverage: All earthquakes worldwide in real-time
 * Rate Limit: No official limit, be respectful
 * 100% FREE - No API key required
 * 
 * @see https://earthquake.usgs.gov/fdsnws/event/1/
 */

export interface USGSEarthquakeResult {
  url: string;
  title: string;
  content: string;
  magnitude: number;
  place: string;
  time: Date;
  depth: number; // km
  latitude: number;
  longitude: number;
  tsunami: boolean;
  significance: number;
  felt?: number; // Number of felt reports
  alert?: 'green' | 'yellow' | 'orange' | 'red';
  eventId: string;
}

export interface USGSSearchResponse {
  results: USGSEarthquakeResult[];
  total: number;
}

interface USGSFeature {
  type: 'Feature';
  id: string;
  properties: {
    mag: number;
    place: string;
    time: number;
    updated: number;
    url: string;
    detail: string;
    felt?: number;
    cdi?: number;
    tsunami: number;
    sig: number;
    alert?: string;
    title: string;
    type: string;
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number, number]; // [lon, lat, depth]
  };
}

interface USGSResponse {
  type: 'FeatureCollection';
  metadata: {
    generated: number;
    url: string;
    title: string;
    count: number;
  };
  features: USGSFeature[];
}

const USGS_API = 'https://earthquake.usgs.gov/fdsnws/event/1';

export class USGSClient {
  /**
   * Search for earthquakes with various filters
   */
  async search(
    query: string,
    options?: {
      limit?: number;
      minMagnitude?: number;
      maxMagnitude?: number;
      startTime?: string; // ISO 8601
      endTime?: string;   // ISO 8601
    }
  ): Promise<USGSSearchResponse> {
    try {
      const params = new URLSearchParams({
        format: 'geojson',
        limit: String(options?.limit ?? 20),
        orderby: 'time',
      });

      // Apply filters
      if (options?.minMagnitude) {
        params.set('minmagnitude', String(options.minMagnitude));
      }
      if (options?.maxMagnitude) {
        params.set('maxmagnitude', String(options.maxMagnitude));
      }
      if (options?.startTime) {
        params.set('starttime', options.startTime);
      }
      if (options?.endTime) {
        params.set('endtime', options.endTime);
      }

      const response = await fetch(`${USGS_API}/query?${params}`);

      if (!response.ok) {
        throw new Error(`USGS API error: ${response.status}`);
      }

      const data: USGSResponse = await response.json();
      
      // Filter by location name if query provided
      let features = data.features;
      if (query && query.trim()) {
        const q = query.toLowerCase();
        features = features.filter(f => 
          f.properties.place?.toLowerCase().includes(q) ||
          f.properties.title?.toLowerCase().includes(q)
        );
      }

      return {
        results: features.map(f => this.transformFeature(f)),
        total: features.length,
      };
    } catch (error) {
      console.error('USGS search error:', error);
      throw error;
    }
  }

  /**
   * Get recent significant earthquakes
   */
  async getSignificant(
    options?: {
      period?: 'hour' | 'day' | 'week' | 'month';
    }
  ): Promise<USGSSearchResponse> {
    try {
      const period = options?.period || 'week';
      const response = await fetch(
        `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_${period}.geojson`
      );

      if (!response.ok) {
        throw new Error(`USGS API error: ${response.status}`);
      }

      const data: USGSResponse = await response.json();

      return {
        results: data.features.map(f => this.transformFeature(f)),
        total: data.metadata.count,
      };
    } catch (error) {
      console.error('USGS significant earthquakes error:', error);
      throw error;
    }
  }

  /**
   * Get earthquakes by magnitude threshold
   */
  async getByMagnitude(
    minMagnitude: number,
    options?: {
      period?: 'hour' | 'day' | 'week' | 'month';
    }
  ): Promise<USGSSearchResponse> {
    try {
      const period = options?.period || 'week';
      let feed = 'all';
      
      if (minMagnitude >= 4.5) feed = '4.5';
      else if (minMagnitude >= 2.5) feed = '2.5';
      else if (minMagnitude >= 1.0) feed = '1.0';

      const response = await fetch(
        `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${feed}_${period}.geojson`
      );

      if (!response.ok) {
        throw new Error(`USGS API error: ${response.status}`);
      }

      const data: USGSResponse = await response.json();

      // Filter to exact minimum magnitude
      const filtered = data.features.filter(f => f.properties.mag >= minMagnitude);

      return {
        results: filtered.map(f => this.transformFeature(f)),
        total: filtered.length,
      };
    } catch (error) {
      console.error('USGS magnitude search error:', error);
      throw error;
    }
  }

  /**
   * Get earthquake by ID
   */
  async getEarthquake(eventId: string): Promise<USGSEarthquakeResult | null> {
    try {
      const params = new URLSearchParams({
        format: 'geojson',
        eventid: eventId,
      });

      const response = await fetch(`${USGS_API}/query?${params}`);

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`USGS API error: ${response.status}`);
      }

      const data: USGSResponse = await response.json();
      
      if (data.features.length === 0) return null;
      
      return this.transformFeature(data.features[0]);
    } catch (error) {
      console.error('USGS get earthquake error:', error);
      throw error;
    }
  }

  /**
   * Search by geographic region
   */
  async searchByRegion(
    latitude: number,
    longitude: number,
    radiusKm: number,
    options?: {
      limit?: number;
      minMagnitude?: number;
      days?: number;
    }
  ): Promise<USGSSearchResponse> {
    try {
      const endTime = new Date();
      const startTime = new Date();
      startTime.setDate(startTime.getDate() - (options?.days ?? 30));

      const params = new URLSearchParams({
        format: 'geojson',
        latitude: String(latitude),
        longitude: String(longitude),
        maxradiuskm: String(radiusKm),
        starttime: startTime.toISOString(),
        endtime: endTime.toISOString(),
        limit: String(options?.limit ?? 20),
        orderby: 'time',
      });

      if (options?.minMagnitude) {
        params.set('minmagnitude', String(options.minMagnitude));
      }

      const response = await fetch(`${USGS_API}/query?${params}`);

      if (!response.ok) {
        throw new Error(`USGS API error: ${response.status}`);
      }

      const data: USGSResponse = await response.json();

      return {
        results: data.features.map(f => this.transformFeature(f)),
        total: data.features.length,
      };
    } catch (error) {
      console.error('USGS region search error:', error);
      throw error;
    }
  }

  /**
   * Transform USGS feature to our format
   */
  private transformFeature(feature: USGSFeature): USGSEarthquakeResult {
    const props = feature.properties;
    const coords = feature.geometry.coordinates;

    const timeDate = new Date(props.time);
    const content = `Magnitude ${props.mag} earthquake ${props.place}. ` +
      `Depth: ${coords[2]} km. ` +
      `Time: ${timeDate.toISOString()}. ` +
      `Felt reports: ${props.felt ?? 0}. ` +
      `Tsunami warning: ${props.tsunami === 1 ? 'Yes' : 'No'}. ` +
      `Significance: ${props.sig}. ` +
      (props.alert ? `Alert level: ${props.alert}.` : '');

    return {
      url: props.url,
      title: props.title,
      content,
      magnitude: props.mag,
      place: props.place,
      time: timeDate,
      depth: coords[2],
      latitude: coords[1],
      longitude: coords[0],
      tsunami: props.tsunami === 1,
      significance: props.sig,
      felt: props.felt,
      alert: props.alert as 'green' | 'yellow' | 'orange' | 'red' | undefined,
      eventId: feature.id,
    };
  }
}


