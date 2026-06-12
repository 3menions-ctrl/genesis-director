import { useEffect, useState, useCallback } from 'react';
import { Users, Mail, Trash2, Crown, Shield, Film, Eye, MessageSquare, Plus, Copy, Check, Loader2 } from 'lucide-react';
import { useWorkspace, type OrgRole } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout';
import { Section, Field, CmdButton, DataInput, Pill } from '@/components/workspace/command-ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ListPagination, usePagination } from '@/components/ui/list-pagination';

import { confirmAsync } from '@/components/ui/global-confirm';
import { usePageMeta } from '@/hooks/usePageMeta';
interface Member {
  id: string; user_id: string; role: OrgRole; joined_at: string;
  monthly_credit_limit: number | null;
  credits_used_this_month: number;
  profile?: { display_name: string | null; full_name: string | null; email: string | null; avatar_url: string | null };
}
interface Invite {
  id: string; email: string; role: OrgRole; token: string;
  expires_at: string; accepted_at: string | null; created_at: string;
}

const ROLE_META: Record<OrgRole, { label: string; icon: typeof Crown; description: string }> = {
  owner:    { label: 'OWNER',    icon: Crown,         description: 'Full control, billing, delete workspace' },
  admin:    { label: 'ADMIN',    icon: Shield,        description: 'Manage members, brand, all projects' },
  producer: { label: 'PRODUCER', icon: Film,          description: 'Create and edit projects' },
  reviewer: { label: 'REVIEWER', icon: MessageSquare, description: 'Comment and approve, no edits' },
  viewer:   { label: 'VIEWER',   icon: Eye,           description: 'View only' },
};

export default function WorkspaceTeam() {
  usePageMeta({ title: "Workspace Team — Small Bridges" });

  const { currentOrg, hasPermission, refresh } = useWorkspace();
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrgRole>('producer');
  const [inviting, setInviting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const canManage = hasPermission('admin');
  const memberPage = usePagination(members, 20);
  const invitePage = usePagination(invites, 20);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    try {
      const [mRes, iRes] = await Promise.all([
        supabase.from('organization_members').select('id, user_id, role, joined_at, monthly_credit_limit, credits_used_this_month').eq('organization_id', currentOrg.id),
        supabase.from('organization_invites').select('*').eq('organization_id', currentOrg.id).is('accepted_at', null).order('created_at', { ascending: false }),
      ]);
      if (mRes.data) {
        const userIds = mRes.data.map(m => m.user_id);
        const { data: profiles } = await supabase.from('profiles').select('id, display_name, full_name, email, avatar_url').in('id', userIds);
        const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));
        setMembers(mRes.data.map((m: any) => ({ ...m, profile: profileMap.get(m.user_id) })));
      }
      if (iRes.data) setInvites(iRes.data as Invite[]);
    } catch (err: any) {
      console.error('[team] load', err);
      toast.error('Failed to load team');
    } finally { setLoading(false); }
  }, [currentOrg]);

  useEffect(() => { load(); }, [load]);

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !currentOrg || !user) return;
    setInviting(true);
    const { error } = await supabase.from('organization_invites').insert({
      organization_id: currentOrg.id, email: inviteEmail.trim().toLowerCase(),
      role: inviteRole, invited_by: user.id,
    });
    setInviting(false);
    if (error) toast.error(error.message);
    else { toast.success(`Invite dispatched to ${inviteEmail}`); setInviteEmail(''); load(); }
  };

  const updateRole = async (memberId: string, role: OrgRole) => {
    // Capture the row before update so we can email the affected member with
    // their old vs new role.
    const target = members.find((m) => m.id === memberId);
    const oldRole = target?.role;
    const { error } = await supabase.from('organization_members').update({ role }).eq('id', memberId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Role updated');
    load();
    // Fire-and-forget org_role_changed email (template exists in registry).
    if (target?.profile?.email && oldRole && oldRole !== role) {
      void supabase.functions
        .invoke('send-transactional-email', {
          body: {
            template: 'org_role_changed',
            recipientEmail: target.profile.email,
            templateData: {
              orgName: currentOrg?.name ?? 'your workspace',
              oldRole,
              newRole: role,
              memberName:
                target.profile.display_name ??
                target.profile.full_name ??
                target.profile.email?.split('@')[0] ??
                'there',
            },
          },
        })
        .catch((e) => console.warn('[WorkspaceTeam] org_role_changed email failed:', e));
    }
  };

  const removeMember = async (memberId: string) => {
    if (!await confirmAsync('Remove this member from the workspace?')) return;
    const { error } = await supabase.from('organization_members').delete().eq('id', memberId);
    if (error) toast.error(error.message); else { toast.success('Member removed'); load(); refresh(); }
  };

  const setLimit = async (m: Member) => {
    const raw = prompt(
      `Monthly credit cap for ${m.profile?.email || 'this member'} (leave blank for unlimited):`,
      m.monthly_credit_limit?.toString() ?? '',
    );
    if (raw === null) return;
    const limit = raw.trim() === '' ? null : Math.max(0, parseInt(raw, 10));
    if (raw.trim() !== '' && Number.isNaN(limit as number)) return toast.error('Enter a number or leave blank');
    const { error } = await supabase.rpc('set_member_credit_limit', {
      p_org: currentOrg!.id, p_user: m.user_id, p_limit: limit,
    } as any);
    if (error) toast.error(error.message); else { toast.success(limit === null ? 'Cap removed' : `Cap set to ${limit}`); load(); }
  };

  const revokeInvite = async (inviteId: string) => {
    const { error } = await supabase.from('organization_invites').delete().eq('id', inviteId);
    if (error) toast.error(error.message); else { toast.success('Invite revoked'); load(); }
  };

  const copyInviteLink = (token: string, id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/invite/${token}`);
    setCopiedId(id);
    toast.success('Invite link copied');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <WorkspaceLayout>
      <div className="space-y-6">
        {/* ── Dispatch invite ───────────────────────── */}
        {canManage && (
          <Section icon={Mail} label="Dispatch invite" sublabel="Recipient receives an email with a join link.">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px_auto] gap-2">
              <Field label="Recipient email">
                <DataInput
                  type="email"
                  placeholder="teammate@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleInvite(); }}
                />
              </Field>
              <Field label="Role">
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as OrgRole)}>
                  <SelectTrigger className="bg-[hsl(220,14%,4%)] border-[hsl(220,14%,16%)] text-[hsl(220,14%,92%)] font-mono text-[12px] rounded-none h-[38px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[hsl(220,14%,5%)] border-[hsl(220,14%,16%)] rounded-none">
                    {(['admin', 'producer', 'reviewer', 'viewer'] as OrgRole[]).map(r => (
                      <SelectItem key={r} value={r} className="font-mono text-[11px] uppercase tracking-[0.18em]">
                        {ROLE_META[r].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="flex items-end">
                <CmdButton onClick={handleInvite} disabled={inviting || !inviteEmail.trim()} className="h-[38px]">
                  {inviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Dispatch
                </CmdButton>
              </div>
            </div>
          </Section>
        )}

        {/* ── Roster ────────────────────────────────── */}
        <Section
          icon={Users}
          label="Active roster"
          sublabel="All seats currently provisioned to this workspace."
          action={<Pill tone="neutral">{members.length} ACTIVE</Pill>}
        >
          {loading ? (
            <div className="space-y-2">{[0,1,2].map(i => <div key={i} className="h-12 bg-[hsl(220,14%,7%)] animate-pulse" />)}</div>
          ) : members.length === 0 ? (
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[hsl(220,8%,55%)] py-6 text-center">No members on roster.</p>
          ) : (
            <ul className="divide-y divide-[hsl(220,14%,12%)]">
              {memberPage.slice.map((m, sliceIdx) => {
                const idx = (memberPage.page - 1) * memberPage.pageSize + sliceIdx;
                const RoleIcon = ROLE_META[m.role].icon;
                const isSelf = m.user_id === user?.id;
                const canEdit = canManage && !isSelf;
                return (
                  <li key={m.id} className="flex items-center gap-4 px-2 py-3 hover:bg-[hsl(220,14%,7%)] transition-colors">
                    <span className="font-mono text-[10px] text-[hsl(220,8%,40%)] tabular-nums w-6">{String(idx + 1).padStart(2, '0')}</span>
                    <div className="w-8 h-8 bg-[hsl(220,14%,8%)] border border-[hsl(220,14%,16%)] flex items-center justify-center overflow-hidden flex-shrink-0">
                      {m.profile?.avatar_url
                        ? <img src={m.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                        : <span className="font-mono text-[11px] text-[hsl(215,100%,62%)]">{(m.profile?.display_name?.[0] ?? m.profile?.email?.[0] ?? '?').toUpperCase()}</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] text-[hsl(220,14%,92%)] truncate">
                          {m.profile?.display_name || m.profile?.full_name || 'Unknown'}
                        </span>
                        {isSelf && <Pill tone="amber">YOU</Pill>}
                      </div>
                      <div className="font-mono text-[10px] text-[hsl(220,8%,45%)] truncate uppercase tracking-[0.12em]">{m.profile?.email}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {canEdit ? (
                        <Select value={m.role} onValueChange={(v) => updateRole(m.id, v as OrgRole)}>
                          <SelectTrigger className="w-[140px] h-8 bg-[hsl(220,14%,4%)] border-[hsl(220,14%,16%)] text-[hsl(220,14%,82%)] font-mono text-[11px] uppercase tracking-[0.18em] rounded-none">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[hsl(220,14%,5%)] border-[hsl(220,14%,16%)] rounded-none">
                            {(Object.keys(ROLE_META) as OrgRole[]).map(r => (
                              <SelectItem key={r} value={r} className="font-mono text-[11px] uppercase tracking-[0.18em]">{ROLE_META[r].label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Pill tone={m.role === 'owner' ? 'amber' : 'neutral'}>
                          <RoleIcon className="w-3 h-3" />{ROLE_META[m.role].label}
                        </Pill>
                      )}
                      <span className="font-mono text-[10px] text-[hsl(220,8%,45%)] uppercase tracking-[0.12em] hidden md:inline w-20 text-right">
                        {new Date(m.joined_at).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() => canEdit && setLimit(m)}
                        disabled={!canEdit}
                        title={canEdit ? 'Set monthly credit cap' : 'Admin only'}
                        className="font-mono text-[10px] uppercase tracking-[0.12em] text-[hsl(220,8%,55%)] hover:text-[hsl(215,100%,72%)] disabled:opacity-50 disabled:cursor-not-allowed px-2 py-1 border border-[hsl(220,14%,16%)] rounded hidden lg:inline"
                      >
                        {m.monthly_credit_limit == null
                          ? '∞ credits'
                          : `${(m.credits_used_this_month ?? 0).toLocaleString()} / ${m.monthly_credit_limit.toLocaleString()}`}
                      </button>
                      {canEdit && (
                        <button onClick={() => removeMember(m.id)}
                                className="p-1.5 hover:bg-[hsl(0,70%,40%)]/15 text-[hsl(0,80%,70%)]" title="Revoke seat">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <ListPagination
            page={memberPage.page}
            totalPages={memberPage.totalPages}
            total={memberPage.total}
            pageSize={memberPage.pageSize}
            onPageChange={memberPage.setPage}
            label="members"
          />
        </Section>

        {/* ── Pending invites ───────────────────────── */}
        <Section
          icon={Mail}
          label="Pending invites"
          sublabel="Dispatched but not yet accepted."
          action={<Pill tone={invites.length > 0 ? 'warn' : 'neutral'}>{invites.length} PENDING</Pill>}
        >
          {invites.length === 0 ? (
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[hsl(220,8%,55%)] py-6 text-center">No pending invites.</p>
          ) : (
            <ul className="divide-y divide-[hsl(220,14%,12%)]">
              {invitePage.slice.map(inv => (
                <li key={inv.id} className="flex items-center gap-4 px-2 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] text-[hsl(220,14%,92%)] truncate">{inv.email}</div>
                    <div className="font-mono text-[10px] text-[hsl(220,8%,45%)] uppercase tracking-[0.16em]">
                      EXPIRES · {new Date(inv.expires_at).toLocaleDateString()}
                    </div>
                  </div>
                  <Pill tone="neutral">{ROLE_META[inv.role].label}</Pill>
                  <button
                    onClick={() => copyInviteLink(inv.token, inv.id)}
                    className="p-1.5 hover:bg-[hsl(220,14%,10%)] text-[hsl(220,8%,55%)] hover:text-[hsl(220,14%,92%)]"
                    title="Copy invite link"
                  >
                    {copiedId === inv.id ? <Check className="w-3.5 h-3.5 text-[hsl(140,70%,65%)]" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  {canManage && (
                    <button onClick={() => revokeInvite(inv.id)}
                            className="p-1.5 hover:bg-[hsl(0,70%,40%)]/15 text-[hsl(0,80%,70%)]" title="Revoke invite">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <ListPagination
            page={invitePage.page}
            totalPages={invitePage.totalPages}
            total={invitePage.total}
            pageSize={invitePage.pageSize}
            onPageChange={invitePage.setPage}
            label="invites"
          />
        </Section>

        {/* ── Role reference ────────────────────────── */}
        <Section icon={Shield} label="Role permissions" sublabel="Capability matrix for each role.">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {(Object.keys(ROLE_META) as OrgRole[]).map(r => {
              const meta = ROLE_META[r];
              const Icon = meta.icon;
              return (
                <div key={r} className={cn(
                  'p-4 border bg-[hsl(220,14%,5%)]',
                  r === 'owner' ? 'border-[hsl(215,100%,40%)]/40' : 'border-[hsl(220,14%,16%)]',
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-3.5 h-3.5 text-[hsl(215,100%,62%)]" strokeWidth={1.5} />
                    <span className="font-mono text-[11px] uppercase tracking-[0.20em] text-[hsl(220,14%,92%)]">{meta.label}</span>
                  </div>
                  <p className="text-[12px] text-[hsl(220,8%,55%)] font-light leading-snug">{meta.description}</p>
                </div>
              );
            })}
          </div>
        </Section>
      </div>
    </WorkspaceLayout>
  );
}
