/**
 * Tail-frame extractor + uploader.
 *
 * Used by the Studio v2 batch generator to materialise the previous scene's
 * LAST frame as a hosted image URL, which is then fed to the next scene as
 * `startImageUrl` — the only way Kling / Seedance / Veo can actually inherit
 * the prior shot's composition (they accept an image, not a video tail).
 *
 * Works fully client-side via a hidden <video> element + offscreen canvas,
 * then uploads the JPEG to the public `temp-frames` bucket and returns the
 * permanent public URL.
 */
import { supabase } from "@/integrations/supabase/client";

const MIME = "image/jpeg";
const QUALITY = 0.92;

function captureFrame(video: HTMLVideoElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const w = video.videoWidth || 1280;
      const h = video.videoHeight || 720;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas 2D context unavailable"));
      ctx.drawImage(video, 0, 0, w, h);
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error("Empty canvas blob"))), MIME, QUALITY);
    } catch (e) {
      reject(e);
    }
  });
}

function loadVideoAtEnd(url: string, timeoutMs = 12000): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    let settled = false;
    const fail = (msg: string) => { if (!settled) { settled = true; reject(new Error(msg)); } };
    const ok = () => { if (!settled) { settled = true; resolve(video); } };
    const timer = window.setTimeout(() => fail(`Tail-frame extract timed out for ${url}`), timeoutMs);
    video.addEventListener("loadedmetadata", () => {
      const target = Math.max(0, (isFinite(video.duration) ? video.duration : 0) - 0.05);
      video.currentTime = target;
    });
    video.addEventListener("seeked", () => { window.clearTimeout(timer); ok(); });
    video.addEventListener("error", () => { window.clearTimeout(timer); fail("Video load error"); });
  });
}

export interface TailFrameOptions {
  userId: string;
  projectId: string;
  sceneIndex: number;
}

/**
 * Extracts the last frame of `clipUrl` and uploads it to Supabase Storage.
 * Returns the public HTTPS URL on success, or null on any failure (caller
 * should fall back to the prior reference image chain).
 */
export async function extractAndUploadTailFrame(
  clipUrl: string,
  opts: TailFrameOptions,
): Promise<string | null> {
  try {
    const video = await loadVideoAtEnd(clipUrl);
    const blob = await captureFrame(video);
    const path = `${opts.userId}/${opts.projectId}/scene-${opts.sceneIndex}-tail-${Date.now()}.jpg`;
    const { error } = await supabase.storage
      .from("temp-frames")
      .upload(path, blob, { contentType: MIME, upsert: true, cacheControl: "3600" });
    if (error) return null;
    const { data } = supabase.storage.from("temp-frames").getPublicUrl(path);
    return data?.publicUrl || null;
  } catch {
    return null;
  }
}
