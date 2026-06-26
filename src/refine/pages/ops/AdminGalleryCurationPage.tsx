/** Gallery curation — manage what shows on the public /gallery surface. */
import { useState } from "react";
import { Image as ImageIcon, Plus, Power, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleV2, type AdminRow } from "../../components/AdminConsoleV2";
import { AdminDialog, AdminField, inputClass } from "../../components/AdminFormPrimitives";
import { FloatSection } from "@/admin/ui/primitives";
import { Donut, countBy, CYAN } from "@/admin/ui/charts";
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

/**
 * Move an entry one slot up/down by SWAPPING sort_order with its neighbour in the
 * sorted list — not by nudging a single row ±1 (which collides into duplicate
 * sort_order values and fails to actually reorder). Operates on the real ordered
 * set so the move is stable regardless of gaps in the sequence.
 */
async function swapOrder(id: string, dir: "up" | "down") {
  const { data, error } = await supabase
    .from("gallery_showcase")
    .select("id, sort_order")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  const list = (data ?? []) as { id: string; sort_order: number }[];
  const idx = list.findIndex((x) => x.id === id);
  if (idx === -1) return;
  const neighbour = dir === "up" ? list[idx - 1] : list[idx + 1];
  if (!neighbour) return; // already at the edge — no-op
  const current = list[idx];
  // Two-step swap of the two rows' sort_order values.
  const r1 = await supabase.from("gallery_showcase").update({ sort_order: neighbour.sort_order }).eq("id", current.id);
  if (r1.error) throw r1.error;
  const r2 = await supabase.from("gallery_showcase").update({ sort_order: current.sort_order }).eq("id", neighbour.id);
  if (r2.error) throw r2.error;
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
          { key: "is_active", label: "Status", type: "select", options: [
            { value: "true", label: "Active" },
            { value: "false", label: "Hidden" }] },
        ]}
        signals={[
          { label: "Total", value: (r) => r.length, tone: "blue" },
          { label: "Active", value: (r) => r.filter((x) => (x as ShowcaseRow).is_active).length, tone: "emerald" },
          { label: "Hidden", value: (r) => r.filter((x) => !(x as ShowcaseRow).is_active).length, tone: "neutral" },
          { label: "Avatars", value: (r) => r.filter((x) => (x as ShowcaseRow).category === "avatar").length, tone: "amber" },
        ]}
        charts={(rows) => {
          const data = rows as ShowcaseRow[];
          const byCategory = countBy(data, (r) => r.category);
          const status = [
            { key: "Active", value: data.filter((r) => r.is_active).length, color: CYAN },
            { key: "Hidden", value: data.filter((r) => !r.is_active).length, color: "rgba(255,255,255,0.22)" },
          ];
          return (
            <div className="grid grid-cols-1 gap-x-14 gap-y-14 lg:grid-cols-2">
              <FloatSection title="By category" meta={`${data.length} entries`}>
                <Donut data={byCategory} centerLabel="entries" />
              </FloatSection>
              <FloatSection title="Visibility" meta="active vs hidden">
                <Donut data={status} centerLabel="entries" />
              </FloatSection>
            </div>
          );
        }}
        columns={[
          { key: "thumbnail_url", label: "", width: "64px",
            render: (v) => v
              ? <img src={String(v)} alt="" className="w-12 h-8 rounded-md object-cover border border-white/[0.06]" />
              : <div className="w-12 h-8 rounded-md bg-glass border border-white/[0.06]" /> },
          { key: "title", label: "Title" },
          { key: "category", label: "Category", width: "140px" },
          { key: "sort_order", label: "Order", width: "80px", align: "right" },
          { key: "is_active", label: "Status", width: "100px" },
        ]}
        actions={[
          // LOGIC FIX AD-12: swap sort_order with the adjacent row instead of
          // ±1 on one row (which produced duplicate sort_orders → undefined
          // ordering). Find the neighbor and exchange the two values.
          { label: "Up", icon: ArrowUp,
            onRun: async (r) => { await swapOrder(r.id, "up"); }},
          { label: "Down", icon: ArrowDown,
            onRun: async (r) => { await swapOrder(r.id, "down"); }},
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
