/**
 * Art Institute of Chicago API Client
 * 
 * Access to 120,000+ artworks from one of the oldest and largest
 * art museums in the United States. Excellent historical art collection.
 * 
 * Coverage: 120K+ artworks (ancient to contemporary)
 * Rate Limit: 60 requests/minute
 * 100% FREE - No API key required
 * Data License: CC0 (public domain)
 * 
 * @see https://api.artic.edu/docs/
 */

export interface ArticSearchResult {
  url: string;
  title: string;
  content: string;
  artworkId: number;
  artistName?: string;
  artistDisplay?: string;
  dateDisplay?: string;
  dateStart?: number;
  dateEnd?: number;
  medium?: string;
  dimensions?: string;
  department?: string;
  placeOfOrigin?: string;
  artworkType?: string;
  styleTitle?: string;
  classification?: string;
  subjectTitles?: string[];
  imageUrl?: string;
  thumbnailUrl?: string;
  isPublicDomain: boolean;
  creditLine?: string;
  galleryTitle?: string;
}

export interface ArticSearchResponse {
  results: ArticSearchResult[];
  total: number;
  pages: number;
}

interface ArticArtwork {
  id: number;
  api_model: string;
  api_link: string;
  is_boosted: boolean;
  title: string;
  alt_titles: string[] | null;
  thumbnail: {
    lqip: string;
    width: number;
    height: number;
    alt_text: string;
  } | null;
  main_reference_number: string;
  has_not_been_viewed_much: boolean;
  boost_rank: number | null;
  date_start: number | null;
  date_end: number | null;
  date_display: string;
  date_qualifier_title: string;
  date_qualifier_id: number | null;
  artist_display: string;
  place_of_origin: string;
  dimensions: string;
  medium_display: string;
  inscriptions: string | null;
  credit_line: string;
  catalogue_display: string | null;
  publication_history: string | null;
  exhibition_history: string | null;
  provenance_text: string | null;
  edition: string | null;
  publishing_verification_level: string;
  internal_department_id: number;
  fiscal_year: number | null;
  fiscal_year_deaccession: number | null;
  is_public_domain: boolean;
  is_zoomable: boolean;
  max_zoom_window_size: number;
  copyright_notice: string | null;
  has_multimedia_resources: boolean;
  has_educational_resources: boolean;
  has_advanced_imaging: boolean;
  colorfulness: number;
  color: {
    h: number;
    l: number;
    s: number;
    percentage: number;
    population: number;
  } | null;
  latitude: number | null;
  longitude: number | null;
  latlon: string | null;
  is_on_view: boolean;
  on_loan_display: string | null;
  gallery_title: string | null;
  gallery_id: number | null;
  artwork_type_title: string;
  artwork_type_id: number;
  department_title: string;
  department_id: string;
  artist_id: number | null;
  artist_title: string;
  alt_artist_ids: number[];
  artist_ids: number[];
  artist_titles: string[];
  category_ids: string[];
  category_titles: string[];
  term_titles: string[];
  style_id: string | null;
  style_title: string | null;
  alt_style_ids: string[];
  style_ids: string[];
  style_titles: string[];
  classification_id: string | null;
  classification_title: string | null;
  alt_classification_ids: string[];
  classification_ids: string[];
  classification_titles: string[];
  subject_id: string | null;
  alt_subject_ids: string[];
  subject_ids: string[];
  subject_titles: string[];
  material_id: string | null;
  alt_material_ids: string[];
  material_ids: string[];
  material_titles: string[];
  technique_id: string | null;
  alt_technique_ids: string[];
  technique_ids: string[];
  technique_titles: string[];
  theme_titles: string[];
  image_id: string | null;
  alt_image_ids: string[];
  document_ids: string[];
  sound_ids: string[];
  video_ids: string[];
  text_ids: string[];
  section_ids: number[];
  section_titles: string[];
  site_ids: number[];
  suggest_autocomplete_all: Array<{
    input: string[];
    contexts: { groupings: string[] };
  }>;
  source_updated_at: string;
  updated_at: string;
  timestamp: string;
}

interface ArticAPIResponse {
  pagination: {
    total: number;
    limit: number;
    offset: number;
    total_pages: number;
    current_page: number;
    next_url: string | null;
    prev_url: string | null;
  };
  data: ArticArtwork[];
  info: {
    license_text: string;
    license_links: string[];
    version: string;
  };
  config: {
    iiif_url: string;
    website_url: string;
  };
}

const ARTIC_API = 'https://api.artic.edu/api/v1';
const ARTIC_IIIF = 'https://www.artic.edu/iiif/2';

export class ArticClient {
  /**
   * Search the Art Institute of Chicago collection
   */
  async search(
    query: string,
    options?: {
      limit?: number;
      page?: number;
      departmentId?: string;
      artworkTypeId?: number;
      styleId?: string;
      dateStart?: number;
      dateEnd?: number;
      isPublicDomain?: boolean;
      isOnView?: boolean;
      hasImages?: boolean;
      sortBy?: 'date_start' | 'date_end' | 'title' | 'artist_title' | 'is_boosted';
    }
  ): Promise<ArticSearchResponse> {
    try {
      const params = new URLSearchParams({
        q: query,
        limit: String(options?.limit ?? 10),
        page: String(options?.page ?? 1),
        fields: 'id,title,artist_display,artist_title,date_display,date_start,date_end,medium_display,dimensions,department_title,place_of_origin,artwork_type_title,style_title,classification_title,subject_titles,image_id,thumbnail,is_public_domain,credit_line,gallery_title',
      });

      // Build query filters
      const queryFilters: string[] = [];
      
      if (options?.departmentId) {
        queryFilters.push(`department_id:${options.departmentId}`);
      }
      if (options?.artworkTypeId) {
        queryFilters.push(`artwork_type_id:${options.artworkTypeId}`);
      }
      if (options?.styleId) {
        queryFilters.push(`style_id:${options.styleId}`);
      }
      if (options?.dateStart && options?.dateEnd) {
        queryFilters.push(`date_start:[${options.dateStart} TO ${options.dateEnd}]`);
      }
      if (options?.isPublicDomain === true) {
        queryFilters.push('is_public_domain:true');
      }
      if (options?.isOnView === true) {
        queryFilters.push('is_on_view:true');
      }

      if (queryFilters.length > 0) {
        params.set('query[bool][filter]', queryFilters.join(' AND '));
      }

      const response = await fetch(`${ARTIC_API}/artworks/search?${params}`);
      if (!response.ok) throw new Error(`Art Institute of Chicago API error: ${response.status}`);

      const data: ArticAPIResponse = await response.json();

      return {
        results: data.data.map(artwork => this.transformArtwork(artwork, data.config.iiif_url)),
        total: data.pagination.total,
        pages: data.pagination.total_pages,
      };
    } catch (error) {
      console.error('Art Institute of Chicago search error:', error);
      throw error;
    }
  }

  /**
   * Get artwork by ID
   */
  async getArtwork(artworkId: number): Promise<ArticSearchResult | null> {
    try {
      const params = new URLSearchParams({
        fields: 'id,title,artist_display,artist_title,date_display,date_start,date_end,medium_display,dimensions,department_title,place_of_origin,artwork_type_title,style_title,classification_title,subject_titles,image_id,thumbnail,is_public_domain,credit_line,gallery_title,publication_history,exhibition_history,provenance_text',
      });

      const response = await fetch(`${ARTIC_API}/artworks/${artworkId}?${params}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Art Institute of Chicago API error: ${response.status}`);
      }

      const data = await response.json();
      return this.transformArtwork(data.data, data.config?.iiif_url || ARTIC_IIIF);
    } catch (error) {
      console.error('Art Institute of Chicago get artwork error:', error);
      return null;
    }
  }

  /**
   * Search by department
   */
  async searchByDepartment(
    department: string,
    query?: string,
    options?: { limit?: number }
  ): Promise<ArticSearchResponse> {
    const departmentMap: Record<string, string> = {
      'african': 'PC-1',
      'american': 'PC-2',
      'ancient': 'PC-4',
      'architecture': 'PC-5',
      'asian': 'PC-6',
      'european': 'PC-10',
      'modern': 'PC-13',
      'photography': 'PC-14',
      'prints': 'PC-15',
      'textiles': 'PC-17',
    };

    const departmentId = departmentMap[department.toLowerCase()] || department;
    return this.search(query || '*', { ...options, departmentId });
  }

  /**
   * Search by time period (for historical research)
   */
  async searchByPeriod(
    dateStart: number,
    dateEnd: number,
    query?: string,
    options?: { limit?: number }
  ): Promise<ArticSearchResponse> {
    return this.search(query || '*', { ...options, dateStart, dateEnd });
  }

  /**
   * Search public domain works only
   */
  async searchPublicDomain(
    query: string,
    options?: { limit?: number }
  ): Promise<ArticSearchResponse> {
    return this.search(query, { ...options, isPublicDomain: true });
  }

  /**
   * Search ancient art
   */
  async searchAncientArt(
    query?: string,
    options?: { limit?: number }
  ): Promise<ArticSearchResponse> {
    return this.searchByDepartment('ancient', query, options);
  }

  /**
   * Search European art
   */
  async searchEuropeanArt(
    query?: string,
    options?: { limit?: number }
  ): Promise<ArticSearchResponse> {
    return this.searchByDepartment('european', query, options);
  }

  /**
   * Search Asian art
   */
  async searchAsianArt(
    query?: string,
    options?: { limit?: number }
  ): Promise<ArticSearchResponse> {
    return this.searchByDepartment('asian', query, options);
  }

  /**
   * Get departments list
   */
  async getDepartments(): Promise<Array<{ id: string; title: string }>> {
    try {
      const response = await fetch(`${ARTIC_API}/departments?limit=100`);
      if (!response.ok) throw new Error(`Art Institute of Chicago API error: ${response.status}`);

      const data = await response.json();
      return (data.data || []).map((dept: { id: string; title: string }) => ({
        id: dept.id,
        title: dept.title,
      }));
    } catch (error) {
      console.error('Art Institute of Chicago departments fetch error:', error);
      return [];
    }
  }

  /**
   * Transform artwork to our format
   */
  private transformArtwork(artwork: ArticArtwork, iiifUrl: string): ArticSearchResult {
    const contentParts = [
      artwork.artist_display || artwork.artist_title,
      artwork.date_display ? `(${artwork.date_display})` : '',
      artwork.medium_display,
      artwork.place_of_origin ? `Origin: ${artwork.place_of_origin}` : '',
      artwork.department_title ? `Department: ${artwork.department_title}` : '',
      artwork.style_title ? `Style: ${artwork.style_title}` : '',
    ].filter(Boolean);

    let imageUrl: string | undefined;
    let thumbnailUrl: string | undefined;

    if (artwork.image_id) {
      imageUrl = `${iiifUrl}/${artwork.image_id}/full/843,/0/default.jpg`;
      thumbnailUrl = `${iiifUrl}/${artwork.image_id}/full/200,/0/default.jpg`;
    }

    return {
      url: `https://www.artic.edu/artworks/${artwork.id}`,
      title: artwork.title || 'Untitled',
      content: contentParts.join('. '),
      artworkId: artwork.id,
      artistName: artwork.artist_title || undefined,
      artistDisplay: artwork.artist_display || undefined,
      dateDisplay: artwork.date_display || undefined,
      dateStart: artwork.date_start || undefined,
      dateEnd: artwork.date_end || undefined,
      medium: artwork.medium_display || undefined,
      dimensions: artwork.dimensions || undefined,
      department: artwork.department_title || undefined,
      placeOfOrigin: artwork.place_of_origin || undefined,
      artworkType: artwork.artwork_type_title || undefined,
      styleTitle: artwork.style_title || undefined,
      classification: artwork.classification_title || undefined,
      subjectTitles: artwork.subject_titles?.length ? artwork.subject_titles : undefined,
      imageUrl,
      thumbnailUrl,
      isPublicDomain: artwork.is_public_domain,
      creditLine: artwork.credit_line || undefined,
      galleryTitle: artwork.gallery_title || undefined,
    };
  }
}


