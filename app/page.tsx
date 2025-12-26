import { Chat } from './chat';
import { ModeToggle } from '@/components/mode-toggle';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header with logo */}
      <header className="px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <a
            href="/"
            className="flex items-center gap-2"
          >
            <span className="text-xl font-bold tracking-tight text-foreground font-space lowercase">
              <span className="text-primary">
                yurie
              </span>
            </span>
          </a>
          <ModeToggle />
        </div>
      </header>

      {/* Main content wrapper */}
      <div className="flex-1 flex flex-col">
        <Chat />
      </div>

    </div>
  );
}
