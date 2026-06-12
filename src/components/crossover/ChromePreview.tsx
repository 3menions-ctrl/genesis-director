/**
 * ChromePreview — pure CSS mock-ups of the digital interfaces the
 * Crossover templates "break out of." Used inside the composer so the
 * creator can visualise what the AI will generate before they spend
 * credits. Not the actual render target — that's still produced by the
 * AI pipeline from the template's prompt. This is preview-only chrome.
 *
 * Each kind renders a stylised glass-frame mock of the original UI with
 * a 4-second loop of a faint "step out" gesture so the user gets the
 * energy of the template at a glance.
 */
import { memo } from "react";
import { motion } from "framer-motion";
import {
  Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Volume2, Search,
  ChevronLeft, ChevronRight, Pause, Settings, ListFilter, Bell, User,
  Camera, Play, MapPin, Radar as RadarIcon, Activity, Tv2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ChromeKind =
  | "tiktok" | "reels" | "youtube" | "netflix" | "desktop" | "crt" | "arcade"
  | "hologram" | "comic" | "painting" | "mirror" | "radar" | "oscilloscope"
  | "thermal" | "xray" | "instagram" | "facebook" | "tablet" | "phone"
  | "tv" | "projector" | "generic";

interface Props {
  kind: ChromeKind;
  aspectRatio: "9:16" | "16:9" | "1:1" | "4:3" | "21:9";
  /** Optional content URL (image / video poster) to fill the inner frame. */
  posterUrl?: string | null;
  className?: string;
}

export const ChromePreview = memo(function ChromePreview({
  kind, aspectRatio, posterUrl, className,
}: Props) {
  const ratioClass =
    aspectRatio === "9:16" ? "aspect-[9/16]"
    : aspectRatio === "16:9" ? "aspect-video"
    : aspectRatio === "21:9" ? "aspect-[21/9]"
    : aspectRatio === "4:3"  ? "aspect-[4/3]"
    : "aspect-square";

  return (
    <div className={cn("relative w-full overflow-hidden rounded-3xl", ratioClass, className)}
         style={{ background: "linear-gradient(180deg, #0a0d12 0%, #03050a 100%)" }}>
      {/* Step-out shimmer — subliminal motion conveying the "break-out" energy. */}
      <motion.div
        aria-hidden
        className="absolute inset-x-0 -top-1/2 h-full pointer-events-none"
        animate={{ y: ["0%", "200%"] }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        style={{ background: "linear-gradient(180deg, transparent, hsla(215,100%,60%,0.18), transparent)" }}
      />

      {/* Per-kind chrome */}
      {(() => {
        switch (kind) {
          case "tiktok":          return <TikTokChrome poster={posterUrl} />;
          case "reels":
          case "instagram":       return <ReelsChrome poster={posterUrl} />;
          case "youtube":         return <YouTubeChrome poster={posterUrl} />;
          case "netflix":         return <NetflixChrome poster={posterUrl} />;
          case "desktop":         return <DesktopChrome poster={posterUrl} />;
          case "crt":             return <CRTChrome />;
          case "arcade":          return <ArcadeChrome />;
          case "hologram":        return <HologramChrome />;
          case "comic":           return <ComicChrome />;
          case "painting":        return <PaintingChrome />;
          case "mirror":          return <MirrorChrome />;
          case "radar":           return <RadarChrome />;
          case "oscilloscope":    return <OscilloChrome />;
          case "thermal":         return <ThermalChrome />;
          case "xray":            return <XrayChrome />;
          case "facebook":        return <FacebookChrome poster={posterUrl} />;
          case "tablet":          return <TabletChrome poster={posterUrl} />;
          case "phone":           return <PhoneChrome poster={posterUrl} />;
          case "tv":              return <TVChrome poster={posterUrl} />;
          case "projector":       return <ProjectorChrome />;
          default:                return <GenericChrome poster={posterUrl} />;
        }
      })()}

      {/* Subtle "BREAK OUT" stamp in the corner — editorial tell. */}
      <div className="absolute bottom-3 right-3 text-[8px] font-mono uppercase tracking-[0.32em] text-white/30 pointer-events-none">
        BREAK · OUT
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────
// Per-kind chrome — minimal CSS-only mockups.
// ─────────────────────────────────────────────────────────────────────────

function Poster({ url, dim }: { url?: string | null; dim?: number }) {
  if (url) {
    return (
      <img src={url} alt=""
           className="absolute inset-0 w-full h-full object-cover opacity-90" />
    );
  }
  return (
    <div className="absolute inset-0"
      style={{
        opacity: dim ?? 1,
        background:
          "radial-gradient(ellipse at 50% 35%, hsla(215,100%,60%,0.35), transparent 60%)," +
          "radial-gradient(ellipse at 80% 70%, hsla(280,70%,55%,0.30), transparent 65%)," +
          "linear-gradient(180deg, #0f1217 0%, #04060a 100%)",
      }} />
  );
}

// TikTok-style vertical UI.
function TikTokChrome({ poster }: { poster?: string | null }) {
  return (
    <>
      <Poster url={poster} />
      {/* Top bar: For You / Following */}
      <div className="absolute top-4 left-0 right-0 flex justify-center gap-5 text-[12px] text-white/85 font-medium">
        <span className="opacity-50">Following</span>
        <span aria-hidden className="text-white/20">|</span>
        <span className="border-b-2 border-white pb-0.5">For You</span>
      </div>
      {/* Right rail */}
      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5 text-white/95">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-500 to-violet-500 ring-2 ring-white shadow-lg" />
        <ActionIcon icon={Heart} count="2.3M" />
        <ActionIcon icon={MessageCircle} count="48K" />
        <ActionIcon icon={Bookmark} count="91K" />
        <ActionIcon icon={Send} count="120K" />
        <div className="w-10 h-10 rounded-full bg-black/55 border border-white/30 backdrop-blur flex items-center justify-center">
          <MoreHorizontal className="w-4 h-4" />
        </div>
      </div>
      {/* Bottom caption */}
      <div className="absolute bottom-4 left-3 right-16 text-white/95 text-[12px] leading-tight">
        <div className="font-semibold mb-1">@creator</div>
        <div className="opacity-85">Original sound — Trending #breakout</div>
      </div>
      {/* Bottom nav */}
      <div className="absolute bottom-0 left-0 right-0 h-12 bg-black/70 backdrop-blur flex items-center justify-around text-white/80 text-[10px]">
        {["Home", "Friends", "+", "Inbox", "Profile"].map((l, i) => (
          <span key={l} className={i === 2 ? "px-2 py-1 rounded-md bg-white text-black font-bold" : "opacity-70"}>{l}</span>
        ))}
      </div>
    </>
  );
}

function ReelsChrome({ poster }: { poster?: string | null }) {
  return (
    <>
      <Poster url={poster} />
      <div className="absolute top-4 left-4 text-[13px] text-white font-semibold tracking-tight">Reels</div>
      <div className="absolute top-4 right-4 flex items-center gap-3 text-white/90"><Camera className="w-4 h-4" /><MoreHorizontal className="w-4 h-4" /></div>
      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5 text-white/95">
        <ActionIcon icon={Heart} count="421K" />
        <ActionIcon icon={MessageCircle} count="9.2K" />
        <ActionIcon icon={Send} count="11K" />
        <ActionIcon icon={Bookmark} />
        <div className="w-10 h-10 rounded-md bg-white/10 border border-white/30 backdrop-blur" />
      </div>
      <div className="absolute bottom-4 left-3 right-16 text-white/95 text-[12px]">
        <div className="font-semibold">@you</div>
        <div className="opacity-80">Audio · Original</div>
      </div>
    </>
  );
}

function YouTubeChrome({ poster }: { poster?: string | null }) {
  return (
    <>
      <Poster url={poster} />
      <div className="absolute inset-x-0 top-0 h-9 bg-black/85 flex items-center px-3 gap-3 text-white/85 text-[12px]">
        <div className="font-bold text-rose-500 tracking-tight">▶ YouTube</div>
        <div className="flex-1" />
        <Search className="w-3.5 h-3.5" />
        <Bell className="w-3.5 h-3.5" />
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-700" />
      </div>
      {/* Player controls */}
      <div className="absolute bottom-3 left-3 right-3">
        <div className="h-1 rounded-full bg-white/15 mb-2">
          <div className="h-full w-2/5 rounded-full bg-rose-500" />
        </div>
        <div className="flex items-center gap-3 text-white/85 text-[10px]">
          <Play className="w-3 h-3" /> <Pause className="w-3 h-3" />
          <span className="font-mono">2:14 / 5:30</span>
          <span className="ml-auto opacity-65">HD · 1080p</span>
        </div>
      </div>
    </>
  );
}

function NetflixChrome({ poster }: { poster?: string | null }) {
  return (
    <>
      <Poster url={poster} />
      <div className="absolute inset-x-0 top-0 h-9 bg-gradient-to-b from-black/90 to-transparent flex items-center px-3 text-white/85 text-[12px]">
        <div className="text-rose-600 font-black tracking-[0.05em]">NETFLIX</div>
      </div>
      <div className="absolute bottom-3 left-3 right-3">
        <div className="h-1 rounded-full bg-white/15 mb-2">
          <div className="h-full w-3/5 rounded-full bg-rose-500" />
        </div>
        <div className="flex items-center gap-2 text-white/85 text-[10px]"><Play className="w-3 h-3" /><span className="font-mono">37:12</span></div>
      </div>
    </>
  );
}

function DesktopChrome({ poster }: { poster?: string | null }) {
  return (
    <>
      <Poster url={poster} />
      {/* Window chrome */}
      <div className="absolute inset-x-0 top-0 h-7 bg-glass-hover backdrop-blur border-b border-white/[0.06] flex items-center px-3 gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-rose-500/85" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400/85" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/85" />
        <div className="flex-1 mx-3 h-4 rounded-md bg-glass-hover border border-white/[0.05]" />
      </div>
    </>
  );
}

function CRTChrome() {
  return (
    <>
      <div className="absolute inset-2 rounded-[2rem] border-4 border-zinc-700 shadow-[inset_0_0_40px_rgba(0,0,0,0.95)] overflow-hidden">
        <div className="absolute inset-0"
             style={{
               background:
                 "repeating-linear-gradient(180deg, hsla(0,0%,100%,0.06) 0px, transparent 2px)," +
                 "radial-gradient(ellipse at 50% 50%, hsla(120,80%,40%,0.18), transparent 65%)," +
                 "linear-gradient(180deg, #060c06 0%, #020402 100%)",
             }} />
        <motion.div aria-hidden className="absolute inset-0"
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 0.18, repeat: Infinity }}
          style={{ background: "linear-gradient(180deg, transparent 47%, hsla(120,80%,60%,0.18) 50%, transparent 53%)" }} />
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] font-mono uppercase tracking-[0.32em] text-emerald-400/80">
          ▌ CH 03
        </div>
      </div>
    </>
  );
}

function ArcadeChrome() {
  return (
    <>
      <div className="absolute inset-0" style={{
        background: "linear-gradient(180deg, #07020a, #03000a)",
      }} />
      <div className="absolute inset-3 rounded-2xl border-2 border-pink-500/40 shadow-[inset_0_0_80px_rgba(255,0,150,0.25)] flex items-center justify-center">
        <div className="text-pink-400 font-mono text-[20px] tracking-[0.32em] uppercase animate-pulse">INSERT&nbsp;COIN</div>
      </div>
    </>
  );
}

function HologramChrome() {
  return (
    <>
      <div className="absolute inset-0" style={{
        background:
          "radial-gradient(ellipse at 50% 60%, hsla(195,100%,60%,0.35), transparent 60%)," +
          "linear-gradient(180deg, #00070c, #000)"
      }} />
      <div className="absolute inset-x-0 bottom-1/3 mx-auto w-3/5 aspect-square rounded-full border border-cyan-300/40 animate-pulse" />
      <div className="absolute top-3 left-3 right-3 text-cyan-200 text-[10px] font-mono uppercase tracking-[0.28em] flex justify-between">
        <span>HOLO · ENGAGED</span><span>v4.21.0</span>
      </div>
    </>
  );
}

function ComicChrome() {
  return (
    <>
      <div className="absolute inset-0 bg-white" />
      <div className="absolute inset-3 grid grid-cols-2 grid-rows-2 gap-2">
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className="border-[3px] border-black bg-zinc-100" />
        ))}
      </div>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-black font-black text-[14px] tracking-tight">POW!</div>
    </>
  );
}

function PaintingChrome() {
  return (
    <>
      <div className="absolute inset-2 rounded-md border-[10px] border-amber-700/80 shadow-[inset_0_0_24px_rgba(0,0,0,0.6)]" />
      <div className="absolute inset-6"
        style={{
          background:
            "radial-gradient(ellipse at 50% 60%, hsla(220,60%,30%,0.6), transparent 60%)," +
            "linear-gradient(180deg, hsl(200 30% 25%), hsl(220 40% 15%))",
        }} />
    </>
  );
}

function MirrorChrome() {
  return (
    <>
      <div className="absolute inset-2 rounded-3xl border-[6px] border-zinc-300/40 bg-gradient-to-b from-white/[0.04] to-white/[0.02]" />
      <div className="absolute inset-0 backdrop-blur-3xl opacity-30" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 text-[11px] text-white/55 font-mono uppercase tracking-[0.32em]">
        09:42
      </div>
    </>
  );
}

function RadarChrome() {
  return (
    <>
      <div className="absolute inset-0 bg-black" />
      <div className="absolute inset-4 rounded-full border border-emerald-400/40">
        <div className="absolute inset-4 rounded-full border border-emerald-400/30" />
        <div className="absolute inset-8 rounded-full border border-emerald-400/25" />
      </div>
      <motion.div aria-hidden className="absolute inset-4 rounded-full"
        animate={{ rotate: 360 }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        style={{
          background:
            "conic-gradient(from 0deg, hsla(120,80%,50%,0.5) 0%, transparent 35%)",
          maskImage: "radial-gradient(circle, black 60%, transparent 70%)",
        }} />
      <div className="absolute top-3 left-3 text-emerald-300 text-[10px] font-mono">PING · 042</div>
      <RadarIcon className="absolute bottom-3 right-3 w-4 h-4 text-emerald-300/85" />
    </>
  );
}

function OscilloChrome() {
  return (
    <>
      <div className="absolute inset-0 bg-black" />
      <div className="absolute inset-4 border border-emerald-400/40 grid grid-cols-8 grid-rows-6">
        {Array.from({ length: 48 }).map((_, i) => (
          <div key={i} className="border-r border-b border-emerald-400/12" />
        ))}
      </div>
      <svg className="absolute inset-4" preserveAspectRatio="none" viewBox="0 0 100 60">
        <path d="M0 30 Q 10 5, 20 30 T 40 30 T 60 30 T 80 30 T 100 30"
              stroke="hsl(120 80% 55%)" strokeWidth="1.5" fill="none" />
      </svg>
      <Activity className="absolute bottom-3 right-3 w-4 h-4 text-emerald-300/85" />
    </>
  );
}

function ThermalChrome() {
  return (
    <>
      <div className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 60%, hsl(20 100% 55%), hsl(220 100% 30%) 70%, hsl(240 60% 10%) 100%)",
        }} />
      <div className="absolute top-3 left-3 text-white/85 text-[10px] font-mono">THERM · 34.7°C</div>
    </>
  );
}

function XrayChrome() {
  return (
    <>
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, #001225, #000814)" }} />
      <div className="absolute inset-6 border border-cyan-300/30 rounded-md" />
      <div className="absolute top-3 left-3 text-cyan-200 text-[10px] font-mono uppercase tracking-[0.22em]">X-RAY · L4</div>
    </>
  );
}

function FacebookChrome({ poster }: { poster?: string | null }) {
  return (
    <>
      <Poster url={poster} />
      <div className="absolute inset-x-0 top-0 h-8 bg-[#1877f2] flex items-center px-3 text-white text-[12px] font-bold">facebook</div>
      <div className="absolute bottom-3 left-3 right-3 flex items-center gap-3 text-white/85 text-[10px]">
        <Heart className="w-3.5 h-3.5" /> Like
        <MessageCircle className="w-3.5 h-3.5" /> Comment
        <Send className="w-3.5 h-3.5" /> Share
      </div>
    </>
  );
}

function TabletChrome({ poster }: { poster?: string | null }) {
  return (
    <>
      <div className="absolute inset-2 rounded-[2rem] border-[6px] border-zinc-700 overflow-hidden">
        <Poster url={poster} />
      </div>
    </>
  );
}

function PhoneChrome({ poster }: { poster?: string | null }) {
  return (
    <>
      <div className="absolute inset-2 rounded-[2.5rem] border-[8px] border-zinc-800 shadow-[inset_0_0_24px_rgba(0,0,0,0.7)] overflow-hidden">
        <Poster url={poster} />
        {/* Notch */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-4 rounded-full bg-black" />
      </div>
    </>
  );
}

function TVChrome({ poster }: { poster?: string | null }) {
  return (
    <>
      <div className="absolute inset-2 rounded-md border-[6px] border-zinc-900 bg-black overflow-hidden">
        <Poster url={poster} />
      </div>
      <Tv2 className="absolute bottom-3 right-3 w-4 h-4 text-white/35" />
    </>
  );
}

function ProjectorChrome() {
  return (
    <>
      <div className="absolute inset-0 bg-black" />
      <div className="absolute inset-3 bg-white/[0.85]" />
      <div className="absolute inset-3" style={{
        background:
          "radial-gradient(ellipse at 50% 50%, transparent, rgba(0,0,0,0.55))," +
          "linear-gradient(180deg, transparent, transparent)",
      }} />
    </>
  );
}

function GenericChrome({ poster }: { poster?: string | null }) {
  return <Poster url={poster} />;
}

// ─────────────────────────────────────────────────────────────────────────

function ActionIcon({ icon: Icon, count }: { icon: React.ElementType; count?: string }) {
  return (
    <div className="flex flex-col items-center text-white/95 text-[10px]">
      <div className="w-10 h-10 rounded-full bg-black/55 border border-white/15 backdrop-blur flex items-center justify-center">
        <Icon className="w-4 h-4" />
      </div>
      {count && <span className="mt-1 font-medium drop-shadow">{count}</span>}
    </div>
  );
}
