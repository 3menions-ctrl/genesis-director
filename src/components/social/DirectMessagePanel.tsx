/**
 * DirectMessagePanel - User-to-user messaging interface
 * Accessible from user profiles, matching the glass aesthetic
 */

import { useState, useRef, useEffect, memo } from 'react';
import { X, Send, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useDirectMessages, DirectMessage } from '@/hooks/useSocial';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface DirectMessagePanelProps {
  recipientId: string;
  recipientName?: string;
  recipientAvatar?: string;
  onClose: () => void;
  className?: string;
}

const MessageBubble = memo(function MessageBubble({
  message,
  isOwn,
}: {
  message: DirectMessage;
  isOwn: boolean;
}) {
  return (
    <div className={cn(
      "flex",
      isOwn ? "justify-end" : "justify-start"
    )}>
      <div className={cn(
        "max-w-[80%] px-3 py-2 rounded-2xl",
        isOwn
          ? "bg-primary text-primary-foreground rounded-br-sm"
          : "bg-zinc-800 text-zinc-100 rounded-bl-sm"
      )}>
        <p className="text-sm break-words">{message.content}</p>
        <span className={cn(
          "text-[10px] mt-1 block",
          isOwn ? "text-primary-foreground/70" : "text-zinc-500"
        )}>
          {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
        </span>
      </div>
    </div>
  );
});

export function DirectMessagePanel({
  recipientId,
  recipientName,
  recipientAvatar,
  onClose,
  className,
}: DirectMessagePanelProps) {
  const { user } = useAuth();
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, messagesLoading, sendMessage } = useDirectMessages(recipientId);

  // Fetch recipient profile if not provided
  const { data: recipientProfile } = useQuery({
    queryKey: ['user-profile', recipientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('id', recipientId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !recipientName && !!recipientId,
  });

  const displayName = recipientName || recipientProfile?.display_name || 'User';
  const avatarUrl = recipientAvatar || recipientProfile?.avatar_url;
  const initials = displayName.slice(0, 2).toUpperCase();

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages?.length]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async () => {
    if (!inputValue.trim() || sendMessage.isPending) return;

    try {
      await sendMessage.mutateAsync({
        recipientId,
        content: inputValue.trim(),
      });
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
    <div className={cn(
      "flex flex-col h-full bg-zinc-900/95 backdrop-blur-xl rounded-2xl",
      "border border-white/[0.08] overflow-hidden",
      className
    )}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <Avatar className="w-9 h-9">
          <AvatarImage src={avatarUrl || undefined} />
          <AvatarFallback className="bg-zinc-800 text-zinc-400 text-sm">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate">{displayName}</h3>
          <p className="text-xs text-zinc-500">Direct Message</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-3">
          {messagesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
            </div>
          ) : !messages || messages.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-sm">
              <p>No messages yet.</p>
              <p className="mt-1">Start the conversation!</p>
            </div>
          ) : (
            messages.map(msg => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isOwn={msg.sender_id === user?.id}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t border-white/[0.06]">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            maxLength={1000}
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
    </div>
  );
}

// Button to open DM from user profile
export function MessageUserButton({
  userId,
  userName,
  userAvatar,
  className,
}: {
  userId: string;
  userName?: string;
  userAvatar?: string;
  className?: string;
}) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (!user || user.id === userId) return null;

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        className={cn(
          "border-white/10 hover:bg-white/5",
          className
        )}
      >
        Message
      </Button>

      {/* DM Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md h-[500px]">
            <DirectMessagePanel
              recipientId={userId}
              recipientName={userName}
              recipientAvatar={userAvatar}
              onClose={() => setIsOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
