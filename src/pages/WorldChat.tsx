/**
 * WorldChat - Dedicated full-page chat experience
 * Ultra-minimal dark aesthetic matching the platform design
 */

import { useRef, useEffect, useState, memo } from 'react';
import { MessageCircle, Send, Loader2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useWorldChat, WorldChatMessage } from '@/hooks/useWorldChat';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { AppHeader } from '@/components/layout/AppHeader';
import ClipsBackground from '@/components/clips/ClipsBackground';

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
      "flex gap-3 px-5 py-3 transition-colors duration-200 max-w-2xl mx-auto w-full",
      isOwnMessage 
        ? "bg-white/[0.03] rounded-xl" 
        : "hover:bg-white/[0.02] rounded-xl"
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

export default function WorldChat() {
  const { user } = useAuth();
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, isLoading, sendMessage } = useWorldChat();

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
    <div className="min-h-screen flex flex-col relative">
      <ClipsBackground />
      <AppHeader />

      <div className="flex-1 flex flex-col relative z-10">
        {/* Page header */}
        <div className="px-6 pt-6 pb-4 animate-fade-in">
          <div className="max-w-2xl mx-auto w-full">
            <p className="text-[10px] sm:text-xs font-medium uppercase tracking-[0.2em] text-white/30 mb-1.5">
              Community
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              World Chat
            </h1>
            <div className="mt-3 flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-white/25 text-xs uppercase tracking-wider">Live</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/80 font-semibold tabular-nums">{messages.length}</span>
                <span className="text-white/25 text-xs uppercase tracking-wider">Messages</span>
              </div>
            </div>
            <div className="mt-4 h-px bg-white/[0.06]" />
          </div>
        </div>

        {/* Messages area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-white/20" />
              <span className="text-xs text-white/30">Loading messages…</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <MessageCircle className="w-8 h-8 text-white/10" />
              <p className="text-white/40 text-sm font-medium">No messages yet</p>
              <p className="text-white/20 text-xs text-center">Start the conversation</p>
            </div>
          ) : (
            <div className="py-2 space-y-1">
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

        {/* Input bar */}
        {user ? (
          <div className="sticky bottom-0 px-4 py-4 border-t border-white/[0.06] bg-[#030303]/80 backdrop-blur-xl">
            <div className="max-w-2xl mx-auto flex gap-2">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message…"
                maxLength={500}
                className={cn(
                  "flex-1 h-11",
                  "bg-white/[0.04] hover:bg-white/[0.06]",
                  "border-white/[0.08] focus:border-white/[0.15]",
                  "text-white/90 placeholder:text-white/25",
                  "rounded-xl text-sm",
                  "transition-colors duration-200"
                )}
              />
              <Button
                onClick={handleSend}
                disabled={!inputValue.trim() || sendMessage.isPending}
                size="icon"
                className={cn(
                  "h-11 w-11 rounded-xl shrink-0",
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
        ) : (
          <div className="sticky bottom-0 px-4 py-4 border-t border-white/[0.06] bg-[#030303]/80 backdrop-blur-xl">
            <div className="max-w-2xl mx-auto text-center py-2 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08]">
              <p className="text-white/60 text-sm">Sign in to join the conversation</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
