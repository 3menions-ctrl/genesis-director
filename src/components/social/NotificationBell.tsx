/**
 * NotificationBell — the connected inbox surfaced from the chrome.
 *
 * Single mount point for the entire app's notification UX:
 *   - Bell icon with a pulsing accent dot when unreadCount > 0
 *   - Click → popover anchored to the bell (desktop) or full-screen
 *     sheet (mobile, < md) showing the recent 50 notifications
 *   - Tabs: All / Mentions / Activity — monospace tracking-wide labels
 *     so they read as editorial slate, not UI tabs
 *   - Each row: actor avatar (real or initial), title in Fraunces
 *     italic-light, body in normal text, time-ago in mono meta,
 *     accent dot if unread, ArrowUpRight if a link is attached
 *   - Tap row → marks as read + navigates to the row's link
 *   - "Mark all read" CTA top of the popover
 *   - "Notification settings" link bottom
 *   - "Load more" appended once the user scrolls to the bottom
 *   - Empty state: "Nothing yet. Make something." → /studio
 *
 * The bell pins to the top-right of the FoundationShell chrome
 * (rendered by FoundationShell as a fixed-position floater).
 */
import { useEffect, useMemo, useState, memo, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  Bell, Check, Heart, MessageCircle, UserPlus, Zap, Gift,
  Video, Star, Play, AlertTriangle, Coins, ArrowUpRight, Trash2,
  Sparkles, X as CloseIcon, Trophy, Settings as SettingsIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications, NotificationType, Notification } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { TYPE_META } from '@/lib/design-system';

// ─────────────────────────────────────────────────────────────────────
// Type → icon + accent color
// ─────────────────────────────────────────────────────────────────────
// String-keyed (not Record<NotificationType>) so newer enum values the drifted
// types.ts doesn't know about still get a meaningful icon (audit D31/M24).
const notificationIcons: Record<string, typeof Bell> = {
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
  achievement: Trophy,
  challenge_complete: Star,
  message: MessageCircle,
  universe_invite: Gift,
  character_borrow_request: Gift,
  level_up: Zap,
  streak_milestone: Zap,
  video_complete: Video,
  video_started: Play,
  video_failed: AlertTriangle,
  low_credits: Coins,
  credits_purchased: Coins,
  subscription_renewed: Coins,
  mention: MessageCircle,
  system: Sparkles,
  // Newer generated types:
  tip_received: Coins,
  patron_received: Coins,
  atom_sale: Coins,
  follow_request: UserPlus,
  follow_accepted: UserPlus,
  reel_like: Heart,
  reel_comment: MessageCircle,
  reel_mention: MessageCircle,
  dm_reaction: Heart,
  crew_message: MessageCircle,
  ai_assistant: Sparkles,
  brand_inquiry: Gift,
  render_progress: Video,
  org_member_joined: UserPlus,
  org_role_changed: UserPlus,
  org_credits_low: Coins,
};

const notificationColors: Record<NotificationType, string> = {
  like: 'text-rose-300',
  comment: 'text-sky-300/80',
  follow: 'text-emerald-300',
  achievement: 'text-amber-300',
  challenge_complete: 'text-sky-300/80',
  message: 'text-sky-300/80',
  universe_invite: 'text-pink-300',
  character_borrow_request: 'text-orange-300',
  level_up: 'text-amber-300',
  streak_milestone: 'text-orange-300',
  video_complete: 'text-emerald-300',
  video_started: 'text-sky-300/80',
  video_failed: 'text-rose-300',
  low_credits: 'text-amber-300',
  credits_purchased: 'text-emerald-300',
  subscription_renewed: 'text-emerald-300',
  mention: 'text-sky-300/80',
  system: 'text-accent',
};

// ─────────────────────────────────────────────────────────────────────
// deepLinkFor — resolves a notification to a destination
// Prefers an explicit `link` column (new schema), falls back to
// per-type rules for older rows.
// ─────────────────────────────────────────────────────────────────────
function deepLinkFor(n: Notification): string | null {
  if (n.link) return n.link;
  const d = (n.data ?? {}) as Record<string, unknown>;
  const fromData = (d.link ?? d.route) as string | undefined;
  if (fromData) return fromData;
  const projectId = (d.projectId ?? d.project_id) as string | undefined;
  const videoId = (d.videoId ?? d.video_id) as string | undefined;
  const reelId = (d.reel_id ?? d.reelId) as string | undefined;
  switch (n.type) {
    case 'video_complete':
    case 'video_started':
      return reelId ? `/r/${reelId}` : videoId ? `/r/${videoId}` : '/library';
    case 'video_failed':
      return projectId ? `/production/${projectId}` : '/library';
    case 'low_credits':
      return '/account?tab=credits';
    case 'achievement':
    case 'level_up':
    case 'streak_milestone':
    case 'challenge_complete':
      return '/account';
    case 'follow': {
      // Link to the follower's public profile, not your own editor.
      const actorId = (d.actor_id ?? d.follower_id) as string | undefined;
      return actorId ? `/c/${actorId}` : '/account';
    }
    case 'like':
    case 'comment':
    case 'mention':
    case 'reel_like':
    case 'reel_comment':
    case 'reel_mention':
      // Land on the reel where it happened (Reel.tsx resolves both
      // published-reel and project ids), not the editing tool.
      return reelId ? `/r/${reelId}` : projectId ? `/r/${projectId}` : '/account';
    case 'follow_request':
    case 'follow_accepted': {
      const actorId = (d.actor_id ?? d.follower_id) as string | undefined;
      return actorId ? `/c/${actorId}` : '/account';
    }
    case 'tip_received':
    case 'patron_received':
    case 'atom_sale':
      return '/account?tab=earnings';
    case 'credits_purchased':
    case 'org_credits_low':
      return '/account?tab=credits';
    case 'render_progress':
      return projectId ? `/production/${projectId}` : '/library';
    case 'message':
    case 'dm_reaction':
    case 'crew_message':
    case 'ai_assistant':
    case 'brand_inquiry':
      return '/inbox';
    case 'org_member_joined':
    case 'org_role_changed':
      return '/business/team';
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Tab classification — mirrors the master backlog "All / Mentions /
// Activity" split. Mentions surface comment + mention rows (the
// "someone is talking to me" lane). Activity is everything else.
// ─────────────────────────────────────────────────────────────────────
type Tab = 'all' | 'mentions' | 'activity';

const MENTION_TYPES = new Set<NotificationType>(['comment', 'mention', 'message']);

function tabFor(n: Notification): Tab {
  return MENTION_TYPES.has(n.type) ? 'mentions' : 'activity';
}

// ─────────────────────────────────────────────────────────────────────
// useIsMobile — sync media query so the popover swaps to a sheet
// ─────────────────────────────────────────────────────────────────────
function useIsMobile(): boolean {
  const [m, setM] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(max-width: 767px)');
    const onChange = () => setM(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return m;
}

// ─────────────────────────────────────────────────────────────────────
// NotificationBell
// ─────────────────────────────────────────────────────────────────────
export const NotificationBell = memo(forwardRef<HTMLButtonElement, Record<string, never>>(
  function NotificationBell(_, ref) {
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<Tab>('all');
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const {
      items,
      unreadCount,
      newSinceLastSeen,
      markSeen,
      markRead,
      markAllRead,
      deleteNotification,
      loadMore,
    } = useNotifications();

    // Pin the lastSeen marker every time the popover opens so the
    // "new since you last visited" cue resets on dismiss.
    useEffect(() => {
      if (open) markSeen();
    }, [open, markSeen]);

    const filtered = useMemo(() => {
      const list = items ?? [];
      if (tab === 'all') return list;
      return list.filter((n) => tabFor(n) === tab);
    }, [items, tab]);

    const handleClick = (n: Notification) => {
      if (!n.read) markRead(n.id);
      const dest = deepLinkFor(n);
      if (dest) {
        setOpen(false);
        navigate(dest);
      }
    };

    const badgeCount = unreadCount > 0 ? unreadCount : (newSinceLastSeen ?? 0);

    const trigger = (
      <Button
        ref={ref}
        variant="ghost"
        size="icon"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        className="relative h-9 w-9 rounded-xl text-white/75 hover:text-white hover:bg-white/[0.06] transition-all"
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={1.6} />
        {unreadCount > 0 && (
          <>
            {/* Pulsing accent dot */}
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 inline-flex"
            >
              <span className="absolute inline-flex h-3 w-3 rounded-full bg-[hsl(var(--accent))] opacity-60 animate-ping" />
              <span className="relative inline-flex min-w-[18px] h-[18px] px-1 rounded-full
                                bg-[hsl(var(--accent))] text-[hsl(220_30%_3%)] text-[10px] font-mono font-medium
                                items-center justify-center
                                shadow-[0_0_14px_-2px_hsl(var(--accent)/0.95)]
                                ring-2 ring-[hsl(220_30%_3%)]"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            </span>
          </>
        )}
      </Button>
    );

    const body = (
      <BellPanel
        items={filtered}
        tab={tab}
        setTab={setTab}
        unreadCount={unreadCount}
        badgeCount={badgeCount}
        onClick={handleClick}
        onDelete={(id) => deleteNotification.mutate(id)}
        onMarkAllRead={markAllRead}
        onLoadMore={loadMore}
        onClose={() => setOpen(false)}
        onSettings={() => { setOpen(false); navigate('/account/notifications'); }}
        showCloseButton={isMobile}
      />
    );

    if (isMobile) {
      return (
        <>
          <button
            type="button"
            ref={ref}
            onClick={() => setOpen(true)}
            aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl text-white/75 hover:text-white hover:bg-white/[0.06] transition-all"
          >
            <Bell className="h-[18px] w-[18px]" strokeWidth={1.6} />
            {unreadCount > 0 && (
              <span
                aria-hidden
                className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full
                            bg-[hsl(var(--accent))] text-[hsl(220_30%_3%)] text-[10px] font-mono font-medium
                            inline-flex items-center justify-center
                            shadow-[0_0_14px_-2px_hsl(var(--accent)/0.95)]
                            ring-2 ring-[hsl(220_30%_3%)]"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          {typeof document !== 'undefined' && createPortal(
            <AnimatePresence>
              {open && (
                <motion.div
                  key="bell-sheet"
                  className="fixed inset-0 z-[100] flex flex-col"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <button
                    type="button"
                    aria-label="Close notifications"
                    onClick={() => setOpen(false)}
                    className="absolute inset-0 bg-[hsl(220_30%_2%/0.85)] backdrop-blur-xl"
                  />
                  <motion.div
                    initial={{ y: 24, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 24, opacity: 0 }}
                    transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                    className="relative mt-auto h-[88vh] rounded-t-3xl overflow-hidden
                                border-t border-white/[0.08]
                                bg-[hsl(220_30%_5%)]
                                shadow-[0_-30px_80px_-20px_rgba(0,0,0,0.85)]"
                  >
                    {body}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>,
            document.body,
          )}
        </>
      );
    }

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={10}
          className="w-[400px] p-0 border-white/[0.06] bg-[hsl(220_30%_4%)]/95 backdrop-blur-2xl
                     shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] rounded-2xl overflow-hidden text-white"
        >
          {body}
        </PopoverContent>
      </Popover>
    );
  }
));

// ─────────────────────────────────────────────────────────────────────
// BellPanel — popover/sheet body. Shared so the mobile sheet and
// desktop popover use the same composition.
// ─────────────────────────────────────────────────────────────────────
interface BellPanelProps {
  items: Notification[];
  tab: Tab;
  setTab: (t: Tab) => void;
  unreadCount: number;
  badgeCount: number;
  onClick: (n: Notification) => void;
  onDelete: (id: string) => void;
  onMarkAllRead: () => void;
  onLoadMore: () => void;
  onClose: () => void;
  onSettings: () => void;
  showCloseButton?: boolean;
}

function BellPanel({
  items, tab, setTab, unreadCount, badgeCount,
  onClick, onDelete, onMarkAllRead, onLoadMore, onClose, onSettings,
  showCloseButton,
}: BellPanelProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-white/[0.05] shrink-0">
        <div className="min-w-0">
          <p className={cn(TYPE_META, 'text-accent/70 tracking-[0.32em]')}>
            ◆ Inbox{badgeCount > 0 && ` · ${badgeCount} new`}
          </p>
          <p
            className="font-display text-[20px] font-light italic text-white mt-0.5 leading-tight"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            Notifications
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {unreadCount > 0 && (
            <Button
              variant="ghost" size="sm"
              onClick={onMarkAllRead}
              className="text-[11px] font-mono uppercase tracking-[0.18em] text-white/55 hover:text-white hover:bg-white/[0.04] h-7 px-2"
            >
              <Check className="w-3 h-3 mr-1" /> Mark all
            </Button>
          )}
          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="h-7 w-7 inline-flex items-center justify-center rounded-md text-white/55 hover:text-white hover:bg-white/[0.04]"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Notification tabs" className="flex gap-0 px-5 py-2 border-b border-white/[0.04] shrink-0">
        {(['all', 'mentions', 'activity'] as Tab[]).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                'relative px-3 py-1.5 text-[10.5px] font-mono uppercase tracking-[0.32em] transition-colors',
                active ? 'text-accent' : 'text-white/40 hover:text-white/75',
              )}
            >
              {t}
              {active && (
                <motion.span
                  layoutId="bell-tab-underline"
                  aria-hidden
                  className="absolute -bottom-[2px] left-2 right-2 h-[2px] rounded-full bg-accent
                              shadow-[0_0_10px_hsl(var(--accent)/0.55)]"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* List */}
      <ScrollArea className="flex-1 min-h-0">
        {items && items.length > 0 ? (
          <div>
            {items.map((n) => {
              const Icon = notificationIcons[n.type] || Bell;
              const colorClass = notificationColors[n.type] || 'text-white/55';
              const dest = deepLinkFor(n);
              const actorName = (n.data?.actor_name ?? n.data?.actorName) as string | undefined;
              return (
                <div
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onClick(n)}
                  onKeyDown={(e) => { if (e.key === 'Enter') onClick(n); }}
                  className={cn(
                    'group relative px-5 py-3.5 flex gap-3 cursor-pointer transition-colors',
                    'border-b border-white/[0.04] last:border-b-0',
                    !n.read ? 'bg-[hsl(var(--accent)/0.05)]' : 'hover:bg-white/[0.02]',
                  )}
                >
                  {!n.read && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-0 bottom-0 w-[2px] bg-accent
                                  shadow-[0_0_10px_hsl(var(--accent)/0.85)]"
                    />
                  )}
                  <ActorAvatar
                    Icon={Icon}
                    colorClass={colorClass}
                    actorName={actorName}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={cn(
                          'text-[13.5px] leading-snug italic font-light',
                          n.read ? 'text-white/80' : 'text-white',
                        )}
                        style={{ fontFamily: "'Fraunces', serif" }}
                      >
                        {n.title}
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                        {!n.read && (
                          <span
                            aria-hidden
                            className="inline-block h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_hsl(var(--accent)/0.85)]"
                          />
                        )}
                        {dest && (
                          <ArrowUpRight className="w-3 h-3 text-white/30 group-hover:text-accent/85 transition-colors" />
                        )}
                      </div>
                    </div>
                    {n.body && (
                      <p className="text-[12.5px] text-white/55 line-clamp-2 mt-1 leading-relaxed">{n.body}</p>
                    )}
                    <p className={cn(TYPE_META, 'text-white/35 mt-1.5 tracking-[0.18em]')}>
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <button
                    aria-label="Dismiss notification"
                    onClick={(e) => { e.stopPropagation(); onDelete(n.id); }}
                    // Hover-reveal on pointer devices, but ALWAYS visible
                    // where hover doesn't exist (touch). Previously
                    // opacity-0 + group-hover left the delete button
                    // permanently unreachable on phones/tablets.
                    className="opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity self-start text-white/35 hover:text-rose-300 p-1 -m-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
            {/* Load more — only surfaces when the list is at or past a
                page boundary; the hook bumps pageSize by 50 on click. */}
            {items.length >= 50 && (
              <button
                type="button"
                onClick={onLoadMore}
                className={cn(
                  'w-full px-5 py-3 text-center transition-colors',
                  'text-[11.5px] font-mono uppercase tracking-[0.28em] text-white/45 hover:text-white hover:bg-white/[0.03]',
                  'border-t border-white/[0.04]',
                )}
              >
                Load more
              </button>
            )}
          </div>
        ) : (
          <EmptyState onClose={onClose} />
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-white/[0.05] bg-white/[0.01] shrink-0">
        <button
          type="button"
          onClick={onSettings}
          className="w-full inline-flex items-center justify-center gap-1.5 text-center text-[11.5px] font-mono uppercase tracking-[0.28em] text-white/55 hover:text-accent transition-colors py-1"
        >
          <SettingsIcon className="w-3 h-3" strokeWidth={1.5} />
          Notification settings
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ActorAvatar — falls back to an iconographic chip if no actor.
// ─────────────────────────────────────────────────────────────────────
function ActorAvatar({
  Icon, colorClass, actorName,
}: {
  Icon: typeof Bell;
  colorClass: string;
  actorName?: string;
}) {
  if (actorName) {
    return (
      <div
        className="shrink-0 w-9 h-9 rounded-xl overflow-hidden ring-1 ring-white/[0.10]
                    bg-gradient-to-br from-white/[0.08] to-[hsl(220_30%_8%)]
                    flex items-center justify-center"
      >
        <span
          className="text-[12px] font-display italic text-white/95"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          {actorName.charAt(0).toUpperCase()}
        </span>
      </div>
    );
  }
  return (
    <div className={cn(
      'shrink-0 w-9 h-9 rounded-xl flex items-center justify-center',
      'border border-white/[0.06] bg-white/[0.025]',
    )}>
      <Icon className={cn('w-4 h-4', colorClass)} strokeWidth={1.6} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// EmptyState — small, evocative, sends the user to Studio.
// ─────────────────────────────────────────────────────────────────────
function EmptyState({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  return (
    <div className="px-5 py-14 text-center">
      <div className="w-12 h-12 mx-auto rounded-2xl border border-white/[0.06] bg-white/[0.025] flex items-center justify-center">
        <Bell className="w-5 h-5 text-white/35" strokeWidth={1.4} />
      </div>
      <p
        className="text-[15px] text-white/85 mt-4 italic font-light"
        style={{ fontFamily: "'Fraunces', serif" }}
      >
        Nothing yet.
      </p>
      <p
        className="text-[15px] text-white/55 italic font-light"
        style={{ fontFamily: "'Fraunces', serif" }}
      >
        Make something.
      </p>
      <button
        type="button"
        onClick={() => { onClose(); navigate('/studio'); }}
        className="mt-5 inline-flex items-center gap-1.5 px-3 h-8 rounded-full
                    border border-accent/40 bg-[hsl(var(--accent)/0.06)]
                    text-[11px] font-mono uppercase tracking-[0.22em] text-accent
                    hover:bg-[hsl(var(--accent)/0.12)] transition-colors"
      >
        <Sparkles className="w-3 h-3" strokeWidth={1.5} />
        Open Studio
      </button>
    </div>
  );
}
