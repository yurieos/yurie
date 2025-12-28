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
      {/* Floating Sidebar */}
      {isClerkConfigured && userId && (
        <ConversationSidebar userId={userId} />
      )}
      
      <SidebarInset className="transition-[margin] duration-300">
        {/* Header with logo */}
        <header className="h-14 shrink-0 px-4 flex items-center">
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
                  width={28}
                  height={28}
                  className="block dark:hidden"
                  priority
                />
                <Image
                  src="/yurielight.png"
                  alt="Yurie logo"
                  width={28}
                  height={28}
                  className="hidden dark:block"
                  priority
                />
                <span className="text-lg font-semibold tracking-tight text-foreground lowercase">
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
