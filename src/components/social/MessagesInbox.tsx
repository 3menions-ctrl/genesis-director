/**
 * MessagesInbox - Displays user's DM conversations
 * Premium dark glass aesthetic matching Projects page
 */

import { useState, memo } from 'react';
import { MessageCircle, Search, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DirectMessagePanel } from './DirectMessagePanel';
import { useConversations } from '@/hooks/useConversations';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

// Container-less now — the inbox is just typography on the canvas
// like every other Account surface. Kept as an empty string in case
// any consumer still references it via the export.
const glassCard = "";

interface Conversation {
  recipientId: string;
  recipientName: string;
  recipientAvatar: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

const ConversationItem = memo(function ConversationItem({
  conversation,
  isActive,
  onClick,
}: {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}) {
  const initials = (conversation.recipientName || 'U').slice(0, 2).toUpperCase();

  return (
    <button
      onClick={onClick}
      className={cn(
        "group/conv relative w-full flex items-center gap-3 px-2 py-3 transition-colors duration-200",
        "hover:bg-white/[0.02] rounded-lg",
        isActive && "bg-white/[0.03]"
      )}
    >
      <Avatar className="w-11 h-11 ring-2 ring-white/10 shrink-0">
        <AvatarImage src={conversation.recipientAvatar || undefined} />
        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-purple-600/20 text-white text-sm">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-white truncate">
            {conversation.recipientName}
          </span>
          <span className="text-[11px] text-white/40 shrink-0">
            {formatDistanceToNow(new Date(conversation.lastMessageAt), { addSuffix: false })}
          </span>
        </div>
        <p className="text-sm text-white/50 truncate">{conversation.lastMessage}</p>
      </div>
      {conversation.unreadCount > 0 && (
        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-[11px] font-bold flex items-center justify-center text-white">
          {conversation.unreadCount}
        </span>
      )}
    </button>
  );
});

export function MessagesInbox({ className }: { className?: string }) {
  const { conversations, isLoading } = useConversations();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);

  const filteredConversations = (conversations || []).filter(c =>
    c.recipientName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (activeConversation) {
    return (
      <div className={cn("h-[500px]", className)}>
        <DirectMessagePanel
          recipientId={activeConversation.recipientId}
          recipientName={activeConversation.recipientName}
          recipientAvatar={activeConversation.recipientAvatar || undefined}
          onClose={() => setActiveConversation(null)}
        />
      </div>
    );
  }

  void glassCard;
  return (
    <div className={cn("", className)}>
      {/* Search bar floats — no header card, no icon backdrop */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search conversations…"
          className={cn(
            "pl-10 h-10",
            "bg-white/[0.02] hover:bg-white/[0.04]",
            "border-white/[0.06] focus:border-accent/50",
            "text-foreground placeholder:text-muted-foreground/50",
            "rounded-xl"
          )}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/55 hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Conversations list — no container, just rows */}
      <ScrollArea className="h-[420px]">
        <div className="space-y-0.5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-accent/65" />
              <span className="text-sm text-muted-foreground/55">Loading conversations…</span>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="py-14 text-center">
              <MessageCircle className="w-7 h-7 mx-auto text-muted-foreground/45" strokeWidth={1.4} />
              {searchQuery ? (
                <>
                  <p
                    className="mt-5 font-display italic text-[20px] font-light text-foreground/85"
                    style={{ fontFamily: "'Fraunces', serif" }}
                  >
                    No matches.
                  </p>
                  <p className="text-muted-foreground/55 text-[13px] mt-1">Try a different name.</p>
                </>
              ) : (
                <>
                  <p
                    className="mt-5 font-display italic text-[20px] font-light text-foreground/85"
                    style={{ fontFamily: "'Fraunces', serif" }}
                  >
                    No messages yet.
                  </p>
                  <p className="text-muted-foreground/55 text-[13px] mt-1 max-w-sm mx-auto">
                    Visit a creator&rsquo;s profile to start a conversation.
                  </p>
                </>
              )}
            </div>
          ) : (
            filteredConversations.map(conv => (
              <ConversationItem
                key={conv.recipientId}
                conversation={conv}
                isActive={false}
                onClick={() => setActiveConversation(conv)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
