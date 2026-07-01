/**
 * SupportInbox - User-facing help & admin messaging.
 * - Composer to send a new help message to admins (writes to support_messages)
 * - Thread list of the user's own tickets, with status + admin reply
 * - Realtime subscription for new admin replies
 */
import { useEffect, useState, useCallback, memo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { LifeBuoy, Send, Loader2, ChevronDown, ChevronRight, Shield, Clock, CheckCircle2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

const glassCard = "relative backdrop-blur-2xl rounded-2xl";

interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  status: string;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
  updated_at: string;
}

const StatusPill = memo(function StatusPill({ status, hasReply }: { status: string; hasReply: boolean }) {
  const isReplied = hasReply || status === 'replied' || status === 'resolved';
  const color = isReplied
    ? 'text-[hsl(150,80%,65%)] bg-[hsla(150,80%,40%,0.12)] border-[hsla(150,80%,40%,0.3)]'
    : status === 'in_progress'
      ? 'text-[hsl(45,100%,70%)] bg-[hsla(45,100%,50%,0.12)] border-[hsla(45,100%,50%,0.28)]'
      : 'text-[hsl(215,100%,72%)] bg-[hsla(215,100%,60%,0.10)] border-[hsla(215,100%,60%,0.28)]';
  const label = isReplied ? 'Replied' : status === 'in_progress' ? 'In progress' : 'Awaiting reply';
  const Icon = isReplied ? CheckCircle2 : Clock;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-[0.18em] font-mono", color)}>
      <Icon className="w-3 h-3" /> {label}
    </span>
  );
});

export function SupportInbox({ className, defaultExpanded }: { className?: string; defaultExpanded?: boolean }) {
  const { user, profile } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(!!defaultExpanded);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    // RLS lets the user see by user_id OR by email-match
    const { data, error } = await supabase
      .from('support_messages')
      .select('id, subject, message, status, admin_reply, replied_at, created_at, updated_at')
      .or(`user_id.eq.${user.id},email.eq.${user.email}`)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) {
      console.debug('[SupportInbox] load error:', error.message);
    } else {
      setTickets((data || []) as SupportTicket[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  // Realtime: replies/updates land instantly
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('support_messages_user_' + user.id)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'support_messages' },
        (payload: any) => {
          const row = payload.new || payload.old;
          if (!row) return;
          if (row.user_id === user.id || row.email === user.email) {
            fetchTickets();
            if (payload.eventType === 'UPDATE' && payload.new?.admin_reply && payload.old?.admin_reply !== payload.new?.admin_reply) {
              toast.success('Support replied to your message', { description: payload.new.subject });
            }
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchTickets]);

  const handleSend = async () => {
    if (!user) { toast.error('Sign in to message support'); return; }
    if (!subject.trim() || !message.trim()) { toast.error('Subject and message required'); return; }
    setSending(true);
    try {
      const { error } = await supabase.from('support_messages').insert({
        name: profile?.display_name || user.email?.split('@')[0] || 'User',
        email: user.email!,
        subject: subject.trim(),
        message: message.trim(),
        source: 'in_app_support',
        user_id: user.id,
      });
      if (error) throw error;
      toast.success('Message sent — we typically reply within 24h');
      setSubject(''); setMessage(''); setComposing(false);
      fetchTickets();
    } catch (err: any) {
      console.error('[SupportInbox] send error:', err);
      toast.error(err?.message?.includes('rate') ? 'Please wait before sending another message' : 'Failed to send. Try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={cn(glassCard, "p-6", className)}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[hsla(215,100%,60%,0.12)] border border-[hsla(215,100%,60%,0.3)] flex items-center justify-center">
            <LifeBuoy className="w-4 h-4 text-[hsl(215,100%,72%)]" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Help & Support</h3>
            <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">
              Direct line to admins · Private
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setComposing((v) => !v)}
          className="gap-1.5 text-foreground hover:bg-white/[0.06]"
        >
          {composing ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {composing ? 'Cancel' : 'New message'}
        </Button>
      </div>

      {composing && (
        <div className="mb-5 space-y-2 p-4 rounded-xl">
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            maxLength={120}
            className="bg-[hsla(220,14%,3%,0.8)] border-white/[0.08] text-foreground"
          />
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe what you need help with..."
            rows={4}
            maxLength={2000}
            className="bg-[hsla(220,14%,3%,0.8)] border-white/[0.08] text-foreground resize-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono inline-flex items-center gap-1.5">
              <Shield className="w-3 h-3" /> Sent privately to small-bridges admins
            </span>
            <Button size="sm" variant="ghost" disabled={sending || !subject.trim() || !message.trim()} onClick={handleSend}
              className="text-[hsl(215,100%,72%)] hover:bg-white/[0.06] gap-1.5">
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Send
            </Button>
          </div>
        </div>
      )}

      <ScrollArea className="max-h-[420px]">
        <div className="space-y-2 pr-2">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl bg-glass" />
            ))
          ) : tickets.length === 0 ? (
            <div className="text-center py-8">
              <LifeBuoy className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No support messages yet.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Open a ticket and an admin will reply here.</p>
            </div>
          ) : (
            tickets.map((t) => {
              const isOpen = openId === t.id;
              const hasReply = !!t.admin_reply;
              return (
                <div
                  key={t.id}
                  className={cn(
                    "rounded-xl transition-all",
                    isOpen ? "bg-white/[0.03]" : "hover:bg-white/[0.02]"
                  )}
                >
                  <button
                    onClick={() => setOpenId(isOpen ? null : t.id)}
                    className="w-full flex items-center gap-3 p-3 text-left"
                  >
                    {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{t.subject}</p>
                        {hasReply && !isOpen && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[hsl(150,80%,55%)] shrink-0" aria-label="new reply" />
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <StatusPill status={t.status} hasReply={hasReply} />
                  </button>

                  {isOpen && (
                    <div className="px-3 pb-3 space-y-3">
                      <div className="p-3 rounded-lg">
                        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono mb-1">You wrote</p>
                        <p className="text-sm text-foreground/90 whitespace-pre-wrap">{t.message}</p>
                      </div>
                      {hasReply ? (
                        <div className="p-3 rounded-lg bg-[hsla(215,100%,60%,0.06)]">
                          <p className="text-[10px] uppercase tracking-[0.3em] text-[hsl(215,100%,72%)] font-mono mb-1 flex items-center gap-1.5">
                            <Shield className="w-3 h-3" /> Small Bridges admin
                            {t.replied_at && (
                              <span className="text-muted-foreground"> · {formatDistanceToNow(new Date(t.replied_at), { addSuffix: true })}</span>
                            )}
                          </p>
                          <p className="text-sm text-foreground whitespace-pre-wrap">{t.admin_reply}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic px-1">Awaiting admin reply…</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default SupportInbox;
