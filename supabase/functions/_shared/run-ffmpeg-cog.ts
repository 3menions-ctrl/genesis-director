/**
 * run-ffmpeg-cog — minimal, self-contained runner for the magpai-app/cog-ffmpeg
 * Replicate cog. Extracted so utility functions (e.g. brand-video-download) can
 * run a ONE-OFF ffmpeg command WITHOUT importing the render-critical
 * seamless-stitcher. Mirrors the cog conventions exactly:
 *   • inputs are referenced as fileN and auto-rewritten to /tmp/fileN
 *   • the command writes to `output1`, rewritten to the caller's outputName
 *   • literal { } are escaped (the cog runs command through Python .format())
 *
 * This is a faithful copy of seamless-stitcher's runFfmpeg — duplicated on
 * purpose so branding changes can never regress the render pipeline.
 */

export const FFMPEG_MODEL_VERSION =
  "efd0b79b577bcd58ae7d035bce9de5c4659a59e09faafac4d426d61c04249251";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runFfmpegCog(args: {
  replicateKey: string;
  command: string;
  inputs: Record<string, string>;
  outputName: string;
}): Promise<string> {
  if (!args.replicateKey) {
    throw new Error("REPLICATE_API_KEY not configured");
  }
  let cogCommand = args.command
    .replace(/\bfile([1-9])\b/g, "/tmp/file$1")
    .replace(/\boutput([1-2])\b/g, args.outputName);
  cogCommand = cogCommand.replace(/\{/g, "{{").replace(/\}/g, "}}");

  const submit = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.replicateKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: FFMPEG_MODEL_VERSION,
      input: { command: cogCommand, output1: args.outputName, ...args.inputs },
    }),
  });
  if (!submit.ok) {
    throw new Error(`replicate_submit_${submit.status}: ${(await submit.text()).slice(0, 200)}`);
  }
  const predictionId = (await submit.json()).id as string;
  if (!predictionId) throw new Error("no_prediction_id");

  const deadline = Date.now() + 240_000;
  let consecutiveFailures = 0;
  let lastStatus = "";
  while (Date.now() < deadline) {
    await sleep(3000);
    const pollRes = await fetch(
      `https://api.replicate.com/v1/predictions/${predictionId}`,
      { headers: { Authorization: `Bearer ${args.replicateKey}` } },
    );
    if (!pollRes.ok) {
      if (++consecutiveFailures >= 3) {
        throw new Error(`replicate_poll_failed_${pollRes.status}`);
      }
      continue;
    }
    consecutiveFailures = 0;
    const pred = await pollRes.json();
    lastStatus = pred.status;
    if (pred.status === "succeeded") {
      const out = pred.output?.files ?? pred.output;
      const url = Array.isArray(out) ? out[0] : out;
      if (typeof url === "string" && url.startsWith("http")) return url;
      throw new Error("succeeded_but_no_url");
    }
    if (pred.status === "failed" || pred.status === "canceled") {
      throw new Error(`replicate_${pred.status}: ${pred.error ?? "no detail"}`);
    }
  }
  throw new Error(`replicate_timeout_after_4m (last=${lastStatus})`);
}

/**
 * The "Made with Small Bridges" corner watermark command. A single drawtext
 * pass — persistent bottom-right `smallbridges.co` mark (CapCut-style): visible
 * the whole clip, unskippable, so every reposted free-tier clip advertises the
 * product. drawtext uses the cog's default font (same as the stitcher's proven
 * title overlays — no fontfile needed). Audio is copied through untouched.
 */
export function watermarkCommand(): string {
  return (
    `ffmpeg -i file1 -filter_complex ` +
    `"[0:v]drawtext=text='smallbridges.co':fontcolor=white@0.92:fontsize=h/28:` +
    `x=w-text_w-(h*0.04):y=h-text_h-(h*0.04):` +
    `box=1:boxcolor=black@0.35:boxborderw=12:` +
    `shadowcolor=black@0.55:shadowx=2:shadowy=2[outv]" ` +
    `-map "[outv]" -map "0:a?" ` +
    `-c:v libx264 -pix_fmt yuv420p -crf 20 -preset veryfast ` +
    `-c:a copy -movflags +faststart output1`
  );
}
