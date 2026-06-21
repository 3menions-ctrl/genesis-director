/**
 * auto-captions — call editor-transcribe (ElevenLabs Scribe v2) on a
 * video URL, convert returned timestamped segments into TextOverlay
 * objects, and insert them into the project's textOverlays list. The
 * subtitle template (text-overlays.ts:376) supplies the visual style;
 * each segment becomes one overlay sized to its actual time window.
 *
 * The render bake already handles project.textOverlays via the
 * drawtext chain in seamless-stitcher, so the captions appear in the
 * exported MP4 with no additional pipeline work.
 */
import { supabase } from "@/integrations/supabase/client";
import { addTextOverlay } from "@/lib/editor/store";
import { TEXT_TEMPLATES } from "@/lib/editor/text-overlays";

interface TranscribeResponse {
  text: string;
  captions: Array<{ start: number; end: number; text: string }>;
}

export async function generateCaptionsForVideo(
  videoUrl: string,
): Promise<{ inserted: number }> {
  // Fetch video bytes into a Blob then convert to FormData for the
  // edge function. (editor-transcribe accepts multipart/form-data.)
  const blobResp = await fetch(videoUrl);
  if (!blobResp.ok) throw new Error(`Couldn't fetch video: ${blobResp.status}`);
  const blob = await blobResp.blob();
  const form = new FormData();
  form.append("file", blob, "audio.mp4");

  const { data, error } = await supabase.functions.invoke<TranscribeResponse>(
    "editor-transcribe",
    {
      body: form,
    },
  );
  if (error) throw new Error(error.message);
  if (!data || !Array.isArray(data.captions) || data.captions.length === 0) {
    return { inserted: 0 };
  }

  // Find the subtitle template — it provides default styling.
  const subtitleTpl = TEXT_TEMPLATES.find((t) => t.id === "subtitle");
  if (!subtitleTpl) throw new Error("subtitle template missing");

  let inserted = 0;
  for (const c of data.captions) {
    const startSec = Math.max(0, c.start ?? 0);
    const durationSec = Math.max(0.5, (c.end ?? c.start ?? 0) - startSec);
    const overlay = subtitleTpl.build(c.text.trim(), startSec, durationSec);
    addTextOverlay(overlay);
    inserted += 1;
  }
  return { inserted };
}
