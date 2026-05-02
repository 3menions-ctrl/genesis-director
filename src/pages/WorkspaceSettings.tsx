import { useEffect, useState, useCallback } from 'react';
import { Users, Mail, Trash2, Crown, Shield, Film, Eye, MessageSquare, Plus, Copy, Check } from 'lucide-react';
import { useWorkspace, type OrgRole } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Member {
  id: string;
  user_id: string;
  role: OrgRole;
  joined_at: string;
  profile?: { display_name: string | null; full_name: string | null; email: string | null; avatar_url: string | null };
}

interface Invite {
  id: string;
  email: string;
  role: OrgRole;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

const ROLE_META: Record<OrgRole, { label: string; icon: typeof Crown; description: string; tint: string }> = {
  owner:    { label: 'Owner',    icon: Crown,         description: 'Full control, billing, delete workspace',  tint: 'hsl(42 100% 65%)' },
  admin:    { label: 'Admin',    icon: Shield,        description: 'Manage members, brand, all projects',      tint: 'hsl(280 70% 65%)' },
  producer: { label: 'Producer', icon: Film,          description: 'Create and edit projects',                 tint: 'hsl(215 100% 65%)' },
  reviewer: { label: 'Reviewer', icon: MessageSquare, description: 'Comment and approve, no edits',            tint: 'hsl(150 60% 55%)' },
  viewer:   { label: 'Viewer',   icon: Eye,           description: 'View only',                                tint: 'hsl(220 10% 55%)' },
};

export default function WorkspaceSettings() {
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

  const loadData = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    try {
      const [mRes, iRes] = await Promise.all([
        supabase
          .from('organization_members')
          .select('id, user_id, role, joined_at')
          .eq('organization_id', currentOrg.id),
        supabase
          .from('organization_invites')
          .select('*')
          .eq('organization_id', currentOrg.id)
          .is('accepted_at', null)
          .order('created_at', { ascending: false }),
      ]);
      if (mRes.data) {
        const userIds = mRes.data.map(m => m.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, full_name, email, avatar_url')
          .in('id', userIds);
        const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));
        setMembers(mRes.data.map((m: any) => ({ ...m, profile: profileMap.get(m.user_id) })));
      }
      if (iRes.data) setInvites(iRes.data as Invite[]);
    } catch (err: any) {
      console.error('[WorkspaceSettings] load error', err);
      toast.error('Failed to load workspace');
    } finally {
      setLoading(false);
    }
  }, [currentOrg]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !currentOrg || !user) return;
    setInviting(true);
    const { error } = await supabase.from('organization_invites').insert({
      organization_id: currentOrg.id,
      email: inviteEmail.trim().toLowerCase(),
      role: inviteRole,
      invited_by: user.id,
    });
    setInviting(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Invite created for ${inviteEmail}`);
      setInviteEmail('');
      loadData();
    }
  };

  const updateRole = async (memberId: string, role: OrgRole) => {
    const { error } = await supabase.from('organization_members').update({ role }).eq('id', memberId);
    if (error) toast.error(error.message);
    else { toast.success('Role updated'); loadData(); }
  };

  const removeMember = async (memberId: string) => {
    if (!confirm('Remove this member from the workspace?')) return;
    const { error } = await supabase.from('organization_members').delete().eq('id', memberId);
    if (error) toast.error(error.message);
    else { toast.success('Member removed'); loadData(); refresh(); }
  };

  const revokeInvite = async (inviteId: string) => {
    const { error } = await supabase.from('organization_invites').delete().eq('id', inviteId);
    if (error) toast.error(error.message);
    else { toast.success('Invite revoked'); loadData(); }
  };

  const copyInviteLink = (token: string, id: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success('Invite link copied');
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!currentOrg) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/55">
        No workspace selected.
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 sm:px-8 py-10 max-w-5xl mx-auto">
      <header className="mb-10">
        <div className="text-[10px] uppercase tracking-[0.28em] text-white/35 font-light mb-3">Workspace</div>
        <h1 className="text-3xl sm:text-4xl font-display font-light tracking-tight text-white">{currentOrg.name}</h1>
        <p className="text-[13px] text-white/45 mt-2 font-light">
          Manage members, invitations, and access for this workspace.
        </p>
      </header>

      <Tabs defaultValue="members">
        <TabsList className="bg-white/[0.03] border border-white/[0.05]">
          <TabsTrigger value="members" className="gap-2"><Users className="w-3.5 h-3.5" />Members ({members.length})</TabsTrigger>
          <TabsTrigger value="invites" className="gap-2"><Mail className="w-3.5 h-3.5" />Invites ({invites.length})</TabsTrigger>
          <TabsTrigger value="roles" className="gap-2"><Shield className="w-3.5 h-3.5" />Roles</TabsTrigger>
        </TabsList>

        {/* MEMBERS */}
        <TabsContent value="members" className="mt-6">
          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-white/[0.05] hover:bg-transparent">
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={4} className="text-center text-white/45 py-8">Loading…</TableCell></TableRow>
                )}
                {!loading && members.map((m) => {
                  const RoleIcon = ROLE_META[m.role].icon;
                  const isSelf = m.user_id === user?.id;
                  const canEdit = canManage && !isSelf;
                  return (
                    <TableRow key={m.id} className="border-white/[0.05]">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-white/[0.10] to-white/[0.03] flex items-center justify-center overflow-hidden">
                            {m.profile?.avatar_url ? (
                              <img src={m.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[11px] text-white/60">{(m.profile?.display_name?.[0] ?? m.profile?.email?.[0] ?? '?').toUpperCase()}</span>
                            )}
                          </div>
                          <div>
                            <div className="text-[13px] text-white/90">
                              {m.profile?.display_name || m.profile?.full_name || 'Unknown'}
                              {isSelf && <span className="ml-2 text-[10px] uppercase tracking-[0.2em] text-white/35">You</span>}
                            </div>
                            <div className="text-[11px] text-white/45">{m.profile?.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {canEdit ? (
                          <Select value={m.role} onValueChange={(v) => updateRole(m.id, v as OrgRole)}>
                            <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {(Object.keys(ROLE_META) as OrgRole[]).map(r => (
                                <SelectItem key={r} value={r}>{ROLE_META[r].label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[12px] text-white/75">
                            <RoleIcon className="w-3.5 h-3.5" style={{ color: ROLE_META[m.role].tint }} strokeWidth={1.5} />
                            {ROLE_META[m.role].label}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-[12px] text-white/55">
                        {new Date(m.joined_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {canEdit && (
                          <Button variant="ghost" size="sm" onClick={() => removeMember(m.id)} className="text-white/45 hover:text-[hsl(var(--destructive))]">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* INVITES */}
        <TabsContent value="invites" className="mt-6 space-y-6">
          {canManage && (
            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5">
              <h3 className="text-[14px] font-medium text-white/90 mb-1">Invite a new member</h3>
              <p className="text-[12px] text-white/45 mb-4">They'll receive an email with a link to join this workspace.</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="email"
                  placeholder="teammate@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleInvite(); }}
                />
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as OrgRole)}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['admin', 'producer', 'reviewer', 'viewer'] as OrgRole[]).map(r => (
                      <SelectItem key={r} value={r}>{ROLE_META[r].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  {inviting ? 'Sending…' : 'Invite'}
                </Button>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-white/[0.05] hover:bg-transparent">
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-white/45 py-8">No pending invites.</TableCell></TableRow>
                )}
                {invites.map((inv) => (
                  <TableRow key={inv.id} className="border-white/[0.05]">
                    <TableCell className="text-[13px] text-white/85">{inv.email}</TableCell>
                    <TableCell className="text-[12px] text-white/65">{ROLE_META[inv.role].label}</TableCell>
                    <TableCell className="text-[12px] text-white/55">{new Date(inv.expires_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => copyInviteLink(inv.token, inv.id)} className="mr-1">
                        {copiedId === inv.id ? <Check className="w-3.5 h-3.5 text-[hsl(var(--success))]" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                      {canManage && (
                        <Button variant="ghost" size="sm" onClick={() => revokeInvite(inv.id)} className="text-white/45 hover:text-[hsl(var(--destructive))]">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ROLES REFERENCE */}
        <TabsContent value="roles" className="mt-6">
          <div className="grid sm:grid-cols-2 gap-3">
            {(Object.keys(ROLE_META) as OrgRole[]).map(r => {
              const meta = ROLE_META[r];
              const Icon = meta.icon;
              return (
                <div key={r} className={cn('rounded-2xl p-5 border border-white/[0.05] bg-white/[0.02]')}>
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${meta.tint}20` }}>
                      <Icon className="w-4 h-4" style={{ color: meta.tint }} strokeWidth={1.5} />
                    </div>
                    <span className="text-[14px] font-medium text-white/90">{meta.label}</span>
                  </div>
                  <p className="text-[12px] text-white/55 font-light">{meta.description}</p>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}