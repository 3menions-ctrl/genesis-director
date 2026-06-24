/** Observability — render_failures histogram, success snapshot, and
 *  the most recent 50 failures with quick triage cards. The page reads
 *  the two RPCs added in the render_failures migration so it stays
 *  fast even when the table grows. */
import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Clock } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { FloatSection, FloatRow, DeckButton } from "@/admin/ui/primitives";
import { supabase } from "@/integrations/supabase/client";

type FailureRow = {
  id: string;
  project_id: string | null;
  classification: string;
  message: string;
  stitcher_version: string | null;
  input_shape: Record<string, unknown>;
  is_retry: boolean;
  created_at: string;
};

type Histogram = Array<{ classification: string; n: number }>;
type Snapshot = {
  failures: number;
  projects_updated: number;
  success_rate_pct: number | null;
} | null;

const WINDOW_HOURS = 24;
const RECENT_LIMIT = 50;

export default function AdminObservabilityPage() {
  const [recent, setRecent] = useState<FailureRow[]>([]);
  const [histogram, setHistogram] = useState<Histogram>([]);
  const [snapshot, setSnapshot] = useState<Snapshot>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let on = true;
    (async () => {
      setLoading(true);
      const [recentRes, histRes, snapRes] = await Promise.all([
        supabase
          .from("render_failures")
          .select("id,project_id,classification,message,stitcher_version,input_shape,is_retry,created_at")
          .order("created_at", { ascending: false })
          .limit(RECENT_LIMIT),
        supabase.rpc("render_failures_histogram", { window_hours: WINDOW_HOURS }),
        supabase.rpc("render_success_snapshot", { window_hours: WINDOW_HOURS }),
      ]);
      if (!on) return;
      setRecent((recentRes.data ?? []) as FailureRow[]);
      setHistogram((histRes.data ?? []) as Histogram);
      const s = Array.isArray(snapRes.data) ? snapRes.data[0] : snapRes.data;
      setSnapshot((s as Snapshot) ?? null);
      setLoading(false);
    })();
    return () => { on = false; };
  }, [reload]);

  const maxBucket = useMemo(
    () => histogram.reduce((m, h) => Math.max(m, h.n), 0),
    [histogram],
  );
  const successRate = snapshot?.success_rate_pct ?? null;
  const tone = successRate == null
    ? "neutral"
    : successRate >= 95 ? "emerald"
    : successRate >= 80 ? "amber"
    : "rose";

  return (
    <AdminPageShell
      eyebrow="06 // OPS"
      code="OBS"
      title="Observability"
      italic={successRate == null ? "Quiet." : successRate >= 95 ? "Stable." : successRate >= 80 ? "Watch list." : "Degraded."}
      description={`Render failure telemetry over the last ${WINDOW_HOURS} hours. Histogram counts buckets from public.render_failures; success rate is the share of renders that finished without landing a row here.`}
      stats={[
        { label: "Success", value: successRate == null ? "—" : `${successRate}%`, tone },
        { label: "Failures", value: snapshot?.failures ?? 0, tone: (snapshot?.failures ?? 0) > 0 ? "rose" : "emerald" },
        { label: "Completed", value: snapshot?.projects_updated ?? 0, tone: "blue" },
        { label: "Recent shown", value: recent.length, tone: "neutral" },
      ]}
      actions={
        <DeckButton onClick={() => setReload((k) => k + 1)} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </DeckButton>
      }
    >
      <div className="space-y-14">
        {/* Histogram — bar per classification bucket, normalized to the
            widest one so the relative ordering reads at a glance. */}
        <FloatSection title="Failures by classification" meta={`last ${WINDOW_HOURS}h`}>
          {histogram.length === 0 ? (
            <div className="text-white/40 text-sm">No failures recorded in this window.</div>
          ) : (
            <div className="space-y-2">
              {histogram.map((h) => (
                <div key={h.classification} className="flex items-center gap-3">
                  <div className="w-44 text-white/70 text-[12px] font-mono uppercase tracking-[0.18em]">
                    {h.classification}
                  </div>
                  <div className="flex-1 h-6 bg-white/[0.04] border border-white/10 rounded relative overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-rose-500/30 border-r border-rose-400/60"
                      style={{ width: maxBucket > 0 ? `${(h.n / maxBucket) * 100}%` : "0%" }}
                    />
                  </div>
                  <div className="w-12 text-right text-white/80 font-mono text-[12px]">{h.n}</div>
                </div>
              ))}
            </div>
          )}
        </FloatSection>

        {/* Recent failures — a triage list. Each row carries enough
            context (classification + message head + project + version)
            to decide whether to drill further. */}
        <FloatSection title={`Most recent ${RECENT_LIMIT}`}>
          {loading && recent.length === 0 ? (
            <div className="text-white/40 text-sm">Loading…</div>
          ) : recent.length === 0 ? (
            <div className="text-white/40 text-sm">Clean. Nothing failed recently.</div>
          ) : (
            <div>
              {recent.map((r, i) => (
                <FloatRow
                  key={r.id}
                  last={i === recent.length - 1}
                  left={
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded font-mono text-[10px] uppercase tracking-[0.2em] border border-rose-400/30 bg-rose-400/5 text-rose-300">
                          {r.classification}
                        </span>
                        {r.is_retry && (
                          <span className="px-2 py-0.5 rounded font-mono text-[10px] uppercase tracking-[0.2em] border border-amber-400/30 bg-amber-400/5 text-amber-300">
                            retry
                          </span>
                        )}
                        <span className="text-white/40 font-mono text-[10px] uppercase tracking-[0.18em]">
                          {r.stitcher_version ?? "unknown"}
                        </span>
                      </div>
                      <div className="text-white/85 text-[13px] truncate" title={r.message}>
                        {r.message}
                      </div>
                      <div className="mt-1 text-white/40 font-mono text-[10px] uppercase tracking-[0.18em]">
                        {r.project_id ? `project ${r.project_id.slice(0, 8)}…` : "no project"}
                        {" · "}
                        {formatShape(r.input_shape)}
                      </div>
                    </div>
                  }
                  right={
                    <div className="flex items-center gap-1 text-white/40 font-mono text-[10px] uppercase tracking-[0.18em]">
                      <Clock className="w-3 h-3" />
                      {formatAgo(r.created_at)}
                    </div>
                  }
                />
              ))}
            </div>
          )}
        </FloatSection>
      </div>
    </AdminPageShell>
  );
}

function formatShape(shape: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof shape.clipCount === "number") parts.push(`${shape.clipCount} clips`);
  if (shape.aspectRatio) parts.push(String(shape.aspectRatio));
  if (shape.resolution) parts.push(String(shape.resolution));
  if (shape.format) parts.push(String(shape.format));
  if (shape.autoDuck) parts.push("autoduck");
  if (shape.hasMasterLoudness) parts.push("loudnorm");
  return parts.join(" · ") || "no shape";
}

function formatAgo(ts: string): string {
  const ms = Date.now() - new Date(ts).getTime();
  if (!isFinite(ms) || ms < 0) return "—";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
