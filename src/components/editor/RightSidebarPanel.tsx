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
      className="w-72 shrink-0 flex flex-col overflow-hidden relative"
      style={{
        background:
          'linear-gradient(180deg, hsla(220, 14%, 5%, 0.55) 0%, hsla(220, 14%, 3%, 0.55) 100%)',
        backdropFilter: 'blur(48px) saturate(180%)',
        WebkitBackdropFilter: 'blur(48px) saturate(180%)',
        boxShadow:
          'inset 1px 0 0 hsla(0,0%,100%,0.025), -24px 0 64px -28px hsla(0,0%,0%,0.55), inset 0 1px 0 hsla(0,0%,100%,0.04)',
      }}
    >
      {/* Panel section header */}
      <div
        className="shrink-0 px-4 py-4 relative"
        style={{
          background: 'linear-gradient(180deg, hsla(215,100%,50%,0.045), transparent 80%)',
        }}
      >
        <div className="absolute bottom-0 inset-x-4 h-px bg-gradient-to-r from-transparent via-[hsla(215,100%,60%,0.16)] to-transparent" />
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{
              background: 'hsla(215,100%,60%,0.12)',
              boxShadow:
                'inset 0 1px 0 hsla(0,0%,100%,0.08), 0 0 18px -4px hsla(215,100%,55%,0.45)',
            }}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" strokeWidth={1.5} style={{ color: 'hsla(215,100%,80%,0.95)' }} />
          </div>
          <div className="leading-tight min-w-0">
            <span className="font-display text-[10.5px] font-light uppercase tracking-[0.22em] text-foreground/80 block truncate">
              {meta.label}
            </span>
            <span className="text-[9px] font-light text-muted-foreground/45 mt-1.5 block tracking-wide truncate">
              {meta.sub}
            </span>
          </div>
        </div>
      </div>

      {/* Top-level tab bar — glass pill rail */}
      <div
        className="shrink-0 flex items-center mx-3 my-2.5 px-1 py-1 gap-0.5 rounded-full overflow-x-auto"
        style={{
          background: 'hsla(0,0%,100%,0.025)',
          backdropFilter: 'blur(36px) saturate(180%)',
          WebkitBackdropFilter: 'blur(36px) saturate(180%)',
          boxShadow:
            'inset 0 1px 0 hsla(0,0%,100%,0.05), 0 8px 32px -16px hsla(0,0%,0%,0.5)',
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
        "flex-1 flex items-center justify-center gap-1 py-1.5 rounded-full text-[9px] font-light uppercase tracking-[0.14em] transition-all duration-300 relative min-w-0",
        active
          ? "text-white"
          : "text-muted-foreground/45 hover:text-foreground/80 hover:bg-white/[0.04]"
      )}
      style={
        active
          ? {
              background:
                'linear-gradient(180deg, hsla(215,100%,60%,0.28), hsla(215,100%,45%,0.10))',
              boxShadow:
                'inset 0 1px 0 hsla(0,0%,100%,0.10), 0 6px 20px -6px hsla(215,100%,60%,0.55), 0 0 24px -8px hsla(215,100%,60%,0.45)',
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
          className="absolute -inset-px rounded-full pointer-events-none"
          style={{ boxShadow: '0 0 24px hsla(215,100%,60%,0.45)' }}
        />
      )}
    </button>
  );
}
