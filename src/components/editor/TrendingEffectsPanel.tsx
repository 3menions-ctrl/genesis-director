import { useState } from "react";
import { Zap, Sparkles, Film, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import { EFFECT_PRESETS } from "./types";

interface TrendingEffectsPanelProps {
  onApplyEffect: (effectId: string) => void;
  activeEffects?: string[];
}

const EFFECT_CATEGORIES = [
  { id: "all", label: "All", icon: Sparkles },
  { id: "trending", label: "Trending", icon: Zap },
  { id: "cinematic", label: "Cinematic", icon: Film },
  { id: "creative", label: "Creative", icon: Palette },
];

export const TrendingEffectsPanel = ({ onApplyEffect, activeEffects = [] }: TrendingEffectsPanelProps) => {
  const [category, setCategory] = useState("all");

  const filtered = category === "all"
    ? EFFECT_PRESETS
    : EFFECT_PRESETS.filter((e) => e.category === category);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <Zap className="h-3 w-3 text-violet-400" />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Effects</span>
      </div>

      <p className="text-[10px] text-white/25 leading-relaxed">
        TikTok-style trending effects. Select a clip first, then apply.
      </p>

      {/* Category tabs */}
      <div className="flex gap-1">
        {EFFECT_CATEGORIES.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.id}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[8px] font-medium transition-all",
                category === c.id
                  ? "bg-white text-black font-semibold"
                  : "text-white/25 hover:text-white hover:bg-white/[0.05] border border-white/[0.04]"
              )}
              onClick={() => setCategory(c.id)}
            >
              <Icon className="h-2.5 w-2.5" />
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Effects grid */}
      <div className="grid grid-cols-2 gap-1.5">
        {filtered.map((effect) => {
          const isActive = activeEffects.includes(effect.id);
          return (
            <button
              key={effect.id}
              className={cn(
                "p-3 rounded-xl border text-left transition-all group",
                isActive
                  ? "bg-white/[0.08] border-white/20"
                  : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.1]"
              )}
              onClick={() => onApplyEffect(effect.id)}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles className={cn("h-3 w-3", isActive ? "text-violet-400" : "text-white/20 group-hover:text-white/40")} />
                <span className={cn("text-[9px] font-medium", isActive ? "text-white" : "text-white/50")}>{effect.name}</span>
              </div>
              <p className="text-[8px] text-white/20 leading-relaxed">{effect.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
};
