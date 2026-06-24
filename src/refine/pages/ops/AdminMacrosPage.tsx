/** Support macros — reusable canned responses for customer support. */
import { useState } from "react";
import { MessageSquareText, Plus, Copy, Trash2 } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleV2, type AdminRow } from "../../components/AdminConsoleV2";
import { AdminDialog, AdminField, inputClass, textareaClass } from "../../components/AdminFormPrimitives";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MacroRow extends AdminRow {
  id: string;
  title: string;
  body: string;
  tags: string[];
  shortcut: string | null;
  use_count: number;
  created_at: string;
}

export default function AdminMacrosPage() {
  const [creating, setCreating] = useState(false);
  return (
    <AdminPageShell
      eyebrow="12 // COMMS"
      code="MCR"
      title="Support"
      italic="Macros."
      description="Canned responses, refund explanations, common policy answers."
    >
      <AdminConsoleV2<MacroRow>
        intro="A macro library for support replies. Copy → paste → personalize. Track which ones get used most."
        query={{ table: "support_macros", orderBy: { column: "use_count", ascending: false } }}
        searchKey="title"
        signals={[
          { label: "Total macros", value: (r) => r.length, tone: "blue" },
          { label: "Total uses", value: (r) => r.reduce((s, x) => s + ((x as MacroRow).use_count ?? 0), 0).toLocaleString(), tone: "emerald" },
          { label: "Unused", value: (r) => r.filter((x) => (x as MacroRow).use_count === 0).length, tone: "amber" },
          { label: "Tagged", value: (r) => r.filter((x) => ((x as MacroRow).tags?.length ?? 0) > 0).length, tone: "neutral" },
        ]}
        columns={[
          { key: "title", label: "Title", width: "260px" },
          { key: "tags", label: "Tags", width: "200px",
            render: (v) => Array.isArray(v) && v.length
              ? <div className="flex flex-wrap gap-1">{v.map((t) => <span key={t} className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#5d6a82] border border-[#e7ebf3] rounded-full px-2 py-0.5">{t}</span>)}</div>
              : <span className="text-[#9aa4b8]">—</span> },
          { key: "body", label: "Body preview",
            render: (v) => <span className="text-[#5d6a82] text-[12px]">{String(v).slice(0, 80)}…</span> },
          { key: "use_count", label: "Uses", width: "80px", align: "right" },
        ]}
        actions={[
          { label: "Copy", icon: Copy,
            onRun: async (r) => {
              await navigator.clipboard.writeText(r.body);
              await supabase.from("support_macros").update({ use_count: r.use_count + 1 }).eq("id", r.id);
            }},
          { label: "Delete", icon: Trash2, variant: "destructive", confirm: "Delete this macro?",
            onRun: async (r) => {
              const { error } = await supabase.from("support_macros").delete().eq("id", r.id);
              if (error) throw error;
            }},
        ]}
        primaryCta={{ label: "New macro", onClick: () => setCreating(true) }}
        emptyTitle="No support macros yet"
        emptyDescription="Save your common replies as macros. Copy to clipboard in one click."
      >
        {creating && <CreateMacro onClose={() => setCreating(false)} />}
      </AdminConsoleV2>
    </AdminPageShell>
  );
}

function CreateMacro({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim() || !body.trim()) { toast.error("Title and body required"); return; }
    setBusy(true);
    const tagsArr = tags.split(",").map((t) => t.trim()).filter(Boolean);
    const { error } = await supabase.from("support_macros").insert({ title, body, tags: tagsArr });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Macro saved");
    onClose();
  };

  return (
    <AdminDialog title="New support macro" icon={Plus} onClose={onClose} onSubmit={submit} busy={busy} submitLabel="Save">
      <AdminField label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="Refund — generation failed" /></AdminField>
      <AdminField label="Body"><textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} className={textareaClass} placeholder="Hi {{name}}, sorry your generation failed…" /></AdminField>
      <AdminField label="Tags" hint="Comma-separated"><input value={tags} onChange={(e) => setTags(e.target.value)} className={inputClass} placeholder="refund, billing" /></AdminField>
    </AdminDialog>
  );
}
