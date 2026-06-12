/**
 * Universes — /universes
 *
 * Index page for shared worldbuilding spaces. Closes the audit Finding D4:
 * the singular `/universe/:id` page existed but there was no way to browse
 * which universes exist without already knowing the ID.
 *
 * Two rails:
 *   • Live — universes with reels (sorted by reel_count desc).
 *   • Recent — universes by created_at desc.
 *
 * Each tile links to `/universe/:id`. Members of a universe see a small
 * "joined" pill on their own tiles.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe, Sparkles, Wand2, ArrowRight, Users as UsersIcon, Compass, Flame,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageShell } from "@/components/shell";
import { StudioHero } from "@/components/studio/StudioHero";
import { StudioTabs } from "@/components/studio/StudioTabs";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Spinner } from "@/components/ui/Spinner";

interface Universe {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  reel_count: number;
  is_member: boolean;
  cover_thumbnail: string | null;
}

type TabKey = "live" | "recent";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "live",   label: "Live",   icon: Flame },
  { key: "recent", label: "Recent", icon: Sparkles },
];

export default function Universes() {
  usePageMeta({
    title: "Universes — Small Bridges",
    description: "Shared fictional worlds you can extend. Browse what's being built.",
  });
  const { user } = useAuth();
  const [tab, setTab] = useState<TabKey>("live");
  const [rows, setRows] = useState<Universe[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Universes index. We pull the table directly (RLS handles privacy),
      // then enrich with reel count + a thumbnail from the most recent reel.
      const { data: universes, error } = await supabase
        .from("universes")
        .select("id, name, description, created_at")
        .order("created_at", { ascending: false })
        .limit(120);
      if (error) throw error;

      const universeIds = (universes ?? []).map((u: { id: string }) => u.id);
      if (universeIds.length === 0) { setRows([]); setLoading(false); return; }

      // One-batch reel enrichment.
      const { data: reels } = await supabase
        .from("published_reels")
        .select("universe_id, thumbnail_url, created_at")
        .in("universe_id", universeIds)
        .eq("is_taken_down", false)
        .order("created_at", { ascending: false })
        .limit(1500);
      const reelMap = new Map<string, { count: number; latest_thumb: string | null }>();
      for (const r of (reels ?? []) as Array<{ universe_id: string | null; thumbnail_url: string | null }>) {
        if (!r.universe_id) continue;
        const entry = reelMap.get(r.universe_id) ?? { count: 0, latest_thumb: null };
        entry.count += 1;
        if (!entry.latest_thumb && r.thumbnail_url) entry.latest_thumb = r.thumbnail_url;
        reelMap.set(r.universe_id, entry);
      }

      // Membership lookup.
      const memberSet = new Set<string>();
      if (user) {
        const { data: memberships } = await supabase
          .from("universe_members")
          .select("universe_id")
          .eq("user_id", user.id)
          .in("universe_id", universeIds);
        for (const m of (memberships ?? []) as Array<{ universe_id: string }>) {
          memberSet.add(m.universe_id);
        }
      }

      const enriched: Universe[] = ((universes ?? []) as Array<{
        id: string; name: string; description: string | null; created_at: string;
      }>).map((u) => ({
        id: u.id,
        name: u.name,
        description: u.description,
        created_at: u.created_at,
        reel_count: reelMap.get(u.id)?.count ?? 0,
        is_member: memberSet.has(u.id),
        cover_thumbnail: reelMap.get(u.id)?.latest_thumb ?? null,
      }));

      if (tab === "live") {
        enriched.sort((a, b) => b.reel_count - a.reel_count);
      } else {
        enriched.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
      setRows(enriched);
    } catch (e) {
      console.warn("[Universes] load failed", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [user, tab]);

  useEffect(() => { void load(); }, [load]);

  const totalReels = useMemo(() => rows.reduce((acc, u) => acc + u.reel_count, 0), [rows]);

  return (
    <div className="relative min-h-screen flex flex-col">
      <PageShell width="wide" pad>
        <StudioHero
          eyebrow="Small Bridges · Universes"
          title="Worlds you can"
          accent="extend."
          subtitle="Each universe is a shared canvas. Watch what's been published, then fork a project pinned to that world so your reel becomes part of its canon."
          status={["Public", "Persistent", "Collaborative"]}
          subhead={loading ? "Loading…" : `${rows.length} universes · ${totalReels.toLocaleString()} reels`}
        >
          <StudioTabs items={TABS} value={tab} onChange={(k) => setTab(k as TabKey)} layoutId="universes-tab" />
        </StudioHero>

        {loading ? (
          <div className="flex items-center justify-center py-24 gap-3 text-muted-foreground">
            <Spinner size="md" tone="muted" />
            <span className="text-[12px] font-mono uppercase tracking-[0.22em]">Charting the universes…</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-24 max-w-md mx-auto">
            <Compass className="w-7 h-7 mx-auto mb-4 text-white/45" />
            <h3 className="font-display font-medium text-[22px] text-white mb-2">No universes yet.</h3>
            <p className="text-[12px] text-white/45 leading-relaxed mb-6">
              Universes are shared canvases — start one from your project settings to anchor a reel inside it.
            </p>
            <Link
              to="/create"
              className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-white text-black text-[11px] font-mono uppercase tracking-[0.22em] hover:bg-white/90 transition-colors"
            >
              <Wand2 className="w-3 h-3" />Start a project
            </Link>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-16"
            >
              {rows.map((u) => (
                <UniverseTile key={u.id} universe={u} />
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </PageShell>
    </div>
  );
}

function UniverseTile({ universe }: { universe: Universe }) {
  return (
    <Link
      to={`/universe/${universe.id}`}
      className="group rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:border-white/15 overflow-hidden transition-colors"
    >
      <div className="relative aspect-[16/9] bg-black/40">
        {universe.cover_thumbnail ? (
          <img src={universe.cover_thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 30% 50%, hsla(213 100% 60% / 0.18), transparent 60%), radial-gradient(ellipse at 70% 60%, hsla(280 60% 55% / 0.15), transparent 60%)",
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-[0.28em] bg-black/55 backdrop-blur-md border border-white/[0.08] text-white/85">
          <Globe className="w-2.5 h-2.5" />Universe
        </div>
        {universe.is_member && (
          <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-[0.28em] bg-primary/15 backdrop-blur-md border border-primary/40 text-primary">
            Joined
          </div>
        )}
        <div className="absolute bottom-3 left-3 right-3">
          <div className="text-[18px] font-light text-white leading-tight tracking-tight truncate">
            {universe.name}
          </div>
        </div>
      </div>
      <div className="p-4">
        {universe.description ? (
          <p className="text-[12px] text-white/55 leading-relaxed line-clamp-2 mb-3">{universe.description}</p>
        ) : (
          <p className="text-[12px] text-white/30 italic mb-3">No description yet.</p>
        )}
        <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.22em] text-white/45">
          <span className="inline-flex items-center gap-1.5">
            <UsersIcon className="w-3 h-3" />{universe.reel_count.toLocaleString()} reels
          </span>
          <span className="inline-flex items-center gap-1 group-hover:text-white transition-colors">
            Enter <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </Link>
  );
}
