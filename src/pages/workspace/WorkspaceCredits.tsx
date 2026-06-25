import { useEffect, useState } from 'react';
import { Coins, TrendingDown, RefreshCcw, AlertTriangle, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { WorkspacePage } from '@/components/workspace/PageShell';
import { Surface, MetricCard, CmdButton, Pill, Field, DataInput } from '@/components/workspace/command-ui';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { safeErrorMessage } from '@/lib/safeErrorMessage';

import { usePageMeta } from '@/hooks/usePageMeta';
export default function WorkspaceCredits() {
  usePageMeta({ title: "Workspace Credits — Small Bridges" });

  const { currentOrg, hasPermission } = useWorkspace();
  const canEdit = hasPermission('admin');
  const balance = currentOrg?.credits_balance ?? 0;
  const low = balance < 500;

  const [enabled, setEnabled] = useState(false);
  const [threshold, setThreshold] = useState<number>(500);
  const [amount, setAmount] = useState<number>(2000);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [alertDaily, setAlertDaily] = useState<string>('');
  const [alertWeekly, setAlertWeekly] = useState<string>('');
  const [savingAlerts, setSavingAlerts] = useState(false);

  useEffect(() => {
    if (!currentOrg) return;
    (async () => {
      const { data } = await supabase.from('organizations')
        .select('auto_recharge_enabled, auto_recharge_threshold, auto_recharge_amount')
        .eq('id', currentOrg.id).maybeSingle();
      if (data) {
        setEnabled(!!(data as any).auto_recharge_enabled);
        if ((data as any).auto_recharge_threshold) setThreshold((data as any).auto_recharge_threshold);
        if ((data as any).auto_recharge_amount) setAmount((data as any).auto_recharge_amount);
      }
      const { data: alerts } = await supabase.from('organizations')
        .select('spend_alert_daily, spend_alert_weekly')
        .eq('id', currentOrg.id).maybeSingle();
      if (alerts) {
        setAlertDaily((alerts as any).spend_alert_daily?.toString() ?? '');
        setAlertWeekly((alerts as any).spend_alert_weekly?.toString() ?? '');
      }
    })();
  }, [currentOrg?.id]);

  const saveAlerts = async () => {
    if (!currentOrg) return;
    const d = alertDaily.trim() === '' ? null : Math.max(0, parseInt(alertDaily, 10));
    const w = alertWeekly.trim() === '' ? null : Math.max(0, parseInt(alertWeekly, 10));
    setSavingAlerts(true);
    const { error } = await supabase.rpc('set_org_spend_alerts', {
      p_org: currentOrg.id, p_daily: d, p_weekly: w,
    } as any);
    setSavingAlerts(false);
    if (error) return toast.error(safeErrorMessage(error, "Couldn't save spend alerts. Please try again."));
    toast.success('Spend alerts saved');
  };

  const save = async (turnOn: boolean) => {
    if (!currentOrg) return;
    setSaving(true);
    const { error } = await supabase.rpc('set_org_auto_recharge', {
      p_org: currentOrg.id, p_enabled: turnOn, p_threshold: threshold, p_amount: amount,
    } as any);
    setSaving(false);
    if (error) return toast.error(safeErrorMessage(error, "Couldn't update auto-recharge. Please try again."));
    setEnabled(turnOn);
    setOpen(false);
    toast.success(turnOn ? 'Auto-recharge armed' : 'Auto-recharge disabled');
  };

  return (
    <WorkspacePage
      icon={Coins}
      eyebrow="Optimize · Spend"
      title="Credits"
      description="Pooled credit balance shared by every workspace member. Refills monthly with your plan."
      actions={
        <Link to="/workspace/billing">
          <CmdButton variant="primary"><Coins className="w-3 h-3" /> Top up</CmdButton>
        </Link>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard label="Pool balance" value={balance} sub="credits available" icon={Coins} accent />
        <MetricCard label="Refill cadence" value="Monthly" sub="On plan renewal" icon={RefreshCcw} />
        <MetricCard label="Low-balance alert" value={low ? 'ACTIVE' : 'OK'} sub="Threshold: 10%" icon={AlertTriangle} warn={low} />
      </div>

      <Surface>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[hsl(220,14%,90%)]">
              Auto-recharge
            </div>
          <p className="text-[12px] text-white/50 mt-2 max-w-xl font-light">
            When the pool drops below the threshold, automatically purchase a top-up so productions never stall mid-pipeline.
          </p>
          {enabled && (
            <p className="text-[12px] text-white/65 mt-2 font-mono">
              Buys <span className="text-[hsl(215,100%,72%)]">{amount.toLocaleString()}</span> credits when balance drops below <span className="text-[hsl(215,100%,72%)]">{threshold.toLocaleString()}</span>.
            </p>
          )}
          </div>
        <Pill tone={enabled ? 'good' : 'neutral'}>{enabled ? 'ARMED' : 'DISABLED'}</Pill>
        </div>
        <div className="mt-5 flex gap-2">
        <CmdButton variant={enabled ? 'ghost' : 'primary'} disabled={!canEdit} onClick={() => setOpen(true)}>
          {enabled ? 'Edit auto-recharge' : 'Configure auto-recharge'}
        </CmdButton>
        {enabled && (
          <CmdButton variant="ghost" disabled={!canEdit || saving} onClick={() => save(false)}>Disable</CmdButton>
        )}
          <Link to="/workspace/analytics"><CmdButton variant="ghost"><TrendingDown className="w-3 h-3" /> View burn report</CmdButton></Link>
        </div>
      </Surface>

    <Surface>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[hsl(220,14%,90%)]">
            Spend alerts
          </div>
          <p className="text-[12px] text-white/50 mt-2 max-w-xl font-light">
            Email the workspace owner when daily or weekly spend exceeds a threshold. Leave a field blank to disable that alert.
          </p>
        </div>
        <Pill tone={(alertDaily || alertWeekly) ? 'good' : 'neutral'}>
          {(alertDaily || alertWeekly) ? 'ARMED' : 'OFF'}
        </Pill>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5 max-w-xl">
        <Field label="Daily ceiling (credits)">
          <DataInput type="number" value={alertDaily} placeholder="e.g. 500" disabled={!canEdit}
                     onChange={(e) => setAlertDaily(e.target.value)} />
        </Field>
        <Field label="Weekly ceiling (credits)">
          <DataInput type="number" value={alertWeekly} placeholder="e.g. 2500" disabled={!canEdit}
                     onChange={(e) => setAlertWeekly(e.target.value)} />
        </Field>
      </div>
      <div className="mt-4">
        <CmdButton variant="ghost" disabled={!canEdit || savingAlerts} onClick={saveAlerts}>
          {savingAlerts ? 'Saving…' : 'Save alerts'}
        </CmdButton>
      </div>
    </Surface>

    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="bg-[hsl(220,14%,4%)] border-white/[0.08] text-white">
        <DialogHeader>
          <DialogTitle className="font-display font-light text-[20px]">Configure auto-recharge</DialogTitle>
          <DialogDescription className="text-white/50 text-[12.5px]">
            We'll charge the workspace's billing source for the credit pack when the pool drops below the threshold.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Field label="Threshold (credits)" hint="Trigger when pool balance falls below this number.">
            <DataInput type="number" value={threshold} onChange={(e) => setThreshold(Math.max(0, Number(e.target.value) || 0))} />
          </Field>
          <Field label="Top-up amount (credits)" hint="Credits added per recharge. Billed at $0.10 / credit.">
            <DataInput type="number" value={amount} onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))} />
          </Field>
          <div className="text-[12px] text-white/55 font-mono">
            Estimated charge per recharge: <span className="text-[hsl(215,100%,72%)]">${(amount * 0.1).toFixed(2)}</span>
          </div>
        </div>
        <DialogFooter>
          <CmdButton variant="ghost" onClick={() => setOpen(false)}>Cancel</CmdButton>
          <CmdButton variant="primary" disabled={saving || threshold <= 0 || amount <= 0} onClick={() => save(true)}>
            <Check className="w-3 h-3" /> {saving ? 'Saving…' : 'Arm auto-recharge'}
          </CmdButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </WorkspacePage>
  );
}