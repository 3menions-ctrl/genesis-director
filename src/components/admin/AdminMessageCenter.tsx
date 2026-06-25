import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusPill, DeckButton } from '@/admin/ui/primitives';
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
import { AdminEmptyState } from '@/refine/components/AdminPageShell';
import { ListPagination, usePagination } from '@/components/ui/list-pagination';

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
  admin_reply?: string | null;
  replied_at?: string | null;
  admin_reply_by?: string | null;
}

type StatusFilter = 'all' | 'new' | 'in_progress' | 'resolved';

export function AdminMessageCenter() {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<SupportMessage | null>(null);
  // Mirror of selectedMessage.id read by the realtime handler. Lets the
  // subscription effect depend only on a stable fetcher, so selecting a
  // different message no longer tears down and rebuilds the channel (which
  // could miss inbound messages during the resubscribe gap).
  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => { selectedIdRef.current = selectedMessage?.id ?? null; }, [selectedMessage?.id]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

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
            if (selectedIdRef.current === payload.new.id) {
              setSelectedMessage(payload.new as SupportMessage);
            }
          } else if (payload.eventType === 'DELETE') {
            setMessages((prev) => prev.filter((msg) => msg.id !== payload.old.id));
            if (selectedIdRef.current === payload.old.id) {
              setSelectedMessage(null);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMessages]);

  // Update admin notes when selecting a message
  useEffect(() => {
    setAdminNotes(selectedMessage?.admin_notes || '');
    setReplyText(selectedMessage?.admin_reply || '');
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

  const sendReply = async () => {
    if (!selectedMessage || !replyText.trim()) return;
    setSendingReply(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('support_messages')
        .update({
          admin_reply: replyText.trim(),
          replied_at: new Date().toISOString(),
          admin_reply_by: user?.id ?? null,
          status: 'resolved',
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedMessage.id);
      if (error) throw error;
      toast.success('Reply sent — visible to user in their Profile');
    } catch (err) {
      console.error('Failed to send reply:', err);
      toast.error('Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  const deleteMessage = async (messageId: string) => {
    // Hard delete — confirm before destroying a support ticket on a single click.
    if (!window.confirm('Permanently delete this support message? This cannot be undone.')) return;
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
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      searchQuery === '' ||
      (msg.name ?? '').toLowerCase().includes(q) ||
      (msg.email ?? '').toLowerCase().includes(q) ||
      (msg.subject ?? '').toLowerCase().includes(q) ||
      (msg.message ?? '').toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });
  const { slice: pagedMessages, page, setPage, totalPages, total, pageSize } = usePagination(filteredMessages, 25);

  // Count by status
  const statusCounts = {
    all: messages.length,
    new: messages.filter((m) => m.status === 'new').length,
    in_progress: messages.filter((m) => m.status === 'in_progress').length,
    resolved: messages.filter((m) => m.status === 'resolved').length,
  };

  const getStatusTone = (status: string): 'accent' | 'positive' | 'warn' | 'danger' | 'neutral' => {
    switch (status) {
      case 'new':
        return 'accent';
      case 'in_progress':
        return 'warn';
      case 'resolved':
        return 'positive';
      default:
        return 'neutral';
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
      {/* Toolbar (hero handled by AdminPageShell) */}
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-mono uppercase tracking-[0.32em] text-white/35">
          {statusCounts.new > 0
            ? <span style={{ color: 'hsl(214 90% 62% / 0.8)' }}>{statusCounts.new} awaiting response</span>
            : 'all clear'}
        </div>
        <DeckButton onClick={fetchMessages} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </DeckButton>
      </div>

      {/* Status Tabs */}
      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
        <TabsList className="bg-white/[0.04]">
          <TabsTrigger value="all" className="gap-1.5">
            <Inbox className="w-3.5 h-3.5" />
            All
            <StatusPill tone="neutral">{statusCounts.all}</StatusPill>
          </TabsTrigger>
          <TabsTrigger value="new" className="gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            New
            {statusCounts.new > 0 && (
              <StatusPill tone="accent">{statusCounts.new}</StatusPill>
            )}
          </TabsTrigger>
          <TabsTrigger value="in_progress" className="gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            In Progress
            {statusCounts.in_progress > 0 && (
              <StatusPill tone="neutral">{statusCounts.in_progress}</StatusPill>
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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
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
        <div
          className="lg:col-span-2 flex flex-col overflow-hidden rounded-2xl backdrop-blur-xl"
          style={{ background: 'linear-gradient(165deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02) 60%, rgba(255,255,255,0.015))' }}
        >
          <div className="py-3 px-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-sm font-medium text-white/60">
              {filteredMessages.length} message{filteredMessages.length !== 1 ? 's' : ''}
            </div>
          </div>
          <ScrollArea className="flex-1">
            {loading && messages.length === 0 ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="w-6 h-6 animate-spin text-white/40" />
              </div>
            ) : filteredMessages.length === 0 ? (
              <AdminEmptyState
                code="MSG"
                icon={Mail}
                title="The channel is silent"
                hint="No inbound threads match this filter. New messages stream in here the moment they're submitted from any surface."
              />
            ) : (
              <>
              <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                {pagedMessages.map((msg) => (
                  <button
                    key={msg.id}
                    className={cn(
                      'w-full text-left p-3 hover:bg-white/[0.03] transition-colors',
                      selectedMessage?.id === msg.id && 'bg-white/[0.04] border-l-2',
                      msg.status === 'new' && selectedMessage?.id !== msg.id && 'bg-white/[0.03]'
                    )}
                    style={selectedMessage?.id === msg.id ? { borderLeftColor: 'hsl(214 90% 62%)' } : undefined}
                    onClick={() => setSelectedMessage(msg)}
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium',
                          msg.status === 'new'
                            ? 'bg-[hsl(214_90%_62%/0.18)] text-[hsl(214_90%_62%)]'
                            : 'bg-white/[0.06] text-white/60'
                        )}
                      >
                        {(msg.name ?? '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              'font-medium truncate text-sm',
                              msg.status === 'new' ? 'text-white' : 'text-white/60'
                            )}
                          >
                            {msg.name}
                          </span>
                          <span className="text-[10px] text-white/40 flex-shrink-0">
                            {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p
                          className={cn(
                            'text-sm truncate',
                            msg.status === 'new' ? 'text-white font-medium' : 'text-white/60'
                          )}
                        >
                          {msg.subject}
                        </p>
                        <p className="text-xs text-white/40 truncate mt-0.5">
                          {msg.message.substring(0, 60)}...
                        </p>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <StatusPill tone={getStatusTone(msg.status)}>
                            {getStatusIcon(msg.status)}
                            <span>{msg.status.replace('_', ' ')}</span>
                          </StatusPill>
                          {msg.admin_notes && (
                            <StickyNote className="w-3 h-3" style={{ color: 'hsl(38 96% 62%)' }} />
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="px-3 pb-3">
                <ListPagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} label="messages" />
              </div>
              </>
            )}
          </ScrollArea>
        </div>

        {/* Message Detail */}
        <div
          className="lg:col-span-3 flex flex-col overflow-hidden rounded-2xl backdrop-blur-xl"
          style={{ background: 'linear-gradient(165deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02) 60%, rgba(255,255,255,0.015))' }}
        >
          {selectedMessage ? (
            <>
              <div className="py-3 px-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-base font-semibold truncate text-white">
                      {selectedMessage.subject}
                    </div>
                    <p className="text-sm text-white/60 mt-0.5">
                      From: {selectedMessage.name}
                    </p>
                  </div>
                  <span className="flex-shrink-0">
                    <StatusPill tone={getStatusTone(selectedMessage.status)}>
                      {getStatusIcon(selectedMessage.status)}
                      <span>{selectedMessage.status.replace('_', ' ')}</span>
                    </StatusPill>
                  </span>
                </div>
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {/* Meta Info */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-white/60">
                      <User className="w-4 h-4" />
                      <span className="truncate">{selectedMessage.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-white/60">
                      <Calendar className="w-4 h-4" />
                      <span>{format(new Date(selectedMessage.created_at), 'PPp')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-white/60">
                      <Globe className="w-4 h-4" />
                      <span>Source: {selectedMessage.source}</span>
                    </div>
                    {selectedMessage.user_id && (
                      <div className="flex items-center gap-2 text-white/60">
                        <User className="w-4 h-4" />
                        <span className="text-xs">Registered User</span>
                      </div>
                    )}
                  </div>

                  {/* Message Content */}
                  <div className="bg-white/[0.04] rounded-lg p-4">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-white/80">{selectedMessage.message}</p>
                  </div>

                  {/* Admin Notes */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2 text-white">
                      <StickyNote className="w-4 h-4" style={{ color: 'hsl(38 96% 62%)' }} />
                      Admin Notes
                    </label>
                    <Textarea
                      placeholder="Add internal notes about this message..."
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      rows={3}
                      className="resize-none"
                    />
                    <DeckButton
                      onClick={saveAdminNotes}
                      disabled={savingNotes || adminNotes === (selectedMessage.admin_notes || '')}
                    >
                      {savingNotes ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Save Notes
                    </DeckButton>
                  </div>

                  {/* Reply to user (in-app) */}
                  <div className="space-y-2 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <label className="text-sm font-medium flex items-center gap-2 text-white">
                      <Send className="w-4 h-4" style={{ color: 'hsl(214 90% 62%)' }} />
                      Reply to user (in-app)
                    </label>
                    <p className="text-xs text-white/60">
                      Saved to the ticket and shown to the user inside their Profile › Help & Support.
                    </p>
                    <Textarea
                      placeholder="Type a reply the user will see in-app..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={4}
                      className="resize-none"
                    />
                    <div className="flex items-center gap-2">
                      <DeckButton
                        primary
                        onClick={sendReply}
                        disabled={sendingReply || !replyText.trim() || replyText.trim() === (selectedMessage.admin_reply || '').trim()}
                      >
                        {sendingReply ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                        {selectedMessage.admin_reply ? 'Update reply' : 'Send reply'}
                      </DeckButton>
                      {selectedMessage.replied_at && (
                        <span className="text-[11px] text-white/60">
                          Last sent {formatDistanceToNow(new Date(selectedMessage.replied_at), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </ScrollArea>

              {/* Actions Footer */}
              <div className="p-3 flex items-center gap-2 flex-wrap" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <DeckButton
                  primary
                  onClick={() => openEmailClient(selectedMessage.email, selectedMessage.subject)}
                >
                  <Send className="w-4 h-4 mr-1.5" />
                  Reply via Email
                  <ExternalLink className="w-3 h-3 ml-1.5" />
                </DeckButton>

                {selectedMessage.status === 'new' && (
                  <DeckButton
                    onClick={() => updateMessageStatus(selectedMessage.id, 'in_progress')}
                  >
                    <Clock className="w-4 h-4 mr-1.5" />
                    Mark In Progress
                  </DeckButton>
                )}

                {selectedMessage.status !== 'resolved' && (
                  <DeckButton
                    onClick={() => updateMessageStatus(selectedMessage.id, 'resolved')}
                  >
                    <CheckCircle className="w-4 h-4 mr-1.5" />
                    Mark Resolved
                  </DeckButton>
                )}

                <div className="flex-1" />

                <DeckButton
                  onClick={() => deleteMessage(selectedMessage.id)}
                >
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  Delete
                </DeckButton>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-white/40">
              <Mail className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">Select a message to view details</p>
              <p className="text-xs mt-1">Click on any message from the list</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
