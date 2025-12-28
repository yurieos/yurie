'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  CaretRight,
  ChatTeardropText,
  ClockCounterClockwise,
  Plus, 
  Trash, 
  X
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Conversation } from '@/lib/chat-history';
import { UserButton, useUser } from '@clerk/nextjs';

interface ConversationSidebarProps {
  userId: string;
}

export function ConversationSidebar({ userId }: ConversationSidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(true);
  const { setOpenMobile, isMobile } = useSidebar();
  const { user } = useUser();
  const userButtonRef = useRef<HTMLDivElement>(null);

  // Avoid hydration mismatch with Clerk components
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleUserButtonClick = () => {
    // Find the button inside the Clerk UserButton and click it
    const button = userButtonRef.current?.querySelector('button');
    if (button) {
      button.click();
    }
  };

  const loadConversations = useCallback(async () => {
    if (!userId) return;
    
    try {
      const response = await fetch(`/api/conversations?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Listen for conversation updates
  useEffect(() => {
    const handleConversationUpdate = () => {
      loadConversations();
    };

    window.addEventListener('conversationUpdated', handleConversationUpdate);
    return () => {
      window.removeEventListener('conversationUpdated', handleConversationUpdate);
    };
  }, [loadConversations]);

  const handleNewChat = () => {
    // Dispatch event to clear current chat
    window.dispatchEvent(new CustomEvent('newChat'));
    if (isMobile) setOpenMobile(false);
  };

  const handleLoadConversation = (conversationId: string) => {
    // Dispatch event to load this conversation
    window.dispatchEvent(new CustomEvent('loadConversation', { 
      detail: { conversationId } 
    }));
    if (isMobile) setOpenMobile(false);
  };

  const handleDeleteConversation = async (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    
    try {
      const response = await fetch(`/api/conversations?userId=${userId}&conversationId=${conversationId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setConversations(prev => prev.filter(c => c.id !== conversationId));
        // If this was the current conversation, start a new chat
        window.dispatchEvent(new CustomEvent('conversationDeleted', { 
          detail: { conversationId } 
        }));
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <Sidebar variant="inset">
      <SidebarHeader className="h-16 shrink-0 px-4 flex flex-row items-center border-b border-sidebar-border/50">
        <div className="flex-1 flex items-center justify-between">
          {mounted ? (
            <div 
              onClick={handleUserButtonClick}
              className="flex items-center gap-3 p-1.5 -ml-1.5 rounded-lg hover:bg-sidebar-accent/50 transition-colors group cursor-pointer"
            >
              <div className="relative" ref={userButtonRef} onClick={(e) => e.stopPropagation()}>
                <UserButton 
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      avatarBox: "w-8 h-8 rounded-full ring-2 ring-transparent group-hover:ring-sidebar-primary/20 transition-all",
                      userButtonTrigger: "focus:shadow-none focus:ring-0 focus:outline-none p-0",
                    }
                  }}
                />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium text-sidebar-foreground truncate group-hover:text-sidebar-accent-foreground transition-colors">
                  {user?.firstName || user?.username || 'User'}
                </span>
                <span className="text-xs text-sidebar-foreground/50 truncate group-hover:text-sidebar-foreground/70 transition-colors">
                  {user?.primaryEmailAddress?.emailAddress || ''}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-1.5 -ml-1.5">
              <div className="w-8 h-8 rounded-full bg-sidebar-accent/50 animate-pulse" />
              <div className="flex flex-col gap-1.5 min-w-0">
                <div className="h-4 w-20 rounded bg-sidebar-accent/50 animate-pulse" />
                <div className="h-3 w-28 rounded bg-sidebar-accent/30 animate-pulse" />
              </div>
            </div>
          )}
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent active:scale-95 transition-all"
              onClick={() => setOpenMobile(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </SidebarHeader>
      
      <SidebarContent className="px-0 overflow-y-auto">
        <SidebarGroup>
          <SidebarGroupContent className="py-2">
            <button
              onClick={handleNewChat}
              className="group w-full flex items-center gap-2.5 h-9 px-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 shadow-sm hover:shadow transition-all duration-200 cursor-pointer"
            >
              <div className="flex items-center justify-center w-5 h-5 rounded bg-zinc-200 dark:bg-zinc-700 group-hover:bg-zinc-300 dark:group-hover:bg-zinc-600 transition-colors">
                <Plus className="h-3.5 w-3.5" />
              </div>
              <span className="font-medium text-[13px]">New Chat</span>
            </button>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="flex-1 relative">
          <button
            onClick={() => setHistoryExpanded(!historyExpanded)}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs uppercase tracking-wider text-sidebar-foreground/50 hover:text-sidebar-foreground/70 hover:bg-sidebar-accent/60 rounded-full transition-all cursor-pointer"
          >
            <ClockCounterClockwise className="h-3.5 w-3.5 relative z-10" weight="bold" />
            <span>History</span>
            <div className="ml-auto flex items-center gap-1.5">
              {conversations.length > 0 && (
                <span className="text-[10px] text-sidebar-foreground/40">
                  {conversations.length}
                </span>
              )}
              <CaretRight 
                className={`h-3 w-3 transition-transform duration-200 ${historyExpanded ? 'rotate-90' : ''}`} 
                weight="bold"
              />
            </div>
          </button>
          <SidebarGroupContent className={`overflow-hidden transition-all duration-200 ${historyExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="relative">
              {/* Vertical timeline line */}
              {conversations.length > 0 && !isLoading && (
                <div 
                  className="absolute left-[17px] top-0 bottom-0 w-px bg-gradient-to-b from-sidebar-border/70 via-sidebar-border/50 to-sidebar-border/30"
                  aria-hidden="true"
                />
              )}
              <SidebarMenu>
                {isLoading ? (
                  <div className="space-y-2 px-1 pl-8">
                    {[1, 2, 3].map((i) => (
                      <div 
                        key={i} 
                        className="h-8 rounded-lg bg-sidebar-accent/50 animate-pulse"
                      />
                    ))}
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="text-center py-8 px-4">
                    <div className="w-12 h-12 mx-auto rounded-xl bg-sidebar-accent/50 flex items-center justify-center mb-3">
                      <ChatTeardropText className="h-6 w-6 text-sidebar-foreground/30" />
                    </div>
                    <p className="text-[13px] text-sidebar-foreground/70">No conversations yet</p>
                    <p className="text-xs text-sidebar-foreground/50 mt-0.5">
                      Start a new chat to begin
                    </p>
                  </div>
                ) : (
                  conversations.map((conversation, index) => (
                    <SidebarMenuItem key={conversation.id} className="relative group/item">
                      {/* Small dot on the timeline */}
                      <div 
                        className="absolute left-[15px] top-1/2 -translate-y-1/2 w-[5px] h-[5px] rounded-full bg-sidebar-border/70 transition-all duration-200 group-hover/item:bg-sidebar-foreground/50 group-hover/item:scale-110"
                        aria-hidden="true"
                      />
                      <SidebarMenuButton
                        onClick={() => handleLoadConversation(conversation.id)}
                        className="h-auto py-2 px-2 pl-8 rounded-full hover:bg-sidebar-accent/60 active:scale-[0.98] transition-all duration-200"
                        tooltip={conversation.title}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-sidebar-foreground truncate pr-1">
                            {conversation.title}
                          </p>
                        </div>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={(e) => handleDeleteConversation(e, conversation.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleDeleteConversation(e as unknown as React.MouseEvent, conversation.id);
                            }
                          }}
                          className="flex-shrink-0 p-1.5 rounded-full opacity-100 md:opacity-0 group-hover/item:opacity-100 hover:bg-destructive/10 active:bg-destructive/20 text-sidebar-foreground/40 hover:text-destructive transition-all cursor-pointer touch-manipulation"
                          aria-label="Delete conversation"
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </div>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))
                )}
              </SidebarMenu>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
