/** Changelog — author public release notes. */
import { useState } from "react";
import { GitCommit, Plus, Power, Trash2 } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleV2, type AdminRow } from "../../components/AdminConsoleV2";
import { AdminDialog, AdminField, inputClass, textareaClass } from "../../components/AdminFormPrimitives";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ChangelogRow extends AdminRow {
  id: string;
  version: string | null;
  title: string;
  body_md: string;
  category: string;
  published: boolean;
  published_at: string | null;
  created_at: string;
}

const CATEGORY_TONE = {
  feature: "text-emerald-300",
  fix: "text-primary/80",
  improvement: "text-amber-300",
  breaking: "text-rose-300",
  security: "text-rose-300",
} as const;

export default function AdminChangelogPage() {
  const [creating, setCreating] = useState(false);
  return (
    <AdminPageShell
      eyebrow="12 // COMMS"
      code="CHG"
      title="Changelog"
      italic="Curator."
      description="Public release notes — what shipped, when, and to whom."
    >
      <AdminConsoleV2<ChangelogRow>
        intro="Compose release notes once, publish to the public changelog and the in-app announcements feed."
        query={{ table: "changelog_entries", orderBy: { column: "created_at", ascending: false } }}
        searchKey="title"
        searchPlaceholder="Search entries…"
        filters={[
          { key: "category", label: "Category", type: "select", options: [
            { value: "feature", label: "Feature" }, { value: "fix", label: "Fix" },
            { value: "improvement", label: "Improvement" }, { value: "breaking", label: "Breaking" },
            { value: "security", label: "Security" }] },
        ]}
        signals={[
          { label: "Total", value: (r) => r.length, tone: "blue" },
          { label: "Published", value: (r) => r.filter((x) => (x as ChangelogRow).published).length, tone: "emerald" },
          { label: "Drafts", value: (r) => r.filter((x) => !(x as ChangelogRow).published).length, tone: "amber" },
          { label: "Breaking changes", value: (r) => r.filter((x) => (x as ChangelogRow).category === "breaking").length, tone: "rose" },
        ]}
        columns={[
          { key: "version", label: "Version", width: "100px",
            render: (v) => v ? <code className="font-mono text-[11px] text-primary/80">v{String(v)}</code> : "—" },
          { key: "title", label: "Title" },
          { key: "category", label: "Category", width: "120px",
            render: (v) => <span className={`text-[10px] font-mono uppercase tracking-[0.18em] ${CATEGORY_TONE[v as keyof typeof CATEGORY_TONE]}`}>{String(v)}</span> },
          { key: "published", label: "Status", width: "100px" },
          { key: "published_at", label: "Published", width: "170px", hideOnMobile: true },
        ]}
        actions={[
          { label: "Publish", icon: Power, show: (r) => !r.published,
            onRun: async (r) => {
              const { error } = await supabase.from("changelog_entries").update({ published: true, published_at: new Date().toISOString() }).eq("id", r.id);
              if (error) throw error;
            }},
          { label: "Unpublish", icon: Power, show: (r) => !!r.published,
            onRun: async (r) => {
              const { error } = await supabase.from("changelog_entries").update({ published: false, published_at: null }).eq("id", r.id);
              if (error) throw error;
            }},
          { label: "Delete", icon: Trash2, variant: "destructive", confirm: "Delete this entry?",
            onRun: async (r) => {
              const { error } = await supabase.from("changelog_entries").delete().eq("id", r.id);
              if (error) throw error;
            }},
        ]}
        primaryCta={{ label: "New entry", onClick: () => setCreating(true) }}
        emptyTitle="No changelog entries yet"
        emptyDescription="Write the first release note to keep your customers in the loop."
      >
        {creating && <CreateChangelog onClose={() => setCreating(false)} />}
      </AdminConsoleV2>
    </AdminPageShell>
  );
}

function CreateChangelog({ onClose }: { onClose: () => void }) {
  const [version, setVersion] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("feature");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim() || !body.trim()) { toast.error("Title and body required"); return; }
    setBusy(true);
    const { error } = await supabase.from("changelog_entries").insert({
      version: version || null, title, body_md: body, category,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Entry created");
    window.dispatchEvent(new Event("admin-console-refresh"));
    onClose();
  };

  return (
    <AdminDialog title="New changelog entry" icon={Plus} onClose={onClose} onSubmit={submit} busy={busy} submitLabel="Save draft">
      <AdminField label="Version" hint="Semver, e.g. 2.4.0"><input value={version} onChange={(e) => setVersion(e.target.value)} className={inputClass} /></AdminField>
      <AdminField label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} /></AdminField>
      <AdminField label="Body (Markdown)"><textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} className={textareaClass} /></AdminField>
      <AdminField label="Category">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
          <option value="feature">Feature</option><option value="improvement">Improvement</option>
          <option value="fix">Fix</option><option value="breaking">Breaking</option><option value="security">Security</option>
        </select>
      </AdminField>
    </AdminDialog>
  );
}
