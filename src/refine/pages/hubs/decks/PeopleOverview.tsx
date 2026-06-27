/**
 * PeopleOverview — the "Command Deck" landing for /admin/people.
 *
 * Direction A, completely borderless: figures float on the page, lists are
 * separated only by a thin hairline, generous spacing. Wired to LIVE data —
 * `admin_dashboard_pulse` for the headline figures plus direct admin-gated
 * table reads (profiles / organizations / user_roles) for the trend + lists.
 * Renders embedded inside the People hub shell (no own hero).
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Users, UserPlus, Building2, MessageSquare, ShieldCheck, TrendingUp } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import {
  StatOrb, ORB_AURAS, FloatSection, FloatTable, FloatRow, Avatar, StatusPill, DeckButton,
  ACCENT_HSL, CYAN, accent,
} from "@/admin/ui/primitives";

type Row = Record<string, unknown>;
const str = (r: Row, ...keys: string[]) => { for (const k of keys) { const v = r[k]; if (v != null && v !== "") return String(v); } return ""; };
const num = (r: Row, ...keys: string[]) => { for (const k of keys) { const v = r[k]; if (typeof v === "number") return v; if (v != null && !isNaN(Number(v))) return Number(v); } return 0; };
const ago = (iso?: string) => {
  if (!iso) return "—";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

interface Pulse { users: { total_users: number; signups_24h: number; signups_7d: number }; support: { open_tickets: number } }

export default function PeopleOverview() {
  const [pulse, setPulse] = useState<Pulse>({ users: { total_users: 0, signups_24h: 0, signups_7d: 0 }, support: { open_tickets: 0 } });
  const [orgs, setOrgs] = useState(0);
  const [admins, setAdmins] = useState(0);
  const [series, setSeries] = useState<{ day: string; signups: number }[]>([]);
  const [users, setUsers] = useState<Row[]>([]);
  const [recentOrgs, setRecentOrgs] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const since = new Date(); since.setHours(0, 0, 0, 0); since.setDate(since.getDate() - 13);
        const [pulseRes, orgCount, adminCount, usersRes, orgsRes, trendRes] = await Promise.all([
          supabase.rpc("admin_dashboard_pulse" as never),
          supabase.from("organizations").select("id", { count: "exact", head: true }),
          supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin"),
          // NOTE: profiles email/credits_balance/role columns are REVOKED from
          // authenticated (20260705000200 column-lockdown), so select("*") 403s.
          // Select only granted public columns; email/credits degrade gracefully
          // in this overview (full values are on the RPC-backed detail pages).
          supabase.from("profiles").select("id, display_name, full_name, username, account_tier, avatar_url, created_at").order("created_at", { ascending: false }).limit(7),
          supabase.from("organizations").select("*").order("created_at", { ascending: false }).limit(5),
          supabase.from("profiles").select("created_at").gte("created_at", since.toISOString()),
        ]);

        if (pulseRes.data) setPulse(pulseRes.data as unknown as Pulse);
        setOrgs(orgCount.count ?? 0);
        setAdmins(adminCount.count ?? 0);
        setUsers((usersRes.data as Row[]) ?? []);
        setRecentOrgs((orgsRes.data as Row[]) ?? []);

        const buckets = new Map<string, number>();
        for (let i = 0; i < 14; i++) { const d = new Date(since); d.setDate(since.getDate() + i); buckets.set(d.toISOString().slice(0, 10), 0); }
        for (const r of (trendRes.data as { created_at: string }[]) ?? []) {
          const k = new Date(r.created_at).toISOString().slice(0, 10);
          if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + 1);
        }
        setSeries([...buckets.entries()].map(([k, v]) => ({ day: k.slice(5), signups: v })));
      } catch (e) {
        console.error("[PeopleOverview] load", e);
      } finally { setLoading(false); }
    })();
  }, []);

  const kpis = useMemo(() => ([
    { label: "Total users", value: pulse.users.total_users, icon: Users },
    { label: "New · 24h", value: pulse.users.signups_24h, icon: UserPlus, delta: pulse.users.signups_24h, deltaLabel: "today" },
    { label: "New · 7d", value: pulse.users.signups_7d, icon: TrendingUp, accentNumber: true },
    { label: "Organizations", value: orgs, icon: Building2 },
    { label: "Open tickets", value: pulse.support.open_tickets, icon: MessageSquare },
    { label: "Admins", value: admins, icon: ShieldCheck },
  ]), [pulse, orgs, admins]);

  return (
    <div className="space-y-14">
      {/* KPI rail — floating figures */}
      <div className="grid grid-cols-2 gap-x-10 gap-y-12 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k, i) => <StatOrb key={k.label} index={i} aura={ORB_AURAS[i % ORB_AURAS.length]} {...k} />)}
      </div>

      {/* Dominant trend */}
      <FloatSection title="Sign-ups" meta="last 14 days" actions={<DeckButton accent><Link to="/admin/users">Open users →</Link></DeckButton>}>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 8, right: 6, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="pplFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT_HSL} stopOpacity={0.55} />
                  <stop offset="50%" stopColor={CYAN} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={CYAN} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="pplStroke" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor={ACCENT_HSL} /><stop offset="100%" stopColor={CYAN} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} axisLine={false} interval={1} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
              <Tooltip contentStyle={{ background: "#0a0d14", border: "none", borderRadius: 12, fontSize: 12 }} labelStyle={{ color: "rgba(255,255,255,0.6)" }} itemStyle={{ color: "#fff" }} cursor={{ stroke: accent(0.4) }} />
              <Area type="monotone" dataKey="signups" stroke="url(#pplStroke)" strokeWidth={2.5} fill="url(#pplFill)" dot={false} activeDot={{ r: 5, fill: CYAN, stroke: ACCENT_HSL, strokeWidth: 2 }} isAnimationActive animationDuration={1100} style={{ filter: `drop-shadow(0 6px 16px ${accent(0.4)})` }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </FloatSection>

      {/* Recent users + recent orgs */}
      <div className="grid grid-cols-1 gap-x-14 gap-y-14 lg:grid-cols-[1.55fr_1fr]">
        <FloatSection title="Recent users" meta={loading ? "loading…" : `${users.length} shown`}>
          <FloatTable
            columns={[
              { key: "user", label: "User" },
              { key: "email", label: "Email" },
              { key: "tier", label: "Tier" },
              { key: "credits", label: "Credits", align: "right" },
              { key: "joined", label: "Joined", align: "right" },
            ]}
            rows={users.map((u) => {
              const name = str(u, "display_name", "full_name", "username") || (str(u, "email").split("@")[0]) || "User";
              const tier = str(u, "account_tier", "subscription_tier", "tier") || "free";
              const suspended = !!(u["suspended_at"] || u["banned_at"]) || str(u, "status") === "suspended";
              return {
                _key: str(u, "id"),
                user: <span className="inline-flex items-center gap-2.5"><Avatar name={name} /><span className="font-medium text-white">{name}</span>{suspended && <StatusPill tone="danger">suspended</StatusPill>}</span>,
                email: <span className="font-mono text-[11.5px] text-white/55">{str(u, "email") || "—"}</span>,
                tier: <StatusPill tone={/pro|studio|business|enterprise/i.test(tier) ? "accent" : "neutral"}>{tier}</StatusPill>,
                credits: <span className="text-white">{num(u, "credits", "credit_balance", "credits_balance").toLocaleString()}</span>,
                joined: <span className="text-white/50">{ago(str(u, "created_at"))}</span>,
              };
            })}
          />
        </FloatSection>

        <FloatSection title="Recent orgs" meta={`${orgs} total`} actions={<DeckButton accent><Link to="/admin/orgs">All orgs →</Link></DeckButton>}>
          <div>
            {recentOrgs.length === 0 && <div className="py-10 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-white/30">No organizations yet.</div>}
            {recentOrgs.map((o, i) => {
              const name = str(o, "name", "display_name", "slug") || "Organization";
              return (
                <FloatRow key={str(o, "id") || i} last={i === recentOrgs.length - 1}
                  left={<span className="inline-flex items-center gap-2.5"><Avatar name={name} /><span className="truncate font-medium text-white">{name}</span></span>}
                  right={<span className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/40">{ago(str(o, "created_at"))}</span>}
                />
              );
            })}
          </div>
        </FloatSection>
      </div>
    </div>
  );
}
