import { useEffect, useState, useCallback } from 'react';
import { Bell, Save } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { WorkspacePage } from '@/components/workspace/PageShell';
import { Section, Pill, CmdButton } from '@/components/workspace/command-ui';
import { toast } from 'sonner';

type ChannelKey = 'email' | 'in_app';

interface RouteSpec {
  key: string;
  event: string;
  to: string;
  channels: ChannelKey[];
  defaultEnabled: boolean;
}

const ROUTES: RouteSpec[] = [
  { key: 'member_joined',     event: 'Member joined',         to: 'Owners + Admins', channels: ['email','in_app'], defaultEnabled: true },
  { key: 'role_changed',      event: 'Role changed',          to: 'Member affected', channels: ['email','in_app'], defaultEnabled: true },
  { key: 'credits_low',       event: 'Credits low (<10%)',    to: 'Owners + Admins', channels: ['email','in_app'], defaultEnabled: true },
  { key: 'production_failed', event: 'Production failed',     to: 'Project owner',   channels: ['in_app'],         defaultEnabled: true },
  { key: 'approval_requested',event: 'Approval requested',    to: 'Reviewers',       channels: ['in_app'],         defaultEnabled: true },
  { key: 'invoice_ready',     event: 'Invoice ready',         to: 'Billing email',   channels: ['email'],          defaultEnabled: true },
];

type PrefsMap = Record<string, { enabled: boolean; channels: Record<ChannelKey, boolean> }>;

function defaultPrefs(): PrefsMap {
  const out: PrefsMap = {};
  for (const r of ROUTES) {
    const channels: Record<ChannelKey, boolean> = { email: false, in_app: false };
    for (const c of r.channels) channels[c] = true;
    out[r.key] = { enabled: r.defaultEnabled, channels };
  }
  return out;
}

export default function WorkspaceNotifications() {
  const { currentOrg, hasPermission } = useWorkspace();
  const { user } = useAuth();
  const canEdit = hasPermission('admin');
  const [prefs, setPrefs] = useState<PrefsMap>(defaultPrefs());
  const [original, setOriginal] = useState<PrefsMap>(defaultPrefs());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    const { data } = await supabase
      .from('org_notification_prefs')
      .select('prefs')
      .eq('organization_id', currentOrg.id)
      .maybeSingle();
    const merged = defaultPrefs();
    const stored = (data?.prefs as PrefsMap | null) ?? null;
    if (stored) {
      for (const k of Object.keys(merged)) {
        if (stored[k]) merged[k] = { ...merged[k], ...stored[k], channels: { ...merged[k].channels, ...(stored[k].channels ?? {}) } };
      }
    }
    setPrefs(merged);
    setOriginal(merged);
    setLoading(false);
  }, [currentOrg?.id]);

  useEffect(() => { load(); }, [load]);

  const dirty = JSON.stringify(prefs) !== JSON.stringify(original);

  const save = async () => {
    if (!currentOrg || !user) return;
    setSaving(true);
    const { error } = await supabase
      .from('org_notification_prefs')
      .upsert({ organization_id: currentOrg.id, prefs: prefs as any, updated_by: user.id }, { onConflict: 'organization_id' });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Notification routing saved');
    setOriginal(prefs);
    await supabase.from('workspace_audit_events').insert({
      organization_id: currentOrg.id, actor_id: user.id,
      category: 'settings', action: 'notifications.updated',
      target_kind: 'org', target_id: currentOrg.id,
    });
  };

  const toggleEnabled = (key: string) => {
    setPrefs(p => ({ ...p, [key]: { ...p[key], enabled: !p[key].enabled } }));
  };
  const toggleChannel = (key: string, ch: ChannelKey) => {
    setPrefs(p => ({ ...p, [key]: { ...p[key], channels: { ...p[key].channels, [ch]: !p[key].channels[ch] } } }));
  };

  return (
    <WorkspacePage
      icon={Bell}
      eyebrow="Extend · Routing"
      title="Notifications"
      description="Workspace-wide notification routing rules. Members can additionally tune their personal preferences."
      actions={canEdit ? (
        <CmdButton variant="primary" disabled={!dirty || saving} onClick={save}>
          <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save changes'}
        </CmdButton>
      ) : <Pill tone="neutral">READ ONLY</Pill>}
    >
      <Section icon={Bell} label="Event routing" sublabel="Defaults applied to every member of this workspace.">
        {loading ? (
          <div className="px-2 py-8 text-center font-mono text-[10px] uppercase tracking-[0.24em] text-white/75">Loading prefs…</div>
        ) : (
          <div className="overflow-x-auto -m-6 mt-2">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="px-6 py-3 font-mono text-[10px] uppercase tracking-[0.24em] text-white/45">Event</th>
                  <th className="px-3 py-3 font-mono text-[10px] uppercase tracking-[0.24em] text-white/45">Recipients</th>
                  <th className="px-3 py-3 font-mono text-[10px] uppercase tracking-[0.24em] text-white/45 text-center">Email</th>
                  <th className="px-3 py-3 font-mono text-[10px] uppercase tracking-[0.24em] text-white/45 text-center">In-app</th>
                  <th className="px-6 py-3 font-mono text-[10px] uppercase tracking-[0.24em] text-white/45 text-right">Enabled</th>
                </tr>
              </thead>
              <tbody>
                {ROUTES.map(r => {
                  const p = prefs[r.key];
                  return (
                    <tr key={r.key} className="border-b border-white/[0.04]">
                      <td className="px-6 py-3 text-[12px] text-white/90">{r.event}</td>
                      <td className="px-3 py-3 text-[12px] text-white/60">{r.to}</td>
                      <td className="px-3 py-3 text-center">
                        <input type="checkbox" disabled={!canEdit || !p.enabled} checked={p.channels.email}
                          onChange={() => toggleChannel(r.key, 'email')} className="accent-[hsl(215,100%,55%)]" />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <input type="checkbox" disabled={!canEdit || !p.enabled} checked={p.channels.in_app}
                          onChange={() => toggleChannel(r.key, 'in_app')} className="accent-[hsl(215,100%,55%)]" />
                      </td>
                      <td className="px-6 py-3 text-right">
                        <button
                          disabled={!canEdit}
                          onClick={() => toggleEnabled(r.key)}
                          className={`relative inline-flex h-5 w-9 rounded-full transition border ${p.enabled ? 'bg-[hsl(215,100%,45%)] border-[hsl(215,100%,55%)]/50' : 'bg-glass-active border-white/[0.08]'} disabled:opacity-50`}
                          aria-pressed={p.enabled}
                          aria-label={`Toggle ${r.event}`}
                        >
                          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${p.enabled ? 'left-[18px]' : 'left-0.5'}`} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </WorkspacePage>
  );
}