import { VisualResearchContent } from './visual-research-content';

// Check if Clerk is configured
const isClerkConfigured = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default async function VisualResearchPage() {
  let userId: string | null = null;
  
  // Only try to get auth if Clerk is configured
  if (isClerkConfigured) {
    try {
      const { auth } = await import('@clerk/nextjs/server');
      const authResult = await auth();
      userId = authResult.userId;
    } catch {
      // Clerk not configured or error, continue without auth
    }
  }
  
  return <VisualResearchContent userId={userId || undefined} />;
}
