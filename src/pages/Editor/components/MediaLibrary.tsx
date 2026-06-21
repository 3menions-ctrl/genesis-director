/**
 * MediaLibrary — browse + click-to-add videos to the timeline.
 *
 * Two tabs:
 *   • Mine    — every reel the signed-in user has published
 *               (queried from `published_reels` filtered by creator_id)
 *   • Public  — every public reel on the platform, demo videos
 *               included. Lets a user discover footage to remix.
 *
 * Click any tile → the video is added as a Shot on the last scene
 * (or a new "LIBRARY" scene if the document is empty) via the
 * existing ingestRemoteUrl path. No re-upload — the clip just
 * references the existing URL.
 *
 * Surface: Shift+M opens.
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createDraftProject } from "@/lib/editor/createDraftProject";
import { Film, Sparkles, Loader2, PlayCircle, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Surface, SurfaceHeader, SurfaceBody, SurfaceFooter, SurfaceKbdHint,
} from "./Surface";
import { useEditor } from "@/hooks/editor/useEditor";
import { useMediaLibrary } from "@/hooks/useMediaLibrary";
import { ingestRemoteUrl, insertWithNextShotIndex } from "@/lib/editor/upload-ingest";
import { getDocumentState, flushNow } from "@/lib/editor/document-store";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Tab = "mine" | "public";

interface Tile {
  id: string;
  title: string | null;
  video_url: string;
  thumbnail_url: string | null;
  creator_id: string | null;
  creator_name?: string | null;
  duration_sec?: number | null;
}

export function MediaLibrary({ open, onClose }: Props) {
  const { user } = useAuth();
  const { project, appendPendingClip, resolvePendingClip } = useEditor();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("mine");
  const [pub, setPub] = useState<Tile[]>([]);
  const [loadingPub, setLoadingPub] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);

  // MINE — every video the user has uploaded or generated, across every project.
  // Backed by user_media_assets (the unified media history), not published_reels.
  // This is what makes drag-drop uploads, edge-function-generated clips, and
  // anything reconciled into the library actually visible in the editor.
  const { assets: mineAssets, loading: loadingMine } = useMediaLibrary({ mediaType: "video" });
  const mine: Tile[] = mineAssets.map((a) => ({
    id:            a.id,
    title:         a.title ?? a.prompt ?? null,
    video_url:     a.asset_url,
    thumbnail_url: a.thumbnail_url,
    creator_id:    a.user_id,
    duration_sec:  a.duration_seconds,
  }));

  // PUBLIC — every published reel, for discovery / remix.
  const loadPublic = useCallback(async () => {
    setLoadingPub(true);
    try {
      const { data, error } = await supabase
        .from("published_reels" as never)
        .select("id, title, video_url, thumbnail_url, creator_id, duration_sec")
        .eq("is_taken_down", false)
        .not("video_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      const pubRows = (data ?? []) as Tile[];
      const creatorIds = Array.from(
        new Set(pubRows.map((r) => r.creator_id).filter((v): v is string => !!v)),
      );
      if (creatorIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles_public" as never)
          .select("id, display_name, username")
          .in("id", creatorIds);
        const byId = new Map<string, { display_name: string | null; username: string | null }>(
          ((profs ?? []) as Array<{ id: string; display_name: string | null; username: string | null }>).map((p) => [p.id, p]),
        );
        for (const t of pubRows) {
          const p = t.creator_id ? byId.get(t.creator_id) : undefined;
          t.creator_name = p?.display_name ?? (p?.username ? `@${p.username}` : null);
        }
      }
      setPub(pubRows);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[MediaLibrary]", e);
    } finally {
      setLoadingPub(false);
    }
  }, []);

  useEffect(() => { if (open) void loadPublic(); }, [open, loadPublic]);

  const loading = tab === "mine" ? loadingMine : loadingPub;

  const handleClick = async (tile: Tile) => {
    if (!user) { toast.error("Sign in to import clips"); return; }
    setAdding(tile.id);
    try {
      // If the editor is on the empty NLE surface, mint a draft project
      // on the fly and navigate after the import — the user's first
      // verb is "drop a clip in", and that shouldn't require a detour
      // through Studio or Library to set up a project shell first.
      const isEmpty = !project || project.id === "no-project";
      let projectId = project?.id ?? "";
      let mintedProjectId: string | null = null;
      if (isEmpty) {
        const newId = await createDraftProject();
        if (!newId) {
          throw new Error("Couldn't create a project to hold the clip.");
        }
        projectId = newId;
        mintedProjectId = newId;
      }
      // Probe the ACTUAL video duration from the file — reels often have
      // a fictional duration_sec set at publish time that doesn't match
      // the underlying bytes. If we trust the lie, the timeline allocates
      // (e.g.) 120s for a 10s file and filmstrip seeks past the end fail.
      const probedDuration = await probeVideoDuration(tile.video_url);
      const fallback = Math.max(1, Math.min(120, tile.duration_sec ?? 10));
      const durationSec = probedDuration && probedDuration > 0
        ? Math.max(0.5, Math.min(600, probedDuration))
        : fallback;
      const prompt = `Imported: ${tile.title ?? "Library clip"}`;

      // 1. Insert a video_clips row with the URL already set + completed.
      //    This is what the timeline actually reads from on reload.
      //    shot_index is part of (project_id, shot_index) UNIQUE — the
      //    helper probes the DB for max+1 and retries on collision so
      //    concurrent imports don't stomp each other.
      const clipId = await insertWithNextShotIndex({
        projectId,
        userId:       user.id,
        prompt,
        durationSec,
        videoUrl:     tile.video_url,
        thumbnailUrl: tile.thumbnail_url ?? null,
      });
      if (!clipId) throw new Error("video_clips insert failed");

      // 1.5 Same mirror as the drag-drop path — if this is the FIRST
      // clip on the project, populate movie_projects.{video_url,
      // thumbnail_url} so the Library card + Reel/Theater player can
      // show & play it without needing an Export render.
      try {
        await supabase
          .from("movie_projects")
          .update({ video_url: tile.video_url })
          .eq("id", projectId)
          .is("video_url", null);
        if (tile.thumbnail_url) {
          await supabase
            .from("movie_projects")
            .update({ thumbnail_url: tile.thumbnail_url })
            .eq("id", projectId)
            .is("thumbnail_url", null);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[MediaLibrary] movie_projects mirror failed:", e);
      }

      // 2. Mirror into the in-memory editor store so the timeline shows
      //    it INSTANTLY without waiting for a project reload. Skip
      //    when we just minted the project — we're about to navigate,
      //    which re-mounts the editor and rehydrates from DB. The
      //    local store mutation would be discarded on the unmount.
      if (!mintedProjectId) {
        appendPendingClip({
          id: clipId,
          prompt,
          durationSec,
          thumbnailUrl: tile.thumbnail_url,
        });
        // 3. Immediately resolve to swap the placeholder into a playable atom.
        resolvePendingClip(clipId, { videoUrl: tile.video_url, thumbnailUrl: tile.thumbnail_url });

        // 4. Mirror into the ScriptDocument so the constitution sees it.
        try {
          const doc = getDocumentState().doc;
          if (doc) {
            ingestRemoteUrl({
              videoUrl:     tile.video_url,
              thumbnailUrl: tile.thumbnail_url,
              title:        tile.title,
              durationSec,
              doc,
            });
            await flushNow();
          }
        } catch { /* doc mirror is best-effort */ }
      }

      toast.success(
        mintedProjectId ? "Project created · clip added" : "Added to timeline",
        { description: tile.title ?? "Library clip" },
      );
      onClose();
      if (mintedProjectId) {
        navigate(`/editor/${mintedProjectId}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add clip");
    } finally {
      setAdding(null);
    }
  };

  const tiles = tab === "mine" ? mine : pub;

  return (
    <Surface open={open} onClose={onClose} size="full" labelledBy="media-library-title">
      <SurfaceHeader
        id="media-library-title"
        title="Media library"
        eyebrow="◆ Library"
        description="Any video on Small Bridges — yours or public — clickable into the timeline."
        onClose={onClose}
      />

      {/* Tabs */}
      <div className="px-7 pt-3 pb-1">
        <div className="inline-flex items-center gap-1 rounded-full bg-white/[0.025] ring-1 ring-inset ring-white/[0.06] p-1">
          <TabPill active={tab === "mine"}   onClick={() => setTab("mine")}   label="Mine"   count={mine.length} />
          <TabPill active={tab === "public"} onClick={() => setTab("public")} label="Public" count={pub.length} />
        </div>
      </div>

      <SurfaceBody>
        {loading ? (
          <div className="py-20 flex items-center justify-center gap-2 text-muted-foreground/65">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className={cn(TYPE_META, "tracking-[0.22em]")}>Loading…</span>
          </div>
        ) : tiles.length === 0 ? (
          <Empty mine={tab === "mine"} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {tiles.map((t) => (
              <MediaTile
                key={t.id}
                tile={t}
                adding={adding === t.id}
                onClick={() => void handleClick(t)}
              />
            ))}
          </div>
        )}
      </SurfaceBody>

      <SurfaceFooter>
        <SurfaceKbdHint keys="Shift M" label="media library" />
        <span className="text-[12px] text-muted-foreground/65">
          Click any tile to add it as a clip on the timeline.
        </span>
      </SurfaceFooter>
    </Surface>
  );
}

function TabPill({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3.5 h-8 rounded-full text-[12px] font-mono uppercase tracking-[0.22em] transition-colors inline-flex items-center gap-2",
        active ? "bg-accent/15 text-foreground ring-1 ring-inset ring-accent/35" : "text-muted-foreground/75 hover:text-foreground",
      )}
    >
      {label}
      <span className="text-[10px] tabular-nums text-muted-foreground/65">{count}</span>
    </button>
  );
}

function MediaTile({ tile, adding, onClick }: { tile: Tile; adding: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={adding}
      className={cn(
        "group/tile relative aspect-video rounded-2xl overflow-hidden ring-1 ring-inset ring-white/[0.06] hover:ring-accent/45 transition-all text-left",
        adding && "opacity-65"
      )}
    >
      {tile.thumbnail_url ? (
        <img
          src={tile.thumbnail_url}
          alt={tile.title ?? ""}
          className="absolute inset-0 w-full h-full object-cover group-hover/tile:scale-105 transition-transform duration-500"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] to-transparent grid place-items-center">
          <Film className="h-6 w-6 text-white/30" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
      <div className="absolute inset-0 grid place-items-center opacity-0 group-hover/tile:opacity-100 transition-opacity">
        <div className="rounded-full bg-accent/85 backdrop-blur ring-1 ring-inset ring-white/30 p-3 text-black">
          {adding ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
        </div>
      </div>
      <div className="absolute bottom-2.5 left-2.5 right-2.5">
        <div className="text-[13px] text-white font-light truncate" style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic" }}>
          {tile.title ?? "Untitled"}
        </div>
        {tile.creator_name && (
          <div className={cn(TYPE_META, "text-white/65 tracking-[0.18em] truncate")}>
            {tile.creator_name}
          </div>
        )}
      </div>
      <PlayCircle className="absolute top-2.5 right-2.5 h-3.5 w-3.5 text-white/55" strokeWidth={1.6} />
    </button>
  );
}

/**
 * probeVideoDuration — best-effort fetch of a video's real length by
 * mounting a hidden <video> element with preload="metadata" and reading
 * `duration` once loadedmetadata fires. Resolves null if the probe
 * can't reach the file (CORS, network, decode failure, etc.).
 */
function probeVideoDuration(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") { resolve(null); return; }
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.playsInline = true;
    let settled = false;
    const cleanup = () => {
      try { v.removeAttribute("src"); v.load(); } catch { /* ignore */ }
      v.remove();
    };
    const onLoaded = () => {
      if (settled) return;
      settled = true;
      const d = Number.isFinite(v.duration) ? v.duration : null;
      cleanup();
      resolve(d);
    };
    const onError = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(null);
    };
    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("error", onError);
    // Hard timeout so we never block the click forever on a slow probe.
    window.setTimeout(() => { if (!settled) onError(); }, 4000);
    v.src = url;
    // The element MUST be attached to the DOM in some browsers for
    // metadata loading to fire — hidden, off-screen.
    v.style.position = "fixed";
    v.style.left = "-99999px";
    v.style.top = "0";
    v.style.width = "1px";
    v.style.height = "1px";
    document.body.appendChild(v);
  });
}

function Empty({ mine }: { mine: boolean }) {
  return (
    <div className="py-16 text-center">
      <Sparkles className="h-6 w-6 mx-auto text-muted-foreground/55" strokeWidth={1.4} />
      <div className="mt-4 font-display italic text-[22px] text-foreground/95" style={{ fontFamily: "'Fraunces', serif" }}>
        {mine ? "You haven't published anything yet." : "No public videos to show."}
      </div>
      <p className="mt-2 text-[13px] text-muted-foreground/65 max-w-md mx-auto">
        {mine
          ? "Once you publish a reel, it'll show here so you can remix from your own back catalog."
          : "Public reels and demo footage will appear here as the platform fills up."}
      </p>
    </div>
  );
}
