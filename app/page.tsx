import { Chat } from './chat';
import { MainHeader } from '@/components/main-header';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { ConversationSidebar } from '@/components/conversation-sidebar';

// Check if Clerk is configured
const isClerkConfigured = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default async function Home() {
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
  
  return (
    <SidebarProvider defaultOpen={true} className="h-full">
      {/* Floating Sidebar */}
      {isClerkConfigured && userId && (
        <ConversationSidebar userId={userId} />
      )}
      
      <SidebarInset className="transition-[margin] duration-300">
        {/* Header with logo */}
        <MainHeader userId={userId} />

        {/* Main content wrapper */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Chat userId={userId || undefined} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
