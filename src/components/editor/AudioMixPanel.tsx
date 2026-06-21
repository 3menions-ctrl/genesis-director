/**
 * AudioMixPanel — Inspector surface for the per-clip audio mix.
 *
 * Sections:
 *   - Master row: Volume, Pan, Mute
 *   - 3-band EQ with live response curve visualizer
 *   - Compressor with static IO curve visualizer + 4 preset chips
 *
 * Live preview is wired via useAudioMixChain on the player's video
 * element. Export bake compiles via the Deno-side audio-mix-filters.
 */
import { useMemo } from "react";
import {
  Music,
  Activity,
  Sliders,
  Power,
  RotateCcw,
  VolumeX,
  Waves,
  Wind,
} from "lucide-react";
import { cn } from "@/lib/utils";

import {
  type AudioMix,
  DEFAULT_AUDIO_MIX,
  DEFAULT_NOISE_REDUCTION,
  DEFAULT_REVERB,
  COMPRESSOR_PRESETS,
  sampleEqCurve,
  compressorIo,
  normalizeMix,
} from "@/lib/editor/audio-mix";

interface Props {
  mix: AudioMix;
  onChange: (next: AudioMix) => void;
}

export function AudioMixPanel({ mix: rawMix, onChange }: Props) {
  // Defensive normalize at the boundary — a partial AudioMix from
  // older JSONB drafts would crash the panel's compressor / eq reads
  // with `undefined.enabled`. Downstream code can trust every field.
  const mix = useMemo(() => normalizeMix(rawMix), [rawMix]);
  const isIdentity = JSON.stringify(mix) === JSON.stringify(DEFAULT_AUDIO_MIX);
  const update = (patch: Partial<AudioMix>) => onChange({ ...mix, ...patch });

  return (
    <section className="space-y-5">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="flex items-center justify-between">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/45 inline-flex items-center gap-2">
          <Music className="w-3 h-3" />
          Audio mix
        </h3>
        {!isIdentity && (
          <button
            onClick={() => onChange(DEFAULT_AUDIO_MIX)}
            className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full ring-1 ring-inset ring-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] text-[9px] font-mono uppercase tracking-[0.18em] text-foreground/65 hover:text-foreground/95 transition-colors"
          >
            <RotateCcw className="w-2.5 h-2.5" />
            Reset
          </button>
        )}
      </header>

      {/* ── Master row ─────────────────────────────────────────── */}
      <div className="rounded-xl ring-1 ring-inset ring-white/[0.06] bg-white/[0.015] backdrop-blur p-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Slider
            label="Volume"
            value={Math.round(mix.volume * 100)}
            min={0} max={150} step={1}
            format={(v) => `${v}%`}
            onChange={(v) => update({ volume: v / 100 })}
          />
          <Slider
            label="Pan"
            value={Math.round(mix.pan * 100)}
            min={-100} max={100} step={1}
            format={(v) => v === 0 ? "C" : v < 0 ? `L${-v}` : `R${v}`}
            zeroCenter
            onChange={(v) => update({ pan: v / 100 })}
          />
        </div>
        <button
          onClick={() => update({ muted: !mix.muted })}
          className={cn(
            "inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[10px] font-mono uppercase tracking-[0.18em] transition-all ring-1 ring-inset",
            mix.muted
              ? "ring-rose-300/40 bg-rose-500/15 text-rose-100"
              : "ring-white/[0.06] bg-white/[0.02] text-foreground/65 hover:text-foreground/95 hover:ring-white/[0.12]",
          )}
        >
          <VolumeX className="w-3 h-3" />
          {mix.muted ? "Muted" : "Mute"}
        </button>
      </div>

      {/* ── 3-band EQ ──────────────────────────────────────────── */}
      <div className="rounded-xl ring-1 ring-inset ring-white/[0.06] bg-white/[0.015] backdrop-blur p-3 space-y-3">
        <ProcessorHeader
          icon={Sliders}
          label="3-band EQ"
          enabled={mix.eq.enabled}
          onToggle={() => update({ eq: { ...mix.eq, enabled: !mix.eq.enabled } })}
        />

        {/* Live response curve */}
        <EqCurve eq={mix.eq} />

        <div className="grid grid-cols-3 gap-3">
          <EqBandColumn
            label="Low"
            gain={mix.eq.low.gain}
            freq={mix.eq.low.freq}
            onGain={(g) => update({ eq: { ...mix.eq, low: { ...mix.eq.low, gain: g } } })}
            onFreq={(f) => update({ eq: { ...mix.eq, low: { ...mix.eq.low, freq: f } } })}
            minFreq={20} maxFreq={500} hue="hsl(20 90% 65%)"
          />
          <EqBandColumn
            label="Mid"
            gain={mix.eq.mid.gain}
            freq={mix.eq.mid.freq}
            extraQ={mix.eq.mid.q}
            onGain={(g) => update({ eq: { ...mix.eq, mid: { ...mix.eq.mid, gain: g } } })}
            onFreq={(f) => update({ eq: { ...mix.eq, mid: { ...mix.eq.mid, freq: f } } })}
            onQ={(q) => update({ eq: { ...mix.eq, mid: { ...mix.eq.mid, q } } })}
            minFreq={200} maxFreq={5000} hue="hsl(48 95% 65%)"
          />
          <EqBandColumn
            label="High"
            gain={mix.eq.high.gain}
            freq={mix.eq.high.freq}
            onGain={(g) => update({ eq: { ...mix.eq, high: { ...mix.eq.high, gain: g } } })}
            onFreq={(f) => update({ eq: { ...mix.eq, high: { ...mix.eq.high, freq: f } } })}
            minFreq={2000} maxFreq={20000} hue="hsl(200 80% 65%)"
          />
        </div>
      </div>

      {/* ── Compressor ─────────────────────────────────────────── */}
      <div className="rounded-xl ring-1 ring-inset ring-white/[0.06] bg-white/[0.015] backdrop-blur p-3 space-y-3">
        <ProcessorHeader
          icon={Activity}
          label="Compressor"
          enabled={mix.compressor.enabled}
          onToggle={() => update({ compressor: { ...mix.compressor, enabled: !mix.compressor.enabled } })}
        />

        {/* Static IO curve */}
        <CompressorCurve comp={mix.compressor} />

        {/* Presets */}
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(COMPRESSOR_PRESETS) as Array<keyof typeof COMPRESSOR_PRESETS>).map(k => (
            <button
              key={k}
              onClick={() => update({ compressor: COMPRESSOR_PRESETS[k] })}
              className="inline-flex items-center h-6 px-2 rounded-full ring-1 ring-inset ring-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] text-[9px] font-mono uppercase tracking-[0.18em] text-foreground/65 hover:text-foreground/95 transition-colors"
            >
              {k}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Slider
            label="Threshold"
            value={Math.round(mix.compressor.threshold)}
            min={-60} max={0} step={1}
            format={(v) => `${v} dB`}
            onChange={(v) => update({ compressor: { ...mix.compressor, threshold: v } })}
          />
          <Slider
            label="Ratio"
            value={Number(mix.compressor.ratio.toFixed(1))}
            min={1} max={20} step={0.1}
            format={(v) => `${v.toFixed(1)}:1`}
            onChange={(v) => update({ compressor: { ...mix.compressor, ratio: v } })}
          />
          <Slider
            label="Attack"
            value={Math.round(mix.compressor.attack)}
            min={0} max={200} step={1}
            format={(v) => `${v} ms`}
            onChange={(v) => update({ compressor: { ...mix.compressor, attack: v } })}
          />
          <Slider
            label="Release"
            value={Math.round(mix.compressor.release)}
            min={1} max={2000} step={1}
            format={(v) => `${v} ms`}
            onChange={(v) => update({ compressor: { ...mix.compressor, release: v } })}
          />
          <Slider
            label="Knee"
            value={Math.round(mix.compressor.knee)}
            min={0} max={40} step={1}
            format={(v) => `${v} dB`}
            onChange={(v) => update({ compressor: { ...mix.compressor, knee: v } })}
          />
          <Slider
            label="Makeup"
            value={Math.round(mix.compressor.makeupGain)}
            min={-12} max={24} step={1}
            format={(v) => `${v > 0 ? "+" : ""}${v} dB`}
            zeroCenter
            onChange={(v) => update({ compressor: { ...mix.compressor, makeupGain: v } })}
          />
        </div>
      </div>

      {/* ── Noise reduction ────────────────────────────────────────── */}
      <div className="rounded-xl ring-1 ring-inset ring-white/[0.06] bg-white/[0.015] backdrop-blur p-3 space-y-3">
        <ProcessorHeader
          icon={Wind}
          label="Noise reduction"
          enabled={(mix.noiseReduction ?? DEFAULT_NOISE_REDUCTION).enabled}
          onToggle={() => update({
            noiseReduction: {
              ...(mix.noiseReduction ?? DEFAULT_NOISE_REDUCTION),
              enabled: !(mix.noiseReduction ?? DEFAULT_NOISE_REDUCTION).enabled,
            },
          })}
        />
        <Slider
          label="Strength"
          value={Number(((mix.noiseReduction ?? DEFAULT_NOISE_REDUCTION).strength * 100).toFixed(0))}
          min={0} max={100} step={1}
          format={(v) => `${v}%`}
          onChange={(v) => update({
            noiseReduction: {
              ...(mix.noiseReduction ?? DEFAULT_NOISE_REDUCTION),
              strength: v / 100,
            },
          })}
        />
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-foreground/35">
          FFT denoiser · maps to afftdn nr 0–96 dB
        </p>
      </div>

      {/* ── Reverb ─────────────────────────────────────────────────── */}
      <div className="rounded-xl ring-1 ring-inset ring-white/[0.06] bg-white/[0.015] backdrop-blur p-3 space-y-3">
        <ProcessorHeader
          icon={Waves}
          label="Reverb"
          enabled={(mix.reverb ?? DEFAULT_REVERB).enabled}
          onToggle={() => update({
            reverb: {
              ...(mix.reverb ?? DEFAULT_REVERB),
              enabled: !(mix.reverb ?? DEFAULT_REVERB).enabled,
            },
          })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Slider
            label="Size"
            value={Number(((mix.reverb ?? DEFAULT_REVERB).size * 100).toFixed(0))}
            min={0} max={100} step={1}
            format={(v) => `${v}%`}
            onChange={(v) => update({
              reverb: {
                ...(mix.reverb ?? DEFAULT_REVERB),
                size: v / 100,
              },
            })}
          />
          <Slider
            label="Mix"
            value={Number(((mix.reverb ?? DEFAULT_REVERB).mix * 100).toFixed(0))}
            min={0} max={100} step={1}
            format={(v) => `${v}%`}
            onChange={(v) => update({
              reverb: {
                ...(mix.reverb ?? DEFAULT_REVERB),
                mix: v / 100,
              },
            })}
          />
        </div>
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-foreground/35">
          Echo · maps to aecho delay + decay
        </p>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function ProcessorHeader({
  icon: Icon, label, enabled, onToggle,
}: {
  icon: React.ElementType;
  label: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-foreground/45 inline-flex items-center gap-2">
        <Icon className="w-3 h-3" />
        {label}
      </span>
      <button
        onClick={onToggle}
        className={cn(
          "inline-flex items-center gap-1 h-6 px-2 rounded-full ring-1 ring-inset text-[9px] font-mono uppercase tracking-[0.18em] transition-all",
          enabled
            ? "ring-emerald-300/45 bg-emerald-500/15 text-emerald-100"
            : "ring-white/[0.06] bg-white/[0.02] text-foreground/55 hover:text-foreground/95 hover:ring-white/[0.12]",
        )}
      >
        <Power className="w-2.5 h-2.5" />
        {enabled ? "On" : "Off"}
      </button>
    </div>
  );
}

function EqCurve({ eq }: { eq: AudioMix["eq"] }) {
  const points = useMemo(() => sampleEqCurve(eq, 96), [eq]);
  // SVG viewport: 0..1 horizontal, -18..+18 dB vertical
  const w = 100;
  const h = 36;
  const path = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const dB = Math.max(-18, Math.min(18, p.dB));
    const y = h / 2 - (dB / 18) * (h / 2);
    return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");

  return (
    <div className="relative h-12 rounded-lg ring-1 ring-inset ring-white/[0.06] bg-[hsl(220_40%_3%)] overflow-hidden">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
        {/* Zero-dB reference */}
        <line x1="0" y1={h/2} x2={w} y2={h/2} stroke="hsla(0 0% 100% / 0.15)" strokeWidth="0.2" />
        {/* Tick marks at +6 / -6 dB */}
        <line x1="0" y1={h/2 - (6/18)*(h/2)} x2={w} y2={h/2 - (6/18)*(h/2)} stroke="hsla(0 0% 100% / 0.06)" strokeWidth="0.2" />
        <line x1="0" y1={h/2 + (6/18)*(h/2)} x2={w} y2={h/2 + (6/18)*(h/2)} stroke="hsla(0 0% 100% / 0.06)" strokeWidth="0.2" />

        {/* Filled response */}
        <path d={`${path} L ${w} ${h/2} L 0 ${h/2} Z`}
              fill="url(#eq-fill)" opacity={eq.enabled ? 0.65 : 0.15} />
        <path d={path}
              fill="none" stroke="hsl(48 95% 70%)" strokeWidth="0.6"
              opacity={eq.enabled ? 0.95 : 0.3} />
        <defs>
          <linearGradient id="eq-fill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"  stopColor="hsl(48 95% 70%)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="hsl(48 95% 70%)" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute top-0.5 left-1 font-mono text-[8px] uppercase tracking-[0.18em] text-foreground/35">EQ · ±18 dB</div>
    </div>
  );
}

function EqBandColumn({
  label, gain, freq, extraQ, minFreq, maxFreq, hue,
  onGain, onFreq, onQ,
}: {
  label: string;
  gain: number;
  freq: number;
  extraQ?: number;
  minFreq: number;
  maxFreq: number;
  hue: string;
  onGain: (g: number) => void;
  onFreq: (f: number) => void;
  onQ?: (q: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-center" style={{ color: hue }}>
        {label}
      </div>
      <Slider
        label="Gain"
        value={Number(gain.toFixed(1))}
        min={-18} max={18} step={0.5}
        format={(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)} dB`}
        zeroCenter
        onChange={onGain}
      />
      <Slider
        label="Freq"
        value={freq}
        min={minFreq} max={maxFreq} step={1}
        format={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)} k` : `${v} Hz`}
        onChange={onFreq}
        logarithmic
      />
      {onQ && typeof extraQ === "number" && (
        <Slider
          label="Q"
          value={Number(extraQ.toFixed(2))}
          min={0.1} max={10} step={0.05}
          format={(v) => v.toFixed(2)}
          onChange={onQ}
        />
      )}
    </div>
  );
}

function CompressorCurve({ comp }: { comp: AudioMix["compressor"] }) {
  const W = 100, H = 36;
  // Plot input dB -60..0 → x; output dB -60..0 → y (inverted)
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i <= 60; i++) {
    const inDb = -60 + i;
    const outDb = Math.max(-60, Math.min(0, compressorIo(comp, inDb)));
    points.push({
      x: ((inDb + 60) / 60) * W,
      y: H - ((outDb + 60) / 60) * H,
    });
  }
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");

  // Diagonal reference (unity)
  return (
    <div className="relative h-12 rounded-lg ring-1 ring-inset ring-white/[0.06] bg-[hsl(220_40%_3%)] overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
        <line x1="0" y1={H} x2={W} y2={0} stroke="hsla(0 0% 100% / 0.12)" strokeWidth="0.2" strokeDasharray="1 1" />
        <path d={path} fill="none" stroke="hsl(200 95% 70%)" strokeWidth="0.7"
              opacity={comp.enabled ? 0.95 : 0.3} />
      </svg>
      <div className="absolute top-0.5 left-1 font-mono text-[8px] uppercase tracking-[0.18em] text-foreground/35">I/O · dB</div>
    </div>
  );
}

function Slider({
  label, value, min, max, step, format, onChange, zeroCenter, logarithmic,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  zeroCenter?: boolean;
  logarithmic?: boolean;
}) {
  // For a log scale we expose the slider in log-space and convert to linear on emit.
  const t = logarithmic
    ? Math.log(value / min) / Math.log(max / min)
    : (value - min) / (max - min);

  const handle = (rawT: number) => {
    if (logarithmic) {
      onChange(min * Math.pow(max / min, rawT));
    } else {
      onChange(rawT);
    }
  };
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-foreground/40">{label}</span>
        <span className="font-mono text-[10px] tabular-nums text-foreground/75">{format(value)}</span>
      </div>
      <input
        type="range"
        min={logarithmic ? 0 : min}
        max={logarithmic ? 1 : max}
        step={logarithmic ? 0.001 : (step ?? 1)}
        value={logarithmic ? t : value}
        onChange={(e) => handle(parseFloat(e.target.value))}
        className="w-full h-1 mt-1 appearance-none rounded-full bg-white/[0.06] outline-none cursor-pointer
                   [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5
                   [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground
                   [&::-webkit-slider-thumb]:ring-2 [&::-webkit-slider-thumb]:ring-[hsl(220_30%_3%)]
                   [&::-webkit-slider-thumb]:shadow-[0_2px_5px_rgba(0,0,0,0.45)]"
      />
      {zeroCenter && (
        <div className="relative h-px">
          <span aria-hidden className="absolute left-1/2 -translate-x-1/2 -translate-y-2 w-px h-1 bg-white/20" />
        </div>
      )}
    </div>
  );
}
