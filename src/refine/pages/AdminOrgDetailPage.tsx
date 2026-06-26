/**
 * AdminOrgDetailPage — /admin/orgs/:orgId
 *
 * Single-pane org profile. Tabs:
 *   • Members — current members with role + per-member shortcut to user
 *               detail page; pending invites listed below
 *   • Plan    — plan, credits balance, usage
 *   • Projects — recent projects across all members
 *   • Metadata — slug, industry, website, created/updated
 *
 * Fallback: when admin_get_org_detail isn't deployed, directly queries
 * organizations + organization_members + organization_invites.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  AlertCircle, ArrowLeft, Building2, Crown, Globe, Mail,
  FolderKanban, ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSafeNavigation } from "@/lib/navigation";
import { AdminPageShell } from "../components/AdminPageShell";
import { FloatSection, FloatStat, StatusPill, DeckButton } from "@/admin/ui/primitives";
import { Donut, TrendArea, countBy, bucketByDay } from "@/admin/ui/charts";
import { Spinner } from "@/components/ui/Spinner";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Member {
  user_id: string;
  role: string;
  joined_at: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
}
interface Invite {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  accepted_at: string | null;
}
interface RecentProject {
  id: string;
  title: string | null;
  status: string;
  thumbnail_url: string | null;
  updated_at: string;
}
interface OrgDetail {
  org: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    website: string | null;
    industry: string | null;
    plan: string;
    credits_balance: number;
    total_credits_purchased: number;
    total_credits_used: number;
    created_by: string;
    created_at: string;
    updated_at: string;
  };
  members: Member[];
  invites: Invite[];
  project_count: number;
  recent_projects: RecentProject[];
}

type TabKey = "members" | "plan" | "projects" | "metadata";
type PillTone = "accent" | "positive" | "warn" | "danger" | "neutral";

export default function AdminOrgDetailPage() {
  const { orgId = "" } = useParams<{ orgId: string }>();
  const { navigate } = useSafeNavigation();
  const [detail, setDetail] = useState<OrgDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("members");

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc(
        "admin_get_org_detail" as never,
        { p_org_id: orgId } as never,
      );
      if (!rpcErr && rpcData) {
        setDetail(rpcData as unknown as OrgDetail);
        return;
      }
      if (rpcErr) console.warn("[AdminOrgDetail] RPC failed, fallback:", rpcErr.message);

      const { data: org, error: orgErr } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", orgId)
        .maybeSingle();
      if (orgErr) throw new Error(`organizations: ${orgErr.message}`);
      if (!org) { setLoadError("org_not_found"); setDetail(null); return; }
      const [memRes, invRes, projRes] = await Promise.all([
        supabase
          .from("organization_members")
          .select("user_id, role, joined_at")
          .eq("organization_id", orgId),
        supabase
          .from("organization_invites")
          .select("id, email, role, expires_at, accepted_at")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false }),
        (async () => {
          const { data: members } = await supabase
            .from("organization_members")
            .select("user_id")
            .eq("organization_id", orgId);
          const ids = (members ?? []).map((m: { user_id: string }) => m.user_id);
          if (ids.length === 0) return { data: [] as RecentProject[] };
          const { data } = await supabase
            .from("movie_projects")
            .select("id, title, status, thumbnail_url, updated_at")
            .in("user_id", ids)
            .order("updated_at", { ascending: false, nullsFirst: false })
            .limit(12);
          return { data: (data ?? []) as RecentProject[] };
        })(),
      ]);
      const memberIds = (memRes.data ?? []).map((m: { user_id: string }) => m.user_id);
      const { data: profs } = await (
        supabase.rpc as unknown as (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: Array<Record<string, unknown>> | null }>
      )("admin_profiles_by_ids", { p_ids: memberIds.length > 0 ? memberIds : ["00000000-0000-0000-0000-000000000000"] });
      const profById = new Map((profs ?? []).map((p: { id: string }) => [p.id, p as unknown as Member]));
      const members: Member[] = (memRes.data ?? []).map((m: { user_id: string; role: string; joined_at: string }) => ({
        user_id: m.user_id,
        role: m.role,
        joined_at: m.joined_at,
        email: (profById.get(m.user_id) as unknown as { email?: string })?.email ?? null,
        display_name: (profById.get(m.user_id) as unknown as { display_name?: string })?.display_name ?? null,
        avatar_url: (profById.get(m.user_id) as unknown as { avatar_url?: string })?.avatar_url ?? null,
      }));
      setDetail({
        org: org as OrgDetail["org"],
        members,
        invites: (invRes.data ?? []) as Invite[],
        project_count: projRes.data.length,
        recent_projects: projRes.data,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load org";
      console.error("[AdminOrgDetail] load error", e);
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { void load(); }, [load]);

  // Charts derive from the members + recent_projects already loaded — no fetch.
  const roleDist = useMemo(() => countBy(detail?.members ?? [], (m) => m.role), [detail]);
  const projectStatusDist = useMemo(() => countBy(detail?.recent_projects ?? [], (p) => p.status), [detail]);
  const joinedPerDay = useMemo(() => bucketByDay(detail?.members ?? [], (m) => m.joined_at, { days: 30 }), [detail]);

  return (
    <AdminPageShell
      eyebrow="02 // PEOPLE"
      code="ORG"
      title={detail?.org.name ?? "Organization"}
      italic="Profile."
      description="Single-pane organization view — members, invites, plan, and projects in one place."
      stats={detail ? [
        { label: "Plan",          value: detail.org.plan.toUpperCase(), tone: "blue",    sub: "current tier" },
        { label: "Members",       value: detail.members.length.toLocaleString(), tone: "neutral", sub: `${detail.invites.filter((i) => !i.accepted_at).length} pending` },
        { label: "Projects",      value: detail.project_count.toLocaleString(), tone: "amber",   sub: "across all members" },
        { label: "Credits",       value: detail.org.credits_balance.toLocaleString(), tone: "emerald", sub: `${detail.org.total_credits_used} used` },
      ] : undefined}
      actions={
        <DeckButton onClick={() => navigate("/admin/people")}>
          <ArrowLeft className="w-3 h-3" /> Back
        </DeckButton>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-24 gap-3 text-white/55">
          <Spinner size="md" tone="muted" />
          <span className="text-[12px] font-mono uppercase tracking-[0.22em]">Loading org…</span>
        </div>
      ) : !detail ? (
        <div className="text-center py-12 text-white/65 max-w-xl mx-auto">
          <AlertCircle className="w-5 h-5 mx-auto mb-3 text-rose-300" />
          <div className="text-[15px] mb-2 text-white">Organization not found.</div>
          {loadError && (
            <div className="font-mono text-[11px] text-rose-200/80 bg-rose-500/[0.06] border border-rose-500/20 rounded-md px-3 py-2 mt-3 text-left">
              {loadError}
            </div>
          )}
          <div className="mt-5 flex justify-center">
            <DeckButton onClick={() => void load()}>Retry</DeckButton>
          </div>
        </div>
      ) : (
        <div className="space-y-12">
          {/* Hero */}
          <div className="flex items-start gap-5">
            {detail.org.logo_url ? (
              <img
                src={detail.org.logo_url}
                alt=""
                className="w-16 h-16 rounded-xl object-cover border border-white/[0.08] shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl border border-white/[0.08] bg-glass flex items-center justify-center text-white/55 shrink-0">
                <Building2 className="w-6 h-6" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-mono uppercase tracking-[0.28em] text-white/35 mb-1">
                /{detail.org.slug}
              </div>
              <h2 className="font-display text-[24px] text-white font-light truncate">{detail.org.name}</h2>
              <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px] text-white/55 font-mono">
                {detail.org.industry && <span>{detail.org.industry}</span>}
                {detail.org.website && (
                  <a href={detail.org.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-white">
                    <Globe className="w-3 h-3" /> {detail.org.website.replace(/^https?:\/\//, "")}
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Analytics — derived from the loaded members + recent projects */}
          {(detail.members.length > 0 || detail.recent_projects.length > 0) && (
            <div className="grid grid-cols-1 gap-x-14 gap-y-14 lg:grid-cols-2">
              {detail.members.length > 0 && (
                <FloatSection title="Members by role" meta={`${detail.members.length} members`}>
                  <Donut data={roleDist} centerLabel="members" />
                </FloatSection>
              )}
              {detail.recent_projects.length > 0 && (
                <FloatSection title="Projects by status" meta={`${detail.recent_projects.length} recent`}>
                  <Donut data={projectStatusDist} centerLabel="projects" />
                </FloatSection>
              )}
              {detail.members.length > 0 && (
                <FloatSection title="Members joined" meta="last 30 days" className="lg:col-span-2">
                  <TrendArea data={joinedPerDay} valueLabel="joined" height={180} />
                </FloatSection>
              )}
            </div>
          )}

          {/* Tabs */}
          <div>
            <div className="flex border-b border-white/[0.05]">
              {(["members", "plan", "projects", "metadata"] as TabKey[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={cn(
                    "px-5 py-3 text-[11px] font-mono uppercase tracking-[0.28em] transition-colors relative",
                    tab === k ? "text-white" : "text-white/35 hover:text-white/70",
                  )}
                >
                  {k}
                  {tab === k && <span className="absolute bottom-[-1px] left-3 right-3 h-px bg-primary" />}
                </button>
              ))}
            </div>

            <div className="pt-6">
              {tab === "members" && <MembersTab members={detail.members} invites={detail.invites} />}
              {tab === "plan" && <PlanTab org={detail.org} />}
              {tab === "projects" && <ProjectsTab projects={detail.recent_projects} />}
              {tab === "metadata" && <MetadataTab org={detail.org} />}
            </div>
          </div>
        </div>
      )}
    </AdminPageShell>
  );
}

function roleTone(r: string): PillTone {
  if (r === "owner") return "positive";
  if (r === "admin") return "accent";
  if (r === "producer") return "warn";
  return "neutral";
}

function MembersTab({ members, invites }: { members: Member[]; invites: Invite[] }) {
  const pending = invites.filter((i) => !i.accepted_at);
  return (
    <div className="space-y-12">
      <FloatSection title="Members" meta={`${members.length}`}>
        {members.length === 0 ? (
          <div className="text-[12px] text-white/40 py-4">No members yet.</div>
        ) : (
          <div className="space-y-1.5">
            {members.map((m) => (
              <Link
                key={m.user_id}
                to={`/admin/users/${m.user_id}`}
                className="group flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.015] hover:bg-primary/[0.04] transition-colors"
              >
                {m.avatar_url ? (
                  <img src={m.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover border border-white/[0.08] shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full border border-white/[0.08] bg-glass flex items-center justify-center text-white/55 text-[11px] font-mono shrink-0">
                    {(m.display_name?.[0] || m.email?.[0] || "?").toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] text-white truncate">{m.display_name || m.email || m.user_id.slice(0, 8) + "…"}</div>
                  <div className="text-[11px] text-white/40 truncate font-mono">{m.email}</div>
                </div>
                {m.role === "owner" && <Crown className="w-3.5 h-3.5 text-amber-300" />}
                <StatusPill tone={roleTone(m.role)}>{m.role}</StatusPill>
                <ExternalLink className="w-3.5 h-3.5 text-white/30 group-hover:text-primary" />
              </Link>
            ))}
          </div>
        )}
      </FloatSection>

      {pending.length > 0 && (
        <FloatSection title="Pending invites" meta={`${pending.length}`}>
          <div className="space-y-1.5">
            {pending.map((i) => (
              <div key={i.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.015]">
                <Mail className="w-3.5 h-3.5 text-white/45" />
                <span className="text-[12px] text-white/75 flex-1 truncate">{i.email}</span>
                <StatusPill tone={roleTone(i.role)}>{i.role}</StatusPill>
                <span className="text-[10px] text-white/30 font-mono">expires {new Date(i.expires_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </FloatSection>
      )}
    </div>
  );
}

function PlanTab({ org }: { org: OrgDetail["org"] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      <FloatStat index={0} label="Plan" value={org.plan.toUpperCase()} accentNumber />
      <FloatStat index={1} label="Balance" value={org.credits_balance.toLocaleString()} sub="credits available" />
      <FloatStat index={2} label="Lifetime used" value={org.total_credits_used.toLocaleString()} sub={`${org.total_credits_purchased.toLocaleString()} purchased`} />
    </div>
  );
}

function ProjectsTab({ projects }: { projects: RecentProject[] }) {
  if (projects.length === 0) {
    return <div className="text-[12px] text-white/40 py-4">No projects from this org&apos;s members yet.</div>;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {projects.map((p) => (
        <Link
          key={p.id}
          to={`/admin/projects/${p.id}`}
          className="group rounded-xl bg-white/[0.015] hover:bg-primary/[0.04] overflow-hidden transition-colors"
        >
          <div className="aspect-video bg-black/40">
            {p.thumbnail_url ? (
              <img src={p.thumbnail_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/30">
                <FolderKanban className="w-5 h-5" />
              </div>
            )}
          </div>
          <div className="p-3">
            <div className="text-[12px] text-white truncate">{p.title || "Untitled scene"}</div>
            <div className="text-[10px] text-white/35 font-mono uppercase tracking-[0.22em] mt-1">
              {p.status} · {new Date(p.updated_at).toLocaleDateString()}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function MetadataTab({ org }: { org: OrgDetail["org"] }) {
  const rows: Array<[string, React.ReactNode]> = [
    ["ID", <span className="font-mono text-white/75">{org.id}</span>],
    ["Slug", <span className="font-mono text-white/75">/{org.slug}</span>],
    ["Industry", org.industry ?? "—"],
    ["Website", org.website ? <a href={org.website} target="_blank" rel="noreferrer" className="text-primary/80 hover:underline">{org.website}</a> : "—"],
    ["Created by", <span className="font-mono text-white/75">{org.created_by.slice(0, 8)}…</span>],
    ["Created", new Date(org.created_at).toLocaleString()],
    ["Updated", new Date(org.updated_at).toLocaleString()],
  ];
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-[12px]">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-3 border-b border-white/[0.04] py-2">
          <dt className="text-white/40 font-mono uppercase tracking-[0.22em] text-[10px]">{k}</dt>
          <dd className="text-white/85 text-right truncate">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
