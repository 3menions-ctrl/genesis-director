/** Crash Forensics — live tail of in-memory DiagnosticsLogger + safe-mode + health score. */
import { useEffect, useState } from "react";
import { Bug, RefreshCw, Shield, Trash2 } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { FloatSection, FloatTable } from "@/admin/ui/primitives";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getDiagnosticEntries, subscribeToDiagnostics, clearDiagnostics, type DiagnosticEntry } from "@/lib/diagnostics/DiagnosticsLogger";
import { getRecentEvents, getHealthScore } from "@/lib/stabilityMonitor";
import { getSafeModeBannerData } from "@/lib/safeMode";

export default function AdminCrashForensicsPage() {
  const [entries, setEntries] = useState<DiagnosticEntry[]>([]);
  const [stability, setStability] = useState(() => getRecentEvents(50));
  const [health, setHealth] = useState(() => getHealthScore());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setEntries(getDiagnosticEntries());
    const unsub = subscribeToDiagnostics(setEntries);
    const i = setInterval(() => {
      setStability(getRecentEvents(50));
      setHealth(getHealthScore());
      setTick(t => t + 1);
    }, 5000);
    return () => { unsub(); clearInterval(i); };
  }, []);

  const safe = getSafeModeBannerData();
  const last24h = entries.filter(e => Date.now() - e.timestamp < 24*60*60*1000);
  const errors24h = last24h.filter(e => e.severity === "error").length;
  const warns24h = last24h.filter(e => e.severity === "warning").length;

  return (
    <AdminPageShell
      eyebrow="05 // SYSTEM"
      code="CRF"
      title="Crash"
      italic="Forensics."
      description="In-memory diagnostics tail, stability events, safe-mode status. Live for this admin session."
      stats={[
        { label: "Health Score", value: `${health}`, tone: health > 80 ? "emerald" : health > 50 ? "amber" : "rose" },
        { label: "Errors 24h", value: errors24h, tone: errors24h > 0 ? "rose" : "neutral" },
        { label: "Warnings 24h", value: warns24h, tone: warns24h > 0 ? "amber" : "neutral" },
        { label: "Safe Mode", value: safe ? "ON" : "OFF", tone: safe ? "rose" : "emerald" },
      ]}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => { setEntries(getDiagnosticEntries()); setTick(t=>t+1); }}>
            <RefreshCw className="w-3.5 h-3.5 mr-2" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => { clearDiagnostics(); setEntries([]); }} disabled={entries.length === 0}>
            <Trash2 className="w-3.5 h-3.5 mr-2" /> Clear
          </Button>
        </>
      }
    >
      <div className="space-y-14" data-tick={tick}>
        {safe && (
          <div className="flex items-start gap-3 border-l-2 border-rose-500/40 pl-4 py-1">
            <Shield className="w-5 h-5 text-rose-300 mt-0.5" />
            <div>
              <div className="text-rose-200 font-medium text-sm">Safe Mode active</div>
              <div className="text-rose-300/70 text-[12px] mt-1 font-mono">{safe.reason ?? "no reason recorded"}</div>
            </div>
          </div>
        )}

        <FloatSection title="Diagnostics Tail" meta={`${entries.length} entries · capped at 100`}>
          <div className="max-h-[480px] overflow-auto">
            <FloatTable
              columns={[
                { key: "when", label: "When" },
                { key: "sev", label: "Sev" },
                { key: "source", label: "Source" },
                { key: "message", label: "Message" },
              ]}
              rows={entries.slice().reverse().map(e => ({
                _key: e.id,
                when: <span className="text-white/50 font-mono text-[10px] whitespace-nowrap">{new Date(e.timestamp).toLocaleTimeString()}</span>,
                sev: <Badge variant={e.severity === "error" ? "destructive" : e.severity === "warning" ? "secondary" : "default"} className="font-mono text-[10px]">{e.severity}</Badge>,
                source: <span className="text-white/60 font-mono text-[10px]">{e.source}</span>,
                message: <span className="block max-w-[640px] truncate text-white/80 font-mono text-[11px]">{e.message}</span>,
              }))}
              empty={
                <span className="inline-flex flex-col items-center gap-2 normal-case tracking-normal text-[13px] text-white/40">
                  <Bug className="w-5 h-5 opacity-50" />
                  No diagnostic events captured this session.
                </span>
              }
            />
          </div>
        </FloatSection>

        <FloatSection title="Stability Events" meta={`${stability.length} recent`}>
          <div className="max-h-[320px] overflow-auto">
            <FloatTable
              columns={[
                { key: "when", label: "When" },
                { key: "category", label: "Category" },
                { key: "where", label: "Where" },
                { key: "message", label: "Message" },
              ]}
              rows={stability.slice().reverse().map((s, i) => ({
                _key: i,
                when: <span className="text-white/50 font-mono text-[10px] whitespace-nowrap">{new Date(s.timestamp).toLocaleTimeString()}</span>,
                category: <span className="text-white/70 font-mono text-[11px]">{s.category}</span>,
                where: <span className="text-white/60 font-mono text-[11px]">{s.componentName || s.route || "—"}</span>,
                message: <span className="block max-w-[520px] truncate text-white/80 font-mono text-[11px]">{s.message}</span>,
              }))}
              empty="No stability events recorded."
            />
          </div>
        </FloatSection>
      </div>
    </AdminPageShell>
  );
}
