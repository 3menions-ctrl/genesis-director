/** Abuse rules — IP/email blocklist, rate limits, trusted-partner overrides. */
import { useState } from "react";
import { Ban, Plus, Trash2, Power } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleV2, type AdminRow } from "../../components/AdminConsoleV2";
import { AdminDialog, AdminField, inputClass } from "../../components/AdminFormPrimitives";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RuleRow extends AdminRow {
  id: string;
  kind: string;
  pattern: string;
  reason: string | null;
  ttl_expires_at: string | null;
  active: boolean;
  hits: number;
  created_at: string;
}

export default function AdminAbusePage() {
  const [creating, setCreating] = useState(false);
  return (
    <AdminPageShell
      eyebrow="07 // ACCESS"
      code="ABS"
      title="Abuse"
      italic="Center."
      description="IP and email blocklist, velocity rules, and surgical overrides for trusted partners."
    >
      <AdminConsoleV2<RuleRow>
        intro="The wall between you and the bots — rules, lists, and surgical overrides for trusted partners."
        query={{ table: "abuse_rules", orderBy: { column: "created_at", ascending: false } }}
        searchKey="pattern"
        searchPlaceholder="Search by pattern…"
        filters={[
          { key: "kind", label: "Kind", type: "select", options: [
            { value: "ip_block", label: "IP block" },
            { value: "email_block", label: "Email block" },
            { value: "rate_limit", label: "Rate limit" },
            { value: "trusted_partner", label: "Trusted partner" }] },
        ]}
        signals={[
          { label: "Active", value: (r) => r.filter((x) => (x as RuleRow).active).length, tone: "rose" },
          { label: "IP blocks", value: (r) => r.filter((x) => (x as RuleRow).kind === "ip_block").length, tone: "blue" },
          { label: "Email blocks", value: (r) => r.filter((x) => (x as RuleRow).kind === "email_block").length, tone: "amber" },
          { label: "Total hits", value: (r) => r.reduce((s, x) => s + ((x as RuleRow).hits ?? 0), 0).toLocaleString(), tone: "neutral" },
        ]}
        columns={[
          { key: "kind", label: "Kind", width: "140px",
            render: (v) => <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#6FB6FF]">{String(v).replace("_", " ")}</span> },
          { key: "pattern", label: "Pattern" },
          { key: "reason", label: "Reason" },
          { key: "hits", label: "Hits", width: "80px", align: "right" },
          { key: "ttl_expires_at", label: "Expires", width: "170px", hideOnMobile: true },
          { key: "active", label: "Status", width: "100px" },
        ]}
        actions={[
          { label: "Toggle", icon: Power, onRun: async (r) => {
            const { error } = await supabase.from("abuse_rules").update({ active: !r.active }).eq("id", r.id);
            if (error) throw error;
          }},
          { label: "Delete", icon: Trash2, variant: "destructive", confirm: "Delete this rule?",
            onRun: async (r) => {
              const { error } = await supabase.from("abuse_rules").delete().eq("id", r.id);
              if (error) throw error;
            }},
        ]}
        primaryCta={{ label: "Add rule", onClick: () => setCreating(true) }}
        emptyTitle="No abuse rules yet"
        emptyDescription="Add a rule to block an IP, email, or rate-limit pattern."
      >
        {creating && <CreateAbuseRule onClose={() => setCreating(false)} />}
      </AdminConsoleV2>
    </AdminPageShell>
  );
}

function CreateAbuseRule({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState("ip_block");
  const [pattern, setPattern] = useState("");
  const [reason, setReason] = useState("");
  const [ttlHours, setTtlHours] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!pattern.trim()) { toast.error("Pattern required"); return; }
    setBusy(true);
    const ttl = ttlHours ? new Date(Date.now() + Number(ttlHours) * 3600_000).toISOString() : null;
    const { error } = await supabase.from("abuse_rules").insert({
      kind, pattern, reason: reason || null, ttl_expires_at: ttl,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Rule added");
    onClose();
  };

  return (
    <AdminDialog title="New abuse rule" icon={Plus} onClose={onClose} onSubmit={submit} busy={busy} submitLabel="Add rule">
      <AdminField label="Kind">
        <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputClass}>
          <option value="ip_block">IP block</option>
          <option value="email_block">Email block</option>
          <option value="rate_limit">Rate limit</option>
          <option value="trusted_partner">Trusted partner</option>
        </select>
      </AdminField>
      <AdminField label="Pattern" hint="IP/CIDR, email or domain, or rate-limit DSL">
        <input value={pattern} onChange={(e) => setPattern(e.target.value)} className={inputClass} />
      </AdminField>
      <AdminField label="Reason">
        <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} placeholder="Brute-force attempts, etc." />
      </AdminField>
      <AdminField label="TTL (hours)" hint="Leave empty for indefinite">
        <input type="number" min={1} value={ttlHours} onChange={(e) => setTtlHours(e.target.value)} className={inputClass} />
      </AdminField>
    </AdminDialog>
  );
}
