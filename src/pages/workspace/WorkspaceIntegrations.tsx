import { useEffect, useState, useCallback } from 'react';
import { Plug, Slack, Webhook, Database, Zap, Cloud, Check, Send, ExternalLink, Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { WorkspacePage } from '@/components/workspace/PageShell';
import { Surface, Section, CmdButton, Pill, Field, DataInput } from '@/components/workspace/command-ui';
import { toast } from 'sonner';
import { safeErrorMessage } from '@/lib/safeErrorMessage';

import { confirmAsync } from '@/components/ui/global-confirm';
import { usePageMeta } from '@/hooks/usePageMeta';
type OAuthProvider = 'google_drive' | 'notion';

interface OAuthRow {
  id: string;
  provider: OAuthProvider;
  display_name: string | null;
  external_account_id: string | null;
  status: 'active' | 'revoked' | 'expired' | 'error';
  connected_at: string;
  last_synced_at: string | null;
}

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
    if (error) return toast.error(safeErrorMessage(error, "Couldn't update integration. Please try again."));
    toast.success(next ? `${name} connected` : `${name} disconnected`);
    onSaved();
  };

  const test = async () => {
    if (!currentOrg) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('notify-org-event', {
      body: { kind, event: 'test', message: `Test ping from ${name} integration on Small Bridges.` },
    });
    setBusy(false);
    if (error || (data as any)?.error) toast.error((data as any)?.error || safeErrorMessage(error, 'Test failed'));
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

function OAuthIntegration({
  provider, icon: Icon, name, blurb, scopes,
  connection, canEdit, onChanged,
}: {
  provider: OAuthProvider;
  icon: LucideIcon;
  name: string;
  blurb: string;
  scopes?: string;
  connection: OAuthRow | undefined;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const { currentOrg } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const connected = !!connection && connection.status === 'active';

  const connect = async () => {
    if (!currentOrg) return;
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sign in required');
      const res = await fetch(
        `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/oauth-authorize`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            provider,
            organizationId: currentOrg.id,
            returnUrl: window.location.origin + '/workspace/integrations',
          }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.authorizeUrl) {
        throw new Error(body.error || `Connect failed (${res.status})`);
      }
      // Redirect user to the provider's authorize page.
      window.location.href = body.authorizeUrl;
    } catch (e) {
      toast.error(safeErrorMessage(e, 'Could not start connect flow'));
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!connection) return;
    if (!await confirmAsync(`Disconnect ${name}? Future automations using this connection will stop.`)) return;
    setBusy(true);
    const { error } = await supabase
      .from('workspace_integrations')
      .update({ status: 'revoked' })
      .eq('id', connection.id);
    setBusy(false);
    if (error) return toast.error(safeErrorMessage(error, "Couldn't disconnect integration. Please try again."));
    toast.success(`${name} disconnected`);
    onChanged();
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
            {connected
              ? <Pill tone="good">CONNECTED</Pill>
              : connection?.status === 'error'
                ? <Pill tone="bad">ERROR</Pill>
                : <Pill tone="neutral">NOT CONNECTED</Pill>}
          </div>
          <p className="text-[12px] text-white/45 mt-1 font-light">{blurb}</p>
          {connection && connected && (
            <div className="mt-3 text-[11px] text-white/55 font-mono">
              {connection.display_name && <span>{connection.display_name} · </span>}
              Connected {new Date(connection.connected_at).toLocaleDateString()}
            </div>
          )}
          {scopes && !connected && (
            <div className="mt-3 text-[10px] font-mono uppercase tracking-[0.22em] text-white/35">
              Scope · {scopes}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {!connected ? (
              <CmdButton variant="primary" disabled={!canEdit || busy} onClick={connect}>
                {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
                Connect {name}
              </CmdButton>
            ) : (
              <CmdButton variant="ghost" disabled={!canEdit || busy} onClick={disconnect}>
                Disconnect
              </CmdButton>
            )}
          </div>
        </div>
      </div>
    </Surface>
  );
}

export default function WorkspaceIntegrations() {
  usePageMeta({ title: "Workspace Integrations — Small Bridges" });

  const { currentOrg, hasPermission } = useWorkspace();
  const canEdit = hasPermission('admin');
  const [searchParams, setSearchParams] = useSearchParams();
  const [slack, setSlack] = useState<string | null>(null);
  const [zapier, setZapier] = useState<string | null>(null);
  const [oauth, setOauth] = useState<OAuthRow[]>([]);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    const [{ data: orgRow }, { data: oauthRows }] = await Promise.all([
      supabase
        .from('organizations')
        .select('slack_webhook_url, zapier_webhook_url')
        .eq('id', currentOrg.id)
        .maybeSingle(),
      supabase
        .from('workspace_integrations')
        .select('id, provider, display_name, external_account_id, status, connected_at, last_synced_at')
        .eq('organization_id', currentOrg.id),
    ]);
    setSlack((orgRow as any)?.slack_webhook_url ?? null);
    setZapier((orgRow as any)?.zapier_webhook_url ?? null);
    setOauth((oauthRows ?? []) as OAuthRow[]);
  }, [currentOrg?.id]);
  useEffect(() => { void load(); }, [load]);

  // Handle OAuth callback bounces — show a toast for ?integration=...&status=...
  useEffect(() => {
    const integration = searchParams.get('integration');
    const status = searchParams.get('status');
    if (!integration) return;
    if (status === 'success') {
      toast.success(`${integration.replace('_', ' ')} connected`);
      void load();
    } else if (status === 'error') {
      toast.error(`${integration} connect failed: ${searchParams.get('reason') ?? 'unknown'}`);
    }
    // Clear params so the toast doesn't fire again on re-render.
    const next = new URLSearchParams(searchParams);
    next.delete('integration');
    next.delete('status');
    next.delete('reason');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, load]);

  const drive = oauth.find((o) => o.provider === 'google_drive');
  const notion = oauth.find((o) => o.provider === 'notion');

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

      <Section
        icon={Plug}
        label="OAuth connections"
        sublabel="Authorize Small Bridges to push assets into your existing workspaces."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <OAuthIntegration
            provider="google_drive" icon={Cloud} name="Google Drive"
            blurb="Auto-upload final renders into a Drive folder per project."
            scopes="drive.file (single folder)"
            connection={drive} canEdit={canEdit} onChanged={load}
          />
          <OAuthIntegration
            provider="notion" icon={Database} name="Notion"
            blurb="Sync brand kit and project briefs into a Notion workspace."
            scopes="read_content, update_content"
            connection={notion} canEdit={canEdit} onChanged={load}
          />
        </div>
      </Section>
    </WorkspacePage>
  );
}