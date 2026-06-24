/** Email templates — subject + body HTML for transactional sends. */
import { useState } from "react";
import { Mail, Plus, Power, Trash2 } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleV2, type AdminRow } from "../../components/AdminConsoleV2";
import { AdminDialog, AdminField, inputClass, textareaClass } from "../../components/AdminFormPrimitives";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TemplateRow extends AdminRow {
  id: string;
  slug: string;
  name: string;
  subject: string;
  body_html: string;
  body_text: string | null;
  enabled: boolean;
  updated_at: string;
}

export default function AdminEmailTemplatesPage() {
  const [creating, setCreating] = useState(false);
  return (
    <AdminPageShell
      eyebrow="12 // COMMS"
      code="TPL"
      title="Email"
      italic="Templates."
      description="Subject lines, HTML bodies, and variable bindings for every transactional send."
    >
      <AdminConsoleV2<TemplateRow>
        intro="Reference / draft copies of transactional emails. Note: the live send pipeline currently uses code-defined templates (send-transactional-email · auth-email-hook), so edits here are for drafting and don't change sent mail yet."
        query={{ table: "email_templates", orderBy: { column: "updated_at", ascending: false } }}
        searchKey="name"
        signals={[
          { label: "Templates", value: (r) => r.length, tone: "blue" },
          { label: "Enabled", value: (r) => r.filter((x) => (x as TemplateRow).enabled).length, tone: "emerald" },
          { label: "Disabled", value: (r) => r.filter((x) => !(x as TemplateRow).enabled).length, tone: "amber" },
          { label: "Avg subject length",
            value: (r) => r.length ? Math.round(r.reduce((s, x) => s + (x as TemplateRow).subject.length, 0) / r.length) + " chars" : "—",
            tone: "neutral" },
        ]}
        columns={[
          { key: "name", label: "Name", width: "220px" },
          { key: "slug", label: "Slug", width: "200px",
            render: (v) => <code className="font-mono text-[11px] text-primary/80">{String(v)}</code> },
          { key: "subject", label: "Subject" },
          { key: "enabled", label: "Status", width: "100px" },
          { key: "updated_at", label: "Updated", width: "170px", hideOnMobile: true },
        ]}
        actions={[
          { label: "Toggle", icon: Power, onRun: async (r) => {
            const { error } = await supabase.from("email_templates").update({ enabled: !r.enabled }).eq("id", r.id);
            if (error) throw error;
          }},
          { label: "Delete", icon: Trash2, variant: "destructive", confirm: "Delete this draft template? (The live send pipeline uses code-defined templates, so this won't affect sent mail.)",
            onRun: async (r) => {
              const { error } = await supabase.from("email_templates").delete().eq("id", r.id);
              if (error) throw error;
            }},
        ]}
        primaryCta={{ label: "New template", onClick: () => setCreating(true) }}
        emptyTitle="No email templates yet"
        emptyDescription="Create a template, then reference it by slug from your send code."
      >
        {creating && <CreateTemplate onClose={() => setCreating(false)} />}
      </AdminConsoleV2>
    </AdminPageShell>
  );
}

function CreateTemplate({ onClose }: { onClose: () => void }) {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!slug.trim() || !name.trim() || !subject.trim() || !body.trim()) {
      toast.error("All fields required"); return;
    }
    setBusy(true);
    const { error } = await supabase.from("email_templates").insert({
      slug, name, subject, body_html: body,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Template created");
    window.dispatchEvent(new Event("admin-console-refresh"));
    onClose();
  };

  return (
    <AdminDialog title="New email template" icon={Plus} onClose={onClose} onSubmit={submit} busy={busy} submitLabel="Save">
      <AdminField label="Slug" hint="Identifier used in code (e.g. welcome_v2)">
        <input value={slug} onChange={(e) => setSlug(e.target.value)} className={`${inputClass} font-mono`} /></AdminField>
      <AdminField label="Name"><input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} /></AdminField>
      <AdminField label="Subject"><input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} /></AdminField>
      <AdminField label="HTML body"><textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} className={`${textareaClass} font-mono text-[11px]`} /></AdminField>
    </AdminDialog>
  );
}
