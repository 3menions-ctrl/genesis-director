/**
 * Lobby — /lobby
 *
 * The public front door. A bento-composed hangout designed to feel like
 * A24 met Apple WWDC met Letterboxd met TikTok. Mixed tile sizes, live
 * numbers, time-of-day adaptation, theatrical reveals on scroll.
 *
 * Sections (top → bottom):
 *   1.  Live presence bar — pulsing counts + live timecode
 *   2.  News marquee — auto-scrolling ticker
 *   3.  Hero band — time-of-day eyebrow + Fraunces headline
 *   4.  Stories rail — 10 vertical 9:16 story cards with auto-advance
 *   5.  Premiere — 21:9 cinema with "watching with N others"
 *   6.  Bento mosaic — 12 mixed-size tiles
 *   7.  Worlds rail + trending now
 *   8.  Creator of the week — editorial spotlight
 *   9.  Tutorial reel — "How they made it" quadrants
 *   10. Daily challenges (auth)
 *   11. Skill streak (auth)
 *   12. Featured techniques — 6 craft tiles
 *   13. Marketplace pulse — 3 trending atoms
 *   14. Community remixes — 3-col masonry
 *   15. News dispatch — typewriter platform updates
 *   16. Suggested people
 *   17. Drafts shelf (auth)
 *   18. Today in film history
 *   19. Director's note — rotating quotes
 *   20. Subscribe nudge — final hero
 *   21. Wander — cross-link rail
 *   22. Floating "Right now" widget — sticky bottom-right pill
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion, useScroll, useTransform } from "framer-motion";
import {
  Sparkles, Play, Heart, Wand2, Eye, Calendar, Flame, Clock,
  ArrowRight, Music2, ShoppingBag, Users as UsersIcon, Tv, Radio,
  MessageCircle, Trophy, Aperture, Move3D, Scissors, Wind, Palette,
  Lightbulb, Quote, ChevronLeft, ChevronRight, Bell, Mail, Zap,
  TrendingUp, Crown, Film, Camera, Headphones,
  ShoppingCart, X, Sun, Moon, Sunrise,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { TYPE_META, EASE_PREMIUM } from "@/lib/design-system";
import { EditorialEyebrow, EditorialHeadline } from "@/components/foundation/EditorialCanvas";
import { FoundationShell } from "@/components/foundation/FoundationShell";
import { usePageMeta } from "@/hooks/usePageMeta";
import { usePageTone, TONE_PRESETS } from "@/lib/page-tone";
import { useLiveRenderTimecode } from "@/hooks/useLiveRenderTimecode";
import { SuggestedPeopleRail } from "@/components/social/SuggestedPeopleRail";
import { ImmersiveTheater, type TheaterReel } from "@/components/social/ImmersiveTheater";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface ChannelWorld {
  id: string; slug: string; name: string; description: string | null;
  accent_hsl: string; glyph: string | null;
}
interface FeedRow {
  id: string; title: string; synopsis: string | null;
  video_url: string; thumbnail_url: string | null;
  duration_sec: number | null;
  world_slug: string | null;
  tags: string[];
  play_count: number; like_count: number; remix_count: number;
  is_featured: boolean;
  created_at: string;
  creator_id: string; creator_name: string | null; creator_avatar: string | null;
  world_name: string | null; world_accent: string | null; world_glyph: string | null;
}
interface DraftRow {
  id: string; title: string; status: string;
  thumbnail_url: string | null; updated_at: string;
}
interface DailyPrompt {
  prompt: { id: string; prompt_text: string; prompt_hint: string | null; world_slug: string | null; prompt_date: string };
  top_submissions: Array<{ reel_id: string; title: string; thumbnail_url: string | null; votes: number }>;
}
interface DailyChallengeRow {
  id: string; challenge_type: string; description: string;
  xp_reward: number; target_count: number; progress: number; completed: boolean;
}
interface ActivityDay { day: string; activity_count: number; }
interface RemixReel {
  id: string;
  title: string;
  thumbnail_url: string | null;
  video_url: string | null;
  remix_count: number;
  play_count: number;
  like_count: number;
  creator_id: string;
  creator_name?: string | null;
  creator_avatar?: string | null;
  world_accent?: string | null;
}
interface CreatorOfWeek {
  id: string;
  display_name: string;
  avatar_url: string | null;
  tagline: string;
  bio: string;
  reel_id: string;
  reel_title: string;
  reel_thumbnail: string | null;
  reel_video: string | null;
  total_plays: number;
  total_likes: number;
  follower_count: number;
}
interface Technique {
  id: string;
  title: string;
  oneLiner: string;
  hue: string;
  icon: typeof Aperture;
  gradient: string;
  seed: string;
}
interface StoryCard {
  id: string;
  eyebrow: string;
  title: string;
  hue: string;
  gradient: string;
  to?: string;
  onClick?: () => void;
  meta?: string;
  icon: typeof Sparkles;
}
interface MarketAtom {
  id: string;
  kind: "lut" | "music" | "template";
  title: string;
  creator: string;
  price: number;
  gradient: string;
  hue: string;
  buyers_today: number;
  trending: boolean;
}
interface FilmHistoryFact {
  day: number; // 1-31
  month: number; // 1-12
  year: number;
  title: string;
  blurb: string;
  director?: string;
}
interface NewsDispatchItem {
  kind: "feature" | "fix" | "community";
  text: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// TECHNIQUES — 6 hand-crafted craft moves
// ─────────────────────────────────────────────────────────────────────────────
const TECHNIQUES: Technique[] = [
  {
    id: "anamorphic-bokeh",
    title: "Anamorphic Bokeh",
    oneLiner: "Oval lens flare. Letterboxed soul. The widescreen breath of a Villeneuve frame.",
    hue: "215 100% 60%",
    icon: Aperture,
    gradient:
      "radial-gradient(120% 80% at 30% 30%, hsla(215,100%,55%,0.42) 0%, transparent 60%), radial-gradient(100% 80% at 80% 80%, hsla(285,75%,55%,0.30) 0%, transparent 60%), linear-gradient(135deg, hsl(225 60% 14%) 0%, hsl(215 70% 6%) 100%)",
    seed: "A close-up scene with shallow depth of field. Use anamorphic 2.39:1 framing with oval bokeh in the deep background. Practical neon highlights bloom into horizontal blue lens flares.",
  },
  {
    id: "dolly-zoom",
    title: "Dolly Zoom",
    oneLiner: "Vertigo. Background collapses while the face holds — a panic the camera invented.",
    hue: "0 80% 60%",
    icon: Move3D,
    gradient:
      "radial-gradient(130% 90% at 50% 30%, hsla(0,85%,55%,0.40) 0%, transparent 60%), radial-gradient(110% 80% at 50% 90%, hsla(35,90%,55%,0.28) 0%, transparent 65%), linear-gradient(180deg, hsl(0 35% 12%) 0%, hsl(0 25% 5%) 100%)",
    seed: "Dolly-zoom shot: the camera pushes in on the subject while zooming out, so the subject stays the same size but the background warps and collapses around them. Hold for 4 seconds of pure dread.",
  },
  {
    id: "match-cut",
    title: "Match Cut",
    oneLiner: "Two shapes rhyme. The bone becomes the spaceship. Editing as poetry.",
    hue: "45 95% 60%",
    icon: Scissors,
    gradient:
      "radial-gradient(120% 80% at 20% 50%, hsla(45,95%,55%,0.42) 0%, transparent 60%), radial-gradient(110% 80% at 80% 50%, hsla(195,90%,55%,0.28) 0%, transparent 65%), linear-gradient(90deg, hsl(40 50% 12%) 0%, hsl(195 45% 7%) 100%)",
    seed: "Two scenes joined by a match cut: end the first shot with a circular shape (sun, eye, plate) and open the next with the same shape in a wholly different context. Continuity through geometry.",
  },
  {
    id: "whip-pan",
    title: "Whip Pan",
    oneLiner: "A blur that swallows the cut. From one room to the next in a single breath.",
    hue: "160 70% 55%",
    icon: Wind,
    gradient:
      "radial-gradient(150% 100% at 0% 50%, hsla(160,70%,55%,0.40) 0%, transparent 65%), radial-gradient(120% 90% at 100% 50%, hsla(195,95%,60%,0.32) 0%, transparent 65%), linear-gradient(105deg, hsl(160 50% 10%) 0%, hsl(195 50% 6%) 100%)",
    seed: "Whip-pan transition: the camera snaps horizontally at high speed, smearing the frame into a motion-blur streak, then settles in a completely new location. Used twice across the scene.",
  },
  {
    id: "color-story",
    title: "Color Story",
    oneLiner: "Teal and orange. Sodium-vapor green. One palette per act — feeling rendered as light.",
    hue: "285 75% 65%",
    icon: Palette,
    gradient:
      "radial-gradient(130% 90% at 30% 30%, hsla(285,75%,60%,0.42) 0%, transparent 60%), radial-gradient(110% 80% at 80% 80%, hsla(28,90%,55%,0.32) 0%, transparent 60%), linear-gradient(135deg, hsl(285 40% 12%) 0%, hsl(28 40% 7%) 100%)",
    seed: "Establish a strict color story across three shots: cool tungsten interior → sodium-vapor amber transition → blue-hour exterior. Every frame must carry one of these three palettes, no neutral tones.",
  },
  {
    id: "light-motif",
    title: "Light Motif",
    oneLiner: "A single key light that follows the character. Mood as a recurring character.",
    hue: "45 95% 70%",
    icon: Lightbulb,
    gradient:
      "radial-gradient(120% 90% at 50% 20%, hsla(45,95%,65%,0.45) 0%, transparent 60%), radial-gradient(100% 80% at 50% 100%, hsla(220,80%,40%,0.32) 0%, transparent 65%), linear-gradient(180deg, hsl(45 45% 13%) 0%, hsl(220 50% 6%) 100%)",
    seed: "Use a single recurring motivated light source — a swinging bulb, a phone screen, a flickering neon sign — that follows the character through three locations. Same lamp, three different rooms.",
  },
];

// 12 hand-picked filmmaker quotes.
const QUOTES: Array<{ text: string; who: string }> = [
  { text: "A film is — or should be — more like music than like fiction.", who: "Stanley Kubrick" },
  { text: "Cinema is a matter of what's in the frame and what's out.", who: "Martin Scorsese" },
  { text: "Film is a petrified fountain of thought.", who: "Jean Cocteau" },
  { text: "Cinema is the most beautiful fraud in the world.", who: "Jean-Luc Godard" },
  { text: "Time itself becomes a film's true material.", who: "Andrei Tarkovsky" },
  { text: "There is no logic at all. There is only feeling.", who: "Wong Kar-wai" },
  { text: "Cinema should make you forget you're sitting in a theater.", who: "Roman Polanski" },
  { text: "I don't paint dreams or nightmares, I paint my own reality.", who: "David Lynch" },
  { text: "The only way to make a film is to have a question.", who: "Francis Ford Coppola" },
  { text: "If it can be written, or thought, it can be filmed.", who: "Stanley Kubrick" },
  { text: "Cinema is a mirror by which we often see ourselves.", who: "Alejandro Iñárritu" },
  { text: "I steal from every movie ever made.", who: "Quentin Tarantino" },
];

// 7 directorial sparks, rotated by day-of-year.
const SPARKS: Array<{ headline: string; hint: string; seed: string }> = [
  { headline: "Today, frame light through glass.",         hint: "One shot. The light source lives behind a window, a bottle, or a lens.",         seed: "A scene where the key light passes through a translucent object — water glass, frosted window, sheer curtain — casting refracted patterns across the subject's face." },
  { headline: "Today, hold a face for ten seconds.",       hint: "No cuts. No dialogue. Just the room learning the face.",                          seed: "A single locked-off close-up of one face held for ten seconds. Ambient sound only. The reveal lives in micro-expressions — let the silence do the work." },
  { headline: "Today, let the prop be the protagonist.",   hint: "A teacup. A switchblade. A photograph. Tell the story through the object.",       seed: "A scene where an inanimate object — a teacup, a folded letter, a single key — is the true subject. The humans are framing devices. The camera returns to the object three times." },
  { headline: "Today, write a scene in monochrome.",       hint: "Strip the color. Find the value contrast that survives.",                         seed: "A high-contrast monochrome scene rendered in pure black and white. No greys in the highlights or shadows. Every composition built on silhouette and rim light." },
  { headline: "Today, end a scene a half-beat early.",     hint: "Cut while they're still mid-thought. Let the audience finish it.",                seed: "A scene that ends on the breath before the resolution. The cut lands on the inhale, not the line. The next scene picks up much later, somewhere unexpected." },
  { headline: "Today, shoot the rain, not the people.",    hint: "The weather is the cast. The bodies are background.",                              seed: "An exterior scene where weather — rain, snow, wind, fog — is the dominant subject. People exist only as silhouettes within it. The frame belongs to the storm." },
  { headline: "Today, mirror the first and last shot.",    hint: "Bookend the scene with the same composition, one tiny detail changed.",            seed: "The opening and closing shots use identical framing and blocking, but a single element has shifted — a chair moved, a coat gone, a light switched on. The scene's truth lives in that delta." },
];

function todaySpark(): typeof SPARKS[number] {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = (d.getTime() - start.getTime()) + ((start.getTimezoneOffset() - d.getTimezoneOffset()) * 60 * 1000);
  const day = Math.floor(diff / (1000 * 60 * 60 * 24));
  return SPARKS[day % SPARKS.length];
}

const WORLDS_FALLBACK: ChannelWorld[] = [
  { id: "1", slug: "noir",   name: "Noir",          description: null, accent_hsl: "38 80% 60%",   glyph: "◐" },
  { id: "2", slug: "scifi",  name: "Sci-Fi",        description: null, accent_hsl: "213 100% 60%", glyph: "◊" },
  { id: "3", slug: "comedy", name: "Comedy",        description: null, accent_hsl: "14 90% 60%",   glyph: "★" },
  { id: "4", slug: "docu",   name: "Documentary",   description: null, accent_hsl: "160 60% 50%",  glyph: "◯" },
  { id: "5", slug: "music",  name: "Music videos",  description: null, accent_hsl: "280 70% 65%",  glyph: "▲" },
  { id: "6", slug: "experi", name: "Experimental",  description: null, accent_hsl: "0 0% 70%",     glyph: "✦" },
];

const DEMO_REELS: FeedRow[] = [
  { id: "demo-1", title: "Stillwater · the cassette tape",     synopsis: null, video_url: "", thumbnail_url: "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1200&q=80", duration_sec: 47, world_slug: "noir",   tags: [], play_count: 2841, like_count: 412, remix_count: 18, is_featured: true,  created_at: new Date().toISOString(), creator_id: "demo-1", creator_name: "Vela Reyes",   creator_avatar: null, world_name: "Noir",          world_accent: "38 80% 60%",   world_glyph: "◐" },
  { id: "demo-2", title: "Ground control to Earl Grey",        synopsis: null, video_url: "", thumbnail_url: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1200&q=80", duration_sec: 32, world_slug: "scifi",  tags: [], play_count: 1823, like_count: 276, remix_count: 11, is_featured: false, created_at: new Date().toISOString(), creator_id: "demo-2", creator_name: "Iko Marvell",  creator_avatar: null, world_name: "Sci-Fi",        world_accent: "213 100% 60%", world_glyph: "◊" },
  { id: "demo-3", title: "Hot soup for one",                   synopsis: null, video_url: "", thumbnail_url: "https://images.unsplash.com/photo-1547573854-74d2a71d0826?auto=format&fit=crop&w=1200&q=80", duration_sec: 24, world_slug: "comedy", tags: [], play_count: 4129, like_count: 893, remix_count: 42, is_featured: false, created_at: new Date().toISOString(), creator_id: "demo-3", creator_name: "Theo Park",    creator_avatar: null, world_name: "Comedy",        world_accent: "14 90% 60%",   world_glyph: "★" },
  { id: "demo-4", title: "The librarian who paints",           synopsis: null, video_url: "", thumbnail_url: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=1200&q=80", duration_sec: 65, world_slug: "docu",   tags: [], play_count: 1208, like_count: 198, remix_count: 6,  is_featured: false, created_at: new Date().toISOString(), creator_id: "demo-4", creator_name: "Aiyana Wells", creator_avatar: null, world_name: "Documentary",   world_accent: "160 60% 50%",  world_glyph: "◯" },
  { id: "demo-5", title: "Lemon, neon, three breaths",         synopsis: null, video_url: "", thumbnail_url: "https://images.unsplash.com/photo-1571330735066-03aaa9429d89?auto=format&fit=crop&w=1200&q=80", duration_sec: 38, world_slug: "music",  tags: [], play_count: 3245, like_count: 620, remix_count: 24, is_featured: false, created_at: new Date().toISOString(), creator_id: "demo-5", creator_name: "Cassia Roe",   creator_avatar: null, world_name: "Music videos",  world_accent: "280 70% 65%",  world_glyph: "▲" },
  { id: "demo-6", title: "Glass moth — first sequence",        synopsis: null, video_url: "", thumbnail_url: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1200&q=80", duration_sec: 28, world_slug: "experi", tags: [], play_count: 967,  like_count: 134, remix_count: 4,  is_featured: false, created_at: new Date().toISOString(), creator_id: "demo-6", creator_name: "Pax Wren",     creator_avatar: null, world_name: "Experimental",  world_accent: "0 0% 70%",     world_glyph: "✦" },
];

// Marketplace demo data — FUTURE: hook into `atom_listings` table when ready.
const MARKET_ATOMS: MarketAtom[] = [
  {
    id: "lut-noir-sodium",
    kind: "lut",
    title: "Sodium-vapor noir",
    creator: "Vela Reyes",
    price: 12,
    hue: "38 90% 60%",
    gradient: "radial-gradient(120% 80% at 30% 30%, hsla(38,90%,55%,0.42) 0%, transparent 60%), linear-gradient(135deg, hsl(35 45% 14%) 0%, hsl(28 45% 6%) 100%)",
    buyers_today: 37,
    trending: true,
  },
  {
    id: "music-blue-hour",
    kind: "music",
    title: "Blue hour, slow strings",
    creator: "Cassia Roe",
    price: 18,
    hue: "215 100% 65%",
    gradient: "radial-gradient(120% 80% at 30% 30%, hsla(215,100%,55%,0.42) 0%, transparent 60%), linear-gradient(135deg, hsl(215 50% 12%) 0%, hsl(225 45% 5%) 100%)",
    buyers_today: 24,
    trending: false,
  },
  {
    id: "template-empty-room",
    kind: "template",
    title: "The empty room template",
    creator: "Theo Park",
    price: 0,
    hue: "285 75% 65%",
    gradient: "radial-gradient(120% 80% at 30% 30%, hsla(285,75%,55%,0.42) 0%, transparent 60%), linear-gradient(135deg, hsl(285 40% 12%) 0%, hsl(265 45% 5%) 100%)",
    buyers_today: 142,
    trending: true,
  },
];

// Hand-curated film-history facts. Lookup table by month → array.
// FUTURE: pull from a `film_history_facts` table.
const FILM_HISTORY: Record<number, FilmHistoryFact[]> = {
  1: [
    { day: 5,  month: 1,  year: 1922, title: "Nosferatu begins shooting",            blurb: "Murnau's unauthorized Dracula adaptation starts production — the silhouette that founded horror cinema.", director: "F. W. Murnau" },
    { day: 12, month: 1,  year: 1994, title: "Pulp Fiction premieres at Cannes",     blurb: "Tarantino's nonlinear crime mosaic wins the Palme d'Or, rewriting what mainstream cinema could look like.", director: "Quentin Tarantino" },
    { day: 24, month: 1,  year: 1962, title: "Lawrence of Arabia premieres",         blurb: "Lean's desert epic — 70mm Panavision, no women in the cast, four years of editing.", director: "David Lean" },
    { day: 28, month: 1,  year: 1958, title: "Vertigo enters post-production",       blurb: "Hitchcock pioneers the dolly-zoom that would become every panic attack in cinema.", director: "Alfred Hitchcock" },
  ],
  2: [
    { day: 3,  month: 2,  year: 1959, title: "Hiroshima mon amour at Cannes",        blurb: "Resnais and Duras invent modernist cinema — a love story remembered in fragments.", director: "Alain Resnais" },
    { day: 14, month: 2,  year: 2014, title: "The Grand Budapest Hotel premieres",   blurb: "Anderson stacks three aspect ratios — 1.37 / 1.85 / 2.35 — one per era of his nested story.", director: "Wes Anderson" },
    { day: 22, month: 2,  year: 1980, title: "Empire Strikes Back wraps",            blurb: "Kershner finishes shooting; ILM begins inventing modern matte painting to finish the sky.", director: "Irvin Kershner" },
  ],
  3: [
    { day: 6,  month: 3,  year: 1972, title: "The Godfather opens wide",             blurb: "Coppola's gangster opera — shot in two-stop underexposure to make the shadows feel sacred.", director: "Francis Ford Coppola" },
    { day: 14, month: 3,  year: 1994, title: "Three Colors: Red premieres",          blurb: "Kieślowski finishes his trilogy — red lights, red coats, red phone lines, all the way home.", director: "Krzysztof Kieślowski" },
    { day: 25, month: 3,  year: 2004, title: "Eternal Sunshine releases",            blurb: "Gondry & Kaufman build memory-erasure into the architecture of the frame itself.", director: "Michel Gondry" },
  ],
  4: [
    { day: 2,  month: 4,  year: 1968, title: "2001: A Space Odyssey premieres",      blurb: "Kubrick's match-cut from bone to spaceship — four million years in twenty-four frames.", director: "Stanley Kubrick" },
    { day: 17, month: 4,  year: 1997, title: "Lost Highway opens",                   blurb: "Lynch hands the camera to Patricia Arquette and lets the second act become a different film.", director: "David Lynch" },
    { day: 29, month: 4,  year: 1955, title: "The Night of the Hunter premieres",    blurb: "Charles Laughton's only film. Tattooed knuckles. Black-and-white as theology.", director: "Charles Laughton" },
  ],
  5: [
    { day: 7,  month: 5,  year: 2001, title: "Mulholland Drive at Cannes",           blurb: "Lynch repurposes a failed pilot into a feature — the Hollywood dream as the Hollywood horror.", director: "David Lynch" },
    { day: 16, month: 5,  year: 1980, title: "The Shining opens",                    blurb: "Kubrick's steadicam runs through the Overlook — Garrett Brown's rig redefines spatial dread.", director: "Stanley Kubrick" },
    { day: 24, month: 5,  year: 1997, title: "Princess Mononoke screens for press",  blurb: "Miyazaki demands hand-drawn forest cels. Each leaf moves on a different cycle.", director: "Hayao Miyazaki" },
  ],
  6: [
    { day: 5,  month: 6,  year: 1968, title: "Rosemary's Baby releases",             blurb: "Polanski shoots the apartment in wide-angle so it always feels too small for what's inside.", director: "Roman Polanski" },
    { day: 11, month: 6,  year: 1982, title: "Blade Runner opens",                   blurb: "Scott layers steam, neon, fan-blade light. Vangelis scores it on a Yamaha CS-80.", director: "Ridley Scott" },
    { day: 15, month: 6,  year: 1997, title: "Lost Highway hits home video",         blurb: "Pete's bedroom scene — the woman is a memory she hasn't had yet.", director: "David Lynch" },
    { day: 21, month: 6,  year: 2005, title: "Batman Begins releases",               blurb: "Nolan shoots Gotham in IMAX for the first time — practical cars, no green screen for the chase.", director: "Christopher Nolan" },
    { day: 28, month: 6,  year: 2017, title: "Okja debuts on streaming",             blurb: "Bong Joon-ho's tonal whiplash — slapstick to slaughterhouse in a single dissolve.", director: "Bong Joon-ho" },
  ],
  7: [
    { day: 2,  month: 7,  year: 1986, title: "Aliens releases",                      blurb: "Cameron pulls the pulse rifle off a sketch napkin. Practical squibs only.", director: "James Cameron" },
    { day: 16, month: 7,  year: 2010, title: "Inception opens",                      blurb: "Nolan shoots the hallway fight by rotating a literal hallway. No CG.", director: "Christopher Nolan" },
    { day: 21, month: 7,  year: 2017, title: "Dunkirk releases",                     blurb: "Three timelines, three durations — one week, one day, one hour — converging on the beach.", director: "Christopher Nolan" },
  ],
  8: [
    { day: 6,  month: 8,  year: 1965, title: "Pierrot le Fou shoots",                blurb: "Godard hands Belmondo a paint brush and tells him to be Picasso for the camera.", director: "Jean-Luc Godard" },
    { day: 15, month: 8,  year: 1986, title: "Stand By Me releases",                 blurb: "Reiner shoots boys on a train track. Kodak 5247. The summer that ends every summer.", director: "Rob Reiner" },
    { day: 25, month: 8,  year: 2000, title: "Yi Yi releases",                       blurb: "Edward Yang's quiet epic — a Taipei family across three generations, told in long lenses.", director: "Edward Yang" },
  ],
  9: [
    { day: 8,  month: 9,  year: 2003, title: "Lost in Translation premieres",        blurb: "Sofia Coppola whispers something we never hear. The film ends in that ear.", director: "Sofia Coppola" },
    { day: 17, month: 9,  year: 1993, title: "Three Colors: Blue at Venice",         blurb: "Kieślowski drowns the screen in a single hue. Grief made literal.", director: "Krzysztof Kieślowski" },
    { day: 24, month: 9,  year: 1960, title: "Breathless opens in US",               blurb: "Godard breaks the 180-line. The jump cut becomes a permanent verb.", director: "Jean-Luc Godard" },
  ],
  10: [
    { day: 5,  month: 10, year: 1962, title: "Dr. No releases",                      blurb: "Maurice Binder fires the gun-barrel sequence — pinhole camera through a real rifle.", director: "Terence Young" },
    { day: 14, month: 10, year: 1994, title: "Pulp Fiction releases wide",           blurb: "Tarantino arranges three stories in a Möbius strip. Vincent dies in act two and lives in act three.", director: "Quentin Tarantino" },
    { day: 26, month: 10, year: 1979, title: "The Tin Drum opens in US",             blurb: "Schlöndorff films a boy who refuses to grow. The drum keeps time the body won't.", director: "Volker Schlöndorff" },
  ],
  11: [
    { day: 3,  month: 11, year: 1976, title: "Taxi Driver releases",                 blurb: "Scorsese tells Bernard Herrmann to score it like a Western. Two months later Herrmann dies.", director: "Martin Scorsese" },
    { day: 11, month: 11, year: 2016, title: "Arrival releases",                     blurb: "Villeneuve shoots in stark Quebec light. Bradford Young underexposes everything by a stop.", director: "Denis Villeneuve" },
    { day: 22, month: 11, year: 1995, title: "Toy Story opens",                      blurb: "Pixar's first feature. Every shot rendered overnight on a SPARCstation farm.", director: "John Lasseter" },
  ],
  12: [
    { day: 4,  month: 12, year: 1948, title: "Bicycle Thieves opens",                blurb: "De Sica casts a factory worker as the father. Neorealism becomes a permanent verb.", director: "Vittorio De Sica" },
    { day: 14, month: 12, year: 1939, title: "Gone with the Wind premieres",         blurb: "Fleming inherits Cukor's set. The Atlanta-burning sequence: the studio's old backlots literally on fire.", director: "Victor Fleming" },
    { day: 19, month: 12, year: 2001, title: "Fellowship of the Ring opens",         blurb: "Jackson shoots New Zealand for two years straight. Howard Shore writes 12 hours of music.", director: "Peter Jackson" },
    { day: 25, month: 12, year: 2019, title: "Uncut Gems opens",                     blurb: "The Safdies layer four conversations into one mix. Sandler never sleeps for 130 minutes.", director: "Josh & Benny Safdie" },
  ],
};

function todayHistoryFact(): FilmHistoryFact | null {
  const d = new Date();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const facts = FILM_HISTORY[month] ?? [];
  if (facts.length === 0) return null;
  // Find the fact closest to today (or wrap to first).
  const sorted = [...facts].sort((a, b) => Math.abs(a.day - day) - Math.abs(b.day - day));
  return sorted[0] ?? null;
}

// 5 hand-written news dispatch lines that "type out".
const NEWS_DISPATCH: NewsDispatchItem[] = [
  { kind: "feature",   text: "Sora 2 engine landed · 60fps render added · 4K Ultra unlocked for Pro" },
  { kind: "fix",       text: "Timeline filmstrip now renders real frames instead of canvas-extracted images" },
  { kind: "community", text: "287 reels published in the last hour · 142 directors started a streak this week" },
  { kind: "feature",   text: "Inspector now scrolls when content overflows · abort button on in-flight shots" },
  { kind: "community", text: "Maya Reyes hit 10k followers · Theo Park's remix broke into the trending top 5" },
];

// Marquee headlines — rotated for the news ticker.
const MARQUEE_LINES: string[] = [
  "Maya Reyes published Hot soup for one",
  "Sora 2 now available",
  "60fps render added",
  "4K Ultra unlocked",
  "287 reels published in the last hour",
  "Theo Park's remix hit 10k views",
  "New LUT pack: Sodium-vapor noir",
  "Daily Sketch · the room that isn't there",
];

// ─────────────────────────────────────────────────────────────────────────────
// Time-of-day adaptation
// ─────────────────────────────────────────────────────────────────────────────
type TimeSlot = "morning" | "afternoon" | "evening" | "night";

interface TimeSlotConfig {
  slot: TimeSlot;
  eyebrow: string;
  headline: string;
  hue: string;
  Icon: typeof Sun;
}

function currentTimeSlot(): TimeSlot {
  const h = new Date().getHours();
  if (h >= 6  && h < 12) return "morning";
  if (h >= 12 && h < 18) return "afternoon";
  if (h >= 18 && h < 24) return "evening";
  return "night";
}

function timeSlotConfig(slot: TimeSlot): TimeSlotConfig {
  switch (slot) {
    case "morning":
      return { slot, eyebrow: "Today's first frame", headline: "The morning cut.",   hue: "35 95% 65%", Icon: Sunrise };
    case "afternoon":
      return { slot, eyebrow: "The matinée",         headline: "The afternoon cut.", hue: "45 95% 60%", Icon: Sun };
    case "evening":
      return { slot, eyebrow: "Tonight's premiere",  headline: "Tonight's room.",    hue: "215 100% 65%", Icon: Moon };
    case "night":
      return { slot, eyebrow: "After hours",         headline: "After hours.",       hue: "280 70% 65%",  Icon: Moon };
  }
}

function formatWallclock(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const wd = d.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase();
  return `${hh}:${mm}:${ss} · ${wd}`;
}

function driftedCount(base: number, amplitude: number, periodMs: number, t = Date.now()): number {
  return Math.round(base + amplitude * Math.sin((t / periodMs) * Math.PI * 2));
}

// ─────────────────────────────────────────────────────────────────────────────
// Lobby — the surface
// ─────────────────────────────────────────────────────────────────────────────
export default function Lobby() {
  usePageMeta({
    title: "Lobby — Small Bridges",
    description: "Tonight's room. Community films, daily sketch, music, market — all in one place.",
  });
  usePageTone(TONE_PRESETS.lobby);
  const reducedMotion = useReducedMotion();
  const { user } = useAuth();
  const navigate = useNavigate();
  const liveTimecode = useLiveRenderTimecode();
  const slotConfig = useMemo(() => timeSlotConfig(currentTimeSlot()), []);
  const spark = useMemo(() => todaySpark(), []);
  const historyFact = useMemo(() => todayHistoryFact(), []);

  // Wallclock that ticks every second.
  const [wallclock, setWallclock] = useState(() => formatWallclock(new Date()));
  useEffect(() => {
    const t = setInterval(() => setWallclock(formatWallclock(new Date())), 1000);
    return () => clearInterval(t);
  }, []);

  // Live presence counters — drift every 5s.
  const [presence, setPresence] = useState(() => ({
    directors: driftedCount(247, 32, 1000 * 60 * 4),
    rendering: driftedCount(12, 6, 1000 * 60 * 2),
    watching:  driftedCount(84, 22, 1000 * 60 * 3),
    framesPerHour: driftedCount(1420, 180, 1000 * 60 * 6),
  }));
  useEffect(() => {
    const t = setInterval(() => {
      setPresence({
        directors: driftedCount(247, 32, 1000 * 60 * 4),
        rendering: driftedCount(12, 6, 1000 * 60 * 2),
        watching:  driftedCount(84, 22, 1000 * 60 * 3),
        framesPerHour: driftedCount(1420, 180, 1000 * 60 * 6),
      });
    }, 5000);
    return () => clearInterval(t);
  }, []);

  // Theater state.
  const [theaterReel, setTheaterReel] = useState<TheaterReel | null>(null);
  const openTheater = useCallback((r: FeedRow) => {
    setTheaterReel({
      id: r.id, title: r.title, video_url: r.video_url,
      thumbnail_url: r.thumbnail_url, play_count: r.play_count,
      like_count: r.like_count, remix_count: r.remix_count,
      creator_id: r.creator_id, creator_name: r.creator_name,
      creator_avatar: r.creator_avatar, world_name: r.world_name,
      world_accent: r.world_accent, world_glyph: r.world_glyph,
    });
  }, []);
  const closeTheater = useCallback(() => setTheaterReel(null), []);

  const [worlds, setWorlds] = useState<ChannelWorld[]>(WORLDS_FALLBACK);
  const [feed, setFeed] = useState<FeedRow[]>(DEMO_REELS);
  const [usingDemo, setUsingDemo] = useState(true);
  const [activeWorld, setActiveWorld] = useState<string>("all");
  const [prompt, setPrompt] = useState<DailyPrompt | null>(null);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [challenges, setChallenges] = useState<DailyChallengeRow[]>([]);
  const [activity, setActivity] = useState<ActivityDay[]>([]);
  const [remixes, setRemixes] = useState<RemixReel[]>([]);
  const [loadingRemix, setLoadingRemix] = useState(true);
  const [loading, setLoading] = useState(true);
  const [creatorOfWeek, setCreatorOfWeek] = useState<CreatorOfWeek | null>(null);
  const [nowEditingCount, setNowEditingCount] = useState<number>(3);

  // Now editing — try a presence table; fall back to drift.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { count } = await supabase
          .from("editor_presence" as never)
          .select("user_id", { count: "exact", head: true });
        if (!cancelled && typeof count === "number" && count > 0) {
          setNowEditingCount(count);
          return;
        }
      } catch { /* graceful fallback */ }
      if (!cancelled) setNowEditingCount(driftedCount(7, 4, 1000 * 60 * 2));
    })();
    const t = setInterval(() => {
      setNowEditingCount((c) => Math.max(1, c + (Math.random() > 0.5 ? 1 : -1)));
    }, 12000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  // Load worlds + reels.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [worldsRes, reelsRes] = await Promise.all([
          supabase.from("channel_worlds" as never).select("*").order("name"),
          supabase.from("published_reels" as never)
            .select("id, title, synopsis, video_url, thumbnail_url, duration_sec, world_slug, tags, play_count, like_count, remix_count, is_featured, created_at, creator_id")
            .eq("is_taken_down", false)
            .order("play_count", { ascending: false })
            .limit(30),
        ]);
        if (cancelled) return;

        if (worldsRes.data && (worldsRes.data as ChannelWorld[]).length > 0) {
          setWorlds(worldsRes.data as ChannelWorld[]);
        }

        const reels = (reelsRes.data ?? []) as Array<Omit<FeedRow, "creator_name" | "creator_avatar" | "world_name" | "world_accent" | "world_glyph">>;
        if (reels.length === 0) return;

        const creatorIds = Array.from(new Set(reels.map((r) => r.creator_id))).filter(Boolean);
        const profilesById = new Map<string, { display_name: string | null; avatar_url: string | null }>();
        if (creatorIds.length > 0) {
          const { data: profs } = await supabase
            .from("profiles_public" as never)
            .select("id, display_name, avatar_url")
            .in("id", creatorIds);
          for (const p of ((profs ?? []) as Array<{ id: string; display_name: string | null; avatar_url: string | null }>)) {
            profilesById.set(p.id, p);
          }
        }

        const worldsBySlug = new Map<string, ChannelWorld>();
        for (const w of ((worldsRes.data ?? WORLDS_FALLBACK) as ChannelWorld[])) worldsBySlug.set(w.slug, w);

        const decorated: FeedRow[] = reels.map((r) => {
          const p = profilesById.get(r.creator_id);
          const w = r.world_slug ? worldsBySlug.get(r.world_slug) : undefined;
          return {
            ...r,
            tags:           (r as FeedRow).tags ?? [],
            creator_name:   p?.display_name ?? null,
            creator_avatar: p?.avatar_url ?? null,
            world_name:     w?.name ?? null,
            world_accent:   w?.accent_hsl ?? null,
            world_glyph:    w?.glyph ?? null,
          };
        });
        if (cancelled) return;
        setFeed(decorated);
        setUsingDemo(false);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[Lobby] feed load failed, using demos", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Creator of the week — pick the highest-liked recent reel and decorate.
  // FUTURE: dedicated `creator_of_week` table.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("published_reels" as never)
          .select("id, title, thumbnail_url, video_url, play_count, like_count, creator_id")
          .eq("is_taken_down", false)
          .order("like_count", { ascending: false })
          .limit(1);
        if (cancelled) return;
        const reels = (data ?? []) as Array<{ id: string; title: string; thumbnail_url: string | null; video_url: string; play_count: number; like_count: number; creator_id: string }>;
        if (reels.length === 0) return;
        const top = reels[0];
        const { data: profile } = await supabase
          .from("profiles_public" as never)
          .select("id, display_name, avatar_url, tagline, bio, follower_count")
          .eq("id", top.creator_id)
          .maybeSingle();
        const p = profile as { display_name: string | null; avatar_url: string | null; tagline: string | null; bio: string | null; follower_count: number | null } | null;
        if (cancelled || !p) return;
        setCreatorOfWeek({
          id: top.creator_id,
          display_name: p.display_name ?? "Untitled director",
          avatar_url: p.avatar_url,
          tagline: p.tagline ?? "Directing in the dark.",
          bio: p.bio ?? "Their work feels like a room you've walked past at night and remembered for years.",
          reel_id: top.id,
          reel_title: top.title,
          reel_thumbnail: top.thumbnail_url,
          reel_video: top.video_url,
          total_plays: top.play_count,
          total_likes: top.like_count,
          follower_count: p.follower_count ?? 0,
        });
      } catch { /* graceful */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Daily prompt.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.rpc("get_daily_prompt_with_submissions" as never);
        if (!cancelled && data) setPrompt(data as DailyPrompt);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Drafts (auth only).
  useEffect(() => {
    if (!user) { setDrafts([]); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("movie_projects" as never)
        .select("id, title, status, thumbnail_url, updated_at")
        .eq("user_id", user.id)
        .neq("status", "completed")
        .order("updated_at", { ascending: false })
        .limit(6);
      if (!cancelled) setDrafts((data ?? []) as DraftRow[]);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Challenges (auth only).
  useEffect(() => {
    if (!user) { setChallenges([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.rpc("get_daily_challenges" as never);
        if (!cancelled && Array.isArray(data)) setChallenges(data as DailyChallengeRow[]);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // 7-day activity streak (auth only).
  useEffect(() => {
    if (!user) { setActivity([]); return; }
    let cancelled = false;
    const buildSkeleton = (): ActivityDay[] => {
      const out: ActivityDay[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        out.push({ day: d.toISOString().slice(0, 10), activity_count: 0 });
      }
      return out;
    };
    (async () => {
      const skeleton = buildSkeleton();
      try {
        const rpc = await supabase.rpc(
          "get_user_activity_streak" as never,
          { p_days: 7 } as never,
        );
        if (!cancelled && Array.isArray(rpc.data) && rpc.data.length > 0) {
          const byDay = new Map<string, number>();
          for (const r of rpc.data as Array<{ day: string; activity_count: number }>) {
            byDay.set(r.day.slice(0, 10), Number(r.activity_count ?? 0));
          }
          setActivity(skeleton.map((s) => ({ day: s.day, activity_count: byDay.get(s.day) ?? 0 })));
          return;
        }
      } catch { /* fall through */ }
      try {
        const since = new Date();
        since.setDate(since.getDate() - 7);
        const { data } = await supabase
          .from("movie_projects" as never)
          .select("created_at, updated_at, status")
          .eq("user_id", user.id)
          .gte("updated_at", since.toISOString());
        const byDay = new Map<string, number>();
        for (const r of (data ?? []) as Array<{ created_at: string; updated_at: string; status: string }>) {
          const ts = r.updated_at || r.created_at;
          if (!ts) continue;
          const key = ts.slice(0, 10);
          byDay.set(key, (byDay.get(key) ?? 0) + 1);
        }
        if (!cancelled) setActivity(skeleton.map((s) => ({ day: s.day, activity_count: byDay.get(s.day) ?? 0 })));
      } catch {
        if (!cancelled) setActivity(skeleton);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Remix-able reels.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingRemix(true);
      try {
        const { data } = await supabase.rpc(
          "lobby_feed" as never,
          { p_world_slug: null, p_cursor: null, p_limit: 24 } as never,
        );
        if (cancelled) return;
        const raw = Array.isArray(data) ? data : (data as { items?: unknown[] })?.items ?? [];
        const filtered = (raw as RemixReel[])
          .filter((r) => Number(r.remix_count ?? 0) > 0)
          .slice(0, 9);
        setRemixes(filtered);
      } catch { /* graceful empty */ } finally {
        if (!cancelled) setLoadingRemix(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (activeWorld === "all") return feed;
    return feed.filter((r) => r.world_slug === activeWorld);
  }, [feed, activeWorld]);

  const featured = useMemo(
    () => filtered.find((r) => r.is_featured) ?? filtered[0] ?? null,
    [filtered],
  );

  // Hand a seed prompt straight into the Studio via the `?prompt=` param that
  // Studio reads into its generate box. Signed-out users go through auth with
  // the destination (incl. the seed) preserved on `next`.
  const startWithSeed = useCallback((seed: string) => {
    const dest = `/studio?prompt=${encodeURIComponent(seed.trim())}`;
    if (!user) { navigate(`/auth?next=${encodeURIComponent(dest)}`); return; }
    navigate(dest);
  }, [user, navigate]);

  const startFromPrompt = useCallback(() => {
    startWithSeed(prompt?.prompt.prompt_text ?? "");
  }, [prompt, startWithSeed]);

  // 7-day streak math.
  const currentStreak = useMemo(() => {
    if (activity.length === 0) return 0;
    let s = 0;
    for (let i = activity.length - 1; i >= 0; i--) {
      if (activity[i].activity_count > 0) s++;
      else break;
    }
    return s;
  }, [activity]);
  const totalThisWeek = useMemo(
    () => activity.reduce((acc, a) => acc + a.activity_count, 0),
    [activity],
  );

  // Build the 10 story cards.
  const stories: StoryCard[] = useMemo(() => [
    {
      id: "spark",
      eyebrow: "Today's spark",
      title: spark.headline,
      hue: "45 95% 65%",
      gradient: "radial-gradient(120% 80% at 30% 30%, hsla(45,95%,60%,0.45) 0%, transparent 60%), linear-gradient(180deg, hsl(45 50% 12%) 0%, hsl(35 45% 5%) 100%)",
      onClick: () => startWithSeed(spark.seed),
      icon: Sparkles,
    },
    {
      id: "sketch",
      eyebrow: "Daily sketch",
      title: prompt?.prompt.prompt_text ?? "A room that isn't there.",
      hue: "215 100% 65%",
      gradient: "radial-gradient(120% 80% at 30% 30%, hsla(215,100%,60%,0.45) 0%, transparent 60%), linear-gradient(180deg, hsl(215 50% 12%) 0%, hsl(220 45% 5%) 100%)",
      onClick: startFromPrompt,
      icon: Calendar,
    },
    {
      id: "sora2",
      eyebrow: "New on engine",
      title: "Sora 2 just landed.",
      hue: "285 75% 65%",
      gradient: "radial-gradient(120% 80% at 30% 30%, hsla(285,75%,60%,0.45) 0%, transparent 60%), linear-gradient(180deg, hsl(285 45% 12%) 0%, hsl(265 50% 5%) 100%)",
      to: "/studio",
      meta: "Try in studio",
      icon: Zap,
    },
    {
      id: "templates",
      eyebrow: "Templates pack",
      title: "The empty room. Yours in three taps.",
      hue: "160 70% 60%",
      gradient: "radial-gradient(120% 80% at 30% 30%, hsla(160,70%,55%,0.45) 0%, transparent 60%), linear-gradient(180deg, hsl(160 40% 10%) 0%, hsl(195 45% 5%) 100%)",
      to: "/templates",
      meta: "Open template",
      icon: Film,
    },
    {
      id: "creator",
      eyebrow: "Creator of the week",
      title: creatorOfWeek?.display_name ?? "Vela Reyes",
      hue: "38 90% 65%",
      gradient: "radial-gradient(120% 80% at 30% 30%, hsla(38,90%,55%,0.45) 0%, transparent 60%), linear-gradient(180deg, hsl(38 50% 12%) 0%, hsl(28 45% 5%) 100%)",
      to: creatorOfWeek ? `/c/${creatorOfWeek.id}` : "/creators",
      meta: "See their reels",
      icon: Crown,
    },
    {
      id: "follows",
      eyebrow: "From your follows",
      title: "Three new films from people you watch.",
      hue: "195 95% 65%",
      gradient: "radial-gradient(120% 80% at 30% 30%, hsla(195,95%,55%,0.45) 0%, transparent 60%), linear-gradient(180deg, hsl(195 50% 10%) 0%, hsl(215 50% 5%) 100%)",
      to: "/lobby",
      meta: user ? "Open your feed" : "Sign in to see",
      icon: UsersIcon,
    },
    {
      id: "live",
      eyebrow: "Live now",
      title: `${nowEditingCount} directors editing right now.`,
      hue: "0 80% 65%",
      gradient: "radial-gradient(120% 80% at 30% 30%, hsla(0,85%,60%,0.45) 0%, transparent 60%), linear-gradient(180deg, hsl(0 45% 12%) 0%, hsl(0 35% 5%) 100%)",
      to: "/studio",
      meta: "Join the room",
      icon: Radio,
    },
    {
      id: "lut",
      eyebrow: "LUT pack drop",
      title: "Sodium-vapor noir · ships tonight.",
      hue: "35 90% 65%",
      gradient: "radial-gradient(120% 80% at 30% 30%, hsla(35,90%,55%,0.45) 0%, transparent 60%), linear-gradient(180deg, hsl(35 50% 12%) 0%, hsl(45 45% 5%) 100%)",
      to: "/lobby",
      meta: "Pre-order",
      icon: Palette,
    },
    {
      id: "aicut",
      eyebrow: "AI cut suggestion",
      title: "Trim 6.4s. Tighten the breath before the reveal.",
      hue: "280 70% 70%",
      gradient: "radial-gradient(120% 80% at 30% 30%, hsla(280,70%,60%,0.45) 0%, transparent 60%), linear-gradient(180deg, hsl(280 40% 12%) 0%, hsl(265 45% 5%) 100%)",
      to: "/library",
      meta: "Apply to a draft",
      icon: Scissors,
    },
    {
      id: "tip",
      eyebrow: "Tip of the day",
      title: "End on the inhale, not the line.",
      hue: "45 95% 70%",
      gradient: "radial-gradient(120% 80% at 30% 30%, hsla(45,95%,65%,0.45) 0%, transparent 60%), linear-gradient(180deg, hsl(45 50% 12%) 0%, hsl(35 50% 5%) 100%)",
      onClick: () => startWithSeed("End the scene on the breath before the resolution."),
      icon: Lightbulb,
    },
  ], [spark, prompt, creatorOfWeek, nowEditingCount, user, startWithSeed, startFromPrompt]);

  return (
    <FoundationShell>
      {/* Lobby uses the app's default SpineBackdrop (same as the settings
          page) — no custom lobby backdrop. */}
      <div className="relative z-10 mx-auto w-full max-w-[1440px] px-4 sm:px-8 lg:px-12 pt-6 pb-32">

        {/* Masthead — editorial header, no chrome bars above it. */}
        <HeroBand
          config={slotConfig}
          framesPerHour={presence.framesPerHour}
          reducedMotion={reducedMotion ?? false}
        />

        {/* Clear create entry — the lobby is for watching; this is how you make.
            Taps straight into the Studio (the story cards below seed it too). */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[hsl(var(--accent)/0.06)] px-5 py-4 ring-1 ring-inset ring-[hsl(var(--accent)/0.18)]">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-accent/80">Your turn</p>
            <p className="mt-1 text-[15px] font-light text-foreground/90">Have an idea? Make a story — one prompt, one film.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate(user ? "/studio" : "/auth?next=/studio")}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-[13px] font-semibold text-accent-foreground shadow-[0_8px_30px_-8px_hsl(var(--accent)/0.6)] transition-transform hover:scale-[1.03] active:scale-95"
          >
            <Sparkles className="h-4 w-4" /> Make a story
            <span aria-hidden>→</span>
          </button>
        </div>

        {/* Lead with the day's featured film — the biggest piece of content. */}
        {featured && (
          <PremiereBand
            reel={featured}
            demo={usingDemo}
            watchingNow={presence.watching}
            onOpen={openTheater}
          />
        )}

        {/* Stories rail — quick taps into prompts + creators. */}
        <StoriesRail stories={stories} reducedMotion={reducedMotion ?? false} />

        {/* The main feed — browse by world, then a deep grid of real reels. */}
        <WorldsRail worlds={worlds} active={activeWorld} onChange={setActiveWorld} />
        <TrendingSection
          reels={filtered}
          loading={loading}
          demo={usingDemo}
          reducedMotion={reducedMotion ?? false}
          onOpen={openTheater}
        />

        {/* Spotlight creator — a real reel + the maker behind it. */}
        <CreatorOfWeekBand creator={creatorOfWeek} />

        {/* Remixable films from the community. */}
        <RemixWall reels={remixes} loading={loadingRemix} />

        {/* Learn the craft — instructional content with real prompts. */}
        <TechniqueGrid onTry={(t) => startWithSeed(t.seed)} authed={!!user} />

        {/* People to follow. */}
        <SuggestedPeopleRail className="mb-20" />

        {/* Pick your drafts back up (auth). */}
        {drafts.length > 0 && <DraftsSection drafts={drafts} />}
      </div>

      {/* ── IMMERSIVE THEATER OVERLAY ───────────────────────────── */}
      <ImmersiveTheater
        reel={theaterReel}
        onClose={closeTheater}
        queue={filtered.map((r) => ({
          id: r.id, title: r.title, video_url: r.video_url,
          thumbnail_url: r.thumbnail_url, play_count: r.play_count,
          like_count: r.like_count, remix_count: r.remix_count,
          creator_id: r.creator_id, creator_name: r.creator_name,
          creator_avatar: r.creator_avatar, world_name: r.world_name,
          world_accent: r.world_accent, world_glyph: r.world_glyph,
        }))}
        onSwitch={(next) => setTheaterReel(next)}
      />
    </FoundationShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LivePresenceBar — top slim strip: counters + wallclock + render timecode
// ─────────────────────────────────────────────────────────────────────────────
function HeroBand({
  config,
  framesPerHour,
  reducedMotion,
}: {
  config: TimeSlotConfig;
  framesPerHour: number;
  reducedMotion: boolean;
}) {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 600], [0, -60]);
  const Icon = config.Icon;
  return (
    <motion.header
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: EASE_PREMIUM }}
      className="relative mb-16"
    >
      <motion.div
        aria-hidden
        style={reducedMotion ? undefined : { y }}
        className="absolute -inset-8 sm:-inset-16 -z-10 pointer-events-none"
      >
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(60% 80% at 20% 30%, hsla(${config.hue.replace(" ", ",")},0.20) 0%, transparent 60%), radial-gradient(70% 60% at 90% 100%, hsla(285,75%,60%,0.12) 0%, transparent 60%)`,
          }}
        />
      </motion.div>

      <div className="flex items-center gap-3 mb-6">
        <Icon className="w-3.5 h-3.5" style={{ color: `hsl(${config.hue})` }} strokeWidth={1.5} />
        <EditorialEyebrow>{config.eyebrow}</EditorialEyebrow>
        <span aria-hidden className="h-3 w-px bg-white/12 mx-2" />
        <span className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.30em] tabular-nums")}>
          {framesPerHour.toLocaleString()} frames rendered this hour
        </span>
      </div>

      <EditorialHeadline className="mt-5" size="xl">
        {config.headline}
      </EditorialHeadline>

      <p className="mt-6 max-w-2xl text-[15px] font-light leading-relaxed text-muted-foreground/80">
        Tonight, somebody is finishing a 47-second film about a teacup. Here&rsquo;s the room they&rsquo;re doing it in.
      </p>
    </motion.header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StoriesRail — 10 vertical 9:16 cards, Instagram-style auto-advance ring
// ─────────────────────────────────────────────────────────────────────────────
function StoriesRail({
  stories,
  reducedMotion,
}: {
  stories: StoryCard[];
  reducedMotion: boolean;
}) {
  void reducedMotion;
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.6, ease: EASE_PREMIUM }}
      className="mb-20"
    >
      <SectionLabel label="Stories" icon={Sparkles} meta={`${stories.length} threads`} />
      <div className="relative -mx-4 sm:-mx-8 lg:-mx-12 px-4 sm:px-8 lg:px-12 overflow-x-auto scrollbar-none">
        <div className="flex gap-3 pb-3">
          {stories.map((story, i) => (
            <StoryTile key={story.id} story={story} index={i} />
          ))}
        </div>
      </div>
    </motion.section>
  );
}

// Background imagery per story so the cards read as real content, not empty
// gradient tiles. Cinematic stock that matches each card's theme.
const STORY_IMAGES: Record<string, string> = {
  spark:     "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=600&q=80",
  sketch:    "https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=600&q=80",
  sora2:     "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=600&q=80",
  templates: "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=600&q=80",
  creator:   "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=600&q=80",
  follows:   "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=600&q=80",
  live:      "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=600&q=80",
  lut:       "https://images.unsplash.com/photo-1571330735066-03aaa9429d89?auto=format&fit=crop&w=600&q=80",
  aicut:     "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?auto=format&fit=crop&w=600&q=80",
  tip:       "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=600&q=80",
};

function StoryTile({ story, index }: { story: StoryCard; index: number }) {
  const Icon = story.icon;
  const bgImage = STORY_IMAGES[story.id];
  const cardRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [inView, setInView] = useState(false);
  const navigate = useNavigate();

  // Track inView via IntersectionObserver
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => setInView(e.isIntersecting)),
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // 6s auto-advance ring when in viewport.
  useEffect(() => {
    if (!inView) { setProgress(0); return; }
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const elapsed = performance.now() - start;
      const pct = Math.min(1, elapsed / 6000);
      setProgress(pct);
      if (pct < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView]);

  const onClick = () => {
    if (story.onClick) story.onClick();
    else if (story.to) navigate(story.to);
  };

  const ringStroke = 2;
  const ringRadius = 50;
  const ringCirc = 2 * Math.PI * ringRadius;
  const ringDash = ringCirc * (1 - progress);

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 0.05 + index * 0.04, duration: 0.5, ease: EASE_PREMIUM }}
      whileHover={{ y: -4, scale: 1.02 }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
      className="group/story relative flex-shrink-0 w-[148px] sm:w-[164px] aspect-[9/16] rounded-2xl overflow-hidden cursor-pointer"
      style={{
        background: story.gradient,
        boxShadow: `inset 0 0 0 1px hsla(${story.hue} / 0.25), 0 18px 60px -24px hsla(${story.hue} / 0.45)`,
      }}
    >
      {/* Auto-advance ring */}
      <svg
        aria-hidden
        viewBox="0 0 110 110"
        className="absolute -top-1 -left-1 -right-1 -bottom-1 w-[calc(100%+8px)] h-[calc(100%+8px)] pointer-events-none"
      >
        <rect
          x={ringStroke}
          y={ringStroke}
          width={110 - ringStroke * 2}
          height={110 - ringStroke * 2}
          rx={18}
          ry={18}
          fill="none"
          stroke={`hsla(${story.hue} / 0.18)`}
          strokeWidth={ringStroke}
        />
      </svg>
      <div
        aria-hidden
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          background: `conic-gradient(from -90deg, hsla(${story.hue} / 0.9) ${progress * 360}deg, transparent ${progress * 360}deg)`,
          mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          maskComposite: "exclude",
          WebkitMaskComposite: "xor",
          padding: "2px",
          opacity: inView ? 0.8 : 0,
          transition: "opacity 0.3s ease",
        }}
      />

      {/* Background image — real imagery so the card isn't an empty gradient.
          Scaled up on hover; a dark scrim keeps the title legible. */}
      {bgImage && (
        <>
          <img
            src={bgImage}
            alt=""
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover/story:scale-110 transition-transform duration-700 ease-out"
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: `linear-gradient(180deg, hsla(${story.hue} / 0.25) 0%, transparent 30%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0.88) 100%)` }}
          />
        </>
      )}

      {/* Grain */}
      <div
        className="absolute inset-0 opacity-[0.10] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.7'/></svg>\")",
        }}
      />

      {/* Top hairline */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

      {/* Icon medallion */}
      <div
        className="absolute top-3 left-3 h-9 w-9 rounded-xl grid place-items-center backdrop-blur-2xl group-hover/story:scale-110 transition-transform duration-500"
        style={{
          background: `hsla(${story.hue} / 0.18)`,
          boxShadow: `inset 0 0 0 1px hsla(${story.hue} / 0.35)`,
          color: `hsl(${story.hue})`,
        }}
      >
        <Icon className="w-3.5 h-3.5" strokeWidth={1.6} />
      </div>

      {/* Bottom content */}
      <div className="absolute inset-x-3 bottom-3">
        <div className={cn(TYPE_META, "tracking-[0.30em] text-white/70 mb-1.5")}>
          {story.eyebrow}
        </div>
        <div
          className="text-[14px] sm:text-[15px] font-light italic leading-snug text-white line-clamp-4"
          style={{ fontFamily: "'Fraunces', serif", textShadow: "0 2px 12px hsl(0 0% 0% / 0.6)" }}
        >
          {story.title}
        </div>
        {story.meta && (
          <div className="mt-2 text-[9.5px] font-mono uppercase tracking-[0.30em] text-white/70 inline-flex items-center gap-1.5">
            <ArrowRight className="w-2.5 h-2.5" strokeWidth={1.8} />
            {story.meta}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PremiereBand — 21:9 featured film with live "watching" counter
// ─────────────────────────────────────────────────────────────────────────────
function PremiereBand({
  reel,
  demo,
  watchingNow,
  onOpen,
}: {
  reel: FeedRow;
  demo: boolean;
  watchingNow: number;
  onOpen: (r: FeedRow) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const accent = reel.world_accent ?? "215 100% 65%";

  const inner = (
    <div
      className="relative aspect-[21/9] rounded-[28px] overflow-hidden bg-black"
      style={{ boxShadow: "0 36px 100px -36px hsl(0 0% 0% / 0.75)" }}
    >
      {reel.video_url && !demo ? (
        <video
          ref={videoRef}
          src={reel.video_url}
          poster={reel.thumbnail_url ?? undefined}
          autoPlay muted loop playsInline preload="metadata"
          className="absolute inset-0 w-full h-full object-cover scale-[1.02] group-hover/feat:scale-[1.05] transition-transform duration-[1200ms] ease-out"
        />
      ) : reel.thumbnail_url ? (
        <img src={reel.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover scale-[1.02] group-hover/feat:scale-[1.05] transition-transform duration-[1200ms] ease-out" />
      ) : null}

      <div className="absolute inset-0 bg-gradient-to-t from-black/92 via-black/35 to-transparent" />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-44 opacity-80 pointer-events-none"
        style={{ background: `radial-gradient(120% 100% at 50% 0%, hsla(${accent} / 0.24) 0%, transparent 65%)` }}
      />
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

      <div className="absolute top-6 left-6 flex items-center gap-2.5 flex-wrap">
        <span
          className="px-3 py-1 rounded-full text-[9.5px] font-mono uppercase tracking-[0.34em] backdrop-blur-2xl"
          style={{
            color: `hsl(${accent})`,
            background: `hsla(${accent} / 0.10)`,
            boxShadow: `inset 0 0 0 1px hsla(${accent} / 0.32)`,
          }}
        >
          <span className="mr-1.5">{reel.world_glyph}</span>{reel.world_name}
        </span>
        <span
          className="px-3 py-1 rounded-full text-[9.5px] font-mono uppercase tracking-[0.34em] backdrop-blur-2xl text-[hsl(0,80%,80%)] inline-flex items-center gap-1.5"
          style={{ background: "hsla(0,85%,60%,0.10)", boxShadow: "inset 0 0 0 1px hsla(0,85%,60%,0.32)" }}
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inset-0 rounded-full bg-[hsl(0,85%,60%)] animate-ping opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[hsl(0,85%,60%)]" />
          </span>
          watching with {watchingNow.toLocaleString()} others
        </span>
        {demo && (
          <span
            className="px-3 py-1 rounded-full text-[9.5px] font-mono uppercase tracking-[0.34em] backdrop-blur-2xl text-amber-200"
            style={{ background: "hsla(45 95% 60% / 0.10)", boxShadow: "inset 0 0 0 1px hsla(45 95% 60% / 0.32)" }}
          >
            preview
          </span>
        )}
      </div>

      <div className="absolute bottom-7 left-7 right-7">
        <div className={cn(TYPE_META, "text-white/70 tracking-[0.36em] mb-3")}>
          ◆ Premiere · tonight
        </div>
        <h3
          className="font-display italic font-light leading-[0.98] tracking-[-0.014em] text-white"
          style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(1.9rem,4.8vw,3.6rem)", textShadow: "0 4px 24px hsl(0 0% 0% / 0.55)" }}
        >
          {reel.title}
        </h3>
        <div className="mt-4 flex items-center gap-5 text-[11px] font-mono uppercase tracking-[0.26em] text-white/80">
          <span className="inline-flex items-center gap-1.5"><Eye className="w-3 h-3" strokeWidth={1.6} />{reel.play_count.toLocaleString()}</span>
          <span className="inline-flex items-center gap-1.5"><Heart className="w-3 h-3" strokeWidth={1.6} />{reel.like_count.toLocaleString()}</span>
          <span className="inline-flex items-center gap-1.5"><Wand2 className="w-3 h-3" strokeWidth={1.6} />{reel.remix_count.toLocaleString()}</span>
          <span aria-hidden className="w-1 h-1 rounded-full bg-white/30" />
          <span className="not-italic">{reel.creator_name}</span>
        </div>
      </div>

      <div
        className="absolute top-6 right-6 inline-flex items-center gap-2 px-4 h-9 rounded-full text-[11px] font-mono uppercase tracking-[0.26em] text-white/95 backdrop-blur-2xl bg-black/40 group-hover/feat:bg-accent/30 transition-colors"
        style={{ boxShadow: "inset 0 0 0 1px hsl(0 0% 100% / 0.12)" }}
      >
        <Play className="w-3 h-3" strokeWidth={1.8} />Open theater
      </div>
    </div>
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7, ease: EASE_PREMIUM }}
      className="mb-24"
    >
      <SectionLabel label="Premiere" icon={Trophy} meta={demo ? "sample" : "live"} hue="45 95% 65%" />
      {demo ? (
        <div className="group/feat block">{inner}</div>
      ) : (
        <button
          type="button"
          onClick={() => onOpen(reel)}
          className="group/feat block w-full text-left"
        >
          {inner}
        </button>
      )}
    </motion.section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BentoMosaic — 12 mixed-size tiles in a 4-col grid
// ─────────────────────────────────────────────────────────────────────────────
function CreatorOfWeekBand({ creator }: { creator: CreatorOfWeek | null }) {
  // Fallback editorial when there's no DB row.
  const c: CreatorOfWeek = creator ?? {
    id: "demo",
    display_name: "Vela Reyes",
    avatar_url: null,
    tagline: "Director of small rooms.",
    bio: "She shoots faces the way other people shoot landscapes. Her last reel — a 47-second film about a cassette tape — was the most-remixed work on the platform this month.",
    reel_id: "demo-1",
    reel_title: "Stillwater · the cassette tape",
    reel_thumbnail: "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1200&q=80",
    reel_video: null,
    total_plays: 12480,
    total_likes: 1872,
    follower_count: 412,
  };

  const videoRef = useRef<HTMLVideoElement>(null);
  // Usher the reel into autoplay once it can; keep it looping.
  const ensurePlaying = () => { if (videoRef.current && c.reel_video) { void videoRef.current.play().catch(() => {}); } };

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.7, ease: EASE_PREMIUM }}
      onAnimationComplete={ensurePlaying}
      className="mb-24"
    >
      <SectionLabel label="Creator of the week" icon={Crown} meta="editorial pick" hue="38 90% 65%" />
      <div
        className="relative grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-0 rounded-[28px] overflow-hidden"
        style={{
          background: "linear-gradient(180deg, hsla(38,90%,55%,0.06) 0%, hsla(0,0%,100%,0.005) 100%)",
          backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
          boxShadow: "inset 0 0 0 1px hsla(38,90%,55%,0.20), 0 36px 100px -36px hsl(0 0% 0% / 0.75)",
        }}
      >
        {/* Reel autoplay panel */}
        <div
          className="group/cow relative aspect-[4/3] lg:aspect-auto lg:min-h-[480px] bg-black/40 overflow-hidden"
          onMouseEnter={ensurePlaying}
        >
          {c.reel_video ? (
            <video ref={videoRef} src={c.reel_video} poster={c.reel_thumbnail ?? undefined} autoPlay muted loop playsInline preload="auto" onCanPlay={ensurePlaying} className="absolute inset-0 w-full h-full object-cover scale-[1.02] group-hover/cow:scale-[1.05] transition-transform duration-[1200ms] ease-out" />
          ) : c.reel_thumbnail ? (
            <img src={c.reel_thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover scale-[1.02] group-hover/cow:scale-[1.05] transition-transform duration-[1200ms] ease-out" />
          ) : (
            <div className="absolute inset-0" style={{ background: "radial-gradient(120% 80% at 30% 30%, hsla(38,90%,55%,0.30) 0%, transparent 60%), linear-gradient(135deg, hsl(35 45% 14%) 0%, hsl(28 45% 6%) 100%)" }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-black/40" />
          <div className="absolute top-5 left-5">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[9.5px] font-mono uppercase tracking-[0.34em] backdrop-blur-2xl text-[hsl(38,90%,80%)]"
              style={{ background: "hsla(38,90%,55%,0.14)", boxShadow: "inset 0 0 0 1px hsla(38,90%,55%,0.35)" }}
            >
              <Crown className="w-2.5 h-2.5" strokeWidth={1.8} /> Creator of the week
            </div>
          </div>
          <div className="absolute bottom-5 left-5 right-5">
            <div className={cn(TYPE_META, "text-white/70 tracking-[0.30em] mb-1.5")}>Featured reel</div>
            <h4 className="text-white text-[20px] sm:text-[24px] font-light italic leading-tight" style={{ fontFamily: "'Fraunces', serif", textShadow: "0 4px 18px hsl(0 0% 0% / 0.55)" }}>
              {c.reel_title}
            </h4>
          </div>
        </div>

        {/* Editorial column */}
        <div className="relative p-7 lg:p-10 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-4 mb-5">
              {c.avatar_url ? (
                <img src={c.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover" style={{ boxShadow: "inset 0 0 0 1px hsla(0,0%,100%,0.15)" }} />
              ) : (
                <div className="w-14 h-14 rounded-full grid place-items-center text-[20px] font-light italic text-foreground/85" style={{ background: "hsla(38,90%,55%,0.18)", boxShadow: "inset 0 0 0 1px hsla(38,90%,55%,0.35)", fontFamily: "'Fraunces', serif" }}>
                  {c.display_name[0]}
                </div>
              )}
              <div>
                <div className="text-[20px] font-light italic leading-tight text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
                  {c.display_name}
                </div>
                <div className={cn(TYPE_META, "text-muted-foreground/60 tracking-[0.30em] mt-1")}>
                  {c.tagline}
                </div>
              </div>
            </div>
            <p className="text-[15px] sm:text-[16px] font-light italic leading-relaxed text-foreground/85" style={{ fontFamily: "'Fraunces', serif" }}>
              {c.bio}
            </p>
            <div className="mt-6 grid grid-cols-3 gap-4">
              <CreatorStat label="plays" value={c.total_plays} hue="215 100% 70%" />
              <CreatorStat label="likes" value={c.total_likes} hue="0 80% 70%" />
              <CreatorStat label="followers" value={c.follower_count} hue="160 70% 70%" />
            </div>
          </div>
          <div className="mt-7 flex items-center gap-3 flex-wrap">
            <Link
              to={`/c/${c.id}`}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-full text-[11px] font-mono uppercase tracking-[0.28em] text-foreground transition-all"
              style={{
                background: "linear-gradient(180deg, hsla(38,90%,55%,0.24) 0%, hsla(38,90%,45%,0.06) 100%)",
                boxShadow: "inset 0 0 0 1px hsla(38,90%,55%,0.40), 0 0 28px hsla(38,90%,55%,0.32)",
              }}
            >
              Follow
              <ArrowRight className="w-3 h-3" />
            </Link>
            <Link
              to={`/c/${c.id}`}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-full text-[11px] font-mono uppercase tracking-[0.28em] text-foreground/80 hover:text-foreground transition-colors"
              style={{ background: "hsla(0,0%,100%,0.03)", boxShadow: "inset 0 0 0 1px hsla(0,0%,100%,0.10)" }}
            >
              Watch all reels
            </Link>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function CreatorStat({ label, value, hue }: { label: string; value: number; hue: string }) {
  return (
    <div>
      <div
        className="text-[24px] font-light italic leading-none tabular-nums"
        style={{
          fontFamily: "'Fraunces', serif",
          background: `linear-gradient(180deg, hsl(${hue}) 0%, hsla(${hue},0.6) 100%)`,
          WebkitBackgroundClip: "text", backgroundClip: "text",
          WebkitTextFillColor: "transparent", color: "transparent",
        }}
      >
        {value.toLocaleString()}
      </div>
      <div className="mt-1 text-[9.5px] font-mono uppercase tracking-[0.28em] text-muted-foreground/55">
        {label}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TutorialReelBand — "How they made it" 4-quadrant breakdown
// ─────────────────────────────────────────────────────────────────────────────
function SectionLabel({
  label, icon: Icon, meta, hue,
}: {
  label: string;
  icon: React.ElementType;
  meta?: string;
  hue?: string;
}) {
  const color = hue ? `hsl(${hue})` : "hsl(var(--accent) / 0.85)";
  return (
    <div className="flex items-end gap-4 mb-9">
      <div className="flex items-center gap-3">
        <Icon className="w-3.5 h-3.5" style={{ color }} strokeWidth={1.5} />
        <span className="text-[10.5px] font-mono uppercase tracking-[0.36em] text-foreground/85">{label}</span>
      </div>
      <div className="h-px flex-1 bg-gradient-to-r from-white/[0.10] to-transparent translate-y-[7px]" />
      {meta && <span className="text-[10px] font-mono uppercase tracking-[0.26em] text-muted-foreground/45">{meta}</span>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WorldsRail — frameless filter chips
// ─────────────────────────────────────────────────────────────────────────────
function WorldsRail({ worlds, active, onChange }: { worlds: ChannelWorld[]; active: string; onChange: (slug: string) => void }) {
  const all = [
    { slug: "all" as const, name: "All",    glyph: "◆", accent_hsl: "var(--accent)" as string },
    ...worlds.map((w) => ({ slug: w.slug, name: w.name, glyph: w.glyph ?? "•", accent_hsl: w.accent_hsl })),
  ];
  return (
    <section className="mb-12">
      <SectionLabel label="Worlds" icon={Tv} meta={`${all.length} channels`} />
      <div className="flex flex-wrap items-center gap-2.5">
        {all.map((w) => {
          const isActive = active === w.slug;
          const hue = w.accent_hsl.startsWith("var") ? "hsl(var(--accent))" : `hsl(${w.accent_hsl})`;
          return (
            <button
              key={w.slug}
              type="button"
              onClick={() => onChange(w.slug)}
              className={cn(
                "relative inline-flex items-center gap-2 h-9 px-4 rounded-full transition-all text-[11.5px] font-mono uppercase tracking-[0.24em]",
                isActive ? "text-foreground" : "text-muted-foreground/65 hover:text-foreground/95",
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="lobby-world-active"
                  className="absolute inset-0 -z-10 rounded-full"
                  style={{
                    background: w.slug === "all" ? "hsl(var(--accent) / 0.14)" : `hsla(${w.accent_hsl} / 0.14)`,
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    boxShadow: w.slug === "all"
                      ? "inset 0 0 0 1px hsl(var(--accent) / 0.32), 0 0 28px -8px hsl(var(--accent) / 0.40)"
                      : `inset 0 0 0 1px hsla(${w.accent_hsl} / 0.36), 0 0 28px -8px hsla(${w.accent_hsl} / 0.40)`,
                  }}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <span style={{ color: isActive ? hue : undefined }} className="text-[12px]">{w.glyph}</span>
              <span>{w.name}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TrendingSection — borderless reel grid
// ─────────────────────────────────────────────────────────────────────────────
function TrendingSection({
  reels, loading, demo, reducedMotion, onOpen,
}: {
  reels: FeedRow[]; loading: boolean; demo: boolean; reducedMotion: boolean;
  onOpen: (r: FeedRow) => void;
}) {
  void reducedMotion;
  return (
    <section className="mb-24">
      <SectionLabel label="Trending now" icon={Flame} meta={`${reels.length} reels`} />
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-12">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i}>
              <div className="rounded-2xl aspect-video bg-white/[0.02] animate-pulse" />
              <div className="pt-3 px-1 space-y-2">
                <div className="h-3 w-3/4 bg-white/[0.04] rounded animate-pulse" />
                <div className="h-2 w-1/2 bg-white/[0.03] rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : reels.length === 0 ? (
        <div className="py-16 text-center text-[13px] text-muted-foreground/65">
          No reels in this world yet.
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={`reels-${reels.length}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.5, ease: EASE_PREMIUM }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-12"
          >
            {reels.map((r, i) => (
              <ReelTile key={r.id} reel={r} demo={demo} onOpen={onOpen} index={i} />
            ))}
          </motion.div>
        </AnimatePresence>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ReelTile — borderless thumbnail + caption beneath
// ─────────────────────────────────────────────────────────────────────────────
function ReelTile({ reel, demo, onOpen, index }: { reel: FeedRow; demo: boolean; onOpen: (r: FeedRow) => void; index: number }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const accent = reel.world_accent ?? "213 100% 60%";
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(reel.like_count);

  // Usher the reel into autoplay once it can; keep it looping (don't
  // pause on mouse-leave — the card should stay alive after its entrance).
  const ensurePlaying = () => { if (videoRef.current && !demo) { void videoRef.current.play().catch(() => {}); } };

  const toggleLike = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (demo) { toast.message("Sample reel — likes on published reels only."); return; }
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((c) => Math.max(0, c + (wasLiked ? -1 : 1)));
    try {
      const { error } = await supabase.rpc("toggle_like_reel" as never, { p_reel_id: reel.id } as never);
      if (error) throw error;
    } catch (err) {
      setLiked(wasLiked);
      setLikeCount((c) => Math.max(0, c + (wasLiked ? 1 : -1)));
      const msg = err instanceof Error ? err.message : "Couldn't like";
      toast.error(/auth/i.test(msg) ? "Sign in to like" : msg);
    }
  };
  const openComments = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    onOpen(reel);
  };
  const remix = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (demo) { toast.message("This is a sample — publish your own to enable remixing."); return; }
    try {
      const { data, error } = await supabase.rpc("remix_reel" as never, { p_reel_id: reel.id } as never);
      if (error) throw error;
      const out = data as { new_project_id: string };
      toast.success("Remix project created");
      window.location.href = `/editor/${out.new_project_id}`;
    } catch (err) { toast.error(err instanceof Error ? err.message : "Remix failed"); }
  };

  const handleClick = () => {
    if (demo) { toast.message("This is a sample. Publish a reel and yours will open here."); return; }
    onOpen(reel);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 0.04 + index * 0.05, duration: 0.5, ease: EASE_PREMIUM }}
      onAnimationComplete={ensurePlaying}
      role="button"
      tabIndex={0}
      onMouseEnter={ensurePlaying}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClick(); } }}
      className="group/tile block cursor-pointer outline-none"
    >
      <div className="relative aspect-video rounded-2xl overflow-hidden bg-black/40">
        {reel.video_url && !demo ? (
          <video
            ref={videoRef}
            src={reel.video_url}
            poster={reel.thumbnail_url ?? undefined}
            autoPlay muted loop playsInline preload="auto"
            onCanPlay={ensurePlaying}
            className="absolute inset-0 w-full h-full object-cover scale-[1.01] group-hover/tile:scale-[1.06] transition-transform duration-700 ease-out"
          />
        ) : reel.thumbnail_url ? (
          <img src={reel.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover scale-[1.01] group-hover/tile:scale-[1.06] transition-transform duration-700 ease-out" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-24 opacity-70 pointer-events-none"
          style={{ background: `radial-gradient(110% 100% at 50% 0%, hsla(${accent} / 0.18) 0%, transparent 65%)` }}
        />
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        {reel.world_name && (
          <div
            className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[9.5px] font-mono uppercase tracking-[0.32em] backdrop-blur-2xl"
            style={{
              color: `hsl(${accent})`,
              background: `hsla(${accent} / 0.10)`,
              boxShadow: `inset 0 0 0 1px hsla(${accent} / 0.32)`,
            }}
          >
            <span className="mr-1.5">{reel.world_glyph}</span>{reel.world_name}
          </div>
        )}
        <div className="absolute bottom-3 left-3 right-3 flex items-center gap-3 text-[10px] font-mono text-white/85 tracking-[0.22em]">
          <span className="inline-flex items-center gap-1"><Eye className="w-3 h-3" strokeWidth={1.6} />{reel.play_count.toLocaleString()}</span>
          <span className="inline-flex items-center gap-1"><Heart className="w-3 h-3" strokeWidth={1.6} />{likeCount.toLocaleString()}</span>
          <span className="inline-flex items-center gap-1"><Wand2 className="w-3 h-3" strokeWidth={1.6} />{reel.remix_count.toLocaleString()}</span>
        </div>
        <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover/tile:opacity-100 transition-opacity duration-300">
          <ActionDot Icon={Heart} active={liked} activeHue="350 80% 65%" label={liked ? "Liked" : "Like"} onClick={toggleLike} />
          <ActionDot Icon={MessageCircle} label="Comments" onClick={openComments} />
          <ActionDot Icon={Wand2} label="Remix" activeHue="280 70% 65%" onClick={remix} />
        </div>
      </div>
      <div className="pt-3 px-1">
        <div
          className="text-[15px] text-foreground/95 italic font-light leading-snug line-clamp-2"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          {reel.title}
        </div>
        <div className="mt-2 flex items-center gap-2 text-[10.5px] text-muted-foreground/65 font-mono uppercase tracking-[0.24em]">
          {reel.creator_avatar ? (
            <img src={reel.creator_avatar} alt="" className="w-4 h-4 rounded-full" />
          ) : (
            <div className="w-4 h-4 rounded-full bg-white/[0.06] flex items-center justify-center text-[8px] text-foreground/85">
              {(reel.creator_name?.[0] || "?").toUpperCase()}
            </div>
          )}
          {reel.creator_name || "Anonymous"}
        </div>
      </div>
    </motion.div>
  );
}

function ActionDot({
  Icon, label, onClick, active, activeHue,
}: {
  Icon: typeof Heart;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  active?: boolean;
  activeHue?: string;
}) {
  const hue = activeHue ?? "var(--accent)";
  const isVar = hue.startsWith("var");
  const color = isVar ? "hsl(var(--accent))" : `hsl(${hue})`;
  const bg = active
    ? (isVar ? "hsl(var(--accent)/0.20)" : `hsla(${hue} / 0.20)`)
    : "hsl(0 0% 0% / 0.55)";
  const ring = active
    ? (isVar ? "hsl(var(--accent)/0.45)" : `hsla(${hue} / 0.45)`)
    : "hsl(0 0% 100% / 0.12)";
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="h-8 w-8 grid place-items-center rounded-full backdrop-blur-2xl transition-all hover:scale-110"
      style={{
        background: bg,
        boxShadow: `inset 0 0 0 1px ${ring}`,
      }}
    >
      <Icon
        className="h-3.5 w-3.5 text-white/95"
        strokeWidth={1.7}
        style={{ color: active ? color : undefined }}
        fill={active && Icon === Heart ? color : "none"}
      />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ChallengesSection — frameless glass plates
// ─────────────────────────────────────────────────────────────────────────────
function DraftsSection({ drafts }: { drafts: DraftRow[] }) {
  return (
    <section className="mb-24">
      <SectionLabel label="Your unfinished" icon={Clock} meta={`${drafts.length} in progress`} />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {drafts.map((d) => (
          <Link key={d.id} to={`/editor/${d.id}`} className="group/d block">
            <div className="relative aspect-video rounded-xl overflow-hidden bg-black/40">
              {d.thumbnail_url ? (
                <img src={d.thumbnail_url} alt="" className="w-full h-full object-cover scale-[1.01] group-hover/d:scale-[1.05] transition-transform duration-700 ease-out" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/30">
                  <Wand2 className="w-4 h-4" strokeWidth={1.5} />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
              <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </div>
            <div className="pt-2 px-0.5">
              <div className="text-[12.5px] text-foreground/95 font-light italic truncate" style={{ fontFamily: "'Fraunces', serif" }}>
                {d.title || "Untitled"}
              </div>
              <div className="text-[9px] text-muted-foreground/50 font-mono uppercase tracking-[0.28em] mt-1">{d.status}</div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WanderRail — frameless cross-link tiles
// ─────────────────────────────────────────────────────────────────────────────
function TechniqueGrid({
  onTry,
  authed,
}: {
  onTry: (t: Technique) => void;
  authed: boolean;
}) {
  return (
    <section className="mb-24">
      <SectionLabel label="Featured Techniques" icon={Aperture} meta="6 craft moves" hue="285 75% 70%" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {TECHNIQUES.map((t, i) => (
          <TechniqueTile key={t.id} t={t} index={i} onTry={() => onTry(t)} authed={authed} />
        ))}
      </div>
    </section>
  );
}

function TechniqueTile({
  t,
  index,
  onTry,
  authed,
}: {
  t: Technique;
  index: number;
  onTry: () => void;
  authed: boolean;
}) {
  const Icon = t.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 0.05 + index * 0.06, duration: 0.55, ease: EASE_PREMIUM }}
      whileHover={{ y: -4 }}
      className="group/t relative rounded-3xl overflow-hidden cursor-pointer transition-shadow"
      style={{
        boxShadow:
          "inset 0 0 0 1px hsl(0 0% 100% / 0.05), inset 0 1px 0 hsla(0,0%,100%,0.06), 0 24px 80px -32px hsl(0 0% 0% / 0.65)",
      }}
      onClick={onTry}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onTry(); } }}
    >
      {/* Immersive single card — the visual fills the whole tile; the
          description + CTA stay hidden and reveal on hover, leaving just
          the title + icon at rest. */}
      <div className="relative aspect-[4/5] overflow-hidden">
        <div
          className="absolute inset-0 transition-transform duration-[1200ms] ease-out group-hover/t:scale-[1.08]"
          style={{ background: t.gradient }}
        />
        <div
          className="absolute inset-0 opacity-[0.10] mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.7'/></svg>\")",
          }}
        />
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        {/* Base scrim deepens on hover so the revealed copy stays legible. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent transition-all duration-500 group-hover/t:via-black/50 group-hover/t:from-black/90" />
        <motion.div
          aria-hidden
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 6 + (index % 3) * 1.5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-6 left-6"
        >
          <div
            className="h-12 w-12 rounded-2xl grid place-items-center backdrop-blur-2xl"
            style={{
              background: `hsla(${t.hue} / 0.18)`,
              boxShadow: `inset 0 0 0 1px hsla(${t.hue} / 0.40), 0 0 24px hsla(${t.hue} / 0.35)`,
              color: `hsl(${t.hue})`,
            }}
          >
            <Icon className="w-5 h-5" strokeWidth={1.6} />
          </div>
        </motion.div>

        <div className="absolute inset-x-0 bottom-0 p-6">
          <span className={cn(TYPE_META, "tracking-[0.30em]")} style={{ color: `hsl(${t.hue})` }}>
            Technique
          </span>
          <h3
            className="mt-2 font-display italic font-light leading-[0.98] tracking-[-0.018em] text-white"
            style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(1.5rem, 2.8vw, 2.1rem)", textShadow: "0 4px 22px hsl(0 0% 0% / 0.55)" }}
          >
            {t.title}
          </h3>
          {/* Reveal-on-hover block: grid-rows trick animates height from 0. */}
          <div className="grid grid-rows-[0fr] opacity-0 transition-all duration-500 ease-out group-hover/t:mt-3 group-hover/t:grid-rows-[1fr] group-hover/t:opacity-100">
            <div className="overflow-hidden">
              <p className="text-[13.5px] font-light leading-relaxed text-white/85">
                {t.oneLiner}
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-[10.5px] font-mono uppercase tracking-[0.28em] text-white/85">
                {authed ? "Try in editor" : "Sign in to try"}
                <ArrowRight className="w-3 h-3 transition-transform group-hover/t:translate-x-0.5" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RemixWall — community remix grid
// ─────────────────────────────────────────────────────────────────────────────
function RemixWall({ reels, loading }: { reels: RemixReel[]; loading: boolean }) {
  return (
    <section className="mb-24">
      <SectionLabel
        label="Community Remixes"
        icon={Wand2}
        meta={loading ? "loading" : `${reels.length} open for remix`}
        hue="195 95% 65%"
      />
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="aspect-[4/5] rounded-2xl bg-white/[0.02] animate-pulse" />
          ))}
        </div>
      ) : reels.length === 0 ? (
        <div
          className="rounded-3xl px-8 py-12 text-center"
          style={{
            background: "linear-gradient(180deg, hsla(195,95%,55%,0.04) 0%, hsla(0,0%,100%,0.005) 100%)",
            boxShadow: "inset 0 0 0 1px hsl(0 0% 100% / 0.05)",
          }}
        >
          <Wand2 className="w-5 h-5 mx-auto mb-3 text-[hsl(195_95%_75%)]" strokeWidth={1.4} />
          <p className="text-[18px] font-light italic text-foreground/85 mb-2" style={{ fontFamily: "'Fraunces', serif" }}>
            The wall is still drying.
          </p>
          <p className="text-[13px] text-muted-foreground/65 max-w-md mx-auto">
            Publish a reel and other directors can pick it up. Come back tonight.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {reels.map((r, i) => (
            <RemixCard key={r.id} reel={r} index={i} />
          ))}
        </div>
      )}
    </section>
  );
}

function RemixCard({ reel, index }: { reel: RemixReel; index: number }) {
  const accent = reel.world_accent ?? "195 95% 60%";
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onEnter = () => {
    if (videoRef.current) {
      try { videoRef.current.currentTime = 0; void videoRef.current.play(); } catch { /* ignore */ }
    }
  };
  const onLeave = () => { try { videoRef.current?.pause(); } catch { /* ignore */ } };
  const remix = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/r/${reel.id}?action=remix`);
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 0.05 + index * 0.06, duration: 0.55, ease: EASE_PREMIUM }}
      whileHover={{ y: -4 }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="group/r relative rounded-2xl overflow-hidden cursor-pointer"
      style={{
        boxShadow: "inset 0 0 0 1px hsl(0 0% 100% / 0.05), 0 24px 80px -32px hsl(0 0% 0% / 0.65)",
      }}
      onClick={() => navigate(`/r/${reel.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); navigate(`/r/${reel.id}`); } }}
    >
      <div className="relative aspect-[4/5] bg-black/40">
        {reel.video_url ? (
          <video
            ref={videoRef}
            src={reel.video_url}
            poster={reel.thumbnail_url ?? undefined}
            muted loop playsInline preload="metadata"
            className="absolute inset-0 w-full h-full object-cover scale-[1.01] group-hover/r:scale-[1.06] transition-transform duration-[1200ms] ease-out"
          />
        ) : reel.thumbnail_url ? (
          <img
            src={reel.thumbnail_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover scale-[1.01] group-hover/r:scale-[1.06] transition-transform duration-[1200ms] ease-out"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(120% 80% at 30% 30%, hsla(${accent} / 0.30) 0%, transparent 60%), linear-gradient(135deg, hsl(220 30% 8%) 0%, hsl(225 35% 4%) 100%)`,
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        <div
          className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9.5px] font-mono uppercase tracking-[0.30em] backdrop-blur-2xl"
          style={{
            color: `hsl(${accent})`,
            background: `hsla(${accent} / 0.12)`,
            boxShadow: `inset 0 0 0 1px hsla(${accent} / 0.35)`,
          }}
        >
          <Wand2 className="w-2.5 h-2.5" strokeWidth={1.8} />
          {reel.remix_count}× remixed
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <h3
            className="text-white text-[17px] font-light italic leading-snug line-clamp-2"
            style={{ fontFamily: "'Fraunces', serif", textShadow: "0 4px 18px hsl(0 0% 0% / 0.55)" }}
          >
            {reel.title || "Untitled"}
          </h3>
          <div className="mt-2.5 flex items-center gap-3 text-[10px] font-mono text-white/75 tabular-nums tracking-[0.22em]">
            <span className="inline-flex items-center gap-1">
              <Eye className="w-3 h-3" strokeWidth={1.6} />
              {(reel.play_count ?? 0).toLocaleString()}
            </span>
            <span className="inline-flex items-center gap-1">
              <Heart className="w-3 h-3" strokeWidth={1.6} />
              {(reel.like_count ?? 0).toLocaleString()}
            </span>
            {reel.creator_name && (
              <>
                <span aria-hidden className="w-1 h-1 rounded-full bg-white/30" />
                <span className="not-italic truncate">{reel.creator_name}</span>
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={remix}
          className="absolute top-3 right-3 inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[10.5px] font-mono uppercase tracking-[0.28em] text-foreground backdrop-blur-2xl opacity-0 group-hover/r:opacity-100 transition-all"
          style={{
            background: "linear-gradient(180deg, hsla(195,95%,55%,0.22) 0%, hsla(195,95%,45%,0.06) 100%)",
            boxShadow: "inset 0 0 0 1px hsla(195,95%,55%,0.45), 0 0 24px hsla(195,95%,55%,0.40)",
          }}
        >
          <Wand2 className="w-3 h-3" strokeWidth={1.6} />
          Remix this
        </button>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QuoteRotator — 12 filmmaker quotes, 8s rotation, hover pauses
// ─────────────────────────────────────────────────────────────────────────────
function EmptyAuthPlate({
  line,
  icon: Icon,
}: {
  line: string;
  icon: React.ElementType;
}) {
  return (
    <div
      className="relative rounded-3xl px-8 py-10 text-center overflow-hidden"
      style={{
        background: "linear-gradient(180deg, hsla(45,95%,55%,0.04) 0%, hsla(0,0%,100%,0.005) 100%)",
        boxShadow: "inset 0 0 0 1px hsl(0 0% 100% / 0.05)",
      }}
    >
      <Icon className="w-5 h-5 mx-auto mb-3 text-[hsl(45_95%_75%)]" strokeWidth={1.4} />
      <p className="text-[18px] font-light italic text-foreground/85 mb-2" style={{ fontFamily: "'Fraunces', serif" }}>
        {line}
      </p>
      <Link
        to="/auth?next=/lobby"
        className="mt-3 inline-flex items-center gap-2 h-10 px-5 rounded-full text-[11px] font-mono uppercase tracking-[0.28em] text-foreground transition-all"
        style={{
          background: "linear-gradient(180deg, hsla(45,95%,60%,0.22) 0%, hsla(35,95%,50%,0.06) 100%)",
          boxShadow: "inset 0 0 0 1px hsla(45,95%,60%,0.40), 0 0 28px hsla(45,95%,60%,0.30)",
        }}
      >
        <Calendar className="w-3.5 h-3.5" strokeWidth={1.6} />
        Sign in to start
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
