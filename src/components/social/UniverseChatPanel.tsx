import { useState, useRef, useEffect } from 'react';
import { Send, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { useUniverseChat, UniverseMessage } from '@/hooks/useSocial';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface ChatMessageProps {
  message: UniverseMessage;
  isOwn: boolean;
}

function ChatMessage({ message, isOwn }: ChatMessageProps) {
  return (
    <div className={cn(
      "flex gap-2 mb-3",
      isOwn ? "flex-row-reverse" : "flex-row"
    )}>
      <Avatar className="h-7 w-7 flex-shrink-0">
        <AvatarImage src={message.profiles?.avatar_url || undefined} />
        <AvatarFallback className="text-xs">
          {(message.profiles?.display_name || 'U').charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      
      <div className={cn(
        "max-w-[75%] px-3 py-2 rounded-2xl",
        isOwn 
          ? "bg-primary text-primary-foreground rounded-br-sm" 
          : "bg-muted rounded-bl-sm"
      )}>
        {!isOwn && (
          <p className="text-xs font-medium mb-0.5 opacity-70">
            {message.profiles?.display_name || 'Anonymous'}
          </p>
        )}
        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        <p className={cn(
          "text-xs mt-1",
          isOwn ? "text-primary-foreground/60" : "text-muted-foreground"
        )}>
          {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}

interface UniverseChatPanelProps {
  universeId: string;
  universeName?: string;
  className?: string;
}

export function UniverseChatPanel({ universeId, universeName, className }: UniverseChatPanelProps) {
  const { user } = useAuth();
  const { messages, isLoading, sendMessage } = useUniverseChat(universeId);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || isSending) return;
    
    setIsSending(true);
    try {
      await sendMessage.mutateAsync({ content: newMessage.trim() });
      setNewMessage('');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card className={cn("flex flex-col overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b">
        <Users className="w-5 h-5 text-muted-foreground" />
        <h3 className="font-semibold truncate">
          {universeName ? `${universeName} Chat` : 'Universe Chat'}
        </h3>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Loading messages...
          </div>
        ) : messages && messages.length > 0 ? (
          <div>
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                isOwn={message.user_id === user?.id}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No messages yet</p>
            <p className="text-xs">Start the conversation!</p>
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1"
            disabled={isSending}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!newMessage.trim() || isSending}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
