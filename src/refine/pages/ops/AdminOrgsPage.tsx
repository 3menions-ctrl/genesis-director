/**
 * AdminOrgsPage — organization administration (list).
 *
 * Completes the org-admin flow: this list pairs with the now-wired
 * /admin/orgs/:orgId detail page (transfer owner, delete, activate enterprise).
 * Reads the organizations table directly (RLS-bypassed for admins); each row
 * deep-links into the org 360. Built on the borderless Horizon admin kit.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageShell } from "../../components/AdminPageShell";
import { FloatSection, FloatTable, StatusPill } from "@/admin/ui/primitives";

interface Org {
  id: string;
  name: string | null;
  slug: string | null;
  plan: string | null;
  industry: string | null;
  credits_balance: number | null;
  created_at?: string | null;
}

export default function AdminOrgsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    let on = true;
    (async () => {
      const { data } = await supabase
        .from("organizations")
        .select("id,name,slug,plan,industry,credits_balance,created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (on) { setRows((data as Org[]) ?? []); setLoading(false); }
    })();
    return () => { on = false; };
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((o) => [o.name, o.slug, o.industry].some((v) => (v ?? "").toLowerCase().includes(s)));
  }, [rows, q]);

  const totalCredits = useMemo(() => rows.reduce((a, o) => a + (o.credits_balance ?? 0), 0), [rows]);
  const enterprise = useMemo(() => rows.filter((o) => (o.plan ?? "").toLowerCase().includes("enter")).length, [rows]);

  const tableRows = useMemo(() => filtered.map((o) => {
    const p = (o.plan || "free").toString();
    const tone = p.includes("enter") ? "accent" : p === "free" ? "neutral" : "positive";
    return {
      _key: o.id,
      name: (
        <button
          type="button"
          onClick={() => navigate(`/admin/orgs/${o.id}`)}
          className="block text-left transition-opacity hover:opacity-80"
        >
          <div className="font-medium text-white">{o.name || "Untitled org"}</div>
          <div className="font-mono text-[11px] text-white/35">{o.slug || o.id.slice(0, 8)}</div>
        </button>
      ),
      plan: <StatusPill tone={tone as never}>{p}</StatusPill>,
      industry: <span className="text-white/55">{o.industry || "—"}</span>,
      credits_balance: <span className="tabular-nums">{(o.credits_balance ?? 0).toLocaleString()}</span>,
    };
  }), [filtered, navigate]);

  return (
    <AdminPageShell
      eyebrow="02 // PEOPLE"
      code="ORG"
      title="Organizations."
      description="Every workspace on the platform — open one to manage members, plan, ownership and provisioning."
      stats={[
        { label: "Organizations", value: rows.length, tone: "blue" },
        { label: "Enterprise", value: enterprise, tone: "emerald" },
        { label: "Credits across orgs", value: totalCredits, tone: "amber" },
      ]}
    >
      <FloatSection title="All organizations" meta={`${filtered.length} of ${rows.length}`}>
        <div className="relative mb-6 max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search organizations…"
            className="h-11 w-full rounded-full bg-white/[0.05] pl-10 pr-4 text-[14px] text-white outline-none placeholder:text-white/30 focus:bg-white/[0.08]" />
        </div>

        {loading ? (
          <div className="py-20 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-white/40">Loading organizations…</div>
        ) : (
          <FloatTable
            columns={[
              { key: "name", label: "Organization" },
              { key: "plan", label: "Plan" },
              { key: "industry", label: "Industry" },
              { key: "credits_balance", label: "Credits", align: "right" },
            ]}
            rows={tableRows}
            empty="No organizations match."
            onRowClick={(r) => navigate(`/admin/orgs/${r._key}`)}
          />
        )}
      </FloatSection>
    </AdminPageShell>
  );
}
