'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronsLeft, Plus } from 'lucide-react';
import { VisualResearchChat } from '@/components/visual-research/visual-research-chat-v2';
import { ModeToggle } from '@/components/mode-toggle';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VisualResearchContentProps {
  userId?: string;
}

export function VisualResearchContent({ userId }: VisualResearchContentProps) {
  const [hasMessages, setHasMessages] = useState(false);

  const handleNewChat = () => {
    window.dispatchEvent(new CustomEvent('newVisualChat'));
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header - matches main app header */}
      <header className="h-14 shrink-0 px-4 flex items-center">
        <div className="flex-1 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-foreground active:scale-95 transition-all cursor-pointer touch-manipulation"
              asChild
            >
              <Link href="/">
                <ChevronsLeft className="h-[1.1rem] w-[1.1rem]" />
                <span className="sr-only">Back</span>
              </Link>
            </Button>
            <Link href="/visual-research" className="flex items-center gap-1.5">
              <Image
                src="/yuriedark.png"
                alt="Yurie logo"
                width={24}
                height={24}
                className="block dark:hidden"
                priority
              />
              <Image
                src="/yurielight.png"
                alt="Yurie logo"
                width={24}
                height={24}
                className="hidden dark:block"
                priority
              />
              <span className="text-base font-semibold text-primary">
                Visual Research
              </span>
            </Link>
            
            {/* New Chat button - shows when in conversation */}
            {hasMessages && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNewChat}
                className="size-8 text-muted-foreground hover:text-foreground active:scale-95 transition-all cursor-pointer touch-manipulation"
                title="New Visual Research"
              >
                <Plus className="h-[1.1rem] w-[1.1rem]" />
                <span className="sr-only">New Visual Research</span>
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-caption bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              Beta
            </span>
            <ModeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className={cn(
        "flex-1 px-4 pt-6 pb-4 overflow-hidden transition-all duration-500",
        !hasMessages && "flex items-center justify-center"
      )}>
        <VisualResearchChat userId={userId} onMessagesChange={setHasMessages} />
      </div>
    </div>
  );
}

