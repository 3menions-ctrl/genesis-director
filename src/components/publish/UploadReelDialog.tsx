/**
 * UploadReelDialog — turn an uploaded video file into a publishable
 * project WITHOUT going through Studio/AI generation.
 *
 * Flow:
 *   1. User picks a video file (validated: format, size, 0.5–120s).
 *   2. We extract a first-frame thumbnail in-browser, upload both the
 *      video (→ video-clips) and the thumbnail (→ video-thumbnails) to
 *      owner-scoped storage, and read back public URLs.
 *   3. We create a `movie_projects` row (status "completed") carrying the
 *      public video_url + thumbnail_url, and register it in the unified
 *      media library via `record_user_media`.
 *   4. We hand the new projectId up via `onProjectReady` — the caller
 *      then opens the PublishWizard pointed at it, so publishing reuses
 *      the exact same world/tags/notes flow as AI-generated reels.
 *
 * This closes the "upload → reel" gap: the only prior paths to a reel
 * were AI generation or the Editor.
 */
import { useRef, useState } from "react";
import { Film, UploadCloud, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/Spinner";
import { validateUploadFile, describeIngestError } from "@/lib/editor/upload-ingest";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Fired with the freshly-created project id once upload + row creation succeed. */
  onProjectReady: (projectId: string) => void;
}

function extFromFile(file: File): string {
  const m = file.name.match(/\.([a-zA-Z0-9]{2,5})$/);
  if (m) return m[1].toLowerCase();
  if (file.type === "video/quicktime") return "mov";
  if (file.type === "video/webm") return "webm";
  return "mp4";
}

export function UploadReelDialog({ open, onClose, onProjectReady }: Props) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setTitle("");
    setSynopsis("");
    setBusy(false);
    setStage("");
  };

  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const pick = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("video/")) {
      toast.error("Please choose a video file.");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    if (!title) {
      setTitle(f.name.replace(/\.[a-zA-Z0-9]{2,5}$/, "").replace(/[-_.]+/g, " ").trim().slice(0, 80));
    }
  };

  const submit = async () => {
    if (!user) { toast.error("Please sign in."); return; }
    if (!file) { toast.error("Choose a video to upload."); return; }
    if (!title.trim()) { toast.error("Give your reel a title."); return; }

    setBusy(true);
    try {
      // 1. Validate + probe (duration + first-frame thumbnail), reusing
      //    the Editor's battle-tested ingest validator.
      setStage("Reading video…");
      const validated = await validateUploadFile(file).catch((e) => {
        throw new Error(describeIngestError(e));
      });

      const id = crypto.randomUUID();
      const ext = extFromFile(file);
      const videoPath = `${user.id}/uploads/${id}.${ext}`;
      const thumbPath = `${user.id}/uploads/${id}.thumb.jpg`;

      // 2. Upload the video to the public video-clips bucket.
      setStage("Uploading video…");
      const up = await supabase.storage
        .from("video-clips")
        .upload(videoPath, file, { cacheControl: "3600", upsert: true, contentType: file.type });
      if (up.error) throw up.error;
      const videoUrl = supabase.storage.from("video-clips").getPublicUrl(videoPath).data.publicUrl;

      // 3. Upload the thumbnail (best-effort — a missing thumb shouldn't block).
      setStage("Saving thumbnail…");
      let thumbnailUrl: string | null = null;
      try {
        const tu = await supabase.storage
          .from("video-thumbnails")
          .upload(thumbPath, validated.thumbnailBlob, { cacheControl: "3600", upsert: true, contentType: "image/jpeg" });
        if (!tu.error) {
          thumbnailUrl = supabase.storage.from("video-thumbnails").getPublicUrl(thumbPath).data.publicUrl;
        }
      } catch { /* non-fatal */ }

      // 4. Create the project row carrying the finished video.
      setStage("Creating project…");
      const { data: proj, error: projErr } = await supabase
        .from("movie_projects")
        .insert({
          user_id: user.id,
          title: title.trim(),
          synopsis: synopsis.trim() || null,
          video_url: videoUrl,
          thumbnail_url: thumbnailUrl,
          status: "completed",
        })
        .select("id")
        .single();
      if (projErr) throw projErr;
      const projectId = (proj as { id: string }).id;

      // 5. Register in the unified media library (best-effort).
      try {
        await supabase.rpc("record_user_media", {
          p_user_id: user.id,
          p_media_type: "video",
          p_asset_url: videoUrl,
          p_thumbnail_url: thumbnailUrl ?? undefined,
          p_title: title.trim(),
          p_source: "upload",
          p_project_id: projectId,
          p_duration_seconds: Math.round(validated.durationSec),
          p_mime_type: file.type,
          p_file_size_bytes: file.size,
        });
      } catch { /* non-fatal */ }

      toast.success("Video uploaded — now choose where to publish it.");
      reset();
      onProjectReady(projectId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      toast.error(msg);
    } finally {
      setBusy(false);
      setStage("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display italic text-[24px] text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
            Upload a reel
          </DialogTitle>
          <DialogDescription className="text-[12px] text-muted-foreground/85 mt-1">
            Bring your own video and publish it straight to your profile and the Lobby — no generation required. MP4 / MOV / WebM, up to 120 seconds.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {/* Drop / pick zone */}
          {!file ? (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0] ?? null); }}
              className="w-full rounded-2xl border border-dashed border-white/[0.14] hover:border-accent/50 bg-white/[0.02] hover:bg-white/[0.04] transition-colors py-12 flex flex-col items-center justify-center gap-3"
            >
              <UploadCloud className="w-7 h-7 text-muted-foreground" strokeWidth={1.4} />
              <span className="text-[13px] text-foreground/80">Click to choose a video, or drop one here</span>
              <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/50">video/* · ≤ 500 MB · ≤ 120s</span>
            </button>
          ) : (
            <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-black/40">
              {previewUrl && (
                <video src={previewUrl} className="w-full max-h-[260px] object-contain bg-black" controls muted />
              )}
              {!busy && (
                <button
                  type="button"
                  onClick={() => { if (previewUrl) URL.revokeObjectURL(previewUrl); setFile(null); setPreviewUrl(null); }}
                  aria-label="Remove video"
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 border border-white/15 text-white/80 hover:text-white flex items-center justify-center"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
          <input ref={fileRef} type="file" accept="video/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0] ?? null)} />

          {/* Title + synopsis */}
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/70 mb-2">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder="Name your reel"
              className="w-full h-11 px-3 rounded-md bg-white/[0.04] border border-white/[0.06] text-foreground text-[14px] focus:outline-none focus:border-accent/55"
            />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/70 mb-2">Synopsis <span className="text-muted-foreground/40">· optional</span></label>
            <textarea
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              rows={2}
              maxLength={300}
              placeholder="A line about what this is."
              className="w-full px-3 py-2 rounded-md bg-white/[0.04] border border-white/[0.06] text-foreground text-[13px] leading-relaxed resize-none focus:outline-none focus:border-accent/55"
            />
          </div>
        </div>

        <DialogFooter className="mt-6">
          <button
            type="button"
            onClick={close}
            disabled={busy}
            className="h-10 px-5 rounded-full text-[11px] font-mono uppercase tracking-[0.22em] text-muted-foreground/80 hover:text-foreground transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !file || !title.trim()}
            className="h-10 px-5 rounded-full bg-accent/90 hover:bg-accent text-black text-[11px] font-mono uppercase tracking-[0.22em] disabled:opacity-50 inline-flex items-center gap-2"
          >
            {busy ? <><Spinner size="sm" tone="inherit" />{stage || "Working…"}</> : <><Film className="w-3.5 h-3.5" />Continue to publish</>}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default UploadReelDialog;
