/**
 * ReactionRail — record + display 5-second video reactions on a reel.
 *
 * Visible below the Theater hero. Each circle is a stitched reaction —
 * tap to play it inline as an overlay; the parent video pauses while the
 * reaction plays. The leftmost slot is "Add yours" — clicking opens the
 * recorder modal which captures a 5-second clip via MediaRecorder + uploads
 * it to Supabase storage, then inserts a `reel_reactions` row.
 *
 * Graceful degradation: if the storage bucket doesn't exist or the user
 * declines camera permission, we fall back to a friendly message — never
 * crash the Theater.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Plus, Video, X, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSafeNavigation } from "@/lib/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Reaction {
  id: string;
  reel_id: string;
  reactor_id: string;
  reaction_url: string;
  created_at: string;
  reactor_name?: string | null;
  reactor_avatar?: string | null;
}

interface Props {
  reelId: string;
}

const RECORD_MS = 5000;
const STORAGE_BUCKET = "reactions";

export function ReactionRail({ reelId }: Props) {
  const { user } = useAuth();
  const { navigate } = useSafeNavigation();
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [playing, setPlaying] = useState<Reaction | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: rows } = await supabase
        .from("reel_reactions")
        .select("id, reel_id, reactor_id, reaction_url, created_at")
        .eq("reel_id", reelId)
        .order("created_at", { ascending: false })
        .limit(24);
      const list = (rows ?? []) as Reaction[];
      // Hydrate reactor names + avatars.
      const ids = Array.from(new Set(list.map((r) => r.reactor_id)));
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, display_name, full_name, avatar_url")
          .in("id", ids);
        const map = new Map((profs ?? []).map((p: { id: string }) => [p.id, p as { id: string; display_name?: string | null; full_name?: string | null; avatar_url?: string | null }]));
        list.forEach((r) => {
          const p = map.get(r.reactor_id);
          r.reactor_name = p?.display_name ?? p?.full_name ?? null;
          r.reactor_avatar = p?.avatar_url ?? null;
        });
      }
      setReactions(list);
    } catch (e) {
      console.warn("[ReactionRail] load failed", e);
    } finally {
      setLoading(false);
    }
  }, [reelId]);

  useEffect(() => { void load(); }, [load]);

  const onRecorded = (newReaction: Reaction) => {
    setReactions((prev) => [newReaction, ...prev]);
    setRecorderOpen(false);
    toast.success("Reaction posted");
  };

  return (
    <section className="mb-10">
      <div className="flex items-center gap-3 mb-4">
        <Video className="w-3.5 h-3.5 text-primary/80" />
        <span className="text-[11px] font-mono uppercase tracking-[0.32em] text-foreground/65">Video reactions</span>
        <div className="h-px flex-1 bg-gradient-to-r from-white/[0.07] to-transparent" />
        <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/50">
          {loading ? "loading" : `${reactions.length} stitched`}
        </span>
      </div>

      <div className="flex items-start gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        <button
          type="button"
          onClick={() => user ? setRecorderOpen(true) : navigate("/auth")}
          className="group shrink-0 w-20 flex flex-col items-center gap-1.5"
        >
          <div
            className="relative w-16 h-16 rounded-full border-2 border-dashed border-white/15 group-hover:border-primary/60 flex items-center justify-center transition-colors"
            style={{
              background: "radial-gradient(closest-side, hsla(215,100%,60%,0.10), transparent)",
            }}
          >
            <Plus className="w-5 h-5 text-foreground/55 group-hover:text-primary transition-colors" />
          </div>
          <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-foreground/55 group-hover:text-foreground transition-colors">
            Add yours
          </span>
        </button>

        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="shrink-0 w-20 flex flex-col items-center gap-1.5">
                <div className="w-16 h-16 rounded-full bg-white/[0.04] animate-pulse" />
                <div className="h-2 w-12 bg-white/[0.04] rounded animate-pulse" />
              </div>
            ))
          : reactions.map((r) => (
              <button
                key={r.id}
                onClick={() => setPlaying(r)}
                className="shrink-0 w-20 flex flex-col items-center gap-1.5 group"
              >
                <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-white/15 group-hover:border-primary/60 transition-colors">
                  {r.reactor_avatar ? (
                    <img src={r.reactor_avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-white/[0.05] to-white/[0.01] flex items-center justify-center text-white/55 font-mono text-[14px]">
                      {(r.reactor_name?.[0] || "?").toUpperCase()}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                </div>
                <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-foreground/65 truncate w-20 text-center">
                  {r.reactor_name ?? "Anon"}
                </span>
              </button>
            ))}
      </div>

      {/* Recorder modal */}
      <AnimatePresence>
        {recorderOpen && (
          <ReactionRecorder
            reelId={reelId}
            onCancel={() => setRecorderOpen(false)}
            onRecorded={onRecorded}
          />
        )}
      </AnimatePresence>

      {/* Inline playback overlay */}
      <AnimatePresence>
        {playing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-md p-6"
            onClick={() => setPlaying(null)}
          >
            <button
              onClick={() => setPlaying(null)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full border border-white/[0.10] hover:border-white/30 text-white/55 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div
              className="relative max-w-md w-full rounded-3xl overflow-hidden border border-white/[0.10] bg-black"
              onClick={(e) => e.stopPropagation()}
            >
              <video
                src={playing.reaction_url}
                autoPlay
                playsInline
                onEnded={() => setPlaying(null)}
                className="w-full aspect-[3/4] object-cover"
              />
              <div className="absolute bottom-3 left-3 right-3 text-[11px] font-mono uppercase tracking-[0.22em] text-white/85">
                {playing.reactor_name ?? "Anonymous"}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Recorder
// ──────────────────────────────────────────────────────────────────────────

interface RecorderProps {
  reelId: string;
  onCancel: () => void;
  onRecorded: (r: Reaction) => void;
}

function ReactionRecorder({ reelId, onCancel, onRecorded }: RecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [phase, setPhase] = useState<"ready" | "recording" | "previewing" | "uploading">("ready");
  const [secondsLeft, setSecondsLeft] = useState(RECORD_MS / 1000);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Acquire camera + mic on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 960 } },
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Camera permission denied");
        }
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      setPreviewUrl(URL.createObjectURL(blob));
      setPhase("previewing");
    };
    recorder.start();
    setPhase("recording");
    setSecondsLeft(RECORD_MS / 1000);

    const interval = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    setTimeout(() => {
      clearInterval(interval);
      if (recorder.state !== "inactive") recorder.stop();
    }, RECORD_MS);
  };

  const upload = async () => {
    if (chunksRef.current.length === 0) return;
    setPhase("uploading");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in to post a reaction");
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const path = `${user.id}/${reelId}/${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(path, blob, {
        contentType: "video/webm",
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      const reaction_url = urlData.publicUrl;

      const { data: row, error: insertErr } = await supabase
        .from("reel_reactions")
        .insert({ reel_id: reelId, reactor_id: user.id, reaction_url })
        .select("id, reel_id, reactor_id, reaction_url, created_at")
        .maybeSingle();
      if (insertErr) throw insertErr;
      onRecorded(row as Reaction);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setPhase("previewing");
    }
  };

  const retake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPhase("ready");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/85 backdrop-blur-md p-6"
    >
      <button
        onClick={onCancel}
        className="absolute top-4 right-4 w-9 h-9 rounded-full border border-white/[0.10] hover:border-white/30 text-white/55 hover:text-white flex items-center justify-center transition-colors"
        aria-label="Close recorder"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="relative w-full max-w-md">
        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-2 mb-3 text-[10px] font-mono uppercase tracking-[0.32em] text-primary/90">
            <Sparkles className="w-3 h-3" /> Record a 5-second reaction
          </div>
          <h3 className="font-display font-medium text-[clamp(1.4rem,3vw,2rem)] leading-tight tracking-[-0.02em] text-foreground">
            Show your face, not your text.
          </h3>
        </div>

        <div className="relative rounded-3xl overflow-hidden border border-white/[0.10] bg-black aspect-[3/4]">
          {error ? (
            <div className="absolute inset-0 flex items-center justify-center text-center p-6 text-white/65">
              <div>
                <Mic className="w-7 h-7 mx-auto mb-3 text-rose-300" />
                <div className="text-[13px] mb-1">Couldn't access your camera</div>
                <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-rose-200/80">{error}</div>
              </div>
            </div>
          ) : phase === "previewing" && previewUrl ? (
            <video src={previewUrl} autoPlay loop className="w-full h-full object-cover" />
          ) : (
            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
          )}

          {phase === "recording" && (
            <div className="absolute top-3 left-3 inline-flex items-center gap-2 px-2.5 h-7 rounded-full bg-rose-500/85 text-white text-[10px] font-mono uppercase tracking-[0.28em]">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              {secondsLeft}s
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-center gap-3">
          {phase === "ready" && !error && (
            <button
              onClick={startRecording}
              className={cn(
                "inline-flex items-center gap-2 h-11 px-6 rounded-full text-[11px] font-mono uppercase tracking-[0.22em] text-foreground",
              )}
              style={{
                background: "linear-gradient(180deg, hsla(215,100%,60%,0.22) 0%, hsla(215,100%,55%,0.10) 100%)",
                boxShadow: "0 0 20px hsla(215,100%,60%,0.30), inset 0 1px 0 hsla(0,0%,100%,0.10)",
              }}
            >
              <Video className="w-3.5 h-3.5 text-[hsl(215,100%,75%)]" />
              Start recording
            </button>
          )}
          {phase === "recording" && (
            <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
              Auto-stops in {secondsLeft}s
            </div>
          )}
          {phase === "previewing" && (
            <>
              <button
                onClick={retake}
                className="inline-flex items-center gap-2 h-11 px-5 rounded-full border border-white/[0.10] hover:border-white/30 text-foreground/75 hover:text-foreground text-[11px] font-mono uppercase tracking-[0.22em]"
              >
                Retake
              </button>
              <button
                onClick={upload}
                className="inline-flex items-center gap-2 h-11 px-6 rounded-full text-[11px] font-mono uppercase tracking-[0.22em] text-foreground"
                style={{
                  background: "linear-gradient(180deg, hsla(215,100%,60%,0.22) 0%, hsla(215,100%,55%,0.10) 100%)",
                  boxShadow: "0 0 20px hsla(215,100%,60%,0.30), inset 0 1px 0 hsla(0,0%,100%,0.10)",
                }}
              >
                Post reaction
              </button>
            </>
          )}
          {phase === "uploading" && (
            <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-foreground/85 animate-pulse">
              Uploading…
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
