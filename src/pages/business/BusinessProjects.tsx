/**
 * BusinessProjects — /business/projects
 *
 * The workspace's production browser: every movie_project created inside the
 * org, rendered as a premium, media-rich asset library. A KPI row, a faceted
 * control bar (search · status · genre · quality · owner · sort · view), a
 * media gallery grid with hover-play video, and a dense list view — all
 * org-scoped, real data only, deep-linking into /production/:id.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Film, Search, Sparkles, ChevronDown, Check, LayoutGrid, List as ListIcon,
  Heart, Clock, Cpu, ArrowUpDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import {
  BusinessPage, StatCard, SectionHead, EmptyState, SkeletonCards,
  StaggerList, StaggerItem, Badge,
} from "@/components/business/BusinessPage";
import { DataTable, type Column } from "@/components/business/BusinessCharts";
import { LazyAutoVideo } from "@/components/video/LazyAutoVideo";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";

// ── Row shape — a `type` (not interface) so it satisfies Record<string, unknown> ─
type ProjectRow = {
  id: string;
  title: string | null;
  status: string | null;
  created_at: string | null;
  thumbnail_url: string | null;
  genre: string | null;
  quality_tier: string | null;
  engine: string | null;
  target_duration_minutes: number | null;
  user_id: string | null;
  mode: string | null;
  likes_count: number | null;
  is_public: boolean | null;
  source_video_url: string | null;
  // enriched client-side
  ownerName: string;
  ownerAvatar: string | null;
};

type Member = { user_id: string; name: string; avatar_url: string | null };

type SortKey = "recent" | "oldest" | "title" | "liked";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "Recent" },
  { key: "oldest", label: "Oldest" },
  { key: "title", label: "Title A–Z" },
  { key: "liked", label: "Most liked" },
];

const statusTone = (s: string | null): "good" | "bad" | "warn" | "accent" | "neutral" => {
  const v = (s ?? "").toLowerCase();
  if (v === "completed") return "good";
  if (v === "failed") return "bad";
  if (v === "draft") return "warn";
  if (["processing", "rendering", "generating", "queued", "pending"].includes(v)) return "accent";
  return "neutral";
};

const titleCase = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export default function BusinessProjects() {
  usePageMeta({ title: "Projects — Business", description: "Every production in your workspace — a media-rich, faceted asset browser." });
  const { currentOrg, hasPermission } = useWorkspace();
  const navigate = useNavigate();

  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);

  // controls
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [genre, setGenre] = useState("all");
  const [quality, setQuality] = useState("all");
  const [owner, setOwner] = useState("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [view, setView] = useState<"grid" | "list">("grid");

  const orgId = currentOrg?.id ?? null;

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: projData } = await supabase
        .from("movie_projects")
        .select("id, title, status, created_at, thumbnail_url, genre, quality_tier, engine, target_duration_minutes, user_id, mode, likes_count, is_public, source_video_url")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(300);

      const projects = (projData ?? []) as unknown as Omit<ProjectRow, "ownerName" | "ownerAvatar">[];

      // member facet — resolve owner names/avatars
      const { data: memberData } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", orgId);
      const userIds = (memberData ?? []).map((m) => m.user_id);
      const pmap = new Map<string, { name: string; avatar_url: string | null }>();
      if (userIds.length > 0) {
        const { data: profData } = await supabase
          .from("profiles")
          .select("id, display_name, full_name, avatar_url")
          .in("id", userIds);
        for (const p of profData ?? []) {
          pmap.set(p.id, { name: p.display_name || p.full_name || "Member", avatar_url: p.avatar_url ?? null });
        }
      }

      const enriched: ProjectRow[] = projects.map((p) => {
        const prof = p.user_id ? pmap.get(p.user_id) : undefined;
        return { ...p, ownerName: prof?.name ?? "Member", ownerAvatar: prof?.avatar_url ?? null };
      });

      if (!cancelled) {
        setRows(enriched);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orgId]);

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const completed = rows.filter((r) => (r.status ?? "").toLowerCase() === "completed").length;
    const failed = rows.filter((r) => (r.status ?? "").toLowerCase() === "failed").length;
    return { total: rows.length, completed, failed, inFlight: rows.length - completed - failed };
  }, [rows]);

  // ── Facet option lists (value · label · count) ──────────────────────────────
  const facets = useMemo(() => {
    const tally = (get: (r: ProjectRow) => string | null) => {
      const m = new Map<string, number>();
      for (const r of rows) {
        const v = (get(r) ?? "").toLowerCase();
        if (!v) continue;
        m.set(v, (m.get(v) ?? 0) + 1);
      }
      return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, label: titleCase(value), count }));
    };

    const ownerMap = new Map<string, { name: string; avatar: string | null; count: number }>();
    for (const r of rows) {
      if (!r.user_id) continue;
      const cur = ownerMap.get(r.user_id);
      if (cur) cur.count += 1;
      else ownerMap.set(r.user_id, { name: r.ownerName, avatar: r.ownerAvatar, count: 1 });
    }
    const owners = [...ownerMap.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .map(([value, v]) => ({ value, label: v.name, count: v.count }));

    return { status: tally((r) => r.status), genre: tally((r) => r.genre), quality: tally((r) => r.quality_tier), owners };
  }, [rows]);

  // ── Filter + sort ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = rows.filter((r) =>
      (status === "all" || (r.status ?? "").toLowerCase() === status) &&
      (genre === "all" || (r.genre ?? "").toLowerCase() === genre) &&
      (quality === "all" || (r.quality_tier ?? "").toLowerCase() === quality) &&
      (owner === "all" || r.user_id === owner) &&
      (!q || (r.title ?? "").toLowerCase().includes(q)),
    );
    const time = (r: ProjectRow) => (r.created_at ? new Date(r.created_at).getTime() : 0);
    out.sort((a, b) => {
      switch (sort) {
        case "oldest": return time(a) - time(b);
        case "title": return (a.title ?? "Untitled").localeCompare(b.title ?? "Untitled");
        case "liked": return (b.likes_count ?? 0) - (a.likes_count ?? 0);
        default: return time(b) - time(a);
      }
    });
    return out;
  }, [rows, query, status, genre, quality, owner, sort]);

  const activeFilters = (status !== "all" ? 1 : 0) + (genre !== "all" ? 1 : 0) + (quality !== "all" ? 1 : 0) + (owner !== "all" ? 1 : 0);
  const clearAll = () => { setStatus("all"); setGenre("all"); setQuality("all"); setOwner("all"); setQuery(""); };

  // ── List columns ────────────────────────────────────────────────────────────
  const columns: Column<ProjectRow>[] = [
    {
      key: "title", header: "Production",
      render: (r) => (
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-14 h-9 shrink-0 rounded-md overflow-hidden ring-1 ring-white/10 bg-gradient-to-br from-[hsl(215_40%_12%)] to-[#0a0a0f]">
            {r.thumbnail_url && <img src={r.thumbnail_url} alt="" className="w-full h-full object-cover" loading="lazy" />}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-white/90">{r.title || "Untitled project"}</span>
            {r.mode && <span className={cn(TYPE_META, "text-white/35 block truncate")}>{r.mode}</span>}
          </span>
        </div>
      ),
    },
    { key: "status", header: "Status", render: (r) => r.status ? <Badge tone={statusTone(r.status)}>{r.status}</Badge> : <span className="text-white/30">—</span> },
    { key: "genre", header: "Genre", render: (r) => <span className="text-white/70">{r.genre ? titleCase(r.genre) : "—"}</span> },
    { key: "quality_tier", header: "Quality", render: (r) => <span className="text-white/70">{r.quality_tier ? titleCase(r.quality_tier) : "—"}</span> },
    {
      key: "owner", header: "Owner",
      render: (r) => (
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-6 h-6 rounded-full overflow-hidden bg-white/[0.06] ring-1 ring-white/10 flex items-center justify-center shrink-0">
            {r.ownerAvatar ? <img src={r.ownerAvatar} alt="" className="w-full h-full object-cover" /> : <span className="font-mono text-[10px] text-[hsl(215,100%,72%)]">{r.ownerName[0]?.toUpperCase()}</span>}
          </span>
          <span className="truncate text-white/70">{r.ownerName}</span>
        </div>
      ),
    },
    { key: "created_at", header: "Created", align: "right", render: (r) => <span className="tabular-nums text-white/55">{r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}</span> },
    {
      key: "likes_count", header: "Likes", align: "right",
      render: (r) => <span className="inline-flex items-center gap-1 tabular-nums text-white/70"><Heart className="w-3 h-3 text-rose-300/70" strokeWidth={1.8} />{r.likes_count ?? 0}</span>,
    },
  ];

  return (
    <BusinessPage
      eyebrow={<><span className="text-[hsl(215,100%,72%)]">Operate</span><span className="text-white/20">·</span><span>Productions</span></>}
      title="Projects."
      subtitle="Every production created inside this workspace, by every member — a media-rich, faceted library that's useful for all project types."
      actions={hasPermission("producer") && (
        <Link to="/business/create" className="inline-flex items-center gap-2 rounded-full px-5 h-11 bg-[hsl(215,90%,55%)] text-white text-[13px] font-medium hover:bg-[hsl(215,90%,60%)] transition-colors">
          <Sparkles className="w-4 h-4" strokeWidth={1.8} /> New project
        </Link>
      )}
    >
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total productions" value={kpis.total} loading={loading} hint="All-time in this workspace" />
        <StatCard label="Completed" value={kpis.completed} accent loading={loading} hint={kpis.total ? `${Math.round((kpis.completed / kpis.total) * 100)}% of all` : undefined} />
        <StatCard label="In flight" value={kpis.inFlight} loading={loading} hint="Drafting, queued or rendering" />
        <StatCard label="Failed" value={kpis.failed} loading={loading} hint="Need attention" />
      </div>

      {/* Control bar */}
      <div className="mt-8 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" strokeWidth={1.6} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search productions by title…"
              className="w-full h-11 pl-10 pr-4 rounded-full bg-white/[0.04] ring-1 ring-white/[0.08] focus:ring-white/20 text-[14px] text-white placeholder:text-white/35 outline-none transition"
            />
          </div>

          {/* Sort + view toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <FacetDropdown
              label="Sort"
              icon={ArrowUpDown}
              value={sort}
              options={SORTS.map((s) => ({ value: s.key, label: s.label }))}
              onChange={(v) => setSort(v as SortKey)}
              showAll={false}
            />
            <div className="inline-flex items-center rounded-full ring-1 ring-white/[0.08] bg-white/[0.03] p-0.5">
              {([["grid", LayoutGrid], ["list", ListIcon]] as const).map(([v, Icon]) => (
                <button
                  key={v}
                  type="button"
                  aria-label={`${v} view`}
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={cn(
                    "inline-flex items-center justify-center w-9 h-8 rounded-full transition-colors",
                    view === v ? "bg-[hsl(215_90%_55%/0.18)] text-white ring-1 ring-[hsl(215_90%_60%/0.35)]" : "text-white/45 hover:text-white",
                  )}
                >
                  <Icon className="w-4 h-4" strokeWidth={1.7} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Facet filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <FacetDropdown label="Status" value={status} options={facets.status} onChange={setStatus} />
          <FacetDropdown label="Genre" value={genre} options={facets.genre} onChange={setGenre} />
          <FacetDropdown label="Quality" value={quality} options={facets.quality} onChange={setQuality} />
          <FacetDropdown label="Owner" value={owner} options={facets.owners} onChange={setOwner} />
          {activeFilters > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="h-9 px-3.5 rounded-full text-[12px] text-white/55 hover:text-white ring-1 ring-white/[0.07] hover:ring-white/15 transition-colors"
            >
              Clear {activeFilters} filter{activeFilters > 1 ? "s" : ""}
            </button>
          )}
        </div>
      </div>

      <SectionHead label="Productions" count={loading ? undefined : `${filtered.length} of ${rows.length}`} />

      {loading ? (
        view === "list" ? <SkeletonCards count={6} grid="grid-cols-1" /> : <SkeletonCards count={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Film}
          title={rows.length === 0 ? "No productions yet." : "No matches."}
          description={rows.length === 0
            ? "Workspace members haven't shipped a project yet. Spin one up and it'll show up here for the whole team."
            : "No productions match the current search and filters. Try clearing a facet."}
          action={rows.length === 0
            ? (hasPermission("producer") && (
                <Link to="/business/create" className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-[hsl(215,90%,55%)] text-white text-[13px] font-medium hover:bg-[hsl(215,90%,60%)] transition-colors">
                  <Sparkles className="w-4 h-4" /> New project
                </Link>
              ))
            : (
                <button type="button" onClick={clearAll} className="inline-flex items-center gap-2 h-11 px-5 rounded-full ring-1 ring-white/15 text-white/80 hover:text-white text-[13px] transition-colors">
                  Clear filters
                </button>
              )}
        />
      ) : view === "list" ? (
        <DataTable
          columns={columns}
          rows={filtered}
          getRowKey={(r) => r.id}
          onRowClick={(r) => navigate(`/production/${r.id}`)}
        />
      ) : (
        <StaggerList className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((p) => (
            <StaggerItem key={p.id}>
              <ProjectCard project={p} />
            </StaggerItem>
          ))}
        </StaggerList>
      )}
    </BusinessPage>
  );
}

// ── Media gallery card — thumbnail with hover-play video + meta row ───────────
function ProjectCard({ project: p }: { project: ProjectRow }) {
  const [hovered, setHovered] = useState(false);
  const duration = typeof p.target_duration_minutes === "number" && p.target_duration_minutes > 0
    ? `${p.target_duration_minutes} min` : null;
  const meta = [
    p.genre ? titleCase(p.genre) : null,
    p.quality_tier ? titleCase(p.quality_tier) : null,
    p.engine,
    duration,
  ].filter(Boolean) as string[];

  return (
    <Link
      to={`/production/${p.id}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group block rounded-2xl overflow-hidden ring-1 ring-white/[0.07] hover:ring-white/20 bg-white/[0.015] transition-all"
    >
      <div className="relative aspect-video bg-gradient-to-br from-[hsl(215_40%_12%)] to-[#0a0a0f] overflow-hidden">
        {p.thumbnail_url && (
          <img
            src={p.thumbnail_url}
            alt=""
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
          />
        )}
        {/* Hover-play: mount the coordinated lazy video only while hovering */}
        {p.source_video_url && hovered && (
          <LazyAutoVideo
            src={p.source_video_url}
            poster={p.thumbnail_url ?? undefined}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

        {/* Status badge */}
        {p.status && <span className="absolute top-3 left-3"><Badge tone={statusTone(p.status)}>{p.status}</Badge></span>}

        {/* Likes pill */}
        {(p.likes_count ?? 0) > 0 && (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 h-6 rounded-full bg-black/45 backdrop-blur-sm ring-1 ring-white/10 text-[11px] text-white/85 tabular-nums">
            <Heart className="w-3 h-3 text-rose-300/90" strokeWidth={1.8} />{p.likes_count}
          </span>
        )}

        {/* Title + meta */}
        <div className="absolute bottom-0 inset-x-0 p-4">
          <div className="text-[15px] text-white font-light truncate">{p.title || "Untitled project"}</div>
          {meta.length > 0 && (
            <div className="mt-1 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-white/55 truncate">
              {meta.map((m, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 shrink-0">
                  {i > 0 && <span className="text-white/25">·</span>}
                  {m}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer strip — owner + created */}
      <div className="flex items-center gap-2 px-3.5 py-3">
        <span className="w-6 h-6 rounded-full overflow-hidden bg-white/[0.06] ring-1 ring-white/10 flex items-center justify-center shrink-0">
          {p.ownerAvatar ? <img src={p.ownerAvatar} alt="" className="w-full h-full object-cover" /> : <span className="font-mono text-[10px] text-[hsl(215,100%,72%)]">{p.ownerName[0]?.toUpperCase()}</span>}
        </span>
        <span className="text-[12px] text-white/60 truncate">{p.ownerName}</span>
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-white/35 tabular-nums shrink-0">
          <Clock className="w-3 h-3" strokeWidth={1.6} />{p.created_at ? new Date(p.created_at).toLocaleDateString() : "—"}
        </span>
      </div>
    </Link>
  );
}

// ── FacetDropdown — small pill that opens a counted option menu ───────────────
function FacetDropdown({ label, value, options, onChange, icon: Icon, showAll = true }: {
  label: string;
  value: string;
  options: { value: string; label: string; count?: number }[];
  onChange: (v: string) => void;
  icon?: typeof Cpu;
  showAll?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const active = value !== "all";
  const current = options.find((o) => o.value === value);
  const menu = showAll
    ? [{ value: "all", label: "All", count: options.reduce((t, o) => t + (o.count ?? 0), 0) }, ...options]
    : options;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[12px] transition-colors ring-1",
          active
            ? "ring-[hsl(215_90%_60%/0.4)] bg-[hsl(215_90%_55%/0.12)] text-white"
            : "ring-white/[0.07] text-white/55 hover:text-white hover:ring-white/15",
        )}
      >
        {Icon && <Icon className="w-3.5 h-3.5" strokeWidth={1.7} />}
        <span className="text-white/40">{label}</span>
        <span className="text-current">{active ? (current?.label ?? value) : showAll ? "All" : (current?.label ?? value)}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} strokeWidth={1.7} />
      </button>

      {open && (
        <div className="absolute z-30 mt-2 min-w-[200px] max-h-[320px] overflow-y-auto rounded-2xl ring-1 ring-white/10 bg-[hsl(220_30%_6%/0.96)] backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.5)] p-1.5">
          {menu.length === 0 ? (
            <div className="px-3 py-4 text-center text-[12px] text-white/35">No options</div>
          ) : (
            menu.map((o) => {
              const on = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 h-9 rounded-xl text-[13px] text-left transition-colors",
                    on ? "bg-white/[0.06] text-white" : "text-white/65 hover:bg-white/[0.04] hover:text-white",
                  )}
                >
                  <span className="w-3.5 shrink-0">{on && <Check className="w-3.5 h-3.5 text-[hsl(215,100%,72%)]" strokeWidth={2} />}</span>
                  <span className="truncate flex-1">{o.label}</span>
                  {o.count !== undefined && <span className="text-[11px] font-mono tabular-nums text-white/35">{o.count}</span>}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
