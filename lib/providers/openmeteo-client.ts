/**
 * Open-Meteo API Client
 * 
 * 100% FREE weather API with no API key required.
 * High-quality weather forecasts, historical data, and climate information.
 * 
 * Coverage: Global weather data
 * Rate Limit: 10,000 requests/day
 * 100% FREE - No API key required, no registration
 * 
 * @see https://open-meteo.com/en/docs
 */

export interface OpenMeteoSearchResult {
  url: string;
  title: string;
  content: string;
  location: {
    latitude: number;
    longitude: number;
    name?: string;
    country?: string;
    timezone?: string;
  };
  current?: {
    temperature: number;
    humidity: number;
    weatherCode: number;
    weatherDescription: string;
    windSpeed: number;
    precipitation: number;
  };
  forecast?: Array<{
    date: string;
    temperatureMax: number;
    temperatureMin: number;
    weatherCode: number;
    weatherDescription: string;
    precipitationSum: number;
  }>;
}

export interface OpenMeteoSearchResponse {
  results: OpenMeteoSearchResult[];
  total: number;
}

interface GeocodingResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  country_code: string;
  timezone: string;
  admin1?: string;
}

interface WeatherResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  current?: {
    temperature_2m: number;
    relative_humidity_2m: number;
    weather_code: number;
    wind_speed_10m: number;
    precipitation: number;
  };
  daily?: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
    precipitation_sum: number[];
  };
}

const OPENMETEO_API = 'https://api.open-meteo.com/v1';
const GEOCODING_API = 'https://geocoding-api.open-meteo.com/v1';

// Weather code descriptions
const WEATHER_CODES: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow fall',
  73: 'Moderate snow fall',
  75: 'Heavy snow fall',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

export class OpenMeteoClient {
  /**
   * Search for locations (geocoding)
   */
  async searchLocations(
    query: string,
    options?: {
      limit?: number;
    }
  ): Promise<GeocodingResult[]> {
    try {
      const params = new URLSearchParams({
        name: query,
        count: String(options?.limit ?? 10),
        language: 'en',
        format: 'json',
      });

      const response = await fetch(`${GEOCODING_API}/search?${params}`);

      if (!response.ok) {
        throw new Error(`Open-Meteo Geocoding error: ${response.status}`);
      }

      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('Open-Meteo geocoding error:', error);
      throw error;
    }
  }

  /**
   * Get current weather for a location
   */
  async getCurrentWeather(
    latitude: number,
    longitude: number
  ): Promise<OpenMeteoSearchResult> {
    try {
      const params = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation',
        timezone: 'auto',
      });

      const response = await fetch(`${OPENMETEO_API}/forecast?${params}`);

      if (!response.ok) {
        throw new Error(`Open-Meteo API error: ${response.status}`);
      }

      const data: WeatherResponse = await response.json();

      return this.transformWeatherResponse(data, { latitude, longitude });
    } catch (error) {
      console.error('Open-Meteo current weather error:', error);
      throw error;
    }
  }

  /**
   * Get weather forecast
   */
  async getForecast(
    latitude: number,
    longitude: number,
    options?: {
      days?: number; // 1-16
    }
  ): Promise<OpenMeteoSearchResult> {
    try {
      const params = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation',
        daily: 'temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum',
        timezone: 'auto',
        forecast_days: String(options?.days ?? 7),
      });

      const response = await fetch(`${OPENMETEO_API}/forecast?${params}`);

      if (!response.ok) {
        throw new Error(`Open-Meteo API error: ${response.status}`);
      }

      const data: WeatherResponse = await response.json();

      return this.transformWeatherResponse(data, { latitude, longitude });
    } catch (error) {
      console.error('Open-Meteo forecast error:', error);
      throw error;
    }
  }

  /**
   * Search weather by location name
   */
  async search(
    query: string,
    options?: {
      limit?: number;
      includeForecast?: boolean;
    }
  ): Promise<OpenMeteoSearchResponse> {
    try {
      // First geocode the location
      const locations = await this.searchLocations(query, { limit: options?.limit ?? 5 });

      if (locations.length === 0) {
        return { results: [], total: 0 };
      }

      // Get weather for each location
      const results = await Promise.all(
        locations.map(async location => {
          if (options?.includeForecast) {
            const weather = await this.getForecast(location.latitude, location.longitude);
            weather.location.name = location.name;
            weather.location.country = location.country;
            weather.location.timezone = location.timezone;
            return weather;
          } else {
            const weather = await this.getCurrentWeather(location.latitude, location.longitude);
            weather.location.name = location.name;
            weather.location.country = location.country;
            weather.location.timezone = location.timezone;
            return weather;
          }
        })
      );

      return {
        results,
        total: results.length,
      };
    } catch (error) {
      console.error('Open-Meteo search error:', error);
      throw error;
    }
  }

  /**
   * Get historical weather data
   */
  async getHistoricalWeather(
    latitude: number,
    longitude: number,
    startDate: string, // YYYY-MM-DD
    endDate: string
  ): Promise<OpenMeteoSearchResult> {
    try {
      const params = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        start_date: startDate,
        end_date: endDate,
        daily: 'temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum',
        timezone: 'auto',
      });

      const response = await fetch(`https://archive-api.open-meteo.com/v1/archive?${params}`);

      if (!response.ok) {
        throw new Error(`Open-Meteo Historical API error: ${response.status}`);
      }

      const data: WeatherResponse = await response.json();

      return this.transformWeatherResponse(data, { latitude, longitude });
    } catch (error) {
      console.error('Open-Meteo historical weather error:', error);
      throw error;
    }
  }

  /**
   * Get weather description from code
   */
  getWeatherDescription(code: number): string {
    return WEATHER_CODES[code] || 'Unknown';
  }

  /**
   * Transform API response to our format
   */
  private transformWeatherResponse(
    data: WeatherResponse,
    coords: { latitude: number; longitude: number; name?: string; country?: string }
  ): OpenMeteoSearchResult {
    const current = data.current ? {
      temperature: data.current.temperature_2m,
      humidity: data.current.relative_humidity_2m,
      weatherCode: data.current.weather_code,
      weatherDescription: this.getWeatherDescription(data.current.weather_code),
      windSpeed: data.current.wind_speed_10m,
      precipitation: data.current.precipitation,
    } : undefined;

    const forecast = data.daily ? data.daily.time.map((date, i) => ({
      date,
      temperatureMax: data.daily!.temperature_2m_max[i],
      temperatureMin: data.daily!.temperature_2m_min[i],
      weatherCode: data.daily!.weather_code[i],
      weatherDescription: this.getWeatherDescription(data.daily!.weather_code[i]),
      precipitationSum: data.daily!.precipitation_sum[i],
    })) : undefined;

    // Build content
    let content = '';
    if (current) {
      content = `Current weather: ${current.weatherDescription}. ` +
        `Temperature: ${current.temperature}°C. ` +
        `Humidity: ${current.humidity}%. ` +
        `Wind: ${current.windSpeed} km/h. ` +
        `Precipitation: ${current.precipitation} mm.`;
    }
    if (forecast && forecast.length > 0) {
      const tomorrow = forecast[1];
      if (tomorrow) {
        content += ` Tomorrow: ${tomorrow.weatherDescription}, ` +
          `High ${tomorrow.temperatureMax}°C, Low ${tomorrow.temperatureMin}°C.`;
      }
    }

    const locationName = coords.name || `${coords.latitude.toFixed(2)}, ${coords.longitude.toFixed(2)}`;

    return {
      url: `https://open-meteo.com/en/docs?latitude=${coords.latitude}&longitude=${coords.longitude}`,
      title: `Weather for ${locationName}${coords.country ? `, ${coords.country}` : ''}`,
      content,
      location: {
        latitude: coords.latitude,
        longitude: coords.longitude,
        name: coords.name,
        country: coords.country,
        timezone: data.timezone,
      },
      current,
      forecast,
    };
  }
}


