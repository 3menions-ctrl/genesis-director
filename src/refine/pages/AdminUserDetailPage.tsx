/**
 * AdminUserDetailPage — /admin/users/:userId
 *
 * Rich detail card for a single user with every admin power surfaced:
 *   • Profile + auth metadata (email, last sign-in, banned, SSO)
 *   • Project / credit / support roll-up stats
 *   • Organization memberships
 *   • Roles (admin/moderator/etc.)
 *   • Action menu: Grant credits, Suspend, Restore, Force verify,
 *     Send password reset, Send magic link, Revoke all sessions,
 *     Generate impersonation link, Delete account
 *   • Recent admin audit log involving this user
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  AlertCircle, ArrowLeft, BadgeCheck, Coins, Key, Link2, Lock,
  Mail, RefreshCcw, ShieldCheck, ShieldOff, Sparkles, Trash2,
  UserCog, UserMinus, UserX, Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSafeNavigation } from "@/lib/navigation";
import { AdminPageShell } from "../components/AdminPageShell";
import { FloatSection, FloatTable, FloatStat, StatusPill, DeckButton } from "@/admin/ui/primitives";
import { TrendArea, CategoryBars, countBy, bucketByDay, topN } from "@/admin/ui/charts";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/Spinner";

interface UserDetail {
  profile: {
    id: string;
    email: string | null;
    display_name: string | null;
    full_name: string | null;
    avatar_url: string | null;
    credits_balance: number;
    total_credits_purchased: number;
    total_credits_used: number;
    account_type: string | null;
    account_tier: string | null;
    onboarding_completed: boolean | null;
    suspended_at: string | null;
    suspension_reason: string | null;
    created_at: string;
    updated_at: string | null;
    security_version: number | null;
  };
  auth: {
    email?: string;
    phone?: string | null;
    email_confirmed_at?: string | null;
    last_sign_in_at?: string | null;
    created_at?: string;
    banned_until?: string | null;
    is_sso_user?: boolean;
  };
  stats: {
    project_count: number;
    completed_projects: number;
    failed_projects: number;
    lifetime_credit_grants: number;
    lifetime_credit_spend: number;
    support_message_count: number;
    last_project_at: string | null;
  };
  roles: string[];
  organizations: Array<{
    organization_id: string;
    name: string;
    role: string;
    joined_at: string;
  }>;
}

interface AuditRow {
  id: string;
  admin_email: string | null;
  action: string;
  target_type: string;
  target_id: string;
  details: Record<string, unknown>;
  created_at: string;
}

export default function AdminUserDetailPage() {
  const { userId = "" } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const { navigate } = useSafeNavigation();
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setLoadError(null);
    try {
      // Preferred path: rich detail bundle from the admin_get_user_detail RPC
      // (only present after the 20260610094658_admin_user_powers migration
      // has been applied). If it isn't there, we fall back to direct table
      // queries so the page works in any environment.
      const { data: rpcData, error: rpcErr } = await supabase.rpc(
        "admin_get_user_detail" as never,
        { p_target_user: userId } as never,
      );

      if (!rpcErr && rpcData) {
        setDetail(rpcData as unknown as UserDetail);
        try {
          const { data: a } = await supabase.rpc("admin_recent_user_actions" as never, {
            p_target_user: userId,
            p_limit: 50,
          } as never);
          setAudit((a as unknown as AuditRow[]) ?? []);
        } catch {
          setAudit([]);
        }
        return;
      }

      if (rpcErr) {
        console.warn("[AdminUserDetail] RPC failed, falling back:", rpcErr.message);
      }

      // Fallback — full row via SECURITY DEFINER admin RPC (profiles.email is
      // column-revoked from `authenticated`, so a direct `select('*')` fails;
      // admin_get_profile is is_admin-gated and returns the full row).
      const { data: profile, error: profileErr } = await (
        supabase.rpc as unknown as (
          fn: string,
          args: Record<string, unknown>,
        ) => { maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> }
      )("admin_get_profile", { p_user_id: userId }).maybeSingle();
      if (profileErr) {
        throw new Error(`profiles fetch: ${profileErr.message}`);
      }
      if (!profile) {
        setLoadError(
          `No profile row for ${userId.slice(0, 8)}…. Either the ID is wrong, the user was deleted, or RLS is denying your read.`,
        );
        setDetail(null);
        return;
      }

      const [projAll, projDone, projFail, txGrants, txSpend, tickets, lastProj, roleRows] =
        await Promise.all([
          supabase.from("movie_projects").select("id", { count: "exact", head: true }).eq("user_id", userId),
          supabase.from("movie_projects").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "completed"),
          supabase.from("movie_projects").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "failed"),
          supabase.from("credit_transactions").select("amount").eq("user_id", userId).eq("transaction_type", "grant"),
          supabase.from("credit_transactions").select("amount").eq("user_id", userId).lt("amount", 0),
          supabase.from("support_messages").select("id", { count: "exact", head: true }).eq("user_id", userId),
          supabase.from("movie_projects").select("created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("user_roles").select("role").eq("user_id", userId),
        ]);

      const grants = (txGrants.data ?? []).reduce(
        (s: number, r: { amount: number }) => s + (r.amount ?? 0),
        0,
      );
      const spend = (txSpend.data ?? []).reduce(
        (s: number, r: { amount: number }) => s + Math.abs(r.amount ?? 0),
        0,
      );

      setDetail({
        profile: profile as UserDetail["profile"],
        auth: {
          email: profile.email ?? undefined,
          email_confirmed_at: undefined,
          last_sign_in_at: undefined,
          banned_until: undefined,
          is_sso_user: undefined,
        },
        stats: {
          project_count: projAll.count ?? 0,
          completed_projects: projDone.count ?? 0,
          failed_projects: projFail.count ?? 0,
          lifetime_credit_grants: grants,
          lifetime_credit_spend: spend,
          support_message_count: tickets.count ?? 0,
          last_project_at: lastProj.data?.created_at ?? null,
        },
        roles: (roleRows.data ?? []).map((r: { role: string }) => r.role),
        organizations: [],
      });
      setAudit([]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load user";
      console.error("[AdminUserDetail] load error", e);
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  const isSelf = user?.id === userId;
  const isTargetAdmin = detail?.roles?.includes("admin") ?? false;
  const isSuspended = !!detail?.profile.suspended_at;

  // Charts derive from the same admin_recent_user_actions rows already loaded.
  const actionsPerDay = useMemo(() => bucketByDay(audit, (a) => a.created_at, { days: 30 }), [audit]);
  const actionsByType = useMemo(() => topN(countBy(audit, (a) => a.action.replace(/_/g, " ")), 8), [audit]);

  // ── Action handlers ────────────────────────────────────────────────
  const callEdgeAction = async (
    action:
      | "delete" | "force_verify" | "send_password_reset"
      | "send_magic_link" | "generate_impersonation_link",
    reason?: string,
    confirmCopy?: string,
  ) => {
    if (confirmCopy && !window.confirm(confirmCopy)) return;
    setActing(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-action", {
        body: { action, userId, reason },
      });
      if (error) throw error;
      const payload = data as { ok: boolean; error?: string; action_link?: string; warning?: string };
      if (!payload.ok) throw new Error(payload.error ?? "Action failed");
      toast.success("Action complete");
      if (payload.action_link) {
        try { await navigator.clipboard.writeText(payload.action_link); } catch {}
        toast.success("Action link copied to clipboard");
      }
      if (action === "delete") {
        toast.success("User account deleted");
        navigate("/admin/users", { replace: true });
        return;
      }
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActing(false);
    }
  };

  const grantCredits = async () => {
    const amountRaw = window.prompt("Grant how many credits? (1–10,000)");
    if (!amountRaw) return;
    const amount = parseInt(amountRaw, 10);
    if (!Number.isFinite(amount) || amount <= 0) return toast.error("Invalid amount");
    const reason = window.prompt("Reason for grant?") ?? "";
    setActing(true);
    try {
      const { error } = await supabase.rpc("admin_grant_credits" as never, {
        p_target_user: userId,
        p_amount: amount,
        p_reason: reason,
      } as never);
      if (error) throw error;
      toast.success(`Granted ${amount} credits`);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Grant failed");
    } finally {
      setActing(false);
    }
  };

  const suspend = async () => {
    const reason = window.prompt("Reason for suspension?");
    if (!reason) return;
    setActing(true);
    try {
      const { error } = await supabase.rpc("admin_suspend_account", {
        p_target_user: userId,
        p_reason: reason,
      });
      if (error) throw error;
      toast.success("Account suspended");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Suspend failed");
    } finally {
      setActing(false);
    }
  };

  const restore = async () => {
    if (!window.confirm("Restore this account? They will regain access on next sign-in.")) return;
    setActing(true);
    try {
      const { error } = await supabase.rpc("admin_unsuspend_account", { p_target_user: userId });
      if (error) throw error;
      toast.success("Account restored");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setActing(false);
    }
  };

  const revokeSessions = async () => {
    if (!window.confirm("Force sign-out of every active session for this user?")) return;
    setActing(true);
    try {
      const { error } = await supabase.rpc("admin_revoke_user_sessions" as never, {
        p_target_user: userId,
        p_reason: "manual_admin_action",
      } as never);
      if (error) throw error;
      toast.success("Sessions revoked");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Revoke failed");
    } finally {
      setActing(false);
    }
  };

  return (
    <AdminPageShell
      eyebrow="03 // ACCESS"
      code="USR"
      title="User"
      italic="Detail."
      description="Every power an operator needs over a single account — view, audit, mutate, revoke, delete."
      actions={
        <DeckButton onClick={() => navigate("/admin/users")}>
          <ArrowLeft className="w-3 h-3" /> All users
        </DeckButton>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-24 gap-3 text-white/55">
          <Spinner size="md" tone="muted" />
          <span className="text-[12px] font-mono uppercase tracking-[0.22em]">Loading user…</span>
        </div>
      ) : !detail ? (
        <div className="text-center py-12 text-white/65 max-w-xl mx-auto">
          <AlertCircle className="w-5 h-5 mx-auto mb-3 text-rose-300" />
          <div className="text-[15px] mb-2 text-white">User not found.</div>
          {loadError ? (
            <div className="font-mono text-[11px] text-rose-200/80 bg-rose-500/[0.06] border border-rose-500/20 rounded-md px-3 py-2 mt-3 text-left">
              {loadError}
            </div>
          ) : null}
          <div className="text-[12px] text-white/45 mt-4 leading-relaxed">
            Common causes: the new <span className="font-mono text-white/70">20260610094658_admin_user_powers</span> migration hasn&rsquo;t been pushed yet; your current session isn&rsquo;t in <span className="font-mono text-white/70">user_roles</span> with <span className="font-mono text-white/70">role=&lsquo;admin&rsquo;</span>; or the user ID in the URL is wrong.
          </div>
          <div className="mt-5 flex justify-center">
            <DeckButton onClick={() => void load()}>Retry</DeckButton>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-x-14 gap-y-12">
          {/* Left column — profile + stats */}
          <div className="space-y-12">
            <div>
              <div className="flex items-start gap-4">
                {detail.profile.avatar_url ? (
                  <img
                    src={detail.profile.avatar_url}
                    alt=""
                    className="w-16 h-16 rounded-2xl object-cover border border-white/[0.08]"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-glass-hover border border-white/[0.08] flex items-center justify-center">
                    <Users className="w-5 h-5 text-white/55" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <h2 className="font-display text-[24px] text-white font-light leading-tight truncate">
                      {detail.profile.display_name || detail.profile.full_name || "Unnamed"}
                    </h2>
                    {isTargetAdmin && <StatusPill tone="danger">Admin</StatusPill>}
                    {isSuspended && <StatusPill tone="warn">Suspended</StatusPill>}
                    {detail.auth.email_confirmed_at && <StatusPill tone="positive">Verified</StatusPill>}
                  </div>
                  <div className="font-mono text-[12px] text-white/65 truncate">
                    {detail.profile.email ?? detail.auth.email ?? "—"}
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/30 mt-2">
                    Joined {new Date(detail.profile.created_at).toLocaleDateString()} · ID {detail.profile.id.slice(0, 8)}…
                  </div>
                </div>
              </div>
              {isSuspended && detail.profile.suspension_reason && (
                <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/[0.04] p-4 text-[12px] text-amber-100">
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-amber-300 mr-2">
                    Suspension reason:
                  </span>
                  {detail.profile.suspension_reason}
                </div>
              )}
            </div>

            <FloatSection title="Activity at a glance">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-8">
                <FloatStat index={0} label="Credits balance" value={detail.profile.credits_balance.toLocaleString()} accentNumber />
                <FloatStat index={1} label="Lifetime granted" value={detail.stats.lifetime_credit_grants.toLocaleString()} />
                <FloatStat index={2} label="Projects" value={`${detail.stats.completed_projects}/${detail.stats.project_count}`} />
                <FloatStat index={3} label="Support tickets" value={detail.stats.support_message_count} />
              </div>
            </FloatSection>

            <FloatSection title="Identity">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-[13px]">
                <Field label="Email">{detail.profile.email ?? "—"}</Field>
                <Field label="Phone">{detail.auth.phone ?? "—"}</Field>
                <Field label="Account type">{detail.profile.account_type ?? "personal"}</Field>
                <Field label="Account tier">{detail.profile.account_tier ?? "free"}</Field>
                <Field label="Onboarded">{detail.profile.onboarding_completed ? "yes" : "no"}</Field>
                <Field label="Email confirmed">
                  {detail.auth.email_confirmed_at
                    ? new Date(detail.auth.email_confirmed_at).toLocaleDateString()
                    : "no"}
                </Field>
                <Field label="Last sign-in">
                  {detail.auth.last_sign_in_at
                    ? new Date(detail.auth.last_sign_in_at).toLocaleString()
                    : "—"}
                </Field>
                <Field label="Security version">{detail.profile.security_version ?? "—"}</Field>
              </div>
            </FloatSection>

            {detail.organizations.length > 0 && (
              <FloatSection title="Workspace memberships" meta={`${detail.organizations.length} orgs`}>
                <FloatTable
                  columns={[
                    { key: "name", label: "Workspace" },
                    { key: "role", label: "Role" },
                    { key: "joined", label: "Joined", align: "right" },
                  ]}
                  rows={detail.organizations.map((o) => ({
                    _key: o.organization_id,
                    name: <span className="text-white/90">{o.name}</span>,
                    role: <StatusPill tone="accent">{o.role}</StatusPill>,
                    joined: <span className="text-white/45 font-mono text-[11px]">{new Date(o.joined_at).toLocaleDateString()}</span>,
                  }))}
                />
              </FloatSection>
            )}

            {audit.length > 0 && (
              <div className="grid grid-cols-1 gap-x-14 gap-y-12 md:grid-cols-2">
                <FloatSection title="Action volume" meta="last 30 days">
                  <TrendArea data={actionsPerDay} valueLabel="actions" height={180} />
                </FloatSection>
                <FloatSection title="By action" meta={`${audit.length} entries`}>
                  <CategoryBars data={actionsByType} valueSuffix="x" />
                </FloatSection>
              </div>
            )}

            <FloatSection title="Recent admin actions" meta={`${audit.length} entries`}>
              <FloatTable
                columns={[
                  { key: "time", label: "When" },
                  { key: "action", label: "Action" },
                  { key: "admin", label: "Operator" },
                  { key: "reason", label: "Reason", align: "right" },
                ]}
                rows={audit.map((a) => ({
                  _key: a.id,
                  time: <span className="text-white/55 font-mono text-[10px] uppercase tracking-[0.22em] whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</span>,
                  action: <StatusPill tone="accent">{a.action.replace(/_/g, " ")}</StatusPill>,
                  admin: <span className="text-white/65 text-[12px] truncate">{a.admin_email ?? "system"}</span>,
                  reason: <span className="text-white/40 font-mono text-[10px]">{(a.details as { reason?: string })?.reason ?? ""}</span>,
                }))}
                empty="No admin actions recorded"
              />
            </FloatSection>
          </div>

          {/* Right column — actions */}
          <div className="space-y-12">
            <FloatSection title="Operator actions">
              <p className="text-[11px] text-white/45 -mt-2 mb-5 leading-relaxed">
                Every action below is logged to admin_audit_log. Self-targeting is blocked at the RPC level.
              </p>

              <div className="flex flex-col items-start gap-2">
                <ActionRow
                  icon={Coins}
                  label="Grant credits"
                  tone="brand"
                  disabled={isSelf || acting}
                  onClick={grantCredits}
                />
                {!isSuspended ? (
                  <ActionRow
                    icon={UserMinus}
                    label="Suspend account"
                    tone="amber"
                    disabled={isSelf || acting}
                    onClick={suspend}
                  />
                ) : (
                  <ActionRow
                    icon={BadgeCheck}
                    label="Restore account"
                    tone="emerald"
                    disabled={acting}
                    onClick={restore}
                  />
                )}
                <ActionRow
                  icon={Mail}
                  label="Send password reset"
                  disabled={isSelf || acting}
                  onClick={() => callEdgeAction("send_password_reset")}
                />
                <ActionRow
                  icon={Sparkles}
                  label="Send magic link"
                  disabled={isSelf || acting}
                  onClick={() => callEdgeAction("send_magic_link")}
                />
                <ActionRow
                  icon={ShieldCheck}
                  label="Force verify email"
                  disabled={isSelf || acting || !!detail.auth.email_confirmed_at}
                  onClick={() => callEdgeAction("force_verify", "manual_verify")}
                />
                <ActionRow
                  icon={Lock}
                  label="Revoke all sessions"
                  disabled={isSelf || acting}
                  onClick={revokeSessions}
                />
                <ActionRow
                  icon={Link2}
                  label="Generate impersonation link"
                  disabled={isSelf || acting}
                  onClick={() =>
                    callEdgeAction(
                      "generate_impersonation_link",
                      "support",
                      "Generate a one-shot sign-in link for this user? Open it in an INCOGNITO window — it signs you in as them.",
                    )
                  }
                />
                <div className="h-px w-full bg-white/[0.06] my-2" />
                <ActionRow
                  icon={Trash2}
                  label="Delete account"
                  tone="destructive"
                  disabled={isSelf || isTargetAdmin || acting}
                  onClick={() =>
                    callEdgeAction(
                      "delete",
                      window.prompt("Why are you deleting this account?") ?? "manual_delete",
                      `Permanently delete this user? This wipes auth.users, profiles, projects, credits, and every cascaded record. Cannot be undone.`,
                    )
                  }
                />
                {isTargetAdmin && (
                  <p className="text-[10px] text-white/35 mt-2 leading-relaxed">
                    Admins cannot be deleted from this surface — demote first via the Roles page.
                  </p>
                )}
                {isSelf && (
                  <p className="text-[10px] text-amber-300/85 mt-2 leading-relaxed">
                    You're looking at your own account. Self-targeting actions are blocked.
                  </p>
                )}
              </div>
            </FloatSection>

            <FloatSection title="Role">
              <div className="flex flex-wrap gap-1.5">
                {detail.roles.length === 0 ? (
                  <span className="text-[12px] text-white/45">No assigned roles</span>
                ) : (
                  detail.roles.map((r) => (
                    <StatusPill key={r} tone="accent">{r}</StatusPill>
                  ))
                )}
              </div>
            </FloatSection>
          </div>
        </div>
      )}
    </AdminPageShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-[0.32em] text-white/35 mb-1">
        {label}
      </div>
      <div className="text-white/80 truncate">{children}</div>
    </div>
  );
}

function ActionRow({
  icon: Icon,
  label,
  onClick,
  tone = "neutral",
  disabled,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  tone?: "neutral" | "brand" | "amber" | "emerald" | "destructive";
  disabled?: boolean;
}) {
  return (
    <DeckButton onClick={onClick} disabled={disabled} accent={tone === "brand"}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </DeckButton>
  );
}
