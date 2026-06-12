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
    <div className="w-72 shrink-0 flex flex-col overflow-hidden relative bg-[hsl(var(--foreground)/0.015)] backdrop-blur-xl border-l border-border/30">
      {/* Foundation accent hairline on inside edge */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-[hsl(var(--accent)/0.18)] to-transparent" />
      {/* Panel section header */}
      <div className="shrink-0 px-5 py-5 relative">
        <div className="pointer-events-none absolute inset-x-4 bottom-0 h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center border border-border/30 bg-[hsl(var(--foreground)/0.02)] backdrop-blur-xl">
            <SlidersHorizontal
              className="w-3.5 h-3.5 text-accent"
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

      {/* Top-level tab bar — Foundation glass pill rail */}
      <div className="shrink-0 flex items-center mx-3 my-3 px-1 py-1 gap-0.5 rounded-full overflow-x-auto border border-border/30 bg-[hsl(var(--foreground)/0.02)] backdrop-blur-xl">
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
          : "text-muted-foreground/45 hover:text-foreground/80 hover:bg-glass-hover"
      )}
    >
      {active && (
        <motion.span
          layoutId="editor-tab-active"
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="absolute inset-0 -z-10 rounded-full bg-[hsl(var(--accent)/0.10)] ring-1 ring-inset ring-[hsl(var(--accent)/0.30)]"
        />
      )}
      <span className={cn(active && "text-accent")}>
        {icon}
      </span>
      <span className="hidden xl:inline">{label}</span>
      {badge && (
        <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
      )}
    </button>
  );
}
