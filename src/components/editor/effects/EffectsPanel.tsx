/**
 * EffectsPanel — Inspector surface for the in-editor Crossover-recipe
 * effects system.
 *
 * Layout:
 *   • Active effects list — every effect already placed on the clip,
 *     with quick controls (timing, intensity, opacity, remove).
 *   • Recipe browser — 20 recipes grouped by category, with hero
 *     recipes flagged "Live preview"; the rest fall back to the
 *     generic renderer until each gets its bespoke build.
 *
 * Add-flow: tap a recipe → pick a mode the recipe supports → an
 * EffectInstance with sensible defaults is appended to the clip and
 * appears immediately in the active list (and the player overlay).
 */
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Plus,
  Trash2,
  Clock,
  Wand2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

import type { EditorClip } from "@/lib/editor/types";
import {
  type EffectInstance,
  type EffectMode,
  EFFECT_MODE_LABELS,
  newEffectInstance,
} from "@/lib/editor/effects";
import {
  EFFECT_REGISTRY,
  EFFECT_CATEGORY_LABELS,
  type EffectRecipeMeta,
  getRecipeMeta,
} from "@/lib/editor/effects-registry";
import {
  addClipEffect,
  updateClipEffect,
  removeClipEffect,
  clearClipEffects,
} from "@/lib/editor/store";

interface Props {
  clip: EditorClip;
}

export function EffectsPanel({ clip }: Props) {
  const effects = clip.effects ?? [];
  const [browserOpen, setBrowserOpen] = useState(effects.length === 0);

  return (
    <section className="space-y-4">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="flex items-center justify-between">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/45 inline-flex items-center gap-2">
          <Sparkles className="w-3 h-3" />
          Effects · {effects.length}
        </h3>
        <div className="flex items-center gap-2">
          {effects.length > 0 && (
            <button
              onClick={() => clearClipEffects(clip.id)}
              className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full ring-1 ring-inset ring-white/[0.06] bg-white/[0.02] hover:bg-rose-500/15 hover:ring-rose-300/30 text-[9px] font-mono uppercase tracking-[0.18em] text-foreground/55 hover:text-rose-100 transition-all"
            >
              <Trash2 className="w-2.5 h-2.5" />
              Clear
            </button>
          )}
          <button
            onClick={() => setBrowserOpen(o => !o)}
            className={cn(
              "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[9px] font-mono uppercase tracking-[0.18em] transition-colors ring-1 ring-inset",
              browserOpen
                ? "ring-white/[0.16] bg-foreground/[0.08] text-foreground"
                : "ring-white/[0.06] bg-white/[0.02] text-foreground/65 hover:text-foreground/95 hover:ring-white/[0.12]",
            )}
          >
            <Plus className="w-2.5 h-2.5" />
            {browserOpen ? "Hide library" : "Add effect"}
          </button>
        </div>
      </header>

      {/* ── Active effects ─────────────────────────────────────── */}
      {effects.length > 0 && (
        <div className="space-y-2">
          {effects.map(fx => (
            <ActiveEffectRow
              key={fx.id}
              fx={fx}
              clip={clip}
            />
          ))}
        </div>
      )}

      {/* ── Browser ────────────────────────────────────────────── */}
      {browserOpen && (
        <RecipeBrowser
          onPick={(meta, mode) => {
            const fx = newEffectInstance(meta.slug, mode, {
              primaryColor: meta.swatch.primary,
              accentColor: meta.swatch.accent,
              durationSec: mode === "sustained"
                ? Math.min(clip.durationSec, 6)
                : undefined,
            });
            addClipEffect(clip.id, fx);
            // Auto-collapse after first add so the user sees the active list grow
            if (effects.length === 0) setBrowserOpen(false);
          }}
        />
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Active effect row — compact inline controls
// ─────────────────────────────────────────────────────────────────────────────
function ActiveEffectRow({ fx, clip }: { fx: EffectInstance; clip: EditorClip }) {
  const meta = getRecipeMeta(fx.recipe);
  if (!meta) return null;
  const Icon = meta.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl ring-1 ring-inset ring-white/[0.06] bg-white/[0.02] backdrop-blur p-3"
    >
      <div className="flex items-center gap-3 mb-2">
        {/* Swatch + icon */}
        <span
          className="h-7 w-7 rounded-md ring-1 ring-inset ring-white/[0.10] flex items-center justify-center flex-shrink-0"
          style={{
            background: `linear-gradient(135deg, ${fx.primaryColor}, ${fx.accentColor})`,
          }}
        >
          <Icon className="w-3.5 h-3.5 text-foreground/95" strokeWidth={1.6} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-medium text-foreground/95 leading-tight truncate">
            {meta.name}
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-foreground/45">
            {EFFECT_MODE_LABELS[fx.mode]}
          </div>
        </div>
        <button
          onClick={() => removeClipEffect(clip.id, fx.id)}
          className="text-foreground/55 hover:text-rose-200 transition-colors"
          aria-label="Remove effect"
        >
          <X className="w-3.5 h-3.5" strokeWidth={1.8} />
        </button>
      </div>

      {/* Inline sliders */}
      <div className="grid grid-cols-3 gap-3">
        <MiniSlider
          label="At"
          value={Number(fx.startSec.toFixed(2))}
          min={0}
          max={Math.max(0, clip.durationSec)}
          step={0.05}
          format={(v) => `${v.toFixed(2)}s`}
          onChange={(v) => updateClipEffect(clip.id, fx.id, { startSec: v })}
        />
        <MiniSlider
          label="For"
          value={Number(fx.durationSec.toFixed(2))}
          min={0.2}
          max={Math.max(0.3, clip.durationSec)}
          step={0.05}
          format={(v) => `${v.toFixed(2)}s`}
          onChange={(v) => updateClipEffect(clip.id, fx.id, { durationSec: v })}
        />
        <MiniSlider
          label="Strength"
          value={Math.round(fx.intensity)}
          min={0}
          max={100}
          step={1}
          format={(v) => `${v}%`}
          onChange={(v) => updateClipEffect(clip.id, fx.id, { intensity: v })}
        />
      </div>

      {/* Color row */}
      <div className="mt-3 pt-2 border-t border-white/[0.04] flex items-center gap-2">
        <ColorSwatch
          color={fx.primaryColor}
          label="Primary"
          onChange={(c) => updateClipEffect(clip.id, fx.id, { primaryColor: c })}
        />
        <ColorSwatch
          color={fx.accentColor}
          label="Accent"
          onChange={(c) => updateClipEffect(clip.id, fx.id, { accentColor: c })}
        />
        <div className="flex-1" />
        <MiniSlider
          label="Opacity"
          value={Math.round(fx.opacity * 100)}
          min={0}
          max={100}
          step={1}
          format={(v) => `${v}%`}
          onChange={(v) => updateClipEffect(clip.id, fx.id, { opacity: v / 100 })}
        />
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Recipe browser
// ─────────────────────────────────────────────────────────────────────────────
function RecipeBrowser({
  onPick,
}: {
  onPick: (meta: EffectRecipeMeta, mode: EffectMode) => void;
}) {
  const grouped = useMemo(() => {
    const g: Record<EffectRecipeMeta["category"], EffectRecipeMeta[]> = {
      light: [], particle: [], optical: [], pigment: [], geometric: [], atmospheric: [],
    };
    for (const r of EFFECT_REGISTRY) g[r.category].push(r);
    return g;
  }, []);

  return (
    <div className="rounded-xl ring-1 ring-inset ring-white/[0.06] bg-white/[0.015] backdrop-blur p-3 space-y-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-foreground/45 inline-flex items-center gap-2">
        <Wand2 className="w-3 h-3" />
        20 recipes · live preview on the 6 marked ◆
      </div>
      {(Object.keys(EFFECT_CATEGORY_LABELS) as Array<EffectRecipeMeta["category"]>).map((cat) => {
        const items = grouped[cat];
        if (!items.length) return null;
        return (
          <div key={cat}>
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-foreground/40 mb-2">
              {EFFECT_CATEGORY_LABELS[cat]} · {items.length}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {items.map(r => (
                <RecipeTile key={r.slug} meta={r} onPick={onPick} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RecipeTile({
  meta, onPick,
}: {
  meta: EffectRecipeMeta;
  onPick: (meta: EffectRecipeMeta, mode: EffectMode) => void;
}) {
  const [picking, setPicking] = useState(false);
  const Icon = meta.icon;
  return (
    <div className="relative">
      <button
        onClick={() => meta.modes.length === 1
          ? onPick(meta, meta.modes[0])
          : setPicking(true)
        }
        className="w-full text-left rounded-lg ring-1 ring-inset ring-white/[0.06] hover:ring-white/[0.16] bg-white/[0.015] hover:bg-white/[0.03] backdrop-blur p-2.5 transition-all"
      >
        <div className="flex items-center gap-2 mb-1.5">
          <span
            className="h-6 w-6 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${meta.swatch.primary}, ${meta.swatch.accent})` }}
          >
            <Icon className="w-3 h-3 text-foreground/95" strokeWidth={1.7} />
          </span>
          <div className="text-[11.5px] font-medium text-foreground/95 leading-tight truncate flex-1">
            {meta.name}
          </div>
          {meta.hasCustomRenderer && (
            <span className="font-mono text-[8.5px] text-amber-200" title="Live preview">◆</span>
          )}
        </div>
        <p className="text-[10.5px] text-foreground/55 italic line-clamp-2">{meta.description}</p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {meta.modes.map(m => (
            <span
              key={m}
              className="inline-flex items-center h-4 px-1 rounded text-[8.5px] font-mono uppercase tracking-[0.16em] text-foreground/55 bg-white/[0.03] ring-1 ring-inset ring-white/[0.06]"
            >
              {m}
            </span>
          ))}
        </div>
      </button>

      {/* Mode picker pop-up */}
      {picking && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute z-20 top-full left-0 right-0 mt-1 rounded-lg ring-1 ring-white/[0.16] bg-[hsl(220_30%_5%)] backdrop-blur shadow-[0_15px_45px_-12px_hsla(0,0%,0%,0.65)] p-1"
        >
          {meta.modes.map(m => (
            <button
              key={m}
              onClick={() => { onPick(meta, m); setPicking(false); }}
              className="w-full text-left px-2 py-1.5 rounded text-[11px] font-mono uppercase tracking-[0.18em] text-foreground/75 hover:text-foreground/95 hover:bg-white/[0.05] transition-colors"
            >
              {EFFECT_MODE_LABELS[m]}
            </button>
          ))}
          <button
            onClick={() => setPicking(false)}
            className="w-full text-left px-2 py-1 rounded text-[9.5px] font-mono uppercase tracking-[0.18em] text-foreground/40 hover:text-foreground/65 transition-colors"
          >
            Cancel
          </button>
        </motion.div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MiniSlider — compact slider with inline label
// ─────────────────────────────────────────────────────────────────────────────
function MiniSlider({
  label, value, min, max, step, format, onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-foreground/40 inline-flex items-center gap-1">
          {label === "At" || label === "For" ? <Clock className="w-2.5 h-2.5" /> : null}
          {label}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-foreground/75">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step ?? 1}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 mt-1 appearance-none rounded-full bg-white/[0.06] outline-none cursor-pointer
                   [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5
                   [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground
                   [&::-webkit-slider-thumb]:ring-2 [&::-webkit-slider-thumb]:ring-[hsl(220_30%_3%)]
                   [&::-webkit-slider-thumb]:shadow-[0_2px_5px_rgba(0,0,0,0.45)]"
      />
    </div>
  );
}

function ColorSwatch({
  color, label, onChange,
}: {
  color: string;
  label: string;
  onChange: (c: string) => void;
}) {
  return (
    <label
      className="relative inline-flex items-center justify-center h-6 w-6 rounded-md ring-1 ring-inset ring-white/[0.10] cursor-pointer"
      style={{ background: color }}
      title={label}
    >
      <input
        type="color"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </label>
  );
}
