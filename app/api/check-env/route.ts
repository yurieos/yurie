import { NextResponse } from 'next/server';

export async function GET() {
  const environmentStatus = {
    FIRECRAWL_API_KEY: !!process.env.FIRECRAWL_API_KEY,
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    // Multi-provider search APIs
    TAVILY_API_KEY: !!process.env.TAVILY_API_KEY,
    EXA_API_KEY: !!process.env.EXA_API_KEY,
  };

  // Calculate available search providers
  const searchProviders = {
    firecrawl: !!process.env.FIRECRAWL_API_KEY,
    tavily: !!process.env.TAVILY_API_KEY,
    exa: !!process.env.EXA_API_KEY,
  };

  return NextResponse.json({ 
    environmentStatus,
    searchProviders,
    multiProviderEnabled: searchProviders.tavily || searchProviders.exa,
  });
} 