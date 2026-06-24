/** Gallery curation — manage what shows on the public /gallery surface. */
import { useState } from "react";
import { Image as ImageIcon, Plus, Power, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleV2, type AdminRow } from "../../components/AdminConsoleV2";
import { AdminDialog, AdminField, inputClass } from "../../components/AdminFormPrimitives";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ShowcaseRow extends AdminRow {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  category: "text-to-video" | "image-to-video" | "avatar";
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export default function AdminGalleryCurationPage() {
  const [creating, setCreating] = useState(false);
  return (
    <AdminPageShell
      eyebrow="11 // CONTENT"
      code="GAL"
      title="Gallery"
      italic="Curation."
      description="What shows on the public /gallery — order, feature, and retire entries."
    >
      <AdminConsoleV2<ShowcaseRow>
        intro="Curate the public reel. Sort order controls first-impression placement; active toggles visibility."
        query={{ table: "gallery_showcase", orderBy: { column: "sort_order", ascending: true } }}
        searchKey="title"
        filters={[
          { key: "category", label: "Category", type: "select", options: [
            { value: "text-to-video", label: "Text to video" },
            { value: "image-to-video", label: "Image to video" },
            { value: "avatar", label: "Avatar" }] },
        ]}
        signals={[
          { label: "Total", value: (r) => r.length, tone: "blue" },
          { label: "Active", value: (r) => r.filter((x) => (x as ShowcaseRow).is_active).length, tone: "emerald" },
          { label: "Hidden", value: (r) => r.filter((x) => !(x as ShowcaseRow).is_active).length, tone: "neutral" },
          { label: "Avatars", value: (r) => r.filter((x) => (x as ShowcaseRow).category === "avatar").length, tone: "amber" },
        ]}
        columns={[
          { key: "thumbnail_url", label: "", width: "64px",
            render: (v) => v
              ? <img src={String(v)} alt="" className="w-12 h-8 rounded-md object-cover border border-[#e7ebf3]" />
              : <div className="w-12 h-8 rounded-md bg-glass border border-[#e7ebf3]" /> },
          { key: "title", label: "Title" },
          { key: "category", label: "Category", width: "140px" },
          { key: "sort_order", label: "Order", width: "80px", align: "right" },
          { key: "is_active", label: "Status", width: "100px" },
        ]}
        actions={[
          { label: "Up", icon: ArrowUp,
            onRun: async (r) => {
              const { error } = await supabase.from("gallery_showcase").update({ sort_order: Math.max(0, r.sort_order - 1) }).eq("id", r.id);
              if (error) throw error;
            }},
          { label: "Down", icon: ArrowDown,
            onRun: async (r) => {
              const { error } = await supabase.from("gallery_showcase").update({ sort_order: r.sort_order + 1 }).eq("id", r.id);
              if (error) throw error;
            }},
          { label: "Toggle", icon: Power,
            onRun: async (r) => {
              const { error } = await supabase.from("gallery_showcase").update({ is_active: !r.is_active }).eq("id", r.id);
              if (error) throw error;
            }},
          { label: "Delete", icon: Trash2, variant: "destructive", confirm: "Delete this gallery entry?",
            onRun: async (r) => {
              const { error } = await supabase.from("gallery_showcase").delete().eq("id", r.id);
              if (error) throw error;
            }},
        ]}
        primaryCta={{ label: "Add entry", onClick: () => setCreating(true) }}
        emptyTitle="No gallery entries yet"
        emptyDescription="Add a video to feature it on the public /gallery surface."
      >
        {creating && <CreateShowcase onClose={() => setCreating(false)} />}
      </AdminConsoleV2>
    </AdminPageShell>
  );
}

function CreateShowcase({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [category, setCategory] = useState<"text-to-video" | "image-to-video" | "avatar">("text-to-video");
  const [sortOrder, setSortOrder] = useState(0);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim() || !videoUrl.trim()) { toast.error("Title and video URL required"); return; }
    setBusy(true);
    const { error } = await supabase.from("gallery_showcase").insert({
      title, description: description || null, video_url: videoUrl,
      thumbnail_url: thumbnailUrl || null, category, sort_order: sortOrder,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Gallery entry added");
    onClose();
  };

  return (
    <AdminDialog title="Add gallery entry" icon={Plus} onClose={onClose} onSubmit={submit} busy={busy} submitLabel="Add">
      <AdminField label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} /></AdminField>
      <AdminField label="Description"><input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} /></AdminField>
      <AdminField label="Video URL"><input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} className={inputClass} placeholder="https://…/video.mp4" /></AdminField>
      <AdminField label="Thumbnail URL"><input value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} className={inputClass} /></AdminField>
      <div className="grid grid-cols-2 gap-3">
        <AdminField label="Category"><select value={category} onChange={(e) => setCategory(e.target.value as any)} className={inputClass}>
          <option value="text-to-video">Text to video</option><option value="image-to-video">Image to video</option><option value="avatar">Avatar</option>
        </select></AdminField>
        <AdminField label="Sort order" hint="Lower = earlier"><input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} className={inputClass} /></AdminField>
      </div>
    </AdminDialog>
  );
}
