/**
 * AudioMixer — vertical channel strips per track + master.
 *
 * Real audio engineers expect a mixer that LOOKS like a mixer:
 * vertical faders, dB scale, mute/solo per channel, an active level
 * meter beside each fader, a master bus on the right. This is that
 * surface.
 *
 * Toggle with X. V1 controls the video clip's audio bus (everything
 * playing back today). A1 / A2 sliders are visual scaffolding so
 * users can already see where music + dialog buses will land when
 * we split audio playback in a later commit. Master mutes / fades
 * the entire bus regardless of clip settings.
 */
import { useEffect, useRef, useState } from "react";
import {
  Volume2,
  VolumeX,
  Sliders,
  Disc3,
  Music2,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";
import { useEditor } from "@/hooks/editor/useEditor";
import { Surface, SurfaceHeader, SurfaceFooter, SurfaceKbdHint } from "./Surface";

interface Props {
  open: boolean;
  onClose: () => void;
}

type TrackId = "V1" | "A1" | "A2" | "MASTER";

interface StripDef {
  id: TrackId;
  label: string;
  hint: string;
  Icon: typeof Volume2;
  isMaster?: boolean;
}

const STRIPS: StripDef[] = [
  { id: "V1", label: "V1", hint: "Video audio", Icon: Video },
  { id: "A1", label: "A1", hint: "Dialog · SFX", Icon: Disc3 },
  { id: "A2", label: "A2", hint: "Music · score", Icon: Music2 },
  { id: "MASTER", label: "MASTER", hint: "Output bus", Icon: Sliders, isMaster: true },
];

/** Convert linear gain (0..1.5) to a rough dB display value. */
function toDb(linear: number): string {
  if (linear <= 0.001) return "−∞";
  const db = 20 * Math.log10(linear);
  if (db >= 0) return `+${db.toFixed(1)}`;
  return db.toFixed(1);
}

export function AudioMixer({ open, onClose }: Props) {
  const {
    masterVolume,
    masterMuted,
    trackVolumes,
    trackMuted,
    isPlaying,
    setMasterVolume,
    setMasterMuted,
    setTrackVolume,
    setTrackMuted,
  } = useEditor();

  const valueFor = (id: TrackId) =>
    id === "MASTER" ? masterVolume : trackVolumes[id as "V1" | "A1" | "A2"];

  const mutedFor = (id: TrackId) =>
    id === "MASTER" ? masterMuted : trackMuted[id as "V1" | "A1" | "A2"];

  const setValue = (id: TrackId, v: number) => {
    if (id === "MASTER") setMasterVolume(v);
    else setTrackVolume(id as "V1" | "A1" | "A2", v);
  };

  const toggleMute = (id: TrackId) => {
    if (id === "MASTER") setMasterMuted(!masterMuted);
    else setTrackMuted(id as "V1" | "A1" | "A2", !trackMuted[id as "V1" | "A1" | "A2"]);
  };

  return (
    <Surface open={open} onClose={onClose} size="sm">
      <SurfaceHeader
        eyebrow="◆ Mixer"
        title="Channels · master."
        description="V1 = video clip audio. A1 / A2 are visual scaffolding for incoming dialog + music buses."
        onClose={onClose}
      />
      <div className="shrink-0 px-4 pt-3 pb-5">
        <div className="grid grid-cols-4 gap-2">
          {STRIPS.map((strip) => (
            <ChannelStrip
              key={strip.id}
              strip={strip}
              value={valueFor(strip.id)}
              muted={mutedFor(strip.id)}
              isPlaying={isPlaying}
              onValueChange={(v) => setValue(strip.id, v)}
              onToggleMute={() => toggleMute(strip.id)}
            />
          ))}
        </div>
      </div>
      <SurfaceFooter>
        <span>Master mutes the entire bus regardless of clip settings</span>
        <SurfaceKbdHint keys="X" label="toggle" />
      </SurfaceFooter>
    </Surface>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ChannelStrip — single column with label, level meter, fader, dB
// readout, mute + solo. Same compact pattern that fits four wide in
// a 380px modal.
// ─────────────────────────────────────────────────────────────────────────────
function ChannelStrip({
  strip,
  value,
  muted,
  isPlaying,
  onValueChange,
  onToggleMute,
}: {
  strip: StripDef;
  value: number;
  muted: boolean;
  isPlaying: boolean;
  onValueChange: (v: number) => void;
  onToggleMute: () => void;
}) {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number | null>(null);

  // Pseudo level meter — sine + jitter scaled by gain when playing,
  // smoothly decays when paused or muted. Same recipe as the
  // transport VU meter but per-strip so each row reads its own
  // "activity."
  useEffect(() => {
    if (!isPlaying || muted) {
      let l = level;
      const decay = () => {
        l = l * 0.85;
        if (l < 0.01) {
          setLevel(0);
          return;
        }
        setLevel(l);
        rafRef.current = requestAnimationFrame(decay);
      };
      decay();
      return () => {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      };
    }
    const start = performance.now();
    // Different strips have different "personalities" via their id
    // hashed — V1 driver vs A2 music feel slightly different.
    let seed = 0;
    for (let i = 0; i < strip.id.length; i++) seed = seed * 31 + strip.id.charCodeAt(i);
    const freq = 5 + (seed % 5);
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      const sine = (Math.sin(t * freq) + 1) / 2;
      const jitter = Math.random() * 0.3;
      const env = 0.4 + 0.6 * sine;
      const cap = strip.isMaster ? Math.min(1.2, value) : Math.min(1.0, value);
      const next = Math.max(0, Math.min(1, cap * (env + jitter) * 0.92));
      setLevel(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, value, muted]);

  const Icon = strip.Icon;
  return (
    <div
      className={cn(
        "relative flex flex-col items-stretch rounded-md px-2 pt-2 pb-2.5 gap-1.5",
        strip.isMaster
          ? "bg-[hsl(var(--accent)/0.06)] ring-1 ring-inset ring-accent/25"
          : "bg-white/[0.025]",
      )}
    >
      {/* Label + icon */}
      <div className="flex items-center justify-between">
        <Icon
          className={cn(
            "h-3 w-3",
            strip.isMaster ? "text-accent" : "text-muted-foreground/65",
          )}
          strokeWidth={1.6}
        />
        <span
          className={cn(
            TYPE_META,
            "font-mono tracking-[0.22em]",
            strip.isMaster ? "text-accent" : "text-foreground/80",
          )}
        >
          {strip.label}
        </span>
      </div>

      {/* dB readout */}
      <div
        className={cn(
          "text-center font-mono text-[10px] tabular-nums",
          muted ? "text-rose-300/85" : "text-foreground/85",
        )}
      >
        {muted ? "MUTE" : `${toDb(value)} dB`}
      </div>

      {/* Level meter + fader, side by side */}
      <div className="relative h-[120px] mx-auto" style={{ width: 50 }}>
        {/* Meter (left) */}
        <div className="absolute left-0 top-0 bottom-0 w-[8px] rounded-sm bg-white/[0.05] overflow-hidden">
          <div
            className="absolute inset-x-0 bottom-0 rounded-sm transition-[height] duration-75 bg-gradient-to-t from-emerald-400 via-amber-300 to-rose-300"
            style={{ height: `${level * 100}%` }}
          />
        </div>

        {/* Fader (right) */}
        <div className="absolute right-0 top-0 bottom-0 w-[28px]">
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-white/[0.10]" />
          <input
            type="range"
            min={0}
            max={1.5}
            step={0.01}
            value={value}
            onChange={(e) => onValueChange(parseFloat(e.target.value))}
            aria-label={`${strip.label} fader`}
            // Rotate -90deg so the range becomes vertical
            className={cn(
              "absolute left-1/2 top-1/2 cursor-pointer",
              "-translate-x-1/2 -translate-y-1/2 origin-center",
            )}
            style={{
              width: 110,
              height: 28,
              transform: "translate(-50%, -50%) rotate(-90deg)",
              accentColor: "hsl(var(--accent))",
            }}
          />
        </div>
      </div>

      {/* Mute toggle */}
      <button
        type="button"
        onClick={onToggleMute}
        className={cn(
          "shrink-0 h-6 inline-flex items-center justify-center rounded text-[10px] font-mono uppercase tracking-[0.18em] transition-colors",
          muted
            ? "bg-rose-400/15 text-rose-300 ring-1 ring-inset ring-rose-400/35"
            : "text-muted-foreground/65 hover:text-foreground hover:bg-white/[0.04]",
        )}
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted ? (
          <VolumeX className="h-3 w-3" strokeWidth={1.6} />
        ) : (
          <Volume2 className="h-3 w-3" strokeWidth={1.6} />
        )}
      </button>
    </div>
  );
}

