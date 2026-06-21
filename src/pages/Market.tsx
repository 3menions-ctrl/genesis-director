/**
 * Market — /market
 *
 * The entertainment marketplace. Standalone Foundation surface where
 * directors buy and sell atoms — voices, characters, locations, looks,
 * scores, masterclasses, patron rooms. Sits alongside Music
 * and Studio as a parallel creation-economy destination.
 *
 * Composed in the canonical Foundation room:
 *   FoundationShell + EditorialCanvas + SpineBackdrop.
 *
 * Tabs: All / Voices / Characters / Locations / Looks / Scores /
 *       Masterclasses / Patron Rooms / Your Shop.
 *
 * When the DB has no listings, curated demo cards render so the
 * marketplace looks alive on day one. Real listings replace demos as
 * creators publish.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag, Mic, Users, MapPin, Sparkles, Music2, GraduationCap,
  Crown, Coins, Plus, ArrowRight, Tag, Heart, ShoppingCart, Layers,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSafeNavigation } from "@/lib/navigation";
import { StudioHero } from "@/components/studio/StudioHero";
import { StudioTabs } from "@/components/studio/StudioTabs";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Spinner } from "@/components/ui/Spinner";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FoundationShell } from "@/components/foundation/FoundationShell";
import { EditorialCanvas } from "@/components/foundation/EditorialCanvas";
import { useLiveRenderTimecode } from "@/hooks/useLiveRenderTimecode";

import { confirmAsync } from '@/components/ui/global-confirm';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
type AtomType = "voice" | "character" | "location" | "look" | "score" | "vfx_pack" | "course";

interface Listing {
  id: string;
  seller_id: string;
  atom_type: AtomType;
  name: string;
  description: string | null;
  preview_url: string | null;
  thumbnail_url: string | null;
  price_credits: number;
  total_sales: number;
  tags: string[];
  created_at: string;
  is_demo?: boolean;
}
interface SellerLite {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

type TabKey = "all" | AtomType | "patrons" | "yours";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "all",         label: "All",          icon: Sparkles },
  { key: "voice",       label: "Voices",       icon: Mic },
  { key: "character",   label: "Characters",   icon: Users },
  { key: "location",    label: "Locations",    icon: MapPin },
  { key: "look",        label: "Looks",        icon: Layers },
  { key: "score",       label: "Scores",       icon: Music2 },
  { key: "course",      label: "Masterclasses", icon: GraduationCap },
  { key: "patrons",     label: "Patron rooms", icon: Crown },
  { key: "yours",       label: "Your shop",    icon: Tag },
];

const DEMO_LISTINGS: Listing[] = [
  {
    id: "demo-v1", seller_id: "demo", atom_type: "voice",
    name: "Velour — late-night narrator",
    description: "A baritone with a soft burn at the edges. Trained on noir voiceover.",
    preview_url: null, thumbnail_url: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=800&q=80",
    price_credits: 240, total_sales: 38, tags: ["noir", "narrator"], created_at: new Date().toISOString(), is_demo: true,
  },
  {
    id: "demo-c1", seller_id: "demo", atom_type: "character",
    name: "Detective Marlowe — character lock",
    description: "Identity Bible v3. Coat, cigarette, scar above the eye.",
    preview_url: null, thumbnail_url: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=800&q=80",
    price_credits: 420, total_sales: 17, tags: ["noir", "lead"], created_at: new Date().toISOString(), is_demo: true,
  },
  {
    id: "demo-loc1", seller_id: "demo", atom_type: "location",
    name: "Neo-Tokyo · rooftop alley",
    description: "Anamorphic-ready environment. Rain pass + neon LUT included.",
    preview_url: null, thumbnail_url: "https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&w=800&q=80",
    price_credits: 320, total_sales: 22, tags: ["scifi", "tokyo"], created_at: new Date().toISOString(), is_demo: true,
  },
  {
    id: "demo-l1", seller_id: "demo", atom_type: "look",
    name: "Kodachrome 1972 LUT",
    description: "Warm grain pack, soft halation. Plays beautifully on portraits.",
    preview_url: null, thumbnail_url: "https://images.unsplash.com/photo-1495434942214-9b525bba74de?auto=format&fit=crop&w=800&q=80",
    price_credits: 120, total_sales: 86, tags: ["film", "lut"], created_at: new Date().toISOString(), is_demo: true,
  },
  {
    id: "demo-s1", seller_id: "demo", atom_type: "score",
    name: "Strings for the slow reveal",
    description: "60-second cinematic crescendo. Stems included.",
    preview_url: null, thumbnail_url: "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=800&q=80",
    price_credits: 180, total_sales: 41, tags: ["score", "strings"], created_at: new Date().toISOString(), is_demo: true,
  },
  {
    id: "demo-co1", seller_id: "demo", atom_type: "course",
    name: "Masterclass · cinematic prompting",
    description: "Four hours. From premise to final cut. Certified.",
    preview_url: null, thumbnail_url: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=800&q=80",
    price_credits: 750, total_sales: 53, tags: ["course"], created_at: new Date().toISOString(), is_demo: true,
  },
  {
    id: "demo-vfx1", seller_id: "demo", atom_type: "vfx_pack",
    name: "Lens flare · anamorphic streaks",
    description: "12 stinger flares. Drag-onto-timeline ready.",
    preview_url: null, thumbnail_url: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=800&q=80",
    price_credits: 90, total_sales: 71, tags: ["vfx", "lens"], created_at: new Date().toISOString(), is_demo: true,
  },
];

export default function Market() {
  usePageMeta({ title: "Market — Small Bridges", description: "Voices, characters, scores, and courses for cinematic AI." });
  const { user } = useAuth();
  const { navigate } = useSafeNavigation();
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [listings, setListings] = useState<Listing[]>([]);
  const [usingDemo, setUsingDemo] = useState(false);
  const [realDataEverSeen, setRealDataEverSeen] = useState(false);
  const [sellers, setSellers] = useState<Map<string, SellerLite>>(new Map());
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from("atom_listings").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(60);
      if (activeTab === "yours") {
        if (!user) { setListings([]); setUsingDemo(false); setLoading(false); return; }
        query = supabase.from("atom_listings").select("*").eq("seller_id", user.id).order("created_at", { ascending: false });
      } else if (activeTab !== "all" && activeTab !== "patrons") {
        query = query.eq("atom_type", activeTab);
      }
      const { data } = await query;
      const rows = (data ?? []) as Listing[];
      if (rows.length > 0) setRealDataEverSeen(true);
      const allowDemos = !realDataEverSeen && rows.length === 0;
      if (allowDemos && activeTab !== "yours" && activeTab !== "patrons") {
        const demos = activeTab === "all" ? DEMO_LISTINGS : DEMO_LISTINGS.filter((l) => l.atom_type === activeTab);
        setListings(demos);
        setUsingDemo(demos.length > 0);
      } else {
        setListings(rows);
        setUsingDemo(false);
      }

      const sellerIds = Array.from(new Set(rows.map((l) => l.seller_id))).slice(0, 50);
      if (sellerIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", sellerIds);
        const map = new Map<string, SellerLite>();
        (profs ?? []).forEach((p: { id: string }) => map.set(p.id, p as SellerLite));
        setSellers(map);
      }
    } catch (e) {
      console.warn("[Market] DB unreachable, using demo listings", e);
      if (realDataEverSeen) {
        setListings([]);
        setUsingDemo(false);
      } else {
        const demos = activeTab === "all" ? DEMO_LISTINGS : DEMO_LISTINGS.filter((l) => l.atom_type === activeTab);
        setListings(demos);
        setUsingDemo(demos.length > 0);
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab, user, realDataEverSeen]);

  useEffect(() => { void load(); }, [load]);

  const buy = async (l: Listing) => {
    if (l.is_demo) {
      toast.message("Sample listing — real listings unlock when creators publish.");
      return;
    }
    if (!user) { navigate("/auth"); return; }
    if (!await confirmAsync(`Buy "${l.name}" for ${l.price_credits.toLocaleString()} credits?`)) return;
    setBuying(l.id);
    try {
      const { data, error } = await supabase.rpc("buy_atom" as never, { p_listing_id: l.id } as never);
      if (error) throw error;
      const out = data as unknown as { seller_received: number };
      toast.success(`Acquired "${l.name}" — creator received ${out.seller_received}`);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Purchase failed");
    } finally { setBuying(null); }
  };

  // Group by category for the "All" view so the page reads like a department store.
  const grouped = useMemo(() => {
    if (activeTab !== "all") return null;
    const groups: Record<string, Listing[]> = {};
    listings.forEach((l) => {
      groups[l.atom_type] = groups[l.atom_type] || [];
      groups[l.atom_type].push(l);
    });
    return groups;
  }, [activeTab, listings]);

  const liveRenderTimecode = useLiveRenderTimecode();

  return (
    <FoundationShell>
      <div className="relative mx-auto w-full max-w-[1440px] px-4 pb-24 pt-10 sm:px-6 lg:px-10">
        <EditorialCanvas
          maxWidth="100%"
          chrome={{
            crumbs: ["Small Bridges", "market"],
            timecode: liveRenderTimecode ?? `${listings.length} ACTIVE`,
          }}
        >
        <StudioHero
          eyebrow="Tonight"
          title="Trade"
          accent="atoms."
          subtitle="Voices, characters, scores, looks — every atom you can put inside a reel is sellable here. 90% goes to the creator on every transaction."
          status={["List", "Sell", "Settle"]}
          subhead={usingDemo ? "Sample listings" : `${listings.length} active`}
        >
          <StudioTabs items={TABS} value={activeTab} onChange={(k) => setActiveTab(k as TabKey)} layoutId="market-tab" />
        </StudioHero>

        {/* HERO STRIP */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-10">
          <ActionTile
            icon={Plus}
            title="List an atom"
            sub="Voice · character · score"
            onClick={() => {
              if (!user) { toast.message("Sign in to start selling"); return; }
              import("@/components/market/GlobalAtomListingWizard").then((m) => m.openAtomListingWizard());
            }}
            accent={215}
          />
          <ActionTile icon={Crown} title="Patron rooms" sub="Monthly support tier" onClick={() => setActiveTab("patrons")} accent={38} />
          <ActionTile icon={GraduationCap} title="Masterclasses" sub="Learn from the makers" onClick={() => setActiveTab("course")} accent={280} />
        </section>

        {loading ? (
          // Layout-shaped skeleton — 3-up grid of listing cards. No FOUC.
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="rounded-2xl border border-glass bg-glass overflow-hidden">
                <div className="aspect-square bg-white/[0.03] animate-pulse" />
                <div className="p-4 space-y-2">
                  <div className="h-3 w-2/3 bg-white/[0.05] rounded animate-pulse" />
                  <div className="h-2 w-1/3 bg-white/[0.04] rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : activeTab === "patrons" ? (
          <PatronsTab />
        ) : listings.length === 0 ? (
          <EmptyMarket type={activeTab === "yours" ? "yours" : "category"} />
        ) : grouped ? (
          <AnimatePresence mode="wait">
            <motion.div
              key="all"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              {Object.entries(grouped).map(([type, rows]) => (
                <section key={type} className="mb-10">
                  <SectionLabel label={prettyType(type as AtomType)} meta={`${rows.length} listings`} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {rows.slice(0, 8).map((l) => (
                      <ListingCard
                        key={l.id}
                        listing={l}
                        seller={sellers.get(l.seller_id)}
                        onBuy={() => buy(l)}
                        buying={buying === l.id}
                        isOwn={user?.id === l.seller_id}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </motion.div>
          </AnimatePresence>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            >
              {listings.map((l) => (
                <ListingCard key={l.id} listing={l} seller={sellers.get(l.seller_id)} onBuy={() => buy(l)} buying={buying === l.id} isOwn={user?.id === l.seller_id} />
              ))}
            </motion.div>
          </AnimatePresence>
        )}
        </EditorialCanvas>
      </div>
    </FoundationShell>
  );
}

function prettyType(t: AtomType): string {
  switch (t) {
    case "voice": return "Voices";
    case "character": return "Characters";
    case "location": return "Locations";
    case "look": return "Looks";
    case "score": return "Scores";
    case "vfx_pack": return "VFX packs";
    case "course": return "Masterclasses";
  }
}

function typeIcon(t: AtomType): React.ElementType {
  switch (t) {
    case "voice": return Mic;
    case "character": return Users;
    case "location": return MapPin;
    case "look": return Layers;
    case "vfx_pack": return Sparkles;
    case "score": return Music2;
    case "course": return GraduationCap;
  }
}

function SectionLabel({ label, meta }: { label: string; meta?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="text-[11px] font-mono uppercase tracking-[0.32em] text-foreground/65">{label}</span>
      <div className="h-px flex-1 bg-gradient-to-r from-white/[0.07] to-transparent" />
      {meta && <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/50">{meta}</span>}
    </div>
  );
}

function ListingCard({ listing, seller, onBuy, buying, isOwn }: { listing: Listing; seller?: SellerLite; onBuy: () => void; buying: boolean; isOwn: boolean }) {
  const Icon = typeIcon(listing.atom_type);
  return (
    <div className="group rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:border-white/15 overflow-hidden transition-colors">
      <div className="relative aspect-video bg-black/40">
        {listing.thumbnail_url ? (
          <img src={listing.thumbnail_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/30">
            <Icon className="w-10 h-10" />
          </div>
        )}
        <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/55 backdrop-blur-md border border-white/[0.10] text-[9px] font-mono uppercase tracking-[0.28em] text-white/85">
          <Icon className="w-3 h-3" />
          {prettyType(listing.atom_type)}
        </div>
        {listing.is_demo && (
          <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-amber-300/15 border border-amber-300/30 text-amber-200 text-[9px] font-mono uppercase tracking-[0.28em]">
            sample
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="text-[14px] text-foreground font-light truncate">{listing.name}</div>
        {listing.description && (
          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed line-clamp-2">{listing.description}</p>
        )}

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {seller?.avatar_url ? (
              <img src={seller.avatar_url} alt="" className="w-5 h-5 rounded-full" />
            ) : (
              <div className="w-5 h-5 rounded-full bg-glass-hover flex items-center justify-center text-[9px] font-mono text-muted-foreground">
                {(seller?.display_name?.[0] ?? listing.is_demo ? "D" : "?").toString().toUpperCase()}
              </div>
            )}
            <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground truncate">
              {seller?.display_name || (listing.is_demo ? "Small Bridges demo" : "Anonymous")}
            </span>
          </div>
          <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
            {listing.total_sales > 0 && (<>{listing.total_sales} sold</>)}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-glass-hover border border-white/[0.06] text-[12px] font-mono tabular-nums text-foreground">
            <Coins className="w-3.5 h-3.5 text-amber-300" />
            {listing.price_credits.toLocaleString()}
          </div>
          {isOwn ? (
            <span className="inline-flex items-center h-9 px-3 rounded-full border border-white/[0.06] text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
              your listing
            </span>
          ) : (
            <button
              onClick={onBuy}
              disabled={buying}
              className={cn(
                "ml-auto inline-flex items-center gap-1.5 h-9 px-4 rounded-full transition-colors text-[11px] font-mono uppercase tracking-[0.22em]",
                "text-foreground",
              )}
              style={{
                background: "linear-gradient(180deg, hsla(215,100%,60%,0.22) 0%, hsla(215,100%,55%,0.10) 100%)",
                boxShadow: "0 0 18px hsla(215,100%,60%,0.30), inset 0 1px 0 hsla(0,0%,100%,0.10)",
              }}
            >
              {buying ? "…" : (<><ShoppingCart className="w-3 h-3" />Acquire</>)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionTile({ icon: Icon, title, sub, onClick, accent }: { icon: React.ElementType; title: string; sub: string; onClick: () => void; accent: number }) {
  return (
    <button
      onClick={onClick}
      className="group w-full flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:border-white/20 hover:bg-glass-hover px-5 py-4 text-left transition-colors"
    >
      <div
        className="w-11 h-11 rounded-xl border flex items-center justify-center shrink-0"
        style={{
          borderColor: `hsla(${accent} 100% 60% / 0.40)`,
          background: `hsla(${accent} 100% 60% / 0.10)`,
          color: `hsl(${accent} 100% 75%)`,
        }}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] text-foreground">{title}</div>
        <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-[0.22em]">{sub}</div>
      </div>
      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
    </button>
  );
}

function EmptyMarket({ type }: { type: "yours" | "all" | "category" }) {
  return (
    <div className="text-center py-16 max-w-md mx-auto">
      <ShoppingBag className="w-6 h-6 mx-auto mb-4 text-muted-foreground" />
      <h3 className="font-display font-medium text-[clamp(1.4rem,3vw,1.9rem)] text-foreground mb-2">
        {type === "yours" ? "You haven't listed anything yet" : "No listings here yet"}
      </h3>
      <p className="text-muted-foreground text-[13px] mb-6">
        {type === "yours"
          ? "List a voice, a character, or a score. 90% of every sale lands in your balance."
          : "Be the first to list — your work shows up on the front page."}
      </p>
      <Link
        to="/editor"
        className="inline-flex items-center gap-2 h-11 px-5 rounded-full text-[11px] font-mono uppercase tracking-[0.22em] text-foreground"
        style={{
          background: "linear-gradient(180deg, hsla(215,100%,60%,0.22) 0%, hsla(215,100%,55%,0.10) 100%)",
          boxShadow: "0 0 20px hsla(215,100%,60%,0.30), inset 0 1px 0 hsla(0,0%,100%,0.10)",
        }}
      >
        <Plus className="w-3.5 h-3.5" />
        Make something to list
      </Link>
    </div>
  );
}

function PatronsTab() {
  const [creators, setCreators] = useState<{ id: string; name: string; avatar: string | null; reels: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const [pledgeTarget, setPledgeTarget] = useState<{ id: string; name: string } | null>(null);
  const [pledgeAmount, setPledgeAmount] = useState<string>("50");
  const [pledgeBusy, setPledgeBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from("published_reels").select("creator_id").eq("is_taken_down", false).limit(200);
        const counts = new Map<string, number>();
        (data ?? []).forEach((r: { creator_id: string }) => {
          counts.set(r.creator_id, (counts.get(r.creator_id) ?? 0) + 1);
        });
        const ids = Array.from(counts.keys()).slice(0, 24);
        if (ids.length === 0) { setCreators([]); setLoading(false); return; }
        const { data: profs } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids);
        setCreators(
          (profs ?? []).map((p: { id: string; display_name: string | null; avatar_url: string | null }) => ({
            id: p.id, name: p.display_name ?? "Anonymous", avatar: p.avatar_url, reels: counts.get(p.id) ?? 0,
          })).sort((a, b) => b.reels - a.reels),
        );
      } catch (e) {
        console.warn("[Market/Patrons] DB unreachable", e);
        setCreators([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openPledge = (target: { id: string; name: string }) => {
    if (!user) { toast.error("Sign in to pledge"); return; }
    setPledgeAmount("50");
    setPledgeTarget(target);
  };

  const confirmPledge = async () => {
    if (!user || !pledgeTarget) return;
    const amount = parseInt(pledgeAmount, 10);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Pledge must be a positive whole-number credit amount.");
      return;
    }
    setPledgeBusy(true);
    try {
      const { error } = await supabase.from("patron_subscriptions").insert({
        creator_id: pledgeTarget.id, patron_id: user.id, monthly_credits: amount,
      });
      if (error) throw error;
      toast.success(`Pledged ${amount} cr/mo to ${pledgeTarget.name}`);
      setPledgeTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Pledge failed");
    } finally {
      setPledgeBusy(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground"><Spinner size="md" tone="muted" /><span className="text-[12px] font-mono uppercase tracking-[0.22em]">Listing rooms…</span></div>;
  }
  if (creators.length === 0) {
    return (
      <div className="text-center py-12 max-w-md mx-auto">
        <Crown className="w-6 h-6 mx-auto mb-3 text-muted-foreground" />
        <h3 className="font-display italic text-[clamp(1.4rem,2.2vw,1.9rem)] font-light text-foreground mb-2" style={{ fontFamily: "'Fraunces', serif" }}>No patron rooms yet.</h3>
        <p className="text-[12px] text-muted-foreground">When directors publish their first reels, you can become their patron from here.</p>
      </div>
    );
  }
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {creators.map((c) => (
          <div key={c.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
            <div className="flex items-center gap-3 mb-4">
              {c.avatar ? (
                <img src={c.avatar} alt="" className="w-12 h-12 rounded-full object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-glass-hover flex items-center justify-center text-muted-foreground font-mono">
                  {c.name[0]?.toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[14px] text-foreground truncate">{c.name}</div>
                <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/70">{c.reels} reels</div>
              </div>
            </div>
            <button
              onClick={() => openPledge(c)}
              className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-full bg-amber-300/90 hover:bg-amber-300 text-black text-[11px] font-mono uppercase tracking-[0.22em]"
            >
              <Heart className="w-3 h-3" />Become a patron
            </button>
          </div>
        ))}
      </div>

      <Dialog open={!!pledgeTarget} onOpenChange={(open) => !open && setPledgeTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display italic text-[22px] text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
              Pledge to {pledgeTarget?.name}
            </DialogTitle>
            <DialogDescription className="text-[12px] text-muted-foreground/85 mt-1">
              Choose a monthly credit amount. You can change or cancel anytime from Account → Subscriptions.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5">
            <label className="block text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/70 mb-2">
              Monthly credits
            </label>
            <div className="flex items-center gap-2">
              {[10, 25, 50, 100].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setPledgeAmount(String(v))}
                  className={cn(
                    "h-9 px-3 rounded-full text-[11px] font-mono tracking-[0.18em] transition-colors",
                    pledgeAmount === String(v)
                      ? "bg-amber-300 text-black"
                      : "bg-white/[0.04] text-foreground/80 hover:bg-white/[0.08]",
                  )}
                >
                  {v}
                </button>
              ))}
              <input
                type="number"
                min={1}
                step={1}
                value={pledgeAmount}
                onChange={(e) => setPledgeAmount(e.target.value)}
                className="flex-1 h-9 px-3 rounded-full bg-white/[0.04] border border-white/[0.06] text-foreground text-[13px] tabular-nums focus:outline-none focus:border-amber-300/55"
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <button
              type="button"
              onClick={() => setPledgeTarget(null)}
              className="h-10 px-5 rounded-full text-[11px] font-mono uppercase tracking-[0.22em] text-muted-foreground/80 hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmPledge}
              disabled={pledgeBusy}
              className="h-10 px-5 rounded-full bg-amber-300/90 hover:bg-amber-300 text-black text-[11px] font-mono uppercase tracking-[0.22em] disabled:opacity-50"
            >
              {pledgeBusy ? "Pledging…" : "Confirm pledge"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
