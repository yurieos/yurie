'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  CaretRight,
  ChatTeardropText,
  ClockCounterClockwise,
  Plus, 
  Trash, 
  SignOut,
  Gear
} from '@phosphor-icons/react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupContent,
  useSidebar,
} from '@/components/ui/sidebar';
import { Conversation } from '@/lib/chat-history';
import { useUser, useClerk, SignOutButton } from '@clerk/nextjs';
import Image from 'next/image';

interface ConversationSidebarProps {
  userId: string;
}

export function ConversationSidebar({ userId }: ConversationSidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(true);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const { setOpenMobile, isMobile } = useSidebar();
  const { user } = useUser();
  const { openUserProfile } = useClerk();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Avoid hydration mismatch with Clerk components
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };

    if (profileDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [profileDropdownOpen]);

  const handleProfileClick = () => {
    setProfileDropdownOpen(!profileDropdownOpen);
  };

  const handleManageAccount = () => {
    setProfileDropdownOpen(false);
    openUserProfile();
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

  return (
    <Sidebar variant="floating">
      <SidebarHeader className="shrink-0 p-0 flex flex-col">
        {/* Profile section with dropdown */}
        <div className="relative px-2 pt-0.5 pb-2 md:py-2" ref={dropdownRef}>
          <div className="flex-1 flex items-center justify-between w-full">
            {mounted ? (
              <div 
                onClick={handleProfileClick}
                className="flex items-center gap-2 px-2 py-1.5 w-full cursor-pointer rounded-lg transition-all duration-200 hover:bg-sidebar-accent"
              >
                <div className="relative flex-shrink-0 flex items-center justify-center">
                  {user?.imageUrl ? (
                    <Image 
                      src={user.imageUrl}
                      alt="Profile"
                      width={24}
                      height={24}
                      className="w-6 h-6 rounded-full"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-sidebar-accent flex items-center justify-center">
                      <span className="text-[10px] font-medium text-sidebar-foreground/60">
                        {(user?.firstName?.[0] || user?.username?.[0] || 'U').toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <span className="text-sm font-medium text-sidebar-foreground truncate flex-1">
                  {user?.firstName || user?.username || 'User'}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-2.5 py-3 w-full">
                <div className="w-8 h-8 flex-shrink-0 rounded-full bg-sidebar-accent animate-pulse" />
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="h-3 w-16 rounded bg-sidebar-accent animate-pulse" />
                  <div className="h-2 w-24 rounded bg-sidebar-accent/60 animate-pulse" />
                </div>
              </div>
            )}
          </div>

          {/* Custom Dropdown Menu */}
          {profileDropdownOpen && mounted && (
            <div className="absolute top-full left-0 right-0 mt-1 mx-2 bg-background border border-sidebar-border rounded-xl shadow-2xl overflow-hidden z-50 animate-fade-in">
              {/* Manage Account */}
              <button
                onClick={handleManageAccount}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-sidebar-accent transition-all duration-200 group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-sidebar-accent group-hover:bg-sidebar-accent/80 flex items-center justify-center transition-colors">
                  <Gear className="h-4 w-4 text-sidebar-foreground/60 group-hover:text-sidebar-foreground transition-colors" weight="bold" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-sidebar-foreground">Manage account</span>
                  <span className="text-[11px] text-sidebar-foreground/60">Profile, security & more</span>
                </div>
              </button>

              {/* Divider */}
              <div className="h-px bg-sidebar-border mx-3" />

              {/* Sign Out */}
              <SignOutButton redirectUrl="/">
                <button
                  onClick={() => setProfileDropdownOpen(false)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-sidebar-accent transition-all duration-200 group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-sidebar-accent group-hover:bg-destructive/20 flex items-center justify-center transition-colors">
                    <SignOut className="h-4 w-4 text-sidebar-foreground/60 group-hover:text-destructive transition-colors" weight="bold" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-sidebar-foreground group-hover:text-destructive transition-colors">Sign out</span>
                    <span className="text-[11px] text-sidebar-foreground/60">Log out of your account</span>
                  </div>
                </button>
              </SignOutButton>
            </div>
          )}
        </div>
      </SidebarHeader>
      
      <SidebarContent className="px-1 overflow-y-auto">
        <SidebarGroup className="pb-0 pt-3">
          <SidebarGroupContent className="py-0">
            <button
              onClick={handleNewChat}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200
                text-sidebar-foreground bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" weight="bold" />
              <span className="text-sm font-medium">New Chat</span>
            </button>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="flex-1 relative pt-2">
          <button
            onClick={() => setHistoryExpanded(!historyExpanded)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-all duration-200
              text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent active:scale-[0.98]"
          >
            <ClockCounterClockwise className="h-4 w-4" weight="bold" />
            <span className="text-xs uppercase tracking-wider font-medium">History</span>
            <div className="ml-auto flex items-center gap-2">
              {conversations.length > 0 && (
                <span className="text-[10px] bg-sidebar-accent/50 px-1.5 py-0.5 rounded-full">
                  {conversations.length}
                </span>
              )}
              <CaretRight 
                className={`h-3 w-3 transition-transform duration-200 ${historyExpanded ? 'rotate-90' : ''}`} 
                weight="bold"
              />
            </div>
          </button>
          <SidebarGroupContent className={`overflow-hidden transition-all duration-300 ease-out ${historyExpanded ? 'max-h-[2000px] opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
            <div className="relative">
              <SidebarMenu>
                {isLoading ? (
                  <div className="space-y-1.5 px-1">
                    {[1, 2, 3].map((i) => (
                      <div 
                        key={i} 
                        className="h-9 rounded-lg bg-sidebar-accent/30 animate-pulse"
                      />
                    ))}
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="text-center py-8 px-4">
                    <div className="w-12 h-12 mx-auto rounded-xl bg-sidebar-accent/40 flex items-center justify-center mb-3">
                      <ChatTeardropText className="h-6 w-6 text-sidebar-foreground/30" />
                    </div>
                    <p className="text-[13px] text-sidebar-foreground/60">No conversations yet</p>
                    <p className="text-xs text-sidebar-foreground/40 mt-1">
                      Start a new chat to begin
                    </p>
                  </div>
                ) : (
                  conversations.map((conversation) => (
                    <SidebarMenuItem key={conversation.id} className="relative group/item">
                      <SidebarMenuButton
                        onClick={() => handleLoadConversation(conversation.id)}
                        className="h-auto py-2 px-3 rounded-lg hover:bg-sidebar-accent active:scale-[0.98] transition-all duration-200"
                        tooltip={conversation.title}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-sidebar-foreground truncate pr-1">
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
                          className="flex-shrink-0 p-1.5 -mr-1 rounded-md opacity-100 md:opacity-0 group-hover/item:opacity-100 hover:bg-destructive/10 active:bg-destructive/20 text-sidebar-foreground/40 hover:text-destructive transition-all cursor-pointer touch-manipulation"
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
