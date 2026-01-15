import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Mail,
  MessageSquare,
  CheckCircle,
  Clock,
  Trash2,
  RefreshCw,
  Loader2,
  Search,
  Send,
  ExternalLink,
  Inbox,
  Archive,
  AlertCircle,
  User,
  Calendar,
  Globe,
  StickyNote,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';

interface SupportMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  source: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  user_id: string | null;
}

type StatusFilter = 'all' | 'new' | 'in_progress' | 'resolved';

export function AdminMessageCenter() {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<SupportMessage | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMessages((data || []) as SupportMessage[]);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch and real-time subscription
  useEffect(() => {
    fetchMessages();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('support_messages_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_messages' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMessages((prev) => [payload.new as SupportMessage, ...prev]);
            toast.info('New message received!', {
              description: `From: ${(payload.new as SupportMessage).name}`,
            });
          } else if (payload.eventType === 'UPDATE') {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === payload.new.id ? (payload.new as SupportMessage) : msg
              )
            );
            if (selectedMessage?.id === payload.new.id) {
              setSelectedMessage(payload.new as SupportMessage);
            }
          } else if (payload.eventType === 'DELETE') {
            setMessages((prev) => prev.filter((msg) => msg.id !== payload.old.id));
            if (selectedMessage?.id === payload.old.id) {
              setSelectedMessage(null);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMessages, selectedMessage?.id]);

  // Update admin notes when selecting a message
  useEffect(() => {
    setAdminNotes(selectedMessage?.admin_notes || '');
  }, [selectedMessage]);

  const updateMessageStatus = async (messageId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('support_messages')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', messageId);

      if (error) throw error;
      toast.success(`Message marked as ${status.replace('_', ' ')}`);
    } catch (err) {
      console.error('Failed to update message:', err);
      toast.error('Failed to update message status');
    }
  };

  const saveAdminNotes = async () => {
    if (!selectedMessage) return;

    setSavingNotes(true);
    try {
      const { error } = await supabase
        .from('support_messages')
        .update({ admin_notes: adminNotes, updated_at: new Date().toISOString() })
        .eq('id', selectedMessage.id);

      if (error) throw error;
      toast.success('Notes saved');
    } catch (err) {
      console.error('Failed to save notes:', err);
      toast.error('Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  };

  const deleteMessage = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('support_messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;
      toast.success('Message deleted');
      setSelectedMessage(null);
    } catch (err) {
      console.error('Failed to delete message:', err);
      toast.error('Failed to delete message');
    }
  };

  const openEmailClient = (email: string, subject: string) => {
    const mailtoLink = `mailto:${email}?subject=Re: ${encodeURIComponent(subject)}`;
    window.open(mailtoLink, '_blank');
  };

  // Filter and search messages
  const filteredMessages = messages.filter((msg) => {
    const matchesStatus = statusFilter === 'all' || msg.status === statusFilter;
    const matchesSearch =
      searchQuery === '' ||
      msg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      msg.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      msg.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      msg.message.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Count by status
  const statusCounts = {
    all: messages.length,
    new: messages.filter((m) => m.status === 'new').length,
    in_progress: messages.filter((m) => m.status === 'in_progress').length,
    resolved: messages.filter((m) => m.status === 'resolved').length,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-primary text-primary-foreground';
      case 'in_progress':
        return 'bg-warning text-warning-foreground';
      case 'resolved':
        return 'bg-success text-success-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new':
        return <AlertCircle className="w-3 h-3" />;
      case 'in_progress':
        return <Clock className="w-3 h-3" />;
      case 'resolved':
        return <CheckCircle className="w-3 h-3" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Message Center
          </h2>
          <p className="text-sm text-muted-foreground">
            {statusCounts.new > 0 ? (
              <span className="text-primary font-medium">{statusCounts.new} new messages awaiting response</span>
            ) : (
              'All messages have been addressed'
            )}
          </p>
        </div>
        <Button onClick={fetchMessages} variant="outline" size="sm" disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </div>

      {/* Status Tabs */}
      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="all" className="gap-1.5">
            <Inbox className="w-3.5 h-3.5" />
            All
            <Badge variant="secondary" className="ml-1 text-xs h-5 px-1.5">
              {statusCounts.all}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="new" className="gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            New
            {statusCounts.new > 0 && (
              <Badge className="ml-1 text-xs h-5 px-1.5 bg-primary">
                {statusCounts.new}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="in_progress" className="gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            In Progress
            {statusCounts.in_progress > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs h-5 px-1.5">
                {statusCounts.in_progress}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="resolved" className="gap-1.5">
            <Archive className="w-3.5 h-3.5" />
            Resolved
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search messages by name, email, or subject..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-5 gap-4 h-[calc(100vh-360px)] min-h-[500px]">
        {/* Message List */}
        <Card className="lg:col-span-2 flex flex-col overflow-hidden">
          <CardHeader className="py-3 px-4 border-b bg-muted/30 flex-shrink-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {filteredMessages.length} message{filteredMessages.length !== 1 ? 's' : ''}
            </CardTitle>
          </CardHeader>
          <ScrollArea className="flex-1">
            {loading && messages.length === 0 ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                <Mail className="w-10 h-10 mb-2 opacity-40" />
                <p className="text-sm">No messages found</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredMessages.map((msg) => (
                  <button
                    key={msg.id}
                    className={cn(
                      'w-full text-left p-3 hover:bg-muted/50 transition-colors',
                      selectedMessage?.id === msg.id && 'bg-primary/5 border-l-2 border-l-primary',
                      msg.status === 'new' && selectedMessage?.id !== msg.id && 'bg-primary/5'
                    )}
                    onClick={() => setSelectedMessage(msg)}
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium',
                          msg.status === 'new'
                            ? 'bg-primary/20 text-primary'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {msg.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              'font-medium truncate text-sm',
                              msg.status === 'new' ? 'text-foreground' : 'text-muted-foreground'
                            )}
                          >
                            {msg.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">
                            {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p
                          className={cn(
                            'text-sm truncate',
                            msg.status === 'new' ? 'text-foreground font-medium' : 'text-muted-foreground'
                          )}
                        >
                          {msg.subject}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {msg.message.substring(0, 60)}...
                        </p>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <Badge
                            variant="secondary"
                            className={cn('text-[10px] px-1.5 py-0 h-4', getStatusColor(msg.status))}
                          >
                            {getStatusIcon(msg.status)}
                            <span className="ml-1">{msg.status.replace('_', ' ')}</span>
                          </Badge>
                          {msg.admin_notes && (
                            <StickyNote className="w-3 h-3 text-warning" />
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </Card>

        {/* Message Detail */}
        <Card className="lg:col-span-3 flex flex-col overflow-hidden">
          {selectedMessage ? (
            <>
              <CardHeader className="py-3 px-4 border-b bg-muted/30 flex-shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <CardTitle className="text-base font-semibold truncate">
                      {selectedMessage.subject}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      From: {selectedMessage.name}
                    </p>
                  </div>
                  <Badge className={cn('flex-shrink-0', getStatusColor(selectedMessage.status))}>
                    {getStatusIcon(selectedMessage.status)}
                    <span className="ml-1">{selectedMessage.status.replace('_', ' ')}</span>
                  </Badge>
                </div>
              </CardHeader>

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {/* Meta Info */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="w-4 h-4" />
                      <span className="truncate">{selectedMessage.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>{format(new Date(selectedMessage.created_at), 'PPp')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Globe className="w-4 h-4" />
                      <span>Source: {selectedMessage.source}</span>
                    </div>
                    {selectedMessage.user_id && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="w-4 h-4" />
                        <span className="text-xs">Registered User</span>
                      </div>
                    )}
                  </div>

                  {/* Message Content */}
                  <div className="bg-muted/30 rounded-lg p-4">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{selectedMessage.message}</p>
                  </div>

                  {/* Admin Notes */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <StickyNote className="w-4 h-4 text-warning" />
                      Admin Notes
                    </label>
                    <Textarea
                      placeholder="Add internal notes about this message..."
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      rows={3}
                      className="resize-none"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={saveAdminNotes}
                      disabled={savingNotes || adminNotes === (selectedMessage.admin_notes || '')}
                    >
                      {savingNotes ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Save Notes
                    </Button>
                  </div>
                </div>
              </ScrollArea>

              {/* Actions Footer */}
              <div className="p-3 border-t bg-muted/30 flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  onClick={() => openEmailClient(selectedMessage.email, selectedMessage.subject)}
                >
                  <Send className="w-4 h-4 mr-1.5" />
                  Reply via Email
                  <ExternalLink className="w-3 h-3 ml-1.5" />
                </Button>

                {selectedMessage.status === 'new' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateMessageStatus(selectedMessage.id, 'in_progress')}
                  >
                    <Clock className="w-4 h-4 mr-1.5" />
                    Mark In Progress
                  </Button>
                )}

                {selectedMessage.status !== 'resolved' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => updateMessageStatus(selectedMessage.id, 'resolved')}
                  >
                    <CheckCircle className="w-4 h-4 mr-1.5" />
                    Mark Resolved
                  </Button>
                )}

                <div className="flex-1" />

                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => deleteMessage(selectedMessage.id)}
                >
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  Delete
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Mail className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">Select a message to view details</p>
              <p className="text-xs mt-1">Click on any message from the list</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
