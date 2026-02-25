/**
 * RightSidebarPanel — Tabbed container for Templates and Clip Properties.
 * Wider layout with clear visual hierarchy between top tabs and sub-tabs.
 */

import { memo, useState } from "react";
import { Layers, Scissors } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClipPropertiesPanel } from "@/components/editor/ClipPropertiesPanel";
import { TemplatesPanel } from "@/components/editor/TemplatesPanel";
import { useCustomTimeline } from "@/hooks/useCustomTimeline";

type Tab = "templates" | "properties";

export const RightSidebarPanel = memo(function RightSidebarPanel() {
  const { state } = useCustomTimeline();
  const hasSelection = !!state.selectedClipId;
  const [activeTab, setActiveTab] = useState<Tab>("templates");

  return (
    <div
      className="w-64 shrink-0 flex flex-col border-l overflow-hidden"
      style={{
        background: "hsl(240, 25%, 5%)",
        borderColor: "hsla(0, 0%, 100%, 0.06)",
      }}
    >
      {/* Top-level tab bar — visually distinct from sub-tabs */}
      <div
        className="shrink-0 flex items-center h-10 border-b"
        style={{
          borderColor: "hsla(0, 0%, 100%, 0.08)",
          background: "hsla(0, 0%, 100%, 0.02)",
        }}
      >
        <TopTabButton
          active={activeTab === "templates"}
          onClick={() => setActiveTab("templates")}
          icon={<Layers className="w-3.5 h-3.5" />}
          label="Templates"
        />
        <div className="w-px h-5 bg-foreground/[0.06]" />
        <TopTabButton
          active={activeTab === "properties"}
          onClick={() => setActiveTab("properties")}
          icon={<Scissors className="w-3.5 h-3.5" />}
          label="Properties"
          badge={hasSelection}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "templates" ? (
          <TemplatesPanel />
        ) : (
          <ClipPropertiesPanel embedded />
        )}
      </div>
    </div>
  );
});

function TopTabButton({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-1.5 h-full text-[11px] font-semibold transition-all relative",
        active
          ? "text-foreground/90"
          : "text-muted-foreground/35 hover:text-muted-foreground/60"
      )}
    >
      {icon}
      {label}
      {badge && (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/70 animate-pulse" />
      )}
      {active && (
        <span
          className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full"
          style={{ background: "hsla(0, 0%, 100%, 0.5)" }}
        />
      )}
    </button>
  );
}
