/** Sessions — recent sign-ins from auth.users via admin_list_sessions RPC. */
import { useEffect, useMemo, useState } from "react";
import { LogOut, Power, RefreshCw, Search } from "lucide-react";
import { AdminPageShell, AdminSurface } from "../../components/AdminPageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ListPagination, usePagination } from "@/components/ui/list-pagination";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Row = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  account_tier: string | null;
  last_sign_in_at: string | null;
  created_at: string | null;
  confirmed_at: string | null;
  is_active_24h: boolean;
  is_idle_24h: boolean;
};

export default function AdminSessionsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_sessions", { p_limit: 500 });
    if (error) toast.error(error.message);
    else setRows((data as Row[]) || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return rows;
    return rows.filter(r =>
      r.email?.toLowerCase().includes(n) ||
      r.display_name?.toLowerCase().includes(n) ||
      r.account_tier?.toLowerCase().includes(n)
    );
  }, [rows, q]);

  const active = useMemo(() => rows.filter(r => r.is_active_24h).length, [rows]);
  const idle = useMemo(() => rows.filter(r => r.is_idle_24h).length, [rows]);
  const pg = usePagination(filtered, 25);

  async function killAll() {
    if (!confirm("Force-revoke every active session across the platform? Users will be signed out.")) return;
    setBulkBusy(true);
    const { error } = await supabase.rpc("admin_force_logout_all");
    setBulkBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Sessions revoked"); load(); }
  }

  async function killOne(userId: string) {
    if (!confirm("Force-revoke this user's sessions?")) return;
    const { error } = await supabase.rpc("admin_force_logout_user", { p_target_user_id: userId });
    if (error) toast.error(error.message);
    else { toast.success("User signed out"); load(); }
  }

  return (
    <AdminPageShell
      eyebrow="07 // ACCESS"
      code="SES"
      title="Sessions"
      italic="Fleet."
      description="Recent authenticated sign-ins across the platform — drill in, force-revoke, or kill the fleet."
      stats={[
        { label: "Active 24h", value: active, tone: "blue" },
        { label: "Idle > 24h", value: idle, tone: "amber" },
        { label: "Total Tracked", value: rows.length, tone: "neutral" },
        { label: "Showing", value: filtered.length, tone: "emerald" },
      ]}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button variant="destructive" size="sm" onClick={killAll} disabled={bulkBusy}>
            <Power className="w-3.5 h-3.5 mr-2" /> Kill Fleet
          </Button>
        </>
      }
    >
      <AdminSurface className="p-0 overflow-hidden">
        <div className="p-4 border-b border-[#e7ebf3] flex items-center gap-3">
          <Search className="w-4 h-4 text-[#9aa4b8]" />
          <Input
            placeholder="Filter by email, name, tier…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="bg-transparent border-[#e7ebf3] text-[#0c1426] placeholder:text-[#9aa4b8]"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e7ebf3] text-[10px] uppercase tracking-[0.18em] text-[#9aa4b8] font-mono">
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Tier</th>
                <th className="text-left px-4 py-3">Last Sign-In</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Created</th>
                <th className="text-right px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="px-4 py-8 text-center text-[#9aa4b8]">Loading…</td></tr>}
              {!loading && pg.slice.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-[#9aa4b8]">No sessions.</td></tr>}
              {pg.slice.map((r) => (
                <tr key={r.user_id} className="border-b border-[#e7ebf3] hover:bg-glass">
                  <td className="px-4 py-3">
                    <div className="text-[#0c1426] text-[13px]">{r.display_name ?? "—"}</div>
                    <div className="text-[#9aa4b8] font-mono text-[10px]">{r.email}</div>
                  </td>
                  <td className="px-4 py-3 text-[#5d6a82] font-mono text-[11px]">{r.account_tier ?? "—"}</td>
                  <td className="px-4 py-3 text-[#0c1426] font-mono text-[11px] whitespace-nowrap">
                    {r.last_sign_in_at ? new Date(r.last_sign_in_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={r.is_active_24h ? "default" : "secondary"} className="font-mono text-[10px]">
                      {r.is_active_24h ? "active" : r.is_idle_24h ? "idle" : "—"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-[#9aa4b8] font-mono text-[10px] whitespace-nowrap">
                    {r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => killOne(r.user_id)} className="h-7 text-[11px]">
                      <LogOut className="w-3 h-3 mr-1" /> Revoke
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ListPagination page={pg.page} totalPages={pg.totalPages} total={pg.total} pageSize={pg.pageSize} onPageChange={pg.setPage} className="p-4 border-t border-[#e7ebf3]" />
      </AdminSurface>
    </AdminPageShell>
  );
}
