/**
 * Premium Chat Page — iMessage-style unified messaging
 * Features: World Chat, Private DMs, Group Chats, User Discovery,
 * Reactions, Typing Indicators, Online Presence, Media Support
 */

import { useRef, useEffect, useState, memo, useCallback } from 'react';
import {
  MessageCircle, Send, Loader2, Reply, Trash2, ChevronDown, X,
  Search, Plus, Users, Globe, ArrowLeft, Smile, Hash,
  Check, CheckCheck, Image as ImageIcon, UserPlus, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
  useConversationsList, useChatMessages, usePresence, useChatActions, useUserSearch,
  ChatConversation, ChatMessage as ChatMessageType,
} from '@/hooks/useChat';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { AppHeader } from '@/components/layout/AppHeader';
import ClipsBackground from '@/components/clips/ClipsBackground';

const MAX_LENGTH = 500;
const QUICK_REACTIONS = ['❤️', '😂', '🔥', '👏', '😮', '💯'];

// ═══════════════════════════════════════
// MESSAGE BUBBLE
// ═══════════════════════════════════════

const MessageBubble = memo(function MessageBubble({
  message, isOwn, onReply, onDelete, onReact,
}: {
  message: ChatMessageType;
  isOwn: boolean;
  onReply: (msg: ChatMessageType) => void;
  onDelete: (id: string) => void;
  onReact: (msgId: string, emoji: string) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const displayName = message.profile?.display_name || 'Anonymous';
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div
      className={cn(
        "group relative flex gap-2.5 px-4 py-1.5 transition-colors duration-150",
        isOwn ? "flex-row-reverse" : "",
        showActions && "bg-white/[0.02]"
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowReactions(false); }}
    >
      {!isOwn && (
        <Avatar className="w-7 h-7 shrink-0 ring-1 ring-white/[0.06] mt-1">
          <AvatarImage src={message.profile?.avatar_url || undefined} />
          <AvatarFallback className="bg-primary/20 text-primary text-[9px] font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
      )}

      <div className={cn("max-w-[75%] min-w-0", isOwn ? "items-end" : "items-start")}>
        {/* Reply context */}
        {message.reply_to && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1 px-3 py-1 rounded-md bg-white/[0.03] border-l-2 border-primary/30">
            <Reply className="w-2.5 h-2.5 rotate-180 shrink-0" />
            <span className="truncate">
              <span className="font-medium text-foreground/50">
                {message.reply_to.profile?.display_name || 'Someone'}
              </span>
              {' '}{message.reply_to.content.slice(0, 50)}
            </span>
          </div>
        )}

        {/* Name + time */}
        {!isOwn && (
          <div className="flex items-center gap-2 mb-0.5 px-1">
            <span className="text-[11px] font-semibold text-foreground/60">{displayName}</span>
            <span className="text-[9px] text-muted-foreground/50 tabular-nums">
              {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
            </span>
          </div>
        )}

        {/* Bubble */}
        <div className={cn(
          "relative px-3.5 py-2 rounded-2xl text-[13px] leading-relaxed break-words whitespace-pre-wrap",
          isOwn
            ? "bg-primary/90 text-primary-foreground rounded-br-md"
            : "bg-secondary/80 text-secondary-foreground rounded-bl-md"
        )}>
          {message.content}
          {isOwn && (
            <span className="text-[9px] text-primary-foreground/40 tabular-nums ml-2 inline-block">
              {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
            </span>
          )}
        </div>

        {/* Media */}
        {message.media_url && (
          <div className="mt-1 rounded-xl overflow-hidden max-w-[280px]">
            <img src={message.media_url} alt="" className="w-full object-cover rounded-xl" />
          </div>
        )}

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1 px-1">
            {message.reactions.map(r => (
              <button
                key={r.emoji}
                onClick={() => onReact(message.id, r.emoji)}
                className={cn(
                  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] transition-colors",
                  r.reacted_by_me
                    ? "bg-primary/20 border border-primary/30"
                    : "bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08]"
                )}
              >
                <span>{r.emoji}</span>
                <span className="text-foreground/50 tabular-nums">{r.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hover actions */}
      {showActions && (
        <div className={cn(
          "absolute top-0 flex items-center gap-0.5 bg-card/95 backdrop-blur-sm border border-border/50 rounded-lg px-1 py-0.5 shadow-lg z-10",
          isOwn ? "left-4" : "right-4"
        )}>
          <button
            onClick={() => setShowReactions(!showReactions)}
            className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors"
          >
            <Smile className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onReply(message)}
            className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors"
          >
            <Reply className="w-3.5 h-3.5" />
          </button>
          {isOwn && (
            <button
              onClick={() => onDelete(message.id)}
              className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Quick reaction picker */}
      {showReactions && (
        <div className={cn(
          "absolute top-8 flex items-center gap-0.5 bg-card border border-border rounded-xl px-2 py-1.5 shadow-xl z-20",
          isOwn ? "left-4" : "right-4"
        )}>
          {QUICK_REACTIONS.map(emoji => (
            <button
              key={emoji}
              onClick={() => { onReact(message.id, emoji); setShowReactions(false); }}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/[0.08] hover:scale-125 transition-all text-sm"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

// ═══════════════════════════════════════
// CONVERSATION LIST ITEM
// ═══════════════════════════════════════

const ConversationItem = memo(function ConversationItem({
  conversation, isActive, onClick,
}: {
  conversation: ChatConversation;
  isActive: boolean;
  onClick: () => void;
}) {
  const name = conversation.type === 'dm'
    ? conversation.other_user?.display_name || 'Unknown'
    : conversation.type === 'world'
      ? '🌍 World Chat'
      : conversation.name || 'Group';

  const avatar = conversation.type === 'dm'
    ? conversation.other_user?.avatar_url
    : conversation.avatar_url;

  const initials = name.slice(0, 2).toUpperCase();

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 text-left",
        isActive
          ? "bg-primary/15 border border-primary/20"
          : "hover:bg-white/[0.04] border border-transparent"
      )}
    >
      <div className="relative">
        <Avatar className="w-10 h-10 ring-1 ring-white/[0.06]">
          <AvatarImage src={avatar || undefined} />
          <AvatarFallback className={cn(
            "text-[11px] font-semibold",
            conversation.type === 'world' ? "bg-accent/20 text-accent" :
            conversation.type === 'group' ? "bg-secondary text-secondary-foreground" :
            "bg-primary/20 text-primary"
          )}>
            {conversation.type === 'world' ? '🌍' : conversation.type === 'group' ? <Users className="w-4 h-4" /> : initials}
          </AvatarFallback>
        </Avatar>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className={cn(
            "text-[13px] font-medium truncate",
            (conversation.unread_count || 0) > 0 ? "text-foreground" : "text-foreground/70"
          )}>
            {name}
          </span>
          {conversation.last_message_at && (
            <span className="text-[10px] text-muted-foreground/50 tabular-nums shrink-0 ml-2">
              {formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: false })}
            </span>
          )}
        </div>
        {conversation.last_message_preview && (
          <p className="text-[11px] text-muted-foreground/60 truncate mt-0.5">
            {conversation.last_message_preview}
          </p>
        )}
      </div>

      {(conversation.unread_count || 0) > 0 && (
        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
          <span className="text-[10px] font-bold text-primary-foreground">{conversation.unread_count}</span>
        </div>
      )}
    </button>
  );
});

// ═══════════════════════════════════════
// USER SEARCH PANEL
// ═══════════════════════════════════════

function UserSearchPanel({ onSelect, onClose }: {
  onSelect: (userId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const { data: users, isLoading } = useUserSearch(query);

  return (
    <div className="absolute inset-0 bg-background/98 backdrop-blur-xl z-30 flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
        <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/[0.06] text-muted-foreground">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search users..."
            className="pl-9 bg-white/[0.04] border-white/[0.08] h-9 text-[13px]"
            autoFocus
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : !users?.length && query.length >= 2 ? (
          <div className="text-center py-8 text-muted-foreground/50 text-sm">No users found</div>
        ) : (
          <div className="space-y-0.5">
            {(users || []).map(u => (
              <button
                key={u.id}
                onClick={() => onSelect(u.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-colors"
              >
                <Avatar className="w-9 h-9 ring-1 ring-white/[0.06]">
                  <AvatarImage src={u.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/20 text-primary text-[10px] font-semibold">
                    {(u.display_name || '?').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <span className="text-[13px] font-medium text-foreground/80">
                    {u.display_name || 'Anonymous'}
                  </span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// CREATE GROUP PANEL
// ═══════════════════════════════════════

function CreateGroupPanel({ onCreated, onClose }: {
  onCreated: (convId: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Array<{ id: string; name: string }>>([]);
  const { data: users } = useUserSearch(searchQuery);
  const { createGroup } = useChatActions();

  const handleCreate = async () => {
    if (!name.trim() || selectedUsers.length === 0) return;
    try {
      const convId = await createGroup.mutateAsync({
        name: name.trim(),
        memberIds: selectedUsers.map(u => u.id),
      });
      onCreated(convId);
    } catch (e) {
      console.error('Failed to create group:', e);
    }
  };

  return (
    <div className="absolute inset-0 bg-background/98 backdrop-blur-xl z-30 flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
        <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/[0.06] text-muted-foreground">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-medium text-foreground/80">New Group</span>
        <div className="flex-1" />
        <Button
          size="sm"
          disabled={!name.trim() || selectedUsers.length === 0 || createGroup.isPending}
          onClick={handleCreate}
          className="h-7 text-xs px-3"
        >
          Create
        </Button>
      </div>

      <div className="p-4 space-y-3">
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Group name..."
          className="bg-white/[0.04] border-white/[0.08] h-9 text-[13px]"
          autoFocus
        />

        {selectedUsers.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedUsers.map(u => (
              <span
                key={u.id}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/15 text-primary text-[11px] font-medium"
              >
                {u.name}
                <button onClick={() => setSelectedUsers(s => s.filter(su => su.id !== u.id))}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Add members..."
            className="pl-9 bg-white/[0.04] border-white/[0.08] h-9 text-[13px]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {(users || [])
          .filter(u => !selectedUsers.find(s => s.id === u.id))
          .map(u => (
            <button
              key={u.id}
              onClick={() => setSelectedUsers(s => [...s, { id: u.id, name: u.display_name || 'Anonymous' }])}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/[0.04] transition-colors"
            >
              <Avatar className="w-8 h-8 ring-1 ring-white/[0.06]">
                <AvatarImage src={u.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/20 text-primary text-[9px] font-semibold">
                  {(u.display_name || '?').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-[13px] text-foreground/70">{u.display_name || 'Anonymous'}</span>
              <UserPlus className="ml-auto w-3.5 h-3.5 text-muted-foreground/30" />
            </button>
          ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// MAIN CHAT PAGE
// ═══════════════════════════════════════

export default function WorldChat() {
  const { user } = useAuth();
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessageType | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  const { conversations, isLoading: convsLoading } = useConversationsList();
  const { messages, isLoading: msgsLoading, sendMessage, deleteMessage, toggleReaction } = useChatMessages(activeConversation);
  const { onlineUsers, typingUsers, setTyping } = usePresence(activeConversation);
  const { startDM, joinWorldChat, WORLD_CHAT_ID } = useChatActions();

  // Auto-join world chat on first load
  useEffect(() => {
    if (user && !convsLoading) {
      const hasWorldChat = conversations.some(c => c.id === WORLD_CHAT_ID);
      if (!hasWorldChat) {
        joinWorldChat.mutateAsync().then(() => {
          setActiveConversation(WORLD_CHAT_ID);
        });
      } else if (!activeConversation) {
        setActiveConversation(WORLD_CHAT_ID);
      }
    }
  }, [user, convsLoading, conversations.length]);

  // Scroll handling
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const dist = scrollHeight - scrollTop - clientHeight;
    isNearBottomRef.current = dist < 100;
    setShowScrollBtn(dist > 200);
  }, []);

  useEffect(() => {
    if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

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
      setTyping(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      console.error('Failed to send:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (val: string) => {
    setInputValue(val.slice(0, MAX_LENGTH));
    setTyping(val.length > 0);
  };

  const handleStartDM = async (userId: string) => {
    try {
      const convId = await startDM.mutateAsync(userId);
      setActiveConversation(convId);
      setShowUserSearch(false);
      setShowSidebar(false);
    } catch (e) {
      console.error('Failed to start DM:', e);
    }
  };

  const activeConv = conversations.find(c => c.id === activeConversation);
  const activeName = activeConv?.type === 'dm'
    ? activeConv.other_user?.display_name || 'Chat'
    : activeConv?.type === 'world'
      ? '🌍 World Chat'
      : activeConv?.name || 'Chat';

  const charCount = inputValue.length;

  return (
    <div className="min-h-screen flex flex-col relative bg-background">
      <ClipsBackground />
      <AppHeader />

      <div className="flex-1 flex relative z-10 min-h-0 overflow-hidden">
        {/* ═══ SIDEBAR ═══ */}
        <div className={cn(
          "w-full sm:w-80 shrink-0 flex flex-col border-r border-border/30 bg-background/80 backdrop-blur-xl transition-all duration-300",
          !showSidebar && "hidden sm:flex",
          showSidebar && activeConversation && "sm:flex"
        )}>
          {/* Sidebar header */}
          <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground/80">Messages</h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowUserSearch(true)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/[0.06] text-muted-foreground transition-colors"
                title="New message"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowCreateGroup(true)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/[0.06] text-muted-foreground transition-colors"
                title="New group"
              >
                <Users className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Conversations */}
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5 scrollbar-hide">
            {convsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-border/50 flex items-center justify-center mx-auto">
                  <MessageCircle className="w-5 h-5 text-muted-foreground/30" />
                </div>
                <p className="text-sm text-muted-foreground/50">No conversations yet</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => setShowUserSearch(true)}
                >
                  <Plus className="w-3 h-3 mr-1" /> Start a chat
                </Button>
              </div>
            ) : (
              conversations.map(conv => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isActive={conv.id === activeConversation}
                  onClick={() => {
                    setActiveConversation(conv.id);
                    setShowSidebar(false);
                  }}
                />
              ))
            )}
          </div>

          {/* Overlays */}
          {showUserSearch && (
            <UserSearchPanel
              onSelect={handleStartDM}
              onClose={() => setShowUserSearch(false)}
            />
          )}
          {showCreateGroup && (
            <CreateGroupPanel
              onCreated={(id) => { setActiveConversation(id); setShowCreateGroup(false); setShowSidebar(false); }}
              onClose={() => setShowCreateGroup(false)}
            />
          )}
        </div>

        {/* ═══ CHAT AREA ═══ */}
        <div className={cn(
          "flex-1 flex flex-col min-w-0",
          showSidebar && !activeConversation && "hidden sm:flex"
        )}>
          {activeConversation ? (
            <>
              {/* Chat header */}
              <div className="px-4 py-2.5 border-b border-border/30 flex items-center gap-3 bg-background/60 backdrop-blur-xl">
                <button
                  onClick={() => setShowSidebar(true)}
                  className="sm:hidden w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/[0.06] text-muted-foreground"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground/80 truncate">{activeName}</h3>
                  <div className="flex items-center gap-2">
                    {typingUsers.length > 0 ? (
                      <span className="text-[10px] text-accent animate-pulse">typing…</span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/40">
                        {onlineUsers.length > 0 ? `${onlineUsers.length} online` : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto scrollbar-hide"
              >
                {msgsLoading ? (
                  <div className="flex flex-col items-center justify-center h-64 gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/30" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-border/50 flex items-center justify-center">
                      <MessageCircle className="w-6 h-6 text-muted-foreground/20" />
                    </div>
                    <p className="text-muted-foreground/40 text-sm">Start the conversation</p>
                  </div>
                ) : (
                  <div className="py-3 space-y-0.5">
                    {messages.map(msg => (
                      <MessageBubble
                        key={msg.id}
                        message={msg}
                        isOwn={msg.user_id === user?.id}
                        onReply={(m) => { setReplyTo(m); inputRef.current?.focus(); }}
                        onDelete={(id) => deleteMessage.mutate(id)}
                        onReact={(msgId, emoji) => toggleReaction.mutate({ messageId: msgId, emoji })}
                      />
                    ))}
                    <div ref={bottomRef} />
                  </div>
                )}
              </div>

              {/* Scroll to bottom */}
              {showScrollBtn && (
                <button
                  onClick={scrollToBottom}
                  className="absolute bottom-24 right-6 w-9 h-9 rounded-full bg-card/90 border border-border/50 backdrop-blur-xl flex items-center justify-center text-muted-foreground hover:text-foreground shadow-lg transition-all z-20"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              )}

              {/* Input */}
              {user && (
                <div className="px-3 py-2.5 border-t border-border/30 bg-background/80 backdrop-blur-xl">
                  {replyTo && (
                    <div className="flex items-center gap-2 px-3 py-1.5 mb-2 rounded-lg bg-white/[0.03] border border-border/50">
                      <Reply className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="text-[11px] text-muted-foreground truncate flex-1">
                        Replying to <span className="font-medium text-foreground/50">{replyTo.profile?.display_name || 'Someone'}</span>
                      </span>
                      <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  <div className="flex gap-2 items-end">
                    <div className="flex-1 relative">
                      <textarea
                        ref={inputRef}
                        value={inputValue}
                        onChange={(e) => handleInputChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Message…"
                        rows={1}
                        className={cn(
                          "w-full resize-none min-h-[40px] max-h-[120px] py-2.5 px-4",
                          "bg-secondary/50 hover:bg-secondary/70",
                          "border border-border/50 focus:border-primary/40 focus:outline-none",
                          "text-foreground placeholder:text-muted-foreground/40",
                          "rounded-xl text-[13px] leading-relaxed transition-colors scrollbar-hide"
                        )}
                        style={{ height: 'auto', minHeight: '40px' }}
                        onInput={(e) => {
                          const t = e.target as HTMLTextAreaElement;
                          t.style.height = 'auto';
                          t.style.height = Math.min(t.scrollHeight, 120) + 'px';
                        }}
                      />
                      {charCount > MAX_LENGTH * 0.8 && (
                        <span className={cn(
                          "absolute bottom-1 right-3 text-[9px] tabular-nums",
                          charCount >= MAX_LENGTH ? "text-destructive/60" : "text-muted-foreground/30"
                        )}>
                          {charCount}/{MAX_LENGTH}
                        </span>
                      )}
                    </div>
                    <Button
                      onClick={handleSend}
                      disabled={!inputValue.trim() || sendMessage.isPending}
                      size="icon"
                      className="h-10 w-10 rounded-xl shrink-0 bg-primary/90 hover:bg-primary text-primary-foreground disabled:opacity-20"
                    >
                      {sendMessage.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Empty state - no conversation selected (desktop) */
            <div className="hidden sm:flex flex-1 items-center justify-center">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-white/[0.03] border border-border/30 flex items-center justify-center mx-auto">
                  <MessageCircle className="w-7 h-7 text-muted-foreground/20" />
                </div>
                <div className="space-y-1">
                  <p className="text-foreground/50 text-sm font-medium">Select a conversation</p>
                  <p className="text-muted-foreground/30 text-xs">Or start a new one</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
