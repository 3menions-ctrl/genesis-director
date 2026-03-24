/**
 * RightSidebarPanel — Pro 6-tab Inspector panel
 * Templates, Inspector, FX, AI Scene, Avatars, Voice
 */

import { memo, useState, useEffect } from "react";
import { Layers, Scissors, Sparkles, Wand2, Users, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClipPropertiesPanel } from "@/components/editor/ClipPropertiesPanel";
import { TemplatesPanel } from "@/components/editor/TemplatesPanel";
import { CinematicFXPanel } from "@/components/editor/CinematicFXPanel";
import { AISceneBuilder } from "@/components/editor/AISceneBuilder";
import { EditorAvatarPanel } from "@/components/editor/EditorAvatarPanel";
import { EditorVoicePanel } from "@/components/editor/EditorVoicePanel";
import { useCustomTimeline } from "@/hooks/useCustomTimeline";

type Tab = "templates" | "properties" | "fx" | "ai" | "avatars" | "voice";

export const RightSidebarPanel = memo(function RightSidebarPanel() {
  const { state } = useCustomTimeline();
  const hasSelection = !!state.selectedClipId;
  const [activeTab, setActiveTab] = useState<Tab>("templates");

  useEffect(() => {
    if (hasSelection && activeTab === "templates") {
      setActiveTab("properties");
    }
  }, [hasSelection]);

  return (
    <div
      className="w-72 shrink-0 flex flex-col border-l overflow-hidden"
      style={{
        background: "hsl(220, 14%, 5%)",
        borderColor: "hsla(0, 0%, 100%, 0.06)",
      }}
    >
      {/* Top-level tab bar */}
      <div
        className="shrink-0 flex items-center px-1 py-1.5 gap-0.5 border-b overflow-x-auto"
        style={{
          borderColor: "hsla(0, 0%, 100%, 0.06)",
          background: "hsla(0, 0%, 100%, 0.02)",
        }}
      >
        <TopTabButton active={activeTab === "templates"} onClick={() => setActiveTab("templates")} icon={<Layers className="w-3 h-3" />} label="Tmpl" />
        <TopTabButton active={activeTab === "properties"} onClick={() => setActiveTab("properties")} icon={<Scissors className="w-3 h-3" />} label="Insp" badge={hasSelection} />
        <TopTabButton active={activeTab === "fx"} onClick={() => setActiveTab("fx")} icon={<Sparkles className="w-3 h-3" />} label="FX" />
        <TopTabButton active={activeTab === "ai"} onClick={() => setActiveTab("ai")} icon={<Wand2 className="w-3 h-3" />} label="AI" glow />
        <TopTabButton active={activeTab === "avatars"} onClick={() => setActiveTab("avatars")} icon={<Users className="w-3 h-3" />} label="Char" />
        <TopTabButton active={activeTab === "voice"} onClick={() => setActiveTab("voice")} icon={<Mic className="w-3 h-3" />} label="Voice" />
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "templates" && <TemplatesPanel />}
        {activeTab === "properties" && <ClipPropertiesPanel embedded />}
        {activeTab === "fx" && <CinematicFXPanel />}
        {activeTab === "ai" && <AISceneBuilder />}
        {activeTab === "avatars" && <EditorAvatarPanel />}
        {activeTab === "voice" && <EditorVoicePanel />}
      </div>
    </div>
  );
});

function TopTabButton({ active, onClick, icon, label, badge, glow }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: boolean; glow?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-0.5 py-1.5 rounded-lg text-[9px] font-semibold transition-all relative min-w-0",
        active
          ? "bg-[hsla(215,100%,50%,0.12)] text-[hsl(0,0%,90%)]"
          : "text-[hsl(0,0%,40%)] hover:text-[hsl(0,0%,65%)] hover:bg-[hsla(0,0%,100%,0.04)]"
      )}
    >
      {icon}
      <span className="hidden xl:inline">{label}</span>
      {badge && <span className="w-1.5 h-1.5 rounded-full bg-[hsl(142,72%,50%)] animate-pulse" />}
      {glow && active && (
        <span className="absolute inset-0 rounded-lg pointer-events-none" style={{ boxShadow: "inset 0 0 12px hsla(215, 100%, 50%, 0.1)" }} />
      )}
    </button>
  );
}
