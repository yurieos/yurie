'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { ModeToggle } from '@/components/mode-toggle';
import { AuthHeader } from '@/components/auth-header';
import { useSidebar } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';

interface MainHeaderProps {
  userId: string | null;
}

export function MainHeader({ userId }: MainHeaderProps) {
  const { open } = useSidebar();
  const router = useRouter();
  const [hasMessages, setHasMessages] = useState(false);
  const [isVisualMode, setIsVisualMode] = useState(false);

  // Listen for message changes to know if user is in a conversation
  useEffect(() => {
    const handleMessagesChange = (e: CustomEvent) => {
      setHasMessages(e.detail?.hasMessages ?? false);
      setIsVisualMode(e.detail?.isVisualMode ?? false);
    };

    window.addEventListener('messagesChanged', handleMessagesChange as EventListener);
    return () => {
      window.removeEventListener('messagesChanged', handleMessagesChange as EventListener);
    };
  }, []);

  const handleNewChat = () => {
    if (isVisualMode) {
      // Redirect to visual research page for new visual chat
      router.push('/visual-research');
    } else {
      window.dispatchEvent(new CustomEvent('newChat'));
    }
  };

  // Show new chat button when: sidebar is closed AND user has messages (in a conversation)
  const showNewChatButton = !open && hasMessages && userId;

  return (
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
            <span className="text-lg font-semibold tracking-tight text-foreground">
              <span className="text-primary">
                Yurie
              </span>
            </span>
          </a>
          
          {/* New Chat button - shows when sidebar closed and in conversation */}
          {showNewChatButton && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNewChat}
              className="size-8 text-muted-foreground hover:text-foreground active:scale-95 transition-all cursor-pointer touch-manipulation"
              title="New Chat"
            >
              <Plus className="h-[1.1rem] w-[1.1rem]" />
              <span className="sr-only">New Chat</span>
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <ModeToggle />
          <AuthHeader userId={userId} position="right" />
        </div>
      </div>
    </header>
  );
}

