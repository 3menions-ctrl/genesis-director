/**
 * PeopleSwipe — a dating-app-style creator deck for Discover › People.
 *
 * Swipe RIGHT (or tap Follow) to follow a creator; swipe LEFT (or tap Pass) to
 * skip. Candidates come from find_friends_directory minus yourself and anyone
 * you already follow; Follow inserts into user_follows (the real follow graph).
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useTransform, animate, type PanInfo } from 'framer-motion';
import { X, UserPlus, MapPin, Sparkles, RotateCcw, Loader2 } from 'lucide-react';
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
      // profiles_public is the real, populated directory (find_friends_directory
      // returns 0 rows). Holds every signed-up creator — web or app.
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
    void hapticTap();
    try {
      const { error } = await supabase.from('user_follows' as never).insert({ follower_id: userId, following_id: p.id } as never);
      if (error) throw error;
      toast.success(`Following ${p.display_name ?? 'creator'}`);
    } catch { /* already-following / offline: silent */ }
  }, [userId]);

  const decide = useCallback((p: Person, dir: 'left' | 'right') => {
    if (dir === 'right') void follow(p);
    else void hapticTap();
    setI((n) => n + 1);
  }, [follow]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-white/40" /></div>;

  const current = people[i];
  const next = people[i + 1];
  if (!current) return <AllCaught onReload={load} empty={people.length === 0} />;

  return (
    <div className="mt-4 flex flex-col items-center">
      <div className="relative w-full max-w-[340px]" style={{ height: 'min(400px, 46vh)' }}>
        {next && <CardFace person={next} className="absolute inset-0 scale-[0.94] opacity-60" />}
        <SwipeCard key={current.id} person={current} onDecide={(dir) => decide(current, dir)} onOpen={() => { void hapticTap(); navigate(`/u/${current.id}`); }} />
      </div>

      <div className="mt-5 flex items-center gap-7">
        <button onClick={() => decide(current, 'left')} aria-label="Pass" className="grid h-16 w-16 place-items-center rounded-full bg-white/[0.06] text-white/80 backdrop-blur-md transition-transform active:scale-90">
          <X className="h-7 w-7" strokeWidth={2.4} />
        </button>
        <button onClick={() => decide(current, 'right')} aria-label="Follow" className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-[#2f6bff] to-[#7a3bff] text-white shadow-[0_14px_36px_-10px_rgba(80,80,255,.8)] transition-transform active:scale-90">
          <UserPlus className="h-7 w-7" strokeWidth={2.2} />
        </button>
      </div>
      <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-white/30">Swipe · right to follow</p>
    </div>
  );
}

function SwipeCard({ person, onDecide, onOpen }: { person: Person; onDecide: (dir: 'left' | 'right') => void; onOpen: () => void }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-15, 15]);
  const followOp = useTransform(x, [30, 130], [0, 1]);
  const passOp = useTransform(x, [-130, -30], [1, 0]);

  const onEnd = (_: unknown, info: PanInfo) => {
    const off = info.offset.x, vel = info.velocity.x;
    if (off > 110 || vel > 700) { void animate(x, 480, { duration: 0.28 }); onDecide('right'); }
    else if (off < -110 || vel < -700) { void animate(x, -480, { duration: 0.28 }); onDecide('left'); }
    else void animate(x, 0, { type: 'spring', stiffness: 320, damping: 26 });
  };

  return (
    <motion.div style={{ x, rotate }} drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.7} onDragEnd={onEnd}
      onTap={(_, info) => { if (Math.abs(info.offset.x) < 6) onOpen(); }}
      className="absolute inset-0 cursor-pointer touch-none">
      <CardFace person={person} />
      <span className="pointer-events-none absolute bottom-3 right-4 rounded-full bg-black/40 px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-white/70 backdrop-blur-md">Tap to view</span>
      <motion.span style={{ opacity: followOp }} className="pointer-events-none absolute left-4 top-5 -rotate-12 rounded-lg border-2 border-[#5ee08a] px-3 py-1 font-display text-[20px] font-extrabold tracking-wide text-[#5ee08a]">FOLLOW</motion.span>
      <motion.span style={{ opacity: passOp }} className="pointer-events-none absolute right-4 top-5 rotate-12 rounded-lg border-2 border-[#ff5b6b] px-3 py-1 font-display text-[20px] font-extrabold tracking-wide text-[#ff5b6b]">PASS</motion.span>
    </motion.div>
  );
}

function CardFace({ person, className }: { person: Person; className?: string }) {
  const initial = (person.display_name?.[0] ?? '?').toUpperCase();
  return (
    <div className={`lit-edge relative flex h-full w-full flex-col items-center justify-end overflow-hidden rounded-[28px] bg-gradient-to-b from-[#1a1430] to-[#0c0c14] ${className ?? ''}`}>
      <div className="pointer-events-none absolute -top-10 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-[#7a3bff]/25 blur-3xl" />
      <div className="relative flex flex-1 flex-col items-center justify-center pt-10">
        {person.avatar_url ? (
          <img src={person.avatar_url} alt="" className="h-32 w-32 rounded-full object-cover ring-4 ring-white/10" />
        ) : (
          <span className="grid h-32 w-32 place-items-center rounded-full bg-gradient-to-br from-[#9c8bff] to-[#6b3bff] font-display text-5xl font-bold ring-4 ring-white/10">{initial}</span>
        )}
      </div>
      <div className="relative w-full bg-gradient-to-t from-black/85 to-transparent px-5 pb-6 pt-10 text-center">
        <h2 className="text-[26px] font-light leading-tight" style={{ fontFamily: 'Fraunces, serif' }}>{person.display_name ?? 'Anonymous'}</h2>
        {person.tagline && <p className="mt-1 text-[13.5px] text-white/75">{person.tagline}</p>}
        <div className="mt-2 flex items-center justify-center gap-3 text-[11px] text-white/45">
          {person.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{person.location}</span>}
        </div>
        {person.bio && <p className="mt-2 line-clamp-2 text-[12px] leading-snug text-white/55">{person.bio}</p>}
      </div>
    </div>
  );
}

function AllCaught({ onReload, empty }: { onReload: () => void; empty: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <Sparkles className="h-8 w-8 text-[#7aa2ff]" />
      <div className="text-[17px] font-light italic text-white/75" style={{ fontFamily: 'Fraunces, serif' }}>{empty ? 'No new creators right now' : "That's everyone for now"}</div>
      <button onClick={onReload} className="flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-[13px] font-medium text-white/80"><RotateCcw className="h-4 w-4" />Refresh</button>
    </div>
  );
}
