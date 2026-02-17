import { useState } from "react";
import { Layout, Sparkles, Film, ShoppingBag, Share2, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { TEMPLATE_PRESETS } from "./types";

interface TemplatesPanelProps {
  onApplyTemplate: (templateId: string) => void;
}

const TEMPLATE_CATEGORIES = [
  { id: "all", label: "All", icon: Layout },
  { id: "social", label: "Social", icon: Share2 },
  { id: "cinematic", label: "Cinematic", icon: Film },
  { id: "commercial", label: "Commercial", icon: ShoppingBag },
  { id: "utility", label: "Utility", icon: Wrench },
];

export const TemplatesPanel = ({ onApplyTemplate }: TemplatesPanelProps) => {
  const [category, setCategory] = useState("all");

  const filtered = category === "all"
    ? TEMPLATE_PRESETS
    : TEMPLATE_PRESETS.filter((t) => t.category === category);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <Layout className="h-3 w-3 text-white/30" />
        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/30">Templates</span>
        <span className="ml-auto text-[8px] text-white/15 font-mono bg-white/[0.03] px-1.5 py-0.5 rounded border border-white/[0.04]">
          {TEMPLATE_PRESETS.length}
        </span>
      </div>

      <p className="text-[10px] text-white/25 leading-relaxed">
        Apply a preset timeline layout to quickly structure your edit.
      </p>

      {/* Category tabs */}
      <div className="flex gap-1 flex-wrap">
        {TEMPLATE_CATEGORIES.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.id}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-md text-[8px] font-medium transition-all",
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

      {/* Template list */}
      <div className="space-y-1">
        {filtered.map((template) => (
          <button
            key={template.id}
            className={cn(
              "w-full flex items-start gap-3 p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]",
              "hover:bg-white/[0.05] hover:border-white/[0.1] transition-all text-left group"
            )}
            onClick={() => onApplyTemplate(template.id)}
          >
            <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0 group-hover:bg-white/[0.08] transition-colors text-lg">
              {template.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-[11px] text-white/70 font-medium">{template.name}</p>
                <span className={cn(
                  "text-[7px] font-medium px-1.5 py-0.5 rounded-full border uppercase tracking-wider",
                  template.category === "social" ? "text-cyan-400/60 bg-cyan-500/5 border-cyan-500/10" :
                  template.category === "cinematic" ? "text-amber-400/60 bg-amber-500/5 border-amber-500/10" :
                  template.category === "commercial" ? "text-emerald-400/60 bg-emerald-500/5 border-emerald-500/10" :
                  "text-white/20 bg-white/[0.02] border-white/[0.04]"
                )}>
                  {template.category}
                </span>
              </div>
              <p className="text-[9px] text-white/25 mt-0.5">{template.description}</p>
              <span className="text-[8px] text-white/15 font-mono mt-1 block">{template.tracks} tracks</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
