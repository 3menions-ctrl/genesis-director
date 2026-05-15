import { useEffect, useMemo, useState } from "react";
import { Check, Search, Sparkles, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAvatarTemplatesQuery } from "@/hooks/useAvatarTemplatesQuery";
import { useChunkedAvatars } from "@/hooks/useChunkedAvatars";
import { cn } from "@/lib/utils";
import type { CastMember } from "../types";

interface Props {
  onSelect: (cast: CastMember) => void;
  selectedIds: string[];
  onClose: () => void;
}

interface SavedCharacterRow {
  id: string;
  name: string;
  description: string | null;
  voice_id: string | null;
  reference_image_urls: string[] | null;
}

export function AvatarsDrawerContent({ onSelect, selectedIds, onClose }: Props) {
  const { allTemplates: templates = [], isLoading } = useAvatarTemplatesQuery();
  const [saved, setSaved] = useState<SavedCharacterRow[]>([]);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"saved" | "gallery">("saved");
  const [gender, setGender] = useState<"all" | "male" | "female">("all");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("characters")
        .select("id,name,description,voice_id,reference_image_urls")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(60);
      if (!cancelled) setSaved((data as SavedCharacterRow[]) || []);
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredSaved = useMemo(() => saved.filter(character => {
    if (!q) return true;
    return `${character.name} ${character.description || ""}`.toLowerCase().includes(q.toLowerCase());
  }), [saved, q]);

  const filteredTemplates = useMemo(() => templates.filter(template => {
    if (gender !== "all" && (template.gender || "").toLowerCase() !== gender) return false;
    if (q && !`${template.name} ${template.style || ""} ${(template.tags || []).join(" ")}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [templates, q, gender]);

  const { visibleAvatars, isFullyLoaded, loadMore } = useChunkedAvatars(filteredTemplates);

  const generateQuickAvatar = async () => {
    setGenerating(true);
    try {
      const name = q.trim() || `Studio Avatar ${saved.length + selectedIds.length + 1}`;
      const { data, error } = await supabase.functions.invoke("generate-avatar-image", {
        body: {
          name,
          gender: "female",
          ageRange: "adult",
          ethnicity: "diverse",
          style: "cinematic realistic",
          personality: "confident, expressive, camera-ready",
          clothing: "premium modern studio wardrobe",
          generateAllViews: false,
        },
      });
      if (error) throw error;
      const url = (data as any)?.frontImageUrl;
      if (!url) throw new Error("Avatar image was not returned");
      onSelect({ id: crypto.randomUUID(), name, imageUrl: url, source: "generated" });
      toast.success("Avatar generated and added to cast");
      onClose();
    } catch (error: any) {
      toast.error(error?.message || "Avatar generation failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="p-7 space-y-5">
      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search saved characters or avatar gallery…"
            className="w-full pl-10 pr-4 h-11 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:border-accent/50 focus:outline-none transition-colors text-sm"
          />
        </div>
        <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1">
          {(["saved", "gallery"] as const).map(value => (
            <button key={value} onClick={() => setTab(value)} className={cn("px-3 h-9 rounded-lg text-xs font-mono uppercase tracking-wider transition-colors", tab === value ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}>{value}</button>
          ))}
        </div>
      </div>

      <button
        onClick={generateQuickAvatar}
        disabled={generating}
        className="w-full group relative overflow-hidden rounded-2xl border border-accent/30 bg-accent/10 p-5 flex items-center gap-4 hover:bg-accent/15 transition-all disabled:opacity-50"
      >
        <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
          {generating ? <Sparkles className="w-5 h-5 text-accent animate-pulse" /> : <Sparkles className="w-5 h-5 text-accent" />}
        </div>
        <div className="text-left">
          <div className="text-foreground font-medium">Generate new avatar</div>
          <div className="text-xs text-muted-foreground">Type a name/search first, or generate a camera-ready character instantly.</div>
        </div>
      </button>

      {tab === "saved" ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {filteredSaved.map(character => {
            const imageUrl = character.reference_image_urls?.[0] || "";
            const selected = selectedIds.includes(character.id);
            return (
              <button
                key={character.id}
                onClick={() => onSelect({ id: character.id, name: character.name, imageUrl, voiceId: character.voice_id || undefined, source: "saved" })}
                className={cn("group relative aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all bg-card", selected ? "border-accent shadow-[0_0_24px_hsl(var(--accent)/0.35)]" : "border-border hover:border-accent/40")}
              >
                {imageUrl ? <img src={imageUrl} alt={character.name} className="absolute inset-0 w-full h-full object-cover" loading="lazy" /> : <div className="absolute inset-0 flex items-center justify-center"><UserRound className="w-10 h-10 text-muted-foreground" /></div>}
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/10 to-transparent" />
                {selected && <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-accent flex items-center justify-center"><Check className="w-3.5 h-3.5 text-accent-foreground" /></div>}
                <div className="absolute bottom-2 left-2 right-2 text-left">
                  <div className="text-foreground text-[13px] font-medium leading-tight truncate">{character.name}</div>
                  <div className="text-muted-foreground text-[10px] uppercase tracking-wider truncate">saved character</div>
                </div>
              </button>
            );
          })}
          {!filteredSaved.length && (
            <div className="col-span-full rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No saved characters yet. Use the gallery or generate one.</div>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1 w-fit">
            {(["all", "female", "male"] as const).map(value => (
              <button key={value} onClick={() => setGender(value)} className={cn("px-3 h-8 rounded-lg text-xs font-mono uppercase tracking-wider transition-colors", gender === value ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}>{value}</button>
            ))}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-3 gap-3">{Array.from({ length: 9 }).map((_, i) => <div key={i} className="aspect-[3/4] rounded-xl bg-card animate-pulse" />)}</div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {visibleAvatars.map(avatar => {
                  const selected = selectedIds.includes(avatar.id);
                  const imageUrl = avatar.thumbnail_url || avatar.face_image_url;
                  return (
                    <button key={avatar.id} onClick={() => onSelect({ id: avatar.id, name: avatar.name, imageUrl, voiceId: avatar.voice_id, source: "library" })} className={cn("group relative aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all", selected ? "border-accent shadow-[0_0_24px_hsl(var(--accent)/0.35)]" : "border-border hover:border-accent/40")}>
                      <img src={imageUrl} alt={avatar.name} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/10 to-transparent" />
                      {selected && <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-accent flex items-center justify-center"><Check className="w-3.5 h-3.5 text-accent-foreground" /></div>}
                      <div className="absolute bottom-2 left-2 right-2 text-left">
                        <div className="text-foreground text-[13px] font-medium leading-tight truncate">{avatar.name}</div>
                        <div className="text-muted-foreground text-[10px] uppercase tracking-wider truncate">{avatar.style || avatar.gender}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {!isFullyLoaded && <button onClick={loadMore} className="w-full h-11 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-accent/40 transition-colors text-sm">Load more</button>}
            </>
          )}
        </>
      )}
    </div>
  );
}
