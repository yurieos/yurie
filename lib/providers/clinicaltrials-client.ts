/**
 * ClinicalTrials.gov API Client
 * 
 * Access to 400,000+ clinical studies conducted around the world.
 * Essential for medical research, drug development, and health studies.
 * 
 * Coverage: 400K+ clinical studies
 * Rate Limit: No official limit, be respectful
 * 100% FREE - No API key required
 * 
 * @see https://clinicaltrials.gov/data-api/api
 */

import { loggers } from '../utils/logger';

const log = loggers.provider;

export interface ClinicalTrialSearchResult {
  url: string;
  title: string;
  content: string;
  nctId: string;
  status: string;
  phase?: string;
  conditions: string[];
  interventions: string[];
  sponsor?: string;
  startDate?: string;
  completionDate?: string;
  enrollment?: number;
  locations?: string[];
}

export interface ClinicalTrialSearchResponse {
  results: ClinicalTrialSearchResult[];
  total: number;
  nextPageToken?: string;
}

interface CTGStudy {
  protocolSection: {
    identificationModule: {
      nctId: string;
      briefTitle: string;
      officialTitle?: string;
    };
    statusModule: {
      overallStatus: string;
      startDateStruct?: { date: string };
      completionDateStruct?: { date: string };
    };
    descriptionModule?: {
      briefSummary?: string;
      detailedDescription?: string;
    };
    conditionsModule?: {
      conditions?: string[];
    };
    armsInterventionsModule?: {
      interventions?: Array<{
        type: string;
        name: string;
        description?: string;
      }>;
    };
    designModule?: {
      phases?: string[];
      enrollmentInfo?: { count: number };
    };
    sponsorCollaboratorsModule?: {
      leadSponsor?: { name: string };
    };
    contactsLocationsModule?: {
      locations?: Array<{
        facility?: string;
        city?: string;
        country?: string;
      }>;
    };
  };
}

const CTG_API = 'https://clinicaltrials.gov/api/v2';

export class ClinicalTrialsClient {
  /**
   * Search for clinical trials
   */
  async search(
    query: string,
    options?: {
      limit?: number;
      status?: 'RECRUITING' | 'COMPLETED' | 'ACTIVE_NOT_RECRUITING' | 'NOT_YET_RECRUITING';
      phase?: string;
      pageToken?: string;
    }
  ): Promise<ClinicalTrialSearchResponse> {
    try {
      const params = new URLSearchParams({
        'query.term': query,
        pageSize: String(options?.limit ?? 10),
        format: 'json',
      });

      // Add filters
      if (options?.status) {
        params.set('filter.overallStatus', options.status);
      }
      if (options?.phase) {
        params.set('filter.phase', options.phase);
      }
      if (options?.pageToken) {
        params.set('pageToken', options.pageToken);
      }

      // Request specific fields
      params.set('fields', [
        'NCTId',
        'BriefTitle',
        'OfficialTitle',
        'OverallStatus',
        'BriefSummary',
        'DetailedDescription',
        'Condition',
        'InterventionType',
        'InterventionName',
        'Phase',
        'EnrollmentCount',
        'LeadSponsorName',
        'StartDate',
        'CompletionDate',
        'LocationFacility',
        'LocationCity',
        'LocationCountry',
      ].join(','));

      const response = await fetch(`${CTG_API}/studies?${params}`);

      if (!response.ok) {
        throw new Error(`ClinicalTrials.gov API error: ${response.status}`);
      }

      const data = await response.json();
      const studies: CTGStudy[] = data.studies || [];

      return {
        results: studies.map(study => this.transformStudy(study)),
        total: data.totalCount || studies.length,
        nextPageToken: data.nextPageToken,
      };
    } catch (error) {
      log.debug('ClinicalTrials.gov search error:', error);
      throw error;
    }
  }

  /**
   * Get a specific study by NCT ID
   */
  async getStudy(nctId: string): Promise<ClinicalTrialSearchResult | null> {
    try {
      const response = await fetch(`${CTG_API}/studies/${nctId}?format=json`);

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`ClinicalTrials.gov API error: ${response.status}`);
      }

      const study: CTGStudy = await response.json();
      return this.transformStudy(study);
    } catch (error) {
      log.debug('ClinicalTrials.gov get study error:', error);
      throw error;
    }
  }

  /**
   * Search for trials by condition
   */
  async searchByCondition(
    condition: string,
    options?: {
      limit?: number;
      recruitingOnly?: boolean;
    }
  ): Promise<ClinicalTrialSearchResponse> {
    return this.search(condition, {
      limit: options?.limit,
      status: options?.recruitingOnly ? 'RECRUITING' : undefined,
    });
  }

  /**
   * Search for trials by intervention/drug
   */
  async searchByIntervention(
    intervention: string,
    options?: {
      limit?: number;
    }
  ): Promise<ClinicalTrialSearchResponse> {
    return this.search(intervention, options);
  }

  /**
   * Transform CTG study to our format
   */
  private transformStudy(study: CTGStudy): ClinicalTrialSearchResult {
    const protocol = study.protocolSection;
    const nctId = protocol.identificationModule.nctId;

    // Build content from summary and description
    const content = [
      protocol.descriptionModule?.briefSummary,
      protocol.descriptionModule?.detailedDescription,
    ]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 3000);

    // Get interventions
    const interventions = protocol.armsInterventionsModule?.interventions?.map(
      i => `${i.type}: ${i.name}`
    ) || [];

    // Get locations
    const locations = protocol.contactsLocationsModule?.locations?.slice(0, 5).map(
      loc => [loc.city, loc.country].filter(Boolean).join(', ')
    ).filter(Boolean) || [];

    return {
      url: `https://clinicaltrials.gov/study/${nctId}`,
      title: protocol.identificationModule.briefTitle,
      content,
      nctId,
      status: protocol.statusModule.overallStatus,
      phase: protocol.designModule?.phases?.join(', '),
      conditions: protocol.conditionsModule?.conditions || [],
      interventions,
      sponsor: protocol.sponsorCollaboratorsModule?.leadSponsor?.name,
      startDate: protocol.statusModule.startDateStruct?.date,
      completionDate: protocol.statusModule.completionDateStruct?.date,
      enrollment: protocol.designModule?.enrollmentInfo?.count,
      locations,
    };
  }
}


