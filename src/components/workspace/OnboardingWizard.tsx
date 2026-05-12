import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Sparkles, Users, Palette, Coins, Film, ArrowRight, X, RefreshCw, RotateCcw } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';

/**
 * First-run org onboarding wizard.
 * Auto-opens when the current organization has no `onboarded_at` timestamp.
 * Shows a guided 4-step checklist: invite team, set brand, add credits,
 * create first project. Each step deep-links to the relevant workspace page
 * and is auto-completed from live signals (members count, brand kit, credits,
 * projects). User can finish (sets onboarded_at) or skip.
 *
 * Dismissal is also tracked per-org in localStorage so the modal does not
 * re-open on every navigation while the user is mid-flow.
 */

type StepKey = 'team' | 'brand' | 'credits' | 'project';

interface StepDef {
  key: StepKey;
  label: string;
  description: string;
  Icon: typeof Users;
  to: string;
}

const STEPS: StepDef[] = [
  { key: 'team',    label: 'Invite your team',    description: 'Bring collaborators into the workspace.',         Icon: Users,   to: '/workspace/team' },
  { key: 'brand',   label: 'Set your brand',      description: 'Lock colors, voice and identity.',                Icon: Palette, to: '/workspace/brand' },
  { key: 'credits', label: 'Add credits',         description: 'Top up so your team can generate.',               Icon: Coins,   to: '/workspace/credits' },
  { key: 'project', label: 'Create first project', description: 'Open the studio and ship your first cut.',       Icon: Film,    to: '/workspace/create' },
];

interface Signals { team: boolean; brand: boolean; credits: boolean; project: boolean }
type Overrides = Partial<Record<StepKey, boolean>>;

interface AuditEntry {
  id: string;
  step: StepKey;
  action: 'mark_done' | 'undo';
  created_at: string;
  actor_id: string;
  actor_name?: string | null;
  reason?: string | null;
}

const DISMISS_KEY = (orgId: string) => `apex.workspace.onboarding.dismissed.${orgId}`;
const AUTOCLEAR_KEY = (orgId: string) => `apex.workspace.onboarding.autoclear.${orgId}`;

export function OnboardingWizard() {
  const { currentOrg, hasPermission } = useWorkspace();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [signals, setSignals] = useState<Signals>({ team: false, brand: false, credits: false, project: false });
  const [overrides, setOverrides] = useState<Overrides>({});
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState<number | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [reasonFor, setReasonFor] = useState<StepKey | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [reasonBusy, setReasonBusy] = useState(false);
  const [undoFor, setUndoFor] = useState<StepKey | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);
  const [autoClear, setAutoClear] = useState<boolean>(true);
  const autoClearRef = useRef(true);
  useEffect(() => { autoClearRef.current = autoClear; }, [autoClear]);

  // Hydrate per-org auto-clear preference (default ON).
  useEffect(() => {
    if (!currentOrg) return;
    try {
      const v = localStorage.getItem(AUTOCLEAR_KEY(currentOrg.id));
      setAutoClear(v === null ? true : v === '1');
    } catch { setAutoClear(true); }
  }, [currentOrg?.id]);

  const persistAutoClear = useCallback((next: boolean) => {
    setAutoClear(next);
    if (!currentOrg) return;
    try { localStorage.setItem(AUTOCLEAR_KEY(currentOrg.id), next ? '1' : '0'); } catch {}
  }, [currentOrg?.id]);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    // Only show to admins/owners — viewers/producers can't act on the steps.
    if (!hasPermission('admin')) return;

    // Fetch onboarded_at + dependent signals in parallel.
    try {
      const [orgResRaw, members, brandKits, projects] = await Promise.all([
        (supabase.from('organizations') as any).select('onboarded_at, credits_balance, total_credits_purchased, brand_primary_color, onboarding_overrides').eq('id', currentOrg.id).maybeSingle(),
        supabase.from('organization_members').select('id', { count: 'exact', head: true }).eq('organization_id', currentOrg.id),
        supabase.from('brand_kits').select('id', { count: 'exact', head: true }).eq('organization_id', currentOrg.id),
        supabase.from('movie_projects').select('id', { count: 'exact', head: true }).eq('organization_id', currentOrg.id),
      ]);
      const orgRes = orgResRaw as { data: any; error: any };

      const firstError = orgRes.error || members.error || brandKits.error || projects.error;
      if (firstError) throw firstError;

      const onboarded = !!orgRes.data?.onboarded_at;
      const ovRaw = (orgRes.data as any)?.onboarding_overrides;
      const ov: Overrides = (ovRaw && typeof ovRaw === 'object' && !Array.isArray(ovRaw)) ? ovRaw : {};
      const dismissed = (() => { try { return localStorage.getItem(DISMISS_KEY(currentOrg.id)) === '1'; } catch { return false; } })();

      const sig: Signals = {
        team:    (members.count ?? 0) > 1,
        brand:   (brandKits.count ?? 0) > 0 || !!orgRes.data?.brand_primary_color,
        credits: (orgRes.data?.credits_balance ?? 0) > 0 || (orgRes.data?.total_credits_purchased ?? 0) > 0,
        project: (projects.count ?? 0) > 0,
      };
      setSignals(sig);
      setOverrides(ov);
      setLoadError(null);
      setLastChecked(Date.now());

      // Auto-clear: when an auto signal becomes true and a manual override
      // also exists for that step, the override is now redundant — silently
      // undo it so the audit log stays clean and accurate.
      if (autoClearRef.current) {
        const stale = (Object.keys(ov) as StepKey[]).filter(k => ov[k] && sig[k]);
        if (stale.length) {
          // Optimistic local clear
          setOverrides(o => {
            const copy: Overrides = { ...o };
            for (const k of stale) copy[k] = undefined;
            return copy;
          });
          // Fire-and-forget RPCs (each writes its own audit entry).
          Promise.all(stale.map(k =>
            (supabase.rpc as any)('set_org_onboarding_override', {
              p_org: currentOrg.id, p_step: k, p_done: false,
            })
          )).then((results: any[]) => {
            const failed = results.filter(r => r?.error).length;
            if (failed === 0 && stale.length > 0) {
              const labels = stale.map(k => STEPS.find(s => s.key === k)?.label ?? k).join(', ');
              toast.success('Manual override cleared', {
                description: `Auto-detected: ${labels}`,
              });
            }
          }).catch(() => { /* silent */ });
        }
      }

      if (!onboarded && !dismissed) setOpen(true);

      // Audit log (best-effort — failures here must not break the checklist).
      try {
        const { data: auditRows } = await (supabase
          .from('onboarding_override_audit') as any)
          .select('id, step, action, created_at, actor_id, reason')
          .eq('org_id', currentOrg.id)
          .order('created_at', { ascending: false })
          .limit(8);
        const rows: AuditEntry[] = Array.isArray(auditRows) ? auditRows : [];
        const ids = Array.from(new Set(rows.map(r => r.actor_id))).filter(Boolean);
        let nameMap: Record<string, string> = {};
        if (ids.length) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, display_name, email')
            .in('id', ids);
          (profs ?? []).forEach((p: any) => {
            nameMap[p.id] = p.display_name || p.email || 'Admin';
          });
        }
        setAudit(rows.map(r => ({ ...r, actor_name: nameMap[r.actor_id] ?? 'Admin' })));
      } catch (e) {
        // silent — audit is informational
        console.debug('[OnboardingWizard] audit fetch failed', e);
      }
    } catch (err: any) {
      const msg = err?.message || 'Could not load onboarding status.';
      console.error('[OnboardingWizard] load failed:', err);
      setLoadError(msg);
      // Only toast when the modal is actually visible — silent on background polls
      // before the wizard ever opened.
      if (open) toast.error('Onboarding checklist unavailable', { description: msg });
    }
  }, [currentOrg, hasPermission, open]);

  const recheck = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    const before = completedCountRef.current;
    await load();
    const after = Object.values(signalsRef.current).filter(Boolean).length;
    if (after > before) {
      toast.success(`${after - before} step${after - before > 1 ? 's' : ''} completed`);
    } else if (!loadError) {
      toast('Checklist up to date', { description: 'No new progress detected yet.' });
    }
    // small minimum spin so the user feels the refresh
    setTimeout(() => setRefreshing(false), 350);
  }, [load, refreshing, loadError]);

  useEffect(() => { load(); }, [load]);

  // While the wizard is open, re-check completion signals every 4s so
  // freshly invited members, brand kits, top-ups or new projects tick
  // automatically without requiring a manual refresh.
  useEffect(() => {
    if (!open || !currentOrg) return;
    const id = window.setInterval(() => { load(); }, 4000);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => { window.clearInterval(id); window.removeEventListener('focus', onFocus); };
  }, [open, currentOrg, load]);

  const isDone = (k: StepKey) => signals[k] || !!overrides[k];
  const completed = STEPS.filter(s => isDone(s.key)).length;
  const total = STEPS.length;
  const allDone = completed === total;

  const isAdmin = hasPermission('admin');

  const toggleOverride = useCallback(async (key: StepKey, next: boolean) => {
    if (!currentOrg || !isAdmin) return;
    // Marking done now requires a reason — open the reason dialog instead of
    // immediately calling the RPC. Undo proceeds without prompting.
    if (next) {
      setReasonFor(key);
      setReasonText('');
      return;
    }
    // Undo also requires explicit confirmation to prevent accidental
    // reversal of a manual decision.
    setUndoFor(key);
  }, [currentOrg, isAdmin]);

  const confirmUndo = useCallback(async () => {
    if (!currentOrg || !undoFor) return;
    const key = undoFor;
    const prev = overrides;
    setUndoBusy(true);
    setOverrides(o => ({ ...o, [key]: undefined }) as Overrides);
    const { error } = await (supabase.rpc as any)('set_org_onboarding_override', {
      p_org: currentOrg.id, p_step: key, p_done: false,
    });
    setUndoBusy(false);
    if (error) {
      setOverrides(prev);
      toast.error('Could not undo override', { description: error.message });
      return;
    }
    toast.success('Override removed');
    setUndoFor(null);
    load();
  }, [currentOrg, undoFor, overrides, load]);

  const submitReason = useCallback(async () => {
    if (!currentOrg || !reasonFor) return;
    const trimmed = reasonText.trim();
    if (trimmed.length < 3) {
      toast.error('Reason required', { description: 'Please enter at least 3 characters.' });
      return;
    }
    if (trimmed.length > 280) {
      toast.error('Reason too long', { description: 'Keep it under 280 characters.' });
      return;
    }
    setReasonBusy(true);
    const key = reasonFor;
    const prev = overrides;
    setOverrides(o => ({ ...o, [key]: true }) as Overrides);
    const { error } = await (supabase.rpc as any)('set_org_onboarding_override', {
      p_org: currentOrg.id, p_step: key, p_done: true, p_reason: trimmed,
    });
    setReasonBusy(false);
    if (error) {
      setOverrides(prev);
      toast.error('Could not mark step done', { description: error.message });
      return;
    }
    toast.success('Step marked done');
    setReasonFor(null);
    setReasonText('');
    load();
  }, [currentOrg, reasonFor, reasonText, overrides, load]);

  // Refs so `recheck` can compare before/after without re-binding on every render.
  const completedCountRef = useRef(completed);
  const signalsRef = useRef(signals);
  useEffect(() => { completedCountRef.current = completed; signalsRef.current = signals; }, [completed, signals]);

  const handleClose = (markFinished: boolean) => {
    if (!currentOrg) return;
    try { localStorage.setItem(DISMISS_KEY(currentOrg.id), '1'); } catch {}
    setOpen(false);
    if (markFinished) {
      // Fire-and-forget — wizard never blocks the UI on this.
      supabase.rpc('mark_org_onboarded', { p_org: currentOrg.id }).then(({ error }) => {
        if (error) toast.error('Could not mark workspace ready', { description: error.message });
      });
    }
  };

  const finish = async () => {
    if (!currentOrg) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc('mark_org_onboarded', { p_org: currentOrg.id });
      if (error) throw error;
      try { localStorage.removeItem(DISMISS_KEY(currentOrg.id)); } catch {}
      toast.success('Workspace marked as ready');
      setOpen(false);
    } catch (err: any) {
      const msg = err?.message || 'Please try again in a moment.';
      console.error('[OnboardingWizard] mark_org_onboarded failed:', err);
      toast.error('Could not finish setup', { description: msg });
    } finally { setBusy(false); }
  };

  const go = (to: string) => {
    if (!currentOrg) return;
    try { localStorage.setItem(DISMISS_KEY(currentOrg.id), '1'); } catch {}
    setOpen(false);
    navigate(to);
  };

  if (!currentOrg) return null;

  const pct = Math.round((completed / total) * 100);

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(false); }}>
      <DialogContent
        className="max-w-[560px] p-0 overflow-hidden border border-white/[0.08] bg-[hsl(220,16%,4%)]/95 backdrop-blur-2xl rounded-3xl shadow-[0_40px_120px_-20px_rgba(0,0,0,0.7)]"
      >
        {/* Hero */}
        <div className="relative px-7 pt-7 pb-5">
          <button
            onClick={() => handleClose(false)}
            aria-label="Dismiss"
            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-white/45 hover:text-white/85 hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
          <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.32em] text-[hsl(215,100%,72%)]">
            <Sparkles className="w-3 h-3" strokeWidth={1.5} /> Welcome
          </div>
          <h2 className="mt-3 font-display text-[26px] leading-[1.1] tracking-[-0.02em] text-white/95 font-light">
            Set up <span className="italic text-white">{currentOrg.name}</span>
          </h2>
          <p className="mt-2 text-[13px] text-white/55 font-light max-w-[440px]">
            Four quick moves and your workspace is ready to ship. Pick up where you left off any time.
          </p>

          {/* Progress */}
          <div className="mt-5 flex items-center gap-3">
            <div className="flex-1 h-[3px] rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{
                  width: `${pct}%`,
                  background: 'linear-gradient(90deg, hsl(215,100%,62%), hsl(215,100%,46%))',
                  boxShadow: '0 0 18px hsla(215,100%,55%,0.45)',
                }}
              />
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55 tabular-nums">
              {completed}/{total}
            </div>
          </div>
        </div>

        {/* Checklist */}
        <div className="px-3 pb-3">
          {loadError && (
            <div className="mx-3 mb-2 flex items-start gap-2.5 rounded-2xl border border-[hsl(0,70%,55%/0.25)] bg-[hsl(0,60%,30%/0.12)] px-3 py-2.5">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-[hsl(0,90%,72%)] shrink-0" strokeWidth={1.8} />
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-[hsl(0,90%,78%)]">Checklist offline</div>
                <div className="text-[12px] text-white/70 font-light mt-0.5 break-words">{loadError}</div>
              </div>
              <button
                onClick={() => load()}
                className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/70 hover:text-white px-2 py-1 rounded-full border border-white/[0.1] hover:bg-white/[0.05] transition-colors shrink-0"
              >
                Retry
              </button>
            </div>
          )}
          <ul className="space-y-1">
            {STEPS.map(({ key, label, description, Icon, to }) => {
              const auto = signals[key];
              const overridden = !!overrides[key];
              const done = auto || overridden;
              return (
                <li key={key}>
                  <div
                    className={cn(
                      'group flex items-center gap-4 rounded-2xl px-4 py-3 transition-all duration-300',
                      'border border-transparent hover:border-white/[0.08] hover:bg-white/[0.03]',
                    )}
                  >
                    <button
                      onClick={() => go(to)}
                      className="flex items-center gap-4 flex-1 min-w-0 text-left"
                    >
                      <div
                        className={cn(
                          'w-9 h-9 shrink-0 rounded-2xl flex items-center justify-center transition-all duration-300',
                          done
                            ? 'bg-gradient-to-br from-[hsl(215,100%,55%)] to-[hsl(215,100%,38%)] text-white shadow-[0_8px_24px_-10px_hsla(215,100%,55%,0.7)]'
                            : 'bg-white/[0.04] text-white/55 border border-white/[0.06]',
                        )}
                      >
                        {done ? <Check className="w-4 h-4" strokeWidth={2.4} /> : <Icon className="w-4 h-4" strokeWidth={1.5} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className={cn('font-display text-[14px] tracking-[-0.01em] leading-tight', done ? 'text-white/55 line-through decoration-white/30' : 'text-white/95')}>
                            {label}
                          </div>
                          {overridden && !auto && (
                            <span className="font-mono text-[8.5px] uppercase tracking-[0.22em] px-1.5 py-[2px] rounded-full text-[hsl(215,100%,78%)] border border-[hsl(215,100%,55%/0.3)] bg-[hsl(215,100%,40%/0.12)]">
                              Manual
                            </span>
                          )}
                        </div>
                        <div className="text-[12px] text-white/45 font-light mt-0.5">{description}</div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-white/30 group-hover:text-white/80 group-hover:translate-x-0.5 transition-all shrink-0" strokeWidth={1.5} />
                    </button>
                    {isAdmin && (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleOverride(key, !overridden); }}
                        title={overridden ? 'Undo manual override' : (auto ? 'Step already auto-detected' : 'Mark this step done manually')}
                        disabled={auto && !overridden}
                        className={cn(
                          'shrink-0 inline-flex items-center gap-1 px-2.5 h-7 rounded-full font-mono text-[9px] uppercase tracking-[0.22em] transition-colors',
                          'border border-white/[0.08] text-white/55 hover:text-white hover:bg-white/[0.06]',
                          (auto && !overridden) && 'opacity-30 cursor-not-allowed hover:bg-transparent hover:text-white/55',
                          overridden && 'text-[hsl(215,100%,78%)] border-[hsl(215,100%,55%/0.3)]',
                        )}
                      >
                        {overridden ? <><RotateCcw className="w-2.5 h-2.5" strokeWidth={1.8} />Undo</> : <><Check className="w-2.5 h-2.5" strokeWidth={2} />Mark done</>}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {isAdmin && (
            <div className="mt-5 mx-3 rounded-2xl border border-white/[0.06] bg-white/[0.015] px-4 py-3">
              <div className="flex items-center justify-between mb-3 gap-3">
                <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/55 shrink-0">
                  Override audit
                </div>
                <button
                  onClick={() => persistAutoClear(!autoClear)}
                  title="When the underlying signal is detected, auto-clear the manual override and log it."
                  className="group inline-flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.22em] text-white/55 hover:text-white transition-colors"
                >
                  <span
                    aria-hidden
                    className={cn(
                      'relative inline-flex w-7 h-3.5 rounded-full transition-colors',
                      autoClear
                        ? 'bg-[hsl(215,100%,55%)]/70 border border-[hsl(215,100%,55%/0.4)]'
                        : 'bg-white/[0.06] border border-white/[0.08]',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-[1px] w-2.5 h-2.5 rounded-full bg-white shadow transition-all',
                        autoClear ? 'left-[14px]' : 'left-[1px]',
                      )}
                    />
                  </span>
                  Auto-clear when detected
                </button>
              </div>
              {audit.length === 0 && (
                <div className="text-[12px] text-white/40 font-light italic">
                  No manual overrides yet.
                </div>
              )}
              <ul className="space-y-1.5">
                {audit.map(entry => {
                  const stepLabel = STEPS.find(s => s.key === entry.step)?.label ?? entry.step;
                  const when = (() => {
                    try {
                      const d = new Date(entry.created_at);
                      const diffMs = Date.now() - d.getTime();
                      const mins = Math.round(diffMs / 60000);
                      if (mins < 1) return 'just now';
                      if (mins < 60) return `${mins}m ago`;
                      const hrs = Math.round(mins / 60);
                      if (hrs < 24) return `${hrs}h ago`;
                      const days = Math.round(hrs / 24);
                      if (days < 7) return `${days}d ago`;
                      return d.toLocaleDateString();
                    } catch { return ''; }
                  })();
                  const verb = entry.action === 'mark_done' ? 'marked done' : 'undid';
                  const tone = entry.action === 'mark_done'
                    ? 'text-[hsl(215,100%,78%)]'
                    : 'text-[hsl(35,90%,72%)]';
                  return (
                    <li key={entry.id} className="flex items-center gap-2 text-[12px] text-white/65 font-light">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-white/85">{entry.actor_name}</span>
                          <span className={cn('font-mono text-[9px] uppercase tracking-[0.22em] shrink-0', tone)}>
                            {verb}
                          </span>
                          <span className="truncate text-white/55">{stepLabel}</span>
                        </div>
                        {entry.reason && (
                          <div className="mt-0.5 text-[11px] text-white/45 font-light italic truncate" title={entry.reason}>
                            “{entry.reason}”
                          </div>
                        )}
                      </div>
                      <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.22em] text-white/35 shrink-0">
                        {when}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-white/[0.05] bg-white/[0.015]">
          <div className="flex items-center gap-4">
            <button
              onClick={() => handleClose(false)}
              className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45 hover:text-white/80 transition-colors"
            >
              Remind me later
            </button>
            <button
              onClick={recheck}
              disabled={refreshing}
              className={cn(
                'group inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-white/55 hover:text-white transition-colors',
                refreshing && 'opacity-70 cursor-wait',
              )}
              title={lastChecked ? `Last checked ${new Date(lastChecked).toLocaleTimeString()}` : 'Re-check progress'}
            >
              <RefreshCw
                className={cn('w-3 h-3', refreshing && 'animate-spin')}
                strokeWidth={1.8}
              />
              Re-check progress
            </button>
          </div>
          <button
            onClick={finish}
            disabled={busy}
            className={cn(
              'group inline-flex items-center gap-2 px-5 h-10 rounded-full font-mono text-[10px] uppercase tracking-[0.22em] transition-all duration-300',
              allDone
                ? 'bg-gradient-to-r from-[hsl(215,100%,55%)] to-[hsl(215,100%,42%)] text-white shadow-[0_10px_30px_-10px_hsla(215,100%,55%,0.7)] hover:brightness-110'
                : 'bg-white/[0.05] text-white/85 border border-white/[0.08] hover:bg-white/[0.08]',
              busy && 'opacity-60 cursor-wait',
            )}
          >
            {allDone ? 'Finish setup' : 'Mark workspace ready'}
            <Check className="w-3 h-3" strokeWidth={2} />
          </button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={reasonFor !== null} onOpenChange={(o) => { if (!o) { setReasonFor(null); setReasonText(''); } }}>
      <DialogContent className="max-w-md p-0 gap-0 border border-white/[0.08] bg-[hsl(220,14%,4%)] rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-white/[0.05]">
          <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-[hsl(215,100%,72%)] mb-1.5">
            Manual override
          </div>
          <div className="font-display text-[18px] tracking-[-0.01em] text-white/95">
            Why mark “{STEPS.find(s => s.key === reasonFor)?.label ?? 'this step'}” done?
          </div>
          <div className="mt-1 text-[12px] text-white/45 font-light">
            A short reason is required so this override stays traceable in the audit log.
          </div>
        </div>
        <div className="px-6 py-4">
          <textarea
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value.slice(0, 280))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submitReason(); }
            }}
            autoFocus
            rows={3}
            placeholder="e.g. Team invites sent via SSO, signal not detected"
            className="w-full resize-none rounded-xl bg-white/[0.03] border border-white/[0.08] px-3 py-2.5 text-[13px] text-white/90 placeholder:text-white/30 focus:outline-none focus:border-[hsl(215,100%,55%/0.5)] focus:bg-white/[0.05] transition-colors font-light"
          />
          <div className="mt-1.5 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.22em] text-white/35">
            <span>Min 3 · Max 280</span>
            <span>{reasonText.trim().length}/280</span>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-white/[0.05] bg-white/[0.015]">
          <button
            onClick={() => { setReasonFor(null); setReasonText(''); }}
            disabled={reasonBusy}
            className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55 hover:text-white px-3 h-9 rounded-full transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submitReason}
            disabled={reasonBusy || reasonText.trim().length < 3}
            className={cn(
              'inline-flex items-center gap-1.5 px-4 h-9 rounded-full font-mono text-[10px] uppercase tracking-[0.22em] transition-all',
              'bg-gradient-to-r from-[hsl(215,100%,55%)] to-[hsl(215,100%,42%)] text-white shadow-[0_8px_24px_-10px_hsla(215,100%,55%,0.7)] hover:brightness-110',
              (reasonBusy || reasonText.trim().length < 3) && 'opacity-50 cursor-not-allowed hover:brightness-100',
            )}
          >
            <Check className="w-3 h-3" strokeWidth={2} />
            {reasonBusy ? 'Saving…' : 'Mark done'}
          </button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={undoFor !== null} onOpenChange={(o) => { if (!o && !undoBusy) setUndoFor(null); }}>
      <DialogContent className="max-w-md p-0 gap-0 border border-white/[0.08] bg-[hsl(220,14%,4%)] rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-white/[0.05]">
          <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-[hsl(35,90%,72%)] mb-1.5">
            Undo manual override
          </div>
          <div className="font-display text-[18px] tracking-[-0.01em] text-white/95">
            Undo “{STEPS.find(s => s.key === undoFor)?.label ?? 'this step'}”?
          </div>
          <div className="mt-1.5 text-[12px] text-white/55 font-light leading-relaxed">
            This removes the manual completion. If the underlying signal is not yet
            detected, the step will revert to <span className="text-white/85">incomplete</span>.
            The change is recorded in the audit log.
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-white/[0.05] bg-white/[0.015]">
          <button
            onClick={() => setUndoFor(null)}
            disabled={undoBusy}
            className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55 hover:text-white px-3 h-9 rounded-full transition-colors"
          >
            Keep override
          </button>
          <button
            onClick={confirmUndo}
            disabled={undoBusy}
            className={cn(
              'inline-flex items-center gap-1.5 px-4 h-9 rounded-full font-mono text-[10px] uppercase tracking-[0.22em] transition-all',
              'bg-[hsl(35,90%,55%)]/15 text-[hsl(35,90%,82%)] border border-[hsl(35,90%,55%/0.4)] hover:bg-[hsl(35,90%,55%)]/25',
              undoBusy && 'opacity-60 cursor-wait',
            )}
          >
            <RotateCcw className="w-3 h-3" strokeWidth={1.8} />
            {undoBusy ? 'Undoing…' : 'Undo override'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

export default OnboardingWizard;