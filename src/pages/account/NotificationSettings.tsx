/**
 * NotificationSettings — the calm command center for the inbox.
 *
 * Mounted at /account/notifications. The bell's footer links here so
 * a user who's been overwhelmed by toasts can tune the room with two
 * clicks. Persists to `notification_preferences` via supabase upsert.
 *
 * Composition (top → bottom):
 *   - PageHeader   — eyebrow + italic display
 *   - Categories   — Comments · Reactions · Follows · Remixes ·
 *                    Publish-from-following · Admin support · System
 *   - Channels     — In-app · Email
 *   - Quiet hours  — start + end (24h clock), inclusive window
 *   - Save CTA     — bottom-right, accent ring, disabled until dirty
 *
 * Loads with the default-ON state if no preferences row exists yet,
 * matching the trigger fallback in fn_wants_notification.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Bell, MessageCircle, Heart, UserPlus, RefreshCcw,
  Megaphone, ShieldCheck, Sparkles, Mail, Smartphone, Moon,
  Loader2, Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TYPE_META } from '@/lib/design-system';
import { FoundationShell } from '@/components/foundation/FoundationShell';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Prefs {
  cat_comments: boolean;
  cat_reactions: boolean;
  cat_follows: boolean;
  cat_remixes: boolean;
  cat_publish: boolean;
  cat_admin: boolean;
  cat_system: boolean;
  ch_inapp: boolean;
  ch_email: boolean;
  quiet_start: number | null;
  quiet_end: number | null;
}

const DEFAULT_PREFS: Prefs = {
  cat_comments: true,
  cat_reactions: true,
  cat_follows: true,
  cat_remixes: true,
  cat_publish: true,
  cat_admin: true,
  cat_system: true,
  ch_inapp: true,
  ch_email: false,
  quiet_start: null,
  quiet_end: null,
};

interface CategoryRow {
  key: keyof Prefs;
  label: string;
  hint: string;
  Icon: typeof Bell;
}

const CATEGORIES: CategoryRow[] = [
  { key: 'cat_comments', label: 'Comments', hint: 'When someone responds to your work', Icon: MessageCircle },
  { key: 'cat_reactions', label: 'Reactions', hint: 'Hearts and emoji on your reels', Icon: Heart },
  { key: 'cat_follows', label: 'Follows', hint: 'When someone follows your channel', Icon: UserPlus },
  { key: 'cat_remixes', label: 'Remixes', hint: 'When someone remixes your reel', Icon: RefreshCcw },
  { key: 'cat_publish', label: 'New from following', hint: 'When creators you follow publish', Icon: Megaphone },
  { key: 'cat_admin', label: 'Admin support', hint: 'Replies to your support tickets', Icon: ShieldCheck },
  { key: 'cat_system', label: 'System', hint: 'Render done, account updates, billing', Icon: Sparkles },
];

interface ChannelRow {
  key: keyof Prefs;
  label: string;
  hint: string;
  Icon: typeof Bell;
}

const CHANNELS: ChannelRow[] = [
  { key: 'ch_inapp', label: 'In-app', hint: 'Bell + sonner toasts inside Small Bridges', Icon: Smartphone },
  { key: 'ch_email', label: 'Email', hint: 'Digest summaries delivered to your inbox', Icon: Mail },
];

const HOURS: Array<{ value: number; label: string }> = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${i.toString().padStart(2, '0')}:00`,
}));

export default function NotificationSettings() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [original, setOriginal] = useState<Prefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        // Table may not exist on a stale local — treat as defaults.
        // eslint-disable-next-line no-console
        console.warn('[NotificationSettings] load failed:', error.message);
      }
      const loaded: Prefs = data
        ? {
            cat_comments: data.cat_comments ?? true,
            cat_reactions: data.cat_reactions ?? true,
            cat_follows: data.cat_follows ?? true,
            cat_remixes: data.cat_remixes ?? true,
            cat_publish: data.cat_publish ?? true,
            cat_admin: data.cat_admin ?? true,
            cat_system: data.cat_system ?? true,
            ch_inapp: data.ch_inapp ?? true,
            ch_email: data.ch_email ?? false,
            quiet_start: data.quiet_start ?? null,
            quiet_end: data.quiet_end ?? null,
          }
        : DEFAULT_PREFS;
      setPrefs(loaded);
      setOriginal(loaded);
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // Key on the stable id, not the `user` object — AuthContext hands us a new
    // user reference on every token refresh / focus, which would otherwise
    // re-run this load and overwrite the user's in-progress (unsaved) edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const dirty = useMemo(
    () => JSON.stringify(prefs) !== JSON.stringify(original),
    [prefs, original],
  );

  const save = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('notification_preferences')
      .upsert({ user_id: user.id, ...prefs }, { onConflict: 'user_id' });
    if (error) {
      toast.error("Couldn't save preferences", { description: error.message });
    } else {
      toast.success('Preferences saved', { description: 'The room is tuned.' });
      setOriginal(prefs);
    }
    setSaving(false);
  }, [prefs, user]);

  const toggleBool = (key: keyof Prefs) => {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
  };

  return (
    <FoundationShell>
      <div className="relative max-w-[820px] mx-auto px-6 lg:px-10 py-10 pb-32">
        {/* Back link */}
        <Link
          to="/account"
          className={cn(
            'inline-flex items-center gap-2 text-[12px] font-mono uppercase tracking-[0.28em]',
            'text-muted-foreground/55 hover:text-foreground transition-colors',
          )}
        >
          <ArrowLeft className="h-3 w-3" />
          Account
        </Link>

        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6"
        >
          <p className={cn(TYPE_META, 'text-accent/70 tracking-[0.32em]')}>◆ Inbox</p>
          <h1
            className="mt-3 text-[clamp(2rem,4vw,3rem)] font-display italic font-light leading-[1.05] tracking-tight"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/65 bg-clip-text text-transparent">
              Notification settings.
            </span>
          </h1>
          <p className="mt-3 text-[14px] font-light leading-relaxed text-muted-foreground/70 max-w-[60ch]">
            Tune the room. Choose which moments deserve a tap on the bell,
            and when the bell should stay silent.
          </p>
        </motion.header>

        {loading ? (
          <div className="mt-16 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-accent" strokeWidth={1.5} />
          </div>
        ) : (
          <>
            {/* Categories */}
            <Section eyebrow="◆ Categories" title="What lands in the bell">
              <div className="space-y-1">
                {CATEGORIES.map((c) => (
                  <ToggleRow
                    key={c.key}
                    Icon={c.Icon}
                    label={c.label}
                    hint={c.hint}
                    on={prefs[c.key] as boolean}
                    onToggle={() => toggleBool(c.key)}
                  />
                ))}
              </div>
            </Section>

            {/* Channels */}
            <Section eyebrow="◆ Channels" title="How you hear about it">
              <div className="space-y-1">
                {CHANNELS.map((c) => (
                  <ToggleRow
                    key={c.key}
                    Icon={c.Icon}
                    label={c.label}
                    hint={c.hint}
                    on={prefs[c.key] as boolean}
                    onToggle={() => toggleBool(c.key)}
                  />
                ))}
              </div>
              <p className={cn(TYPE_META, 'mt-3 text-muted-foreground/50 px-4')}>
                Email digests use the same address as your account. Manage
                email content per type in{' '}
                <Link to="/account?tab=settings" className="text-accent/85 hover:text-accent">
                  email preferences
                </Link>
                .
              </p>
            </Section>

            {/* Quiet hours */}
            <Section eyebrow="◆ Quiet hours" title="When the bell stays silent">
              <div className="px-4 py-5 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                <div className="flex items-start gap-3">
                  <Moon className="h-4 w-4 text-accent/80 mt-1" strokeWidth={1.5} />
                  <div className="flex-1">
                    <p className="text-[13.5px] text-foreground/90">
                      Mute toasts and pushes during this window. The inbox
                      keeps every event so nothing is lost.
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-4">
                      <HourPicker
                        label="Start"
                        value={prefs.quiet_start}
                        onChange={(v) => setPrefs((p) => ({ ...p, quiet_start: v }))}
                      />
                      <span className="text-muted-foreground/40">→</span>
                      <HourPicker
                        label="End"
                        value={prefs.quiet_end}
                        onChange={(v) => setPrefs((p) => ({ ...p, quiet_end: v }))}
                      />
                      {(prefs.quiet_start != null || prefs.quiet_end != null) && (
                        <button
                          type="button"
                          onClick={() => setPrefs((p) => ({ ...p, quiet_start: null, quiet_end: null }))}
                          className="text-[11px] font-mono uppercase tracking-[0.22em] text-muted-foreground/55 hover:text-foreground transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Section>
          </>
        )}

        {/* Sticky save bar */}
        {!loading && (
          <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-white/[0.06] bg-[hsl(220_30%_3%/0.92)] backdrop-blur-xl">
            <div className="max-w-[820px] mx-auto px-6 lg:px-10 py-3 flex items-center justify-between">
              <span className={cn(TYPE_META, 'text-muted-foreground/55')}>
                {dirty ? 'Unsaved changes' : 'All saved'}
              </span>
              <button
                type="button"
                onClick={() => void save()}
                disabled={!dirty || saving}
                className={cn(
                  'inline-flex items-center gap-2 px-5 h-10 rounded-full text-[13px]',
                  'border border-accent/45 bg-gradient-to-br from-accent/22 to-accent/[0.06]',
                  'text-foreground transition-all',
                  'hover:border-accent/65 hover:from-accent/30',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                )}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                ) : (
                  <Check className="h-4 w-4 text-accent" strokeWidth={1.8} />
                )}
                <span>{saving ? 'Saving…' : 'Save preferences'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </FoundationShell>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────

function Section({
  eyebrow, title, children,
}: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <header className="mb-4 px-1">
        <p className={cn(TYPE_META, 'text-accent/65 tracking-[0.32em]')}>{eyebrow}</p>
        <h2
          className="mt-1.5 text-[20px] font-display italic font-light text-foreground/95"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          {title}
        </h2>
      </header>
      {children}
    </section>
  );
}

function ToggleRow({
  Icon, label, hint, on, onToggle,
}: {
  Icon: typeof Bell;
  label: string;
  hint: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={cn(
        'group/row w-full flex items-center gap-4 px-4 py-3 rounded-xl text-left transition-colors',
        on ? 'bg-[hsl(var(--accent)/0.04)]' : 'hover:bg-white/[0.02]',
      )}
    >
      <div className={cn(
        'shrink-0 flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-inset transition-colors',
        on
          ? 'bg-[hsl(var(--accent)/0.10)] ring-accent/40 text-accent'
          : 'bg-white/[0.02] ring-white/[0.06] text-muted-foreground/60',
      )}>
        <Icon className="h-4 w-4" strokeWidth={1.5} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] text-foreground/95">{label}</p>
        <p className={cn(TYPE_META, 'mt-0.5 text-muted-foreground/55 tracking-[0.16em]')}>
          {hint}
        </p>
      </div>
      <Switch on={on} />
    </button>
  );
}

function Switch({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        'relative inline-flex h-6 w-10 shrink-0 rounded-full transition-colors',
        on ? 'bg-[hsl(var(--accent))]' : 'bg-white/[0.08]',
      )}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        className={cn(
          'absolute top-0.5 inline-block h-5 w-5 rounded-full bg-white shadow-sm',
          on ? 'right-0.5' : 'left-0.5',
        )}
      />
    </span>
  );
}

function HourPicker({
  label, value, onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className={cn(TYPE_META, 'text-muted-foreground/55 tracking-[0.22em]')}>{label}</span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className={cn(
          'rounded-md bg-white/[0.04] border border-white/[0.08]',
          'px-2.5 py-1.5 text-[13px] font-mono tabular-nums text-foreground',
          'outline-none focus:border-accent/55',
        )}
      >
        <option value="">—</option>
        {HOURS.map((h) => (
          <option key={h.value} value={h.value}>{h.label}</option>
        ))}
      </select>
    </label>
  );
}
