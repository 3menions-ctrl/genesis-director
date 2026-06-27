/**
 * Music — /music
 *
 * A pure music page. Two things only:
 *   1. "Download more" — cinematic composer presets (Hans Zimmer, Ramin
 *      Djawadi, Steve Jablonsky, …). Tap a cover to generate a score in that
 *      style and download it; finished tracks land in your library.
 *   2. "My Tracks" — your generated + uploaded audio, with cover art.
 *
 * No music videos, no social feed, no market — those live on /lobby.
 *
 * Composed in the canonical Foundation room:
 *   FoundationShell + UserHueBackdrop + EditorialCanvas, with the StudioHero
 *   primitive for the page hero.
 */
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Music2, Piano, Download, Trash2, FileMusic, UploadCloud, Sparkles, Disc3,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSafeNavigation } from "@/lib/navigation";
import { StudioHero } from "@/components/studio/StudioHero";
import { CenterLine } from "@/components/ui/CenterLine";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Spinner } from "@/components/ui/Spinner";
import { useMediaLibrary, type MediaAsset } from "@/hooks/useMediaLibrary";
import { MUSIC_LIBRARY, MUSIC_CATEGORY_LABELS } from "@/lib/editor/music-library";
import { validateUploadFile, describeIngestError } from "@/lib/editor/upload-ingest";
import { FoundationShell } from "@/components/foundation/FoundationShell";
import { UserHueBackdrop } from "@/components/foundation/UserHueBackdrop";
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

// ─────────────────────────────────────────────────────────────────────────────
// Cinematic presets — "download more <composer> type tracks". Each opens the
// score generator pre-loaded with that composer's voice + a tailored prompt.
// `cover` is a real cover image; if it fails to load the `gradient` shows
// through, so a card is never blank.
// ─────────────────────────────────────────────────────────────────────────────
export interface MusicPreset {
  composer: string;
  name: string;
  vibe: string;
  blurb: string;
  prompt: string;
  cover: string;
  gradient: string;
}

const PRESETS: readonly MusicPreset[] = [
  {
    composer: "hans-zimmer",
    name: "Hans Zimmer",
    vibe: "Epic Orchestral",
    blurb: "Towering brass, relentless ostinato, Inception-grade tension.",
    prompt:
      "Hans Zimmer cinematic epic: deep brass swells, a driving low string ostinato, thunderous taiko percussion building to a triumphant heroic crescendo.",
    cover: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?auto=format&fit=crop&w=900&q=80",
    gradient: "linear-gradient(135deg, hsl(28 70% 30%) 0%, hsl(220 55% 12%) 100%)",
  },
  {
    composer: "ramin-djawadi",
    name: "Ramin Djawadi",
    vibe: "Thematic Cello",
    blurb: "Game of Thrones cello melodies — aching, regal, grand.",
    prompt:
      "Ramin Djawadi style: an emotional solo cello theme over lush strings, slow build, regal and melancholic, Game of Thrones grandeur.",
    cover: "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=900&q=80",
    gradient: "linear-gradient(135deg, hsl(348 55% 30%) 0%, hsl(280 50% 12%) 100%)",
  },
  {
    composer: "steve-jablonsky",
    name: "Steve Jablonsky",
    vibe: "Hybrid Action",
    blurb: "Transformers-scale hybrid orchestral + electronic power.",
    prompt:
      "Steve Jablonsky style: hybrid orchestral and electronic, massive percussion, a soaring heroic theme, Transformers-scale action and wonder.",
    cover: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=900&q=80",
    gradient: "linear-gradient(135deg, hsl(200 60% 28%) 0%, hsl(240 50% 10%) 100%)",
  },
  {
    composer: "ludwig-goransson",
    name: "Ludwig Göransson",
    vibe: "Modern Tension",
    blurb: "Oppenheimer / Tenet pulse — synth and orchestra entwined.",
    prompt:
      "Ludwig Göransson style: pulsing synth arpeggios fused with a live orchestra, steadily rising tension, Oppenheimer-grade urgency and awe.",
    cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=900&q=80",
    gradient: "linear-gradient(135deg, hsl(150 45% 26%) 0%, hsl(210 55% 10%) 100%)",
  },
  {
    composer: "john-williams",
    name: "John Williams",
    vibe: "Heroic Adventure",
    blurb: "Soaring fanfares and timeless adventure themes.",
    prompt:
      "John Williams style: a soaring heroic brass fanfare, sweeping strings, adventurous and triumphant, classic Hollywood grandeur.",
    cover: "https://images.unsplash.com/photo-1507838153414-b4b713384a76?auto=format&fit=crop&w=900&q=80",
    gradient: "linear-gradient(135deg, hsl(40 70% 32%) 0%, hsl(255 50% 12%) 100%)",
  },
  {
    composer: "howard-shore",
    name: "Howard Shore",
    vibe: "Fantasy Sweep",
    blurb: "Lord of the Rings choirs and misty-mountain strings.",
    prompt:
      "Howard Shore style: epic fantasy with a full choir, French horns and strings, misty and mythic, Lord of the Rings sweep.",
    cover: "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=900&q=80",
    gradient: "linear-gradient(135deg, hsl(95 40% 26%) 0%, hsl(200 50% 10%) 100%)",
  },
];

export default function MusicHub() {
  usePageMeta({
    title: "Music — Small Bridges",
    description: "Generate cinematic soundtracks and keep your own music library.",
  });
  const { user } = useAuth();
  const { navigate } = useSafeNavigation();
  const liveRenderTimecode = useLiveRenderTimecode();

  const [scoreOpen, setScoreOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [preset, setPreset] = useState<MusicPreset | null>(null);

  const openScore = (p: MusicPreset | null) => {
    if (!user) { navigate("/auth"); return; }
    setPreset(p);
    setScoreOpen(true);
  };

  return (
    <FoundationShell>
      {/* Same per-user hue gradient the profile page wears. */}
      <UserHueBackdrop userId={user?.id} />
      <div className="relative z-10 mx-auto w-full max-w-[1440px] px-4 pb-24 pt-10 sm:px-6 lg:px-10">
        <EditorialCanvas
          maxWidth="100%"
          chrome={{
            crumbs: ["Small Bridges", "music"],
            timecode: liveRenderTimecode ?? "SCORE · LIVE",
          }}
        >
          <StudioHero
            eyebrow="Music"
            title="Score"
            accent="your film."
            subtitle="Generate cinematic soundtracks in the voice of the greats — then keep every track in your own library."
            status={["Compose", "Mix", "Download"]}
            subhead="Cinematic scoring"
          >
            <button
              onClick={() => openScore(null)}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-accent/90 hover:bg-accent text-black text-[11px] font-mono uppercase tracking-[0.22em]"
            >
              <Piano className="w-3.5 h-3.5" /> Compose a score
            </button>
          </StudioHero>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Download more — cinematic composer presets with cover art. */}
            <section className="mb-14">
              <SectionLabel label="Download more · cinematic scores" icon={Disc3} meta={`${PRESETS.length} styles`} />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {PRESETS.map((p) => (
                  <PresetCard key={p.composer} preset={p} onPick={() => openScore(p)} />
                ))}
              </div>
            </section>

            {/* Free library — license-clear beds, ready to play + use. */}
            <section className="mb-14">
              <SectionLabel label="Free library · ready to use" icon={FileMusic} meta={`${MUSIC_LIBRARY.length} tracks`} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {MUSIC_LIBRARY.map((t) => (
                  <div key={t.id} className="rounded-2xl bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-[15px] font-light text-white" style={{ fontFamily: "'Fraunces', serif" }}>{t.title}</div>
                        <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                          {MUSIC_CATEGORY_LABELS[t.category]} · {Math.floor(t.durationSec / 60)}:{String(t.durationSec % 60).padStart(2, "0")}
                        </div>
                      </div>
                      <a href={t.url} download className="shrink-0 inline-flex h-8 items-center gap-1.5 rounded-full bg-white/[0.06] px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/70 transition-colors hover:bg-white/[0.12] hover:text-white">↓ Save</a>
                    </div>
                    <audio src={t.url} controls preload="none" className="h-9 w-full" />
                    <div className="mt-2 text-[10.5px] text-white/35">{t.license}</div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[12px] text-white/40">Also available in the editor's Music panel — one click to score your timeline.</p>
            </section>

            {/* My Tracks — generated + uploaded audio. */}
            <MyTracksPanel
              signedIn={!!user}
              onUpload={() => { if (!user) { navigate("/auth"); return; } setUploadOpen(true); }}
              onSignIn={() => navigate("/auth")}
            />
          </motion.div>
        </EditorialCanvas>
      </div>

      <ScoreStudioDialog open={scoreOpen} preset={preset} onClose={() => setScoreOpen(false)} />
      <UploadTrackDialog open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </FoundationShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PresetCard — a cover-art tile for a cinematic style. Real cover image with a
// themed gradient fallback so it's never blank.
// ─────────────────────────────────────────────────────────────────────────────
function PresetCard({ preset, onPick }: { preset: MusicPreset; onPick: () => void }) {
  return (
    <button
      onClick={onPick}
      className="group text-left rounded-2xl overflow-hidden bg-white/[0.04] hover:bg-white/[0.07] transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
    >
      <div className="aspect-[16/10] relative" style={{ background: preset.gradient }}>
        <img
          src={preset.cover}
          alt=""
          loading="lazy"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
          className="w-full h-full object-cover opacity-85 group-hover:opacity-100 group-hover:scale-[1.04] transition-all duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4">
          <div className="text-[18px] text-white font-light" style={{ fontFamily: "'Fraunces', serif" }}>
            {preset.name}
          </div>
        </div>
      </div>
      <div className="p-4 flex items-center justify-between gap-3">
        <p className="text-[12px] text-muted-foreground line-clamp-1">{preset.blurb}</p>
        <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-accent/90 group-hover:bg-accent text-black text-[10px] font-mono uppercase tracking-[0.18em] shrink-0 transition-colors">
          <Sparkles className="w-3 h-3" /> Generate
        </span>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MyTracksPanel — the user's own generated + uploaded audio library.
// ─────────────────────────────────────────────────────────────────────────────
function MyTracksPanel({
  signedIn, onUpload, onSignIn,
}: { signedIn: boolean; onUpload: () => void; onSignIn: () => void }) {
  const { assets, loading, remove } = useMediaLibrary({ mediaType: "audio", limit: 60 });
  // The audio library is SHARED with voice/TTS (per-scene narration, avatar
  // lines, etc. all save here). "My Tracks" on the music page should show only
  // music + user uploads — not generated voice clips — so filter those out.
  const tracks = assets.filter(
    (a) =>
      a.generation_mode !== "voice" &&
      !["generate-voice", "editor-tts", "regenerate-audio"].includes(a.source ?? ""),
  );

  return (
    <section className="mb-12">
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <SectionLabel label="My tracks" icon={FileMusic} meta={signedIn ? `${tracks.length} saved` : undefined} />
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
          <p className="text-muted-foreground text-[13px] mb-5">Sign in to generate scores and build a personal track library.</p>
          <button onClick={onSignIn} className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-white/[0.07] hover:bg-white/[0.12] text-[11px] font-mono uppercase tracking-[0.22em] text-foreground">
            Sign in
          </button>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
          <Spinner size="md" tone="muted" />
          <span className="text-[12px] font-mono uppercase tracking-[0.22em]">Loading your tracks…</span>
        </div>
      ) : tracks.length === 0 ? (
        <div className="text-center py-12 max-w-md mx-auto rounded-2xl bg-white/[0.03]">
          <FileMusic className="w-6 h-6 mx-auto mb-3 text-muted-foreground" />
          <h3 className="font-display italic text-[20px] font-light text-foreground mb-2" style={{ fontFamily: "'Fraunces', serif" }}>No tracks yet.</h3>
          <p className="text-muted-foreground text-[13px] mb-5">Pick a cinematic style above to generate your first score, or upload music you've made elsewhere — MP3, WAV, M4A, FLAC.</p>
          <button onClick={onUpload} className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-accent/90 hover:bg-accent text-black text-[11px] font-mono uppercase tracking-[0.22em]">
            <UploadCloud className="w-3.5 h-3.5" /> Upload a track
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {tracks.map((a) => <TrackRow key={a.id} asset={a} onRemove={remove} />)}
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
          className="w-12 h-12 rounded-xl overflow-hidden shrink-0 flex items-center justify-center text-white/85"
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
      const validated = await validateUploadFile(file).catch((e) => { throw new Error(describeIngestError(e).message); });
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
              className="w-full rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] transition-colors py-10 flex flex-col items-center justify-center gap-3"
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
// On success the finished track is recorded in the media library so it shows
// up under "My Tracks" (the panel auto-refreshes via its realtime subscription).
// When opened from a preset card, the composer + prompt are pre-loaded.
// ─────────────────────────────────────────────────────────────────────────────
function ScoreStudioDialog({ open, preset, onClose }: { open: boolean; preset: MusicPreset | null; onClose: () => void }) {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState("Hans Zimmer cinematic strings building to a triumphant brass crescendo.");
  const [composer, setComposer] = useState<string>("hans-zimmer");
  const [intensity, setIntensity] = useState<"subtle" | "moderate" | "intense" | "explosive">("moderate");
  const [duration, setDuration] = useState<number>(30);
  const [generating, setGenerating] = useState(false);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // When opened from a preset, pre-load that composer + prompt (and clear any
  // previous result). Runs whenever the dialog opens with a new preset.
  useEffect(() => {
    if (!open) return;
    setMusicUrl(null);
    setError(null);
    if (preset) {
      setComposer(preset.composer);
      setPrompt(preset.prompt);
    }
  }, [open, preset]);

  const COMPOSERS = [
    { id: "hans-zimmer",       label: "Hans Zimmer" },
    { id: "ramin-djawadi",     label: "Ramin Djawadi" },
    { id: "steve-jablonsky",   label: "Steve Jablonsky" },
    { id: "ludwig-goransson",  label: "Ludwig Göransson" },
    { id: "john-williams",     label: "John Williams" },
    { id: "howard-shore",      label: "Howard Shore" },
    { id: "ennio-morricone",   label: "Ennio Morricone" },
    { id: "thomas-newman",     label: "Thomas Newman" },
    { id: "alexandre-desplat", label: "Alexandre Desplat" },
  ];
  const INTENSITIES: Array<"subtle" | "moderate" | "intense" | "explosive"> = ["subtle", "moderate", "intense", "explosive"];
  const DURATIONS = [15, 30, 60, 90];

  const composerLabel = COMPOSERS.find((c) => c.id === composer)?.label ?? "Score";

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

      // Save to the user's library so it lands in "My Tracks".
      if (user) {
        const { error: recErr } = await supabase.rpc("record_user_media", {
          p_user_id: user.id,
          p_media_type: "audio",
          p_asset_url: payload.musicUrl,
          p_title: `${composerLabel} — ${prompt.trim().slice(0, 60)}`,
          p_source: "generated",
          p_duration_seconds: duration,
          p_mime_type: "audio/mpeg",
          p_file_size_bytes: 0,
        });
        if (recErr) console.warn("[Music] failed to record generated track", recErr);
      }

      toast.success("Score ready — saved to My Tracks.");
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
      <DialogContent className="w-[96vw] max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden rounded-2xl p-6 sm:p-8">
        {/* ambient cinematics — premium, borderless */}
        <div aria-hidden className="pointer-events-none absolute -top-24 right-0 h-56 w-56 rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, hsl(var(--accent) / 0.3), transparent 70%)' }} />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        <DialogHeader className="relative space-y-2 text-left">
          <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.05] ring-1 ring-inset ring-white/10">
            <span aria-hidden className="absolute inset-0 rounded-2xl" style={{ boxShadow: '0 0 34px -8px hsl(var(--accent) / 0.7)' }} />
            <Music2 className="relative h-5 w-5" style={{ color: 'hsl(var(--accent))' }} strokeWidth={1.7} />
          </div>
          <DialogTitle className="font-display text-[28px] font-semibold tracking-[-0.02em] text-white" style={{ fontFamily: "'Fraunces', serif" }}>
            Score Studio
          </DialogTitle>
          <DialogDescription className="text-[13px] leading-relaxed text-white/55">
            Describe the soundtrack, pick a composer voice, and we render a cinematic score.
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
                Score ready · saved to My Tracks
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
                  <Download className="w-3 h-3" /> Download MP3
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

        <DialogFooter className="relative mt-7 flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-2xl px-5 text-[12px] font-mono uppercase tracking-[0.2em] text-white/55 transition-colors hover:text-white sm:h-10"
          >
            Close
          </button>
          <button
            type="button"
            onClick={generate}
            disabled={generating}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-6 text-[13px] font-semibold text-[#0a0b10] transition-transform duration-200 hover:-translate-y-0.5 hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60 sm:h-11"
            style={{ boxShadow: '0 18px 50px -18px hsl(var(--accent) / 0.9)' }}
          >
            {generating ? <><Spinner size="sm" tone="inherit" />Composing…</> : <><Sparkles className="h-4 w-4" /> Generate score</>}
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
