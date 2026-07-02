// ═══════════════════════════════════════════════════════════════════════════
// effect-tools.ts — the Effect Compiler's tool registry.
//
// One interface: invokeTool(tool, inputs) → { url?, ...fields }.
// Every adapter is Replicate-first (the always-present key), persists media to
// durable storage, and returns URLs the next stage can consume via {{refs}}.
// Compositing runs on the same ffmpeg cog the stitcher uses — pixels are only
// ever pasted here, never simulated.
// ═══════════════════════════════════════════════════════════════════════════

import { completeLLM } from './llm-complete.ts';
import type { ToolId } from './effect-plan.ts';

const REPLICATE = 'https://api.replicate.com/v1';

function key(): string {
  const k = Deno.env.get('REPLICATE_API_KEY');
  if (!k) throw new Error('REPLICATE_API_KEY missing');
  return k;
}

/** Thrown when a prediction outlives this invocation's budget — the executor
 *  persists the id and resumes polling in the next self-invocation. */
export class PendingPrediction extends Error {
  constructor(public predictionId: string) { super(`pending:${predictionId}`); this.name = 'PendingPrediction'; }
}

/** Per-invocation wall budget for any single tool call. The executor chains
 *  invocations, so long generations survive edge time limits. */
export let STAGE_BUDGET_MS = 240_000;
export function setStageBudget(ms: number) { STAGE_BUDGET_MS = ms; }

export async function pollPredictionOnce(id: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${REPLICATE}/predictions/${id}`, { headers: { Authorization: `Bearer ${key()}` } });
  if (!res.ok) throw new Error(`poll ${id}: ${res.status}`);
  return await res.json();
}

async function awaitPrediction(pred: Record<string, unknown>, path: string): Promise<Record<string, unknown>> {
  const start = Date.now();
  while (!['succeeded', 'failed', 'canceled'].includes(pred.status as string)) {
    if (Date.now() - start > STAGE_BUDGET_MS) throw new PendingPrediction(String(pred.id));
    await new Promise((r) => setTimeout(r, 3000));
    pred = await pollPredictionOnce(String(pred.id));
  }
  if (pred.status !== 'succeeded') throw new Error(`replicate ${path} ${pred.status}: ${String(pred.error).slice(0, 300)}`);
  return pred;
}

async function replicateRun(
  path: string,
  body: Record<string, unknown>,
  _timeoutMs = 480_000,
): Promise<Record<string, unknown>> {
  // Transient-throttle resilience: 429 (rate limit) and 5xx are infra hiccups,
  // not our error — back off and retry a few times before failing the stage.
  // Prevents a customer's whole run dying on a momentary Replicate throttle.
  let lastStatus = 0, lastBody = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    const create = await fetch(`${REPLICATE}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json', Prefer: 'wait' },
      body: JSON.stringify(body),
    });
    if (create.ok) return await awaitPrediction(await create.json(), path);
    lastStatus = create.status;
    lastBody = (await create.text()).slice(0, 300);
    if (create.status !== 429 && create.status < 500) break; // hard error — don't retry
    await new Promise((r) => setTimeout(r, Math.min(30_000, 2000 * 2 ** attempt))); // 2,4,8,16,30s
  }
  throw new Error(`replicate ${path}: ${lastStatus} ${lastBody}`);
}

/** Resume a stage whose prediction outlived the previous invocation. */
export async function resumeToolPrediction(tool: ToolId, predictionId: string, runId: string, stageId: string): Promise<ToolResult> {
  const pred = await awaitPrediction(await pollPredictionOnce(predictionId), `resume:${tool}`);
  const url = firstUrl(pred);
  const ext = tool.startsWith('image.') ? 'png' : tool.startsWith('video.') || tool === 'composite.overlay' ? 'mp4' : null;
  if (!ext) return { url };
  const ct = ext === 'png' ? 'image/png' : 'video/mp4';
  return { url: await persist(url, `effects/${runId}/${stageId}.${ext}`, ct) };
}

function firstUrl(pred: Record<string, unknown>): string {
  const out = pred.output as unknown;
  // Shapes seen in the wild: "url" | ["url"] | {files:["url"]} (magpai ffmpeg cog)
  const url = Array.isArray(out)
    ? out[0]
    : out && typeof out === 'object' && Array.isArray((out as { files?: unknown[] }).files)
      ? (out as { files: unknown[] }).files[0]
      : out;
  if (typeof url !== 'string') throw new Error(`no output url (shape: ${JSON.stringify(out).slice(0, 120)})`);
  return url;
}

/** Persist an ephemeral provider URL to durable storage; returns public URL. */
async function persist(url: string, keyPath: string, contentType: string): Promise<string> {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.39.3');
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  const { error } = await supabase.storage.from('video-clips').upload(keyPath, bytes, { contentType, upsert: true });
  if (error) return url; // fall back to ephemeral rather than failing the stage
  return supabase.storage.from('video-clips').getPublicUrl(keyPath).data.publicUrl;
}

async function callEdgeFn(name: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${name}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return await res.json();
}

// ── ffmpeg (rigid compositing) — same cog + convention as seamless-stitcher ──
// magpai cog contract: inputs land at /tmp/fileN; the command must write to a
// file literally named by the output1 param; Python .format() runs over the
// command so braces must be doubled.
const FFMPEG_COG_VERSION = 'efd0b79b577bcd58ae7d035bce9de5c4659a59e09faafac4d426d61c04249251';
async function runFfmpeg(command: string, inputs: Record<string, string>, outputName: string): Promise<string> {
  let cogCommand = command
    .replace(/\bfile([1-9])\b/g, '/tmp/file$1')
    .replace(/\boutput\.mp4\b/g, outputName);
  cogCommand = cogCommand.replace(/\{/g, '{{').replace(/\}/g, '}}');
  const pred = await replicateRun('/predictions', {
    version: FFMPEG_COG_VERSION,
    input: { command: cogCommand, output1: outputName, ...inputs },
  });
  return firstUrl(pred);
}

export interface ToolResult { url?: string; [k: string]: unknown }

export async function invokeTool(tool: ToolId, inputs: Record<string, unknown>, runId: string, stageId: string): Promise<ToolResult> {
  const stamp = `${runId}/${stageId}`;
  switch (tool) {
    // ── Stills ───────────────────────────────────────────────────────────
    case 'image.nano_banana': {
      const pred = await replicateRun('/models/google/nano-banana/predictions', {
        input: {
          prompt: inputs.prompt,
          ...(inputs.image_input ? { image_input: inputs.image_input } : {}),
          aspect_ratio: inputs.aspect_ratio ?? '16:9',
          output_format: 'png',
        },
      });
      return { url: await persist(firstUrl(pred), `effects/${stamp}.png`, 'image/png') };
    }
    case 'image.flux_ultra': {
      const pred = await replicateRun('/models/black-forest-labs/flux-1.1-pro-ultra/predictions', {
        input: { prompt: inputs.prompt, aspect_ratio: inputs.aspect_ratio ?? '16:9', output_format: 'png', safety_tolerance: 5 },
      });
      return { url: await persist(firstUrl(pred), `effects/${stamp}.png`, 'image/png') };
    }
    case 'image.kontext': {
      const pred = await replicateRun('/models/black-forest-labs/flux-kontext-pro/predictions', {
        input: { prompt: inputs.prompt, input_image: inputs.input_image, aspect_ratio: inputs.aspect_ratio ?? '16:9', output_format: 'png', safety_tolerance: 5 },
      });
      return { url: await persist(firstUrl(pred), `effects/${stamp}.png`, 'image/png') };
    }

    // ── Video generation ─────────────────────────────────────────────────
    case 'video.seedance': {
      const input: Record<string, unknown> = {
        prompt: inputs.prompt,
        duration: inputs.duration ?? 5,
        resolution: '1080p',
        aspect_ratio: inputs.aspect_ratio ?? '16:9',
        fps: 24,
        camera_fixed: inputs.camera_fixed ?? false,
        generate_audio: inputs.generate_audio ?? true,
        seed: inputs.seed ?? Math.floor(Math.random() * 2147483647),
      };
      if (inputs.image) input.image = inputs.image;
      if (inputs.last_frame_image) input.last_frame_image = inputs.last_frame_image;
      // SCHEMA RULE: reference_* cannot combine with first/last frame images.
      if (!input.image && !input.last_frame_image) {
        if (inputs.reference_images) input.reference_images = inputs.reference_images;
        if (inputs.reference_videos) input.reference_videos = inputs.reference_videos;
      }
      const pred = await replicateRun('/models/bytedance/seedance-2.0/predictions', { input }, 900_000);
      return { url: await persist(firstUrl(pred), `effects/${stamp}.mp4`, 'video/mp4') };
    }
    case 'video.veo': {
      const input: Record<string, unknown> = {
        prompt: inputs.prompt,
        duration: inputs.duration ?? 8,
        resolution: '1080p',
        aspect_ratio: inputs.aspect_ratio ?? '16:9',
        generate_audio: inputs.generate_audio ?? true,
      };
      if (inputs.image) input.image = inputs.image;
      if (inputs.last_frame) input.last_frame = inputs.last_frame;
      if (inputs.negative_prompt) input.negative_prompt = inputs.negative_prompt;
      const pred = await replicateRun('/models/google/veo-3.1-fast/predictions', { input }, 900_000);
      return { url: await persist(firstUrl(pred), `effects/${stamp}.mp4`, 'video/mp4') };
    }
    case 'video.kling': {
      const input: Record<string, unknown> = {
        prompt: inputs.prompt,
        negative_prompt: inputs.negative_prompt ?? '',
        duration: inputs.duration ?? 5,
        aspect_ratio: inputs.aspect_ratio ?? '16:9',
        mode: 'pro',
      };
      if (inputs.start_image) input.start_image = inputs.start_image;
      if (inputs.generate_audio) input.generate_audio = true;
      const pred = await replicateRun('/models/kwaivgi/kling-v3-video/predictions', { input }, 900_000);
      return { url: await persist(firstUrl(pred), `effects/${stamp}.mp4`, 'video/mp4') };
    }
    case 'video.wan_i2v': {
      const pred = await replicateRun('/models/wan-video/wan-2.7-i2v/predictions', {
        input: { prompt: inputs.prompt, image: inputs.image, duration: inputs.duration ?? 5, resolution: '1080p' },
      }, 900_000);
      return { url: await persist(firstUrl(pred), `effects/${stamp}.mp4`, 'video/mp4') };
    }
    case 'video.motion_control': {
      const pred = await replicateRun('/models/kwaivgi/kling-v3-motion-control/predictions', {
        input: { prompt: inputs.prompt ?? '', image: inputs.image, video: inputs.reference_video, character_orientation: inputs.orientation ?? 'image' },
      }, 900_000);
      return { url: await persist(firstUrl(pred), `effects/${stamp}.mp4`, 'video/mp4') };
    }

    // ── Video editing ────────────────────────────────────────────────────
    case 'video.aleph2': {
      const input: Record<string, unknown> = { video: inputs.video, prompt: inputs.prompt };
      if (inputs.reference_image) input.reference_image = inputs.reference_image;
      const pred = await replicateRun('/models/runwayml/aleph-2/predictions', { input }, 900_000);
      return { url: await persist(firstUrl(pred), `effects/${stamp}.mp4`, 'video/mp4') };
    }
    case 'video.kling_o1': {
      const pred = await replicateRun('/models/kwaivgi/kling-o1/predictions', {
        input: { video: inputs.video, prompt: inputs.prompt },
      }, 900_000);
      return { url: await persist(firstUrl(pred), `effects/${stamp}.mp4`, 'video/mp4') };
    }
    case 'video.wan_edit': {
      const pred = await replicateRun('/models/wan-video/wan-2.7-videoedit/predictions', {
        input: { video: inputs.video, prompt: inputs.prompt },
      }, 900_000);
      return { url: await persist(firstUrl(pred), `effects/${stamp}.mp4`, 'video/mp4') };
    }

    // ── Analysis ─────────────────────────────────────────────────────────
    case 'matte.sam2': {
      const pred = await replicateRun('/models/meta/sam-2/predictions', {
        input: { image: inputs.image, ...(inputs.points ? { points: inputs.points } : {}) },
      });
      return { url: firstUrl(pred) };
    }
    case 'depth.estimate': {
      const pred = await replicateRun('/models/chenxwh/depth-anything-v2/predictions', { input: { image: inputs.image } });
      return { url: firstUrl(pred) };
    }
    case 'frame.extract': {
      const res = await callEdgeFn('extract-video-frame', {
        videoUrl: inputs.video,
        position: inputs.position ?? 'last',
        projectId: inputs.projectId ?? null,
      });
      if (!res.frameUrl) throw new Error('frame extraction failed');
      return { url: String(res.frameUrl) };
    }

    case 'ui.render': {
      // Deterministic platform UI — authored layout code, not generation.
      // Realism + exact aspect ratio + slot rect exact BY CONSTRUCTION. Free.
      const res = await callEdgeFn('render-ui', {
        template: inputs.template,
        props: inputs.props ?? {},
        persistKey: `effects/${stamp}.png`,
      });
      if (!res.url) throw new Error('ui render failed');
      return { url: String(res.url), slotRect: res.slotRect, width: res.width, height: res.height };
    }

    // ── Rigid compositing ────────────────────────────────────────────────
    case 'composite.overlay': {
      // Pixel-locked compositing, two modes:
      //  'slot' (default): overlay (the video) is scaled INTO rect on base
      //    (the UI still) — feed-style players where chrome surrounds video.
      //  'chrome': base (the video) fills the frame; overlay (a transparent-
      //    background UI PNG) is laid ON TOP full-frame — full-bleed screens
      //    (TikTok/Reels/Netflix) where chrome floats over the video.
      const [x, y, w, h] = (inputs.rect as number[]) ?? [0, 0, 1920, 1080];
      const W = (inputs.width as number) ?? 1920, H = (inputs.height as number) ?? 1080;
      const dur = (inputs.durationSec as number) ?? 5;
      const chrome = inputs.mode === 'chrome';
      const baseIsImage = String(inputs.base).match(/\.(png|jpe?g|webp)(\?|$)/i);
      const baseIn = baseIsImage ? `-loop 1 -t ${dur} -i file1` : `-i file1`;
      const ovlIsImage = String(inputs.overlay).match(/\.(png|jpe?g|webp)(\?|$)/i);
      const ovlIn = ovlIsImage ? `-loop 1 -t ${dur} -i file2` : `-i file2`;
      const command = chrome
        ? `ffmpeg -y ${baseIn} ${ovlIn} -filter_complex "` +
          `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=24[base];` +
          `[1:v]scale=${W}:${H},setsar=1,format=rgba[ovl];` +
          `[base][ovl]overlay=0:0:shortest=0[v]" ` +
          `-map "[v]" ${baseIsImage ? '' : '-map 0:a? '}-c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p -t ${dur} output.mp4`
        : `ffmpeg -y ${baseIn} -i file2 -filter_complex "` +
          `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=24[base];` +
          `[1:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1[ovl];` +
          `[base][ovl]overlay=${x}:${y}:shortest=0[v]" ` +
          `-map "[v]" ${baseIsImage ? '' : '-map 0:a? '}-c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p -t ${dur} output.mp4`;
      const url = await runFfmpeg(command, { file1: String(inputs.base), file2: String(inputs.overlay) }, `composite_${stageId}.mp4`);
      return { url: await persist(url, `effects/${stamp}.mp4`, 'video/mp4') };
    }

    case 'composite.concat': {
      // Stitch N clips into one film (re-encode; normalizes size + fps so
      // heterogeneous seedance outputs concat cleanly). Audio carried per-clip.
      const clips = (inputs.clips as string[]) ?? [];
      if (clips.length < 2) return { url: clips[0] };
      const W = (inputs.width as number) ?? 1080, H = (inputs.height as number) ?? 1920;
      const files: Record<string, string> = {};
      const norm: string[] = [];
      clips.forEach((u, i) => {
        files[`file${i + 1}`] = u;
        norm.push(`[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=24[v${i}];[${i}:a]aresample=48000[a${i}]`);
      });
      const pairs = clips.map((_u, i) => `[v${i}][a${i}]`).join('');
      const command =
        `ffmpeg -y ${clips.map((_u, i) => `-i file${i + 1}`).join(' ')} -filter_complex "` +
        `${norm.join(';')};${pairs}concat=n=${clips.length}:v=1:a=1[v][a]" ` +
        `-map "[v]" -map "[a]" -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p -c:a aac output.mp4`;
      const url = await runFfmpeg(command, files, `film_${stageId}.mp4`);
      return { url: await persist(url, `effects/${stamp}.mp4`, 'video/mp4') };
    }

    // ── Audio ────────────────────────────────────────────────────────────
    case 'audio.tts': {
      const res = await callEdgeFn('generate-voice', { text: inputs.text, voiceId: inputs.voiceId, projectId: inputs.projectId ?? 'effect-run', shotId: stageId });
      return { url: String(res.audioUrl ?? '') };
    }
    case 'audio.music': {
      const res = await callEdgeFn('generate-music', { prompt: inputs.prompt, duration: inputs.duration ?? 20, projectId: inputs.projectId ?? 'effect-run' });
      return { url: String(res.musicUrl ?? res.audioUrl ?? '') };
    }
    case 'audio.sfx': {
      // returns raw audio; persist it
      const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/elevenlabs-sfx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
        body: JSON.stringify({ prompt: inputs.prompt, duration: inputs.duration ?? 3 }),
      });
      if (!res.ok) throw new Error(`sfx: ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.39.3');
      const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const path = `effects/${stamp}.wav`;
      await supabase.storage.from('video-clips').upload(path, bytes, { contentType: 'audio/wav', upsert: true });
      return { url: supabase.storage.from('video-clips').getPublicUrl(path).data.publicUrl };
    }

    // ── Critic ───────────────────────────────────────────────────────────
    case 'critic.vision': {
      const r = await completeLLM({
        systemPrompt:
          'You are a ruthless VFX supervisor doing quality control. Judge ONLY what is visible. ' +
          'Respond with ONE JSON object: {"pass": boolean, "score": 0-100, "failures": ["..."], "fix_hint": "..."}',
        userPrompt: String(inputs.contract),
        images: (inputs.images as string[]) ?? [],
        maxTokens: 800,
        temperature: 0.1,
        json: true,
      });
      try {
        const j = JSON.parse(r.text.match(/\{[\s\S]*\}/)?.[0] ?? r.text);
        return { pass: !!j.pass, score: Number(j.score ?? 0), failures: j.failures ?? [], fix_hint: j.fix_hint ?? '' };
      } catch {
        return { pass: false, score: 0, failures: ['critic returned unparseable output'], fix_hint: '' };
      }
    }

    default:
      throw new Error(`unknown tool: ${tool}`);
  }
}
