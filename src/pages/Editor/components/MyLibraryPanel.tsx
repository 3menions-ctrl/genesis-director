/**
 * MyLibraryPanel — small in-rail browser of the user's recent work.
 *
 * Two sub-sections:
 *   1. RECENT UPLOADS  — user_media_assets where media_type='video',
 *      newest 12, click to add to the current project (via the existing
 *      Media Library import path) or open in a new tab.
 *   2. COMPLETED PROJECTS — movie_projects.status='completed' owned by
 *      the user, newest 12, click to navigate to that project's editor.
 *
 * Lives in the right rail's Project tab so the user can see what they
 * have without leaving the editor. Compact card design — 60px tall row
 * with a thumb, title, runtime/duration.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Film, FolderOpen, ArrowRight, Plus, Check, Heart, Sparkles, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ingestRemoteUrl, insertWithNextShotIndex, validateUploadFile, describeIngestError } from "@/lib/editor/upload-ingest";
import { appendPendingClip, resolvePendingClip } from "@/lib/editor/store";
import { getDocumentState, flushNow } from "@/lib/editor/document-store";
import type { EditorProject } from "@/lib/editor/types";

interface UploadAsset {
  id: string;
  title: string | null;
  asset_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  created_at: string;
  // The get_user_media_library RPC already returns these — we just
  // weren't reading them. Surfaces favorites + AI origin in the rail.
  is_favorite?: boolean;
  source?: string | null;
  engine?: string | null;
  generation_mode?: string | null;
}

interface CompletedProject {
  id: string;
  title: string;
  thumbnail_url: string | null;
  video_url: string | null;
  updated_at: string;
}

function fmtDur(sec: number | null): string {
  if (!sec || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function MyLibraryPanel({ project }: { project: EditorProject | null }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [uploads, setUploads] = useState<UploadAsset[] | null>(null);
  const [completed, setCompleted] = useState<CompletedProject[] | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Bulk-upload many videos straight into the media library
  // (user_media_assets). The realtime subscription above refreshes the
  // list as each one lands.
  const handleBulkUpload = async (files: FileList | null) => {
    if (!user) { toast.error("Sign in to upload"); return; }
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith("video/"));
    if (list.length === 0) { toast.error("Pick one or more video files"); return; }
    setUploading(true);
    const toastId = toast.loading(`Uploading 0/${list.length}…`);
    let ok = 0;
    const failures: string[] = [];
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      try {
        const validated = await validateUploadFile(file).catch((e) => { throw new Error(describeIngestError(e)); });
        const id = crypto.randomUUID();
        const m = file.name.match(/\.([a-zA-Z0-9]{2,5})$/);
        const ext = (m ? m[1] : file.type === "video/quicktime" ? "mov" : file.type === "video/webm" ? "webm" : "mp4").toLowerCase();
        const videoPath = `${user.id}/library/${id}.${ext}`;
        const thumbPath = `${user.id}/library/${id}.thumb.jpg`;
        const up = await supabase.storage.from("video-clips").upload(videoPath, file, { contentType: file.type, upsert: true });
        if (up.error) throw up.error;
        const url = supabase.storage.from("video-clips").getPublicUrl(videoPath).data.publicUrl;
        let thumbnailUrl: string | null = null;
        try {
          const tu = await supabase.storage.from("video-thumbnails").upload(thumbPath, validated.thumbnailBlob, { contentType: "image/jpeg", upsert: true });
          if (!tu.error) thumbnailUrl = supabase.storage.from("video-thumbnails").getPublicUrl(thumbPath).data.publicUrl;
        } catch { /* thumbnail best-effort */ }
        const title = file.name.replace(/\.[a-zA-Z0-9]{2,5}$/, "").replace(/[-_.]+/g, " ").trim().slice(0, 80) || "Upload";
        const { error: recErr } = await supabase.rpc("record_user_media", {
          p_user_id: user.id,
          p_media_type: "video",
          p_asset_url: url,
          p_thumbnail_url: thumbnailUrl ?? undefined,
          p_title: title,
          p_source: "upload",
          p_duration_seconds: Math.round(validated.durationSec),
          p_mime_type: file.type,
          p_file_size_bytes: file.size,
        });
        if (recErr) throw recErr;
        ok++;
      } catch (e) {
        failures.push(`${file.name}: ${e instanceof Error ? e.message : "failed"}`);
      }
      toast.loading(`Uploading ${i + 1}/${list.length}…`, { id: toastId });
    }
    setUploading(false);
    if (failures.length === 0) {
      toast.success(`Uploaded ${ok} video${ok === 1 ? "" : "s"} to your library`, { id: toastId });
    } else {
      toast.error(`${ok} uploaded · ${failures.length} failed`, { id: toastId, description: failures.slice(0, 3).join(" · ") });
    }
  };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const fetchLists = async () => {
      try {
        const [upRes, cpRes] = await Promise.all([
          supabase.rpc("get_user_media_library", {
            p_media_type: "video",
            p_project_id: null,
            p_limit: 12,
            p_offset: 0,
          }),
          // Broader filter — any project the user would think of as
          // "done": completed/rendered/published OR anything with a
          // playable video_url. The hard `status='completed'` filter
          // was excluding projects the user generated + exported but
          // never re-saved (they sit at status='rendered' or similar).
          supabase
            .from("movie_projects")
            .select("id, title, thumbnail_url, video_url, status, updated_at")
            .eq("user_id", user.id)
            .not("video_url", "is", null)
            .order("updated_at", { ascending: false })
            .limit(12),
        ]);
        if (cancelled) return;
        if (upRes.error) {
          // eslint-disable-next-line no-console
          console.warn("[MyLibraryPanel] uploads error:", upRes.error.message);
          setUploads([]);
        } else {
          setUploads(((upRes.data ?? []) as UploadAsset[]));
        }
        if (cpRes.error) {
          // eslint-disable-next-line no-console
          console.warn("[MyLibraryPanel] completed error:", cpRes.error.message);
          setCompleted([]);
        } else {
          setCompleted(((cpRes.data ?? []) as CompletedProject[]));
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[MyLibraryPanel] fatal:", e);
        setUploads([]);
        setCompleted([]);
      }
    };
    void fetchLists();
    // Subscribe to realtime changes so saves / uploads / deletes
    // refresh the lists without forcing the user to reload. Without
    // this, the panel showed stale data forever.
    const ch = supabase
      .channel(`my-library-panel-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_media_assets", filter: `user_id=eq.${user.id}` },
        () => { void fetchLists(); },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "movie_projects", filter: `user_id=eq.${user.id}` },
        () => { void fetchLists(); },
      )
      .subscribe();
    return () => { cancelled = true; void supabase.removeChannel(ch); };
    // project.id is in deps so re-opening on a different project also re-fetches.
  }, [user, project?.id]);

  const handleAddUpload = async (u: UploadAsset) => {
    if (!project) { toast.error("Open a project first"); return; }
    if (!user) { toast.error("Sign in to add clips"); return; }
    setAddingId(u.id);
    try {
      const durationSec = Math.max(0.5, Math.min(600, u.duration_seconds ?? 10));
      const title = u.title ?? "Library clip";

      // 1. Persist into video_clips FIRST. The seamless-stitcher reads
      //    from this table, not the ScriptDocument — without this DB
      //    insert the clip was visible on the timeline but invisible to
      //    the renderer. Result was the user-reported "only clip 1 in
      //    my saved video" bug: all the additional clips imported from
      //    the rail's library panel never got persisted, and the export
      //    only contained whatever was already in video_clips.
      const clipId = await insertWithNextShotIndex({
        projectId:    project.id,
        userId:       user.id,
        prompt:       `Imported: ${title}`,
        durationSec,
        videoUrl:     u.asset_url,
        thumbnailUrl: u.thumbnail_url,
      });
      if (!clipId) throw new Error("Couldn't persist clip to project");

      // 2. Mirror into the in-memory store so the timeline shows it
      //    INSTANTLY without waiting for a project reload.
      appendPendingClip({
        id:           clipId,
        prompt:       `Imported: ${title}`,
        durationSec,
        thumbnailUrl: u.thumbnail_url,
      });
      resolvePendingClip(clipId, {
        videoUrl:     u.asset_url,
        thumbnailUrl: u.thumbnail_url,
        durationSec,
      });

      // 3. Mirror into the ScriptDocument so doc-aware surfaces
      //    (Storyboard, BudgetPanel) see the new shot too.
      try {
        const doc = getDocumentState().doc;
        if (doc) {
          ingestRemoteUrl({
            videoUrl:     u.asset_url,
            thumbnailUrl: u.thumbnail_url,
            title:        u.title,
            durationSec,
            doc,
          });
          await flushNow();
        }
      } catch { /* doc mirror is best-effort */ }

      toast.success(`Added: ${title}`);
    } catch (e) {
      toast.error("Couldn't add clip", { description: e instanceof Error ? e.message : "" });
    } finally {
      setAddingId(null);
    }
  };

  // Optimistic toggle: flip the row's heart instantly + write to DB
  // in the background. The realtime subscription will reconcile any
  // divergence on the next refetch.
  const handleToggleFavorite = async (u: UploadAsset) => {
    const next = !u.is_favorite;
    setUploads((list) =>
      list ? list.map((x) => (x.id === u.id ? { ...x, is_favorite: next } : x)) : list,
    );
    const { error } = await supabase
      .from("user_media_assets")
      .update({ is_favorite: next })
      .eq("id", u.id);
    if (error) {
      toast.error("Couldn't update favorite", { description: error.message });
      // Revert the optimistic write.
      setUploads((list) =>
        list ? list.map((x) => (x.id === u.id ? { ...x, is_favorite: !next } : x)) : list,
      );
    }
  };

  const handleOpenProject = (p: CompletedProject) => {
    if (project && p.id === project.id) {
      toast.message("Already in this project");
      return;
    }
    navigate(`/editor/${p.id}`);
  };

  return (
    <div className="space-y-6">
      {/* RECENT UPLOADS */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.30em]")}>
            ◆ Recent uploads
          </h3>
          <div className="flex items-center gap-2">
            <span className={cn(TYPE_META, "text-muted-foreground/45 tabular-nums")}>
              {uploads === null ? "…" : uploads.length}
            </span>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className={cn(
                "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full ring-1 ring-inset transition-colors",
                "ring-white/[0.08] hover:ring-accent/50 hover:bg-[hsl(var(--accent)/0.06)] text-foreground/80",
                uploading && "opacity-60 cursor-not-allowed",
              )}
              title="Upload videos to your library"
            >
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <UploadCloud className="h-3 w-3" strokeWidth={1.6} />}
              <span className={cn(TYPE_META, "tracking-[0.18em]")}>{uploading ? "Uploading" : "Upload"}</span>
            </button>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="video/*"
          multiple
          className="sr-only"
          onChange={(e) => { void handleBulkUpload(e.target.files); e.currentTarget.value = ""; }}
        />
        {uploads === null ? (
          <Skeleton rows={3} />
        ) : uploads.length === 0 ? (
          <EmptyHint icon={<Film className="h-4 w-4" />} hint="Click Upload to add videos — or drop one on the timeline." />
        ) : (
          <div className="space-y-1.5">
            {uploads.map((u) => (
              <Row
                key={u.id}
                thumb={u.thumbnail_url}
                title={u.title ?? "Untitled upload"}
                meta={fmtDur(u.duration_seconds)}
                disabled={!project || addingId === u.id}
                cta="add"
                ctaIcon={addingId === u.id
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Plus className="h-3.5 w-3.5" />}
                onClick={() => void handleAddUpload(u)}
                isFavorite={u.is_favorite}
                onToggleFavorite={() => void handleToggleFavorite(u)}
                isAiGenerated={
                  // The RPC tags AI provenance via source/engine. Anything
                  // other than "upload" (user-uploaded) signals AI gen.
                  !!u.engine || (u.source != null && u.source !== "upload")
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* COMPLETED PROJECTS */}
      <section>
        <div className="flex items-baseline justify-between mb-2">
          <h3 className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.30em]")}>
            ◆ Completed projects
          </h3>
          <span className={cn(TYPE_META, "text-muted-foreground/45 tabular-nums")}>
            {completed === null ? "…" : completed.length}
          </span>
        </div>
        {completed === null ? (
          <Skeleton rows={3} />
        ) : completed.length === 0 ? (
          <EmptyHint icon={<FolderOpen className="h-4 w-4" />} hint="Hit Save in the top bar to mark a project Complete." />
        ) : (
          <div className="space-y-1.5">
            {completed.map((p) => (
              <Row
                key={p.id}
                thumb={p.thumbnail_url}
                title={p.title || "Untitled"}
                meta={p.id === project?.id ? "current" : new Date(p.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                cta="open"
                ctaIcon={p.id === project?.id
                  ? <Check className="h-3.5 w-3.5 text-emerald-300" strokeWidth={2.2} />
                  : <ArrowRight className="h-3.5 w-3.5" />}
                onClick={() => handleOpenProject(p)}
                muted={p.id === project?.id}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
function Row({
  thumb, title, meta, onClick, disabled, cta, ctaIcon, muted,
  isFavorite, isAiGenerated, onToggleFavorite,
}: {
  thumb: string | null;
  title: string;
  meta: string;
  onClick: () => void;
  disabled?: boolean;
  cta: "add" | "open";
  ctaIcon: React.ReactNode;
  muted?: boolean;
  isFavorite?: boolean;
  isAiGenerated?: boolean;
  onToggleFavorite?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => { if (!disabled) onClick(); }}
      disabled={disabled}
      className={cn(
        "group/row w-full flex items-center gap-2.5 p-1.5 rounded-lg transition-all",
        "ring-1 ring-inset",
        disabled
          ? "ring-white/[0.04] bg-white/[0.01] opacity-60 cursor-not-allowed"
          : "ring-white/[0.05] bg-white/[0.02] hover:ring-white/[0.18] hover:bg-white/[0.05]",
        muted && "opacity-75",
      )}
      title={cta === "add" ? "Add to timeline" : "Open project"}
    >
      <div className="relative shrink-0 w-14 h-9 rounded-md overflow-hidden bg-black ring-1 ring-inset ring-white/[0.05]">
        {thumb ? (
          <img src={thumb} alt="" loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-items-center">
            <Film className="h-3.5 w-3.5 text-muted-foreground/35" strokeWidth={1.5} />
          </div>
        )}
        {isAiGenerated && (
          <span
            className="absolute top-0.5 left-0.5 inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider bg-accent/85 text-accent-foreground"
            title="AI-generated"
          >
            <Sparkles className="h-2 w-2" strokeWidth={2} />
            AI
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 text-left">
        <div className="text-[12px] text-foreground/95 truncate">{title}</div>
        <div className={cn(TYPE_META, "text-muted-foreground/55 mt-0.5 truncate")}>{meta}</div>
      </div>
      {onToggleFavorite && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onToggleFavorite();
            }
          }}
          className={cn(
            "shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-full transition-colors cursor-pointer",
            isFavorite
              ? "text-rose-300 hover:text-rose-200"
              : "text-muted-foreground/45 hover:text-rose-200/85 hover:bg-white/[0.04]",
          )}
          aria-label={isFavorite ? "Unfavorite" : "Favorite"}
          title={isFavorite ? "Unfavorite" : "Favorite"}
        >
          <Heart
            className="h-3.5 w-3.5"
            strokeWidth={1.6}
            fill={isFavorite ? "currentColor" : "none"}
          />
        </span>
      )}
      <span className={cn(
        "shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-full transition-colors",
        disabled
          ? "text-muted-foreground/30"
          : "text-foreground/55 group-hover/row:text-foreground/95 group-hover/row:bg-white/[0.06]",
      )}>
        {ctaIcon}
      </span>
    </button>
  );
}

function Skeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-12 rounded-lg bg-white/[0.015] ring-1 ring-inset ring-white/[0.03] animate-pulse"
        />
      ))}
    </div>
  );
}

function EmptyHint({ icon, hint }: { icon: React.ReactNode; hint: string }) {
  return (
    <div className="rounded-lg ring-1 ring-inset ring-white/[0.05] bg-white/[0.015] px-3 py-4 flex items-center gap-3">
      <span className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-md bg-white/[0.02] text-muted-foreground/45">
        {icon}
      </span>
      <p className={cn(TYPE_META, "text-muted-foreground/55 leading-relaxed")}>{hint}</p>
    </div>
  );
}
