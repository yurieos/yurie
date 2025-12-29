'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { VisualResearchChat } from '@/components/visual-research/visual-research-chat';
import { ModeToggle } from '@/components/mode-toggle';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function VisualResearchPage() {
  const [hasMessages, setHasMessages] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header - matches main app header */}
      <header className="h-14 shrink-0 px-4 flex items-center border-b border-border/50">
        <div className="flex-1 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-foreground active:scale-95 transition-all cursor-pointer touch-manipulation"
              asChild
            >
              <Link href="/">
                <ArrowLeft className="h-[1.1rem] w-[1.1rem]" />
                <span className="sr-only">Back</span>
              </Link>
            </Button>
            <div className="h-4 w-px bg-border" />
            <Link href="/" className="flex items-center gap-1.5">
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
                Visual
              </span>
            </Link>
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
        <VisualResearchChat onMessagesChange={setHasMessages} />
      </div>
    </div>
  );
}
