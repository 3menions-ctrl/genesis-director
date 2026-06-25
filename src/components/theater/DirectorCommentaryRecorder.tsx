/**
 * DirectorCommentaryRecorder — opens a recording UI for the reel's
 * director. MediaRecorder API → webm/opus → uploaded to the
 * director-commentary bucket → row inserted into the director_commentary
 * table.
 *
 * Viewer-side playback (overlay during the reel) is in the companion
 * DirectorCommentaryTrack component.
 */
import { useEffect, useRef, useState } from "react";
import { Circle, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { toast } from "sonner";

interface Props {
  reelId: string;
  durationSecondsLimit?: number; // hard cap on recording length
  onDone?: () => void;
}

const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"];

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of MIME_CANDIDATES) {
    try { if (MediaRecorder.isTypeSupported(m)) return m; } catch { /* noop */ }
  }
  return "";
}

export function DirectorCommentaryRecorder({
  reelId,
  durationSecondsLimit = 300,
  onDone,
}: Props) {
  const { user } = useAuth();
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (mediaRef.current && mediaRef.current.state !== "inactive") {
      try { mediaRef.current.stop(); } catch { /* noop */ }
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const start = async () => {
    setError(null);
    if (!user) { toast.error("Sign in to record commentary."); return; }
    const mime = pickMime();
    if (!mime) { setError("MediaRecorder isn't supported in this browser."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream, { mimeType: mime });
      mediaRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => { void finalize(rec.mimeType); };
      rec.start();
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed((s) => {
          if (s + 1 >= durationSecondsLimit) {
            void stop();
          }
          return s + 1;
        });
      }, 1000);
    } catch (e) {
      setError(safeErrorMessage(e, "Couldn't start the microphone."));
    }
  };

  const stop = async () => {
    setRecording(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    try { mediaRef.current?.stop(); } catch { /* noop */ }
  };

  const finalize = async (mime: string) => {
    if (!user) return;
    const blob = new Blob(chunksRef.current, { type: mime });
    const ext = mime.includes("mp4") ? "mp4" : "webm";
    const path = `${user.id}/${reelId}/${Date.now()}.${ext}`;
    setUploading(true);
    try {
      const { error: upErr } = await supabase.storage
        .from("director-commentary")
        .upload(path, blob, { upsert: true, cacheControl: "31536000", contentType: mime });
      if (upErr) { setError(safeErrorMessage(upErr, "Couldn't upload your commentary. Please try again.")); return; }
      const { data } = supabase.storage.from("director-commentary").getPublicUrl(path);
      const audioUrl = data?.publicUrl;
      if (!audioUrl) { setError("Couldn't resolve the public URL."); return; }
      const { error: insErr } = await supabase
        .from("director_commentary")
        .upsert(
          {
            reel_id: reelId,
            director_id: user.id,
            audio_url: audioUrl,
            duration_seconds: elapsed,
          },
          { onConflict: "reel_id,director_id" },
        );
      if (insErr) { setError(safeErrorMessage(insErr, "Couldn't save your commentary. Please try again.")); return; }
      toast.success("Commentary saved — viewers can now turn it on.");
      onDone?.();
    } finally {
      setUploading(false);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      mediaRef.current = null;
      chunksRef.current = [];
    }
  };

  return (
    <div className="rounded-xl border border-glass bg-glass p-3 flex items-center gap-3">
      {recording ? (
        <Button type="button" size="sm" variant="destructive" onClick={() => void stop()}>
          <Square className="w-3.5 h-3.5 mr-2" /> Stop
        </Button>
      ) : (
        <Button type="button" size="sm" onClick={() => void start()} disabled={uploading}>
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Circle className="w-3.5 h-3.5 mr-2 text-destructive" fill="currentColor" />}
          {uploading ? "Saving…" : "Record commentary"}
        </Button>
      )}
      <div className="flex-1">
        <div className="text-[10px] uppercase tracking-[0.18em] text-foreground/55">
          {recording ? `${elapsed}s · max ${durationSecondsLimit}s` : "Behind-the-scenes voice track"}
        </div>
        {error && (
          <div className="text-[11px] text-destructive mt-0.5">{error}</div>
        )}
      </div>
    </div>
  );
}
