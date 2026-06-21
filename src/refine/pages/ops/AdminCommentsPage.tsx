/**
 * AdminCommentsPage — comment moderation.
 *
 * Surfaces recent user comments (project_comments) with author/target context
 * and a remove action, so the admin can triage abuse/spam in the discussion
 * layer (the existing moderation page covers projects/reels, not comments).
 * Built on the premium admin primitives. Delete is best-effort via RLS; a
 * dedicated admin_moderate_comment RPC would harden it further.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageSquare, Clock, Heart, Trash2 } from "lucide-react";
import { createColumnHelper } from "@tanstack/react-table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AdminPageHeader, KpiTile, accent, ROSE } from "@/admin/ui/primitives";
import { DataTable } from "@/admin/ui/DataTable";

interface Comment {
  id: string;
  content: string | null;
  user_id: string | null;
  project_id: string | null;
  likes_count: number | null;
  created_at: string | null;
}

const col = createColumnHelper<Comment>();

export default function AdminCommentsPage() {
  const [rows, setRows] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("project_comments")
      .select("id,content,user_id,project_id,likes_count,created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    setRows((data as Comment[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const remove = useCallback(async (c: Comment) => {
    const prev = rows;
    setRows((r) => r.filter((x) => x.id !== c.id)); // optimistic
    const { error } = await supabase.from("project_comments").delete().eq("id", c.id);
    if (error) { setRows(prev); toast.error("Couldn't remove comment", { description: error.message }); }
    else toast.success("Comment removed");
  }, [rows]);

  const last24h = useMemo(() => {
    const since = Date.now() - 86400_000;
    return rows.filter((c) => c.created_at && new Date(c.created_at).getTime() >= since).length;
  }, [rows]);

  const columns = useMemo(() => [
    col.accessor("content", { header: "Comment", cell: (c) => (
      <span className="block max-w-[420px] truncate text-white/85" title={c.getValue() ?? ""}>{c.getValue() || "—"}</span>
    ) }),
    col.accessor("user_id", { header: "Author", cell: (c) => <span className="font-mono text-[12px] text-white/45">{(c.getValue() ?? "").slice(0, 8) || "—"}</span> }),
    col.accessor("project_id", { header: "On project", cell: (c) => <span className="font-mono text-[12px] text-white/45">{(c.getValue() ?? "").slice(0, 8) || "—"}</span> }),
    col.accessor("likes_count", { header: "Likes", cell: (c) => <span className="tabular-nums">{c.getValue() ?? 0}</span> }),
    col.accessor("created_at", { header: "When", cell: (c) => <span className="text-white/55">{c.getValue() ? new Date(c.getValue()!).toLocaleString() : "—"}</span> }),
    col.display({ id: "actions", header: "", cell: (c) => (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); void remove(c.row.original); }}
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors"
        style={{ color: ROSE, background: "hsl(350 90% 70% / 0.12)" }}
      >
        <Trash2 className="h-3 w-3" /> Remove
      </button>
    ) }),
  ], [remove]);

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-8">
      <AdminPageHeader eyebrow="Trust & safety" title={<>Comment <span className="italic">moderation</span>.</>} sub="Triage the discussion layer — recent comments across projects, with author and target context. Remove abuse or spam." />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
        <KpiTile index={0} label="Comments (recent)" value={rows.length} icon={MessageSquare} />
        <KpiTile index={1} label="Last 24h" value={last24h} icon={Clock} accentNumber />
        <KpiTile index={2} label="Total likes" value={rows.reduce((a, c) => a + (c.likes_count ?? 0), 0)} icon={Heart} />
      </div>

      {loading ? (
        <div className="py-20 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-white/40" style={{ color: accent(0.7) }}>Loading comments…</div>
      ) : (
        <DataTable columns={columns as never} data={rows} empty="No comments yet." />
      )}
    </div>
  );
}
