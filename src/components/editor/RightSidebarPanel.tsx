/**
 * RightSidebarPanel — Pro 6-tab Inspector panel
 * Templates, Inspector, FX, AI Scene, Avatars, Voice
 */

import { memo, useState, useEffect } from "react";
import { Layers, Scissors, Sparkles, Wand2, Users, Mic, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClipPropertiesPanel } from "@/components/editor/ClipPropertiesPanel";
import { TemplatesPanel } from "@/components/editor/TemplatesPanel";
import { CinematicFXPanel } from "@/components/editor/CinematicFXPanel";
import { AISceneBuilder } from "@/components/editor/AISceneBuilder";
import { EditorAvatarPanel } from "@/components/editor/EditorAvatarPanel";
import { EditorVoicePanel } from "@/components/editor/EditorVoicePanel";
import { useCustomTimeline } from "@/hooks/useCustomTimeline";

type Tab = "templates" | "properties" | "fx" | "ai" | "avatars" | "voice";

const TAB_META: Record<Tab, { label: string; sub: string }> = {
  templates: { label: "Templates", sub: "Layouts & Looks" },
  properties: { label: "Inspector", sub: "Clip Properties" },
  fx: { label: "FX", sub: "Cinematic Effects" },
  ai: { label: "AI Scene", sub: "Generative Director" },
  avatars: { label: "Cast", sub: "Characters & Avatars" },
  voice: { label: "Voice", sub: "Audio & Dialogue" },
};

export const RightSidebarPanel = memo(function RightSidebarPanel() {
  const { state } = useCustomTimeline();
  const hasSelection = !!state.selectedClipId;
  const [activeTab, setActiveTab] = useState<Tab>("templates");

  useEffect(() => {
    if (hasSelection && activeTab === "templates") {
      setActiveTab("properties");
    }
  }, [hasSelection]);

  const meta = TAB_META[activeTab];

  return (
    <div
      className="w-72 shrink-0 flex flex-col border-l overflow-hidden relative"
      style={{
        background:
          'linear-gradient(180deg, hsla(220, 14%, 6%, 0.95) 0%, hsla(220, 14%, 4%, 0.95) 100%)',
        borderColor: 'hsla(0, 0%, 100%, 0.05)',
        boxShadow:
          'inset 1px 0 0 hsla(0,0%,100%,0.02), -8px 0 30px -16px hsla(0,0%,0%,0.6)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Panel section header */}
      <div
        className="shrink-0 px-3.5 py-3 relative"
        style={{
          borderBottom: '1px solid hsla(0,0%,100%,0.05)',
          background: 'linear-gradient(180deg, hsla(215,100%,40%,0.04), transparent)',
        }}
      >
        <div className="absolute bottom-0 inset-x-3 h-px bg-gradient-to-r from-transparent via-[hsla(215,100%,55%,0.25)] to-transparent" />
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(135deg, hsl(215,100%,55%) 0%, hsl(200,100%,42%) 100%)',
              boxShadow:
                '0 0 0 1px hsla(215,100%,75%,0.3) inset, 0 1px 0 hsla(0,0%,100%,0.2) inset, 0 6px 18px -6px hsla(215,100%,50%,0.55)',
            }}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="leading-tight min-w-0">
            <span className="font-display text-[10.5px] font-semibold uppercase tracking-[0.18em] text-foreground/85 block truncate">
              {meta.label}
            </span>
            <span className="text-[9px] text-muted-foreground/50 mt-1 block tracking-wide truncate">
              {meta.sub}
            </span>
          </div>
        </div>
      </div>

      {/* Top-level tab bar */}
      <div
        className="shrink-0 flex items-center px-1.5 py-2 gap-0.5 border-b overflow-x-auto"
        style={{
          borderColor: 'hsla(0, 0%, 100%, 0.05)',
          background: 'hsla(0, 0%, 100%, 0.015)',
        }}
      >
        <TopTabButton active={activeTab === "templates"} onClick={() => setActiveTab("templates")} icon={<Layers className="w-3 h-3" />} label="Tmpl" />
        <TopTabButton active={activeTab === "properties"} onClick={() => setActiveTab("properties")} icon={<Scissors className="w-3 h-3" />} label="Insp" badge={hasSelection} />
        <TopTabButton active={activeTab === "fx"} onClick={() => setActiveTab("fx")} icon={<Sparkles className="w-3 h-3" />} label="FX" />
        <TopTabButton active={activeTab === "ai"} onClick={() => setActiveTab("ai")} icon={<Wand2 className="w-3 h-3" />} label="AI" glow />
        <TopTabButton active={activeTab === "avatars"} onClick={() => setActiveTab("avatars")} icon={<Users className="w-3 h-3" />} label="Cast" />
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
        "flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[9px] font-semibold uppercase tracking-[0.1em] transition-all relative min-w-0",
        active
          ? "text-foreground"
          : "text-muted-foreground/45 hover:text-foreground/75 hover:bg-white/[0.04]"
      )}
      style={
        active
          ? {
              background:
                'linear-gradient(180deg, hsla(215,100%,55%,0.18), hsla(215,100%,40%,0.06))',
              boxShadow:
                '0 0 0 1px hsla(215,100%,55%,0.28) inset, 0 1px 0 hsla(0,0%,100%,0.06) inset, 0 4px 14px -4px hsla(215,100%,55%,0.4)',
            }
          : undefined
      }
    >
      {icon}
      <span className="hidden xl:inline">{label}</span>
      {badge && (
        <span
          className="w-1.5 h-1.5 rounded-full bg-[hsl(142,72%,55%)] animate-pulse"
          style={{ boxShadow: '0 0 6px hsla(142,72%,55%,0.7)' }}
        />
      )}
      {glow && active && (
        <span
          className="absolute -inset-px rounded-md pointer-events-none"
          style={{ boxShadow: '0 0 18px hsla(215,100%,55%,0.35)' }}
        />
      )}
    </button>
  );
}
