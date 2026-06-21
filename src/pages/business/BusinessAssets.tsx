/**
 * BusinessAssets — /business/assets
 *
 * The shared brand-asset library for the workspace, org-scoped. A premium,
 * media-forward library: KPI row, a prominent drag-and-drop ingest zone, kind
 * facet filters + name search, and an image-first media grid. Reuses the exact
 * organization_brand_assets query, brand-assets storage bucket, and
 * upload/delete logic — only the surface is re-skinned in the BusinessPage
 * cover-hero language.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Upload, Image as ImageIcon, Trash2, FileText, Type, Box, ExternalLink, Search, Layers } from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ListPagination, usePagination } from "@/components/ui/list-pagination";
import { confirmAsync } from "@/components/ui/global-confirm";
import { usePageMeta } from "@/hooks/usePageMeta";
import { BusinessPage, StatCard, SectionHead, Badge, EmptyState, StaggerList, StaggerItem, SkeletonCards } from "@/components/business/BusinessPage";
import { ChartCard, DonutChart, ChartLegend, CHART_SERIES } from "@/components/business/BusinessCharts";
import { Spinner } from "@/components/ui/Spinner";
import { TYPE_META } from "@/lib/design-system";

interface BrandAsset {
  id: string;
  organization_id: string;
  uploaded_by: string;
  kind: "logo" | "reference" | "font" | "document" | "other";
  name: string;
  storage_path: string;
  public_url: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

type Kind = BrandAsset["kind"];
const KIND_ORDER: Kind[] = ["logo", "reference", "font", "document", "other"];

const KIND_META: Record<Kind, { label: string; Icon: typeof ImageIcon; color: string }> = {
  logo:      { label: "Logo",      Icon: Box,       color: CHART_SERIES[0] },
  reference: { label: "Reference", Icon: ImageIcon, color: CHART_SERIES[1] },
  font:      { label: "Font",      Icon: Type,      color: CHART_SERIES[2] },
  document:  { label: "Document",  Icon: FileText,  color: CHART_SERIES[3] },
  other:     { label: "Other",     Icon: Box,       color: CHART_SERIES[4] },
};

// Checkered tile so transparent logos / PNGs read cleanly.
const CHECKER: React.CSSProperties = {
  backgroundColor: "#08080c",
  backgroundImage:
    "linear-gradient(45deg, rgba(255,255,255,0.035) 25%, transparent 25%)," +
    "linear-gradient(-45deg, rgba(255,255,255,0.035) 25%, transparent 25%)," +
    "linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.035) 75%)," +
    "linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.035) 75%)",
  backgroundSize: "18px 18px",
  backgroundPosition: "0 0, 0 9px, 9px -9px, -9px 0px",
};

function detectKind(file: File): Kind {
  const t = file.type.toLowerCase();
  const n = file.name.toLowerCase();
  if (t.startsWith("image/") && (n.includes("logo") || n.includes("mark") || n.includes("wordmark"))) return "logo";
  if (t.startsWith("image/")) return "reference";
  if (n.match(/\.(ttf|otf|woff2?|eot)$/)) return "font";
  if (t.startsWith("application/") || t === "text/plain") return "document";
  return "other";
}

function humanizeBytes(bytes: number): string {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function BusinessAssets() {
  usePageMeta({ title: "Assets — Business" });

  const { currentOrg, hasPermission } = useWorkspace();
  const { user } = useAuth();
  const canUpload = hasPermission("producer");
  const canDelete = hasPermission("admin");
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [kindFilter, setKindFilter] = useState<Kind | "all">("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    const { data, error } = await (supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            order: (c: string, o: { ascending: boolean }) => Promise<{ data: unknown; error: { message: string } | null }>;
          };
        };
      };
    })
      .from("organization_brand_assets")
      .select("*")
      .eq("organization_id", currentOrg.id)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) { toast.error("Failed to load assets"); return; }
    setAssets((data ?? []) as BrandAsset[]);
  }, [currentOrg]);

  useEffect(() => { void load(); }, [load]);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || !currentOrg || !user) return;
    setUploading(true);
    let success = 0, failed = 0;
    for (const file of Array.from(files)) {
      try {
        if (file.size > 20 * 1024 * 1024) { toast.error(`${file.name}: max 20 MB`); failed++; continue; }
        const kind = detectKind(file);
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${currentOrg.id}/${kind}/${Date.now()}_${safeName}`;
        const { error: upErr } = await supabase.storage.from("brand-assets").upload(path, file, {
          cacheControl: "31536000", upsert: false,
        });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("brand-assets").getPublicUrl(path);
        const { error: rowErr } = await (supabase as unknown as {
          from: (t: string) => { insert: (v: Record<string, unknown>) => Promise<{ error: { message: string } | null }> };
        }).from("organization_brand_assets").insert({
          organization_id: currentOrg.id,
          uploaded_by: user.id,
          kind, name: file.name, storage_path: path,
          public_url: pub.publicUrl, mime_type: file.type, size_bytes: file.size,
        });
        if (rowErr) throw rowErr;
        success++;
      } catch (e) {
        console.error("[assets] upload failed", e);
        failed++;
      }
    }
    setUploading(false);
    if (success) toast.success(`Ingested ${success} asset${success > 1 ? "s" : ""}`);
    if (failed)  toast.error(`${failed} file${failed > 1 ? "s" : ""} failed`);
    void load();
  }, [currentOrg, user, load]);

  const remove = async (asset: BrandAsset) => {
    if (!await confirmAsync(`Purge "${asset.name}"? This cannot be undone.`)) return;
    const { error: stErr } = await supabase.storage.from("brand-assets").remove([asset.storage_path]);
    if (stErr) console.warn("[assets] storage remove warning:", stErr.message);
    const { error } = await (supabase as unknown as {
      from: (t: string) => { delete: () => { eq: (k: string, v: string) => Promise<{ error: { message: string } | null }> } };
    }).from("organization_brand_assets").delete().eq("id", asset.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Asset purged");
    void load();
  };

  // Drag-and-drop → existing uploader.
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (!canUpload || uploading) return;
    void handleFiles(e.dataTransfer.files);
  }, [canUpload, uploading, handleFiles]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (canUpload && !uploading) setDragActive(true);
  }, [canUpload, uploading]);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────
  const kindCounts = useMemo(() => {
    const m: Record<Kind, number> = { logo: 0, reference: 0, font: 0, document: 0, other: 0 };
    for (const a of assets) m[a.kind] = (m[a.kind] ?? 0) + 1;
    return m;
  }, [assets]);

  const totalSize = useMemo(() => assets.reduce((t, a) => t + (a.size_bytes ?? 0), 0), [assets]);

  const topKind = useMemo(() => {
    let best: Kind | null = null, bestN = 0;
    for (const k of KIND_ORDER) if (kindCounts[k] > bestN) { best = k; bestN = kindCounts[k]; }
    return best ? { kind: best, count: bestN } : null;
  }, [kindCounts]);

  const donutData = useMemo(
    () => KIND_ORDER
      .filter((k) => kindCounts[k] > 0)
      .map((k) => ({ name: KIND_META[k].label, value: kindCounts[k], color: KIND_META[k].color })),
    [kindCounts],
  );

  const filtered = useMemo(() => {
    let r = assets;
    if (kindFilter !== "all") r = r.filter((a) => a.kind === kindFilter);
    const q = search.trim().toLowerCase();
    if (q) r = r.filter((a) => a.name.toLowerCase().includes(q));
    return r;
  }, [assets, kindFilter, search]);

  const { slice, page, setPage, totalPages, total, pageSize } = usePagination(filtered, 24);

  // Keep the visible page in range whenever the facet/search narrows the set.
  useEffect(() => { setPage(1); }, [kindFilter, search, setPage]);

  const facets: Array<{ key: Kind | "all"; label: string; count: number }> = [
    { key: "all", label: "All", count: assets.length },
    ...KIND_ORDER.map((k) => ({ key: k, label: KIND_META[k].label, count: kindCounts[k] })),
  ];

  return (
    <BusinessPage
      eyebrow={<><span className="text-[hsl(215,100%,72%)]">Operate</span><span className="text-white/20">·</span><span>Shared library</span></>}
      title="Assets."
      subtitle="Logos, reference images, fonts, and brand guidelines — distributed to every member of the workspace."
      actions={canUpload && (
        <label className={cn(
          "inline-flex items-center gap-2 rounded-full px-5 h-11 text-[13px] font-medium transition-colors cursor-pointer",
          uploading
            ? "bg-white/[0.04] text-white/40 ring-1 ring-white/[0.08] cursor-not-allowed"
            : "bg-[hsl(215,90%,55%)] text-white hover:bg-[hsl(215,90%,60%)]",
        )}>
          {uploading
            ? <><Spinner size="sm" tone="inherit" /> Ingesting…</>
            : <><Upload className="w-4 h-4" strokeWidth={1.8} /> Ingest files</>}
          <input
            type="file"
            multiple
            className="hidden"
            disabled={uploading}
            onChange={(e) => { void handleFiles(e.target.files); e.target.value = ""; }}
          />
        </label>
      )}
    >
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total assets" value={assets.length} accent loading={loading} hint="In the shared library" />
        <StatCard label="Total size" value={humanizeBytes(totalSize)} loading={loading} hint="Across all assets" />
        <StatCard
          label="Top kind"
          value={loading ? "—" : topKind ? `${topKind.count}` : "0"}
          loading={loading}
          hint={topKind ? `${KIND_META[topKind.kind].label}s` : "No assets yet"}
        />
        <StatCard label="Max per file" value="20 MB" hint="Logos · fonts · references" />
      </div>

      {/* Drag-and-drop ingest zone */}
      {canUpload && (
        <label
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={cn(
            "mt-3 group relative flex flex-col items-center justify-center text-center gap-3 rounded-2xl px-6 py-9 ring-1 border border-dashed transition-colors cursor-pointer",
            dragActive
              ? "ring-[hsl(215_90%_60%/0.5)] border-[hsl(215_90%_60%/0.6)] bg-[hsl(215_90%_55%/0.08)]"
              : "ring-white/[0.07] border-white/[0.12] bg-white/[0.015] hover:bg-white/[0.03] hover:border-white/20",
            uploading && "pointer-events-none opacity-70",
          )}
        >
          <span className={cn(
            "inline-flex w-12 h-12 items-center justify-center rounded-2xl ring-1 transition-colors",
            dragActive ? "ring-[hsl(215_90%_60%/0.4)] bg-[hsl(215_90%_55%/0.12)]" : "ring-white/[0.07] bg-gradient-to-br from-white/[0.06] to-white/[0.015]",
          )}>
            {uploading
              ? <Spinner size="sm" tone="inherit" />
              : <Upload className="w-5 h-5 text-[hsl(215,100%,72%)]" strokeWidth={1.6} />}
          </span>
          <div>
            <div className="text-[14px] font-light text-white/90">
              {uploading ? "Ingesting…" : dragActive ? "Drop to ingest" : "Drag & drop to ingest"}
            </div>
            <div className={cn(TYPE_META, "text-white/40 mt-1")}>
              or click to browse · images, fonts, documents · up to 20 MB each
            </div>
          </div>
          <input
            type="file"
            multiple
            className="hidden"
            disabled={uploading}
            onChange={(e) => { void handleFiles(e.target.files); e.target.value = ""; }}
          />
        </label>
      )}

      {/* Breakdown donut */}
      {!loading && donutData.length > 0 && (
        <>
          <SectionHead label="Composition" />
          <ChartCard title="Assets by kind" subtitle="Distribution across the library">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-full sm:w-1/2">
                <DonutChart data={donutData} height={190} centerValue={assets.length} centerLabel="Assets" />
              </div>
              <ChartLegend
                className="sm:w-1/2 sm:flex-col sm:gap-2.5"
                items={donutData.map((d) => ({ label: d.name, color: d.color, value: d.value }))}
              />
            </div>
          </ChartCard>
        </>
      )}

      {/* Library + facets + search */}
      <SectionHead label="Library" count={loading ? undefined : filtered.length} />

      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
        <div className="flex items-center gap-1.5 flex-wrap">
          {facets.map((f) => {
            const on = kindFilter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setKindFilter(f.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-[12px] font-light ring-1 transition-colors",
                  on
                    ? "ring-[hsl(215_90%_60%/0.4)] bg-[hsl(215_90%_55%/0.1)] text-white"
                    : "ring-white/[0.08] bg-white/[0.015] text-white/55 hover:text-white/85 hover:ring-white/20",
                )}
              >
                {f.label}
                <span className={cn("font-mono tabular-nums text-[10px]", on ? "text-[hsl(215,100%,78%)]" : "text-white/35")}>{f.count}</span>
              </button>
            );
          })}
        </div>
        <div className="relative lg:ml-auto lg:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/35" strokeWidth={1.6} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name…"
            className="w-full h-9 pl-9 pr-3 rounded-full bg-white/[0.02] ring-1 ring-white/[0.08] text-[13px] text-white/85 placeholder:text-white/30 focus:outline-none focus:ring-[hsl(215_90%_60%/0.4)] transition-colors"
          />
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={8} grid="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" className="[&>*]:aspect-square" />
      ) : assets.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="Library empty."
          description={canUpload
            ? "Drag in logos, fonts, or reference images to share with your team."
            : "Ask an admin or producer to ingest assets."}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No matches."
          description="No assets match the current filter or search. Try a different kind or clear the search."
        />
      ) : (
        <>
          <StaggerList className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {slice.map((a) => {
              const meta = KIND_META[a.kind] ?? KIND_META.other;
              const isImage = (a.mime_type ?? "").startsWith("image/");
              return (
                <StaggerItem key={a.id} className="group rounded-2xl overflow-hidden ring-1 ring-white/[0.07] bg-white/[0.015] hover:ring-white/20 transition-all">
                  <div className="aspect-square relative flex items-center justify-center" style={isImage ? CHECKER : undefined}>
                    {isImage ? (
                      <img src={a.public_url} alt={a.name} loading="lazy" className="absolute inset-0 w-full h-full object-contain p-3" />
                    ) : (
                      <div className="flex flex-col items-center gap-2.5 px-3 text-center">
                        <meta.Icon className="w-10 h-10 text-[hsl(215,100%,72%)]" strokeWidth={1.2} />
                        <span className="text-[11px] text-white/45 truncate max-w-full">{a.name}</span>
                      </div>
                    )}
                    <div className="absolute top-2.5 left-2.5">
                      <Badge tone="accent">{meta.label}</Badge>
                    </div>
                    {/* Hover action overlay */}
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                      <a href={a.public_url} target="_blank" rel="noopener noreferrer"
                         className="p-1.5 rounded-full bg-black/55 backdrop-blur text-white/70 hover:text-white ring-1 ring-white/10"
                         title="Open">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      {canDelete && (
                        <button onClick={() => remove(a)}
                                className="p-1.5 rounded-full bg-black/55 backdrop-blur text-rose-300/90 hover:text-rose-200 ring-1 ring-white/10"
                                title="Purge">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="p-3 min-w-0">
                    <div className="text-[12px] text-white/85 truncate">{a.name}</div>
                    <div className={cn(TYPE_META, "text-white/35 mt-0.5")}>
                      {a.size_bytes ? humanizeBytes(a.size_bytes) : "—"}
                    </div>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerList>
          <ListPagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} label="assets" />
        </>
      )}
    </BusinessPage>
  );
}
