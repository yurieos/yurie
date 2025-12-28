'use client';

import { useState, useEffect } from 'react';
import { SignedIn, SignedOut, SignInButton } from '@clerk/nextjs';
import { SidebarTrigger } from '@/components/ui/sidebar';

interface AuthHeaderProps {
  userId: string | null;
  position: 'left' | 'right';
}

// Check if Clerk is configured (client-side)
const isClerkConfigured = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export function AuthHeader({ userId, position }: AuthHeaderProps) {
  // Use mounted state to avoid hydration mismatch with Clerk's auth-dependent components
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // If Clerk is not configured, don't render auth components
  if (!isClerkConfigured) {
    // Still show sidebar trigger on the left even without auth
    if (position === 'left') {
      return null; // Will be handled at the layout level
    }
    return null;
  }

  // Render a placeholder with same dimensions during SSR to prevent layout shift
  // This ensures consistent rendering between server and client
  if (!mounted) {
    if (position === 'left') {
      if (!userId) return null;
      // Return invisible placeholder matching SidebarTrigger dimensions
      return <div className="size-8" aria-hidden="true" />;
    }
    // Return invisible placeholder matching Sign In button dimensions
    return <div className="h-9 w-[72px]" aria-hidden="true" />;
  }

  if (position === 'left') {
    return (
      <SignedIn>
        <SidebarTrigger className="link-muted interactive" />
      </SignedIn>
    );
  }

  // When signed in, the UserButton is shown in the sidebar
  // Only show Sign In button when signed out
  return (
    <SignedOut>
      <SignInButton mode="modal">
        <button className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-full transition-all interactive">
          Sign in
        </button>
      </SignInButton>
    </SignedOut>
  );
}
