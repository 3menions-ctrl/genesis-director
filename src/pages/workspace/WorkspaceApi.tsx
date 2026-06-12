import { useEffect, useState, useCallback } from 'react';
import { KeyRound, Webhook, Plus, Trash2, Copy, Check, Send } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { WorkspacePage, EmptyState } from '@/components/workspace/PageShell';
import { Section, CmdButton, DataInput, Pill } from '@/components/workspace/command-ui';
import { toast } from 'sonner';

interface KeyRow {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

interface WebhookRow {
  id: string;
  url: string;
  description: string | null;
  events: string[];
  secret: string;
  active: boolean;
  last_delivered_at: string | null;
  failure_count: number;
  created_at: string;
}

const WEBHOOK_EVENTS = [
  { value: 'project.created', label: 'Project created' },
  { value: 'project.completed', label: 'Project completed' },
  { value: 'project.failed', label: 'Project failed' },
  { value: 'credits.low', label: 'Credit balance low' },
  { value: 'member.joined', label: 'Member joined workspace' },
  { value: 'member.removed', label: 'Member removed' },
] as const;

async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomToken(len = 36) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(36)).join('').slice(0, len);
}

export default function WorkspaceApi() {
  const { currentOrg, hasPermission } = useWorkspace();
  const { user } = useAuth();
  const canManage = hasPermission('admin');
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<{ id: string; token: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    const { data } = await supabase
      .from('org_api_keys')
      .select('id, name, prefix, scopes, last_used_at, revoked_at, created_at')
      .eq('organization_id', currentOrg.id)
      .order('created_at', { ascending: false });
    setKeys((data ?? []) as KeyRow[]);
    setLoading(false);
  }, [currentOrg?.id]);

  useEffect(() => { load(); }, [load]);

  const generateKey = async () => {
    if (!currentOrg || !user || !name.trim()) return;
    setCreating(true);
    try {
      const secret = randomToken(40);
      const prefix = `apx_${randomToken(8)}`;
      const fullToken = `${prefix}_${secret}`;
      const key_hash = await sha256Hex(fullToken);
      const { data, error } = await supabase
        .from('org_api_keys')
        .insert({
          organization_id: currentOrg.id,
          created_by: user.id,
          name: name.trim(),
          prefix,
          key_hash,
          scopes: ['read', 'generate'],
        })
        .select('id')
        .single();
      if (error) throw error;
      setRevealed({ id: data.id, token: fullToken });
      setName('');
      await supabase.from('workspace_audit_events').insert({
        organization_id: currentOrg.id,
        actor_id: user.id,
        category: 'api',
        action: 'apikey.created',
        target_kind: 'api_key',
        target_id: data.id,
        metadata: { name: name.trim(), prefix },
      });
      load();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to generate key');
    } finally {
      setCreating(false);
    }
  };

  const revokeKey = async (row: KeyRow) => {
    if (!confirm(`Revoke key "${row.name}"? Any service using it will immediately stop working.`)) return;
    const { error } = await supabase
      .from('org_api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', row.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Key revoked');
    if (currentOrg && user) {
      await supabase.from('workspace_audit_events').insert({
        organization_id: currentOrg.id, actor_id: user.id,
        category: 'api', action: 'apikey.revoked',
        target_kind: 'api_key', target_id: row.id,
        metadata: { prefix: row.prefix },
      });
    }
    load();
  };

  const copyToken = async () => {
    if (!revealed) return;
    await navigator.clipboard.writeText(revealed.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <WorkspacePage
      icon={KeyRound}
      eyebrow="Extend · Programmatic"
      title="API & Webhooks"
      description="Org-scoped API keys and webhook endpoints for programmatic access to workspace productions."
      actions={<Pill tone="amber">PROGRAMMATIC ACCESS</Pill>}
    >
      <Section icon={KeyRound} label="API Keys" sublabel="Server-to-server access scoped to this workspace.">
        {revealed && (
          <div className="mb-5 rounded-2xl border border-[hsl(45,90%,55%)]/30 bg-[hsl(45,90%,40%)]/8 p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-[hsl(45,90%,76%)] mb-2">
              Copy this key now — it will not be shown again.
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 rounded-lg bg-black/40 border border-white/[0.06] font-mono text-[12px] text-white/95 break-all">
                {revealed.token}
              </code>
              <CmdButton variant="ghost" onClick={copyToken}>
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </CmdButton>
              <CmdButton variant="ghost" onClick={() => setRevealed(null)}>Done</CmdButton>
            </div>
          </div>
        )}

        {canManage && (
          <div className="mb-5 flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="flex-1">
              <DataInput
                placeholder="Key name (e.g. Production backend)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={creating}
              />
            </div>
            <CmdButton variant="primary" onClick={generateKey} disabled={creating || !name.trim()}>
              <Plus className="w-3.5 h-3.5" /> {creating ? 'Generating…' : 'Generate key'}
            </CmdButton>
          </div>
        )}

        {loading ? (
          <div className="px-2 py-8 text-center font-mono text-[10px] uppercase tracking-[0.24em] text-white/75">Loading…</div>
        ) : keys.length === 0 ? (
          <EmptyState icon={KeyRound} title="No keys yet"
            body="Generate a workspace-scoped API key to call generation endpoints from your backend. Keys inherit the org credit pool." />
        ) : (
          <ul className="divide-y divide-white/[0.05] -mx-2">
            {keys.map(k => (
              <li key={k.id} className="px-2 py-3 flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] text-white/95 font-light truncate">{k.name}</div>
                  <div className="font-mono text-[11px] text-white/50 mt-0.5">{k.prefix}…</div>
                </div>
                <div className="hidden md:block font-mono text-[10px] uppercase tracking-[0.18em] text-white/75">
                  {k.last_used_at ? `Used ${new Date(k.last_used_at).toLocaleDateString()}` : 'Never used'}
                </div>
                {k.revoked_at
                  ? <Pill tone="bad">Revoked</Pill>
                  : <Pill tone="good">Active</Pill>}
                {canManage && !k.revoked_at && (
                  <button onClick={() => revokeKey(k)} className="p-2 rounded-lg text-white/75 hover:text-[hsl(0,80%,76%)] hover:bg-glass-hover transition" aria-label="Revoke">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <WebhooksSection canManage={canManage} />
    </WorkspacePage>
  );
}

// ── Webhooks ────────────────────────────────────────────────────────────

function WebhooksSection({ canManage }: { canManage: boolean }) {
  const { currentOrg } = useWorkspace();
  const { user } = useAuth();
  const [hooks, setHooks] = useState<WebhookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<{ id: string; secret: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    const { data } = await supabase
      .from('webhook_endpoints')
      .select('id, url, description, events, secret, active, last_delivered_at, failure_count, created_at')
      .eq('organization_id', currentOrg.id)
      .order('created_at', { ascending: false });
    setHooks((data ?? []) as WebhookRow[]);
    setLoading(false);
  }, [currentOrg?.id]);

  useEffect(() => { load(); }, [load]);

  const remove = async (row: WebhookRow) => {
    if (!confirm(`Delete webhook for ${row.url}? Future events will not be delivered to this endpoint.`)) return;
    const { error } = await supabase.from('webhook_endpoints').delete().eq('id', row.id);
    if (error) return toast.error(error.message);
    toast.success('Webhook deleted');
    if (currentOrg && user) {
      await supabase.from('workspace_audit_events').insert({
        organization_id: currentOrg.id, actor_id: user.id,
        category: 'api', action: 'webhook.deleted',
        target_kind: 'webhook', target_id: row.id,
        metadata: { url: row.url },
      });
    }
    load();
  };

  const toggleActive = async (row: WebhookRow) => {
    const { error } = await supabase
      .from('webhook_endpoints')
      .update({ active: !row.active })
      .eq('id', row.id);
    if (error) return toast.error(error.message);
    toast.success(row.active ? 'Webhook paused' : 'Webhook resumed');
    load();
  };

  const testFire = async (row: WebhookRow) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return toast.error('Sign in required');
    toast.loading('Sending test event…', { id: 'wh-test' });
    try {
      const res = await fetch(
        `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/webhook-dispatch`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            endpointId: row.id,
            event: 'webhook.test',
            payload: { hello: 'world', sentAt: new Date().toISOString() },
          }),
        },
      );
      const body = await res.json().catch(() => ({}));
      toast.dismiss('wh-test');
      if (!res.ok || !body.success) {
        toast.error(`Test failed: ${body.error ?? res.statusText}`);
      } else {
        toast.success(`Test delivered (HTTP ${body.deliveryStatus ?? 'OK'})`);
      }
      load();
    } catch (e) {
      toast.dismiss('wh-test');
      toast.error(e instanceof Error ? e.message : 'Test failed');
    }
  };

  const copySecret = async () => {
    if (!revealedSecret) return;
    await navigator.clipboard.writeText(revealedSecret.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Section icon={Webhook} label="Webhooks" sublabel="Receive signed POST events when projects start, complete, or fail.">
      {revealedSecret && (
        <div className="mb-5 rounded-2xl border border-[hsl(45,90%,55%)]/30 bg-[hsl(45,90%,40%)]/8 p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-[hsl(45,90%,76%)] mb-2">
            Copy this signing secret — use it to verify the X-Small Bridges-Signature header on incoming events.
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 rounded-lg bg-black/40 border border-white/[0.06] font-mono text-[12px] text-white/95 break-all">
              {revealedSecret.secret}
            </code>
            <CmdButton variant="ghost" onClick={copySecret}>
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </CmdButton>
            <CmdButton variant="ghost" onClick={() => setRevealedSecret(null)}>Done</CmdButton>
          </div>
        </div>
      )}

      {canManage && !showCreate && (
        <div className="mb-5">
          <CmdButton variant="primary" onClick={() => setShowCreate(true)}>
            <Plus className="w-3.5 h-3.5" /> Add webhook endpoint
          </CmdButton>
        </div>
      )}

      {showCreate && (
        <CreateWebhookForm
          onCancel={() => setShowCreate(false)}
          busy={creating}
          onSubmit={async ({ url, description, events }) => {
            if (!currentOrg || !user) return;
            setCreating(true);
            try {
              try { new URL(url); } catch { throw new Error('Enter a valid URL including https://'); }
              if (events.length === 0) throw new Error('Select at least one event');
              const { data, error } = await supabase
                .from('webhook_endpoints')
                .insert({
                  organization_id: currentOrg.id,
                  url,
                  description: description || null,
                  events,
                  created_by: user.id,
                })
                .select('id, secret')
                .single();
              if (error) throw error;
              setRevealedSecret({ id: data.id, secret: data.secret });
              setShowCreate(false);
              await supabase.from('workspace_audit_events').insert({
                organization_id: currentOrg.id, actor_id: user.id,
                category: 'api', action: 'webhook.created',
                target_kind: 'webhook', target_id: data.id,
                metadata: { url, events },
              });
              load();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Failed to create webhook');
            } finally {
              setCreating(false);
            }
          }}
        />
      )}

      {loading ? (
        <div className="px-2 py-8 text-center font-mono text-[10px] uppercase tracking-[0.24em] text-white/75">Loading…</div>
      ) : hooks.length === 0 && !showCreate ? (
        <EmptyState
          icon={Webhook}
          title="No webhooks yet"
          body="Add an endpoint to receive workspace events. Every delivery is signed with a per-webhook secret you verify on your server."
        />
      ) : hooks.length > 0 && (
        <ul className="divide-y divide-white/[0.05] -mx-2">
          {hooks.map((h) => (
            <li key={h.id} className="px-2 py-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[13px] text-white/95 font-light truncate">{h.url}</div>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {h.events.map((e) => (
                    <span key={e} className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/55 border border-white/[0.06] rounded-full px-2 py-0.5">
                      {e}
                    </span>
                  ))}
                </div>
                {h.description && (
                  <div className="text-[11px] text-white/45 mt-1">{h.description}</div>
                )}
              </div>
              <div className="hidden md:block font-mono text-[10px] uppercase tracking-[0.18em] text-white/55 whitespace-nowrap">
                {h.last_delivered_at
                  ? `Sent ${new Date(h.last_delivered_at).toLocaleDateString()}`
                  : 'Never sent'}
                {h.failure_count > 0 && (
                  <span className="ml-2 text-[hsl(0,80%,76%)]">· {h.failure_count} failure{h.failure_count === 1 ? '' : 's'}</span>
                )}
              </div>
              {h.active ? <Pill tone="good">Active</Pill> : <Pill tone="neutral">Paused</Pill>}
              {canManage && (
                <>
                  <button
                    onClick={() => testFire(h)}
                    className="p-2 rounded-lg text-white/75 hover:text-white hover:bg-glass-hover transition"
                    title="Send test event"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => toggleActive(h)}
                    className="px-3 py-1 rounded-lg text-[10px] uppercase tracking-[0.18em] font-mono text-white/65 hover:text-white border border-white/[0.06] hover:border-white/20 transition"
                  >
                    {h.active ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    onClick={() => remove(h)}
                    className="p-2 rounded-lg text-white/75 hover:text-[hsl(0,80%,76%)] hover:bg-glass-hover transition"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function CreateWebhookForm({
  onSubmit,
  onCancel,
  busy,
}: {
  onSubmit: (v: { url: string; description: string; events: string[] }) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [events, setEvents] = useState<string[]>([WEBHOOK_EVENTS[0].value, WEBHOOK_EVENTS[1].value]);

  const toggleEvent = (v: string) =>
    setEvents((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  return (
    <div className="mb-5 rounded-2xl border border-white/[0.06] bg-glass p-5 space-y-4">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/55 mb-2">Endpoint URL</div>
        <DataInput
          placeholder="https://api.example.com/webhooks/smallbridges"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={busy}
        />
      </div>
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/55 mb-2">Description (optional)</div>
        <DataInput
          placeholder="Production order pipeline"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={busy}
        />
      </div>
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/55 mb-2">Events</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {WEBHOOK_EVENTS.map((e) => (
            <label key={e.value} className="flex items-center gap-2 cursor-pointer text-[12px] text-white/75 hover:text-white">
              <input
                type="checkbox"
                checked={events.includes(e.value)}
                onChange={() => toggleEvent(e.value)}
                className="accent-[#0A84FF]"
              />
              <span className="font-mono text-[11px] uppercase tracking-[0.16em]">{e.label}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <CmdButton variant="ghost" onClick={onCancel} disabled={busy}>Cancel</CmdButton>
        <CmdButton variant="primary" onClick={() => onSubmit({ url, description, events })} disabled={busy || !url.trim()}>
          {busy ? 'Saving…' : 'Save endpoint'}
        </CmdButton>
      </div>
    </div>
  );
}