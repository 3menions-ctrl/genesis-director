import { useState, memo, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, Check, Trophy, Heart, MessageCircle, UserPlus, Zap, Gift,
  Video, Star, Play, AlertTriangle, Coins, ArrowUpRight, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications, NotificationType, Notification } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

const notificationIcons: Record<NotificationType, typeof Bell> = {
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
  mention: MessageCircle,
};

const notificationColors: Record<NotificationType, string> = {
  like: 'text-rose-300',
  comment: 'text-primary/60',
  follow: 'text-emerald-300',
  achievement: 'text-amber-300',
  challenge_complete: 'text-primary/60',
  message: 'text-primary/60',
  universe_invite: 'text-pink-300',
  character_borrow_request: 'text-orange-300',
  level_up: 'text-amber-300',
  streak_milestone: 'text-orange-300',
  video_complete: 'text-emerald-300',
  video_started: 'text-primary/60',
  video_failed: 'text-rose-300',
  low_credits: 'text-amber-300',
  mention: 'text-primary/60',
};

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

export const NotificationBell = memo(forwardRef<HTMLButtonElement, Record<string, never>>(
  function NotificationBell(_, ref) {
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();
    const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();

    const handleClick = (n: Notification) => {
      if (!n.read) markAsRead.mutate(n.id);
      const dest = deepLinkFor(n);
      if (dest) {
        setOpen(false);
        navigate(dest);
      }
    };

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            variant="ghost"
            size="icon"
            aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
            className="relative h-9 w-9 rounded-xl text-white/75 hover:text-white hover:bg-glass-hover transition"
          >
            <Bell className="h-[18px] w-[18px]" strokeWidth={1.6} />
            {unreadCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full
                           bg-primary text-white text-[10px] font-medium
                           flex items-center justify-center
                           shadow-[0_0_12px_-2px_hsla(212,100%,55%,0.8)]
                           ring-2 ring-[hsl(220,14%,2%)]"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={10}
          className="w-[380px] p-0 border-white/[0.06] bg-[hsl(220,14%,4%)]/95 backdrop-blur-2xl
                     shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] rounded-2xl overflow-hidden text-white"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/[0.05]">
            <div>
              <p className="text-[10px] uppercase tracking-[0.32em] text-primary/60 font-medium">Inbox</p>
              <p className="font-display text-[18px] font-light text-white mt-0.5">Notifications</p>
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost" size="sm"
                onClick={() => markAllAsRead.mutate()}
                className="text-[11px] text-white/55 hover:text-white hover:bg-glass-hover h-7"
              >
                <Check className="w-3 h-3 mr-1" /> Mark all read
              </Button>
            )}
          </div>

          <ScrollArea className="max-h-[420px]">
            {notifications && notifications.length > 0 ? (
              <div>
                {notifications.slice(0, 12).map((n) => {
                  const Icon = notificationIcons[n.type] || Bell;
                  const colorClass = notificationColors[n.type] || 'text-white/55';
                  const dest = deepLinkFor(n);
                  return (
                    <div
                      key={n.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleClick(n)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleClick(n); }}
                      className={cn(
                        'group relative px-5 py-3.5 flex gap-3 cursor-pointer transition',
                        'border-b border-white/[0.04] last:border-b-0',
                        !n.read ? 'bg-primary/[0.04]' : 'hover:bg-glass',
                      )}
                    >
                      {!n.read && (
                        <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary
                                          shadow-[0_0_10px_hsla(212,100%,55%,0.8)]" />
                      )}
                      <div className={cn(
                        'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                        'border border-white/[0.06] bg-glass',
                      )}>
                        <Icon className={cn('w-4 h-4', colorClass)} strokeWidth={1.6} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn('text-[13px] leading-snug', n.read ? 'text-white/75' : 'text-white font-medium')}>
                            {n.title}
                          </p>
                          {dest && (
                            <ArrowUpRight className="w-3 h-3 text-white/30 group-hover:text-primary/60 transition shrink-0 mt-0.5" />
                          )}
                        </div>
                        {n.body && (
                          <p className="text-[12px] text-white/45 line-clamp-2 mt-0.5">{n.body}</p>
                        )}
                        <p className="text-[10px] uppercase tracking-[0.16em] text-white/30 mt-1.5">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <button
                        aria-label="Dismiss"
                        onClick={(e) => { e.stopPropagation(); deleteNotification.mutate(n.id); }}
                        className="opacity-0 group-hover:opacity-100 transition self-start text-white/35 hover:text-rose-300 p-1 -m-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-5 py-12 text-center">
                <div className="w-12 h-12 mx-auto rounded-2xl border border-white/[0.06] bg-glass flex items-center justify-center">
                  <Bell className="w-5 h-5 text-white/35" strokeWidth={1.5} />
                </div>
                <p className="text-[13px] text-white/55 mt-3">You're all caught up</p>
                <p className="text-[11px] text-white/35 mt-1">Render updates and rewards will appear here.</p>
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-white/[0.05] bg-white/[0.01]">
            <button
              onClick={() => { setOpen(false); navigate('/notifications'); }}
              className="w-full text-center text-[12px] text-white/65 hover:text-white transition py-1"
            >
              View all notifications →
            </button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }
));
