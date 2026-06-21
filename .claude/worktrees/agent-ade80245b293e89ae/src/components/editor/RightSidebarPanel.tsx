/**
 * RightSidebarPanel — Pro 6-tab Inspector panel
 * Templates, Inspector, FX, AI Scene, Avatars, Voice
 */

import { memo, useState, useEffect } from "react";
import { motion } from "framer-motion";
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
      className="w-72 shrink-0 flex flex-col overflow-hidden relative bg-transparent"
    >
      {/* boundary-less left hairline */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-white/[0.07] to-transparent" />
      {/* Panel section header */}
      <div
        className="shrink-0 px-5 py-5 relative"
      >
        <div className="pointer-events-none absolute inset-x-4 bottom-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        <div className="flex items-center gap-2">
          <div
            className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center"
            style={{
              background:
                'linear-gradient(180deg, hsla(215,100%,60%,0.22) 0%, hsla(215,100%,55%,0.08) 100%)',
              boxShadow:
                '0 0 18px hsla(215,100%,60%,0.30), inset 0 1px 0 hsla(0,0%,100%,0.10)',
            }}
          >
            <SlidersHorizontal
              className="w-3.5 h-3.5 text-[hsl(215,100%,80%)] drop-shadow-[0_0_8px_hsla(215,100%,60%,0.6)]"
              strokeWidth={1.5}
            />
          </div>
          <div className="leading-tight min-w-0">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent block truncate">
              {meta.label}
            </span>
            <span className="font-display italic text-sm bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent mt-0.5 block truncate">
              {meta.sub}
            </span>
          </div>
        </div>
      </div>

      {/* Top-level tab bar — glass pill rail */}
      <div
        className="shrink-0 flex items-center mx-3 my-3 px-1 py-1 gap-0.5 rounded-full overflow-x-auto"
        style={{
          background: 'hsla(0,0%,100%,0.025)',
          backdropFilter: 'blur(48px) saturate(180%)',
          WebkitBackdropFilter: 'blur(48px) saturate(180%)',
          boxShadow:
            '0 8px 40px -12px rgba(0,0,0,0.6), inset 0 1px 0 hsla(0,0%,100%,0.04)',
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
        "flex-1 flex items-center justify-center gap-1 py-1.5 rounded-full text-[9px] font-light uppercase tracking-[0.14em] transition-colors duration-500 relative min-w-0",
        active
          ? "text-foreground"
          : "text-muted-foreground/45 hover:text-foreground/80 hover:bg-white/[0.04]"
      )}
    >
      {active && (
        <motion.span
          layoutId="editor-tab-active"
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="absolute inset-0 -z-10 rounded-full"
          style={{
            background:
              'linear-gradient(180deg, hsla(215,100%,60%,0.22) 0%, hsla(215,100%,55%,0.10) 100%)',
            boxShadow:
              '0 0 18px hsla(215,100%,60%,0.35), 0 0 32px hsla(215,100%,60%,0.18), inset 0 1px 0 hsla(0,0%,100%,0.10)',
          }}
        />
      )}
      <span className={cn(active && "text-[hsl(215,100%,80%)] drop-shadow-[0_0_8px_hsla(215,100%,60%,0.6)]")}>
        {icon}
      </span>
      <span className="hidden xl:inline">{label}</span>
      {badge && (
        <span
          className="w-1.5 h-1.5 rounded-full bg-[hsl(215,100%,60%)] animate-pulse shadow-[0_0_8px_hsla(215,100%,60%,0.6)]"
        />
      )}
    </button>
  );
}
