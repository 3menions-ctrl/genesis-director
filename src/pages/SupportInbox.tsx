/**
 * SupportInbox — /settings/support
 *
 * Shows every support_messages thread the signed-in user has opened, with the
 * admin reply (if any), status, and a "Send another message" CTA pointing at
 * /contact.
 *
 * Backed by support_messages (admin_reply / replied_at / admin_reply_by were
 * added in migration 20260515111011). The user's read access is granted in
 * migration 20260610024942.
 */

import { useEffect, useState } from 'react';
import { Mail, Inbox, MessageSquare, ExternalLink, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useSafeNavigation } from '@/lib/navigation';
import { usePageMeta } from '@/hooks/usePageMeta';
import { EmptyState } from '@/components/ui/empty-state';
import { PrimaryCTA } from '@/components/ui/PrimaryCTA';
import { Spinner } from '@/components/ui/Spinner';

interface SupportThread {
  id: string;
  subject: string;
  message: string;
  source: string;
  status: string;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  new: { label: 'Awaiting reply', tone: 'text-amber-300' },
  read: { label: 'Acknowledged', tone: 'text-[#6FB6FF]' },
  replied: { label: 'Replied', tone: 'text-emerald-300' },
  resolved: { label: 'Resolved', tone: 'text-white/55' },
};

export default function SupportInbox() {
  usePageMeta({
    title: 'Help & Support — Small Bridges',
    description: 'Your support conversations and replies from the Small Bridges team.',
  });

  const { user } = useAuth();
  const { navigate } = useSafeNavigation();
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('support_messages')
        .select('id, subject, message, source, status, admin_reply, replied_at, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (cancelled) return;
      setThreads((data ?? []) as SupportThread[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div className="text-white">
      <div className="max-w-[1280px] mx-auto px-6 pt-16 pb-24 space-y-10">
        {/* Header */}
        <header className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/30">
                Settings · Support
              </span>
            </div>
            <h1 className="text-[36px] leading-[1.05] font-display font-light text-white">
              Help &amp; Support
            </h1>
            <p className="text-white/55 text-[14px] mt-3 max-w-xl leading-relaxed">
              Every conversation you&rsquo;ve started with our team and our replies. New messages land here within one business day.
            </p>
          </div>
          <PrimaryCTA
            onClick={() => navigate('/contact')}
            icon={MessageSquare}
            trailingIcon={ExternalLink}
          >
            Start a new conversation
          </PrimaryCTA>
        </header>

        {/* Threads */}
        {loading ? (
          <div className="p-16 flex items-center justify-center gap-3 text-white/40">
            <Spinner size="sm" tone="muted" />
            <span className="text-[12px] font-mono uppercase tracking-[0.22em]">Loading…</span>
          </div>
        ) : threads.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No conversations yet"
            description="When you contact our team via /contact or request more credits, the thread lives here. We reply within one business day."
            cta={{
              label: 'Open contact form',
              onClick: () => navigate('/contact'),
              icon: Mail,
            }}
          />
        ) : (
          <ul className="space-y-3">
            {threads.map((t) => {
              const statusInfo = STATUS_LABEL[t.status] ?? STATUS_LABEL.new;
              const isExpanded = expanded === t.id;
              const hasReply = !!t.admin_reply;
              return (
                <li
                  key={t.id}
                  className="rounded-2xl border border-white/[0.06] bg-white/[0.015] overflow-hidden"
                >
                  <button
                    onClick={() => setExpanded(isExpanded ? null : t.id)}
                    className="w-full px-6 py-5 flex items-start gap-4 text-left hover:bg-white/[0.02] transition-colors"
                  >
                    <div
                      className={`w-9 h-9 rounded-xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-center shrink-0 ${
                        hasReply ? 'text-emerald-300' : 'text-white/45'
                      }`}
                    >
                      {hasReply ? <Check className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap mb-1">
                        <h3 className="text-white text-[14px] font-medium truncate">{t.subject}</h3>
                        <span
                          className={`text-[10px] font-mono uppercase tracking-[0.18em] ${statusInfo.tone}`}
                        >
                          {statusInfo.label}
                        </span>
                      </div>
                      <p className="text-white/45 text-[12px] truncate">{t.message}</p>
                      <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/30 mt-2">
                        {new Date(t.created_at).toLocaleString()} ·{' '}
                        <span className="text-white/45">{t.source}</span>
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-6 pb-6 pt-2 border-t border-white/[0.05] space-y-5">
                      <Bubble
                        from="You"
                        timestamp={t.created_at}
                        body={t.message}
                        align="left"
                      />
                      {hasReply ? (
                        <Bubble
                          from="Small Bridges Support"
                          timestamp={t.replied_at}
                          body={t.admin_reply!}
                          align="right"
                        />
                      ) : (
                        <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-white/35 text-center py-3">
                          Awaiting reply — we typically reply within one business day.
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Bubble({
  from,
  timestamp,
  body,
  align,
}: {
  from: string;
  timestamp: string | null;
  body: string;
  align: 'left' | 'right';
}) {
  return (
    <div className={align === 'right' ? 'pl-8' : 'pr-8'}>
      <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/35 mb-1.5">
        {from}
        {timestamp && (
          <span className="ml-3 text-white/25">
            {new Date(timestamp).toLocaleString()}
          </span>
        )}
      </div>
      <div
        className={`rounded-2xl border p-4 ${
          align === 'right'
            ? 'border-[#0A84FF]/25 bg-[#0A84FF]/[0.04]'
            : 'border-white/[0.06] bg-white/[0.02]'
        }`}
      >
        <p className="text-white/85 text-[13px] leading-relaxed whitespace-pre-line">{body}</p>
      </div>
    </div>
  );
}
