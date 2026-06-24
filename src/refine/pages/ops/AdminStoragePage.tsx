/** Storage — per-bucket object count + total bytes via admin_storage_overview RPC. */
import { useEffect, useMemo, useState } from "react";
import { Folder, Lock, RefreshCw, Unlock } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { FloatSection, FloatTable, DeckButton, StatusPill } from "@/admin/ui/primitives";
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
        <DeckButton onClick={load} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
        </DeckButton>
      }
    >
      <FloatSection title="Buckets" meta="object inventory">
        {loading ? (
          <div className="py-12 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-white/30">Loading buckets…</div>
        ) : (
          <FloatTable
            columns={[
              { key: "bucket", label: "Bucket" },
              { key: "access", label: "Access" },
              { key: "objects", label: "Objects", align: "right" },
              { key: "size", label: "Size", align: "right" },
              { key: "limit", label: "File Limit", align: "right" },
              { key: "upload", label: "Last Upload" },
            ]}
            rows={rows.map((r) => ({
              _key: r.bucket_id,
              bucket: <span className="font-mono text-[12px] text-white/90"><Folder className="w-3 h-3 inline mr-2 text-white/30" />{r.bucket_id}</span>,
              access: (
                <StatusPill tone={r.is_public ? "neutral" : "accent"}>
                  {r.is_public ? <><Unlock className="w-3 h-3 mr-1" />public</> : <><Lock className="w-3 h-3 mr-1" />private</>}
                </StatusPill>
              ),
              objects: <span className="font-mono tabular-nums text-[12px] text-white/80">{Number(r.object_count).toLocaleString()}</span>,
              size: <span className="font-mono tabular-nums text-[12px] text-primary/80">{bytes(Number(r.total_bytes))}</span>,
              limit: <span className="font-mono text-[11px] text-white/40">{r.file_size_limit ? bytes(Number(r.file_size_limit)) : "—"}</span>,
              upload: <span className="font-mono text-[11px] text-white/40 whitespace-nowrap">{r.latest_upload ? new Date(r.latest_upload).toLocaleString() : "—"}</span>,
            }))}
            empty="No buckets."
          />
        )}
      </FloatSection>
    </AdminPageShell>
  );
}
