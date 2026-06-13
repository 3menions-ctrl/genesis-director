/**
 * useAudioWaveform — fetch + decode a media URL's audio track and
 * return a downsampled amplitude array.
 *
 * Cache is module-level so navigating between clips never re-decodes
 * the same URL. CORS failures (the public sample videos used in the
 * demo project don't all serve CORS headers) are silent — the caller
 * (AudioShadow) falls back to its procedural bars when null is
 * returned.
 *
 * When the editor moves to Tauri (v2), this hook gets replaced by a
 * native FFmpeg sidecar call that handles every format.
 */
import { useEffect, useState } from "react";

const BUCKETS = 240;

const memCache = new Map<string, Float32Array | null>();
const inflight = new Map<string, Promise<Float32Array | null>>();

async function decode(url: string): Promise<Float32Array | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx();
    let audio: AudioBuffer;
    try {
      audio = await ctx.decodeAudioData(buf);
    } catch {
      void ctx.close();
      return null;
    }
    void ctx.close();
    const channel = audio.getChannelData(0);
    const samplesPerBucket = Math.max(
      1,
      Math.floor(channel.length / BUCKETS),
    );
    const out = new Float32Array(BUCKETS);
    let globalMax = 0;
    for (let i = 0; i < BUCKETS; i++) {
      let max = 0;
      const start = i * samplesPerBucket;
      const end = Math.min(channel.length, start + samplesPerBucket);
      for (let j = start; j < end; j++) {
        const v = Math.abs(channel[j]);
        if (v > max) max = v;
      }
      out[i] = max;
      if (max > globalMax) globalMax = max;
    }
    // Normalize 0..1 to make the peak visible
    if (globalMax > 0) {
      for (let i = 0; i < out.length; i++) out[i] = out[i] / globalMax;
    }
    return out;
  } catch {
    return null;
  }
}

export function useAudioWaveform(videoUrl: string | null): Float32Array | null {
  const [waveform, setWaveform] = useState<Float32Array | null>(() =>
    videoUrl ? memCache.get(videoUrl) ?? null : null,
  );

  useEffect(() => {
    if (!videoUrl) {
      setWaveform(null);
      return;
    }
    if (memCache.has(videoUrl)) {
      setWaveform(memCache.get(videoUrl) ?? null);
      return;
    }
    let cancelled = false;
    const pending = inflight.get(videoUrl) ?? decode(videoUrl);
    inflight.set(videoUrl, pending);
    void pending.then((w) => {
      memCache.set(videoUrl, w);
      inflight.delete(videoUrl);
      if (!cancelled) setWaveform(w);
    });
    return () => {
      cancelled = true;
    };
  }, [videoUrl]);

  return waveform;
}
