/**
 * ColorGradePanel — the Inspector's color grading surface.
 *
 * Surfaces:
 *   - LUT browser (30 looks across Film stocks / Eras / Moods / Directors / Utility)
 *   - LUT mix slider
 *   - Live preview swatch driven by the current grade
 *   - Global modifiers (contrast, saturation, vibrance, temperature, tint)
 *   - Lift / Gamma / Gain wheels (compact 1D form for now — 3-channel)
 *
 * Visual language: same editorial glassmorphic shell as the rest of
 * the editor. Floating panel inside the Inspector.
 */
import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Palette,
  Sliders,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

import {
  type ColorGrade,
  IDENTITY_GRADE,
  LUT_CATEGORY_LABELS,
} from "@/lib/editor/color-grade";
import {
  type LutLook,
  LUT_LIBRARY,
  groupLutsByCategory,
  getLut,
} from "@/lib/editor/lut-library";
import { gradeToCss, normalizeGrade } from "@/lib/editor/color-grade-filters";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
export interface ColorGradePanelProps {
  grade: ColorGrade;
  onChange: (next: ColorGrade) => void;
  /** Preview image — typically a thumbnail of the current clip. */
  previewImage?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// LUT thumbnail — synthesizes a 4-block swatch (no image required)
// ─────────────────────────────────────────────────────────────────────────────
function LutThumbnail({ lut, active, onClick }: { lut: LutLook; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group/lut relative w-full text-left rounded-lg overflow-hidden ring-1 ring-inset transition-all",
        active
          ? "ring-amber-300/55 shadow-[0_10px_28px_-12px_hsla(45,95%,60%,0.45)]"
          : "ring-white/[0.06] hover:ring-white/[0.16] bg-white/[0.015]",
      )}
    >
      {/* Synthesized 4-block swatch */}
      <div className="aspect-[4/3] flex">
        <span className="flex-1" style={{ background: lut.swatch.primary }}   />
        <span className="flex-1" style={{ background: lut.swatch.secondary }} />
        <span className="flex-1" style={{ background: lut.swatch.accent }}    />
      </div>

      <div className="px-2 py-1.5">
        <div className="text-[10.5px] font-medium text-foreground/95 leading-tight truncate">
          {lut.name}
        </div>
        {lut.year && (
          <div className="font-mono text-[8.5px] uppercase tracking-[0.18em] text-foreground/35 tabular-nums">
            {lut.year}
          </div>
        )}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Slider — compact horizontal control with live value
// ─────────────────────────────────────────────────────────────────────────────
function GradeSlider({
  label,
  value,
  min = -100,
  max = 100,
  step = 1,
  onChange,
  hue,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (n: number) => void;
  hue?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/45">{label}</span>
        <span className="font-mono text-[10px] tabular-nums text-foreground/75">
          {value > 0 ? `+${value}` : value}
        </span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-1 appearance-none rounded-full bg-white/[0.06] outline-none cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                     [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground
                     [&::-webkit-slider-thumb]:ring-2 [&::-webkit-slider-thumb]:ring-[hsl(220_30%_3%)]
                     [&::-webkit-slider-thumb]:shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
        />
        {/* zero-center reference tick */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 -translate-y-1/2 w-px h-2"
          style={{
            left: `${(((0) - min) / (max - min)) * 100}%`,
            background: "rgba(255,255,255,0.18)",
          }}
        />
        {/* progress bar */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 -translate-y-1/2 h-1 rounded-full"
          style={{
            left:  pct >= 50 ? "50%" : `${pct}%`,
            right: pct >= 50 ? `${100 - pct}%` : "50%",
            background: hue ?? "hsl(48 95% 70%)",
            opacity: 0.85,
          }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Wheel row — three sliders (R, G, B) for lift / gamma / gain
// ─────────────────────────────────────────────────────────────────────────────
function WheelRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: { r: number; g: number; b: number };
  onChange: (next: { r: number; g: number; b: number }) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-foreground/45">{label}</div>
      <div className="grid grid-cols-3 gap-3">
        <GradeSlider label="R" value={Math.round(value.r * 100)} min={-50} max={50} hue="hsl(0 90% 65%)"  onChange={(n) => onChange({ ...value, r: n / 100 })} />
        <GradeSlider label="G" value={Math.round(value.g * 100)} min={-50} max={50} hue="hsl(120 70% 55%)" onChange={(n) => onChange({ ...value, g: n / 100 })} />
        <GradeSlider label="B" value={Math.round(value.b * 100)} min={-50} max={50} hue="hsl(220 90% 65%)" onChange={(n) => onChange({ ...value, b: n / 100 })} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Live preview — applies the CSS filter chain to a thumbnail
// ─────────────────────────────────────────────────────────────────────────────
function GradePreview({ grade, previewImage }: { grade: ColorGrade; previewImage?: string | null }) {
  const lut = grade.lutId ? getLut(grade.lutId) ?? null : null;
  const filter = gradeToCss(grade, lut);
  return (
    <div className="relative aspect-video w-full rounded-xl overflow-hidden ring-1 ring-inset ring-white/[0.08] bg-[hsl(220_30%_3%)]">
      {previewImage ? (
        <img
          src={previewImage}
          alt="Color grade preview"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter }}
        />
      ) : (
        // Synthesized gradient swatch if no preview image — still shows the look
        <div
          className="absolute inset-0"
          style={{
            background: lut
              ? `linear-gradient(135deg, ${lut.swatch.primary} 0%, ${lut.swatch.secondary} 55%, ${lut.swatch.accent} 100%)`
              : "linear-gradient(135deg, hsl(220 40% 15%), hsl(220 30% 5%))",
            filter,
          }}
        />
      )}
      {/* Compare-on-hover affordance: hold to see "before" */}
      <div className="absolute top-2 right-2 font-mono text-[9px] uppercase tracking-[0.22em] text-foreground/55 px-2 py-0.5 rounded-full bg-black/45 backdrop-blur ring-1 ring-inset ring-white/15">
        Preview
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PANEL
// ─────────────────────────────────────────────────────────────────────────────
export function ColorGradePanel({ grade: rawGrade, onChange, previewImage }: ColorGradePanelProps) {
  // Defensive normalize — a partial grade loaded from JSONB (older
  // editor versions or hand-seeded data) would crash the wheel reads
  // below with `undefined.r`. Normalize once at the boundary; downstream
  // code can trust every field exists.
  const grade = useMemo(() => normalizeGrade(rawGrade), [rawGrade]);
  const grouped = useMemo(() => groupLutsByCategory(), []);
  const activeLut = grade.lutId ? getLut(grade.lutId) ?? null : null;
  const isIdentity = JSON.stringify(grade) === JSON.stringify(IDENTITY_GRADE);

  const update = (next: Partial<ColorGrade>) => onChange({ ...grade, ...next });

  return (
    <section className="space-y-5">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="flex items-center justify-between">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/45 inline-flex items-center gap-2">
          <Palette className="w-3 h-3" />
          Color grade
        </h3>
        {!isIdentity && (
          <button
            onClick={() => onChange(IDENTITY_GRADE)}
            className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full ring-1 ring-inset ring-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] text-[9px] font-mono uppercase tracking-[0.18em] text-foreground/65 hover:text-foreground/95 transition-colors"
          >
            <RotateCcw className="w-2.5 h-2.5" />
            Reset
          </button>
        )}
      </header>

      {/* ── Preview ─────────────────────────────────────────────── */}
      <GradePreview grade={grade} previewImage={previewImage} />

      {/* ── Active LUT summary ──────────────────────────────────── */}
      {activeLut && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl ring-1 ring-inset ring-white/[0.06] bg-white/[0.02] backdrop-blur p-3"
        >
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-[13px] font-display italic font-medium text-foreground/95">
              {activeLut.name}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-foreground/40">
              {LUT_CATEGORY_LABELS[activeLut.category]}
            </span>
          </div>
          <p className="text-[11px] text-foreground/55 italic line-clamp-2">{activeLut.description}</p>
          {activeLut.notes && (
            <p className="mt-2 text-[10.5px] text-foreground/45 italic line-clamp-2">{activeLut.notes}</p>
          )}

          {/* LUT mix slider */}
          <div className="mt-3 pt-2 border-t border-white/[0.05]">
            <GradeSlider
              label="LUT mix"
              value={Math.round(grade.lutMix * 100)}
              min={0}
              max={100}
              hue="hsl(45 95% 70%)"
              onChange={(n) => update({ lutMix: n / 100 })}
            />
          </div>
        </motion.div>
      )}

      {/* ── LUT library ─────────────────────────────────────────── */}
      <div className="space-y-4">
        <h4 className="font-mono text-[10px] uppercase tracking-[0.22em] text-foreground/40 inline-flex items-center gap-2">
          <Sparkles className="w-3 h-3" />
          Looks · {LUT_LIBRARY.length}
        </h4>

        {(Object.keys(LUT_CATEGORY_LABELS) as Array<keyof typeof LUT_CATEGORY_LABELS>).map((cat) => {
          const luts = grouped[cat];
          if (!luts.length) return null;
          return (
            <div key={cat}>
              <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-foreground/40 mb-2">
                {LUT_CATEGORY_LABELS[cat]}
                <span className="ml-2 tabular-nums">{luts.length}</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {luts.map(lut => (
                  <LutThumbnail
                    key={lut.id}
                    lut={lut}
                    active={grade.lutId === lut.id}
                    onClick={() => update({
                      lutId: grade.lutId === lut.id ? null : lut.id,
                      lutMix: grade.lutId === lut.id ? 1 : 1,
                    })}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Global modifiers ────────────────────────────────────── */}
      <div className="rounded-xl ring-1 ring-inset ring-white/[0.06] bg-white/[0.015] backdrop-blur p-4 space-y-3">
        <h4 className="font-mono text-[10px] uppercase tracking-[0.22em] text-foreground/40 inline-flex items-center gap-2">
          <Sliders className="w-3 h-3" />
          Global modifiers
        </h4>
        {/* Exposure is ±3 stops at 0.1 step. The slider runs -30..+30
            in tenths so it shares the visual scale of the other
            modifiers while the underlying value stays in stop units. */}
        <GradeSlider
          label="Exposure"
          value={Math.round((grade.exposure ?? 0) * 10)}
          min={-30}
          max={30}
          onChange={(n) => update({ exposure: n / 10 })}
          hue="hsl(45 90% 65%)"
        />
        <GradeSlider label="Contrast"    value={Math.round(grade.contrast)}    onChange={(n) => update({ contrast: n })}    />
        <GradeSlider label="Saturation"  value={Math.round(grade.saturation)}  onChange={(n) => update({ saturation: n })}  />
        <GradeSlider label="Vibrance"    value={Math.round(grade.vibrance)}    onChange={(n) => update({ vibrance: n })}    />
        <GradeSlider label="Temperature" value={Math.round(grade.temperature)} onChange={(n) => update({ temperature: n })} hue="hsl(28 90% 65%)" />
        <GradeSlider label="Tint"        value={Math.round(grade.tint)}        onChange={(n) => update({ tint: n })}        hue="hsl(295 70% 65%)" />
        <GradeSlider label="Highlights"  value={Math.round(grade.highlights)}  onChange={(n) => update({ highlights: n })}  />
        <GradeSlider label="Shadows"     value={Math.round(grade.shadows)}     onChange={(n) => update({ shadows: n })}     />
        <GradeSlider label="Sharpness"   value={Math.round(grade.sharpness)}   onChange={(n) => update({ sharpness: n })}   />
      </div>

      {/* ── Wheels: Lift / Gamma / Gain ─────────────────────────── */}
      <div className="rounded-xl ring-1 ring-inset ring-white/[0.06] bg-white/[0.015] backdrop-blur p-4 space-y-4">
        <h4 className="font-mono text-[10px] uppercase tracking-[0.22em] text-foreground/40">
          Lift · Gamma · Gain
        </h4>
        <WheelRow label="Lift (shadows)"   value={grade.wheel.lift}   onChange={(v) => update({ wheel: { ...grade.wheel, lift: v }   })} />
        <WheelRow label="Gamma (midtones)" value={grade.wheel.gamma}  onChange={(v) => update({ wheel: { ...grade.wheel, gamma: v }  })} />
        <WheelRow label="Gain (highlights)"value={grade.wheel.gain}   onChange={(v) => update({ wheel: { ...grade.wheel, gain: v }   })} />
      </div>
    </section>
  );
}
