/**
 * PeopleSwipe — a premium, button-free creator deck for Discover › People.
 *
 * The card IS the control: swipe RIGHT to follow a creator, LEFT to skip. No
 * action buttons — the gesture is the whole interaction. Candidates come from
 * profiles_public (every signed-up creator, web or app) minus yourself and
 * anyone you already follow; Follow inserts into user_follows (the real graph).
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useTransform, animate, type PanInfo } from 'framer-motion';
import { Heart, MapPin, Sparkles, RotateCcw, Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { hapticTap } from '@/lib/native/shell';

interface Person { id: string; display_name: string | null; avatar_url: string | null; tagline: string | null; location: string | null; bio: string | null }

export function PeopleSwipe({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [people, setPeople] = useState<Person[]>([]);
  const [i, setI] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setI(0);
    try {
      const { data: f } = await supabase.from('user_follows' as never).select('following_id').eq('follower_id', userId);
      const followed = new Set(((f ?? []) as unknown as { following_id: string }[]).map((r) => r.following_id));
      const { data } = await supabase.from('profiles_public' as never)
        .select('id, display_name, avatar_url, tagline, location, bio')
        .limit(60);
      const cands = ((data ?? []) as unknown as Person[]).filter((p) => p.id && p.id !== userId && !followed.has(p.id) && p.display_name);
      setPeople(cands);
    } catch { setPeople([]); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  const follow = useCallback(async (p: Person) => {
    try {
      const { error } = await supabase.from('user_follows' as never).insert({ follower_id: userId, following_id: p.id } as never);
      if (error) throw error;
      toast.success(`Following ${p.display_name ?? 'creator'}`);
    } catch { /* already-following / offline: silent */ }
  }, [userId]);

  const decide = useCallback((p: Person, dir: 'left' | 'right') => {
    void hapticTap();
    if (dir === 'right') void follow(p);
    setI((n) => n + 1);
  }, [follow]);

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-white/40" /></div>;

  const current = people[i];
  const next = people[i + 1];
  const after = people[i + 2];
  if (!current) return <AllCaught onReload={load} empty={people.length === 0} />;

  return (
    <div className="mt-2 flex flex-col items-center">
      <div className="relative w-full max-w-[360px]" style={{ height: 'min(560px, 66vh)' }}>
        {/* Peeking deck behind for depth */}
        {after && <div className="absolute inset-0 scale-[0.88] translate-y-4"><CardFace person={after} dim /></div>}
        {next && <div className="absolute inset-0 scale-[0.94] translate-y-2"><CardFace person={next} dim /></div>}
        <SwipeCard key={current.id} person={current} onDecide={(dir) => decide(current, dir)} onOpen={() => { void hapticTap(); navigate(`/u/${current.id}`); }} />
      </div>

      {/* Gesture legend — the swipe IS the action; no buttons */}
      <div className="mt-5 flex items-center gap-6 font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">
        <span className="inline-flex items-center gap-1.5"><ArrowLeft className="h-3.5 w-3.5" />Skip</span>
        <span className="h-3 w-px bg-white/15" />
        <span className="inline-flex items-center gap-1.5 text-[#9fc6ff]/70">Follow<ArrowRight className="h-3.5 w-3.5" /></span>
      </div>
    </div>
  );
}

function SwipeCard({ person, onDecide, onOpen }: { person: Person; onDecide: (dir: 'left' | 'right') => void; onOpen: () => void }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-260, 260], [-14, 14]);
  const followOp = useTransform(x, [20, 120], [0, 1]);
  const passOp = useTransform(x, [-120, -20], [1, 0]);
  // Edge glow that tints the whole card as you commit to a direction.
  const followGlow = useTransform(x, [0, 140], [0, 1]);
  const passGlow = useTransform(x, [-140, 0], [1, 0]);

  const onEnd = (_: unknown, info: PanInfo) => {
    const off = info.offset.x, vel = info.velocity.x;
    if (off > 110 || vel > 650) { void animate(x, 520, { duration: 0.3 }); onDecide('right'); }
    else if (off < -110 || vel < -650) { void animate(x, -520, { duration: 0.3 }); onDecide('left'); }
    else void animate(x, 0, { type: 'spring', stiffness: 320, damping: 26 });
  };

  return (
    <motion.div style={{ x, rotate }} drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.6} onDragEnd={onEnd}
      onTap={() => onOpen()}
      className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing">
      <CardFace person={person} />
      {/* Directional tint overlays */}
      <motion.div style={{ opacity: followGlow }} className="pointer-events-none absolute inset-0 rounded-[30px] bg-gradient-to-l from-[#2fd17a]/35 to-transparent ring-2 ring-[#5ee08a]/60" />
      <motion.div style={{ opacity: passGlow }} className="pointer-events-none absolute inset-0 rounded-[30px] bg-gradient-to-r from-[#ff5b6b]/30 to-transparent ring-2 ring-[#ff5b6b]/55" />
      {/* Stamps */}
      <motion.span style={{ opacity: followOp }} className="pointer-events-none absolute left-5 top-6 -rotate-[14deg] inline-flex items-center gap-1.5 rounded-xl border-[2.5px] border-[#5ee08a] px-3 py-1 font-display text-[22px] font-extrabold tracking-wide text-[#5ee08a] backdrop-blur-sm"><Heart className="h-5 w-5 fill-[#5ee08a]" />FOLLOW</motion.span>
      <motion.span style={{ opacity: passOp }} className="pointer-events-none absolute right-5 top-6 rotate-[14deg] rounded-xl border-[2.5px] border-[#ff5b6b] px-3 py-1 font-display text-[22px] font-extrabold tracking-wide text-[#ff5b6b] backdrop-blur-sm">SKIP</motion.span>
    </motion.div>
  );
}

function CardFace({ person, dim }: { person: Person; dim?: boolean }) {
  const initial = (person.display_name?.[0] ?? '?').toUpperCase();
  return (
    <div className={`lit-edge relative h-full w-full overflow-hidden rounded-[30px] bg-gradient-to-b from-[#241a3d] to-[#0b0b12] shadow-[0_30px_70px_-24px_rgba(0,0,0,.85)] ${dim ? 'brightness-[0.55]' : ''}`}>
      {/* Full-bleed portrait */}
      {person.avatar_url ? (
        <img src={person.avatar_url} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-[#6b3bff] to-[#241a3d]">
          <span className="font-display text-[88px] font-bold text-white/85">{initial}</span>
        </div>
      )}
      {/* Cinematic scrim */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/92 via-black/15 to-black/20" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/40 to-transparent" />

      {/* Identity */}
      <div className="absolute inset-x-0 bottom-0 px-5 pb-6">
        <div className="flex items-center gap-2">
          <h2 className="text-[30px] font-light leading-tight drop-shadow-[0_2px_10px_rgba(0,0,0,.6)]" style={{ fontFamily: 'Fraunces, serif' }}>{person.display_name ?? 'Anonymous'}</h2>
          <Sparkles className="h-4 w-4 text-[#9fc6ff]" />
        </div>
        {person.tagline && <p className="mt-1 text-[14px] leading-snug text-white/85 drop-shadow">{person.tagline}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {person.location && <span className="inline-flex items-center gap-1 rounded-full bg-white/12 px-2.5 py-1 text-[11px] text-white/80 backdrop-blur-md"><MapPin className="h-3 w-3" />{person.location}</span>}
          <span className="inline-flex items-center rounded-full bg-white/12 px-2.5 py-1 text-[11px] text-white/65 backdrop-blur-md">Tap to view</span>
        </div>
        {person.bio && <p className="mt-2.5 line-clamp-2 text-[12.5px] leading-snug text-white/60">{person.bio}</p>}
      </div>
    </div>
  );
}

function AllCaught({ onReload, empty }: { onReload: () => void; empty: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <Sparkles className="h-8 w-8 text-[#7aa2ff]" />
      <div className="text-[17px] font-light italic text-white/75" style={{ fontFamily: 'Fraunces, serif' }}>{empty ? 'No new creators right now' : "That's everyone for now"}</div>
      <button onClick={onReload} className="flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-[13px] font-medium text-white/80"><RotateCcw className="h-4 w-4" />Refresh</button>
    </div>
  );
}
