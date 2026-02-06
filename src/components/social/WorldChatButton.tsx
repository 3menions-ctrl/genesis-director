/**
 * WorldChatButton - Floating button that opens global chat panel
 * Matches the premium dark glass aesthetic of the Projects page
 */

import { useState, useRef, useEffect, memo } from 'react';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useWorldChat, WorldChatMessage } from '@/hooks/useWorldChat';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

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
      "flex gap-2 p-2 rounded-lg transition-colors",
      isOwnMessage ? "bg-primary/10" : "hover:bg-white/[0.02]"
    )}>
      <Avatar className="w-8 h-8 shrink-0">
        <AvatarImage src={message.profile?.avatar_url || undefined} />
        <AvatarFallback className="bg-zinc-800 text-zinc-400 text-xs">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className={cn(
            "font-medium text-sm truncate",
            isOwnMessage ? "text-primary" : "text-white"
          )}>
            {displayName}
          </span>
          <span className="text-[10px] text-zinc-500 shrink-0">
            {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
          </span>
        </div>
        <p className="text-sm text-zinc-300 break-words">{message.content}</p>
      </div>
    </div>
  );
});

export function WorldChatButton() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, isLoading, sendMessage } = useWorldChat();

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
          "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl",
          "bg-gradient-to-br from-primary via-primary/90 to-primary/80",
          "hover:from-primary/90 hover:via-primary/80 hover:to-primary/70",
          "border border-primary/30 backdrop-blur-xl",
          "transition-all duration-300 hover:scale-110",
          isOpen && "rotate-90"
        )}
        size="icon"
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <>
            <MessageCircle className="w-6 h-6" />
            {messages.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-[10px] font-bold flex items-center justify-center animate-pulse">
                {messages.length > 99 ? '99+' : messages.length}
              </span>
            )}
          </>
        )}
      </Button>

      {/* Chat Panel */}
      <div className={cn(
        "fixed bottom-24 right-6 z-50 w-[360px] max-w-[calc(100vw-3rem)]",
        "rounded-2xl overflow-hidden shadow-2xl",
        "bg-zinc-900/95 backdrop-blur-xl border border-white/[0.08]",
        "transition-all duration-300 origin-bottom-right",
        isOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4 pointer-events-none"
      )}>
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/[0.06] bg-gradient-to-r from-primary/10 to-transparent">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="font-semibold text-white">World Chat</h3>
            <span className="text-xs text-zinc-500 ml-auto">
              {messages.length} messages
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">Chat with creators worldwide</p>
        </div>

        {/* Messages */}
        <ScrollArea className="h-[320px]" ref={scrollRef}>
          <div className="p-2 space-y-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-sm">
                No messages yet. Start the conversation!
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
          <div className="p-3 border-t border-white/[0.06] bg-zinc-900/50">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Say something..."
                maxLength={500}
                className="flex-1 bg-zinc-800/50 border-white/10 focus:border-primary/50"
              />
              <Button
                onClick={handleSend}
                disabled={!inputValue.trim() || sendMessage.isPending}
                size="icon"
                className="bg-primary hover:bg-primary/90"
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
          <div className="p-3 border-t border-white/[0.06] text-center text-sm text-zinc-500">
            Sign in to join the conversation
          </div>
        )}
      </div>
    </>
  );
}
