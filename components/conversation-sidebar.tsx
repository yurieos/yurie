'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  MessageSquare, 
  Plus, 
  Trash2, 
  Clock,
  X
} from 'lucide-react';
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
  const { setOpenMobile, isMobile } = useSidebar();
  const { user } = useUser();
  const userButtonRef = useRef<HTMLDivElement>(null);

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
      
      <SidebarContent className="px-2 overflow-y-auto">
        <SidebarGroup>
          <SidebarGroupContent className="py-2">
            <Button
              onClick={handleNewChat}
              className="w-full justify-start gap-3 h-12 bg-sidebar-primary hover:bg-sidebar-primary/90 text-sidebar-primary-foreground rounded-xl shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
            >
              <Plus className="h-5 w-5" />
              <span className="font-medium">New Chat</span>
            </Button>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="flex-1">
          <SidebarGroupLabel className="px-3 text-xs uppercase tracking-wider text-sidebar-foreground/50">
            Recent
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {isLoading ? (
                <div className="space-y-2 px-1">
                  {[1, 2, 3].map((i) => (
                    <div 
                      key={i} 
                      className="h-16 rounded-xl bg-sidebar-accent/50 animate-pulse"
                    />
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-sidebar-accent/50 flex items-center justify-center mb-4">
                    <MessageSquare className="h-8 w-8 text-sidebar-foreground/30" />
                  </div>
                  <p className="text-sm font-medium text-sidebar-foreground/70">No conversations yet</p>
                  <p className="text-xs text-sidebar-foreground/50 mt-1">
                    Start a new chat to begin
                  </p>
                </div>
              ) : (
                conversations.map((conversation) => (
                  <SidebarMenuItem key={conversation.id}>
                    <SidebarMenuButton
                      onClick={() => handleLoadConversation(conversation.id)}
                      className="group/item h-auto py-3 px-3 rounded-xl hover:bg-sidebar-accent/80 active:scale-[0.98] transition-all duration-200"
                      tooltip={conversation.title}
                    >
                      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-sidebar-primary/10 flex items-center justify-center group-hover/item:bg-sidebar-primary/20 transition-colors">
                        <MessageSquare className="h-5 w-5 text-sidebar-primary group-hover/item:scale-110 transition-transform" />
                      </div>
                      <div className="flex-1 min-w-0 ml-1">
                        <p className="text-sm font-medium text-sidebar-foreground truncate pr-2">
                          {conversation.title}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Clock className="h-3 w-3 text-sidebar-foreground/40" />
                          <span className="text-xs text-sidebar-foreground/50">
                            {formatDate(conversation.updatedAt)}
                          </span>
                          <span className="text-xs text-sidebar-foreground/40">
                            · {conversation.messageCount} msgs
                          </span>
                        </div>
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
                        className="flex-shrink-0 p-2 rounded-lg opacity-100 md:opacity-0 group-hover/item:opacity-100 hover:bg-destructive/10 active:bg-destructive/20 text-sidebar-foreground/40 hover:text-destructive transition-all cursor-pointer touch-manipulation"
                        aria-label="Delete conversation"
                      >
                        <Trash2 className="h-4 w-4" />
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
