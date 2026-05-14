import { useEffect, useState, useCallback } from 'react';
import { KeyRound, Webhook, Plus, Trash2, Copy, Check } from 'lucide-react';
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
                  <button onClick={() => revokeKey(k)} className="p-2 rounded-lg text-white/75 hover:text-[hsl(0,80%,76%)] hover:bg-white/[0.04] transition" aria-label="Revoke">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={Webhook} label="Webhooks" sublabel="Receive POST events when projects start, complete or fail."
        action={<Pill tone="neutral">COMING SOON</Pill>}>
        <EmptyState
          icon={Webhook}
          title="Webhooks ship next"
          body="Subscribe a URL to receive workspace events: project.created · project.completed · credits.low · member.joined. Available in the next release."
        />
      </Section>
    </WorkspacePage>
  );
}