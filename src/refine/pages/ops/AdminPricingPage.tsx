// ─────────────────────────────────────────────────────────────────────────
// AdminPricingPage — /admin/pricing (Money hub · "Pricing")
// Senior-analyst view of unit economics. Every API + DB/infra cost is an
// editable input; credit prices + gross/net margins DERIVE live (auto-update
// on edit). Persisted to pricing_cost_model. Flags anything under the target.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState, useCallback } from "react";
import { Save, RotateCcw, AlertTriangle, RefreshCw, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { AdminPageShell } from "../../components/AdminPageShell";
import { FloatSection, DeckButton, accent } from "@/admin/ui/primitives";
import {
  DEFAULT_COST_LINES, ENGINE_LABEL, ENGINE_PROVIDER_NOTE,
  defaultCostModel, clipEconomics, bundledAddonPerClip, infraPerClip,
  type CostModel, type CostGroup,
} from "@/lib/payments/costModel";

const EMERALD = "hsl(158 86% 52%)";
const ROSE = "hsl(350 90% 70%)";
const usd = (n: number, dp = 2) => `$${n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const GROUPS: CostGroup[] = ["Add-ons", "Infra / Database", "Fees & policy"];

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

  // Derived economics for every engine × duration.
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

  const numField = (k: string, label: string, unit: string, note: string, step = 0.001) => (
    <label key={k} className="flex flex-col gap-1.5 rounded-xl bg-white/[0.03] p-3">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-[12.5px] text-white/80">{label}</span>
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/35">{unit}</span>
      </span>
      <input type="number" step={step} value={model.lines[k] ?? 0}
        onChange={(e) => setLine(k, parseFloat(e.target.value) || 0)}
        className="w-full rounded-lg bg-black/30 px-2.5 py-1.5 font-mono text-[13px] tabular-nums text-white outline-none focus:ring-1 focus:ring-[hsl(214_90%_62%)]" />
      <span className="text-[10px] leading-snug text-white/40">{note}</span>
    </label>
  );

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
      <div className="space-y-12">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { l: "Add-on COGS / clip", v: usd(addonPerClip, 3), s: "image+LLM+audio+stitch" },
            { l: "Infra COGS / clip", v: usd(infra, 4), s: "storage+egress+edge+fixed" },
            { l: "Target gross", v: pct(target), s: "policy floor" },
            { l: "Engines under net-target", v: String(underNet.length), s: `${rows.length} rows` },
          ].map((c, i) => (
            <div key={i} className="rounded-2xl bg-white/[0.03] px-5 py-4">
              <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/45">{c.l}</div>
              <div className="mt-1 font-display text-[24px] font-semibold tabular-nums text-white" style={{ textShadow: `0 0 22px ${accent(0.4)}` }}>{c.v}</div>
              <div className="mt-0.5 text-[10px] text-white/40">{c.s}</div>
            </div>
          ))}
        </div>

        {underNet.length > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-400/[0.06] px-4 py-3 text-[12.5px] text-amber-300/90">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {underNet.length} configuration(s) net below {pct(target)} after fees + infra: {underNet.map((r) => `${ENGINE_LABEL[r.engine]} ${r.duration}s (${pct(r.netMargin)})`).join(", ")}
          </div>
        )}

        {/* ── COMPREHENSIVE DERIVED TABLE ──────────────────────────────── */}
        <FloatSection title="Unit economics — every engine × duration" meta={`assumes ${clipsPerFilm} clips/film`}
          actions={
            <span className="flex items-center gap-2 text-[11px] text-white/50">clips/film
              <input type="number" min={1} max={12} value={clipsPerFilm} onChange={(e) => setClipsPerFilm(Math.max(1, Math.min(12, parseInt(e.target.value) || 5)))}
                className="w-14 rounded-lg bg-black/30 px-2 py-1 font-mono text-[12px] text-white outline-none" />
            </span>
          }>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-[12.5px]">
              <thead>
                <tr className="text-left font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">
                  {["Engine", "Dur", "Clip $", "Add-on $", "Infra $", "COGS $", "Credits", "Rev floor", "Rev list", "Gross %", "Net %"].map((h) => (
                    <th key={h} className="pb-3 pr-3 font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="font-mono tabular-nums text-white/85">
                {rows.map((r) => (
                  <tr key={`${r.engine}-${r.duration}`} className="border-t border-white/[0.05]">
                    <td className="py-2 pr-3 font-sans text-white/90">{ENGINE_LABEL[r.engine]}</td>
                    <td className="py-2 pr-3 text-white/50">{r.duration}s</td>
                    <td className="py-2 pr-3">{usd(r.clipCost)}</td>
                    <td className="py-2 pr-3 text-white/55">{usd(r.addon, 3)}</td>
                    <td className="py-2 pr-3 text-white/55">{usd(r.infra, 4)}</td>
                    <td className="py-2 pr-3">{usd(r.cogs)}</td>
                    <td className="py-2 pr-3 font-semibold text-white">{r.credits}</td>
                    <td className="py-2 pr-3">{usd(r.revFloor)}</td>
                    <td className="py-2 pr-3 text-white/55">{usd(r.revList)}</td>
                    <td className="py-2 pr-3" style={{ color: r.grossMargin >= target ? EMERALD : ROSE }}>{pct(r.grossMargin)}</td>
                    <td className="py-2 pr-3 font-semibold" style={{ color: r.netMargin >= target ? EMERALD : ROSE }}>{pct(r.netMargin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-white/40">
            <strong className="text-white/60">Gross</strong> = (credit value at floor − compute − add-ons) ÷ revenue (the catalog pricing rule, guaranteed ≥ target).
            <strong className="text-white/60"> Net</strong> additionally subtracts payment fees + amortized infra/DB — the true take-home. Credits derive as ⌈(clip+add-on) ÷ (floor × (1−target))⌉.
          </p>
        </FloatSection>

        {/* ── EDITABLE ENGINE COMPUTE COSTS ────────────────────────────── */}
        <FloatSection title="Generation API costs (provider $/clip)" meta="edit to reprice">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.keys(model.clipCost).map((eng) => (
              <div key={eng} className="rounded-2xl bg-white/[0.03] p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] font-medium text-white">{ENGINE_LABEL[eng]}</span>
                </div>
                <div className="mt-1 text-[10px] leading-snug text-white/40">{ENGINE_PROVIDER_NOTE[eng]}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.keys(model.clipCost[eng]).map(Number).sort((a, b) => a - b).map((d) => (
                    <label key={d} className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] text-white/45">{d}s</span>
                      <input type="number" step={0.001} value={model.clipCost[eng][d]}
                        onChange={(e) => setClip(eng, d, parseFloat(e.target.value) || 0)}
                        className="w-20 rounded-lg bg-black/30 px-2 py-1 font-mono text-[12px] tabular-nums text-white outline-none focus:ring-1 focus:ring-[hsl(214_90%_62%)]" />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </FloatSection>

        {/* ── EDITABLE COST LINES (by group) ───────────────────────────── */}
        {GROUPS.map((g) => (
          <FloatSection key={g} title={g} meta={g === "Add-ons" ? "folded into clip price" : g === "Infra / Database" ? "amortized into net margin" : "fees + pricing policy"}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {DEFAULT_COST_LINES.filter((l) => l.group === g).map((l) => numField(l.key, l.label, l.unit, l.note))}
            </div>
          </FloatSection>
        ))}

        <div className="flex items-center gap-2 text-[11px] text-white/40">
          <TrendingUp className="h-3.5 w-3.5" />
          Defaults are Jun-2026 provider list prices — edit + Save to match real invoices. Credit prices in the live catalog (engines registry) are repriced on the same rule; this tab is the source of truth + what-if model.
        </div>
      </div>
    </AdminPageShell>
  );
}
