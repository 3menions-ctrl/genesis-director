import { useEffect, useState } from 'react';
import { Plug, Slack, Webhook, Database, Zap, Cloud, Check, Send } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { WorkspacePage } from '@/components/workspace/PageShell';
import { Surface, Section, CmdButton, Pill, Field, DataInput } from '@/components/workspace/command-ui';
import { toast } from 'sonner';

type Kind = 'slack' | 'zapier';

function WebhookIntegration({
  kind, icon: Icon, name, blurb, placeholder, currentUrl, canEdit, onSaved,
}: {
  kind: Kind; icon: LucideIcon; name: string; blurb: string; placeholder: string;
  currentUrl: string | null; canEdit: boolean; onSaved: () => void;
}) {
  const { currentOrg } = useWorkspace();
  const [url, setUrl] = useState(currentUrl ?? '');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setUrl(currentUrl ?? ''); }, [currentUrl]);
  const connected = !!currentUrl;

  const save = async (next: string | null) => {
    if (!currentOrg) return;
    setBusy(true);
    const { error } = await supabase.rpc('set_org_integration_webhook', {
      p_org: currentOrg.id, p_kind: kind, p_url: next,
    } as any);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(next ? `${name} connected` : `${name} disconnected`);
    onSaved();
  };

  const test = async () => {
    if (!currentOrg) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('notify-org-event', {
      body: { kind, event: 'test', message: `Test ping from ${name} integration on Apex Studio.` },
    });
    setBusy(false);
    if (error || (data as any)?.error) toast.error((data as any)?.error || error?.message || 'Test failed');
    else toast.success('Test sent');
  };

  return (
    <Surface>
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.06] to-white/[0.015] flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-[hsl(215,100%,72%)]" strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-[14px] text-white/95 font-display">{name}</div>
            {connected ? <Pill tone="good">CONNECTED</Pill> : <Pill tone="neutral">NOT CONNECTED</Pill>}
          </div>
          <p className="text-[12px] text-white/45 mt-1 font-light">{blurb}</p>
          <div className="mt-3">
            <Field label="Webhook URL">
              <DataInput value={url} onChange={(e) => setUrl(e.target.value)} placeholder={placeholder} disabled={!canEdit} />
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <CmdButton variant="primary" disabled={!canEdit || busy || url === (currentUrl ?? '')} onClick={() => save(url.trim() || null)}>
              <Check className="w-3 h-3" /> {connected ? 'Update' : 'Connect'}
            </CmdButton>
            {connected && (
              <>
                <CmdButton variant="ghost" disabled={busy} onClick={test}>
                  <Send className="w-3 h-3" /> Send test
                </CmdButton>
                <CmdButton variant="ghost" disabled={!canEdit || busy} onClick={() => save(null)}>Disconnect</CmdButton>
              </>
            )}
          </div>
        </div>
      </div>
    </Surface>
  );
}

function RoadmapIntegration({
  icon: Icon, name, blurb,
}: { icon: LucideIcon; name: string; blurb: string }) {
  const { user } = useAuth();
  const { currentOrg } = useWorkspace();
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);

  const request = async () => {
    if (!currentOrg || !user) return;
    setBusy(true);
    const { error } = await supabase.from('feature_requests').insert({
      organization_id: currentOrg.id, user_id: user.id, feature: name.toLowerCase(), email: user.email,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setRequested(true);
    toast.success(`We'll email you when ${name} is live`);
  };

  return (
    <Surface>
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.06] to-white/[0.015] flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-white/75" strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-[14px] text-white/95 font-display">{name}</div>
            <Pill tone="amber">ROADMAP</Pill>
          </div>
          <p className="text-[12px] text-white/45 mt-1 font-light">{blurb}</p>
          <div className="mt-3">
            <CmdButton variant="ghost" disabled={busy || requested} onClick={request}>
              {requested ? 'Requested ✓' : 'Request access'}
            </CmdButton>
          </div>
        </div>
      </div>
    </Surface>
  );
}

export default function WorkspaceIntegrations() {
  const { currentOrg, hasPermission } = useWorkspace();
  const canEdit = hasPermission('admin');
  const [slack, setSlack] = useState<string | null>(null);
  const [zapier, setZapier] = useState<string | null>(null);

  const load = async () => {
    if (!currentOrg) return;
    const { data } = await supabase
      .from('organizations')
      .select('slack_webhook_url, zapier_webhook_url')
      .eq('id', currentOrg.id)
      .maybeSingle();
    setSlack((data as any)?.slack_webhook_url ?? null);
    setZapier((data as any)?.zapier_webhook_url ?? null);
  };
  useEffect(() => { load(); }, [currentOrg?.id]); // eslint-disable-line

  return (
    <WorkspacePage
      icon={Plug}
      eyebrow="Extend · Connect"
      title="Integrations"
      description="Push productions, brand updates and credit alerts into the tools your team already uses."
    >
      <Section icon={Webhook} label="Live integrations" sublabel="Send events to any HTTPS endpoint when productions complete or credits run low.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <WebhookIntegration
            kind="slack" icon={Slack} name="Slack"
            blurb="Post finished productions and low-balance alerts to a Slack channel."
            placeholder="https://hooks.slack.com/services/T.../B.../..."
            currentUrl={slack} canEdit={canEdit} onSaved={load}
          />
          <WebhookIntegration
            kind="zapier" icon={Zap} name="Zapier"
            blurb="Trigger 6,000+ automations on every production event."
            placeholder="https://hooks.zapier.com/hooks/catch/..."
            currentUrl={zapier} canEdit={canEdit} onSaved={load}
          />
        </div>
      </Section>

      <Section icon={Plug} label="Coming soon" sublabel="Request access — we ship in priority order based on customer demand.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <RoadmapIntegration icon={Cloud} name="Google Drive" blurb="Auto-upload final renders to a shared drive." />
          <RoadmapIntegration icon={Database} name="Notion" blurb="Sync brand kit and asset library to a Notion workspace." />
        </div>
      </Section>
    </WorkspacePage>
  );
}