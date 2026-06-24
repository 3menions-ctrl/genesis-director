/**
 * AdminOrgsPage — organization administration (list).
 *
 * Completes the org-admin flow: this list pairs with the now-wired
 * /admin/orgs/:orgId detail page (transfer owner, delete, activate enterprise).
 * Reads the organizations table directly (RLS-bypassed for admins); each row
 * deep-links into the org 360. Built on the premium admin primitives.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Users, Coins, Search } from "lucide-react";
import { createColumnHelper } from "@tanstack/react-table";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader, KpiTile, StatusPill } from "@/admin/ui/primitives";
import { DataTable } from "@/admin/ui/DataTable";

interface Org {
  id: string;
  name: string | null;
  slug: string | null;
  plan: string | null;
  industry: string | null;
  credits_balance: number | null;
  created_at?: string | null;
}

const col = createColumnHelper<Org>();

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

  const columns = useMemo(() => [
    col.accessor("name", { header: "Organization", cell: (c) => (
      <div>
        <div className="font-medium text-[#0c1426]">{c.getValue() || "Untitled org"}</div>
        <div className="font-mono text-[11px] text-[#9aa4b8]">{c.row.original.slug || c.row.original.id.slice(0, 8)}</div>
      </div>
    ) }),
    col.accessor("plan", { header: "Plan", cell: (c) => {
      const p = (c.getValue() || "free").toString();
      const tone = p.includes("enter") ? "accent" : p === "free" ? "neutral" : "positive";
      return <StatusPill tone={tone as never}>{p}</StatusPill>;
    } }),
    col.accessor("industry", { header: "Industry", cell: (c) => <span className="text-[#5d6a82]">{c.getValue() || "—"}</span> }),
    col.accessor("credits_balance", { header: "Credits", cell: (c) => <span className="tabular-nums">{(c.getValue() ?? 0).toLocaleString()}</span> }),
  ], []);

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-8">
      <AdminPageHeader eyebrow="02 · People" title={<>Organizations.</>} sub="Every workspace on the platform — open one to manage members, plan, ownership and provisioning." />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
        <KpiTile index={0} label="Organizations" value={rows.length} icon={Building2} />
        <KpiTile index={1} label="Enterprise" value={enterprise} icon={Users} accentNumber />
        <KpiTile index={2} label="Credits across orgs" value={totalCredits} icon={Coins} />
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9aa4b8]" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search organizations…"
          className="h-11 w-full rounded-full bg-[#f6f8fc] pl-10 pr-4 text-[14px] text-[#0c1426] outline-none placeholder:text-[#9aa4b8] focus:bg-[#f4f7ff]" />
      </div>

      {loading ? (
        <div className="py-20 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-[#9aa4b8]">Loading organizations…</div>
      ) : (
        <DataTable columns={columns as never} data={filtered} onRowClick={(o) => navigate(`/admin/orgs/${o.id}`)} empty="No organizations match." />
      )}
    </div>
  );
}
