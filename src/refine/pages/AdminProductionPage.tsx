/**
 * Production — Unified Pipeline + Failed Clips workspace.
 */
import { useState, memo } from "react";
import { cn } from "@/lib/utils";
import { Activity, AlertTriangle } from "lucide-react";
import AdminPipelinePage from "./AdminPipelinePage";
import AdminFailedPage from "./AdminFailedPage";

const TABS = [
  { key: "pipeline", label: "Live Pipeline", code: "LIVE", icon: Activity, Component: AdminPipelinePage },
  { key: "failed", label: "Failed Clips", code: "ERR", icon: AlertTriangle, Component: AdminFailedPage },
] as const;

export default memo(function AdminProductionPage() {
  const [active, setActive] = useState<typeof TABS[number]["key"]>("pipeline");
  const Active = TABS.find(t => t.key === active)!.Component;

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.4em] text-[hsl(215,100%,68%)] font-mono">
          <span className="w-1 h-1 rounded-full bg-[hsl(215,100%,68%)] shadow-[0_0_8px_hsla(215,100%,60%,0.9)]" />
          PRD · PIPELINE MEMBRANE
        </div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-white">Production</h1>
        <p className="text-[12px] text-white/40 max-w-xl">Live render telemetry and the failure recovery queue, in one continuous stream.</p>
      </header>

      <div className="flex items-center gap-1 p-1 rounded-2xl border border-white/[0.06] bg-[hsla(220,14%,4%,0.55)] backdrop-blur-xl w-fit">
        {TABS.map(({ key, label, code, icon: Icon }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              onClick={() => setActive(key)}
              className={cn(
                "relative flex items-center gap-2.5 px-4 py-2 rounded-xl text-[11px] uppercase tracking-[0.18em] font-medium transition-all",
                isActive
                  ? "text-white bg-[hsla(215,100%,60%,0.14)] border border-[hsla(215,100%,60%,0.4)] shadow-[0_8px_24px_-12px_hsla(215,100%,60%,0.6)]"
                  : "text-white/45 hover:text-white border border-transparent hover:bg-white/[0.04]"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
              <span className="text-[9px] font-mono tracking-[0.3em] text-white/30">{code}</span>
            </button>
          );
        })}
      </div>

      <div className="relative">
        <div className="absolute inset-x-0 -top-3 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, hsla(215,100%,60%,0.3), transparent)' }} />
        <Active />
      </div>
    </div>
  );
});