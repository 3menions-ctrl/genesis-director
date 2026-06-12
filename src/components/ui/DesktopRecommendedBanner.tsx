/**
 * DesktopRecommendedBanner — a top-of-page warning rendered only on small
 * viewports for surfaces that genuinely don't work well with thumb input
 * (Director Studio, the editor). The user can dismiss for the session.
 *
 * Drop this in at the top of any page that should nudge desktop:
 *   <DesktopRecommendedBanner surface="Director Studio" />
 *
 * It self-hides above 768px and remembers dismissal in sessionStorage so it
 * doesn't re-pester within a single session.
 */

import { useEffect, useState } from 'react';
import { Monitor, X, Mail, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  /** Human-readable name used in copy ("Director Studio", "Editor"). */
  surface: string;
  /** Optional URL the user might want to bookmark for later. */
  bookmarkPath?: string;
}

const DISMISS_KEY = (s: string) => `sb.desktop_banner_dismissed.${s}`;
const BREAKPOINT_PX = 768;

export function DesktopRecommendedBanner({ surface, bookmarkPath }: Props) {
  const { user, profile } = useAuth();
  const [isSmall, setIsSmall] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Track viewport size live so the banner appears on rotation / DevTools resize.
  useEffect(() => {
    const check = () => setIsSmall(window.innerWidth < BREAKPOINT_PX);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Remember dismissal for the session.
  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY(surface)) === '1');
    } catch {}
  }, [surface]);

  const close = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY(surface), '1');
    } catch {}
  };

  const emailMyself = async () => {
    if (!user || !profile) {
      toast.error('Sign in to email yourself a reminder');
      return;
    }
    setSending(true);
    try {
      const path = bookmarkPath ?? window.location.pathname + window.location.search;
      const { error } = await supabase.functions.invoke('send-transactional-email', {
        body: {
          template: 'user_welcome',
          recipientEmail: profile.email ?? user.email,
          templateData: {
            displayName:
              profile.display_name ?? profile.email?.split('@')[0] ?? 'there',
            // Re-use the welcome template's body but with a deep link.
            // (When a dedicated "open-on-desktop" template ships, swap here.)
            starterCredits: profile.credits_balance ?? 100,
          },
        },
      });
      if (error) throw error;
      setSent(true);
      toast.success('Check your inbox — link sent.');
    } catch (e) {
      console.error('[DesktopBanner] email failed', e);
      toast.error('Could not send the reminder right now.');
    } finally {
      setSending(false);
    }
  };

  if (!isSmall || dismissed) return null;

  return (
    <div className="relative mx-4 my-3 rounded-2xl border border-amber-400/30 bg-amber-500/[0.06] backdrop-blur-md p-4 flex items-start gap-3 z-30">
      <div className="w-9 h-9 rounded-xl border border-amber-400/30 bg-amber-500/[0.10] flex items-center justify-center shrink-0">
        <Monitor className="w-4 h-4 text-amber-300" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-amber-100 text-[13px] font-medium">
          {surface} is best on desktop.
        </div>
        <p className="text-amber-200/70 text-[12px] mt-1 leading-relaxed">
          You can keep going on mobile, but the canvas controls are dense and
          require precise pointer input. We&rsquo;ll email you the direct link if
          you&rsquo;d rather pick this up on a laptop.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {user ? (
            sent ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.22em] text-emerald-300">
                <Check className="w-3 h-3" /> Sent
              </span>
            ) : (
              <button
                onClick={emailMyself}
                disabled={sending}
                className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.22em] text-amber-100 hover:text-white px-3 py-1.5 rounded-md border border-amber-400/30 hover:border-amber-400/60 transition-colors disabled:opacity-50"
              >
                <Mail className="w-3 h-3" />
                {sending ? 'Sending…' : 'Email me the link'}
              </button>
            )
          ) : null}
          <button
            onClick={close}
            className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.22em] text-amber-200/60 hover:text-amber-100 px-3 py-1.5 rounded-md border border-transparent hover:border-amber-400/20 transition-colors"
          >
            Keep going anyway
          </button>
        </div>
      </div>
      <button
        onClick={close}
        aria-label="Dismiss"
        className="text-amber-200/55 hover:text-amber-100"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
