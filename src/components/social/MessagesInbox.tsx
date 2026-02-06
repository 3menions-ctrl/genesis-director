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

const glassCard = "backdrop-blur-xl bg-white/[0.02] border border-white/[0.08]";

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
        "w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200",
        "hover:bg-white/[0.06]",
        isActive && "bg-primary/10 border border-primary/20"
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

  return (
    <div className={cn("rounded-2xl overflow-hidden", glassCard, className)}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-purple-600/20 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-white text-lg">Messages</h3>
            <p className="text-xs text-white/50">Your conversations</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className={cn(
              "pl-10 h-10",
              "bg-white/[0.04] hover:bg-white/[0.06]",
              "border-white/[0.08] focus:border-primary/50",
              "text-white placeholder:text-white/40",
              "rounded-xl"
            )}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Conversations List */}
      <ScrollArea className="h-[360px]">
        <div className="p-3 space-y-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary/60" />
              <span className="text-sm text-white/40">Loading conversations...</span>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 px-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-purple-600/10 flex items-center justify-center">
                <MessageCircle className="w-8 h-8 text-white/20" />
              </div>
              {searchQuery ? (
                <>
                  <p className="text-white/70 font-medium">No matches found</p>
                  <p className="text-white/40 text-sm text-center">Try a different search term</p>
                </>
              ) : (
                <>
                  <p className="text-white/70 font-medium">No messages yet</p>
                  <p className="text-white/40 text-sm text-center">
                    Visit a creator's profile to start a conversation
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
