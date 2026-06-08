/** Crash Forensics — live tail of in-memory DiagnosticsLogger + safe-mode + health score. */
import { useEffect, useState } from "react";
import { Bug, RefreshCw, Shield, Trash2 } from "lucide-react";
import { AdminPageShell, AdminSurface, AdminSectionLabel } from "../../components/AdminPageShell";
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
      <div className="space-y-8" data-tick={tick}>
        {safe && (
          <AdminSurface className="border-rose-500/30 bg-rose-500/[0.04]">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-rose-300 mt-0.5" />
              <div>
                <div className="text-rose-200 font-medium text-sm">Safe Mode active</div>
                <div className="text-rose-300/70 text-[12px] mt-1 font-mono">{safe.reason ?? "no reason recorded"}</div>
              </div>
            </div>
          </AdminSurface>
        )}

        <AdminSurface className="p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06]">
            <AdminSectionLabel label="Diagnostics Tail" meta={`${entries.length} entries · capped at 100`} />
          </div>
          <div className="max-h-[480px] overflow-auto">
            {entries.length === 0 ? (
              <div className="px-6 py-10 text-center text-white/40 text-[13px]">
                <Bug className="w-5 h-5 mx-auto mb-2 opacity-50" />
                No diagnostic events captured this session.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.18em] text-white/40 font-mono">
                    <th className="text-left px-6 py-2">When</th>
                    <th className="text-left px-6 py-2">Sev</th>
                    <th className="text-left px-6 py-2">Source</th>
                    <th className="text-left px-6 py-2">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.slice().reverse().map(e => (
                    <tr key={e.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="px-6 py-2 text-white/50 font-mono text-[10px] whitespace-nowrap">{new Date(e.timestamp).toLocaleTimeString()}</td>
                      <td className="px-6 py-2">
                        <Badge variant={e.severity === "error" ? "destructive" : e.severity === "warning" ? "secondary" : "default"} className="font-mono text-[10px]">{e.severity}</Badge>
                      </td>
                      <td className="px-6 py-2 text-white/60 font-mono text-[10px]">{e.source}</td>
                      <td className="px-6 py-2 text-white/80 font-mono text-[11px] max-w-[640px] truncate">{e.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </AdminSurface>

        <AdminSurface className="p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06]">
            <AdminSectionLabel label="Stability Events" meta={`${stability.length} recent`} />
          </div>
          <div className="max-h-[320px] overflow-auto">
            {stability.length === 0 ? (
              <div className="px-6 py-8 text-center text-white/40 text-[13px]">No stability events recorded.</div>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {stability.slice().reverse().map((s, i) => (
                    <tr key={i} className="border-b border-white/[0.04]">
                      <td className="px-6 py-2 text-white/50 font-mono text-[10px] whitespace-nowrap">{new Date(s.timestamp).toLocaleTimeString()}</td>
                      <td className="px-6 py-2 text-white/70 font-mono text-[11px]">{s.category}</td>
                      <td className="px-6 py-2 text-white/60 font-mono text-[11px]">{s.context || "—"}</td>
                      <td className="px-6 py-2 text-white/80 font-mono text-[11px] truncate max-w-[520px]">{s.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </AdminSurface>
      </div>
    </AdminPageShell>
  );
}
