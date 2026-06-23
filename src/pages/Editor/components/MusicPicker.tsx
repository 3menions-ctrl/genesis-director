/**
 * MusicPicker — a left-rail drawer for scoring the timeline.
 *
 * Lives pinned at the bottom of the Scenes rail. Two tabs:
 *   • Mine — every track the signed-in user has uploaded or generated
 *            (user_media_assets, mediaType "audio").
 *   • App  — a small curated set of cinematic beds bundled with Small
 *            Bridges so a project can be scored even before the user
 *            has uploaded anything of their own.
 *
 * Click a track → it lands on the A2 (Music) track via ingestMusicUrl,
 * fully wired (DB row + in-memory store + ScriptDocument mirror). A
 * speaker button previews the track inline without adding it.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Music, ChevronUp, ChevronDown, Loader2, Plus, Play, Pause, UploadCloud } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";
import { useAuth } from "@/contexts/AuthContext";
import { useEditor } from "@/hooks/editor/useEditor";
import { useMediaLibrary } from "@/hooks/useMediaLibrary";
import { ingestMusicUrl } from "@/lib/editor/upload-ingest";
import { getDocumentState, flushNow } from "@/lib/editor/document-store";
import { toast } from "sonner";
import {
  MUSIC_LIBRARY, filterMusic, musicCategories, MUSIC_CATEGORY_LABELS,
  type MusicCategory,
} from "@/lib/editor/music-library";

const STORAGE_KEY = "smallbridges.editor.musicPicker.v1";

interface Track {
  id: string;
  title: string;
  mood: string;
  url: string;
  durationSec: number;
}

// The curated app beds now live in the shared, license-documented registry
// (src/lib/editor/music-library.ts) so the editor MusicPicker and the one-click
// timeline templates score from the SAME source of truth.

type Tab = "mine" | "app";
type AppFilter = "all" | MusicCategory;

function readOpen(): boolean {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").open === true; }
  catch { return false; }
}
function writeOpen(v: boolean): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ open: v })); } catch { /* quota */ }
}

function fmtDur(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function MusicPicker() {
  const { user } = useAuth();
  const { project } = useEditor();
  const [open, setOpenState] = useState<boolean>(() => readOpen());
  const setOpen = useCallback((v: boolean) => { setOpenState(v); writeOpen(v); }, []);
  const [tab, setTab] = useState<Tab>("app");
  const [appFilter, setAppFilter] = useState<AppFilter>("all");
  const [appQuery, setAppQuery] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { assets, loading } = useMediaLibrary({ mediaType: "audio", limit: 60 });
  const mineTracks: Track[] = assets.map((a) => ({
    id: a.id,
    title: a.title || a.prompt || "Untitled track",
    mood: "My track",
    url: a.asset_url,
    durationSec: a.duration_seconds ?? 30,
  }));

  const appTracks: Track[] = filterMusic(appFilter, appQuery);
  const tracks = tab === "mine" ? mineTracks : appTracks;

  const togglePreview = useCallback((t: Track) => {
    // One shared <audio>: clicking the playing track stops it, any other
    // swaps the source.
    if (playingId === t.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.onended = () => setPlayingId(null);
    }
    const el = audioRef.current;
    el.src = t.url;
    el.currentTime = 0;
    void el.play().then(() => setPlayingId(t.id)).catch(() => {
      toast.error("Couldn't preview this track");
      setPlayingId(null);
    });
  }, [playingId]);

  const handleAdd = useCallback(async (t: Track) => {
    if (!user) { toast.error("Sign in to score your timeline"); return; }
    if (!project || project.id === "no-project") {
      toast.error("Open a project first", { description: "Render or open a project, then add music." });
      return;
    }
    setAdding(t.id);
    try {
      const doc = getDocumentState().doc;
      if (!doc) throw new Error("No project document loaded");
      // ingestMusicUrl returns the durable DB clip id, or null if the
      // video_clips insert didn't persist (the in-memory mirror still
      // lands so the band lights up this session). Reflect that honestly.
      const clipId = await ingestMusicUrl({
        musicUrl: t.url,
        userId: user.id,
        projectId: project.id,
        doc,
        title: t.title,
        durationSec: t.durationSec,
      });
      await flushNow();
      if (clipId) {
        toast.success("Added to the Music track", { description: t.title });
      } else {
        toast.warning("Added for this session", {
          description: "Couldn't save it durably — it may not persist on reload.",
        });
      }
    } catch (e) {
      toast.error("Couldn't add this track", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setAdding(null);
    }
  }, [user, project]);

  // Stop + release the preview audio when the picker unmounts so it never
  // keeps playing after the user navigates away from the editor.
  useEffect(() => () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
  }, []);

  return (
    <div className="shrink-0 border-t border-white/[0.06] bg-[hsl(220_30%_3%/0.45)]">
      {/* Header — click to expand/collapse */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
      >
        <span className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.3em] flex items-center gap-2")}>
          <Music className="h-3 w-3 text-accent/75" strokeWidth={1.6} />
          <span>◆ Music</span>
        </span>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground/55" /> : <ChevronUp className="h-4 w-4 text-muted-foreground/55" />}
      </button>

      {open && (
        <div className="px-2 pb-3">
          {/* Tabs */}
          <div className="mx-2 mb-2 inline-flex items-center gap-1 rounded-full bg-white/[0.03] ring-1 ring-inset ring-white/[0.06] p-0.5">
            <TabPill active={tab === "app"}  onClick={() => setTab("app")}  label="Library" count={MUSIC_LIBRARY.length} />
            <TabPill active={tab === "mine"} onClick={() => setTab("mine")} label="Mine" count={mineTracks.length} />
          </div>

          {/* App library — category filter + search */}
          {tab === "app" && (
            <div className="mx-2 mb-2 space-y-2">
              <input
                value={appQuery}
                onChange={(e) => setAppQuery(e.target.value)}
                placeholder="Search the library…"
                className="w-full rounded-lg bg-white/[0.04] px-3 py-1.5 text-[12px] text-foreground/90 outline-none ring-1 ring-inset ring-white/[0.07] placeholder:text-muted-foreground/45 focus:ring-accent/40"
              />
              <div className="flex flex-wrap gap-1">
                <FilterPill active={appFilter === "all"} onClick={() => setAppFilter("all")} label="All" />
                {musicCategories().map((c) => (
                  <FilterPill key={c} active={appFilter === c} onClick={() => setAppFilter(c)} label={MUSIC_CATEGORY_LABELS[c]} />
                ))}
              </div>
            </div>
          )}

          <div className="max-h-[34vh] overflow-y-auto scrollbar-hide space-y-1 px-1">
            {tab === "mine" && loading ? (
              <div className="flex items-center gap-2 px-2 py-4 text-muted-foreground/60">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span className={cn(TYPE_META, "tracking-[0.22em]")}>Loading…</span>
              </div>
            ) : tracks.length === 0 ? (
              <div className="px-2 py-4 text-center">
                <p className="text-[12px] text-muted-foreground/65 leading-relaxed">
                  {tab === "mine" ? "No tracks yet." : "No tracks match your search."}
                </p>
                {tab === "mine" && (
                  <Link
                    to="/music"
                    className="mt-2 inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-white/[0.06] hover:bg-white/[0.10] text-[10px] font-mono uppercase tracking-[0.22em] text-foreground/85"
                  >
                    <UploadCloud className="h-3 w-3" /> Upload
                  </Link>
                )}
              </div>
            ) : (
              tracks.map((t) => (
                <TrackRow
                  key={t.id}
                  track={t}
                  playing={playingId === t.id}
                  adding={adding === t.id}
                  onPreview={() => togglePreview(t)}
                  onAdd={() => void handleAdd(t)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TabPill({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 h-7 rounded-full text-[10px] font-mono uppercase tracking-[0.22em] transition-colors inline-flex items-center gap-1.5",
        active ? "bg-accent/15 text-foreground ring-1 ring-inset ring-accent/35" : "text-muted-foreground/70 hover:text-foreground",
      )}
    >
      {label}
      <span className="text-[9px] tabular-nums text-muted-foreground/60">{count}</span>
    </button>
  );
}

function FilterPill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.16em] transition-colors",
        active
          ? "bg-accent/15 text-foreground ring-1 ring-inset ring-accent/35"
          : "bg-white/[0.03] text-muted-foreground/65 ring-1 ring-inset ring-white/[0.06] hover:text-foreground/85",
      )}
    >
      {label}
    </button>
  );
}

function TrackRow({
  track, playing, adding, onPreview, onAdd,
}: {
  track: Track; playing: boolean; adding: boolean; onPreview: () => void; onAdd: () => void;
}) {
  return (
    <div className="group/track flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-white/[0.04] transition-colors">
      <button
        type="button"
        onClick={onPreview}
        title={playing ? "Stop preview" : "Preview"}
        aria-label={playing ? "Stop preview" : "Preview"}
        className={cn(
          "shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-full ring-1 ring-inset transition-colors",
          playing ? "bg-accent/85 text-black ring-white/30" : "bg-white/[0.05] text-foreground/80 ring-white/[0.08] hover:bg-white/[0.10]",
        )}
      >
        {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 translate-x-[1px]" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] text-foreground/90 font-light truncate" style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic" }}>
          {track.title}
        </div>
        <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.18em] flex items-center gap-1.5")}>
          <span className="truncate">{track.mood}</span>
          <span className="opacity-50">·</span>
          <span className="tabular-nums">{fmtDur(track.durationSec)}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onAdd}
        disabled={adding}
        title="Add to Music track"
        aria-label="Add to Music track"
        className="shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-full bg-white/[0.05] text-foreground/80 ring-1 ring-inset ring-white/[0.08] hover:bg-accent/85 hover:text-black transition-colors disabled:opacity-60"
      >
        {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
