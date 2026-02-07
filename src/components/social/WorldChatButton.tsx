/**
 * WorldChatButton - Floating button that opens global chat panel
 * Premium dark glass aesthetic matching the Projects page
 * Hidden on landing and auth pages
 */

import { useState, useRef, useEffect, memo } from 'react';
import { MessageCircle, X, Send, Loader2, Globe, Sparkles } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useWorldChat, WorldChatMessage } from '@/hooks/useWorldChat';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

// Routes where World Chat should be hidden
const HIDDEN_ROUTES = ['/', '/auth', '/auth/callback', '/forgot-password', '/reset-password', '/onboarding'];
const ChatMessage = memo(function ChatMessage({ 
  message, 
  isOwnMessage 
}: { 
  message: WorldChatMessage; 
  isOwnMessage: boolean;
}) {
  const displayName = message.profile?.display_name || 'Anonymous';
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className={cn(
      "group flex gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
      isOwnMessage 
        ? "bg-gradient-to-r from-primary/20 to-primary/10 ml-4" 
        : "hover:bg-white/[0.04] mr-4"
    )}>
      <Avatar className="w-9 h-9 shrink-0 ring-2 ring-white/10">
        <AvatarImage src={message.profile?.avatar_url || undefined} />
        <AvatarFallback className="bg-gradient-to-br from-primary/30 to-purple-600/30 text-white text-xs font-medium">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className={cn(
            "font-semibold text-sm truncate",
            isOwnMessage ? "text-primary" : "text-white"
          )}>
            {displayName}
          </span>
          <span className="text-[11px] text-white/40 shrink-0">
            {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
          </span>
        </div>
        <p className="text-[14px] leading-relaxed text-white/90 break-words">
          {message.content}
        </p>
      </div>
    </div>
  );
});

export function WorldChatButton() {
  const { user } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, isLoading, sendMessage } = useWorldChat();

  // Hide on certain routes
  const isHidden = HIDDEN_ROUTES.includes(location.pathname);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Early return after all hooks - only show for authenticated users on allowed routes
  if (isHidden || !user) {
    return null;
  }

  const handleSend = async () => {
    if (!inputValue.trim() || sendMessage.isPending) return;

    try {
      await sendMessage.mutateAsync({ content: inputValue.trim() });
      setInputValue('');
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full",
          "bg-gradient-to-br from-primary via-primary to-purple-600",
          "shadow-[0_8px_32px_rgba(139,92,246,0.4)]",
          "hover:shadow-[0_12px_40px_rgba(139,92,246,0.5)]",
          "border border-white/20",
          "transition-all duration-300 hover:scale-105",
          isOpen && "rotate-180 bg-gradient-to-br from-zinc-700 to-zinc-800 shadow-xl"
        )}
        size="icon"
      >
        {isOpen ? (
          <X className="w-5 h-5 text-white" />
        ) : (
          <div className="relative">
            <MessageCircle className="w-6 h-6 text-white" />
            {messages.length > 0 && (
              <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-r from-red-500 to-orange-500 text-[10px] font-bold flex items-center justify-center text-white shadow-lg">
                {messages.length > 99 ? '99+' : messages.length}
              </span>
            )}
          </div>
        )}
      </Button>

      {/* Chat Panel */}
      <div className={cn(
        "fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-3rem)]",
        "rounded-2xl overflow-hidden",
        "bg-gradient-to-b from-zinc-900/98 to-black/98",
        "backdrop-blur-2xl",
        "border border-white/[0.12]",
        "shadow-[0_24px_80px_-12px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.05)]",
        "transition-all duration-300 origin-bottom-right",
        isOpen 
          ? "opacity-100 scale-100 translate-y-0" 
          : "opacity-0 scale-95 translate-y-4 pointer-events-none"
      )}>
        {/* Header */}
        <div className="relative px-5 py-4 border-b border-white/[0.08] overflow-hidden">
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary/15 via-purple-600/10 to-transparent" />
          
          <div className="relative flex items-center gap-3">
            <div className="relative">
              <Globe className="w-5 h-5 text-primary" />
              <Sparkles className="w-3 h-3 text-yellow-400 absolute -top-1 -right-1" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-white text-base">World Chat</h3>
              <p className="text-xs text-white/50">Chat with creators worldwide</p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/[0.08]">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
              <span className="text-xs text-white/60 font-medium">
                {messages.length}
              </span>
            </div>
            {/* Close Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="h-8 w-8 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white/60 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="h-[360px]" ref={scrollRef}>
          <div className="py-3 space-y-1">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary/60" />
                <span className="text-sm text-white/40">Loading messages...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 px-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-600/20 flex items-center justify-center">
                  <MessageCircle className="w-8 h-8 text-primary/60" />
                </div>
                <p className="text-white/70 font-medium">No messages yet</p>
                <p className="text-white/40 text-sm text-center">Be the first to start the conversation!</p>
              </div>
            ) : (
              messages.map(msg => (
                <ChatMessage 
                  key={msg.id} 
                  message={msg} 
                  isOwnMessage={msg.user_id === user?.id}
                />
              ))
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        {user ? (
          <div className="p-4 border-t border-white/[0.08] bg-gradient-to-t from-black/40 to-transparent">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                maxLength={500}
                className={cn(
                  "flex-1 h-11",
                  "bg-white/[0.06] hover:bg-white/[0.08]",
                  "border-white/[0.1] focus:border-primary/50",
                  "text-white placeholder:text-white/40",
                  "rounded-xl",
                  "transition-colors duration-200"
                )}
              />
              <Button
                onClick={handleSend}
                disabled={!inputValue.trim() || sendMessage.isPending}
                size="icon"
                className={cn(
                  "h-11 w-11 rounded-xl shrink-0",
                  "bg-gradient-to-r from-primary to-purple-600",
                  "hover:from-primary/90 hover:to-purple-600/90",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                  "shadow-lg shadow-primary/25",
                  "transition-all duration-200"
                )}
              >
                {sendMessage.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-4 border-t border-white/[0.08] bg-gradient-to-t from-black/40 to-transparent">
            <div className="text-center py-2 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08]">
              <p className="text-white/60 text-sm">Sign in to join the conversation</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
