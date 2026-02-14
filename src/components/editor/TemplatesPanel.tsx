import { Layout, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { TEMPLATE_PRESETS } from "./types";

interface TemplatesPanelProps {
  onApplyTemplate: (templateId: string) => void;
}

export const TemplatesPanel = ({ onApplyTemplate }: TemplatesPanelProps) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <Layout className="h-3 w-3 text-white/30" />
        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/30">Templates</span>
      </div>

      <p className="text-[10px] text-white/25 leading-relaxed">
        Apply a preset timeline layout to quickly structure your edit.
      </p>

      <div className="space-y-1">
        {TEMPLATE_PRESETS.map((template) => (
          <button
            key={template.id}
            className={cn(
              "w-full flex items-start gap-3 p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]",
              "hover:bg-white/[0.05] hover:border-white/[0.1] transition-all text-left group"
            )}
            onClick={() => onApplyTemplate(template.id)}
          >
            <div className="w-8 h-8 rounded bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0 group-hover:bg-white/[0.08] transition-colors">
              <Sparkles className="h-3.5 w-3.5 text-white/30 group-hover:text-white/60 transition-colors" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-white/70 font-medium">{template.name}</p>
              <p className="text-[9px] text-white/25 mt-0.5">{template.description}</p>
              <span className="text-[8px] text-white/15 font-mono mt-1 block">{template.tracks} tracks</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
