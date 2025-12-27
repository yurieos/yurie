'use client';

import { SignedIn, SignedOut, SignInButton } from '@clerk/nextjs';
import { SidebarTrigger } from '@/components/ui/sidebar';

interface AuthHeaderProps {
  userId: string | null;
  position: 'left' | 'right';
}

// Check if Clerk is configured (client-side)
const isClerkConfigured = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export function AuthHeader({ userId, position }: AuthHeaderProps) {
  // If Clerk is not configured, don't render auth components
  if (!isClerkConfigured) {
    // Still show sidebar trigger on the left even without auth
    if (position === 'left') {
      return null; // Will be handled at the layout level
    }
    return null;
  }

  if (position === 'left') {
    return (
      <SignedIn>
        <SidebarTrigger className="text-muted-foreground hover:text-foreground active:scale-95 transition-transform touch-manipulation" />
      </SignedIn>
    );
  }

  // When signed in, the UserButton is shown in the sidebar
  // Only show Sign In button when signed out
  return (
    <SignedOut>
      <SignInButton mode="modal">
        <button className="px-4 py-2 text-sm font-medium text-foreground bg-primary hover:bg-primary/90 active:scale-95 rounded-full transition-all cursor-pointer touch-manipulation">
          Sign in
        </button>
      </SignInButton>
    </SignedOut>
  );
}
