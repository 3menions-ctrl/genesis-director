import { cn } from "@/lib/utils";
import { FILTER_PRESETS, type TimelineClip } from "./types";

interface FiltersPanelProps {
  clip: TimelineClip;
  onUpdateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
}

export const FiltersPanel = ({ clip, onUpdateClip }: FiltersPanelProps) => {
  const currentFilter = clip.filter || "none";

  return (
    <div className="space-y-3">
      <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/30">
        Filters & Presets
      </span>

      <div className="grid grid-cols-3 gap-1">
        {FILTER_PRESETS.map((preset) => (
          <button
            key={preset.id}
            className={cn(
              "relative rounded-md border p-2 transition-all text-center",
              currentFilter === preset.id
                ? "bg-white text-black border-white/20 font-semibold"
                : "bg-white/[0.03] border-white/[0.06] text-white/40 hover:text-white hover:bg-white/[0.06]"
            )}
            onClick={() => onUpdateClip(clip.id, { filter: preset.id })}
          >
            {/* Preview swatch */}
            <div
              className="w-full h-6 rounded-sm mb-1 bg-gradient-to-br from-primary/30 to-emerald-500/30"
              style={{ filter: preset.css || undefined }}
            />
            <span className="text-[8px] font-medium">{preset.name}</span>
          </button>
        ))}
      </div>

      {currentFilter !== "none" && (
        <div className="p-2 rounded-md bg-black/20 border border-white/[0.04]">
          <span className="text-[7px] text-white/15 font-mono break-all leading-relaxed">
            {FILTER_PRESETS.find((f) => f.id === currentFilter)?.css}
          </span>
        </div>
      )}
    </div>
  );
};
