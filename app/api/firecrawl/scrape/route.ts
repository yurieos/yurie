import { NextRequest, NextResponse } from 'next/server';
import { FirecrawlClient } from '@/lib/firecrawl';
import { handleApiError, validationError } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, onlyMainContent = true, includeLinks = false, apiKey } = body;

    if (!url) {
      return validationError('URL');
    }

    const firecrawl = new FirecrawlClient(apiKey);
    const result = await firecrawl.scrapeForLLM(url, {
      onlyMainContent,
      includeLinks,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, 'Scrape API');
  }
}
