/**
 * AdminCommentsPage — comment moderation.
 *
 * Recent comments across projects (project_comments — heavily written by the
 * app) with real author identity (joined from profiles) and a remove action for
 * abuse/spam. Admin delete is now enforced by an RLS policy
 * (20260703000000_admin_moderate_comments.sql) — previously RLS only allowed
 * self-delete, so removing another user's comment silently no-op'd.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageSquare, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AdminPageShell } from "../../components/AdminPageShell";
import { FloatSection, FloatTable, Avatar, ROSE } from "@/admin/ui/primitives";

interface Comment {
  id: string;
  content: string | null;
  user_id: string | null;
  project_id: string | null;
  likes_count: number | null;
  created_at: string | null;
}

function State({ kind, title, hint }: { kind: "loading" | "error" | "empty"; title: string; hint?: string }) {
  const Icon = kind === "loading" ? Loader2 : kind === "error" ? AlertTriangle : MessageSquare;
  const color = kind === "error" ? "hsl(350 90% 70%)" : "rgba(255,255,255,0.25)";
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <Icon className={`h-7 w-7 ${kind === "loading" ? "animate-spin" : ""}`} style={{ color }} />
      <p className="text-[15px] text-white/70">{title}</p>
      {hint && <p className="max-w-md text-[12px] text-white/40">{hint}</p>}
    </div>
  );
}

export default function AdminCommentsPage() {
  const [rows, setRows] = useState<Comment[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const { data, error: e } = await supabase
      .from("project_comments")
      .select("id,content,user_id,project_id,likes_count,created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (e) { setError(e.message); setLoading(false); return; }
    const list = (data as Comment[]) ?? [];
    setRows(list);
    // Resolve real author identity.
    const ids = Array.from(new Set(list.map((c) => c.user_id).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, display_name, username").in("id", ids);
      const map: Record<string, string> = {};
      for (const p of (profs as any[]) ?? []) map[p.id] = p.display_name || p.username || p.email?.split("@")[0] || p.id.slice(0, 8);
      setNames(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const remove = useCallback(async (c: Comment) => {
    const prev = rows;
    setRows((r) => r.filter((x) => x.id !== c.id)); // optimistic
    const { error: e, count } = await supabase.from("project_comments").delete({ count: "exact" }).eq("id", c.id);
    if (e) { setRows(prev); toast.error("Couldn't remove comment", { description: e.message }); }
    else if (count === 0) { setRows(prev); toast.error("Not removed — admin delete policy may not be applied yet"); }
    else toast.success("Comment removed");
  }, [rows]);

  const last24h = useMemo(() => {
    const since = Date.now() - 86400_000;
    return rows.filter((c) => c.created_at && new Date(c.created_at).getTime() >= since).length;
  }, [rows]);
  const totalLikes = useMemo(() => rows.reduce((a, c) => a + (c.likes_count ?? 0), 0), [rows]);

  return (
    <AdminPageShell
      eyebrow="07 // TRUST & SAFETY"
      code="CMT"
      title="Comments"
      italic="Moderation."
      description="Triage the discussion layer — recent comments across projects with author context. Remove abuse or spam."
      stats={[
        { label: "Comments · recent", value: rows.length.toLocaleString(), tone: "blue" },
        { label: "Last 24h", value: last24h.toLocaleString(), tone: "amber" },
        { label: "Total likes", value: totalLikes.toLocaleString(), tone: "emerald" },
      ]}
    >
      {error ? (
        <State kind="error" title="Couldn't load comments" hint={error} />
      ) : loading ? (
        <State kind="loading" title="Loading comments…" />
      ) : rows.length === 0 ? (
        <State kind="empty" title="No comments yet" hint="User comments across projects appear here for moderation." />
      ) : (
        <FloatSection title="Recent comments" meta={`${rows.length} shown`}>
          <FloatTable
            columns={[
              { key: "author", label: "Author" },
              { key: "content", label: "Comment" },
              { key: "likes", label: "Likes", align: "right" },
              { key: "when", label: "When", align: "right" },
              { key: "act", label: "", align: "right" },
            ]}
            rows={rows.map((c) => ({
              _key: c.id,
              author: (
                <span className="inline-flex items-center gap-2">
                  <Avatar name={names[c.user_id ?? ""] ?? "?"} size={22} />
                  <span className="text-white/80">{names[c.user_id ?? ""] ?? (c.user_id ? c.user_id.slice(0, 8) : "—")}</span>
                </span>
              ),
              content: <span className="block max-w-[34rem] truncate text-white/75" title={c.content ?? ""}>{c.content || "—"}</span>,
              likes: <span className="text-white/70">{(c.likes_count ?? 0).toLocaleString()}</span>,
              when: <span className="text-white/45">{c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}</span>,
              act: (
                <button
                  type="button"
                  onClick={() => void remove(c)}
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors"
                  style={{ color: ROSE, background: "hsl(350 90% 70% / 0.12)" }}
                >
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              ),
            }))}
            empty="No comments yet."
          />
        </FloatSection>
      )}
    </AdminPageShell>
  );
}
