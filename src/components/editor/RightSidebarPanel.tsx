/**
 * RightSidebarPanel — Pro 10-tab Inspector panel
 * Templates, Inspector, Compositor, Keyframes, Color, Mixer, FX, AI, Avatars, Voice
 */

import { memo, useState, useEffect } from "react";
import {
  Layers, Scissors, Sparkles, Wand2, Users, Mic, Move, Diamond, Palette, SlidersHorizontal
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ClipPropertiesPanel } from "@/components/editor/ClipPropertiesPanel";
import { TemplatesPanel } from "@/components/editor/TemplatesPanel";
import { CinematicFXPanel } from "@/components/editor/CinematicFXPanel";
import { AISceneBuilder } from "@/components/editor/AISceneBuilder";
import { EditorAvatarPanel } from "@/components/editor/EditorAvatarPanel";
import { EditorVoicePanel } from "@/components/editor/EditorVoicePanel";
import { CompositorPanel } from "@/components/editor/CompositorPanel";
import { KeyframePanel } from "@/components/editor/KeyframePanel";
import { ColorGradingPanel } from "@/components/editor/ColorGradingPanel";
import { AudioMixerPanel } from "@/components/editor/AudioMixerPanel";
import { useCustomTimeline } from "@/hooks/useCustomTimeline";

type Tab = "templates" | "properties" | "compositor" | "keyframes" | "color" | "mixer" | "fx" | "ai" | "avatars" | "voice";

export const RightSidebarPanel = memo(function RightSidebarPanel() {
  const { state } = useCustomTimeline();
  const hasSelection = !!state.selectedClipId;
  const [activeTab, setActiveTab] = useState<Tab>("templates");

  useEffect(() => {
    if (hasSelection && activeTab === "templates") {
      setActiveTab("properties");
    }
  }, [hasSelection]);

  const tabs: { id: Tab; icon: React.ReactNode; label: string; badge?: boolean; glow?: boolean }[] = [
    { id: "templates", icon: <Layers className="w-3 h-3" />, label: "Tmpl" },
    { id: "properties", icon: <Scissors className="w-3 h-3" />, label: "Insp", badge: hasSelection },
    { id: "compositor", icon: <Move className="w-3 h-3" />, label: "Comp" },
    { id: "keyframes", icon: <Diamond className="w-3 h-3" />, label: "Anim" },
    { id: "color", icon: <Palette className="w-3 h-3" />, label: "Color" },
    { id: "mixer", icon: <SlidersHorizontal className="w-3 h-3" />, label: "Mix" },
    { id: "fx", icon: <Sparkles className="w-3 h-3" />, label: "FX" },
    { id: "ai", icon: <Wand2 className="w-3 h-3" />, label: "AI", glow: true },
    { id: "avatars", icon: <Users className="w-3 h-3" />, label: "Char" },
    { id: "voice", icon: <Mic className="w-3 h-3" />, label: "Voice" },
  ];

  return (
    <div
      className="w-72 shrink-0 flex flex-col border-l overflow-hidden"
      style={{
        background: "hsl(220, 14%, 5%)",
        borderColor: "hsla(0, 0%, 100%, 0.06)",
      }}
    >
      {/* Two-row tab bar for 10 tabs */}
      <div className="shrink-0 border-b" style={{ borderColor: "hsla(0, 0%, 100%, 0.06)", background: "hsla(0, 0%, 100%, 0.02)" }}>
        <div className="flex items-center px-0.5 py-0.5 gap-0">
          {tabs.slice(0, 5).map(tab => (
            <TopTabButton key={tab.id} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} icon={tab.icon} label={tab.label} badge={tab.badge} glow={tab.glow} />
          ))}
        </div>
        <div className="flex items-center px-0.5 py-0.5 gap-0" style={{ borderTop: "1px solid hsla(0,0%,100%,0.03)" }}>
          {tabs.slice(5).map(tab => (
            <TopTabButton key={tab.id} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} icon={tab.icon} label={tab.label} badge={tab.badge} glow={tab.glow} />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "templates" && <TemplatesPanel />}
        {activeTab === "properties" && <ClipPropertiesPanel embedded />}
        {activeTab === "compositor" && <CompositorPanel />}
        {activeTab === "keyframes" && <KeyframePanel />}
        {activeTab === "color" && <ColorGradingPanel />}
        {activeTab === "mixer" && <AudioMixerPanel />}
        {activeTab === "fx" && <CinematicFXPanel />}
        {activeTab === "ai" && <AISceneBuilder />}
        {activeTab === "avatars" && <EditorAvatarPanel />}
        {activeTab === "voice" && <EditorVoicePanel />}
      </div>
    </div>
  );
});

function TopTabButton({ active, onClick, icon, label, badge, glow }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: boolean; glow?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-0.5 py-1.5 rounded-md text-[8px] font-semibold transition-all relative min-w-0",
        active
          ? "bg-[hsla(215,100%,50%,0.12)] text-[hsl(0,0%,90%)]"
          : "text-[hsl(0,0%,40%)] hover:text-[hsl(0,0%,65%)] hover:bg-[hsla(0,0%,100%,0.04)]"
      )}
    >
      {icon}
      <span className="hidden xl:inline">{label}</span>
      {badge && <span className="w-1.5 h-1.5 rounded-full bg-[hsl(142,72%,50%)] animate-pulse" />}
      {glow && active && (
        <span className="absolute inset-0 rounded-md pointer-events-none" style={{ boxShadow: "inset 0 0 12px hsla(215, 100%, 50%, 0.1)" }} />
      )}
    </button>
  );
}
