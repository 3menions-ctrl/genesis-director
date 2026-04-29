/**
 * EditorAvatarPanel — Browse avatar templates and generate character-driven clips
 */

import { memo, useState, useEffect, useCallback } from "react";
import { Users, Loader2, Sparkles, Film, Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCustomTimeline, generateClipId, generateTrackId } from "@/hooks/useCustomTimeline";

interface AvatarTemplate {
  id: string;
  name: string;
  gender: string;
  style: string | null;
  face_image_url: string;
  thumbnail_url: string | null;
  voice_id: string;
  voice_name: string | null;
  description: string | null;
  personality: string | null;
  tags: string[] | null;
}

export const EditorAvatarPanel = memo(function EditorAvatarPanel() {
  const { state, dispatch } = useCustomTimeline();
  const [avatars, setAvatars] = useState<AvatarTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarTemplate | null>(null);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Load avatar templates
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("avatar_templates")
        .select("id, name, gender, style, face_image_url, thumbnail_url, voice_id, voice_name, description, personality, tags")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .limit(50);

      if (!error && data) setAvatars(data);
      setLoading(false);
    })();
  }, []);

  const filtered = avatars.filter(a => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return a.name.toLowerCase().includes(q) || a.gender?.toLowerCase().includes(q) || (a.tags || []).some(t => t.toLowerCase().includes(q));
  });

  const handleGenerateWithAvatar = useCallback(async () => {
    if (!selectedAvatar || !prompt.trim()) {
      toast.error("Select an avatar and enter a scene description");
      return;
    }

    setIsGenerating(true);
    try {
      // Enhance prompt with AI
      const { data: aiResult } = await supabase.functions.invoke("editor-ai-scene", {
        body: {
          prompt: `Character: ${selectedAvatar.name} (${selectedAvatar.gender}, ${selectedAvatar.personality || "neutral personality"}). Scene: ${prompt}`,
          action: "generate-scene",
        },
      });

      const enhancedPrompt = aiResult?.enhancedPrompt || prompt;

      // Submit to Kling V3 with avatar face as start image
      const { data: genResult, error: genError } = await supabase.functions.invoke("editor-generate-clip", {
        body: {
          action: "submit",
          prompt: enhancedPrompt,
          duration: 10,
          startImageUrl: selectedAvatar.face_image_url,
          aspectRatio: state.aspectRatio === "9:16" ? "9:16" : "16:9",
        },
      });

      if (genError || !genResult?.success) {
        throw new Error(genResult?.error || "Failed to start generation");
      }

      toast.info(`Generating clip with ${selectedAvatar.name}… (${genResult.creditsCharged} credits)`);

      // Poll for completion
      const pollInterval = setInterval(async () => {
        const { data } = await supabase.functions.invoke("editor-generate-clip", {
          body: { action: "status", predictionId: genResult.predictionId },
        });

        if (data?.status === "completed" && data.videoUrl) {
          clearInterval(pollInterval);
          
          // Add to timeline
          let videoTrack = state.tracks.find(t => t.type === "video");
          const trackId = videoTrack?.id || generateTrackId();
          if (!videoTrack) {
            dispatch({ type: "ADD_TRACK", track: { id: trackId, type: "video", label: "Video 1", clips: [], muted: false, locked: false } });
          }
          const lastEnd = videoTrack?.clips.length ? Math.max(...videoTrack.clips.map(c => c.end)) : 0;
          dispatch({
            type: "ADD_CLIP",
            trackId: videoTrack?.id || trackId,
            clip: {
              id: generateClipId(), type: "video",
              name: `${selectedAvatar.name}: ${prompt.slice(0, 20)}…`,
              start: lastEnd, end: lastEnd + 10,
              trimStart: 0, trimEnd: 10,
              src: data.videoUrl, volume: 1, speed: 1, opacity: 1,
              thumbnail: selectedAvatar.thumbnail_url || selectedAvatar.face_image_url,
            },
          });

          toast.success(`${selectedAvatar.name} clip added to timeline!`);
          setIsGenerating(false);
          setPrompt("");
        } else if (data?.status === "failed") {
          clearInterval(pollInterval);
          setIsGenerating(false);
          toast.error("Generation failed");
        }
      }, 5000);

    } catch (err: any) {
      setIsGenerating(false);
      toast.error(err.message || "Failed to generate");
    }
  }, [selectedAvatar, prompt, state, dispatch]);

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "hsla(215, 100%, 60%, 0.15)" }}>
              <Users className="w-3.5 h-3.5 text-[hsl(215,100%,75%)]" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-[hsl(0,0%,85%)] block leading-none">Avatar Characters</span>
              <span className="text-[9px] text-[hsl(0,0%,45%)]">Generate clips with AI characters</span>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[hsl(0,0%,35%)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search avatars…"
              className="w-full h-7 text-[10px] bg-[hsla(0,0%,100%,0.04)] border border-[hsla(0,0%,100%,0.08)] rounded-lg pl-7 pr-2 text-[hsl(0,0%,85%)] placeholder:text-[hsl(0,0%,35%)] outline-none focus:border-[hsla(215,80%,60%,0.4)]"
            />
          </div>

          {/* Avatar grid */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-4 h-4 animate-spin text-[hsl(0,0%,40%)]" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-[10px] text-[hsl(0,0%,40%)] text-center py-6">No avatars found</p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {filtered.map((avatar) => (
                <button
                  key={avatar.id}
                  onClick={() => setSelectedAvatar(selectedAvatar?.id === avatar.id ? null : avatar)}
                  className={cn(
                    "rounded-xl overflow-hidden border transition-all group relative",
                    selectedAvatar?.id === avatar.id
                      ? "border-[hsla(215,80%,60%,0.5)] ring-1 ring-[hsla(215,80%,60%,0.3)]"
                      : "border-[hsla(0,0%,100%,0.06)] hover:border-[hsla(215,80%,60%,0.2)]"
                  )}
                >
                  <div className="aspect-square bg-[hsla(0,0%,100%,0.03)]">
                    <img
                      src={avatar.thumbnail_url || avatar.face_image_url}
                      alt={avatar.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="px-1.5 py-1 bg-[hsla(0,0%,0%,0.6)]">
                    <span className="text-[8px] font-bold text-[hsl(0,0%,85%)] block truncate">{avatar.name}</span>
                    <span className="text-[7px] text-[hsl(0,0%,50%)]">{avatar.gender}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Selected avatar + prompt */}
          {selectedAvatar && (
            <div className="space-y-2 pt-2 border-t border-[hsla(0,0%,100%,0.06)]">
              <div className="flex items-center gap-2">
                <img src={selectedAvatar.thumbnail_url || selectedAvatar.face_image_url} className="w-8 h-8 rounded-lg object-cover" alt="" />
                <div>
                  <span className="text-[10px] font-bold text-[hsl(0,0%,85%)]">{selectedAvatar.name}</span>
                  {selectedAvatar.personality && (
                    <span className="text-[8px] text-[hsl(0,0%,45%)] block">{selectedAvatar.personality}</span>
                  )}
                </div>
              </div>

              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isGenerating}
                placeholder={`What should ${selectedAvatar.name} do in this scene?`}
                className="w-full h-16 text-[10px] bg-[hsla(0,0%,100%,0.04)] border border-[hsla(0,0%,100%,0.08)] rounded-xl px-3 py-2 resize-none text-[hsl(0,0%,85%)] placeholder:text-[hsl(0,0%,35%)] outline-none focus:border-[hsla(215,80%,60%,0.4)] disabled:opacity-40"
              />

              <button
                onClick={handleGenerateWithAvatar}
                disabled={isGenerating || !prompt.trim()}
                className={cn(
                  "w-full h-8 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all",
                  isGenerating
                    ? "bg-[hsla(215,100%,60%,0.15)] text-[hsl(215,100%,75%)] cursor-wait"
                    : prompt.trim()
                    ? "bg-[hsl(215,100%,60%)] text-white hover:bg-[hsl(215,100%,65%)]"
                    : "bg-[hsla(0,0%,100%,0.06)] text-[hsl(0,0%,40%)] cursor-not-allowed"
                )}
              >
                {isGenerating ? (
                  <><Loader2 className="w-3 h-3 animate-spin" /> Generating…</>
                ) : (
                  <><Film className="w-3 h-3" /> Generate with {selectedAvatar.name}</>
                )}
              </button>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
});
