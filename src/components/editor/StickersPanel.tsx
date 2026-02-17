import { useState } from "react";
import { Smile, Shapes, MousePointer } from "lucide-react";
import { cn } from "@/lib/utils";
import { STICKER_PRESETS } from "./types";

interface StickersPanelProps {
  onAddSticker: (stickerId: string, content: string, category: string) => void;
}

const STICKER_CATEGORIES = [
  { id: "all", label: "All", icon: Smile },
  { id: "emoji", label: "Emoji", icon: Smile },
  { id: "shape", label: "Shapes", icon: Shapes },
  { id: "cta", label: "CTA", icon: MousePointer },
];

export const StickersPanel = ({ onAddSticker }: StickersPanelProps) => {
  const [category, setCategory] = useState("all");

  const filtered = category === "all"
    ? STICKER_PRESETS
    : STICKER_PRESETS.filter((s) => s.category === category);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
          <Smile className="h-3 w-3 text-pink-400" />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Stickers</span>
      </div>

      <p className="text-[10px] text-white/25 leading-relaxed">
        Add emoji reactions, shapes, and call-to-action overlays.
      </p>

      {/* Category tabs */}
      <div className="flex gap-1">
        {STICKER_CATEGORIES.map((c) => {
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

      {/* Sticker grid */}
      <div className={cn(
        "grid gap-1.5",
        category === "cta" ? "grid-cols-2" : "grid-cols-4"
      )}>
        {filtered.map((sticker) => (
          <button
            key={sticker.id}
            className={cn(
              "rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/[0.12] transition-all group",
              "flex flex-col items-center justify-center gap-1",
              category === "cta" ? "p-3" : "p-2.5 aspect-square"
            )}
            onClick={() => onAddSticker(sticker.id, sticker.name, sticker.category)}
            title={sticker.label}
          >
            <span className={cn(
              "transition-transform group-hover:scale-125",
              sticker.category === "cta" ? "text-[11px] font-bold text-white/70 tracking-wider" :
              sticker.category === "emoji" ? "text-2xl" : "text-xl text-white/40"
            )}>
              {sticker.name}
            </span>
            {sticker.category === "cta" && (
              <span className="text-[7px] text-white/20">{sticker.label}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
