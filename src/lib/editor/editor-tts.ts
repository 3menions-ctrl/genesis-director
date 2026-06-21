/**
 * editor-tts client — generate ElevenLabs TTS for a script and insert
 * the result as an A1 audio clip on the project's timeline.
 *
 * Previously the editor-tts edge function returned audio bytes that
 * vanished — there was no client surface that consumed them. This
 * helper closes the loop: call editor-tts with `persist:true`, get
 * back a public URL, and insert as a standard audio clip.
 */
import { supabase } from "@/integrations/supabase/client";
import { insertWithNextShotIndex } from "@/lib/editor/upload-ingest";
import {
  appendPendingClip,
  resolvePendingClip,
} from "@/lib/editor/store";

interface GenerateOpts {
  text: string;
  projectId: string;
  userId: string;
  /** ElevenLabs voice id. Defaults to "George" inside the edge function. */
  voiceId?: string;
}

interface EditorTtsResponse {
  audioUrl: string;
  storagePath: string;
  voiceId: string;
}

export async function generateAndInsertTts(
  opts: GenerateOpts,
): Promise<{ clipId: string; audioUrl: string } | null> {
  const { data, error } = await supabase.functions.invoke<EditorTtsResponse>(
    "editor-tts",
    {
      body: {
        text: opts.text,
        voiceId: opts.voiceId,
        projectId: opts.projectId,
        persist: true,
      },
    },
  );
  if (error) throw new Error(error.message);
  if (!data?.audioUrl) return null;

  // Probe the duration of the generated audio so the timeline reserves
  // the right slot. We use a hidden <audio> element — same approach as
  // the upload pipeline's probeAudio.
  const durationSec = await probeAudioDuration(data.audioUrl).catch(() => 8);

  const clipId = await insertWithNextShotIndex({
    projectId: opts.projectId,
    userId: opts.userId,
    prompt: `TTS: ${opts.text.slice(0, 60)}${opts.text.length > 60 ? "…" : ""}`,
    durationSec,
    videoUrl: data.audioUrl,
    thumbnailUrl: null,
    // Voiceover lands on A1, not A2 (music) — matches editor convention.
    trackId: "sys:A1",
  });
  if (!clipId) throw new Error("Couldn't persist TTS clip to project");

  // Mirror to the in-memory store so it appears immediately.
  appendPendingClip({
    id: clipId,
    prompt: `TTS: ${opts.text.slice(0, 60)}`,
    durationSec,
    thumbnailUrl: null,
  });
  resolvePendingClip(clipId, {
    videoUrl: data.audioUrl,
    thumbnailUrl: null,
    durationSec,
  });

  return { clipId, audioUrl: data.audioUrl };
}

async function probeAudioDuration(url: string): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const a = document.createElement("audio");
    a.preload = "metadata";
    a.src = url;
    a.onloadedmetadata = () => {
      if (!isFinite(a.duration) || a.duration <= 0) {
        reject(new Error("invalid_duration"));
      } else {
        resolve(a.duration);
      }
    };
    a.onerror = () => reject(new Error("audio_load_failed"));
    window.setTimeout(() => reject(new Error("audio_probe_timeout")), 8000);
  });
}
