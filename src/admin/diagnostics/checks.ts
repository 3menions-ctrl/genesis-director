/**
 * Diagnostic check battery — the actual read-only probes that run against the
 * live backend, grouped into four domains: platform, app, business accounts and
 * regular user accounts.
 *
 * RULES
 *  - Every probe is strictly READ-ONLY (head counts, SELECT, SECURITY DEFINER
 *    read RPCs, GET-style edge invokes). Nothing here mutates data.
 *  - Results are REAL. A missing RPC / RLS denial / unreachable table surfaces as
 *    a genuine fail with the backend's own error text — that is the whole point.
 *  - Probes never throw for "found a problem"; they return a fail/warn outcome.
 *    They only throw on unexpected exceptions, which the engine catches.
 */
import { supabase } from "@/integrations/supabase/client";
import type { DiagnosticCheck, CheckOutcome } from "./engine";

// Minimal read-only view of the Supabase client. Typing the query builder as a
// self-returning, awaitable `QB` keeps every probe strictly read-only and free
// of `any`, without depending on the (known-drifted) generated DB types.
type CountResult = { count: number | null; error: { message: string } | null };
interface QB extends PromiseLike<CountResult> {
  select(sel: string, opts?: { count?: "exact"; head?: boolean }): QB;
  eq(col: string, val: unknown): QB;
  gte(col: string, val: string): QB;
  lt(col: string, val: string): QB;
  in(col: string, vals: readonly unknown[]): QB;
  not(col: string, op: string, val: unknown): QB;
  limit(n: number): QB;
}
const sb = supabase as unknown as {
  from: (t: string) => QB;
  rpc: (n: string, args?: unknown) => Promise<{ data: unknown; error: { message: string } | null }>;
  auth: { getUser: () => Promise<{ data: { user: { id: string } | null } }> };
  functions: { invoke: (n: string, o?: unknown) => Promise<{ data: unknown; error: { message: string } | null }> };
};
type Filter = (q: QB) => QB;

const ISO = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();
const DAY = 86_400_000;

// ── Probe builders ───────────────────────────────────────────────────────────

/** Confirm a table is reachable + readable under the current RLS. */
async function tableReadable(table: string, filter?: Filter): Promise<CheckOutcome> {
  let q = sb.from(table).select("*", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count, error } = await q;
  if (error) return { status: "fail", message: `Cannot read ${table}`, detail: error.message };
  return { status: "pass", message: `${table} readable`, metric: `${(count ?? 0).toLocaleString()} rows` };
}

/** Count a "problem set" and grade it against warn/fail thresholds. */
async function problemCount(
  table: string,
  filter: Filter,
  o: { label: string; unit: string; warnAt: number; failAt: number; okMessage: string },
): Promise<CheckOutcome> {
  const { count, error } = await filter(sb.from(table).select("*", { count: "exact", head: true }));
  if (error) return { status: "fail", message: `Cannot evaluate ${o.label}`, detail: error.message };
  const n = count ?? 0;
  const metric = `${n.toLocaleString()} ${o.unit}`;
  if (n >= o.failAt) return { status: "fail", message: `${o.label}: ${n.toLocaleString()} ${o.unit}`, metric };
  if (n >= o.warnAt) return { status: "warn", message: `${o.label}: ${n.toLocaleString()} ${o.unit}`, metric };
  return { status: "pass", message: o.okMessage, metric };
}

/** Call a read-only RPC and pass iff it returns without error. */
async function rpcReachable(name: string, args?: unknown, describe = "responded"): Promise<CheckOutcome> {
  const { error } = await sb.rpc(name, args);
  if (error) return { status: "fail", message: `RPC ${name} failed`, detail: error.message, metric: "error" };
  return { status: "pass", message: `${name} ${describe}`, metric: "ok" };
}

/** Two head-counts → a success-rate grade over a window. */
async function successRate(
  table: string, sinceMsAgo: number, failFilter: Filter,
  o: { label: string; warnBelow: number; failBelow: number },
): Promise<CheckOutcome> {
  const base: Filter = (q) => q.gte("created_at", ISO(sinceMsAgo));
  const [tot, fail] = await Promise.all([
    base(sb.from(table).select("*", { count: "exact", head: true })),
    failFilter(base(sb.from(table).select("*", { count: "exact", head: true }))),
  ]);
  if (tot.error) return { status: "fail", message: `Cannot read ${table}`, detail: tot.error.message };
  if (fail.error) return { status: "fail", message: `Cannot read ${table} failures`, detail: fail.error.message };
  const total = tot.count ?? 0;
  if (total === 0) return { status: "pass", message: `${o.label}: no activity in window`, metric: "idle" };
  const rate = Math.round(((total - (fail.count ?? 0)) / total) * 1000) / 10;
  const metric = `${rate}% ok`;
  if (rate < o.failBelow) return { status: "fail", message: `${o.label}: ${rate}% success`, metric, detail: `${fail.count} of ${total} failed` };
  if (rate < o.warnBelow) return { status: "warn", message: `${o.label}: ${rate}% success`, metric, detail: `${fail.count} of ${total} failed` };
  return { status: "pass", message: `${o.label}: ${rate}% success`, metric };
}

// ── The battery ──────────────────────────────────────────────────────────────

export function buildChecks(): DiagnosticCheck[] {
  return [
    // ── PLATFORM ─────────────────────────────────────────────────────────────
    {
      id: "plat.db", label: "Database connectivity", domain: "platform", group: "Core",
      run: () => tableReadable("profiles"),
    },
    {
      id: "plat.admin", label: "Admin authorization (is_admin)", domain: "platform", group: "Core",
      hint: "If this fails the whole console is unauthorized.", link: "/admin/roles",
      run: async () => {
        const { data: { user } } = await sb.auth.getUser();
        if (!user) return { status: "fail", message: "No authenticated session" };
        const { data, error } = await sb.rpc("is_admin", { _user_id: user.id });
        if (error) return { status: "fail", message: "is_admin RPC failed", detail: error.message };
        return data === true
          ? { status: "pass", message: "Authenticated as admin", metric: "admin" }
          : { status: "warn", message: "Session is not admin", metric: "non-admin" };
      },
    },
    {
      id: "plat.pulse", label: "Dashboard pulse RPC", domain: "platform", group: "Core RPCs",
      hint: "Powers the dashboard KPIs; failure triggers the degraded fallback.", link: "/admin",
      run: () => rpcReachable("admin_dashboard_pulse"),
    },
    {
      id: "plat.dbdiag", label: "DB diagnostics RPC", domain: "platform", group: "Core RPCs",
      link: "/admin/db-diagnostics", run: () => rpcReachable("admin_db_diagnostics"),
    },
    {
      id: "plat.storage", label: "Storage overview RPC", domain: "platform", group: "Core RPCs",
      link: "/admin/storage", run: () => rpcReachable("admin_storage_overview"),
    },
    {
      id: "plat.audit", label: "Audit log RPC", domain: "platform", group: "Core RPCs",
      link: "/admin/audit", run: () => rpcReachable("admin_get_audit_logs", { p_limit: 1, p_offset: 0 }),
    },
    {
      id: "plat.secrets", label: "Edge secrets present", domain: "platform", group: "Edge",
      hint: "Missing secrets break checkout, email and OAuth.", link: "/admin/secrets",
      run: async () => {
        const keys = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "SEND_EMAIL_HOOK_SECRET", "OAUTH_STATE_SECRET"];
        const { data, error } = await sb.functions.invoke("check-secrets-status", { body: { keys } });
        if (error) return { status: "warn", message: "Secret-status function unreachable", detail: error.message, metric: "unknown" };
        const status = (data as { status?: Record<string, string> } | null)?.status ?? {};
        const missing = keys.filter((k) => status[k] === "missing");
        const unknown = keys.filter((k) => !status[k] || status[k] === "unknown");
        if (missing.length) return { status: "fail", message: `${missing.length} secret(s) missing`, detail: missing.join(", "), metric: `${missing.length} missing` };
        if (unknown.length === keys.length) return { status: "warn", message: "Secret presence unknown", detail: "check-secrets-status returned no data", metric: "unknown" };
        return { status: "pass", message: "Critical secrets present", metric: `${keys.length - unknown.length}/${keys.length}` };
      },
    },

    // ── APP & RENDER PIPELINE ────────────────────────────────────────────────
    {
      id: "app.clips", label: "Render clips table", domain: "app", group: "Pipeline",
      link: "/admin/queue", run: () => tableReadable("video_clips"),
    },
    {
      id: "app.render_success", label: "Render success (24h)", domain: "app", group: "Pipeline",
      hint: "Drops below 80% usually mean a provider or stitcher regression.", link: "/admin/observability",
      run: async () => {
        const { data, error } = await sb.rpc("render_success_snapshot", { window_hours: 24 });
        if (error) return { status: "fail", message: "render_success_snapshot failed", detail: error.message };
        const row = ((data as { failures: number; success_rate_pct: number }[]) ?? [])[0];
        if (!row) return { status: "pass", message: "No render activity in 24h", metric: "idle" };
        const rate = Number(row.success_rate_pct);
        const metric = `${rate}%`;
        if (rate < 70) return { status: "fail", message: `Render success ${rate}%`, detail: `${row.failures} failures`, metric };
        if (rate < 90) return { status: "warn", message: `Render success ${rate}%`, detail: `${row.failures} failures`, metric };
        return { status: "pass", message: `Render success ${rate}%`, metric };
      },
    },
    {
      id: "app.stuck", label: "Stuck render jobs (>10m)", domain: "app", group: "Pipeline",
      hint: "Clips pending/generating with no update for 10m are likely wedged.", link: "/admin/queue",
      run: () => problemCount("video_clips",
        (q) => q.in("status", ["pending", "generating"]).lt("updated_at", ISO(10 * 60_000)),
        { label: "Stuck jobs", unit: "stuck", warnAt: 1, failAt: 25, okMessage: "No stuck render jobs" }),
    },
    {
      id: "app.failed_projects", label: "Projects in failed state", domain: "app", group: "Pipeline",
      link: "/admin/projects?status=failed",
      run: () => problemCount("movie_projects", (q) => q.eq("status", "failed"),
        { label: "Failed projects", unit: "failed", warnAt: 5, failAt: 100, okMessage: "No failed projects" }),
    },
    {
      id: "app.stitch", label: "Stitch jobs table", domain: "app", group: "Pipeline",
      run: () => tableReadable("stitch_jobs"),
    },
    {
      id: "app.providers", label: "Provider call success (24h)", domain: "app", group: "Providers",
      hint: "High upstream failure rate points at a flaky model/provider.", link: "/admin/providers",
      run: () => successRate("api_cost_logs", DAY, (q) => q.eq("status", "failed"),
        { label: "Provider calls", warnBelow: 90, failBelow: 75 }),
    },
    {
      id: "app.render_failures", label: "Render failure log RPC", domain: "app", group: "Providers",
      link: "/admin/observability", run: () => rpcReachable("render_failures_histogram", { window_hours: 24 }),
    },

    // ── BUSINESS ACCOUNTS ────────────────────────────────────────────────────
    {
      id: "biz.orgs", label: "Organizations table", domain: "business", group: "Workspaces",
      link: "/admin/orgs", run: () => tableReadable("organizations"),
    },
    {
      id: "biz.members", label: "Org members table", domain: "business", group: "Workspaces",
      run: () => tableReadable("organization_members"),
    },
    {
      id: "biz.subs", label: "Subscriptions table", domain: "business", group: "Billing",
      link: "/admin/subscriptions",
      run: () => tableReadable("subscriptions", (q) => q.eq("status", "active")),
    },
    {
      id: "biz.api_keys", label: "Org API keys table", domain: "business", group: "Integrations",
      link: "/admin/api-keys", run: () => tableReadable("org_api_keys"),
    },
    {
      id: "biz.webhooks", label: "Webhook endpoints failing", domain: "business", group: "Integrations",
      hint: "Endpoints with repeated delivery failures need attention.", link: "/admin/webhooks",
      run: () => problemCount("webhook_endpoints", (q) => q.eq("active", true).gte("failure_count", 5),
        { label: "Failing webhooks", unit: "endpoints", warnAt: 1, failAt: 20, okMessage: "No failing webhook endpoints" }),
    },
    {
      id: "biz.refunds", label: "Pending refund requests", domain: "business", group: "Billing",
      hint: "Pending refunds are real-money requests awaiting an operator.", link: "/admin/refunds",
      run: () => problemCount("refund_requests", (q) => q.eq("status", "pending"),
        { label: "Pending refunds", unit: "pending", warnAt: 1, failAt: 50, okMessage: "No pending refunds" }),
    },
    {
      id: "biz.pnl", label: "Ledger P&L RPC", domain: "business", group: "Billing",
      link: "/admin/pnl", run: () => rpcReachable("ledger_pnl"),
    },
    {
      id: "biz.reconcile", label: "Credit-balance drift", domain: "business", group: "Billing",
      hint: "Accounts whose cached balance disagrees with the ledger.", link: "/admin/pnl",
      run: async () => {
        const { data, error } = await sb.rpc("ledger_reconcile");
        if (error) return { status: "fail", message: "ledger_reconcile failed", detail: error.message };
        const drift = (data as unknown[]) ?? [];
        if (drift.length === 0) return { status: "pass", message: "Balances reconciled", metric: "0 drift" };
        return { status: drift.length > 10 ? "fail" : "warn", message: `${drift.length} account(s) drifting`, metric: `${drift.length} drift` };
      },
    },

    // ── REGULAR USER ACCOUNTS ────────────────────────────────────────────────
    {
      id: "user.profiles", label: "Profiles + email column", domain: "user", group: "Identity",
      hint: "Email may be column-revoked; a fail here means the profile read path is broken.", link: "/admin/users",
      run: async () => {
        const { error } = await sb.from("profiles").select("id,email").limit(1);
        if (error) return { status: "warn", message: "Profile email column not readable", detail: error.message, metric: "restricted" };
        return { status: "pass", message: "Profiles + email readable", metric: "ok" };
      },
    },
    {
      id: "user.credits", label: "Credit transactions table", domain: "user", group: "Credits",
      link: "/admin/credits", run: () => tableReadable("credit_transactions"),
    },
    {
      id: "user.sessions", label: "Sessions RPC", domain: "user", group: "Identity",
      link: "/admin/sessions", run: () => rpcReachable("admin_list_sessions", { p_limit: 1 }),
    },
    {
      id: "user.onboarding", label: "Onboarding intents RPC", domain: "user", group: "Lifecycle",
      link: "/admin/onboarding-analytics", run: () => rpcReachable("admin_list_onboarding_intents", { p_limit: 1 }),
    },
    {
      id: "user.support", label: "Open support tickets", domain: "user", group: "Support",
      hint: "Open tickets awaiting a first response.", link: "/admin/messages",
      run: () => problemCount("support_messages", (q) => q.eq("status", "open"),
        { label: "Open tickets", unit: "open", warnAt: 5, failAt: 50, okMessage: "Support inbox clear" }),
    },
    {
      id: "user.gdpr", label: "Overdue GDPR requests (>30d)", domain: "user", group: "Compliance",
      hint: "Statutory requests past the 30-day response window.", link: "/admin/gdpr",
      run: () => problemCount("gdpr_requests",
        (q) => q.not("status", "in", "(completed,rejected)").lt("created_at", ISO(30 * DAY)),
        { label: "Overdue GDPR", unit: "overdue", warnAt: 1, failAt: 5, okMessage: "No overdue GDPR requests" }),
    },
    {
      id: "user.signups", label: "Signup analytics table", domain: "user", group: "Lifecycle",
      link: "/admin/cohorts", run: () => tableReadable("signup_analytics"),
    },
    {
      id: "user.notif_prefs", label: "Notification preferences table", domain: "user", group: "Identity",
      run: async () => {
        const { error } = await sb.from("notification_preferences").select("*", { count: "exact", head: true });
        if (error) return { status: "warn", message: "notification_preferences not readable", detail: error.message, metric: "restricted" };
        return { status: "pass", message: "notification_preferences readable", metric: "ok" };
      },
    },
  ];
}
