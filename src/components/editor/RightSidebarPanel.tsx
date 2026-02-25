/**
 * RightSidebarPanel — Tabbed container for Templates and Clip Properties.
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

  // Auto-switch to properties when a clip is selected
  const effectiveTab = hasSelection && activeTab === "templates" ? activeTab : activeTab;

  return (
    <div
      className="w-56 shrink-0 flex flex-col border-l overflow-hidden"
      style={{
        background: "hsl(240, 25%, 5%)",
        borderColor: "hsla(0, 0%, 100%, 0.06)",
      }}
    >
      {/* Tab bar */}
      <div
        className="shrink-0 flex items-center border-b"
        style={{ borderColor: "hsla(0, 0%, 100%, 0.06)" }}
      >
        <TabButton
          active={effectiveTab === "templates"}
          onClick={() => setActiveTab("templates")}
          icon={<Layers className="w-3 h-3" />}
          label="Templates"
        />
        <TabButton
          active={effectiveTab === "properties"}
          onClick={() => setActiveTab("properties")}
          icon={<Scissors className="w-3 h-3" />}
          label="Properties"
          badge={hasSelection}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {effectiveTab === "templates" ? (
          <TemplatesPanel />
        ) : (
          <ClipPropertiesPanel embedded />
        )}
      </div>
    </div>
  );
});

function TabButton({
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
        "flex-1 flex items-center justify-center gap-1.5 h-9 text-[10px] font-semibold transition-colors relative",
        active
          ? "text-foreground/90"
          : "text-muted-foreground/40 hover:text-muted-foreground/60"
      )}
    >
      {icon}
      {label}
      {badge && (
        <span className="w-1.5 h-1.5 rounded-full bg-foreground/60" />
      )}
      {active && (
        <span
          className="absolute bottom-0 left-2 right-2 h-px"
          style={{ background: "hsla(0, 0%, 100%, 0.4)" }}
        />
      )}
    </button>
  );
}
