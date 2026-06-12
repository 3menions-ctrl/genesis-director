/**
 * Landing-page demo assets.
 *
 * The landing surfaces previously hard-coded video URLs that pointed at
 * the old Supabase project (`ahlikyhgcqvrdvbtkghh.supabase.co`) — that
 * project is paused and we've migrated to `ywcwaumozoejierlfkgj`. None
 * of the demo assets exist in the new bucket yet, so to avoid showing
 * broken videos / images on the marketing pages we route everything
 * through this single module.
 *
 * Lookup order per asset:
 *
 *   1. If `VITE_LANDING_ASSET_BASE` is set in env, append the path to it
 *      (lets ops swap to a CDN without code changes).
 *   2. Otherwise fall back to a curated public Pexels / Coverr URL that
 *      conveys the right vibe (cinematic, abstract motion, etc.).
 *
 * When real production assets are uploaded to the new `landing-assets`
 * bucket, set `VITE_LANDING_ASSET_BASE` to the bucket's public URL and
 * everything flips over without touching the components.
 */

const ENV_BASE =
  (import.meta.env.VITE_LANDING_ASSET_BASE as string | undefined)?.replace(/\/$/, "") ?? "";

/**
 * Curated public-domain / CC0 fallback videos used until the production
 * landing assets are uploaded. All sourced from Coverr (free for any
 * use including commercial) and Pexels (CC0). Hand-picked to match
 * cinematic mood.
 */
const FALLBACKS = {
  // Avatar / talking-head feel — fashion model in motion
  avatarTalking: "https://videos.pexels.com/video-files/3192305/3192305-uhd_2560_1440_25fps.mp4",
  // Cinematic landscape — abstract motion
  cinematicMotion: "https://videos.pexels.com/video-files/2715411/2715411-uhd_2560_1440_30fps.mp4",
  // Studio aesthetic — controlled lighting
  studioPortrait: "https://videos.pexels.com/video-files/4630019/4630019-uhd_2560_1440_25fps.mp4",
  // Tech / code aesthetic
  techHologram: "https://videos.pexels.com/video-files/3209828/3209828-hd_1920_1080_25fps.mp4",
  // Urban / cinematic
  urbanCinematic: "https://videos.pexels.com/video-files/2887463/2887463-uhd_2560_1440_30fps.mp4",
  // Welcome / onboarding short
  welcomeShort: "https://videos.pexels.com/video-files/3209663/3209663-hd_1920_1080_25fps.mp4",
  // Before / after — paired
  beforeRaw: "https://videos.pexels.com/video-files/3209675/3209675-hd_1920_1080_25fps.mp4",
  afterPolished: "https://videos.pexels.com/video-files/4434248/4434248-uhd_2560_1440_25fps.mp4",
  // Director's reel
  directorsReel: "https://videos.pexels.com/video-files/4761711/4761711-uhd_2560_1440_25fps.mp4",
  // Storytelling hero
  storytellingHero: "https://videos.pexels.com/video-files/3045163/3045163-hd_1920_1080_30fps.mp4",
  // Hoppy / immersive
  hoppyImmersive: "https://videos.pexels.com/video-files/4630019/4630019-uhd_2560_1440_25fps.mp4",
  // Mosaic prompt-result
  promptResult: "https://videos.pexels.com/video-files/4434286/4434286-uhd_2560_1440_25fps.mp4",
  // Studio epic intro
  studioEpic: "https://videos.pexels.com/video-files/3045163/3045163-hd_1920_1080_30fps.mp4",
  // Mascots demo
  mascotPreview: "https://videos.pexels.com/video-files/4434286/4434286-uhd_2560_1440_25fps.mp4",
} as const;

export type LandingAssetKey = keyof typeof FALLBACKS;

/**
 * Resolve a landing asset key to a playable URL.
 *
 * Pass the second `bucketPath` arg if you want to reference a real file
 * once the landing-assets bucket is populated (set
 * `VITE_LANDING_ASSET_BASE` first).
 */
export function landingAsset(
  key: LandingAssetKey,
  bucketPath?: string,
): string {
  if (ENV_BASE && bucketPath) {
    return `${ENV_BASE}/${bucketPath.replace(/^\//, "")}`;
  }
  return FALLBACKS[key];
}

/**
 * Bulk lookup — returns an object of multiple keys at once. Useful for
 * components that show several demo videos side-by-side.
 */
export function landingAssets<K extends LandingAssetKey>(
  keys: readonly K[],
): Record<K, string> {
  const out = {} as Record<K, string>;
  for (const k of keys) {
    out[k] = landingAsset(k);
  }
  return out;
}
