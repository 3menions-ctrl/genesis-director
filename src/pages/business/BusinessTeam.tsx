/**
 * BusinessTeam — /business/team
 *
 * Full team management (invite · role change · credit caps · revoke),
 * reusing the exact data logic from WorkspaceTeam, re-skinned into the
 * borderless cover-hero BusinessPage language.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users, Mail, Trash2, Crown, Shield, Film, Eye, MessageSquare, Plus, Copy, Check, Loader2, Scissors, Search,
} from "lucide-react";
import { useWorkspace, type OrgRole } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListPagination, usePagination } from "@/components/ui/list-pagination";
import { confirmAsync } from "@/components/ui/global-confirm";
import { usePageMeta } from "@/hooks/usePageMeta";
import { BusinessPage, StatCard, SectionHead, EmptyState, SkeletonRows } from "@/components/business/BusinessPage";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Member {
  id: string; user_id: string; role: OrgRole; joined_at: string;
  monthly_credit_limit: number | null; credits_used_this_month: number;
  profile?: { display_name: string | null; full_name: string | null; email: string | null; avatar_url: string | null };
}
interface Invite {
  id: string; email: string; role: OrgRole; token: string;
  expires_at: string; accepted_at: string | null; created_at: string;
}

const ROLE_META: Record<OrgRole, { label: string; icon: typeof Crown; description: string }> = {
  owner: { label: "Owner", icon: Crown, description: "Full control, billing, delete workspace" },
  admin: { label: "Admin", icon: Shield, description: "Manage members, brand, all projects" },
  producer: { label: "Producer", icon: Film, description: "Create and edit projects" },
  editor: { label: "Editor", icon: Scissors, description: "Edit projects in the cutting room" },
  reviewer: { label: "Reviewer", icon: MessageSquare, description: "Comment and approve, no edits" },
  viewer: { label: "Viewer", icon: Eye, description: "View only" },
};

// Safe lookup — never returns undefined even for an unexpected role value.
const roleMeta = (r: OrgRole) => ROLE_META[r] ?? ROLE_META.viewer;

const inputCls = "h-11 px-4 rounded-xl bg-white/[0.04] ring-1 ring-white/[0.08] focus:ring-white/20 text-[14px] text-white placeholder:text-white/35 outline-none transition";

export function TeamContent() {
  const { currentOrg, hasPermission, refresh } = useWorkspace();
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgRole>("producer");
  const [inviting, setInviting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | OrgRole>("all");
  const canManage = hasPermission("admin");

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      if (roleFilter !== "all" && m.role !== roleFilter) return false;
      if (!q) return true;
      const name = (m.profile?.display_name || m.profile?.full_name || "").toLowerCase();
      const email = (m.profile?.email || "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [members, search, roleFilter]);

  const memberStats = useMemo(() => {
    let admins = 0, capped = 0, overCap = 0;
    for (const m of members) {
      if (m.role === "admin" || m.role === "owner") admins++;
      if (m.monthly_credit_limit != null) {
        capped++;
        if ((m.credits_used_this_month ?? 0) > m.monthly_credit_limit) overCap++;
      }
    }
    return { admins, capped, overCap };
  }, [members]);

  const memberPage = usePagination(filteredMembers, 20);
  const invitePage = usePagination(invites, 20);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    try {
      const [mRes, iRes] = await Promise.all([
        supabase.from("organization_members").select("id, user_id, role, joined_at, monthly_credit_limit, credits_used_this_month").eq("organization_id", currentOrg.id),
        supabase.from("organization_invites").select("*").eq("organization_id", currentOrg.id).is("accepted_at", null).order("created_at", { ascending: false }),
      ]);
      if (mRes.data) {
        // Member identities (incl. email) come from the org-scoped SECURITY
        // DEFINER RPC — the base profiles table no longer exposes email.
        const { data: profiles } = await (
          supabase.rpc as unknown as (
            fn: string,
            args: Record<string, unknown>,
          ) => Promise<{ data: Array<{ id: string; display_name: string | null; full_name: string | null; avatar_url: string | null; email: string | null }> | null }>
        )("org_member_directory", { p_org_id: currentOrg.id });
        const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));
        setMembers(mRes.data.map((m: Member) => ({ ...m, profile: pmap.get(m.user_id) })));
      }
      if (iRes.data) setInvites(iRes.data as Invite[]);
    } catch (err) {
      console.error("[BusinessTeam] load", err);
      toast.error("Failed to load team");
    } finally { setLoading(false); }
  }, [currentOrg]);

  useEffect(() => { void load(); }, [load]);

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !currentOrg || !user) return;
    setInviting(true);
    const { error } = await supabase.from("organization_invites").insert({
      organization_id: currentOrg.id, email: inviteEmail.trim().toLowerCase(), role: inviteRole, invited_by: user.id,
    });
    setInviting(false);
    if (error) toast.error(error.message);
    else { toast.success(`Invite dispatched to ${inviteEmail}`); setInviteEmail(""); void load(); }
  };

  const updateRole = async (memberId: string, role: OrgRole) => {
    const target = members.find((m) => m.id === memberId);
    const oldRole = target?.role;
    const { error } = await supabase.from("organization_members").update({ role }).eq("id", memberId);
    if (error) { toast.error(error.message); return; }
    toast.success("Role updated");
    void load();
    if (target?.profile?.email && oldRole && oldRole !== role) {
      void supabase.functions.invoke("send-transactional-email", {
        body: { template: "org_role_changed", recipientEmail: target.profile.email, templateData: {
          orgName: currentOrg?.name ?? "your workspace", oldRole, newRole: role,
          memberName: target.profile.display_name ?? target.profile.full_name ?? target.profile.email?.split("@")[0] ?? "there",
        } },
      }).catch((e) => console.warn("[BusinessTeam] role email failed", e));
    }
  };

  const removeMember = async (memberId: string) => {
    if (!(await confirmAsync("Remove this member from the workspace?"))) return;
    const { error } = await supabase.from("organization_members").delete().eq("id", memberId);
    if (error) toast.error(error.message); else { toast.success("Member removed"); void load(); refresh(); }
  };

  const setLimit = async (m: Member) => {
    const raw = window.prompt(`Monthly credit cap for ${m.profile?.email || "this member"} (blank = unlimited):`, m.monthly_credit_limit?.toString() ?? "");
    if (raw === null) return;
    const limit = raw.trim() === "" ? null : Math.max(0, parseInt(raw, 10));
    if (raw.trim() !== "" && Number.isNaN(limit as number)) { toast.error("Enter a number or leave blank"); return; }
    const { error } = await (supabase.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<{ error: { message: string } | null }>)(
      "set_member_credit_limit", { p_org: currentOrg!.id, p_user: m.user_id, p_limit: limit },
    );
    if (error) toast.error(error.message); else { toast.success(limit === null ? "Cap removed" : `Cap set to ${limit}`); void load(); }
  };

  const revokeInvite = async (inviteId: string) => {
    const { error } = await supabase.from("organization_invites").delete().eq("id", inviteId);
    if (error) toast.error(error.message); else { toast.success("Invite revoked"); void load(); }
  };

  const copyInviteLink = (token: string, id: string) => {
    void navigator.clipboard.writeText(`${window.location.origin}/invite/${token}`);
    setCopiedId(id);
    toast.success("Invite link copied");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Members" value={members.length} accent loading={loading} hint={`${memberStats.capped} with a cap`} />
        <StatCard label="Pending invites" value={invites.length} loading={loading} hint={invites.length ? "Awaiting acceptance" : "All seats claimed"} />
        <StatCard label="Admins" value={memberStats.admins} loading={loading} hint="Owner + admin seats" />
        <StatCard
          label="Seats over cap"
          value={memberStats.overCap}
          loading={loading}
          hint={memberStats.overCap ? "Spend exceeds the monthly cap" : "Everyone within budget"}
        />
      </div>

      {/* Invite */}
      {canManage && (
        <>
          <SectionHead label="Dispatch invite" />
          <div className="rounded-2xl ring-1 ring-white/[0.07] bg-white/[0.015] p-4 grid grid-cols-1 sm:grid-cols-[1fr_180px_auto] gap-2.5">
            <input type="email" placeholder="teammate@company.com" value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void handleInvite(); }} className={inputCls} />
            <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as OrgRole)}>
              <SelectTrigger className="h-11 rounded-xl bg-white/[0.04] ring-1 ring-white/[0.08] border-0 text-[13px] text-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["admin", "producer", "reviewer", "viewer"] as OrgRole[]).map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_META[r].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button type="button" onClick={() => void handleInvite()} disabled={inviting || !inviteEmail.trim()}
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-[hsl(215,90%,55%)] text-white text-[13px] font-medium hover:bg-[hsl(215,90%,60%)] disabled:opacity-50 transition-colors">
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Dispatch
            </button>
          </div>
        </>
      )}

      {/* Roster */}
      <SectionHead
        label="Active roster"
        count={loading ? undefined : `${filteredMembers.length}${filteredMembers.length !== members.length ? ` / ${members.length}` : ""}`}
        action={!loading && members.length > 0 ? (
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/35 pointer-events-none" />
              <input
                type="text"
                placeholder="Search name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-44 sm:w-56 pl-8 pr-3 rounded-lg bg-white/[0.04] ring-1 ring-white/[0.08] focus:ring-white/20 text-[12px] text-white placeholder:text-white/35 outline-none transition"
              />
            </div>
            <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as "all" | OrgRole)}>
              <SelectTrigger className="w-[120px] h-8 rounded-lg bg-white/[0.04] ring-1 ring-white/[0.08] border-0 text-[12px] text-white/85"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {(Object.keys(ROLE_META) as OrgRole[]).map((r) => <SelectItem key={r} value={r}>{ROLE_META[r].label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ) : undefined}
      />
      {loading ? (
        <SkeletonRows rows={5} />
      ) : members.length === 0 ? (
        <EmptyState icon={Users} title="No members on roster." description="Invite teammates above and they'll show up here with their roles and credit caps." />
      ) : filteredMembers.length === 0 ? (
        <EmptyState icon={Search} title="No members match." description="No roster members match your search or role filter. Try clearing the filters." />
      ) : (
      <div className="rounded-2xl ring-1 ring-white/[0.07] overflow-hidden divide-y divide-white/[0.05]">
        {memberPage.slice.map((m, i) => {
          const idx = (memberPage.page - 1) * memberPage.pageSize + i;
          const RoleIcon = roleMeta(m.role).icon;
          const isSelf = m.user_id === user?.id;
          const canEdit = canManage && !isSelf;
          return (
            <div key={m.id} className="flex items-center gap-3.5 px-4 py-3 hover:bg-white/[0.02] transition-colors">
              <span className="font-mono text-[10px] text-white/30 tabular-nums w-5">{String(idx + 1).padStart(2, "0")}</span>
              <div className="w-9 h-9 rounded-full bg-white/[0.06] ring-1 ring-white/10 flex items-center justify-center overflow-hidden shrink-0">
                {m.profile?.avatar_url ? <img src={m.profile.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="font-mono text-[12px] text-[hsl(215,100%,72%)]">{(m.profile?.display_name?.[0] ?? m.profile?.email?.[0] ?? "?").toUpperCase()}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] text-white/90 truncate">{m.profile?.display_name || m.profile?.full_name || "Unknown"}</span>
                  {isSelf && <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-amber-200/80">You</span>}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-white/45 truncate">
                  <span className="truncate">{m.profile?.email}</span>
                  {m.joined_at && <span className="hidden sm:inline shrink-0 font-mono text-[10px] text-white/30 uppercase tracking-[0.12em]">· Joined {new Date(m.joined_at).toLocaleDateString()}</span>}
                </div>
                <div className="mt-1.5 max-w-[260px]">
                  <CapBar used={m.credits_used_this_month ?? 0} limit={m.monthly_credit_limit} />
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {canEdit ? (
                  <Select value={m.role} onValueChange={(v) => updateRole(m.id, v as OrgRole)}>
                    <SelectTrigger className="w-[130px] h-9 rounded-lg bg-white/[0.04] ring-1 ring-white/[0.08] border-0 text-[12px] text-white/85"><SelectValue /></SelectTrigger>
                    <SelectContent>{(Object.keys(ROLE_META) as OrgRole[]).map((r) => <SelectItem key={r} value={r}>{ROLE_META[r].label}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <span className={cn("inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full text-[11px] ring-1", m.role === "owner" ? "text-amber-200/90 ring-amber-400/30 bg-amber-400/10" : "text-white/70 ring-white/10 bg-white/[0.03]")}>
                    <RoleIcon className="w-3 h-3" />{roleMeta(m.role).label}
                  </span>
                )}
                <button onClick={() => canEdit && setLimit(m)} disabled={!canEdit} title={canEdit ? "Set monthly credit cap" : "Admin only"}
                  className="hidden lg:inline font-mono text-[10px] uppercase tracking-[0.12em] text-white/50 hover:text-[hsl(215,100%,72%)] disabled:opacity-40 disabled:cursor-not-allowed px-2.5 h-7 rounded-full ring-1 ring-white/[0.08]">
                  {m.monthly_credit_limit == null ? "∞ credits" : `${(m.credits_used_this_month ?? 0).toLocaleString()} / ${m.monthly_credit_limit.toLocaleString()}`}
                </button>
                {canEdit && (
                  <button onClick={() => removeMember(m.id)} className="p-2 rounded-full hover:bg-rose-500/15 text-rose-300/80" title="Revoke seat"><Trash2 className="w-4 h-4" /></button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}
      {!loading && filteredMembers.length > 0 && (
        <div className="mt-3"><ListPagination page={memberPage.page} totalPages={memberPage.totalPages} total={memberPage.total} pageSize={memberPage.pageSize} onPageChange={memberPage.setPage} label="members" /></div>
      )}

      {/* Pending invites */}
      <SectionHead label="Pending invites" count={invites.length} />
      {invites.length === 0 ? (
        <EmptyState icon={Mail} title="No pending invites." description="Dispatched invites that haven't been accepted yet will appear here." />
      ) : (
      <div className="rounded-2xl ring-1 ring-white/[0.07] overflow-hidden divide-y divide-white/[0.05]">
        {invitePage.slice.map((inv) => (
          <div key={inv.id} className="flex items-center gap-3.5 px-4 py-3">
            <Mail className="w-4 h-4 text-white/35 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] text-white/90 truncate">{inv.email}</div>
              <div className="font-mono text-[10px] text-white/40 uppercase tracking-[0.16em]">Expires · {new Date(inv.expires_at).toLocaleDateString()}</div>
            </div>
            <span className="inline-flex items-center px-2.5 h-7 rounded-full text-[11px] text-white/70 ring-1 ring-white/10 bg-white/[0.03]">{roleMeta(inv.role).label}</span>
            <button onClick={() => copyInviteLink(inv.token, inv.id)} className="p-2 rounded-full hover:bg-white/[0.06] text-white/55 hover:text-white" title="Copy invite link">
              {copiedId === inv.id ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
            </button>
            {canManage && <button onClick={() => revokeInvite(inv.id)} className="p-2 rounded-full hover:bg-rose-500/15 text-rose-300/80" title="Revoke invite"><Trash2 className="w-4 h-4" /></button>}
          </div>
        ))}
      </div>
      )}
      {invites.length > 0 && (
        <div className="mt-3"><ListPagination page={invitePage.page} totalPages={invitePage.totalPages} total={invitePage.total} pageSize={invitePage.pageSize} onPageChange={invitePage.setPage} label="invites" /></div>
      )}

      {/* Role reference */}
      <SectionHead label="Role permissions" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {(Object.keys(ROLE_META) as OrgRole[]).map((r) => {
          const meta = ROLE_META[r]; const Icon = meta.icon;
          return (
            <div key={r} className={cn("rounded-2xl p-4 ring-1", r === "owner" ? "ring-amber-400/25 bg-amber-400/[0.04]" : "ring-white/[0.07] bg-white/[0.015]")}>
              <div className="flex items-center gap-2 mb-2"><Icon className="w-4 h-4 text-[hsl(215,100%,72%)]" strokeWidth={1.5} /><span className="text-[12px] font-mono uppercase tracking-[0.18em] text-white/90">{meta.label}</span></div>
              <p className="text-[12.5px] text-white/55 font-light leading-snug">{meta.description}</p>
            </div>
          );
        })}
      </div>
    </>
  );
}

// Credit-cap usage bar — emerald <70%, amber 70-100%, rose >100%; ∞ when uncapped.
function CapBar({ used, limit }: { used: number; limit: number | null }) {
  if (limit == null) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-1 flex-1 rounded-full bg-white/[0.06]" />
        <span className="font-mono text-[10px] text-white/35 tabular-nums shrink-0">∞ unlimited</span>
      </div>
    );
  }
  const pct = limit > 0 ? (used / limit) * 100 : used > 0 ? 100 : 0;
  const tone = pct > 100 ? "bg-rose-400" : pct >= 70 ? "bg-amber-400" : "bg-emerald-400";
  const textTone = pct > 100 ? "text-rose-300/80" : pct >= 70 ? "text-amber-200/80" : "text-white/45";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 flex-1 rounded-full bg-white/[0.08] overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${Math.min(Math.max(pct, used > 0 ? 3 : 0), 100)}%` }} />
      </div>
      <span className={cn("font-mono text-[10px] tabular-nums shrink-0", textTone)}>
        {used.toLocaleString()} / {limit.toLocaleString()}
      </span>
    </div>
  );
}

export default function BusinessTeam() {
  usePageMeta({ title: "Team — Business" });
  return (
    <BusinessPage
      eyebrow={<><span className="text-[hsl(215,100%,72%)]">Govern</span><span className="text-white/20">·</span><span>Roster & access</span></>}
      title="Team."
      subtitle="Invite teammates, assign roles, cap spend per seat, and manage who can do what across the workspace."
    >
      <TeamContent />
    </BusinessPage>
  );
}
