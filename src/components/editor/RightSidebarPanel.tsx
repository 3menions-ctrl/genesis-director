/**
 * RightSidebarPanel — Pro 4-tab Inspector panel
 * Templates, Properties, Cinematic FX, AI Scene Builder
 * Apple-clean aesthetic with blue accent system
 */

import { memo, useState, useEffect } from "react";
import { Layers, Scissors, Sparkles, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClipPropertiesPanel } from "@/components/editor/ClipPropertiesPanel";
import { TemplatesPanel } from "@/components/editor/TemplatesPanel";
import { CinematicFXPanel } from "@/components/editor/CinematicFXPanel";
import { AISceneBuilder } from "@/components/editor/AISceneBuilder";
import { useCustomTimeline } from "@/hooks/useCustomTimeline";

type Tab = "templates" | "properties" | "fx" | "ai";

export const RightSidebarPanel = memo(function RightSidebarPanel() {
  const { state } = useCustomTimeline();
  const hasSelection = !!state.selectedClipId;
  const [activeTab, setActiveTab] = useState<Tab>("templates");

  // Auto-switch to properties when a clip is selected
  useEffect(() => {
    if (hasSelection && activeTab === "templates") {
      setActiveTab("properties");
    }
  }, [hasSelection]);

  return (
    <div
      className="w-72 shrink-0 flex flex-col border-l overflow-hidden"
      style={{
        background: "hsl(220, 13%, 5%)",
        borderColor: "hsla(0, 0%, 100%, 0.06)",
      }}
    >
      {/* Top-level tab bar — Apple-clean pill style */}
      <div
        className="shrink-0 flex items-center px-1.5 py-1.5 gap-0.5 border-b"
        style={{
          borderColor: "hsla(0, 0%, 100%, 0.06)",
          background: "hsla(0, 0%, 100%, 0.02)",
        }}
      >
        <TopTabButton
          active={activeTab === "templates"}
          onClick={() => setActiveTab("templates")}
          icon={<Layers className="w-3 h-3" />}
          label="Templates"
        />
        <TopTabButton
          active={activeTab === "properties"}
          onClick={() => setActiveTab("properties")}
          icon={<Scissors className="w-3 h-3" />}
          label="Inspector"
          badge={hasSelection}
        />
        <TopTabButton
          active={activeTab === "fx"}
          onClick={() => setActiveTab("fx")}
          icon={<Sparkles className="w-3 h-3" />}
          label="FX"
        />
        <TopTabButton
          active={activeTab === "ai"}
          onClick={() => setActiveTab("ai")}
          icon={<Wand2 className="w-3 h-3" />}
          label="AI"
          glow
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "templates" && <TemplatesPanel />}
        {activeTab === "properties" && <ClipPropertiesPanel embedded />}
        {activeTab === "fx" && <CinematicFXPanel />}
        {activeTab === "ai" && <AISceneBuilder />}
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
  glow,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: boolean;
  glow?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all relative",
        active
          ? "bg-[hsla(215,100%,50%,0.12)] text-[hsl(0,0%,90%)]"
          : "text-[hsl(0,0%,40%)] hover:text-[hsl(0,0%,65%)] hover:bg-[hsla(0,0%,100%,0.04)]"
      )}
    >
      {icon}
      <span className="hidden xl:inline">{label}</span>
      {badge && (
        <span className="w-1.5 h-1.5 rounded-full bg-[hsl(142,72%,50%)] animate-pulse" />
      )}
      {glow && active && (
        <span
          className="absolute inset-0 rounded-lg pointer-events-none"
          style={{
            boxShadow: "inset 0 0 12px hsla(265, 80%, 60%, 0.1)",
          }}
        />
      )}
    </button>
  );
}
