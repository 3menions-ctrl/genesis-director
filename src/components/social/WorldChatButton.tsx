/**
 * WorldChatButton - Floating button that opens a full-height slide-in chat panel
 * Ultra-minimal dark aesthetic
 */

import { useState, useRef, useEffect, memo } from 'react';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useWorldChat, WorldChatMessage } from '@/hooks/useWorldChat';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

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
      "flex gap-3 px-5 py-3 transition-colors duration-200",
      isOwnMessage 
        ? "bg-white/[0.03]" 
        : "hover:bg-white/[0.02]"
    )}>
      <Avatar className="w-8 h-8 shrink-0 ring-1 ring-white/[0.08]">
        <AvatarImage src={message.profile?.avatar_url || undefined} />
        <AvatarFallback className="bg-white/[0.06] text-white/60 text-[10px] font-medium">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-white/80 truncate">
            {displayName}
          </span>
          <span className="text-[10px] text-white/25 shrink-0">
            {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-white/60 break-words">
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

  const isHidden = HIDDEN_ROUTES.includes(location.pathname);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (isHidden || !user) return null;

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
      {/* Floating trigger */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full",
          "bg-white/[0.06] border border-white/[0.1]",
          "backdrop-blur-xl",
          "flex items-center justify-center",
          "hover:bg-white/[0.1] hover:border-white/[0.15]",
          "transition-all duration-300",
          "shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
          isOpen && "opacity-0 pointer-events-none"
        )}
      >
        <MessageCircle className="w-5 h-5 text-white/70" />
      </button>

      {/* Backdrop */}
      <div
        onClick={() => setIsOpen(false)}
        className={cn(
          "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      />

      {/* Slide-in panel */}
      <div className={cn(
        "fixed top-0 right-0 bottom-0 z-50 w-[400px] max-w-[85vw]",
        "bg-[#0a0a0a] border-l border-white/[0.06]",
        "flex flex-col",
        "transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div>
            <h2 className="text-base font-semibold text-white tracking-tight">World Chat</h2>
            <p className="text-[11px] text-white/30 mt-0.5">
              {messages.length} messages
            </p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-white/20" />
              <span className="text-xs text-white/30">Loading…</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-8">
              <MessageCircle className="w-8 h-8 text-white/10" />
              <p className="text-white/40 text-sm font-medium">No messages yet</p>
              <p className="text-white/20 text-xs text-center">Start the conversation</p>
            </div>
          ) : (
            <div className="py-2">
              {messages.map(msg => (
                <ChatMessage 
                  key={msg.id} 
                  message={msg} 
                  isOwnMessage={msg.user_id === user?.id}
                />
              ))}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-white/[0.06]">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message…"
              maxLength={500}
              className={cn(
                "flex-1 h-10",
                "bg-white/[0.04] hover:bg-white/[0.06]",
                "border-white/[0.08] focus:border-white/[0.15]",
                "text-white/90 placeholder:text-white/25",
                "rounded-lg text-sm",
                "transition-colors duration-200"
              )}
            />
            <Button
              onClick={handleSend}
              disabled={!inputValue.trim() || sendMessage.isPending}
              size="icon"
              className={cn(
                "h-10 w-10 rounded-lg shrink-0",
                "bg-white/[0.08] hover:bg-white/[0.12]",
                "text-white/60 hover:text-white/90",
                "border border-white/[0.08]",
                "disabled:opacity-20",
                "transition-all duration-200"
              )}
              variant="ghost"
            >
              {sendMessage.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
