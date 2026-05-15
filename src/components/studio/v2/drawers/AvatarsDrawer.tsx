import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Mic2, Search, Sparkles, UserRound, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAvatarTemplatesQuery } from "@/hooks/useAvatarTemplatesQuery";
import { useChunkedAvatars } from "@/hooks/useChunkedAvatars";
import { AVATAR_CATEGORIES, type AvatarTemplate } from "@/types/avatar-templates";
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
  casting?: { face_image_url: string }[];
}

interface CastingRow {
  id: string;
  character_id: string | null;
  face_image_url: string;
}

const GENDERS = ["all", "female", "male"] as const;

export function AvatarsDrawerContent({ onSelect, selectedIds, onClose }: Props) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"saved" | "gallery">("gallery");
  const [gender, setGender] = useState<(typeof GENDERS)[number]>("all");
  const [category, setCategory] = useState("all");
  const [saved, setSaved] = useState<SavedCharacterRow[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { templates = [], allTemplates = [], isLoading } = useAvatarTemplatesQuery({
    gender,
    categoryId: category,
    search: q,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: characters } = await supabase
          .from("characters")
          .select("id,name,description,voice_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(80);

        const ids = ((characters as SavedCharacterRow[]) || []).map((character) => character.id);
        let castingsByCharacter = new Map<string, { face_image_url: string }[]>();

        if (ids.length) {
          const { data: castings } = await supabase
            .from("genesis_character_castings")
            .select("id,character_id,face_image_url")
            .in("character_id", ids)
            .order("created_at", { ascending: false });

          for (const casting of ((castings as CastingRow[]) || [])) {
            if (!casting.character_id) continue;
            const list = castingsByCharacter.get(casting.character_id) || [];
            list.push({ face_image_url: casting.face_image_url });
            castingsByCharacter.set(casting.character_id, list);
          }
        }

        const hydrated = ((characters as SavedCharacterRow[]) || []).map((character) => ({
          ...character,
          casting: castingsByCharacter.get(character.id) || [],
        }));

        if (!cancelled) {
          setSaved(hydrated);
          if (hydrated.length > 0) setTab("saved");
        }
      } finally {
        if (!cancelled) setSavedLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredSaved = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return saved;
    return saved.filter((character) => `${character.name} ${character.description || ""}`.toLowerCase().includes(needle));
  }, [saved, q]);

  const { visibleAvatars, isFullyLoaded, loadMore, totalCount } = useChunkedAvatars(templates, {
    initialSize: 36,
    chunkSize: 24,
    chunkDelay: 120,
  });

  const playVoicePreview = useCallback(async (avatar: AvatarTemplate) => {
    if (!avatar.voice_id) {
      toast.error("No voice attached to this avatar");
      return;
    }

    audioRef.current?.pause();
    setPreviewingVoice(avatar.id);
    try {
      const { data, error } = await supabase.functions.invoke("generate-voice", {
        body: {
          text: `Hello, I'm ${avatar.name}. I'm ready for your next scene.`,
          voiceId: avatar.voice_id,
        },
      });
      if (error) throw error;
      const audioUrl = (data as any)?.audioUrl || (data as any)?.url;
      if (!audioUrl) throw new Error("Voice preview unavailable");
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.play().catch(() => undefined);
    } catch (error: any) {
      toast.error(error?.message || "Voice preview failed");
    } finally {
      setPreviewingVoice(null);
    }
  }, []);

  const generateQuickAvatar = async () => {
    setGenerating(true);
    try {
      const name = q.trim() || `Studio Avatar ${saved.length + selectedIds.length + 1}`;
      const { data, error } = await supabase.functions.invoke("generate-avatar-image", {
        body: {
          name,
          gender: gender === "all" ? "female" : gender,
          ageRange: "adult",
          ethnicity: "diverse",
          style: "cinematic realistic",
          personality: "confident, expressive, camera-ready",
          clothing: "premium modern studio wardrobe",
          generateAllViews: false,
        },
      });
      if (error) throw error;
      const url = (data as any)?.frontImageUrl || (data as any)?.faceImageUrl;
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

  const addTemplateAvatar = (avatar: AvatarTemplate) => {
    onSelect({
      id: avatar.id,
      name: avatar.name,
      imageUrl: avatar.front_image_url || avatar.face_image_url || avatar.thumbnail_url || "",
      voiceId: avatar.voice_id,
      source: "library",
    });
    toast.success(`${avatar.name} added to cast`);
  };

  return (
    <div className="space-y-5 p-7">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search saved characters and the avatar library…"
            className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-accent/50"
          />
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1">
          {(["saved", "gallery"] as const).map((value) => (
            <button key={value} onClick={() => setTab(value)} className={cn("h-9 rounded-lg px-3 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors", tab === value ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}>
              {value === "saved" ? `Saved ${saved.length ? `(${saved.length})` : ""}` : `Gallery ${allTemplates.length ? `(${allTemplates.length})` : ""}`}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_230px]">
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 premium-scroll">
          {AVATAR_CATEGORIES.map((item) => (
            <button key={item.id} onClick={() => { setCategory(item.id); setTab("gallery"); }} className={cn("h-9 whitespace-nowrap rounded-lg px-3 text-xs transition-colors", category === item.id && tab === "gallery" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}>
              <span className="mr-1">{item.icon}</span>{item.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1">
          {GENDERS.map((value) => (
            <button key={value} onClick={() => { setGender(value); setTab("gallery"); }} className={cn("h-9 flex-1 rounded-lg font-mono text-[10px] uppercase tracking-[0.14em] transition-colors", gender === value && tab === "gallery" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}>{value}</button>
          ))}
        </div>
      </div>

      {tab === "saved" ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {savedLoading ? Array.from({ length: 8 }).map((_, index) => <div key={index} className="aspect-[3/4] animate-pulse rounded-xl bg-card" />) : filteredSaved.map((character) => {
            const imageUrl = character.casting?.[0]?.face_image_url || "";
            const selected = selectedIds.includes(character.id);
            return (
              <AvatarCard
                key={character.id}
                name={character.name}
                subtitle="Saved character"
                imageUrl={imageUrl}
                selected={selected}
                fallbackIcon={<UserRound className="h-10 w-10 text-muted-foreground" />}
                onClick={() => {
                  onSelect({ id: character.id, name: character.name, imageUrl, voiceId: character.voice_id || undefined, source: "saved" });
                  toast.success(`${character.name} added to cast`);
                }}
              />
            );
          })}
          {!savedLoading && !filteredSaved.length && (
            <button onClick={() => setTab("gallery")} className="col-span-full rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground hover:border-accent/50">No saved characters found. Open the avatar gallery.</button>
          )}
        </div>
      ) : (
        <>
          <button
            onClick={generateQuickAvatar}
            disabled={generating}
            className="flex w-full items-center gap-4 rounded-xl border border-accent/30 bg-accent/10 p-4 text-left transition-all hover:bg-accent/15 disabled:opacity-50"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/20">
              {generating ? <Loader2 className="h-5 w-5 animate-spin text-accent" /> : <Sparkles className="h-5 w-5 text-accent" />}
            </div>
            <div>
              <div className="font-medium text-foreground">Generate a new avatar</div>
              <div className="text-xs text-muted-foreground">Use the search text as the character name, then add it directly to cast.</div>
            </div>
          </button>

          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 12 }).map((_, i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-card" />)}</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                {visibleAvatars.map((avatar) => {
                  const selected = selectedIds.includes(avatar.id);
                  const imageUrl = avatar.front_image_url || avatar.face_image_url || avatar.thumbnail_url || "";
                  return (
                    <AvatarCard
                      key={avatar.id}
                      name={avatar.name}
                      subtitle={avatar.style || avatar.voice_name || avatar.gender}
                      imageUrl={imageUrl}
                      selected={selected}
                      premium={Boolean(avatar.is_premium)}
                      onClick={() => addTemplateAvatar(avatar)}
                      voiceButton={avatar.voice_id ? (
                        <button
                          onClick={(event) => { event.stopPropagation(); playVoicePreview(avatar); }}
                          className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur hover:bg-accent hover:text-accent-foreground"
                          aria-label={`Preview ${avatar.name} voice`}
                        >
                          {previewingVoice === avatar.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
                        </button>
                      ) : undefined}
                    />
                  );
                })}
              </div>
              {!visibleAvatars.length && <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No avatars match that filter.</div>}
              {!isFullyLoaded && <button onClick={loadMore} className="h-11 w-full rounded-xl border border-border text-sm text-muted-foreground transition-colors hover:border-accent/40 hover:text-foreground">Load more avatars ({visibleAvatars.length}/{totalCount})</button>}
            </>
          )}
        </>
      )}
    </div>
  );
}

function AvatarCard({
  name,
  subtitle,
  imageUrl,
  selected,
  premium,
  fallbackIcon,
  voiceButton,
  onClick,
}: {
  name: string;
  subtitle?: string | null;
  imageUrl?: string;
  selected?: boolean;
  premium?: boolean;
  fallbackIcon?: React.ReactNode;
  voiceButton?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn("group relative aspect-[3/4] overflow-hidden rounded-xl border-2 bg-card text-left transition-all", selected ? "border-accent shadow-[0_0_24px_hsl(var(--accent)/0.35)]" : "border-border hover:border-accent/40")}
    >
      {imageUrl ? (
        <img src={imageUrl} alt={name} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">{fallbackIcon || <UserRound className="h-10 w-10 text-muted-foreground" />}</div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/10 to-transparent" />
      {premium && <div className="absolute left-2 top-2 rounded-full bg-accent px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-accent-foreground">Pro</div>}
      {selected && <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-accent"><Check className="h-3.5 w-3.5 text-accent-foreground" /></div>}
      {voiceButton}
      <div className="absolute bottom-2 left-2 right-12">
        <div className="truncate text-[13px] font-medium leading-tight text-foreground">{name}</div>
        {subtitle && <div className="mt-1 flex items-center gap-1 truncate text-[10px] uppercase tracking-wider text-muted-foreground"><Mic2 className="h-3 w-3 text-accent" /> {subtitle}</div>}
      </div>
    </button>
  );
}
