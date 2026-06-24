/** Experiments — A/B test definitions, status, and winner picking. */
import { useState } from "react";
import { FlaskConical, Plus, Play, Pause, BadgeCheck, Trash2 } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleV2, type AdminRow } from "../../components/AdminConsoleV2";
import { AdminDialog, AdminField, inputClass } from "../../components/AdminFormPrimitives";
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
  return (
    <AdminPageShell
      eyebrow="08 // GROWTH"
      code="AB"
      title="Experiments"
      italic="& A/B."
      description="Hypothesis, variants, allocation, and the verdict — all in one register."
    >
      <AdminConsoleV2<ExperimentRow>
        intro="Define an experiment once. Allocation drives randomization at request time, and conclusion locks the winner site-wide."
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
        columns={[
          { key: "key", label: "Key", width: "200px",
            render: (v) => <code className="font-mono text-[12px] text-primary/80">{String(v)}</code> },
          { key: "hypothesis", label: "Hypothesis" },
          { key: "variants", label: "Variants", width: "180px",
            render: (v) => Array.isArray(v) ? v.join(" · ") : "—" },
          { key: "metric_primary", label: "Metric", width: "140px" },
          { key: "status", label: "Status", width: "120px",
            render: (v) => <span className={`text-[10px] font-mono uppercase tracking-[0.18em] ${STATUS_TONE[v as keyof typeof STATUS_TONE]}`}>{String(v)}</span> },
          { key: "winner", label: "Winner", width: "120px" },
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
          { label: "Conclude", icon: BadgeCheck, show: (r) => r.status === "live" || r.status === "paused",
            onRun: async (r) => {
              const winner = prompt(`Pick winning variant for ${r.key}:\n${r.variants.join(", ")}`);
              if (!winner || !r.variants.includes(winner)) return;
              const { error } = await supabase.from("experiments")
                .update({ status: "concluded", ended_at: new Date().toISOString(), winner }).eq("id", r.id);
              if (error) throw error;
            }},
          { label: "Delete", icon: Trash2, variant: "destructive", confirm: "Delete this experiment? Any code reading its key will get the control variant.",
            onRun: async (r) => {
              const { error } = await supabase.from("experiments").delete().eq("id", r.id);
              if (error) throw error;
            }},
        ]}
        primaryCta={{ label: "New experiment", onClick: () => setCreating(true) }}
        emptyTitle="No experiments yet"
        emptyDescription="Define your first A/B test — variants randomize at request time, allocation determines split."
      >
        {creating && <CreateExperiment onClose={() => setCreating(false)} />}
      </AdminConsoleV2>
    </AdminPageShell>
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
      <AdminField label="Key" hint="Used in code to read the variant">
        <input value={key} onChange={(e) => setKey(e.target.value)} className={`${inputClass} font-mono`} placeholder="onboarding_v3" /></AdminField>
      <AdminField label="Hypothesis"><input value={hypothesis} onChange={(e) => setHypothesis(e.target.value)} className={inputClass} placeholder="Skipping email step lifts D7 retention" /></AdminField>
      <AdminField label="Variants" hint="Comma-separated">
        <input value={variants} onChange={(e) => setVariants(e.target.value)} className={inputClass} /></AdminField>
      <AdminField label="Primary metric"><input value={metric} onChange={(e) => setMetric(e.target.value)} className={inputClass} placeholder="d7_retention" /></AdminField>
    </AdminDialog>
  );
}
