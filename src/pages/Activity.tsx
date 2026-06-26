/**
 * Activity — the mobile notifications feed: follows, likes, comments, mentions,
 * achievements, render updates. Wired to useNotifications (real `notifications`
 * table) with mark-read. Borderless/floating glass over the Aurora backdrop.
 */
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Heart, MessageCircle, UserPlus, AtSign, Trophy, Flame,
  Film, AlertTriangle, Coins, Bell, CheckCheck, Loader2, type LucideIcon,
} from 'lucide-react';
import { useNotifications, type Notification } from '@/hooks/useNotifications';
import { AuroraBackdrop } from '@/components/native/AuroraBackdrop';
import { hapticTap } from '@/lib/native/shell';
import { cn } from '@/lib/utils';

function ago(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return `${Math.floor(s / 604800)}w`;
}

const GLYPH: Partial<Record<Notification['type'], { icon: LucideIcon; color: string }>> = {
  like: { icon: Heart, color: '#ff3b6b' },
  comment: { icon: MessageCircle, color: '#5b9bff' },
  follow: { icon: UserPlus, color: '#8fb4ff' },
  mention: { icon: AtSign, color: '#5b9bff' },
  achievement: { icon: Trophy, color: '#ffd76b' },
  level_up: { icon: Trophy, color: '#ffd76b' },
  streak_milestone: { icon: Flame, color: '#ff8a3b' },
  video_complete: { icon: Film, color: '#5ee08a' },
  video_failed: { icon: AlertTriangle, color: '#ff5b6b' },
  message: { icon: MessageCircle, color: '#8fb4ff' },
  low_credits: { icon: Coins, color: '#ffd76b' },
};

function target(n: Notification): string | null {
  const d = n.data ?? {};
  const reelId = (d.reel_id || d.reelId) as string | undefined;
  if (n.type === 'message') return '/messages';
  if (n.type === 'follow' && n.actor_id) return `/u/${n.actor_id}`;
  if (reelId) return `/r/${reelId}`;
  if (n.actor_id && (n.type === 'mention')) return `/u/${n.actor_id}`;
  if (n.link && n.link.startsWith('/')) return n.link;
  return null;
}

export default function Activity() {
  const navigate = useNavigate();
  const { notifications, isLoading, unreadCount, markRead, markAllRead } = useNotifications();
  const list = (notifications ?? []) as Notification[];

  const open = (n: Notification) => {
    void hapticTap();
    if (!n.read) markRead(n.id);
    const to = target(n);
    if (to) navigate(to);
  };

  return (
    <div className="fixed inset-0 overflow-y-auto text-white">
      <AuroraBackdrop />

      <div className="relative z-10 flex items-center gap-3 px-4 pb-2" style={{ paddingTop: 'calc(var(--safe-top,0px) + 12px)' }}>
        <button onClick={() => navigate(-1)} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06] backdrop-blur-md"><ChevronLeft className="h-[18px] w-[18px]" /></button>
        <h1 className="flex-1 font-display text-[20px] font-semibold">Activity</h1>
        {unreadCount > 0 && (
          <button onClick={() => { void hapticTap(); markAllRead(); }} aria-label="Mark all read" className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-[12px] font-semibold text-[#8fb4ff] backdrop-blur-md"><CheckCheck className="h-[15px] w-[15px]" />Read all</button>
        )}
      </div>

      <div className="relative z-10 px-3" style={{ paddingBottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 24px)' }}>
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-white/40" /></div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-20 text-center text-white/40">
            <Bell className="h-9 w-9" strokeWidth={1.3} />
            <span className="text-[13px]">No activity yet.</span>
            <span className="text-[12px] text-white/30">Follows, likes and comments will show up here.</span>
          </div>
        ) : (
          <ul className="space-y-2">
            {list.map((n) => {
              const g = GLYPH[n.type] ?? { icon: Bell, color: '#8fb4ff' };
              return (
                <li key={n.id}>
                  <button onClick={() => open(n)} className={cn('flex w-full items-center gap-3 rounded-[18px] px-3.5 py-3 text-left transition-transform active:scale-[0.99]', n.read ? 'msg-glass' : 'msg-glass-accent')}>
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: `${g.color}22`, boxShadow: `inset 0 0 0 1px ${g.color}44` }}>
                      <g.icon className="h-[18px] w-[18px]" style={{ color: g.color }} strokeWidth={1.9} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={cn('truncate text-[14px]', n.read ? 'font-medium text-white/85' : 'font-semibold text-white')}>{n.title}</span>
                        <span className="shrink-0 font-mono text-[10.5px] text-white/35">{ago(n.created_at)}</span>
                      </div>
                      {n.body && <div className="mt-0.5 truncate text-[12.5px] text-white/50">{n.body}</div>}
                    </div>
                    {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-[#8fb4ff]" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
