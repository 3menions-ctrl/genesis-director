/** Avatar catalog — featured + enabled CRUD on avatar_catalog_entries. */
import { useState } from "react";
import { Star, Power, Plus, Trash2 } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleV2, type AdminRow } from "../../components/AdminConsoleV2";
import { AdminDialog, AdminField, inputClass } from "../../components/AdminFormPrimitives";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AvatarRow extends AdminRow {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  thumbnail_url: string | null;
  preview_video_url: string | null;
  featured: boolean;
  enabled: boolean;
  rank: number;
  created_at: string;
}

export default function AdminAvatarCatalogPage() {
  const [creating, setCreating] = useState(false);
  return (
    <AdminPageShell
      eyebrow="11 // CONTENT"
      code="AVC"
      title="Avatar"
      italic="Catalog."
      description="Featured cast members on the public Avatars gallery — order, feature, retire."
    >
      <AdminConsoleV2<AvatarRow>
        intro="Promote the avatars users see first. Featured rises to the top of the gallery; disabled hides without deletion."
        query={{ table: "avatar_catalog_entries", orderBy: { column: "rank", ascending: true } }}
        searchKey="name"
        searchPlaceholder="Search by name…"
        signals={[
          { label: "Total", value: (r) => r.length, tone: "blue" },
          { label: "Enabled", value: (r) => r.filter((x) => (x as AvatarRow).enabled).length, tone: "emerald" },
          { label: "Featured", value: (r) => r.filter((x) => (x as AvatarRow).featured).length, tone: "amber" },
          { label: "Hidden", value: (r) => r.filter((x) => !(x as AvatarRow).enabled).length, tone: "neutral" },
        ]}
        columns={[
          { key: "thumbnail_url", label: "", width: "64px",
            render: (v) => v
              ? <img src={String(v)} alt="" className="w-10 h-10 rounded-lg object-cover border border-white/[0.06]" />
              : <div className="w-10 h-10 rounded-lg bg-white/[0.03] border border-white/[0.06]" /> },
          { key: "name", label: "Name", width: "200px" },
          { key: "slug", label: "Slug", width: "180px",
            render: (v) => <code className="font-mono text-[11px] text-white/55">{String(v)}</code> },
          { key: "category", label: "Category", width: "140px" },
          { key: "rank", label: "Rank", width: "70px", align: "right" },
          { key: "featured", label: "Featured", width: "100px" },
          { key: "enabled", label: "Enabled", width: "100px" },
        ]}
        actions={[
          { label: "Feature", icon: Star, onRun: async (r) => {
            const { error } = await supabase.from("avatar_catalog_entries").update({ featured: !r.featured }).eq("id", r.id);
            if (error) throw error;
          }},
          { label: "Toggle", icon: Power, onRun: async (r) => {
            const { error } = await supabase.from("avatar_catalog_entries").update({ enabled: !r.enabled }).eq("id", r.id);
            if (error) throw error;
          }},
          { label: "Delete", icon: Trash2, variant: "destructive", confirm: "Delete this avatar from the catalog?",
            onRun: async (r) => {
              const { error } = await supabase.from("avatar_catalog_entries").delete().eq("id", r.id);
              if (error) throw error;
            }},
        ]}
        primaryCta={{ label: "Add avatar", onClick: () => setCreating(true) }}
        emptyTitle="No avatars in the catalog"
        emptyDescription="Add an avatar with name, slug, and thumbnail to feature it on the public gallery."
      >
        {creating && <CreateAvatar onClose={() => setCreating(false)} />}
      </AdminConsoleV2>
    </AdminPageShell>
  );
}

function CreateAvatar({ onClose }: { onClose: () => void }) {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [previewVideoUrl, setPreviewVideoUrl] = useState("");
  const [rank, setRank] = useState(0);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!slug.trim() || !name.trim()) { toast.error("Slug and name required"); return; }
    setBusy(true);
    const { error } = await supabase.from("avatar_catalog_entries").insert({
      slug, name, category: category || null,
      thumbnail_url: thumbnailUrl || null, preview_video_url: previewVideoUrl || null,
      rank,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Avatar added");
    onClose();
  };

  return (
    <AdminDialog title="Add avatar" icon={Plus} onClose={onClose} onSubmit={submit} busy={busy} submitLabel="Add">
      <AdminField label="Name"><input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} /></AdminField>
      <AdminField label="Slug"><input value={slug} onChange={(e) => setSlug(e.target.value)} className={inputClass} placeholder="hoppy-classic" /></AdminField>
      <AdminField label="Category"><input value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass} placeholder="presenter" /></AdminField>
      <AdminField label="Thumbnail URL"><input value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} className={inputClass} /></AdminField>
      <AdminField label="Preview video URL"><input value={previewVideoUrl} onChange={(e) => setPreviewVideoUrl(e.target.value)} className={inputClass} /></AdminField>
      <AdminField label="Rank" hint="Lower = appears earlier"><input type="number" value={rank} onChange={(e) => setRank(Number(e.target.value))} className={inputClass} /></AdminField>
    </AdminDialog>
  );
}
