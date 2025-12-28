import Image from 'next/image';
import { Chat } from './chat';
import { ModeToggle } from '@/components/mode-toggle';
import { AuthHeader } from '@/components/auth-header';
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
      {/* Inset Sidebar */}
      {isClerkConfigured && userId && (
        <ConversationSidebar userId={userId} />
      )}
      
      <SidebarInset className="overflow-hidden">
        {/* Header with logo - matches sidebar header height */}
        <header className="h-16 shrink-0 px-4 flex items-center border-b border-border/50">
          <div className="flex-1 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AuthHeader userId={userId} position="left" />
              <a
                href="/"
                className="flex items-center gap-1.5"
              >
                {/* Logo - dark version for light mode, light version for dark mode */}
                <Image
                  src="/yuriedark.png"
                  alt="Yurie logo"
                  width={30}
                  height={30}
                  className="block dark:hidden"
                  priority
                />
                <Image
                  src="/yurielight.png"
                  alt="Yurie logo"
                  width={30}
                  height={30}
                  className="hidden dark:block"
                  priority
                />
                <span className="text-xl font-semibold tracking-tight text-foreground lowercase">
                  <span className="text-primary">
                    yurie
                  </span>
                </span>
              </a>
            </div>
            <div className="flex items-center gap-3">
              <ModeToggle />
              <AuthHeader userId={userId} position="right" />
            </div>
          </div>
        </header>

        {/* Main content wrapper */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Chat userId={userId || undefined} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
