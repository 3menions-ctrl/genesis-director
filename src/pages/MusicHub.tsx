/**
 * Music — /music
 *
 * Audio-first parallel creation surface. Sits alongside Studio as a
 * standalone destination on Foundation. Score · Mix · Master ·
 * Music — every prompt-to-soundtrack workflow lives here.
 *
 * Composed in the canonical Foundation room:
 *   FoundationShell + EditorialCanvas + SpineBackdrop atmosphere.
 * Inside the canvas, the existing StudioHero + StudioTabs primitives
 * provide the page-level hero + tab control (kept verbatim — they're
 * effectively content, not chrome).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Music2, Piano, Play, Calendar, Drum, Headphones,
  Sparkles, Flame, UploadCloud, Download, Trash2, FileMusic,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSafeNavigation } from "@/lib/navigation";
import { StudioHero } from "@/components/studio/StudioHero";
import { StudioTabs } from "@/components/studio/StudioTabs";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";
import { useMediaLibrary, type MediaAsset } from "@/hooks/useMediaLibrary";
import { validateUploadFile, describeIngestError } from "@/lib/editor/upload-ingest";
import { FoundationShell } from "@/components/foundation/FoundationShell";
import { EditorialCanvas } from "@/components/foundation/EditorialCanvas";
import { useLiveRenderTimecode } from "@/hooks/useLiveRenderTimecode";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MusicReel {
  id: string;
  title: string;
  thumbnail_url: string | null;
  video_url: string;
  play_count: number;
  like_count: number;
  creator_name: string | null;
  creator_avatar: string | null;
}

interface DailyPrompt {
  prompt: { id: string; prompt_text: string; prompt_hint: string | null; prompt_date: string };
  top_submissions: Array<{ reel_id: string; title: string; thumbnail_url: string | null; votes: number }>;
}

const DEMO_REELS: MusicReel[] = [
  {
    id: "demo-mv-1", title: "Cassia · Lemon, neon, three breaths",
    thumbnail_url: "https://images.unsplash.com/photo-1571330735066-03aaa9429d89?auto=format&fit=crop&w=1200&q=80",
    video_url: "", play_count: 3245, like_count: 620, creator_name: "Cassia Roe", creator_avatar: null,
  },
  {
    id: "demo-mv-2", title: "Iko Marvell — bell tones, dial up",
    thumbnail_url: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=80",
    video_url: "", play_count: 2018, like_count: 312, creator_name: "Iko Marvell", creator_avatar: null,
  },
  {
    id: "demo-mv-3", title: "Strings for the slow reveal",
    thumbnail_url: "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=1200&q=80",
    video_url: "", play_count: 1190, like_count: 198, creator_name: "Vela Reyes", creator_avatar: null,
  },
];

type TabKey = "all" | "videos" | "scores" | "mine";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "all",      label: "All",          icon: Flame },
  { key: "videos",   label: "Music videos", icon: Play },
  { key: "scores",   label: "Score Studio", icon: Piano },
  { key: "mine",     label: "My tracks",    icon: FileMusic },
];

export default function MusicHub() {
  usePageMeta({ title: "Music — Small Bridges", description: "Score Studio, Daily Beat." });
  const { user } = useAuth();
  const { navigate } = useSafeNavigation();
  const [reels, setReels] = useState<MusicReel[]>([]);
  const [usingDemo, setUsingDemo] = useState(false);
  const [prompt, setPrompt] = useState<DailyPrompt | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [feedRes, promptRes] = await Promise.all([
        supabase.rpc("lobby_feed" as never, { p_world_slug: "music", p_cursor: null, p_limit: 12 } as never),
        supabase.rpc("current_daily_prompt" as never),
      ]);
      const feedData = (feedRes as { data?: unknown }).data as MusicReel[] | null;
      if (!feedData || feedData.length === 0) {
        setReels(DEMO_REELS); setUsingDemo(true);
      } else {
        setReels(feedData); setUsingDemo(false);
      }
      const promptData = (promptRes as { data?: unknown }).data;
      if (promptData) setPrompt(promptData as DailyPrompt);
    } catch (e) {
      console.warn("[Music] DB unreachable, using demo", e);
      setReels(DEMO_REELS); setUsingDemo(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const [scoreOpen, setScoreOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const openStudio = (kind: "score" | "beat") => {
    if (!user) { navigate("/auth"); return; }
    // Score Studio is a real in-page generator. Other rooms still hand off
    // to /create (with a sessionStorage intent so the right composer opens).
    if (kind === "score") {
      setScoreOpen(true);
      return;
    }
    try { sessionStorage.setItem('smallbridges.studio_intent', kind); } catch {}
    navigate("/create");
  };

  const liveRenderTimecode = useLiveRenderTimecode();

  return (
    <FoundationShell>
      <div className="relative mx-auto w-full max-w-[1440px] px-4 pb-24 pt-10 sm:px-6 lg:px-10">
        <EditorialCanvas
          maxWidth="100%"
          chrome={{
            crumbs: ["Small Bridges", "music"],
            timecode: liveRenderTimecode ?? `${reels.length} REELS · LIVE`,
          }}
        >
        <StudioHero
          eyebrow="Tonight"
          title="Score"
          accent="the room."
          subtitle="Generate a soundtrack from a prompt. Build on today's beat. Sing the chorus. Every score lives in the market the moment you ship it."
          status={["Compose", "Mix", "Master"]}
          subhead={usingDemo ? "Sample music videos" : `${reels.length} reels`}
        >
          <StudioTabs items={TABS} value={tab} onChange={(k) => setTab(k as TabKey)} layoutId="music-tab" />
        </StudioHero>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            {(tab === "all" || tab === "scores") && (
              <StudioGrid openStudio={openStudio} />
            )}

            {(tab === "all" || tab === "mine") && (
              <MyTracksPanel
                signedIn={!!user}
                onUpload={() => { if (!user) { navigate("/auth"); return; } setUploadOpen(true); }}
                onSignIn={() => navigate("/auth")}
              />
            )}
            {(tab === "all" || tab === "scores") && (
              <DailyBeatCard
                promptText={prompt?.prompt.prompt_text ?? "A 2-bar loop that suggests morning fog."}
                promptHint={prompt?.prompt.prompt_hint ?? "Build your track around it before midnight. Top picks land on the wall tomorrow."}
                onBuild={() => openStudio("beat")}
              />
            )}

            {(tab === "all" || tab === "videos") && (
              <>
                <SectionLabel label="Music videos · trending" icon={Flame} meta={loading ? "loading" : `${reels.length} reels`} />
                {loading ? (
                  <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
                    <Spinner size="md" tone="muted" />
                    <span className="text-[12px] font-mono uppercase tracking-[0.22em]">Cueing the floor…</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
                    {reels.map((r) => <MusicVideoCard key={r.id} reel={r} demo={usingDemo} />)}
                  </div>
                )}
              </>
            )}

          </motion.div>
        </AnimatePresence>

        </EditorialCanvas>
      </div>
      <ScoreStudioDialog open={scoreOpen} onClose={() => setScoreOpen(false)} />
      <UploadTrackDialog open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </FoundationShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MyTracksPanel — the user's own uploaded + generated audio library. Closes
// the long-standing gap where music was display-only: directors can now bring
// their own downloaded tracks into the app and keep them in one place.
// ─────────────────────────────────────────────────────────────────────────────
function MyTracksPanel({
  signedIn, onUpload, onSignIn,
}: { signedIn: boolean; onUpload: () => void; onSignIn: () => void }) {
  const { assets, loading, remove } = useMediaLibrary({ mediaType: "audio", limit: 60 });

  return (
    <section className="mb-12">
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <SectionLabel label="My tracks" icon={FileMusic} meta={signedIn ? `${assets.length} saved` : undefined} />
        <button
          onClick={onUpload}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-accent/90 hover:bg-accent text-black text-[11px] font-mono uppercase tracking-[0.22em] shrink-0"
        >
          <UploadCloud className="w-3.5 h-3.5" /> Upload track
        </button>
      </div>

      {!signedIn ? (
        <div className="text-center py-12 max-w-md mx-auto">
          <FileMusic className="w-6 h-6 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground text-[13px] mb-5">Sign in to upload your own music and build a personal track library.</p>
          <button onClick={onSignIn} className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-white/[0.07] hover:bg-white/[0.12] text-[11px] font-mono uppercase tracking-[0.22em] text-foreground">
            Sign in
          </button>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
          <Spinner size="md" tone="muted" />
          <span className="text-[12px] font-mono uppercase tracking-[0.22em]">Loading your tracks…</span>
        </div>
      ) : assets.length === 0 ? (
        <div className="text-center py-12 max-w-md mx-auto rounded-2xl bg-white/[0.03] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
          <FileMusic className="w-6 h-6 mx-auto mb-3 text-muted-foreground" />
          <h3 className="font-display italic text-[20px] font-light text-foreground mb-2" style={{ fontFamily: "'Fraunces', serif" }}>No tracks yet.</h3>
          <p className="text-muted-foreground text-[13px] mb-5">Upload music you've downloaded or made elsewhere — MP3, WAV, M4A, FLAC. It'll live here for use across your projects.</p>
          <button onClick={onUpload} className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-accent/90 hover:bg-accent text-black text-[11px] font-mono uppercase tracking-[0.22em]">
            <UploadCloud className="w-3.5 h-3.5" /> Upload your first track
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {assets.map((a) => <TrackRow key={a.id} asset={a} onRemove={remove} />)}
        </div>
      )}
    </section>
  );
}

function fmtDuration(sec: number | null): string {
  if (!sec || !isFinite(sec)) return "";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Every track gets a cover. If the asset carries one we use it; otherwise we
// derive a deterministic two-tone gradient from the title so each track has a
// distinct, stable cover instead of a blank tile.
function coverGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  const h2 = (h + 42) % 360;
  return `linear-gradient(135deg, hsl(${h} 68% 26%) 0%, hsl(${h2} 60% 13%) 100%)`;
}

function TrackRow({ asset, onRemove }: { asset: MediaAsset; onRemove: (id: string) => Promise<void> }) {
  const [removing, setRemoving] = useState(false);
  const title = asset.title || asset.prompt || "Untitled track";
  const isUpload = asset.source === "upload";

  const del = async () => {
    setRemoving(true);
    try { await onRemove(asset.id); toast.success("Track removed"); }
    catch { toast.error("Could not remove track"); setRemoving(false); }
  };

  const cover = (asset as MediaAsset & { thumbnail_url?: string | null; cover_url?: string | null }).thumbnail_url
    || (asset as MediaAsset & { cover_url?: string | null }).cover_url || null;
  return (
    <div className="rounded-2xl bg-white/[0.04] hover:bg-white/[0.07] backdrop-blur-md p-4 transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="flex items-center gap-3 mb-3">
        {/* Cover — real artwork if present, else a deterministic gradient. */}
        <div
          className="w-12 h-12 rounded-xl overflow-hidden shrink-0 flex items-center justify-center text-white/85 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
          style={cover ? undefined : { background: coverGradient(title) }}
        >
          {cover ? (
            <img src={cover} alt="" className="w-full h-full object-cover" />
          ) : (
            <Music2 className="w-4 h-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] text-foreground truncate">{title}</div>
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/55 flex items-center gap-2">
            <span>{isUpload ? "Uploaded" : (asset.source ?? "Generated")}</span>
            {asset.duration_seconds ? <span>· {fmtDuration(asset.duration_seconds)}</span> : null}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <a
            href={asset.asset_url}
            target="_blank"
            rel="noreferrer"
            download
            aria-label="Download track"
            className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-foreground/55 hover:text-foreground flex items-center justify-center transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={del}
            disabled={removing}
            aria-label="Delete track"
            className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-[hsl(350_80%_55%/0.16)] text-foreground/55 hover:text-rose-200 flex items-center justify-center transition-colors disabled:opacity-50"
          >
            {removing ? <Spinner size="sm" tone="muted" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      <audio src={asset.asset_url} controls preload="none" className="w-full h-9" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UploadTrackDialog — bring your own audio into the app. Validates +
// probes duration in-browser, uploads to the public video-clips bucket
// (owner-scoped path), and registers it in the unified media library so
// it shows up in "My tracks" and the Editor's media panel.
// ─────────────────────────────────────────────────────────────────────────────
function UploadTrackDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => { setFile(null); setTitle(""); setBusy(false); };
  const close = () => { if (busy) return; reset(); onClose(); };

  const pick = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("audio/")) { toast.error("Please choose an audio file."); return; }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[a-zA-Z0-9]{2,5}$/, "").replace(/[-_.]+/g, " ").trim().slice(0, 80));
  };

  const submit = async () => {
    if (!user) { toast.error("Please sign in."); return; }
    if (!file) { toast.error("Choose an audio file."); return; }
    setBusy(true);
    try {
      const validated = await validateUploadFile(file).catch((e) => { throw new Error(describeIngestError(e)); });
      const id = crypto.randomUUID();
      const m = file.name.match(/\.([a-zA-Z0-9]{2,5})$/);
      const ext = (m ? m[1] : "mp3").toLowerCase();
      const path = `${user.id}/music/${id}.${ext}`;

      const up = await supabase.storage
        .from("video-clips")
        .upload(path, file, { cacheControl: "3600", upsert: true, contentType: file.type });
      if (up.error) throw up.error;
      const url = supabase.storage.from("video-clips").getPublicUrl(path).data.publicUrl;

      const { error: recErr } = await supabase.rpc("record_user_media", {
        p_user_id: user.id,
        p_media_type: "audio",
        p_asset_url: url,
        p_title: (title.trim() || file.name).slice(0, 120),
        p_source: "upload",
        p_duration_seconds: Math.round(validated.durationSec),
        p_mime_type: file.type,
        p_file_size_bytes: file.size,
      });
      if (recErr) throw recErr;

      toast.success("Track added to your library");
      reset();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display italic text-[24px] text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
            Upload a track
          </DialogTitle>
          <DialogDescription className="text-[12px] text-muted-foreground/85 mt-1">
            Bring your own music into Small Bridges. MP3 / WAV / M4A / AAC / OGG / FLAC, up to 10 minutes.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {!file ? (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0] ?? null); }}
              className="w-full rounded-2xl border border-dashed border-white/[0.14] hover:border-accent/50 bg-white/[0.02] hover:bg-white/[0.04] transition-colors py-10 flex flex-col items-center justify-center gap-3"
            >
              <UploadCloud className="w-7 h-7 text-muted-foreground" strokeWidth={1.4} />
              <span className="text-[13px] text-foreground/80">Click to choose audio, or drop a file here</span>
              <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/50">audio/* · ≤ 500 MB · ≤ 10 min</span>
            </button>
          ) : (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 flex items-center gap-3">
              <Music2 className="w-5 h-5 text-accent shrink-0" />
              <span className="text-[13px] text-foreground truncate flex-1">{file.name}</span>
              {!busy && (
                <button onClick={() => setFile(null)} className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground/70 hover:text-foreground">Change</button>
              )}
            </div>
          )}
          <input ref={fileRef} type="file" accept="audio/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0] ?? null)} />

          <div>
            <label className="block text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/70 mb-2">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder="Name this track"
              className="w-full h-11 px-3 rounded-md bg-white/[0.04] border border-white/[0.06] text-foreground text-[14px] focus:outline-none focus:border-accent/55"
            />
          </div>
        </div>

        <DialogFooter className="mt-6">
          <button type="button" onClick={close} disabled={busy} className="h-10 px-5 rounded-full text-[11px] font-mono uppercase tracking-[0.22em] text-muted-foreground/80 hover:text-foreground transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={busy || !file} className="h-10 px-5 rounded-full bg-accent/90 hover:bg-accent text-black text-[11px] font-mono uppercase tracking-[0.22em] disabled:opacity-50 inline-flex items-center gap-2">
            {busy ? <><Spinner size="sm" tone="inherit" />Uploading…</> : <><UploadCloud className="w-3.5 h-3.5" />Add to library</>}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ScoreStudioDialog — prompt → soundtrack via generate-music edge fn.
// Sync edge call (Replicate poll happens server-side), returns a public
// musicUrl. We mount a player + download once it returns.
// ─────────────────────────────────────────────────────────────────────────────
function ScoreStudioDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [prompt, setPrompt] = useState("Hans Zimmer cinematic strings building to a triumphant brass crescendo.");
  const [composer, setComposer] = useState<string>("hans-zimmer");
  const [intensity, setIntensity] = useState<"subtle" | "moderate" | "intense" | "explosive">("moderate");
  const [duration, setDuration] = useState<number>(30);
  const [generating, setGenerating] = useState(false);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const COMPOSERS = [
    { id: "hans-zimmer",       label: "Hans Zimmer" },
    { id: "john-williams",     label: "John Williams" },
    { id: "ennio-morricone",   label: "Ennio Morricone" },
    { id: "howard-shore",      label: "Howard Shore" },
    { id: "thomas-newman",     label: "Thomas Newman" },
    { id: "alexandre-desplat", label: "Alexandre Desplat" },
    { id: "ludwig-goransson",  label: "Ludwig Göransson" },
    { id: "ramin-djawadi",     label: "Ramin Djawadi" },
  ];
  const INTENSITIES: Array<"subtle" | "moderate" | "intense" | "explosive"> = ["subtle", "moderate", "intense", "explosive"];
  const DURATIONS = [15, 30, 60, 90];

  const generate = async () => {
    if (!prompt.trim()) { toast.error("Describe the soundtrack you want."); return; }
    setGenerating(true);
    setError(null);
    setMusicUrl(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-music", {
        body: {
          prompt: prompt.trim(),
          duration,
          intensity,
          referenceComposer: composer,
        },
      });
      if (error) throw error;
      const payload = (data ?? {}) as { musicUrl?: string; success?: boolean; error?: string };
      if (!payload.success || !payload.musicUrl) {
        throw new Error(payload.error || "No music returned");
      }
      setMusicUrl(payload.musicUrl);
      toast.success("Score ready.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Generation failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display italic text-[26px] text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
            Score Studio
          </DialogTitle>
          <DialogDescription className="text-[12px] text-muted-foreground/85 mt-1">
            Describe the soundtrack. Pick a composer voice. We render via MusicGen Stereo Large.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-5 space-y-5">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/70 mb-2">
              Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              maxLength={800}
              className="w-full px-3 py-2 rounded-md bg-white/[0.04] border border-white/[0.06] text-foreground text-[13px] leading-relaxed resize-none focus:outline-none focus:border-accent/55"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/70 mb-2">
                Composer voice
              </label>
              <div className="flex flex-wrap gap-1.5">
                {COMPOSERS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setComposer(c.id)}
                    className={
                      "h-8 px-3 rounded-full text-[11px] font-mono uppercase tracking-[0.16em] transition-colors " +
                      (composer === c.id
                        ? "bg-accent/85 text-black"
                        : "bg-white/[0.04] text-foreground/80 hover:bg-white/[0.08]")
                    }
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/70 mb-2">
                Intensity
              </label>
              <div className="flex gap-1.5">
                {INTENSITIES.map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIntensity(i)}
                    className={
                      "flex-1 h-9 rounded-md text-[11px] font-mono uppercase tracking-[0.18em] transition-colors capitalize " +
                      (intensity === i
                        ? "bg-accent/85 text-black"
                        : "bg-white/[0.04] text-foreground/80 hover:bg-white/[0.08]")
                    }
                  >
                    {i}
                  </button>
                ))}
              </div>
              <label className="block mt-4 text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/70 mb-2">
                Duration
              </label>
              <div className="flex gap-1.5">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(d)}
                    className={
                      "flex-1 h-9 rounded-md text-[11px] font-mono uppercase tracking-[0.18em] transition-colors tabular-nums " +
                      (duration === d
                        ? "bg-accent/85 text-black"
                        : "bg-white/[0.04] text-foreground/80 hover:bg-white/[0.08]")
                    }
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>
          </div>

          {musicUrl && (
            <div className="rounded-xl border border-emerald-300/30 bg-emerald-300/5 p-4">
              <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-emerald-200/85 mb-2">
                Score ready
              </div>
              <audio src={musicUrl} controls autoPlay className="w-full" />
              <div className="flex items-center gap-3 mt-3">
                <a
                  href={musicUrl}
                  target="_blank"
                  rel="noreferrer"
                  download
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-white/[0.07] hover:bg-white/[0.12] text-[11px] font-mono uppercase tracking-[0.16em] text-foreground/85"
                >
                  Download MP3
                </a>
                <button
                  type="button"
                  onClick={generate}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-white/[0.07] hover:bg-white/[0.12] text-[11px] font-mono uppercase tracking-[0.16em] text-foreground/85"
                >
                  Regenerate
                </button>
              </div>
            </div>
          )}
          {error && (
            <div className="text-[12px] text-rose-300/85">{error}</div>
          )}
        </div>

        <DialogFooter className="mt-6">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-5 rounded-full text-[11px] font-mono uppercase tracking-[0.22em] text-muted-foreground/80 hover:text-foreground transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={generate}
            disabled={generating}
            className="h-10 px-5 rounded-full bg-accent/90 hover:bg-accent text-black text-[11px] font-mono uppercase tracking-[0.22em] disabled:opacity-50 inline-flex items-center gap-2"
          >
            {generating ? <><Spinner size="sm" tone="inherit" />Composing…</> : "Generate score"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SectionLabel({ label, meta, icon: Icon }: { label: string; meta?: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <Icon className="w-3.5 h-3.5 text-primary/80" />
      <span className="text-[11px] font-mono uppercase tracking-[0.32em] text-foreground/65">{label}</span>
      <div className="h-px flex-1 bg-gradient-to-r from-white/[0.07] to-transparent" />
      {meta && <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/50">{meta}</span>}
    </div>
  );
}

function StudioGrid({ openStudio }: { openStudio: (k: "score" | "beat") => void }) {
  const tiles = [
    { kind: "score" as const,   icon: Piano,  title: "Score Studio",       sub: "Prompt → soundtrack",   accent: 280 },
    { kind: "beat"  as const,   icon: Drum,   title: "Daily Beat",         sub: "Build on today's stem", accent: 14 },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
      {tiles.map((t) => {
        const Icon = t.icon;
        return (
          <button
            key={t.kind}
            onClick={() => openStudio(t.kind)}
            className="group flex items-center gap-4 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] backdrop-blur-md px-5 py-4 text-left transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: `hsla(${t.accent} 70% 65% / 0.14)`,
                color: `hsl(${t.accent} 70% 75%)`,
              }}
            >
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] text-foreground">{t.title}</div>
              <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-[0.22em]">{t.sub}</div>
            </div>
            <Sparkles className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>
        );
      })}
    </div>
  );
}

function DailyBeatCard({ promptText, promptHint, onBuild }: { promptText: string; promptHint: string; onBuild: () => void }) {
  return (
    <section className="mb-12">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-center">
        <div>
          <div className="flex items-center gap-2 mb-3 text-[10px] font-mono uppercase tracking-[0.32em] text-amber-200/85">
            <Calendar className="w-3 h-3" /> ◆ Daily Beat · {new Date().toLocaleDateString(undefined, { weekday: "long" })}
          </div>
          <h2 className="font-display italic text-[clamp(1.4rem,2.2vw,1.9rem)] font-light tracking-tight text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
            {promptText}
          </h2>
          <p className="text-muted-foreground text-[13px] mt-3 max-w-xl">{promptHint}</p>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button onClick={onBuild} className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full bg-amber-300/90 hover:bg-amber-300 text-black text-[11px] font-mono uppercase tracking-[0.22em]">
            <Drum className="w-3 h-3" /> Build a take
          </button>
          <Link to="/lobby" className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-foreground/75 hover:text-foreground text-[11px] font-mono uppercase tracking-[0.22em]">
            <Headphones className="w-3 h-3" /> Hear today's takes
          </Link>
        </div>
      </div>
    </section>
  );
}

function MusicVideoCard({ reel, demo }: { reel: MusicReel; demo: boolean }) {
  const cardClass = cn(
    "group rounded-2xl bg-white/[0.04] hover:bg-white/[0.07] backdrop-blur-md overflow-hidden transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
    demo && "cursor-default",
  );
  const inner = (
    <>
      <div className="aspect-video bg-black/40 relative">
        {reel.thumbnail_url && <img src={reel.thumbnail_url} alt="" className="w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[10px] font-mono text-white/75">
          <span className="inline-flex items-center gap-1.5"><Play className="w-3 h-3" />{reel.play_count.toLocaleString()}</span>
          <span className="inline-flex items-center gap-1.5"><Music2 className="w-3 h-3" />{reel.like_count.toLocaleString()}</span>
        </div>
        {demo && (
          <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-amber-300/15 border border-amber-300/30 text-amber-200 text-[9px] font-mono uppercase tracking-[0.28em]">
            sample
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="text-[14px] text-foreground font-light truncate">{reel.title}</div>
        <div className="mt-1.5 text-[10px] text-muted-foreground font-mono uppercase tracking-[0.22em]">
          {reel.creator_name || "Anonymous"}
        </div>
      </div>
    </>
  );
  return demo ? (
    <div className={cardClass}>{inner}</div>
  ) : (
    <Link to={`/watch/${reel.id}`} className={cardClass}>{inner}</Link>
  );
}

