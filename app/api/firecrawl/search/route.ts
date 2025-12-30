import { NextRequest, NextResponse } from 'next/server';
import { FirecrawlClient } from '@/lib/firecrawl';
import { handleApiError, validationError, capLimit } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, limit = 10, scrapeOptions, apiKey } = body;

    if (!query) {
      return validationError('Query');
    }

    const firecrawl = new FirecrawlClient(apiKey);
    const result = await firecrawl.search(query, {
      limit: capLimit(limit, 20),
      scrapeOptions: scrapeOptions ?? { formats: ['markdown'] },
    });

    return NextResponse.json({
      success: true,
      query,
      results: result.data,
      total: result.data.length,
      metadata: result.metadata,
    });
  } catch (error) {
    return handleApiError(error, 'Firecrawl Search API');
  }
}
