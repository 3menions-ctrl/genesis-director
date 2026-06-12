/**
 * CrewDetail — /crews/:id
 *
 * Single-crew view. Shows:
 *   • Hero — name, cover, description, visibility, member count
 *   • Members — with role, avatar, link to channel
 *   • Recent reels — published reels by any member
 *   • Actions — leave (member), invite (owner), edit (owner)
 *
 * Data: parallel queries against crews + crew_members + published_reels
 * filtered by the crew's user set.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Crown, Globe, Lock, Users, Eye, ArrowRight, Sparkles, LogOut, Copy,
  Calendar, Play, Wand2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSafeNavigation } from "@/lib/navigation";
import { PageShell } from "@/components/shell";
import { StudioAurora } from "@/components/studio/StudioAurora";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Spinner } from "@/components/ui/Spinner";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { confirmAsync } from '@/components/ui/global-confirm';
interface Crew {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  is_public: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}
interface MemberRow {
  user_id: string;
  role: string;
  joined_at: string;
  email?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
}
interface ReelRow {
  id: string;
  title: string;
  thumbnail_url: string | null;
  video_url: string;
  play_count: number;
  like_count: number;
  remix_count: number;
  creator_id: string;
}

export default function CrewDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { navigate } = useSafeNavigation();
  const [crew, setCrew] = useState<Crew | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [reels, setReels] = useState<ReelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);

  usePageMeta({
    title: crew?.name ? `${crew.name} · Crew` : "Crew · Small Bridges",
    description: crew?.description ?? "A creative crew on Small Bridges.",
  });

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data: crewRow } = await supabase.from("crews").select("*").eq("id", id).maybeSingle();
      if (!crewRow) { setCrew(null); setLoading(false); return; }
      setCrew(crewRow as Crew);

      const { data: rawMembers } = await supabase
        .from("crew_members")
        .select("user_id, role, joined_at")
        .eq("crew_id", id);

      const memberIds = (rawMembers ?? []).map((m: { user_id: string }) => m.user_id);
      if (memberIds.length === 0) {
        setMembers([]); setReels([]); setLoading(false); return;
      }

      const [profsRes, reelsRes] = await Promise.all([
        supabase.from("profiles").select("id, email, display_name, avatar_url").in("id", memberIds),
        supabase
          .from("published_reels")
          .select("id, title, thumbnail_url, video_url, play_count, like_count, remix_count, creator_id")
          .in("creator_id", memberIds)
          .eq("is_taken_down", false)
          .order("created_at", { ascending: false })
          .limit(24),
      ]);

      const profMap = new Map<string, MemberRow>();
      (profsRes.data ?? []).forEach((p: { id: string; email: string | null; display_name: string | null; avatar_url: string | null }) =>
        profMap.set(p.id, p as unknown as MemberRow),
      );

      const merged: MemberRow[] = (rawMembers ?? []).map((m: { user_id: string; role: string; joined_at: string }) => ({
        user_id: m.user_id,
        role: m.role,
        joined_at: m.joined_at,
        email: profMap.get(m.user_id)?.email ?? null,
        display_name: profMap.get(m.user_id)?.display_name ?? null,
        avatar_url: profMap.get(m.user_id)?.avatar_url ?? null,
      }));
      merged.sort((a, b) => roleRank(a.role) - roleRank(b.role));
      setMembers(merged);
      setReels((reelsRes.data ?? []) as ReelRow[]);
    } catch (e) {
      console.error("[CrewDetail] load failed", e);
      toast.error("Couldn't load crew");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const isOwner = user && crew?.created_by === user.id;
  const myMembership = useMemo(() => members.find((m) => m.user_id === user?.id), [members, user]);
  const isMember = !!myMembership;

  const leave = async () => {
    if (!user || !crew) return;
    if (isOwner) {
      toast.error("Owners can't leave their own crew. Transfer ownership first.");
      return;
    }
    if (!await confirmAsync("Leave this crew?")) return;
    setLeaving(true);
    try {
      const { error } = await supabase
        .from("crew_members")
        .delete()
        .eq("crew_id", crew.id)
        .eq("user_id", user.id);
      if (error) throw error;
      toast.success("Left the crew");
      navigate("/crews");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't leave");
    } finally {
      setLeaving(false);
    }
  };

  const copyInvite = async () => {
    if (!crew) return;
    try {
      const url = `${window.location.origin}/crews/${crew.id}`;
      await navigator.clipboard.writeText(url);
      toast.success("Invite link copied");
    } catch {
      toast.error("Couldn't copy");
    }
  };

  const join = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!crew) return;
    try {
      const { error } = await supabase.from("crew_members").insert({
        crew_id: crew.id, user_id: user.id, role: "member",
      });
      if (error) throw error;
      toast.success("Joined");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't join");
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col">
      <StudioAurora hue={160} intensity="subtle" />
      <PageShell width="wide" pad>
      {loading ? (
        <div className="flex items-center justify-center py-24 gap-3 text-white/55">
          <Spinner size="md" tone="muted" />
          <span className="text-[12px] font-mono uppercase tracking-[0.22em]">Loading crew…</span>
        </div>
      ) : !crew ? (
        <div className="text-center py-24 max-w-md mx-auto">
          <Users className="w-6 h-6 mx-auto mb-4 text-white/45" />
          <h2 className="font-display font-medium text-[26px] text-white mb-2">Crew not found.</h2>
          <p className="text-white/45 text-[13px] mb-6">It may be private, deleted, or not yours to access.</p>
          <Link to="/crews" className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-white text-black text-[11px] font-mono uppercase tracking-[0.22em]">
            Back to Crews <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      ) : (
        <>
          {/* HERO */}
          <section className="relative rounded-3xl overflow-hidden border border-white/[0.08] mb-10">
            <div className="relative aspect-[5/2] bg-black/40">
              {crew.cover_url ? (
                <img src={crew.cover_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(ellipse at 30% 50%, hsla(160 60% 55% / 0.20), transparent 60%), radial-gradient(ellipse at 70% 50%, hsla(213 100% 60% / 0.15), transparent 60%)",
                  }}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-3 text-[10px] font-mono uppercase tracking-[0.32em] text-white/55">
                    {crew.is_public ? <><Globe className="w-3 h-3" />Public</> : <><Lock className="w-3 h-3" />Private</>}
                    <span className="text-white/20">·</span>
                    {members.length} {members.length === 1 ? "member" : "members"}
                  </div>
                  <h1
                    className="font-display font-light text-[32px] lg:text-[48px] leading-[1.05] text-white tracking-tight truncate"
                  >
                    {crew.name}
                  </h1>
                  {crew.description && (
                    <p className="text-white/65 text-[14px] mt-3 leading-relaxed max-w-2xl line-clamp-2">{crew.description}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {isOwner ? (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.22em] text-amber-200">
                      <Crown className="w-3 h-3" />Owner
                    </span>
                  ) : isMember ? (
                    <button
                      onClick={leave}
                      disabled={leaving}
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-white/[0.10] hover:border-rose-300/40 hover:text-rose-200 text-[10px] font-mono uppercase tracking-[0.22em] text-white/55 disabled:opacity-50"
                    >
                      <LogOut className="w-3 h-3" />Leave
                    </button>
                  ) : (
                    <button
                      onClick={join}
                      className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-emerald-300/90 hover:bg-emerald-300 text-black text-[10px] font-mono uppercase tracking-[0.22em]"
                    >
                      <Sparkles className="w-3 h-3" />Join crew
                    </button>
                  )}
                  <button
                    onClick={copyInvite}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-white/[0.10] hover:border-white/30 text-[10px] font-mono uppercase tracking-[0.22em] text-white/65 hover:text-white"
                  >
                    <Copy className="w-3 h-3" />Copy invite
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* MEMBERS */}
          <SectionLabel label="Members" icon={Users} meta={members.length + " in the room"} />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 mb-12">
            {members.map((m) => (
              <Link
                key={m.user_id}
                to={`/c/${m.user_id}`}
                className="group rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:border-white/15 px-3 py-4 text-center transition-colors"
              >
                <div className="relative w-14 h-14 rounded-full mx-auto mb-2 overflow-hidden border border-white/[0.08] bg-glass-hover">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/55 text-[16px] font-mono">
                      {(m.display_name?.[0] || m.email?.[0] || "?").toUpperCase()}
                    </div>
                  )}
                  {m.role === "owner" && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-300 flex items-center justify-center text-black shadow-[0_0_6px_rgba(252,211,77,0.7)]">
                      <Crown className="w-2.5 h-2.5" />
                    </span>
                  )}
                </div>
                <div className="text-[12px] text-white truncate">{m.display_name ?? "Anonymous"}</div>
                <div className="text-[9px] text-white/40 font-mono uppercase tracking-[0.22em] mt-0.5">{m.role}</div>
              </Link>
            ))}
          </div>

          {/* RECENT REELS BY MEMBERS */}
          <SectionLabel label="Recent reels by members" icon={Play} meta={reels.length + " reels"} />
          {reels.length === 0 ? (
            <div className="text-center py-12 max-w-md mx-auto rounded-2xl border border-white/[0.06] bg-white/[0.015]">
              <Wand2 className="w-6 h-6 mx-auto mb-3 text-white/45" />
              <h3 className="font-display font-medium text-[20px] text-white mb-2">No reels yet</h3>
              <p className="text-[12px] text-white/45 mb-4">First member to publish lands on this wall.</p>
              <Link
                to="/start"
                className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-white text-black hover:bg-white/90 transition-colors text-[11px] font-mono uppercase tracking-[0.22em]"
              >
                <Wand2 className="w-3.5 h-3.5" />Make the first
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {reels.map((r) => (
                <Link
                  key={r.id}
                  to={`/watch/${r.id}`}
                  className="group rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:border-white/15 overflow-hidden transition-colors"
                >
                  <div className="aspect-video bg-black/40 relative">
                    {r.thumbnail_url ? (
                      <img src={r.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[10px] font-mono text-white/75">
                      <span className="inline-flex items-center gap-1.5"><Eye className="w-3 h-3" />{r.play_count.toLocaleString()}</span>
                      <span className="inline-flex items-center gap-1.5"><Wand2 className="w-3 h-3" />{r.remix_count.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="text-[13px] text-white font-light truncate">{r.title}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Crew foot */}
          <section className="mt-16 rounded-3xl border border-white/[0.06] bg-white/[0.015] p-8 flex items-center justify-between gap-6 flex-wrap">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.32em] text-white/35 mb-2 flex items-center gap-2">
                <Calendar className="w-3 h-3" />Established
              </div>
              <div className="text-[16px] text-white font-light">{new Date(crew.created_at).toLocaleDateString(undefined, { dateStyle: "long" })}</div>
            </div>
            <div className="flex items-center gap-2">
              {isOwner && (
                <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-white/[0.10] text-[10px] font-mono uppercase tracking-[0.22em] text-white/55">
                  <Crown className="w-3 h-3" />Manage controls coming soon
                </span>
              )}
            </div>
          </section>
        </>
      )}
      </PageShell>
    </div>
  );
}

function SectionLabel({ label, icon: Icon, meta }: { label: string; icon: React.ElementType; meta?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <Icon className="w-3.5 h-3.5 text-primary/80" />
      <span className="text-[11px] font-mono uppercase tracking-[0.32em] text-foreground/65">{label}</span>
      <div className="h-px flex-1 bg-gradient-to-r from-white/[0.07] to-transparent" />
      {meta && <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/50">{meta}</span>}
    </div>
  );
}

function roleRank(r: string): number {
  return r === "owner" ? 0 : r === "admin" ? 1 : r === "producer" ? 2 : r === "reviewer" ? 3 : 4;
}
