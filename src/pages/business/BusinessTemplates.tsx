/**
 * BusinessTemplates — /business/templates
 *
 * Reusable scene scripts, style presets and brand-locked layouts the team can
 * launch from. Reuses the same org_templates queries/inserts/deletes as
 * WorkspaceTemplates, re-skinned in the cover-hero BusinessPage language with a
 * templates grid plus inline create + delete.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LayoutTemplate, Plus, Trash2, X, Sparkles, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getAllBreakthroughTemplates,
  CONTAINER_LABELS,
  BOUNDARY_VIOLATION_LABELS,
  DESTINATION_LABELS,
} from "@/lib/templates/breakthrough";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import { confirmAsync } from "@/components/ui/global-confirm";
import { BusinessPage, StatCard, SectionHead } from "@/components/business/BusinessPage";
import { GlassPanel } from "@/components/foundation/Floating";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";
import { toast } from "sonner";
import { safeErrorMessage } from "@/lib/safeErrorMessage";

interface TplRow {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  use_count: number;
  created_at: string;
}

export default function BusinessTemplates() {
  usePageMeta({ title: "Templates — Business" });

  const { currentOrg, hasPermission } = useWorkspace();
  const { user } = useAuth();
  const canCreate = hasPermission("producer");
  const canDelete = hasPermission("admin");
  const [rows, setRows] = useState<TplRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    const { data } = await supabase
      .from("org_templates")
      .select("id, name, description, category, use_count, created_at")
      .eq("organization_id", currentOrg.id)
      .order("created_at", { ascending: false });
    setRows((data ?? []) as TplRow[]);
    setLoading(false);
  }, [currentOrg?.id]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!currentOrg || !user || !name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("org_templates").insert({
      organization_id: currentOrg.id,
      created_by: user.id,
      name: name.trim(),
      description: description.trim() || null,
      category: category.trim() || null,
      config: {},
    });
    setSaving(false);
    if (error) { toast.error(safeErrorMessage(error, "Couldn't save template.")); return; }
    toast.success("Template saved");
    setOpen(false); setName(""); setDescription(""); setCategory("");
    load();
  };

  const remove = async (row: TplRow) => {
    if (!await confirmAsync(`Delete template "${row.name}"?`)) return;
    const { error } = await supabase.from("org_templates").delete().eq("id", row.id);
    if (error) { toast.error(safeErrorMessage(error, "Couldn't delete template.")); return; }
    toast.success("Template deleted");
    load();
  };

  const totalUses = rows.reduce((sum, r) => sum + (r.use_count ?? 0), 0);

  // Built-in Breakthrough Effects catalogue (container × violation × destination).
  const effects = useMemo(() => getAllBreakthroughTemplates(), []);

  return (
    <BusinessPage
      eyebrow={<><span className="text-[hsl(215,100%,72%)]">Operate</span><span className="text-white/20">·</span><span>Reusable layouts</span></>}
      title="Templates."
      subtitle="A shared library of named scene scripts, style presets and brand-locked layouts your team can reference."
      actions={canCreate ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-full px-5 h-11 bg-[hsl(215,90%,55%)] text-white text-[13px] font-medium hover:bg-[hsl(215,90%,60%)] transition-colors"
        >
          <Plus className="w-4 h-4" strokeWidth={1.8} /> New template
        </button>
      ) : (
        <span className="inline-flex items-center px-3 h-9 rounded-full text-[10px] font-mono uppercase tracking-[0.16em] ring-1 ring-white/[0.07] text-white/45">
          Read only
        </span>
      )}
    >
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Templates" value={loading ? "—" : rows.length} />
        <StatCard label="Total uses" value={loading ? "—" : totalUses} accent />
        <StatCard label="Categories" value={loading ? "—" : new Set(rows.map((r) => r.category).filter(Boolean)).size} />
      </div>

      {/* ── Built-in Breakthrough Effects (read-only, launchable) ── */}
      <SectionHead label="Breakthrough effects" count={effects.length} />
      <p className="-mt-2 mb-1 text-[12.5px] text-white/45 font-light">
        Cinematic 4th-wall effects — a subject breaks out of a container into the scene. Open one in the studio to generate.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {effects.map((def) => (
          <Link
            key={def.id}
            to={`/create?template=${def.id}`}
            className="group relative rounded-2xl overflow-hidden transition-all"
          >
            <div className="aspect-[4/3] overflow-hidden bg-black/40">
              {def.thumbnailUrl && (
                <img
                  src={def.thumbnailUrl}
                  alt=""
                  className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-[1.03] transition-all duration-500"
                />
              )}
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[hsl(215,100%,72%)] shrink-0" strokeWidth={1.6} />
                <span className="text-[15px] text-white font-light tracking-[-0.01em] truncate">{def.name}</span>
              </div>
              <div className={cn(TYPE_META, "mt-1.5 text-[hsl(215,100%,72%)]")}>
                {CONTAINER_LABELS[def.container.kind]} · {BOUNDARY_VIOLATION_LABELS[def.boundaryViolation]} · {DESTINATION_LABELS[def.destination]}
              </div>
              <p className="mt-2 text-[12px] text-white/55 font-light line-clamp-2">{def.description}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-[12px] text-white/60 group-hover:text-white transition-colors">
                Open in studio <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
          </Link>
        ))}
      </div>

      <SectionHead label="Library" count={loading ? undefined : rows.length} />
      {loading ? (
        <div className="flex items-center gap-3 py-16 text-white/50"><Spinner size="sm" tone="muted" /><span className={cn(TYPE_META)}>Loading…</span></div>
      ) : rows.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <span className="inline-flex w-14 h-14 items-center justify-center rounded-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.015]"><LayoutTemplate className="w-6 h-6 text-[hsl(215,100%,72%)]" strokeWidth={1.4} /></span>
          <h3 className="mt-5 font-display italic font-light text-[22px] text-white tracking-[-0.01em]">No templates yet.</h3>
          <p className="mt-2 text-[13px] text-white/55">Save a named template so the team has a shared reference for production setups.</p>
          {canCreate && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-6 inline-flex items-center gap-2 rounded-full px-5 h-11 bg-[hsl(215,90%,55%)] text-white text-[13px] font-medium hover:bg-[hsl(215,90%,60%)] transition-colors"
            >
              <Plus className="w-4 h-4" strokeWidth={1.8} /> New template
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((r) => (
            <div key={r.id} className="group relative rounded-2xl transition-all p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-gradient-to-br from-white/[0.08] to-white/[0.015] shrink-0">
                    <LayoutTemplate className="w-4.5 h-4.5 text-[hsl(215,100%,72%)]" strokeWidth={1.6} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[15px] text-white font-light tracking-[-0.01em] truncate">{r.name}</div>
                    {r.category && <div className={cn(TYPE_META, "mt-0.5 text-[hsl(215,100%,72%)]")}>{r.category}</div>}
                  </div>
                </div>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => remove(r)}
                    className="p-1.5 rounded-lg text-white/35 hover:text-[hsl(0,80%,76%)] hover:bg-white/[0.06] transition opacity-0 group-hover:opacity-100"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {r.description && <p className="mt-4 text-[12.5px] text-white/55 font-light line-clamp-3">{r.description}</p>}
              <div className="relative mt-4 pt-3 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:content-[''] flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.16em] text-white/45">
                <span>{r.use_count} uses</span>
                <span>{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => !saving && setOpen(false)}>
          <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
          <GlassPanel className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display italic font-light text-[20px] text-white tracking-[-0.01em]">New template</h2>
              <button type="button" onClick={() => !saving && setOpen(false)} className="p-1 text-white/45 hover:text-white transition" aria-label="Close"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className={cn(TYPE_META, "text-white/45 mb-2 block")}>Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="E.g. 30-second product hero"
                  className="w-full h-11 px-4 rounded-xl bg-white/[0.04] ring-1 ring-white/[0.08] focus:ring-white/20 text-[14px] text-white placeholder:text-white/35 outline-none transition"
                />
              </div>
              <div>
                <label className={cn(TYPE_META, "text-white/45 mb-2 block")}>Category</label>
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Ads"
                  className="w-full h-11 px-4 rounded-xl bg-white/[0.04] ring-1 ring-white/[0.08] focus:ring-white/20 text-[14px] text-white placeholder:text-white/35 outline-none transition"
                />
                <p className="mt-1.5 text-[12px] text-white/40">Optional grouping like ‘Ads’, ‘Pitches’ or ‘Briefs’.</p>
              </div>
              <div>
                <label className={cn(TYPE_META, "text-white/45 mb-2 block")}>Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What this template is for…"
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.04] ring-1 ring-white/[0.08] focus:ring-white/20 text-[14px] text-white placeholder:text-white/35 outline-none transition resize-none"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={saving}
                className="inline-flex items-center px-4 h-10 rounded-full text-[13px] text-white/55 hover:text-white ring-1 ring-white/[0.07] hover:ring-white/15 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={create}
                disabled={saving || !name.trim()}
                className="inline-flex items-center px-5 h-10 rounded-full text-[13px] font-medium bg-[hsl(215,90%,55%)] text-white hover:bg-[hsl(215,90%,60%)] transition-colors disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save template"}
              </button>
            </div>
          </GlassPanel>
          </div>
        </div>
      )}
    </BusinessPage>
  );
}
