/** Storage — per-bucket object count + total bytes via admin_storage_overview RPC. */
import { useEffect, useMemo, useState } from "react";
import { Folder, Lock, RefreshCw, Unlock } from "lucide-react";
import { AdminPageShell, AdminSurface } from "../../components/AdminPageShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Row = {
  bucket_id: string;
  is_public: boolean;
  file_size_limit: number | null;
  object_count: number;
  total_bytes: number;
  latest_upload: string | null;
};

function bytes(n: number): string {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0; let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 2 : 1)} ${u[i]}`;
}

export default function AdminStoragePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_storage_overview");
    if (error) toast.error(error.message);
    else setRows((data as Row[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const totalBytes = useMemo(() => rows.reduce((s, r) => s + Number(r.total_bytes || 0), 0), [rows]);
  const totalObjects = useMemo(() => rows.reduce((s, r) => s + Number(r.object_count || 0), 0), [rows]);
  const publicCount = useMemo(() => rows.filter(r => r.is_public).length, [rows]);
  // Approx Supabase storage cost: ~$0.021 / GB / month
  const estCost = totalBytes / 1024 / 1024 / 1024 * 0.021;

  return (
    <AdminPageShell
      eyebrow="04 // CONTENT"
      code="STG"
      title="Asset"
      italic="Storage."
      description="Per-bucket object inventory, size telemetry, and access posture."
      stats={[
        { label: "Total", value: bytes(totalBytes), tone: "blue" },
        { label: "Objects", value: totalObjects.toLocaleString(), tone: "neutral" },
        { label: "Public Buckets", value: `${publicCount} / ${rows.length}`, tone: publicCount > 0 ? "amber" : "emerald" },
        { label: "Est. Cost / mo", value: `$${estCost.toFixed(2)}`, tone: "emerald" },
      ]}
      actions={
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      }
    >
      <AdminSurface className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.18em] text-white/40 font-mono">
                <th className="text-left px-4 py-3">Bucket</th>
                <th className="text-left px-4 py-3">Access</th>
                <th className="text-right px-4 py-3">Objects</th>
                <th className="text-right px-4 py-3">Size</th>
                <th className="text-right px-4 py-3">File Limit</th>
                <th className="text-left px-4 py-3 pl-8">Last Upload</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="px-4 py-8 text-center text-white/40">Loading…</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-white/40">No buckets.</td></tr>}
              {rows.map((r) => (
                <tr key={r.bucket_id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-white/90 font-mono text-[12px]"><Folder className="w-3 h-3 inline mr-2 text-white/30" />{r.bucket_id}</td>
                  <td className="px-4 py-3">
                    <Badge variant={r.is_public ? "secondary" : "default"} className="font-mono text-[10px]">
                      {r.is_public ? <><Unlock className="w-3 h-3 mr-1" />public</> : <><Lock className="w-3 h-3 mr-1" />private</>}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right text-white/80 font-mono tabular-nums text-[12px]">{Number(r.object_count).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-[#6FB6FF] font-mono tabular-nums text-[12px]">{bytes(Number(r.total_bytes))}</td>
                  <td className="px-4 py-3 text-right text-white/40 font-mono text-[11px]">{r.file_size_limit ? bytes(Number(r.file_size_limit)) : "—"}</td>
                  <td className="px-4 py-3 pl-8 text-white/40 font-mono text-[11px] whitespace-nowrap">{r.latest_upload ? new Date(r.latest_upload).toLocaleString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminSurface>
    </AdminPageShell>
  );
}
