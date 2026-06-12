/** Project templates — global admin curation across users. */
import { LayoutTemplate, Power, Trash2 } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleV2, type AdminRow } from "../../components/AdminConsoleV2";
import { supabase } from "@/integrations/supabase/client";

interface TemplateRow extends AdminRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  category: string;
  thumbnail_url: string | null;
  is_public: boolean;
  use_count: number;
  created_at: string;
  profiles?: { email: string | null; display_name: string | null } | null;
}

export default function AdminTemplatesAdminPage() {
  return (
    <AdminPageShell
      eyebrow="11 // CONTENT"
      code="TPL"
      title="Templates"
      italic="Library."
      description="Every project template across the user base — promote good ones to public, retire low-quality."
    >
      <AdminConsoleV2<TemplateRow>
        intro="Audit every template. Public ones are discoverable; private ones live only with their author."
        query={{
          table: "project_templates",
          select: "id, user_id, name, description, category, thumbnail_url, is_public, use_count, created_at, profiles(email, display_name)",
          orderBy: { column: "use_count", ascending: false },
        }}
        searchKey="name"
        filters={[
          { key: "category", label: "Category", type: "select", options: [
            { value: "commercial", label: "Commercial" }, { value: "cinematic", label: "Cinematic" },
            { value: "social", label: "Social" }, { value: "educational", label: "Educational" },
            { value: "general", label: "General" }] },
        ]}
        signals={[
          { label: "Total", value: (r) => r.length, tone: "blue" },
          { label: "Public", value: (r) => r.filter((x) => (x as TemplateRow).is_public).length, tone: "emerald" },
          { label: "Total uses",
            value: (r) => r.reduce((s, x) => s + ((x as TemplateRow).use_count ?? 0), 0).toLocaleString(),
            tone: "amber" },
          { label: "Unused", value: (r) => r.filter((x) => (x as TemplateRow).use_count === 0).length, tone: "neutral" },
        ]}
        columns={[
          { key: "thumbnail_url", label: "", width: "64px",
            render: (v) => v
              ? <img src={String(v)} alt="" className="w-12 h-8 rounded-md object-cover border border-white/[0.06]" />
              : <div className="w-12 h-8 rounded-md bg-white/[0.03] border border-white/[0.06]" /> },
          { key: "name", label: "Name" },
          { key: "category", label: "Category", width: "130px" },
          { key: "profiles", label: "Author", width: "200px",
            render: (_, row) => row.profiles?.email ?? row.user_id.slice(0, 8) },
          { key: "use_count", label: "Uses", width: "80px", align: "right" },
          { key: "is_public", label: "Public", width: "100px" },
        ]}
        actions={[
          { label: "Toggle public", icon: Power,
            onRun: async (r) => {
              const { error } = await supabase.from("project_templates").update({ is_public: !r.is_public }).eq("id", r.id);
              if (error) throw error;
            }},
          { label: "Delete", icon: Trash2, variant: "destructive", confirm: "Delete this template? The author keeps their projects but loses the template.",
            onRun: async (r) => {
              const { error } = await supabase.from("project_templates").delete().eq("id", r.id);
              if (error) throw error;
            }},
        ]}
        emptyTitle="No templates yet"
        emptyDescription="When users save templates they appear here for global oversight and promotion."
      />
    </AdminPageShell>
  );
}
