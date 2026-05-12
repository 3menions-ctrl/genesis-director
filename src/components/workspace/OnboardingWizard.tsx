import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Sparkles, Users, Palette, Coins, Film, ArrowRight, X } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

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

const DISMISS_KEY = (orgId: string) => `apex.workspace.onboarding.dismissed.${orgId}`;

export function OnboardingWizard() {
  const { currentOrg, hasPermission } = useWorkspace();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [signals, setSignals] = useState<Signals>({ team: false, brand: false, credits: false, project: false });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    // Only show to admins/owners — viewers/producers can't act on the steps.
    if (!hasPermission('admin')) return;

    // Fetch onboarded_at + dependent signals in parallel.
    const [orgRes, members, brandKits, projects] = await Promise.all([
      supabase.from('organizations').select('onboarded_at, credits_balance, total_credits_purchased, brand_primary_color').eq('id', currentOrg.id).maybeSingle(),
      supabase.from('organization_members').select('id', { count: 'exact', head: true }).eq('organization_id', currentOrg.id),
      supabase.from('brand_kits').select('id', { count: 'exact', head: true }).eq('organization_id', currentOrg.id),
      supabase.from('movie_projects').select('id', { count: 'exact', head: true }).eq('organization_id', currentOrg.id),
    ]);

    const onboarded = !!orgRes.data?.onboarded_at;
    const dismissed = (() => { try { return localStorage.getItem(DISMISS_KEY(currentOrg.id)) === '1'; } catch { return false; } })();

    const sig: Signals = {
      team:    (members.count ?? 0) > 1,
      brand:   (brandKits.count ?? 0) > 0 || !!orgRes.data?.brand_primary_color,
      credits: (orgRes.data?.credits_balance ?? 0) > 0 || (orgRes.data?.total_credits_purchased ?? 0) > 0,
      project: (projects.count ?? 0) > 0,
    };
    setSignals(sig);

    if (!onboarded && !dismissed) setOpen(true);
  }, [currentOrg, hasPermission]);

  useEffect(() => { load(); }, [load]);

  const completed = Object.values(signals).filter(Boolean).length;
  const total = STEPS.length;
  const allDone = completed === total;

  const handleClose = (markFinished: boolean) => {
    if (!currentOrg) return;
    try { localStorage.setItem(DISMISS_KEY(currentOrg.id), '1'); } catch {}
    setOpen(false);
    if (markFinished) {
      // Fire-and-forget — wizard never blocks the UI on this.
      supabase.rpc('mark_org_onboarded', { p_org: currentOrg.id }).then(() => {});
    }
  };

  const finish = async () => {
    if (!currentOrg) return;
    setBusy(true);
    try {
      await supabase.rpc('mark_org_onboarded', { p_org: currentOrg.id });
      try { localStorage.removeItem(DISMISS_KEY(currentOrg.id)); } catch {}
      setOpen(false);
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
          <ul className="space-y-1">
            {STEPS.map(({ key, label, description, Icon, to }) => {
              const done = signals[key];
              return (
                <li key={key}>
                  <button
                    onClick={() => go(to)}
                    className={cn(
                      'group w-full flex items-center gap-4 rounded-2xl px-4 py-3 text-left transition-all duration-300',
                      'border border-transparent hover:border-white/[0.08] hover:bg-white/[0.03]',
                    )}
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
                      <div className={cn('font-display text-[14px] tracking-[-0.01em] leading-tight', done ? 'text-white/55 line-through decoration-white/30' : 'text-white/95')}>
                        {label}
                      </div>
                      <div className="text-[12px] text-white/45 font-light mt-0.5">{description}</div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-white/30 group-hover:text-white/80 group-hover:translate-x-0.5 transition-all" strokeWidth={1.5} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-white/[0.05] bg-white/[0.015]">
          <button
            onClick={() => handleClose(false)}
            className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45 hover:text-white/80 transition-colors"
          >
            Remind me later
          </button>
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
  );
}

export default OnboardingWizard;