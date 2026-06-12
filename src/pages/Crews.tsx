/**
 * Crews — /crews
 *
 * The social hub. Persistent 3–10-person creative groups with a shared
 * project pool. Sits inside AppShell + PageShell, uses StudioAurora /
 * StudioHero / StudioTabs so it reads as a sibling of /create.
 *
 * Tabs: All public · Your crews · Create
 *   (Create slides open an inline form rather than opening a modal so
 *    flow feels in-page.)
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Plus, Crown, ArrowRight, Lock, Globe, Sparkles, Send, Compass,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSafeNavigation } from "@/lib/navigation";
import { PageShell } from "@/components/shell";
import { StudioHero } from "@/components/studio/StudioHero";
import { StudioTabs } from "@/components/studio/StudioTabs";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Spinner } from "@/components/ui/Spinner";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Crew {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  is_public: boolean;
  created_by: string;
  created_at: string;
  is_demo?: boolean;
}

const DEMO_CREWS: Crew[] = [
  {
    id: "demo-1", slug: "friday-cut", name: "The Friday Cut", is_public: true, created_by: "demo",
    description: "Weekly noir scene cut on Fridays — eight directors, one shared character bible.",
    cover_url: "https://images.unsplash.com/photo-1542204625-ca960057ec39?auto=format&fit=crop&w=1200&q=80",
    created_at: new Date().toISOString(), is_demo: true,
  },
  {
    id: "demo-2", slug: "music-room", name: "Music Room", is_public: true, created_by: "demo",
    description: "Composers + visual directors. We trade scores and remix each other's videos.",
    cover_url: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80",
    created_at: new Date().toISOString(), is_demo: true,
  },
  {
    id: "demo-3", slug: "saturday-docu", name: "Saturday Docu", is_public: true, created_by: "demo",
    description: "Portrait series — one director shoots, the rest add second-camera angles.",
    cover_url: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=80",
    created_at: new Date().toISOString(), is_demo: true,
  },
];

type TabKey = "public" | "yours" | "create";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "public", label: "Public",  icon: Compass },
  { key: "yours",  label: "Your crews", icon: Crown },
  { key: "create", label: "Start a crew", icon: Plus },
];

export default function Crews() {
  usePageMeta({ title: "Crews — Small Bridges", description: "Persistent creative groups. Share atoms. Build series." });
  const { user } = useAuth();
  const { navigate } = useSafeNavigation();
  const [tab, setTab] = useState<TabKey>("public");
  const [myCrews, setMyCrews] = useState<Crew[]>([]);
  const [publicCrews, setPublicCrews] = useState<Crew[]>([]);
  const [usingDemoPublic, setUsingDemoPublic] = useState(false);
  const [realPublicEverSeen, setRealPublicEverSeen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", description: "", is_public: false });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const myCrewIdsRes = user
        ? await supabase.from("crew_members").select("crew_id").eq("user_id", user.id)
        : { data: [] };
      const myCrewIds: string[] = (myCrewIdsRes.data ?? []).map((m: { crew_id: string }) => m.crew_id);
      const [mineRes, publicRes] = await Promise.all([
        user && myCrewIds.length > 0
          ? supabase.from("crews").select("*").in("id", myCrewIds).order("updated_at", { ascending: false })
          : Promise.resolve({ data: [] }),
        supabase.from("crews").select("*").eq("is_public", true).order("created_at", { ascending: false }).limit(24),
      ]);
      setMyCrews((mineRes.data ?? []) as Crew[]);
      const publicArr = (publicRes.data ?? []) as Crew[];
      if (publicArr.length > 0) {
        setPublicCrews(publicArr); setUsingDemoPublic(false); setRealPublicEverSeen(true);
      } else if (!realPublicEverSeen) {
        setPublicCrews(DEMO_CREWS); setUsingDemoPublic(true);
      } else {
        setPublicCrews([]); setUsingDemoPublic(false);
      }
    } catch (e) {
      console.warn("[Crews] DB unreachable, using demo", e);
      setMyCrews([]);
      if (realPublicEverSeen) { setPublicCrews([]); setUsingDemoPublic(false); }
      else { setPublicCrews(DEMO_CREWS); setUsingDemoPublic(true); }
    } finally {
      setLoading(false);
    }
  }, [user, realPublicEverSeen]);

  useEffect(() => { void load(); }, [load]);

  const slugFromName = (n: string) => n.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "").slice(0, 32);

  const create = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!form.name.trim()) { toast.error("Name required"); return; }
    const slug = form.slug.trim() || slugFromName(form.name);
    if (!slug) { toast.error("Slug must be alphanumeric"); return; }
    setCreating(true);
    try {
      const { data, error } = await supabase.rpc("create_crew", {
        p_name: form.name.trim(), p_slug: slug,
        p_description: form.description.trim() || null,
        p_is_public: form.is_public,
      });
      if (error) throw error;
      const out = data as unknown as { crew_id: string };
      toast.success(`Crew "${form.name}" created`);
      setForm({ name: "", slug: "", description: "", is_public: false });
      navigate(`/crews/${out.crew_id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create crew");
    } finally { setCreating(false); }
  };

  const join = async (crewId: string) => {
    if (!user) { navigate("/auth"); return; }
    try {
      const { error } = await supabase.from("crew_members").insert({ crew_id: crewId, user_id: user.id, role: "member" });
      if (error) throw error;
      toast.success("Joined");
      void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't join"); }
  };

  const inMyCrews = useMemo(() => new Set(myCrews.map((c) => c.id)), [myCrews]);

  return (
    <div className="relative min-h-screen flex flex-col">
      <PageShell width="wide" pad>
        <StudioHero
          eyebrow="Small Bridges · Crews"
          title="Crew"
          accent="up."
          subtitle="Three to ten directors with a shared atom library and a project pool. Build a weekly series. Run a private writing room. Crews are how real creative work compounds."
          status={["Form", "Share", "Ship"]}
          subhead={usingDemoPublic ? "Sample crews" : `${publicCrews.length} public · ${myCrews.length} yours`}
        >
          <StudioTabs items={TABS} value={tab} onChange={(k) => setTab(k as TabKey)} layoutId="crews-tab" />
        </StudioHero>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            {tab === "public" && (
              <>
                <SectionLabel label="Public crews" icon={Globe} meta={loading ? "loading" : `${publicCrews.length} open`} />
                {loading ? (
                  <SkeletonRow />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {publicCrews.map((c) => (
                      <CrewCard
                        key={c.id}
                        crew={c}
                        joined={inMyCrews.has(c.id)}
                        onOpen={() => c.is_demo ? toast.message("Sample crew — start one of your own from the Create tab.") : navigate(`/crews/${c.id}`)}
                        onJoin={inMyCrews.has(c.id) || c.is_demo ? undefined : () => join(c.id)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {tab === "yours" && (
              <>
                <SectionLabel label="Your crews" icon={Crown} meta={loading ? "loading" : `${myCrews.length} crews`} />
                {loading ? (
                  <SkeletonRow />
                ) : myCrews.length === 0 ? (
                  <div className="text-center py-10 max-w-md mx-auto rounded-2xl border border-white/[0.06] bg-white/[0.015]">
                    <Users className="w-6 h-6 mx-auto mb-3 text-muted-foreground" />
                    <h4 className="font-display font-medium text-[18px] text-foreground mb-1">You're not in any crew yet</h4>
                    <p className="text-[12px] text-muted-foreground mb-4">Start one from the Create tab, or join a public crew.</p>
                    <button
                      onClick={() => setTab("create")}
                      className="inline-flex items-center gap-2 h-10 px-4 rounded-full text-[11px] font-mono uppercase tracking-[0.22em] text-foreground"
                      style={{
                        background: "linear-gradient(180deg, hsla(160,60%,55%,0.20) 0%, hsla(160,60%,50%,0.08) 100%)",
                        boxShadow: "0 0 18px hsla(160,60%,55%,0.30), inset 0 1px 0 hsla(0,0%,100%,0.10)",
                      }}
                    >
                      <Plus className="w-3.5 h-3.5" /> Start a crew
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {myCrews.map((c) => <CrewCard key={c.id} crew={c} joined onOpen={() => navigate(`/crews/${c.id}`)} />)}
                  </div>
                )}
              </>
            )}

            {tab === "create" && (
              <section className="rounded-3xl border border-white/[0.08] bg-glass p-8 lg:p-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-[0.32em] text-emerald-300/90 mb-3 inline-flex items-center gap-2">
                      <Sparkles className="w-3 h-3" /> Start a crew
                    </div>
                    <h3 className="font-display font-medium text-[clamp(1.5rem,3vw,2.2rem)] leading-tight tracking-[-0.02em] text-foreground">
                      A name, a slug, a sentence. You're in.
                    </h3>
                    <p className="text-muted-foreground text-[13px] mt-3 leading-relaxed max-w-md">
                      You'll be the owner. Invite others by sharing the slug. Crews can be public (discoverable) or private (invite-only).
                    </p>
                  </div>
                  <div className="space-y-4">
                    <FormField label="Name">
                      <input
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: f.slug || slugFromName(e.target.value) }))}
                        placeholder="The Friday Cut"
                        className="w-full bg-glass-hover border border-white/[0.08] rounded-lg px-3 h-10 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-white/30"
                      />
                    </FormField>
                    <FormField label="Slug">
                      <input
                        value={form.slug}
                        onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                        placeholder="friday-cut"
                        className="w-full bg-glass-hover border border-white/[0.08] rounded-lg px-3 h-10 text-[13px] text-foreground placeholder:text-muted-foreground font-mono focus:outline-none focus:border-white/30"
                      />
                    </FormField>
                    <FormField label="Description">
                      <textarea
                        value={form.description}
                        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                        rows={3}
                        placeholder="A weekly noir scene cut on Fridays."
                        className="w-full bg-glass-hover border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-white/30"
                      />
                    </FormField>
                    <div className="flex items-center gap-3">
                      <label className="inline-flex items-center gap-2 text-[12px] text-foreground/65 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.is_public}
                          onChange={(e) => setForm((f) => ({ ...f, is_public: e.target.checked }))}
                          className="w-3.5 h-3.5 rounded border border-white/20 bg-transparent accent-emerald-400"
                        />
                        Public (discoverable)
                      </label>
                      <button
                        onClick={create}
                        disabled={creating}
                        className="ml-auto inline-flex items-center gap-2 h-10 px-5 rounded-full text-[11px] font-mono uppercase tracking-[0.22em] text-foreground disabled:opacity-50"
                        style={{
                          background: "linear-gradient(180deg, hsla(160,60%,55%,0.20) 0%, hsla(160,60%,50%,0.08) 100%)",
                          boxShadow: "0 0 18px hsla(160,60%,55%,0.30), inset 0 1px 0 hsla(0,0%,100%,0.10)",
                        }}
                      >
                        <Send className="w-3 h-3" />{creating ? "Creating…" : "Create crew"}
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </motion.div>
        </AnimatePresence>
      </PageShell>
    </div>
  );
}

function SectionLabel({ label, meta, icon: Icon }: { label: string; meta?: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <Icon className="w-3.5 h-3.5 text-primary/80" />
      <span className="text-[11px] font-mono uppercase tracking-[0.32em] text-foreground/65">{label}</span>
      <div className="h-px flex-1 bg-gradient-to-r from-white/[0.07] to-transparent" />
      {meta && <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/50">{meta}</span>}
    </div>
  );
}

function CrewCard({ crew, joined, onOpen, onJoin }: { crew: Crew; joined: boolean; onOpen: () => void; onJoin?: () => void }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:border-white/15 overflow-hidden transition-colors">
      <div className="aspect-[16/9] bg-black/40 relative">
        {crew.cover_url ? (
          <img src={crew.cover_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/30">
            <Users className="w-8 h-8" />
          </div>
        )}
        <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/55 backdrop-blur-md border border-white/[0.10] text-[9px] font-mono uppercase tracking-[0.28em] text-white/85">
          {crew.is_public ? <><Globe className="w-3 h-3" />Public</> : <><Lock className="w-3 h-3" />Private</>}
        </div>
        {crew.is_demo && (
          <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-amber-300/15 border border-amber-300/30 text-amber-200 text-[9px] font-mono uppercase tracking-[0.28em]">
            sample
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="text-[14px] text-foreground font-light truncate">{crew.name}</div>
        <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-[0.22em] mb-3">/{crew.slug}</div>
        {crew.description && <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2 mb-3">{crew.description}</p>}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpen}
            className={cn(
              "inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-[10px] font-mono uppercase tracking-[0.22em] transition-colors",
              "border-white/[0.10] hover:border-white/30 text-foreground/85 hover:text-foreground",
            )}
          >
            Open <ArrowRight className="w-3 h-3" />
          </button>
          {onJoin && (
            <button onClick={onJoin} className="ml-auto inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-emerald-300/90 hover:bg-emerald-300 text-black text-[10px] font-mono uppercase tracking-[0.22em]">
              <Plus className="w-3 h-3" />Join
            </button>
          )}
          {joined && !onJoin && (
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.22em] text-emerald-300">
              <Crown className="w-3 h-3" />Member
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function SkeletonRow() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl border border-white/[0.06] bg-white/[0.015] overflow-hidden">
          <div className="aspect-[16/9] bg-glass animate-pulse" />
          <div className="p-4 space-y-2">
            <div className="h-3 w-3/4 bg-glass-hover rounded animate-pulse" />
            <div className="h-2 w-1/3 bg-glass-hover rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
