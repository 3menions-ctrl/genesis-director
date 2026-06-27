// ─────────────────────────────────────────────────────────────────────────
// AdminPricingPage — /admin/pricing (Money hub · "Pricing")
// Senior-analyst unit-economics console. Borderless / floating / Aurora.
// Every API + DB/infra cost is an editable input; credit prices + gross/net
// margins DERIVE live (auto-update on edit). Persisted to pricing_cost_model.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Save, RotateCcw, AlertTriangle, RefreshCw, DollarSign, Layers, Database, Percent } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { AdminPageShell } from "../../components/AdminPageShell";
import { FloatSection, StatOrb, DeckButton, accent, ORB_AURAS } from "@/admin/ui/primitives";
import {
  DEFAULT_COST_LINES, ENGINE_LABEL, ENGINE_PROVIDER_NOTE,
  defaultCostModel, clipEconomics, bundledAddonPerClip, infraPerClip,
  type CostModel, type CostGroup,
} from "@/lib/payments/costModel";

const EMERALD = "hsl(158 86% 52%)";
const ROSE = "hsl(350 90% 70%)";
const EASE = [0.16, 1, 0.3, 1] as const;
const usd = (n: number, dp = 2) => `$${n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const GROUPS: { g: CostGroup; meta: string }[] = [
  { g: "Add-ons", meta: "folded into the clip price" },
  { g: "Infra / Database", meta: "amortized into net margin" },
  { g: "Fees & policy", meta: "fees + pricing policy" },
];

// Borderless premium number input — tinted surface, glow on focus, no ring.
function NumInput({ value, onChange, step = 0.001, w = "w-full" }: { value: number; onChange: (n: number) => void; step?: number; w?: string }) {
  const [focus, setFocus] = useState(false);
  return (
    <input
      type="number" step={step} value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
      className={cn(w, "rounded-xl bg-white/[0.04] px-3 py-2 font-mono text-[13px] tabular-nums text-white outline-none transition-all placeholder:text-white/30")}
      style={focus ? { background: accent(0.12), boxShadow: `0 0 0 1px ${accent(0.5)}, 0 8px 28px -10px ${accent(0.6)}` } : undefined}
    />
  );
}

export default function AdminPricingPage() {
  const [model, setModel] = useState<CostModel>(() => defaultCostModel());
  const [clipsPerFilm, setClipsPerFilm] = useState(5);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from("pricing_cost_model" as never).select("model").eq("id", true).maybeSingle();
      const stored = (data as { model?: CostModel } | null)?.model;
      if (stored?.lines && stored?.clipCost) setModel(stored);
    } catch { /* defaults */ } finally { setLoading(false); setDirty(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const setLine = (k: string, val: number) => { setModel((m) => ({ ...m, lines: { ...m.lines, [k]: val } })); setDirty(true); };
  const setClip = (eng: string, d: number, val: number) =>
    { setModel((m) => ({ ...m, clipCost: { ...m.clipCost, [eng]: { ...m.clipCost[eng], [d]: val } } })); setDirty(true); };

  const save = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("set_pricing_cost_model" as never, { p_model: model } as never);
      if (error || !(data as { success?: boolean })?.success) throw error || new Error("save failed");
      toast.success("Cost model saved"); setDirty(false);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  };

  const rows = useMemo(() => {
    const out: ReturnType<typeof clipEconomics>[] = [];
    for (const eng of Object.keys(model.clipCost)) {
      for (const d of Object.keys(model.clipCost[eng]).map(Number).sort((a, b) => a - b)) {
        out.push(clipEconomics(model, eng, d, clipsPerFilm));
      }
    }
    return out;
  }, [model, clipsPerFilm]);

  const target = model.lines.targetGrossMargin ?? 0.3;
  const underNet = rows.filter((r) => r.netMargin < target);
  const addonPerClip = bundledAddonPerClip(model, clipsPerFilm);
  const infra = infraPerClip(model, clipsPerFilm);
  const blendedNet = rows.length ? rows.reduce((s, r) => s + r.netMargin, 0) / rows.length : 0;

  return (
    <AdminPageShell
      eyebrow="04 // MONEY"
      code="PRC"
      title="Pricing &"
      italic="economics."
      description="Every provider + infra cost, with credit prices and margins derived live. Edit a cost — the whole model re-prices. Margins guaranteed at the credit-value floor."
      actions={
        <div className="flex items-center gap-2">
          <DeckButton onClick={() => { setModel(defaultCostModel()); setDirty(true); }}><RotateCcw className="h-3 w-3" /> Reset</DeckButton>
          <DeckButton onClick={() => void load()} disabled={loading}><RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} /></DeckButton>
          <DeckButton onClick={() => void save()} primary disabled={saving || !dirty}><Save className="h-3 w-3" /> {saving ? "Saving…" : dirty ? "Save" : "Saved"}</DeckButton>
        </div>
      }
    >
      <div className="space-y-14">
        {/* ── KPI orbs — borderless floating figures ──────────────────── */}
        <div className="grid grid-cols-2 gap-x-10 gap-y-12 md:grid-cols-4">
          <StatOrb index={0} aura={ORB_AURAS[0]} label="Add-on COGS / clip" value={usd(addonPerClip, 3)} icon={Layers} sub="image+LLM+audio+stitch" />
          <StatOrb index={1} aura={ORB_AURAS[2]} label="Infra COGS / clip" value={usd(infra, 4)} icon={Database} sub="storage+egress+edge" />
          <StatOrb index={2} aura={blendedNet >= target ? EMERALD : ROSE} label="Blended net margin" value={pct(blendedNet)} icon={Percent} sub={`target ${pct(target)}`} accentNumber />
          <StatOrb index={3} aura={underNet.length ? ROSE : EMERALD} label="Under target" value={`${underNet.length}/${rows.length}`} icon={AlertTriangle} sub="configs sub-margin" />
        </div>

        {underNet.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl bg-amber-400/[0.06] px-5 py-4 text-[12.5px] text-amber-200/90">
            <span aria-hidden className="pointer-events-none absolute -left-6 -top-8 h-24 w-24 rounded-full" style={{ background: "hsl(38 96% 62%)", filter: "blur(46px)", opacity: 0.18 }} />
            <span className="relative flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" />
              {underNet.length} configuration(s) net below {pct(target)} after fees + infra: {underNet.map((r) => `${ENGINE_LABEL[r.engine]} ${r.duration}s (${pct(r.netMargin)})`).join(", ")}</span>
          </motion.div>
        )}

        {/* ── COMPREHENSIVE DERIVED TABLE — borderless ────────────────── */}
        <FloatSection title="Unit economics" meta={`every engine × duration · ${clipsPerFilm} clips/film`}
          actions={
            <span className="flex items-center gap-2 text-[11px] text-white/50">clips/film
              <NumInput value={clipsPerFilm} step={1} w="w-16" onChange={(n) => setClipsPerFilm(Math.max(1, Math.min(12, Math.round(n) || 5)))} />
            </span>
          }>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-separate border-spacing-0 text-[12.5px]">
              <thead>
                <tr className="text-left font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">
                  {["Engine", "Dur", "Clip $", "Add-on $", "Infra $", "COGS $", "Credits", "Rev floor", "Rev list", "Gross %", "Net %"].map((h) => (
                    <th key={h} className="px-3 pb-4 font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="font-mono tabular-nums text-white/85">
                {rows.map((r, i) => (
                  <motion.tr key={`${r.engine}-${r.duration}`}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.015, ease: EASE }}
                    className="group/row transition-colors hover:bg-white/[0.03]">
                    <td className={cn("rounded-l-xl px-3 py-2.5 font-sans text-white/90", i % 2 && "bg-white/[0.015] group-hover/row:bg-transparent")}>{ENGINE_LABEL[r.engine]}</td>
                    <td className={cn("px-3 py-2.5 text-white/50", i % 2 && "bg-white/[0.015] group-hover/row:bg-transparent")}>{r.duration}s</td>
                    <td className={cn("px-3 py-2.5", i % 2 && "bg-white/[0.015] group-hover/row:bg-transparent")}>{usd(r.clipCost)}</td>
                    <td className={cn("px-3 py-2.5 text-white/55", i % 2 && "bg-white/[0.015] group-hover/row:bg-transparent")}>{usd(r.addon, 3)}</td>
                    <td className={cn("px-3 py-2.5 text-white/55", i % 2 && "bg-white/[0.015] group-hover/row:bg-transparent")}>{usd(r.infra, 4)}</td>
                    <td className={cn("px-3 py-2.5", i % 2 && "bg-white/[0.015] group-hover/row:bg-transparent")}>{usd(r.cogs)}</td>
                    <td className={cn("px-3 py-2.5 font-semibold text-white", i % 2 && "bg-white/[0.015] group-hover/row:bg-transparent")}>{r.credits}</td>
                    <td className={cn("px-3 py-2.5", i % 2 && "bg-white/[0.015] group-hover/row:bg-transparent")}>{usd(r.revFloor)}</td>
                    <td className={cn("px-3 py-2.5 text-white/55", i % 2 && "bg-white/[0.015] group-hover/row:bg-transparent")}>{usd(r.revList)}</td>
                    <td className={cn("px-3 py-2.5", i % 2 && "bg-white/[0.015] group-hover/row:bg-transparent")} style={{ color: r.grossMargin >= target ? EMERALD : ROSE }}>{pct(r.grossMargin)}</td>
                    <td className={cn("rounded-r-xl px-3 py-2.5 font-semibold", i % 2 && "bg-white/[0.015] group-hover/row:bg-transparent")} style={{ color: r.netMargin >= target ? EMERALD : ROSE, textShadow: `0 0 18px ${(r.netMargin >= target ? EMERALD : ROSE)}30` }}>{pct(r.netMargin)}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-5 text-[11px] leading-relaxed text-white/40">
            <strong className="text-white/60">Gross</strong> = (credit value at floor − compute − add-ons) ÷ revenue — the catalog rule, guaranteed ≥ target.
            <strong className="text-white/60"> Net</strong> also subtracts payment fees + amortized infra/DB — true take-home. Credits = ⌈(clip + add-on) ÷ (floor × (1 − target))⌉.
          </p>
        </FloatSection>

        {/* ── EDITABLE ENGINE COMPUTE COSTS — borderless floating cards ── */}
        <FloatSection title="Generation API costs" meta="provider $/clip — edit to reprice">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {Object.keys(model.clipCost).map((eng, i) => (
              <motion.div key={eng} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, ease: EASE }}
                className="group/card relative overflow-hidden rounded-2xl bg-white/[0.03] p-5 transition-colors hover:bg-white/[0.05]">
                <span aria-hidden className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full transition-opacity duration-500 group-hover/card:opacity-40" style={{ background: ORB_AURAS[i % ORB_AURAS.length], filter: "blur(50px)", opacity: 0.14 }} />
                <div className="relative text-[14px] font-medium text-white">{ENGINE_LABEL[eng]}</div>
                <div className="relative mt-1 text-[10px] leading-snug text-white/40">{ENGINE_PROVIDER_NOTE[eng]}</div>
                <div className="relative mt-4 flex flex-wrap gap-2.5">
                  {Object.keys(model.clipCost[eng]).map(Number).sort((a, b) => a - b).map((d) => (
                    <label key={d} className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] text-white/45">{d}s</span>
                      <NumInput value={model.clipCost[eng][d]} onChange={(n) => setClip(eng, d, n)} w="w-20" />
                    </label>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </FloatSection>

        {/* ── EDITABLE COST LINES (by group) — borderless ──────────────── */}
        {GROUPS.map(({ g, meta }) => (
          <FloatSection key={g} title={g} meta={meta}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {DEFAULT_COST_LINES.filter((l) => l.group === g).map((l, i) => (
                <motion.label key={l.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03, ease: EASE }}
                  className="flex flex-col gap-2 rounded-2xl bg-white/[0.03] p-4 transition-colors hover:bg-white/[0.045]">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-[12.5px] text-white/85">{l.label}</span>
                    <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/35">{l.unit}</span>
                  </span>
                  <NumInput value={model.lines[l.key] ?? 0} onChange={(n) => setLine(l.key, n)} />
                  <span className="text-[10px] leading-snug text-white/40">{l.note}</span>
                </motion.label>
              ))}
            </div>
          </FloatSection>
        ))}

        <div className="flex items-center gap-2 text-[11px] text-white/40">
          <DollarSign className="h-3.5 w-3.5" />
          Defaults are Jun-2026 provider list prices — edit + Save to match real invoices. The live catalog re-prices on the same 30%-floor rule; this tab is the source of truth + what-if model.
        </div>
      </div>
    </AdminPageShell>
  );
}
