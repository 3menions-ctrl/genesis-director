/**
 * TextStudioPanel — authoring surface for project.textOverlays.
 *
 * Two modes:
 *   1. Picker mode (no overlay selected) — grid of 15 broadcast-grade
 *      presets grouped by category, plus the list of existing overlays.
 *      Click a preset → new overlay at the playhead.
 *
 *   2. Inspector mode (overlay selected) — full type system editor:
 *      text, position, alignment, font + weight + italic + size +
 *      tracking + line-height + uppercase, fill color/opacity, stroke,
 *      shadow, background, animation kind + in/out timing.
 *
 * Mounts inside EditorRightRail as a fourth tab. Selection state is
 * local to this panel so the user can keep their selection while the
 * timeline plays.
 */
import { useMemo, useState } from "react";
import {
  Type, Trash2, Pencil, X, ChevronLeft, Plus, Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";
import { toast } from "sonner";
import type { EditorProject } from "@/lib/editor/types";
import {
  TEXT_TEMPLATES, TEMPLATE_CATEGORY_LABELS, FONT_CSS,
  type TextOverlay, type FontFamily, type FontWeight, type Anchor,
  type TextAlign, type AnimationKind,
  type GradientFill, type GradientStop, type TextGlow, type TextShadow,
  type CounterSpec,
} from "@/lib/editor/text-overlays";
import { useEditor } from "@/hooks/editor/useEditor";

interface Props {
  project: EditorProject;
  /** Playhead position — passed in so new overlays land at the current
   *  time rather than 0:00. */
  playheadSec: number;
}

export function TextStudioPanel({ project, playheadSec }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { addTextOverlay, updateTextOverlay, removeTextOverlay } = useEditor();

  const overlays = project.textOverlays ?? [];
  const selected = overlays.find((o) => o.id === selectedId) ?? null;
  const byCategory = useMemo(() => {
    const m: Record<string, typeof TEXT_TEMPLATES> = {};
    for (const t of TEXT_TEMPLATES) (m[t.category] ??= []).push(t);
    return m as Record<keyof typeof TEMPLATE_CATEGORY_LABELS, typeof TEXT_TEMPLATES>;
  }, []);

  // ────── Inspector mode ──────────────────────────────────────────
  if (selected) {
    return (
      <OverlayInspector
        overlay={selected}
        onBack={() => setSelectedId(null)}
        onChange={(patch) => updateTextOverlay(selected.id, patch)}
        onDelete={() => {
          removeTextOverlay(selected.id);
          setSelectedId(null);
          toast.success("Overlay removed");
        }}
      />
    );
  }

  // ────── Picker mode ─────────────────────────────────────────────
  return (
    <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
      <div className="px-5 py-5 space-y-7">
        <div>
          <div className={cn(TYPE_META, "text-amber-300/85 tracking-[0.34em] inline-flex items-center gap-2")}>
            <Crown className="h-3 w-3" strokeWidth={1.8} />◆ Text studio
          </div>
          <p className={cn(TYPE_META, "mt-2 text-muted-foreground/55 leading-relaxed")}>
            Broadcast-grade titles, chyrons, captions, quotes, and stats. Each preset is editable.
          </p>
        </div>

        {/* Existing overlays */}
        {overlays.length > 0 && (
          <section>
            <h3 className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.30em] mb-3")}>
              ◆ Overlays · {overlays.length}
            </h3>
            <ul className="space-y-1.5">
              {overlays.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(o.id)}
                    className="w-full text-left rounded-lg ring-1 ring-inset ring-white/[0.06] hover:ring-white/[0.20] bg-white/[0.02] hover:bg-white/[0.05] px-3 py-2 transition-all flex items-center gap-3"
                  >
                    <Type className="h-3.5 w-3.5 text-accent/85 shrink-0" strokeWidth={1.5} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] text-foreground/95 truncate">
                        {o.text || "(empty)"}
                      </div>
                      <div className={cn(TYPE_META, "text-muted-foreground/55 mt-0.5 truncate")}>
                        {fmtTime(o.startSec)} → {fmtTime(o.startSec + o.durationSec)} · {o.font}
                      </div>
                    </div>
                    <Pencil className="h-3 w-3 text-muted-foreground/55 shrink-0" strokeWidth={1.5} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Templates grouped by category */}
        {Object.entries(byCategory).map(([cat, templates]) => (
          <section key={cat}>
            <h3 className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.30em] mb-3")}>
              ◆ {TEMPLATE_CATEGORY_LABELS[cat as keyof typeof TEMPLATE_CATEGORY_LABELS]}
            </h3>
            <div className="grid grid-cols-2 gap-1.5">
              {templates.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      // Custom MIME so only the V3 text-overlay track on
                      // the timeline accepts the drop — other surfaces
                      // (V1 video track, file dropzone) ignore it.
                      e.dataTransfer.setData("text/x-overlay-template", t.id);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={() => {
                      const o = t.build("Your text here", playheadSec);
                      addTextOverlay(o);
                      setSelectedId(o.id);
                      toast.success(`${t.name} added at ${fmtTime(playheadSec)}`);
                    }}
                    title="Click to add at playhead · drag onto the V3 timeline track to position"
                    className="text-left rounded-lg ring-1 ring-inset ring-white/[0.05] hover:ring-white/[0.18] bg-white/[0.02] hover:bg-white/[0.05] px-3 py-2 transition-all cursor-grab active:cursor-grabbing"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-accent/85 shrink-0" strokeWidth={1.5} />
                      <span className="text-[12.5px] text-foreground/95 truncate">{t.name}</span>
                    </div>
                    <p className={cn(TYPE_META, "text-muted-foreground/55 mt-1 leading-snug line-clamp-2")}>
                      {t.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OverlayInspector — full editor for a single overlay
// ─────────────────────────────────────────────────────────────────────────────
function OverlayInspector({
  overlay: o, onBack, onChange, onDelete,
}: {
  overlay: TextOverlay;
  onBack: () => void;
  onChange: (patch: Partial<TextOverlay>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
      <div className="px-5 py-5 space-y-6">
        {/* Header — back + delete */}
        <header className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.22em] text-muted-foreground/65 hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-3 w-3" /> All overlays
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.22em] text-rose-300/80 hover:text-rose-200 transition-colors"
          >
            <Trash2 className="h-3 w-3" /> Delete
          </button>
        </header>

        {/* Live preview swatch */}
        <div className="rounded-lg ring-1 ring-inset ring-white/[0.06] bg-[hsl(220_30%_4%/0.7)] p-3">
          <div className={cn(TYPE_META, "text-muted-foreground/55 mb-2")}>Preview</div>
          <div
            className="rounded bg-[hsl(220_30%_2%)] px-3 py-4 text-center min-h-[60px] flex items-center justify-center"
            style={{
              fontFamily: FONT_CSS[o.font],
              fontWeight: o.weight,
              fontStyle: o.italic ? "italic" : "normal",
              color: o.fill.color,
              opacity: o.fill.opacity,
              textTransform: o.uppercase ? "uppercase" : "none",
              letterSpacing: `${o.letterSpacingEm}em`,
              fontSize: 18,
              textShadow: o.shadow.opacity > 0
                ? `${o.shadow.offsetXPct * 0.2}px ${o.shadow.offsetYPct * 0.2}px ${o.shadow.blurPct * 0.2}px ${o.shadow.color}`
                : undefined,
            }}
          >
            {o.text || "Your text"}
          </div>
        </div>

        {/* Text + timing */}
        <Section label="Text">
          <Field label="Content" hint="Multi-line supported.">
            <textarea
              value={o.text}
              onChange={(e) => onChange({ text: e.target.value })}
              rows={3}
              className="w-full rounded-md bg-white/[0.03] ring-1 ring-inset ring-white/[0.06] focus:ring-white/[0.18] outline-none px-3 py-2 text-[13px] text-foreground resize-none"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start (s)">
              <NumberInput value={o.startSec} step={0.1} onChange={(v) => onChange({ startSec: Math.max(0, v) })} />
            </Field>
            <Field label="Duration (s)">
              <NumberInput value={o.durationSec} step={0.1} min={0.1} onChange={(v) => onChange({ durationSec: Math.max(0.1, v) })} />
            </Field>
          </div>
        </Section>

        {/* Typography */}
        <Section label="Type">
          <Field label="Font">
            <select
              value={o.font}
              onChange={(e) => onChange({ font: e.target.value as FontFamily })}
              className="w-full rounded-md bg-white/[0.03] ring-1 ring-inset ring-white/[0.06] focus:ring-white/[0.18] outline-none px-3 h-9 text-[13px] text-foreground"
            >
              <option value="fraunces">Fraunces · display serif</option>
              <option value="playfair">Playfair · editorial serif</option>
              <option value="dm-serif">DM Serif · heavy display</option>
              <option value="inter">Inter · modern sans</option>
              <option value="bebas-neue">Bebas Neue · condensed display</option>
              <option value="space-mono">Space Mono · technical</option>
              <option value="ibm-plex-mono">IBM Plex Mono · engineering</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Weight">
              <select
                value={o.weight}
                onChange={(e) => onChange({ weight: parseInt(e.target.value) as FontWeight })}
                className="w-full rounded-md bg-white/[0.03] ring-1 ring-inset ring-white/[0.06] focus:ring-white/[0.18] outline-none px-3 h-9 text-[13px] text-foreground"
              >
                {[200, 300, 400, 500, 600, 700, 800, 900].map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </Field>
            <Field label="Italic">
              <Toggle on={o.italic} onChange={(v) => onChange({ italic: v })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Size · ${o.sizePct.toFixed(1)}%`}>
              <SliderInput value={o.sizePct} min={1} max={28} step={0.1} onChange={(v) => onChange({ sizePct: v })} />
            </Field>
            <Field label={`Tracking · ${o.letterSpacingEm.toFixed(3)}em`}>
              <SliderInput value={o.letterSpacingEm} min={-0.05} max={0.5} step={0.005} onChange={(v) => onChange({ letterSpacingEm: v })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Line height · ${o.lineHeight.toFixed(2)}`}>
              <SliderInput value={o.lineHeight} min={0.8} max={2} step={0.02} onChange={(v) => onChange({ lineHeight: v })} />
            </Field>
            <Field label="ALL CAPS">
              <Toggle on={o.uppercase} onChange={(v) => onChange({ uppercase: v })} />
            </Field>
          </div>
        </Section>

        {/* Layout */}
        <Section label="Layout">
          <div className="grid grid-cols-2 gap-3">
            <Field label={`X · ${(o.x * 100).toFixed(0)}%`}>
              <SliderInput value={o.x} min={0} max={1} step={0.005} onChange={(v) => onChange({ x: v })} />
            </Field>
            <Field label={`Y · ${(o.y * 100).toFixed(0)}%`}>
              <SliderInput value={o.y} min={0} max={1} step={0.005} onChange={(v) => onChange({ y: v })} />
            </Field>
          </div>
          <Field label="Anchor">
            <AnchorGrid value={o.anchor} onChange={(a) => onChange({ anchor: a })} />
          </Field>
          <Field label="Align">
            <select
              value={o.align}
              onChange={(e) => onChange({ align: e.target.value as TextAlign })}
              className="w-full rounded-md bg-white/[0.03] ring-1 ring-inset ring-white/[0.06] focus:ring-white/[0.18] outline-none px-3 h-9 text-[13px] text-foreground"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </Field>
          <Field label={`Max width · ${o.maxWidthPct}%`}>
            <SliderInput value={o.maxWidthPct} min={20} max={100} step={1} onChange={(v) => onChange({ maxWidthPct: v })} />
          </Field>
          <Field label="Auto-fit text to box">
            <Toggle on={!!o.autoFit} onChange={(v) => onChange({ autoFit: v })} />
          </Field>
        </Section>

        {/* Fill / chrome */}
        <Section label="Color & chrome">
          <Field label="Fill color">
            <ColorInput value={o.fill.color} onChange={(c) => onChange({ fill: { ...o.fill, color: c } })} />
          </Field>
          <Field label={`Fill opacity · ${(o.fill.opacity * 100).toFixed(0)}%`}>
            <SliderInput value={o.fill.opacity} min={0} max={1} step={0.01}
              onChange={(v) => onChange({ fill: { ...o.fill, opacity: v } })} />
          </Field>

          {/* Gradient editor */}
          <GradientEditor
            value={o.gradientFill}
            onChange={(g) => onChange({ gradientFill: g })}
          />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Stroke">
              <ColorInput value={o.stroke.color} onChange={(c) => onChange({ stroke: { ...o.stroke, color: c } })} />
            </Field>
            <Field label={`Stroke width · ${o.stroke.widthPct.toFixed(0)}%`}>
              <SliderInput value={o.stroke.widthPct} min={0} max={20} step={0.5}
                onChange={(v) => onChange({ stroke: { ...o.stroke, widthPct: v } })} />
            </Field>
          </div>
          <Field label="Shadow color">
            <ColorInput value={o.shadow.color} onChange={(c) => onChange({ shadow: { ...o.shadow, color: c } })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Shadow blur · ${o.shadow.blurPct.toFixed(0)}%`}>
              <SliderInput value={o.shadow.blurPct} min={0} max={40} step={1}
                onChange={(v) => onChange({ shadow: { ...o.shadow, blurPct: v } })} />
            </Field>
            <Field label={`Shadow opacity · ${(o.shadow.opacity * 100).toFixed(0)}%`}>
              <SliderInput value={o.shadow.opacity} min={0} max={1} step={0.02}
                onChange={(v) => onChange({ shadow: { ...o.shadow, opacity: v } })} />
            </Field>
          </div>

          {/* Glow editor */}
          <GlowEditor
            value={o.glow ?? null}
            sizePct={o.sizePct}
            onChange={(g) => onChange({ glow: g })}
          />

          {/* Inner shadow editor */}
          <InnerShadowEditor
            value={o.innerShadow ?? null}
            onChange={(s) => onChange({ innerShadow: s })}
          />
        </Section>

        {/* Counter — number animation */}
        <Section label="Counter (number animation)">
          <CounterEditor
            value={o.counter ?? null}
            onChange={(c) => onChange({ counter: c })}
          />
        </Section>

        {/* Animation */}
        <Section label="Animation">
          <Field label="Style">
            <select
              value={o.animation.kind}
              onChange={(e) => onChange({ animation: { ...o.animation, kind: e.target.value as AnimationKind } })}
              className="w-full rounded-md bg-white/[0.03] ring-1 ring-inset ring-white/[0.06] focus:ring-white/[0.18] outline-none px-3 h-9 text-[13px] text-foreground"
            >
              <option value="none">None</option>
              <optgroup label="Basic">
                <option value="fade">Fade</option>
                <option value="slide-up">Slide up</option>
                <option value="slide-down">Slide down</option>
                <option value="slide-left">Slide left</option>
                <option value="slide-right">Slide right</option>
                <option value="scale">Scale (zoom)</option>
              </optgroup>
              <optgroup label="Pro kinetic">
                <option value="typewriter">Typewriter</option>
                <option value="letter-drop">Letter drop</option>
                <option value="blur-in">Blur in</option>
                <option value="elastic-pop">Elastic pop</option>
                <option value="tracking-tighten">Tracking tighten</option>
                <option value="shimmer">Shimmer sweep</option>
                <option value="wave">Wave</option>
                <option value="glitch-in">Glitch in</option>
                <option value="split-flap">Split-flap board</option>
                <option value="uppercase-cycle">Uppercase cycle</option>
                <option value="stencil-cut">Stencil cut</option>
                <option value="wipe-reveal">Wipe reveal</option>
                <option value="letterbox-iris">Letterbox iris</option>
                <option value="underline-draw">Underline draw</option>
              </optgroup>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`In · ${o.animation.inSec.toFixed(2)}s`}>
              <SliderInput value={o.animation.inSec} min={0} max={3} step={0.05}
                onChange={(v) => onChange({ animation: { ...o.animation, inSec: v } })} />
            </Field>
            <Field label={`Out · ${o.animation.outSec.toFixed(2)}s`}>
              <SliderInput value={o.animation.outSec} min={0} max={3} step={0.05}
                onChange={(v) => onChange({ animation: { ...o.animation, outSec: v } })} />
            </Field>
          </div>
        </Section>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Small UI primitives
// ─────────────────────────────────────────────────────────────────────────────
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.30em] mb-3")}>◆ {label}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.22em] mb-1.5")}>{label}</div>
      {children}
      {hint && <p className={cn(TYPE_META, "text-muted-foreground/45 mt-1")}>{hint}</p>}
    </div>
  );
}

function NumberInput({ value, onChange, step = 1, min, max }: {
  value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number;
}) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : 0}
      step={step}
      min={min}
      max={max}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full rounded-md bg-white/[0.03] ring-1 ring-inset ring-white/[0.06] focus:ring-white/[0.18] outline-none px-3 h-9 text-[13px] text-foreground tabular-nums"
    />
  );
}

function SliderInput({ value, onChange, min, max, step }: {
  value: number; onChange: (v: number) => void; min: number; max: number; step: number;
}) {
  return (
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full accent-accent"
    />
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // Strip leading hsl(...) etc and let users use color picker for hex.
  // Falls back to plain text input when value isn't a simple hex so we
  // never overwrite an authored "hsl(45 95% 60%)" string.
  const isSimpleHex = /^#[0-9a-fA-F]{6}$/.test(value);
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={isSimpleHex ? value : "#ffffff"}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-9 rounded-md bg-white/[0.03] ring-1 ring-inset ring-white/[0.06] cursor-pointer"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded-md bg-white/[0.03] ring-1 ring-inset ring-white/[0.06] focus:ring-white/[0.18] outline-none px-3 h-9 text-[12px] font-mono text-foreground"
      />
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={cn(
        "h-9 w-full rounded-md ring-1 ring-inset transition-colors text-[12px] font-mono uppercase tracking-[0.22em]",
        on ? "bg-[hsl(var(--accent)/0.10)] ring-accent/40 text-accent" : "bg-white/[0.03] ring-white/[0.06] text-muted-foreground/65 hover:text-foreground",
      )}
    >
      {on ? "On" : "Off"}
    </button>
  );
}

function AnchorGrid({ value, onChange }: { value: Anchor; onChange: (a: Anchor) => void }) {
  const anchors: Anchor[] = [
    "top-left", "top-center", "top-right",
    "middle-left", "middle-center", "middle-right",
    "bottom-left", "bottom-center", "bottom-right",
  ];
  return (
    <div className="grid grid-cols-3 gap-1 p-2 rounded-md bg-white/[0.02] ring-1 ring-inset ring-white/[0.05]">
      {anchors.map((a) => {
        const active = value === a;
        return (
          <button
            key={a}
            type="button"
            onClick={() => onChange(a)}
            className={cn(
              "h-8 rounded-sm transition-all",
              active ? "bg-[hsl(var(--accent)/0.18)] ring-1 ring-inset ring-accent/55" : "hover:bg-white/[0.05]",
            )}
            title={a}
          >
            <span className={cn("inline-block h-1.5 w-1.5 rounded-full", active ? "bg-accent" : "bg-muted-foreground/45")} />
          </button>
        );
      })}
    </div>
  );
}

function fmtTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// GradientEditor — multi-stop linear / radial / conic with live swatch
// ─────────────────────────────────────────────────────────────────────────────
function GradientEditor({
  value, onChange,
}: { value: GradientFill | null | undefined; onChange: (g: GradientFill | null) => void }) {
  const on = !!value;
  const g: GradientFill = value ?? {
    kind: "linear", angle: 90,
    stops: [{ at: 0, color: "#FFFFFF" }, { at: 1, color: "#000000" }],
  };
  const setStop = (i: number, patch: Partial<GradientStop>) => {
    const stops = g.stops.map((s, idx) => idx === i ? { ...s, ...patch } : s);
    onChange({ ...g, stops });
  };
  const addStop = () => {
    const stops = [...g.stops, { at: 1, color: g.stops[g.stops.length - 1]?.color ?? "#FFFFFF" }];
    onChange({ ...g, stops });
  };
  const removeStop = (i: number) => {
    if (g.stops.length <= 2) return;
    onChange({ ...g, stops: g.stops.filter((_, idx) => idx !== i) });
  };

  const swatch = `linear-gradient(${g.kind === "linear" ? `${g.angle}deg` : "to right"}, ${g.stops.map((s) => `${s.color} ${(s.at * 100).toFixed(0)}%`).join(", ")})`;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.22em]")}>Gradient fill</div>
        <Toggle on={on} onChange={(v) => onChange(v ? g : null)} />
      </div>
      {on && (
        <div className="space-y-3 rounded-lg ring-1 ring-inset ring-white/[0.05] bg-white/[0.02] p-3">
          {/* Swatch */}
          <div
            className="h-7 w-full rounded-md ring-1 ring-inset ring-white/[0.06]"
            style={{ background: swatch }}
          />
          <Field label="Type">
            <select
              value={g.kind}
              onChange={(e) => onChange({ ...g, kind: e.target.value as GradientFill["kind"] })}
              className="w-full rounded-md bg-white/[0.03] ring-1 ring-inset ring-white/[0.06] focus:ring-white/[0.18] outline-none px-3 h-9 text-[13px] text-foreground"
            >
              <option value="linear">Linear</option>
              <option value="radial">Radial</option>
              <option value="conic">Conic</option>
            </select>
          </Field>
          {g.kind !== "radial" && (
            <Field label={`Angle · ${g.angle.toFixed(0)}°`}>
              <SliderInput value={g.angle} min={0} max={360} step={1} onChange={(v) => onChange({ ...g, angle: v })} />
            </Field>
          )}
          <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.22em]")}>Stops</div>
          <ul className="space-y-2">
            {g.stops.map((s, i) => (
              <li key={i} className="flex items-center gap-2">
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(s.color) ? s.color : "#ffffff"}
                  onChange={(e) => setStop(i, { color: e.target.value })}
                  className="h-7 w-7 rounded-md bg-white/[0.03] ring-1 ring-inset ring-white/[0.06] cursor-pointer shrink-0"
                />
                <input
                  type="text"
                  value={s.color}
                  onChange={(e) => setStop(i, { color: e.target.value })}
                  className="flex-1 min-w-0 rounded-md bg-white/[0.03] ring-1 ring-inset ring-white/[0.06] focus:ring-white/[0.18] outline-none px-2 h-7 text-[11.5px] font-mono text-foreground"
                />
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={s.at}
                  onChange={(e) => setStop(i, { at: parseFloat(e.target.value) })}
                  className="w-14 rounded-md bg-white/[0.03] ring-1 ring-inset ring-white/[0.06] focus:ring-white/[0.18] outline-none px-2 h-7 text-[11.5px] tabular-nums text-foreground"
                />
                <button
                  type="button"
                  onClick={() => removeStop(i)}
                  disabled={g.stops.length <= 2}
                  className="h-7 w-7 rounded-md text-rose-300/80 hover:text-rose-200 disabled:opacity-30 inline-flex items-center justify-center"
                  title="Remove stop"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={addStop}
            className={cn(TYPE_META, "inline-flex items-center gap-1.5 text-accent/85 hover:text-accent transition-colors")}
          >
            <Plus className="h-3 w-3" /> Add stop
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GlowEditor — color + blur + intensity
// ─────────────────────────────────────────────────────────────────────────────
function GlowEditor({
  value, sizePct, onChange,
}: {
  value: TextGlow | null;
  sizePct: number;
  onChange: (g: TextGlow | null) => void;
}) {
  void sizePct;
  const on = !!value;
  const g: TextGlow = value ?? { color: "hsl(45 95% 60%)", blurPct: 18, intensity: 0.65 };
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.22em]")}>Glow</div>
        <Toggle on={on} onChange={(v) => onChange(v ? g : null)} />
      </div>
      {on && (
        <div className="space-y-2 rounded-lg ring-1 ring-inset ring-white/[0.05] bg-white/[0.02] p-3">
          <Field label="Color">
            <ColorInput value={g.color} onChange={(c) => onChange({ ...g, color: c })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Blur · ${g.blurPct.toFixed(0)}%`}>
              <SliderInput value={g.blurPct} min={0} max={60} step={1}
                onChange={(v) => onChange({ ...g, blurPct: v })} />
            </Field>
            <Field label={`Intensity · ${(g.intensity * 100).toFixed(0)}%`}>
              <SliderInput value={g.intensity} min={0} max={1.5} step={0.05}
                onChange={(v) => onChange({ ...g, intensity: v })} />
            </Field>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// InnerShadowEditor — inset effect
// ─────────────────────────────────────────────────────────────────────────────
function InnerShadowEditor({
  value, onChange,
}: { value: TextShadow | null; onChange: (s: TextShadow | null) => void }) {
  const on = !!value;
  const s: TextShadow = value ?? { color: "#000000", offsetXPct: 0, offsetYPct: -2, blurPct: 4, opacity: 0.6 };
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.22em]")}>Inner shadow</div>
        <Toggle on={on} onChange={(v) => onChange(v ? s : null)} />
      </div>
      {on && (
        <div className="space-y-2 rounded-lg ring-1 ring-inset ring-white/[0.05] bg-white/[0.02] p-3">
          <Field label="Color">
            <ColorInput value={s.color} onChange={(c) => onChange({ ...s, color: c })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Offset Y · ${s.offsetYPct.toFixed(0)}%`}>
              <SliderInput value={s.offsetYPct} min={-20} max={20} step={0.5}
                onChange={(v) => onChange({ ...s, offsetYPct: v })} />
            </Field>
            <Field label={`Blur · ${s.blurPct.toFixed(0)}%`}>
              <SliderInput value={s.blurPct} min={0} max={20} step={0.5}
                onChange={(v) => onChange({ ...s, blurPct: v })} />
            </Field>
          </div>
          <Field label={`Opacity · ${(s.opacity * 100).toFixed(0)}%`}>
            <SliderInput value={s.opacity} min={0} max={1} step={0.02}
              onChange={(v) => onChange({ ...s, opacity: v })} />
          </Field>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CounterEditor — number animation with format string
// ─────────────────────────────────────────────────────────────────────────────
function CounterEditor({
  value, onChange,
}: { value: CounterSpec | null; onChange: (c: CounterSpec | null) => void }) {
  const on = !!value;
  const c: CounterSpec = value ?? { from: 0, to: 100, format: "{n}", decimals: 0, thousands: true };
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.22em]")}>Counter</div>
        <Toggle on={on} onChange={(v) => onChange(v ? c : null)} />
      </div>
      {on && (
        <div className="space-y-2 rounded-lg ring-1 ring-inset ring-white/[0.05] bg-white/[0.02] p-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="From">
              <NumberInput value={c.from} step={1} onChange={(v) => onChange({ ...c, from: v })} />
            </Field>
            <Field label="To">
              <NumberInput value={c.to} step={1} onChange={(v) => onChange({ ...c, to: v })} />
            </Field>
          </div>
          <Field label="Format" hint='Use {n} as the number placeholder · e.g. "${n}" or "{n}%"'>
            <input
              type="text"
              value={c.format}
              onChange={(e) => onChange({ ...c, format: e.target.value })}
              className="w-full rounded-md bg-white/[0.03] ring-1 ring-inset ring-white/[0.06] focus:ring-white/[0.18] outline-none px-3 h-9 text-[13px] font-mono text-foreground"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Decimals · ${c.decimals}`}>
              <SliderInput value={c.decimals} min={0} max={4} step={1}
                onChange={(v) => onChange({ ...c, decimals: Math.round(v) })} />
            </Field>
            <Field label="Thousands sep">
              <Toggle on={c.thousands} onChange={(v) => onChange({ ...c, thousands: v })} />
            </Field>
          </div>
        </div>
      )}
    </div>
  );
}
