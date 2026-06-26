/** Experiments — A/B test definitions, status, and winner picking. */
import { useState } from "react";
import { Plus, Play, Pause, BadgeCheck, Trash2 } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleV2, type AdminRow } from "../../components/AdminConsoleV2";
import { AdminDialog, AdminField, inputClass } from "../../components/AdminFormPrimitives";
import { FloatSection } from "@/admin/ui/primitives";
import { Donut, CategoryBars, countBy, CYAN, AMBER, VIOLET } from "@/admin/ui/charts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ExperimentRow extends AdminRow {
  id: string;
  key: string;
  hypothesis: string | null;
  variants: string[];
  status: string;
  metric_primary: string | null;
  started_at: string | null;
  ended_at: string | null;
  winner: string | null;
}

const STATUS_TONE = { draft: "text-white/55", live: "text-emerald-300", paused: "text-amber-300", concluded: "text-primary/80" } as const;

export default function AdminExperimentsPage() {
  const [creating, setCreating] = useState(false);
  const [concluding, setConcluding] = useState<ExperimentRow | null>(null);
  return (
    <AdminPageShell
      eyebrow="08 // GROWTH"
      code="AB"
      title="Experiments"
      italic="& A/B."
      description="Hypothesis, variants, allocation, and the verdict — all in one register."
    >
      <AdminConsoleV2<ExperimentRow>
        intro="Experiments are defined and managed here, but the product runtime does not read them yet — there is no request-time allocation or winner gating wired up. Treat this as the admin source of record for planned, running, and concluded tests."
        query={{ table: "experiments", orderBy: { column: "created_at", ascending: false } }}
        searchKey="key"
        filters={[
          { key: "status", label: "Status", type: "select", options: [
            { value: "draft", label: "Draft" }, { value: "live", label: "Live" },
            { value: "paused", label: "Paused" }, { value: "concluded", label: "Concluded" }] },
        ]}
        signals={[
          { label: "Live", value: (r) => r.filter((x) => (x as ExperimentRow).status === "live").length, tone: "emerald" },
          { label: "Draft", value: (r) => r.filter((x) => (x as ExperimentRow).status === "draft").length, tone: "neutral" },
          { label: "Paused", value: (r) => r.filter((x) => (x as ExperimentRow).status === "paused").length, tone: "amber" },
          { label: "Concluded", value: (r) => r.filter((x) => (x as ExperimentRow).status === "concluded").length, tone: "blue" },
        ]}
        charts={(rows) => {
          const data = rows as ExperimentRow[];
          const statusColor: Record<string, string> = { live: CYAN, paused: AMBER, concluded: VIOLET, draft: "rgba(255,255,255,0.22)" };
          const byStatus = countBy(data, (r) => r.status).map((d) => ({ ...d, color: statusColor[d.key] }));
          // Experiments launched per calendar month, derived from real started_at
          // timestamps (drafts that never launched have no started_at → excluded).
          const launched = data.filter((r) => r.started_at);
          const byMonth = countBy(launched, (r) => (r.started_at ?? "").slice(0, 7)).sort((a, b) => a.key.localeCompare(b.key));
          return (
            <div className="grid grid-cols-1 gap-x-14 gap-y-14 lg:grid-cols-2">
              <FloatSection title="By status" meta={`${data.length} experiments`}>
                <Donut data={byStatus} centerLabel="experiments" />
              </FloatSection>
              <FloatSection title="Launched per month" meta={`${launched.length} launched`}>
                <CategoryBars data={byMonth} valueSuffix="launched" emptyLabel="None launched yet." />
              </FloatSection>
            </div>
          );
        }}
        columns={[
          { key: "key", label: "Key", width: "200px",
            render: (v) => <code className="font-mono text-[12px] text-primary/80">{String(v)}</code> },
          { key: "hypothesis", label: "Hypothesis" },
          { key: "variants", label: "Variants", width: "180px",
            render: (v) => Array.isArray(v) ? v.join(" · ") : "—" },
          { key: "metric_primary", label: "Metric", width: "140px" },
          { key: "status", label: "Status", width: "120px",
            render: (v) => <span className={`text-[10px] font-mono uppercase tracking-[0.18em] ${STATUS_TONE[v as keyof typeof STATUS_TONE]}`}>{String(v)}</span> },
          { key: "winner", label: "Winner", width: "160px",
            render: (_v, r) => {
              if (r.winner) return <span className="inline-flex items-center gap-1.5 text-[12px] text-emerald-300"><BadgeCheck className="w-3.5 h-3.5" />{String(r.winner)}</span>;
              if (r.status === "live" || r.status === "paused")
                return (
                  <button
                    type="button"
                    onClick={() => setConcluding(r)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-[11px] text-white/70 transition-colors hover:bg-white/[0.12] hover:text-white"
                  >
                    <BadgeCheck className="w-3 h-3" />Pick winner
                  </button>
                );
              return <span className="text-white/25">—</span>;
            } },
        ]}
        actions={[
          { label: "Launch", icon: Play, show: (r) => r.status === "draft" || r.status === "paused",
            onRun: async (r) => {
              const { error } = await supabase.from("experiments").update({ status: "live", started_at: new Date().toISOString() }).eq("id", r.id);
              if (error) throw error;
            }},
          { label: "Pause", icon: Pause, show: (r) => r.status === "live",
            onRun: async (r) => {
              const { error } = await supabase.from("experiments").update({ status: "paused" }).eq("id", r.id);
              if (error) throw error;
            }},
          { label: "Delete", icon: Trash2, variant: "destructive", confirm: "Delete this experiment? It is not read by the product runtime, so deleting only removes the admin record.",
            onRun: async (r) => {
              const { error } = await supabase.from("experiments").delete().eq("id", r.id);
              if (error) throw error;
            }},
        ]}
        primaryCta={{ label: "New experiment", onClick: () => setCreating(true) }}
        emptyTitle="No experiments yet"
        emptyDescription="Define your first A/B test. Note: experiments are admin-managed only — nothing in the product reads them at runtime yet."
      >
        {creating && <CreateExperiment onClose={() => setCreating(false)} />}
        {concluding && <ConcludeExperiment exp={concluding} onClose={() => setConcluding(null)} />}
      </AdminConsoleV2>
    </AdminPageShell>
  );
}

function ConcludeExperiment({ exp, onClose }: { exp: ExperimentRow; onClose: () => void }) {
  const variants = Array.isArray(exp.variants) ? exp.variants : [];
  const [winner, setWinner] = useState(variants[0] ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!winner || !variants.includes(winner)) { toast.error("Pick a winning variant"); return; }
    setBusy(true);
    const { error } = await supabase.from("experiments")
      .update({ status: "concluded", ended_at: new Date().toISOString(), winner }).eq("id", exp.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Winner set: ${winner}`);
    window.dispatchEvent(new Event("admin-console-refresh"));
    onClose();
  };

  return (
    <AdminDialog title={`Conclude ${exp.key}`} icon={BadgeCheck} onClose={onClose} onSubmit={submit} busy={busy} submitLabel="Conclude & set winner">
      <AdminField label="Winning variant" hint="Recorded on the experiment record; no runtime consumer reads it yet.">
        <select value={winner} onChange={(e) => setWinner(e.target.value)} className={inputClass}>
          {variants.length === 0 && <option value="">No variants defined</option>}
          {variants.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </AdminField>
    </AdminDialog>
  );
}

function CreateExperiment({ onClose }: { onClose: () => void }) {
  const [key, setKey] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [variants, setVariants] = useState("control,treatment");
  const [metric, setMetric] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!key.trim()) { toast.error("Key required"); return; }
    const v = variants.split(",").map((s) => s.trim()).filter(Boolean);
    if (v.length < 2) { toast.error("At least 2 variants required"); return; }
    const allocation: Record<string, number> = {};
    const each = Math.floor(100 / v.length);
    v.forEach((name, i) => { allocation[name] = i === v.length - 1 ? 100 - each * (v.length - 1) : each; });
    setBusy(true);
    const { error } = await supabase.from("experiments").insert({
      key, hypothesis: hypothesis || null, variants: v, allocation,
      metric_primary: metric || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Experiment created (draft)");
    window.dispatchEvent(new Event("admin-console-refresh"));
    onClose();
  };

  return (
    <AdminDialog title="New experiment" icon={Plus} onClose={onClose} onSubmit={submit} busy={busy} submitLabel="Save draft">
      <AdminField label="Key" hint="Identifier for this experiment (not yet read by product code)">
        <input value={key} onChange={(e) => setKey(e.target.value)} className={`${inputClass} font-mono`} placeholder="onboarding_v3" /></AdminField>
      <AdminField label="Hypothesis"><input value={hypothesis} onChange={(e) => setHypothesis(e.target.value)} className={inputClass} placeholder="Skipping email step lifts D7 retention" /></AdminField>
      <AdminField label="Variants" hint="Comma-separated">
        <input value={variants} onChange={(e) => setVariants(e.target.value)} className={inputClass} /></AdminField>
      <AdminField label="Primary metric"><input value={metric} onChange={(e) => setMetric(e.target.value)} className={inputClass} placeholder="d7_retention" /></AdminField>
    </AdminDialog>
  );
}
