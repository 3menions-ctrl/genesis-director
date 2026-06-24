/** Content safety rules — block/warn patterns on user-generated content. */
import { useState } from "react";
import { ShieldAlert, Plus, Power, Trash2 } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleV2, type AdminRow } from "../../components/AdminConsoleV2";
import { AdminDialog, AdminField, inputClass } from "../../components/AdminFormPrimitives";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RuleRow extends AdminRow {
  id: string;
  pattern: string;
  match_type: string;
  severity: string;
  category: string | null;
  active: boolean;
  hits: number;
  created_at: string;
}

export default function AdminContentSafetyPage() {
  const [creating, setCreating] = useState(false);
  return (
    <AdminPageShell
      eyebrow="11 // CONTENT"
      code="SAF"
      title="Content"
      italic="Safety."
      description="Pattern-based rules that block or warn on prompts and generated assets."
    >
      <AdminConsoleV2<RuleRow>
        intro="Layer this on top of the built-in moderation. Patterns match against prompts before the pipeline runs."
        query={{ table: "content_safety_rules", orderBy: { column: "created_at", ascending: false } }}
        searchKey="pattern"
        filters={[
          { key: "severity", label: "Severity", type: "select", options: [
            { value: "warn", label: "Warn" }, { value: "block", label: "Block" }] },
          { key: "match_type", label: "Match", type: "select", options: [
            { value: "substring", label: "Substring" }, { value: "regex", label: "Regex" }, { value: "exact", label: "Exact" }] },
        ]}
        signals={[
          { label: "Active", value: (r) => r.filter((x) => (x as RuleRow).active).length, tone: "blue" },
          { label: "Blocking", value: (r) => r.filter((x) => (x as RuleRow).severity === "block").length, tone: "rose" },
          { label: "Warnings", value: (r) => r.filter((x) => (x as RuleRow).severity === "warn").length, tone: "amber" },
          { label: "Total hits", value: (r) => r.reduce((s, x) => s + ((x as RuleRow).hits ?? 0), 0).toLocaleString(), tone: "neutral" },
        ]}
        columns={[
          { key: "pattern", label: "Pattern",
            render: (v) => <code className="font-mono text-[12px] text-[#0c1426]">{String(v)}</code> },
          { key: "match_type", label: "Match", width: "100px" },
          { key: "severity", label: "Severity", width: "100px",
            render: (v) => <span className={`text-[10px] font-mono uppercase tracking-[0.18em] ${v === "block" ? "text-rose-300" : "text-amber-300"}`}>{String(v)}</span> },
          { key: "category", label: "Category", width: "140px" },
          { key: "hits", label: "Hits", width: "80px", align: "right" },
          { key: "active", label: "Status", width: "100px" },
        ]}
        actions={[
          { label: "Toggle", icon: Power, onRun: async (r) => {
            const { error } = await supabase.from("content_safety_rules").update({ active: !r.active }).eq("id", r.id);
            if (error) throw error;
          }},
          { label: "Delete", icon: Trash2, variant: "destructive", confirm: "Delete this rule?",
            onRun: async (r) => {
              const { error } = await supabase.from("content_safety_rules").delete().eq("id", r.id);
              if (error) throw error;
            }},
        ]}
        primaryCta={{ label: "Add rule", onClick: () => setCreating(true) }}
        emptyTitle="No custom safety rules yet"
        emptyDescription="Add a pattern to block or warn on specific content before generation runs."
      >
        {creating && <CreateRule onClose={() => setCreating(false)} />}
      </AdminConsoleV2>
    </AdminPageShell>
  );
}

function CreateRule({ onClose }: { onClose: () => void }) {
  const [pattern, setPattern] = useState("");
  const [matchType, setMatchType] = useState("substring");
  const [severity, setSeverity] = useState("warn");
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!pattern.trim()) { toast.error("Pattern required"); return; }
    if (matchType === "regex") {
      try { new RegExp(pattern); } catch (e) { toast.error(`Invalid regex: ${(e as Error).message}`); return; }
    }
    setBusy(true);
    const { error } = await supabase.from("content_safety_rules").insert({
      pattern, match_type: matchType, severity, category: category || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Rule added");
    onClose();
  };

  return (
    <AdminDialog title="New safety rule" icon={Plus} onClose={onClose} onSubmit={submit} busy={busy} submitLabel="Add">
      <AdminField label="Pattern"><input value={pattern} onChange={(e) => setPattern(e.target.value)} className={inputClass} /></AdminField>
      <AdminField label="Match type"><select value={matchType} onChange={(e) => setMatchType(e.target.value)} className={inputClass}>
        <option value="substring">Substring</option><option value="regex">Regex</option><option value="exact">Exact</option>
      </select></AdminField>
      <AdminField label="Severity"><select value={severity} onChange={(e) => setSeverity(e.target.value)} className={inputClass}>
        <option value="warn">Warn (let through, flag)</option><option value="block">Block (refuse generation)</option>
      </select></AdminField>
      <AdminField label="Category" hint="Optional grouping (e.g. violence, pii)"><input value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass} /></AdminField>
    </AdminDialog>
  );
}
