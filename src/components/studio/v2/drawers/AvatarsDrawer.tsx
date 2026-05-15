import { useMemo, useState } from "react";
import { useAvatarTemplatesQuery } from "@/hooks/useAvatarTemplatesQuery";
import { useChunkedAvatars } from "@/hooks/useChunkedAvatars";
import { Search, Sparkles, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CastMember } from "../types";

interface Props {
  onSelect: (cast: CastMember) => void;
  selectedIds: string[];
  onClose: () => void;
}

export function AvatarsDrawerContent({ onSelect, selectedIds, onClose }: Props) {
  const { data: templates = [], isLoading } = useAvatarTemplatesQuery();
  const [q, setQ] = useState("");
  const [gender, setGender] = useState<"all" | "male" | "female">("all");

  const filtered = useMemo(() => {
    return templates.filter(t => {
      if (gender !== "all" && (t.gender || "").toLowerCase() !== gender) return false;
      if (q && !`${t.name} ${t.style || ""} ${(t.tags || []).join(" ")}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [templates, q, gender]);

  const { visibleAvatars, isFullyLoaded, loadMore } = useChunkedAvatars(filtered);

  return (
    <div className="p-7 space-y-5">
      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search avatars by name, style, tag…"
            className="w-full pl-10 pr-4 h-11 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white placeholder:text-white/30 focus:border-[#0A84FF]/50 focus:outline-none transition-colors text-sm"
          />
        </div>
        <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
          {(["all","female","male"] as const).map(g => (
            <button key={g} onClick={() => setGender(g)}
              className={cn("px-3 h-9 rounded-lg text-xs font-mono uppercase tracking-wider transition-colors",
                gender === g ? "bg-[#0A84FF] text-white" : "text-white/50 hover:text-white")}>
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Generate-new card */}
      <button
        onClick={() => { onClose(); /* future: open generate flow */ }}
        className="w-full group relative overflow-hidden rounded-2xl border border-[#0A84FF]/30 bg-gradient-to-br from-[#0A84FF]/10 to-transparent p-5 flex items-center gap-4 hover:from-[#0A84FF]/20 transition-all"
      >
        <div className="w-12 h-12 rounded-xl bg-[#0A84FF]/20 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-[#0A84FF]" />
        </div>
        <div className="text-left">
          <div className="text-white font-medium">Generate new avatar</div>
          <div className="text-xs text-white/50">Describe a character — face-locked identity, lifelike voice.</div>
        </div>
      </button>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-xl bg-white/[0.04] animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            {visibleAvatars.map(a => {
              const selected = selectedIds.includes(a.id);
              return (
                <button
                  key={a.id}
                  onClick={() => onSelect({
                    id: a.id,
                    name: a.name,
                    imageUrl: a.thumbnail_url || a.face_image_url,
                    voiceId: a.voice_id,
                    source: "library",
                  })}
                  className={cn(
                    "group relative aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all",
                    selected ? "border-[#0A84FF] shadow-[0_0_24px_rgba(10,132,255,0.4)]" : "border-white/[0.06] hover:border-white/20"
                  )}
                >
                  <img src={a.thumbnail_url || a.face_image_url} alt={a.name} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                  {selected && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#0A84FF] flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 right-2 text-left">
                    <div className="text-white text-[13px] font-medium leading-tight truncate">{a.name}</div>
                    <div className="text-white/50 text-[10px] uppercase tracking-wider truncate">{a.style || a.gender}</div>
                  </div>
                </button>
              );
            })}
          </div>
          {!isFullyLoaded && (
            <button onClick={loadMore} className="w-full h-11 rounded-xl border border-white/[0.06] text-white/60 hover:text-white hover:border-white/20 transition-colors text-sm">
              Load more
            </button>
          )}
        </>
      )}
    </div>
  );
}