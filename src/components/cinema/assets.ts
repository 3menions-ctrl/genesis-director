/**
 * Asset URLs for the /launch immersive landing module.
 *
 * Hero = the stitched 6-clip Hoppy "park" immersive video (current project,
 * public). Gallery = cinematic showcase clips still served from the old project
 * bucket (public). Editor = the glossy editor-UI render. All are plain <video>
 * sources (no canvas pixel access), so cross-origin playback is fine.
 */

// ⭐ The scroll-scrubbed hero (avatar Hoppy, green park, 6 clips stitched).
// CLEAR re-encode (~5.3 Mbps, with audio) — crisp; shown as a raw <video>
// (no WebGL shader resampling) for explicit clarity. Old web cut was 2.6 Mbps.
export const HERO_VIDEO =
  "https://ywcwaumozoejierlfkgj.supabase.co/storage/v1/object/public/final-videos/8be6d9c9-776e-46af-9ad8-23ad41f0f99c/preserved/landing-hoppy-immersive-park-clear.mp4";

// Glossy editor / product-UI reveal. Re-pointed off the dead apex-studio.ai
// domain to a live clip in the current project bucket (apex host is gone).
export const EDITOR_VIDEO =
  "https://ywcwaumozoejierlfkgj.supabase.co/storage/v1/object/public/final-videos/8be6d9c9-776e-46af-9ad8-23ad41f0f99c/preserved/landing-hoppy-immersive-park-web.mp4";

// Avatar wave/hello. Re-pointed off the dead apex-studio.ai domain to the live
// Hoppy intro clip in the current project bucket.
export const AVATAR_VIDEO =
  "https://ywcwaumozoejierlfkgj.supabase.co/storage/v1/object/public/final-videos/8be6d9c9-776e-46af-9ad8-23ad41f0f99c/preserved/landing-hoppy-intro-web.mp4";

const GALLERY_BASE =
  "https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos";

// Hoppy character clips re-hosted in the current project bucket.
const CHAR_BASE =
  "https://ywcwaumozoejierlfkgj.supabase.co/storage/v1/object/public/final-videos/8be6d9c9-776e-46af-9ad8-23ad41f0f99c/preserved";

export interface GalleryClip {
  title: string;
  genre: string;
  src: string;
}

/** Cinematic range = "one prompt, any genre". */
export const GALLERY: GalleryClip[] = [
  { title: "Sunset Dreams on Winding Roads", genre: "Travel", src: `${GALLERY_BASE}/stitched_71e83837-9ae4-4e79-a4f2-599163741b03_1768354737035.mp4` },
  { title: "Whispers of the Enchanted Jungle", genre: "Nature", src: `${GALLERY_BASE}/stitched_9ee134ca-5526-4e7f-9c10-1345f7b7b01f_1768109298602.mp4` },
  { title: "Skyward Over Fiery Majesty", genre: "Aerial", src: `${GALLERY_BASE}/stitched_7434c756-78d3-4f68-8107-b205930027c4_1768120634478.mp4` },
  { title: "Haunted Whispers of the Past", genre: "Noir", src: `${GALLERY_BASE}/stitched_ed88401a-7a11-404c-acbc-55e375aee05d_1768166059131.mp4` },
  { title: "Whimsical Chocolate Adventures", genre: "Whimsy", src: `${GALLERY_BASE}/stitched_1b0ac63f-643a-4d43-b8ed-44b8083257ed_1768157346652.mp4` },
  { title: "Silent Vigil in Ruined Valor", genre: "Epic", src: `${GALLERY_BASE}/stitched_dc255261-7bc3-465f-a9ec-ef2acd47b4fb_1768124786072.mp4` },
  { title: "Shadows of the Predator", genre: "Wildlife", src: `${GALLERY_BASE}/stitched_5d530ba0-a1e7-4954-8d90-05ffb5a346c2_1768108186067.mp4` },
  { title: "Echoes of Desolation", genre: "Drama", src: `${GALLERY_BASE}/stitched_2e3503b6-a687-4d3e-bd97-9a1c264a7af2_1768153499834.mp4` },
  { title: "Hoppy in the Sunlit Park", genre: "Character", src: `${CHAR_BASE}/landing-hoppy-immersive-park-hq.mp4` },
  { title: "Hoppy's Morning Hello", genre: "Mascot", src: `${CHAR_BASE}/landing-hoppy-intro-web.mp4` },
];
