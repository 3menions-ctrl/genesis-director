/**
 * WorldChat - Premium full-page chat experience
 * Features: replies, message deletion, scroll-to-bottom, character count, timestamps
 */

import { useRef, useEffect, useState, memo, useCallback } from 'react';
import { MessageCircle, Send, Loader2, Reply, Trash2, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useWorldChat, WorldChatMessage } from '@/hooks/useWorldChat';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { AppHeader } from '@/components/layout/AppHeader';
import ClipsBackground from '@/components/clips/ClipsBackground';

const MAX_LENGTH = 500;

const ChatMessage = memo(function ChatMessage({
  message,
  isOwnMessage,
  onReply,
  onDelete,
  replyTarget,
  messages,
}: {
  message: WorldChatMessage;
  isOwnMessage: boolean;
  onReply: (msg: WorldChatMessage) => void;
  onDelete: (id: string) => void;
  replyTarget?: WorldChatMessage | null;
  messages: WorldChatMessage[];
}) {
  const displayName = message.profile?.display_name || 'Anonymous';
  const initials = displayName.slice(0, 2).toUpperCase();
  const [showActions, setShowActions] = useState(false);

  const repliedMessage = message.reply_to_id
    ? messages.find(m => m.id === message.reply_to_id)
    : null;

  return (
    <div
      className={cn(
        "group relative flex gap-3 px-4 sm:px-5 py-2.5 transition-colors duration-200 max-w-2xl mx-auto w-full rounded-lg",
        isOwnMessage
          ? "bg-white/[0.04]"
          : "hover:bg-white/[0.02]"
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <Avatar className="w-8 h-8 shrink-0 ring-1 ring-white/[0.08] mt-0.5">
        <AvatarImage src={message.profile?.avatar_url || undefined} />
        <AvatarFallback className="bg-white/[0.06] text-white/60 text-[10px] font-medium">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0 space-y-1">
        {/* Reply context */}
        {repliedMessage && (
          <div className="flex items-center gap-1.5 text-[11px] text-white/30 pl-1 border-l-2 border-white/[0.08] ml-0.5">
            <Reply className="w-3 h-3 rotate-180 shrink-0" />
            <span className="truncate">
              <span className="text-white/40 font-medium">
                {repliedMessage.profile?.display_name || 'Anonymous'}
              </span>
              {' '}{repliedMessage.content.slice(0, 60)}{repliedMessage.content.length > 60 ? '…' : ''}
            </span>
          </div>
        )}

        <div className="flex items-baseline gap-2">
          <span className="font-medium text-[13px] text-white/80 truncate">
            {displayName}
          </span>
          <span className="text-[10px] text-white/20 shrink-0 tabular-nums">
            {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
          </span>
        </div>
        <p className="text-[13px] leading-relaxed text-white/55 break-words whitespace-pre-wrap">
          {message.content}
        </p>
      </div>

      {/* Hover actions */}
      <div className={cn(
        "absolute right-3 top-2 flex items-center gap-0.5 transition-opacity duration-150",
        showActions ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        <button
          onClick={() => onReply(message)}
          className="w-7 h-7 rounded-md flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
          title="Reply"
        >
          <Reply className="w-3.5 h-3.5" />
        </button>
        {isOwnMessage && (
          <button
            onClick={() => onDelete(message.id)}
            className="w-7 h-7 rounded-md flex items-center justify-center text-white/30 hover:text-red-400/80 hover:bg-red-500/[0.08] transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
});

export default function WorldChat() {
  const { user } = useAuth();
  const [inputValue, setInputValue] = useState('');
  const [replyTo, setReplyTo] = useState<WorldChatMessage | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  const { messages, isLoading, sendMessage, deleteMessage } = useWorldChat();

  // Track scroll position
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    isNearBottomRef.current = distanceFromBottom < 100;
    setShowScrollBtn(distanceFromBottom > 200);
  }, []);

  // Auto-scroll on new messages if near bottom
  useEffect(() => {
    if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleSend = async () => {
    if (!inputValue.trim() || sendMessage.isPending) return;
    try {
      await sendMessage.mutateAsync({
        content: inputValue.trim(),
        replyToId: replyTo?.id,
      });
      setInputValue('');
      setReplyTo(null);
      // Scroll to bottom after sending
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
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

  const handleReply = useCallback((msg: WorldChatMessage) => {
    setReplyTo(msg);
    inputRef.current?.focus();
  }, []);

  const handleDelete = useCallback((id: string) => {
    deleteMessage.mutate(id);
  }, [deleteMessage]);

  const charCount = inputValue.length;

  return (
    <div className="min-h-screen flex flex-col relative bg-[#030303]">
      <ClipsBackground />
      <AppHeader />

      <div className="flex-1 flex flex-col relative z-10 min-h-0">
        {/* Subtle top bar with stats */}
        <div className="px-4 sm:px-6 py-3 border-b border-white/[0.04] animate-fade-in">
          <div className="max-w-2xl mx-auto w-full flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-400/80 animate-pulse" />
              <span className="text-[11px] text-white/30 uppercase tracking-[0.15em] font-medium">
                Live Chat
              </span>
              <span className="text-[11px] text-white/15">·</span>
              <span className="text-[11px] text-white/25 tabular-nums">
                {messages.length} messages
              </span>
            </div>
          </div>
        </div>

        {/* Messages area */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto overscroll-contain px-2 sm:px-4 scrollbar-hide"
        >
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-white/15" />
              <span className="text-[11px] text-white/25 tracking-wide">Loading messages…</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                <MessageCircle className="w-7 h-7 text-white/10" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-white/40 text-sm font-medium">No messages yet</p>
                <p className="text-white/15 text-xs">Be the first to say something</p>
              </div>
            </div>
          ) : (
            <div className="py-3 space-y-0.5">
              {messages.map(msg => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  isOwnMessage={msg.user_id === user?.id}
                  onReply={handleReply}
                  onDelete={handleDelete}
                  replyTarget={replyTo}
                  messages={messages}
                />
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Scroll to bottom FAB */}
        {showScrollBtn && (
          <button
            onClick={scrollToBottom}
            className={cn(
              "absolute bottom-28 left-1/2 -translate-x-1/2 z-20",
              "w-9 h-9 rounded-full",
              "bg-white/[0.08] border border-white/[0.1] backdrop-blur-xl",
              "flex items-center justify-center",
              "text-white/50 hover:text-white/80 hover:bg-white/[0.12]",
              "transition-all duration-200",
              "shadow-[0_4px_20px_rgba(0,0,0,0.4)]",
              "animate-fade-in"
            )}
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        )}

        {/* Input bar */}
        {user ? (
          <div className="sticky bottom-0 px-3 sm:px-4 py-3 border-t border-white/[0.04] bg-[#030303]/90 backdrop-blur-xl">
            {/* Reply preview */}
            {replyTo && (
              <div className="max-w-2xl mx-auto mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                <Reply className="w-3.5 h-3.5 text-white/30 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] text-white/40 font-medium">
                    {replyTo.profile?.display_name || 'Anonymous'}
                  </span>
                  <p className="text-[11px] text-white/25 truncate">{replyTo.content}</p>
                </div>
                <button
                  onClick={() => setReplyTo(null)}
                  className="w-6 h-6 rounded flex items-center justify-center text-white/25 hover:text-white/50 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="max-w-2xl mx-auto flex gap-2 items-end">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value.slice(0, MAX_LENGTH))}
                  onKeyDown={handleKeyDown}
                  placeholder="Message…"
                  rows={1}
                  className={cn(
                    "w-full resize-none min-h-[44px] max-h-[120px] py-3 px-4",
                    "bg-white/[0.04] hover:bg-white/[0.05]",
                    "border border-white/[0.08] focus:border-white/[0.15] focus:outline-none",
                    "text-white/90 placeholder:text-white/20",
                    "rounded-xl text-[13px] leading-relaxed",
                    "transition-colors duration-200",
                    "scrollbar-hide"
                  )}
                  style={{
                    height: 'auto',
                    minHeight: '44px',
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                  }}
                />
                {charCount > MAX_LENGTH * 0.8 && (
                  <span className={cn(
                    "absolute bottom-1.5 right-3 text-[10px] tabular-nums",
                    charCount >= MAX_LENGTH ? "text-red-400/60" : "text-white/15"
                  )}>
                    {charCount}/{MAX_LENGTH}
                  </span>
                )}
              </div>
              <Button
                onClick={handleSend}
                disabled={!inputValue.trim() || sendMessage.isPending}
                size="icon"
                className={cn(
                  "h-11 w-11 rounded-xl shrink-0",
                  "bg-white/[0.06] hover:bg-white/[0.1]",
                  "text-white/50 hover:text-white/90",
                  "border border-white/[0.06]",
                  "disabled:opacity-15",
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
          <div className="sticky bottom-0 px-4 py-4 border-t border-white/[0.04] bg-[#030303]/90 backdrop-blur-xl">
            <div className="max-w-2xl mx-auto text-center py-3 px-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <p className="text-white/40 text-sm">Sign in to join the conversation</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
