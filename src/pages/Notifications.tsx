import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import {
  Bell, Check, Trash2, ArrowUpRight, ArrowLeft,
  Heart, MessageCircle, UserPlus, Trophy, Star, Gift, Zap, Video, Play,
  AlertTriangle, Coins,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotifications, NotificationType, Notification } from '@/hooks/useNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import { useSafeNavigation } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { ListPagination, usePagination } from '@/components/ui/list-pagination';

import { usePageMeta } from '@/hooks/usePageMeta';
const ICONS: Record<NotificationType, typeof Bell> = {
  like: Heart, comment: MessageCircle, follow: UserPlus, achievement: Trophy,
  challenge_complete: Star, message: MessageCircle, universe_invite: Gift,
  character_borrow_request: Gift, level_up: Zap, streak_milestone: Zap,
  video_complete: Video, video_started: Play, video_failed: AlertTriangle,
  low_credits: Coins, mention: MessageCircle,
};

const COLORS: Record<NotificationType, string> = {
  like: 'text-rose-300', comment: 'text-[#9DCBFF]', follow: 'text-emerald-300',
  achievement: 'text-amber-300', challenge_complete: 'text-[#9DCBFF]',
  message: 'text-[#9DCBFF]', universe_invite: 'text-pink-300',
  character_borrow_request: 'text-orange-300', level_up: 'text-amber-300',
  streak_milestone: 'text-orange-300', video_complete: 'text-emerald-300',
  video_started: 'text-[#9DCBFF]', video_failed: 'text-rose-300',
  low_credits: 'text-amber-300', mention: 'text-[#9DCBFF]',
};

type Filter = 'all' | 'unread' | 'production' | 'rewards' | 'social' | 'billing';

const FILTER_LABELS: { id: Filter; label: string; code: string }[] = [
  { id: 'all', label: 'All', code: '01' },
  { id: 'unread', label: 'Unread', code: '02' },
  { id: 'production', label: 'Production', code: '03' },
  { id: 'rewards', label: 'Rewards', code: '04' },
  { id: 'social', label: 'Social', code: '05' },
  { id: 'billing', label: 'Billing', code: '06' },
];

function classifyFilter(n: Notification, filter: Filter): boolean {
  if (filter === 'all') return true;
  if (filter === 'unread') return !n.read;
  if (filter === 'production')
    return ['video_complete', 'video_started', 'video_failed'].includes(n.type);
  if (filter === 'rewards')
    return ['achievement', 'challenge_complete', 'level_up', 'streak_milestone'].includes(n.type);
  if (filter === 'social')
    return ['like', 'comment', 'follow', 'mention', 'message', 'universe_invite', 'character_borrow_request'].includes(n.type);
  if (filter === 'billing') return n.type === 'low_credits';
  return true;
}

function deepLinkFor(n: Notification): string | null {
  const d = (n.data ?? {}) as Record<string, unknown>;
  const projectId = (d.projectId ?? d.project_id) as string | undefined;
  const videoId = (d.videoId ?? d.video_id) as string | undefined;
  switch (n.type) {
    case 'video_complete':
    case 'video_started':
      return videoId ? `/video/${videoId}` : '/projects';
    case 'video_failed':
      return projectId ? `/production/${projectId}` : '/projects';
    case 'low_credits':
      return '/settings?section=billing';
    case 'achievement':
    case 'level_up':
    case 'streak_milestone':
    case 'challenge_complete':
      return '/profile';
    case 'follow':
    case 'like':
    case 'comment':
    case 'mention':
      return '/profile';
    default:
      return null;
  }
}

function dayLabel(d: Date): string {
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEEE, MMM d');
}

export default function NotificationsPage() {
  usePageMeta({ title: "Notifications — Small Bridges", description: "Updates on your projects, credits, and the Small Bridges community." });

  const { user, loading } = useAuth();
  const { navigate } = useSafeNavigation();
  const realNavigate = useNavigate();
  const {
    notifications, isLoading, unreadCount,
    markAsRead, markAllAsRead, deleteNotification, clearAll,
  } = useNotifications();
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading, navigate]);

  const filtered = useMemo(
    () => (notifications ?? []).filter((n) => classifyFilter(n, filter)),
    [notifications, filter],
  );
  const { slice: pagedFiltered, page, setPage, totalPages, total, pageSize } = usePagination(filtered, 25);

  const grouped = useMemo(() => {
    const map = new Map<string, Notification[]>();
    for (const n of pagedFiltered) {
      const k = dayLabel(new Date(n.created_at));
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(n);
    }
    return Array.from(map.entries());
  }, [pagedFiltered]);

  const open = (n: Notification) => {
    if (!n.read) markAsRead.mutate(n.id);
    const dest = deepLinkFor(n);
    if (dest) realNavigate(dest);
  };

  return (
    <div className="min-h-screen text-foreground font-body relative overflow-hidden">
      {/* Atmospheric backdrop */}
      <div aria-hidden className="fixed inset-0 pointer-events-none opacity-60">
        <div className="absolute -top-40 -left-40 w-[680px] h-[680px] rounded-full bg-[#0A84FF]/[0.05] blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[480px] h-[480px] rounded-full bg-[#0A84FF]/[0.04] blur-[120px]" />
      </div>
<main className="relative z-10 max-w-4xl mx-auto px-6 lg:px-10 py-10">
        {/* Back */}
        <button
          onClick={() => realNavigate(-1)}
          className="inline-flex items-center gap-2 text-[12px] text-muted-foreground hover:text-foreground transition mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>

        {/* Hero */}
        <header className="mb-8">
          <div className="text-[10px] uppercase tracking-[0.32em] text-[#9DCBFF] font-medium mb-3 inline-flex items-center gap-2">
            <Bell className="w-3 h-3" /> Inbox
          </div>
          <h1 className="font-display text-[40px] sm:text-[52px] leading-[1.05] font-light tracking-tight">
            Notifications
          </h1>
          <p className="text-[14px] text-muted-foreground mt-2 font-light max-w-xl">
            Render updates, rewards, billing alerts and team activity — quietly organized.
          </p>
        </header>

        {/* Filter row */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div className="flex flex-wrap gap-1.5">
            {FILTER_LABELS.map((f) => {
              const active = filter === f.id;
              const count = (notifications ?? []).filter((n) => classifyFilter(n, f.id)).length;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    'px-3.5 py-1.5 rounded-xl border text-[12px] transition flex items-center gap-2',
                    active
                      ? 'border-[#0A84FF]/40 bg-[#0A84FF]/[0.10] text-foreground shadow-[0_0_20px_-10px_hsla(212,100%,55%,0.6)]'
                      : 'border-white/[0.06] bg-white/[0.02] text-muted-foreground hover:bg-white/[0.05] hover:text-foreground',
                  )}
                >
                  <span className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{f.code}</span>
                  {f.label}
                  {count > 0 && (
                    <span className={cn(
                      'text-[10px] tabular-nums px-1.5 rounded-full',
                      active ? 'bg-[#0A84FF]/30 text-foreground' : 'bg-white/[0.06] text-muted-foreground',
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button
                onClick={() => markAllAsRead.mutate()}
                variant="outline"
                size="sm"
                className="border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-foreground h-8"
              >
                <Check className="w-3.5 h-3.5 mr-1.5" /> Mark all read
              </Button>
            )}
            {(notifications?.length ?? 0) > 0 && (
              <Button
                onClick={() => clearAll.mutate()}
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-rose-300 hover:bg-white/[0.03] h-8"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Clear all
              </Button>
            )}
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[88px] rounded-2xl border border-white/[0.05] bg-white/[0.02] animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] py-20 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-center">
              <Bell className="w-6 h-6 text-muted-foreground" strokeWidth={1.4} />
            </div>
            <p className="font-display text-[20px] font-light text-foreground/90 mt-4">Quiet on this channel</p>
            <p className="text-[13px] text-muted-foreground mt-1">No notifications match this filter yet.</p>
          </div>
        ) : (
          <>
          <div className="space-y-8">
            {grouped.map(([day, items]) => (
              <section key={day}>
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground font-medium">{day}</p>
                  <div className="flex-1 h-px bg-gradient-to-r from-white/[0.08] to-transparent" />
                </div>
                <div className="space-y-2">
                  {items.map((n) => {
                    const Icon = ICONS[n.type] || Bell;
                    const color = COLORS[n.type] || 'text-muted-foreground';
                    const dest = deepLinkFor(n);
                    return (
                      <div
                        key={n.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => open(n)}
                        onKeyDown={(e) => { if (e.key === 'Enter') open(n); }}
                        className={cn(
                          'group relative rounded-2xl border transition cursor-pointer',
                          'p-5 flex gap-4 items-start',
                          !n.read
                            ? 'border-[#0A84FF]/30 bg-[#0A84FF]/[0.05]'
                            : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]',
                        )}
                      >
                        {!n.read && (
                          <span className="absolute left-0 top-5 bottom-5 w-[2px] rounded-r-full bg-[#0A84FF]
                                            shadow-[0_0_12px_hsla(212,100%,55%,0.8)]" />
                        )}
                        <div className={cn(
                          'w-11 h-11 rounded-xl border border-white/[0.06] bg-white/[0.02]',
                          'flex items-center justify-center shrink-0',
                        )}>
                          <Icon className={cn('w-4.5 h-4.5', color)} strokeWidth={1.6} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <p className={cn(
                              'text-[14px] leading-snug',
                              n.read ? 'text-foreground/85' : 'text-foreground font-medium',
                            )}>
                              {n.title}
                            </p>
                            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground shrink-0 mt-1">
                              {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                            </p>
                          </div>
                          {n.body && (
                            <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">{n.body}</p>
                          )}
                          {dest && (
                            <p className="text-[11px] text-[#9DCBFF] mt-2 inline-flex items-center gap-1 opacity-80 group-hover:opacity-100">
                              Open <ArrowUpRight className="w-3 h-3" />
                            </p>
                          )}
                        </div>
                        <button
                          aria-label="Dismiss"
                          onClick={(e) => { e.stopPropagation(); deleteNotification.mutate(n.id); }}
                          className="opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-rose-300 p-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
          <ListPagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} label="notifications" />
          </>
        )}
      </main>
    </div>
  );
}