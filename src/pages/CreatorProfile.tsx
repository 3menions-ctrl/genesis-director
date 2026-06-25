/**
 * CreatorProfile (/u/:id) — an IMMERSIVE, full-bleed creator card.
 *
 * Their image covers the whole page (everything but the bottom menu). Swipe
 * RIGHT to follow (send a request), LEFT to move on; X exits. You can still tap
 * their media to watch, and Message to DM. Premium: full-bleed cover, cinematic
 * scrims, serif name, drag overlays. Your own id redirects to /you.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, useMotionValue, useTransform, animate, type PanInfo } from 'framer-motion';
import { X, MessageCircle, UserPlus, UserCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePublicProfile } from '@/hooks/usePublicProfile';
import { MessageThread } from '@/components/social/MessageThread';
import { AuroraBackdrop } from '@/components/native/AuroraBackdrop';
import { hapticTap } from '@/lib/native/shell';
import { cn } from '@/lib/utils';

const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}k` : String(n));

interface Reel { id: string; title: string | null; thumbnail_url: string | null; play_count: number }

function useCreatorReels(creatorId?: string) {
  const [reels, setReels] = useState<Reel[]>([]);
  useEffect(() => {
    if (!creatorId) return;
    let cancel = false;
    (async () => {
      try {
        const { data } = await supabase.from('published_reels' as never)
          .select('id, title, thumbnail_url, play_count').eq('creator_id', creatorId).eq('is_taken_down', false)
          .order('play_count', { ascending: false }).limit(12);
        if (!cancel) setReels((data ?? []) as unknown as Reel[]);
      } catch { /* ignore */ }
    })();
    return () => { cancel = true; };
  }, [creatorId]);
  return reels;
}

export default function CreatorProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, isLoading, followUser } = usePublicProfile(id);
  const reels = useCreatorReels(id);
  const [messaging, setMessaging] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [cover, setCover] = useState<string | null>(null);

  useEffect(() => { if (id && user?.id === id) navigate('/you', { replace: true }); }, [id, user?.id, navigate]);

  // Best-effort cover photo (their uploaded cover) for the full-bleed background.
  useEffect(() => {
    if (!id) return; let c = false;
    (async () => {
      try {
        const { data } = await supabase.from('profiles' as never).select('cover_url').eq('id', id).maybeSingle();
        if (!c) setCover((data as { cover_url?: string | null } | null)?.cover_url ?? null);
      } catch { /* RLS / not available → avatar fallback */ }
    })();
    return () => { c = true; };
  }, [id]);

  const exit = () => { if (leaving) return; setLeaving(true); navigate(-1); };
  const doFollow = () => {
    if (!user) { navigate('/auth'); return; }
    if (!profile?.is_following) { followUser.mutate(); toast.success(`Following ${profile?.display_name ?? 'creator'}`); }
  };

  return (
    <div className="fixed inset-0 bg-[#0a0a0f] text-white">
      <AuroraBackdrop />
      {isLoading ? (
        <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-white/40" /></div>
      ) : !profile ? (
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <div className="text-[15px] text-white/50">Creator not found.</div>
          <button onClick={exit} className="rounded-full bg-white/[0.07] px-5 py-2 text-[13px] font-medium">Go back</button>
        </div>
      ) : (
        <SwipeProfile profile={profile} reels={reels} coverSrc={cover ?? profile.avatar_url}
          onFollow={() => { doFollow(); exit(); }} onMoveOn={exit}
          onMessage={() => { void hapticTap(); user ? setMessaging(true) : navigate('/auth'); }}
          onTapFollow={doFollow}
          onOpenReel={(rid) => navigate(`/r/${rid}`)} />
      )}

      {/* Exit */}
      {!isLoading && profile && (
        <button onClick={exit} aria-label="Exit" className="fixed z-30 grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur-md"
          style={{ top: 'calc(var(--safe-top,0px) + 12px)', left: '14px' }}><X className="h-5 w-5" /></button>
      )}

      {messaging && id && profile && <MessageThread recipientId={id} name={profile.display_name ?? 'creator'} avatar={profile.avatar_url} onClose={() => setMessaging(false)} />}
    </div>
  );
}

function SwipeProfile({ profile, reels, coverSrc, onFollow, onMoveOn, onMessage, onTapFollow, onOpenReel }: {
  profile: { display_name: string | null; avatar_url: string | null; followers_count: number; following_count: number; videos_count: number; is_following: boolean };
  reels: Reel[];
  coverSrc: string | null;
  onFollow: () => void; onMoveOn: () => void; onMessage: () => void; onTapFollow: () => void; onOpenReel: (id: string) => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-9, 9]);
  const followOp = useTransform(x, [40, 150], [0, 1]);
  const moveOp = useTransform(x, [-150, -40], [1, 0]);

  const onEnd = (_: unknown, info: PanInfo) => {
    const off = info.offset.x, vel = info.velocity.x;
    if (off > 120 || vel > 750) { void hapticTap(); void animate(x, 560, { duration: 0.3 }); onFollow(); }
    else if (off < -120 || vel < -750) { void hapticTap(); void animate(x, -560, { duration: 0.3 }); onMoveOn(); }
    else void animate(x, 0, { type: 'spring', stiffness: 320, damping: 28 });
  };

  const name = profile.display_name ?? 'Anonymous';
  const handle = `@${name.replace(/\s+/g, '').toLowerCase()}`;

  return (
    <motion.div style={{ x, rotate, bottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px))' }} drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.55} onDragEnd={onEnd}
      className="absolute inset-x-0 top-0 cursor-grab touch-pan-y overflow-hidden active:cursor-grabbing">
      <div className="absolute inset-0">
        {/* Full-bleed cover — their uploaded cover photo, else avatar */}
        {coverSrc ? (
          <img src={coverSrc} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#241a3a] to-[#0a0a0a]">
            <span className="font-display text-[120px] font-bold text-white/15">{name[0]?.toUpperCase()}</span>
          </div>
        )}
        {/* Scrims for legibility */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/55 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-black/92 via-black/55 to-transparent" />

        {/* Drag verdict overlays */}
        <motion.div style={{ opacity: followOp }} className="pointer-events-none absolute left-6 top-24 -rotate-12 rounded-xl border-[3px] border-[#5ee08a] px-4 py-1.5 font-display text-[28px] font-extrabold tracking-wide text-[#5ee08a]">FOLLOW</motion.div>
        <motion.div style={{ opacity: moveOp }} className="pointer-events-none absolute right-6 top-24 rotate-12 rounded-xl border-[3px] border-white/70 px-4 py-1.5 font-display text-[28px] font-extrabold tracking-wide text-white/80">LATER</motion.div>

        {/* Bottom content */}
        <div className="absolute inset-x-0 bottom-0 px-6 pb-6">
          <h1 className="text-[34px] font-light leading-none" style={{ fontFamily: 'Fraunces, serif' }}>{name}</h1>
          <div className="mt-1 font-mono text-[13px] text-white/55">{handle}</div>

          <div className="mt-3 flex items-center gap-5 text-[12.5px]">
            <span><b className="font-display text-[15px] font-semibold">{compact(profile.followers_count)}</b> <span className="text-white/55">followers</span></span>
            <span><b className="font-display text-[15px] font-semibold">{compact(profile.following_count)}</b> <span className="text-white/55">following</span></span>
            <span><b className="font-display text-[15px] font-semibold">{reels.length || profile.videos_count}</b> <span className="text-white/55">films</span></span>
          </div>

          {/* Their media — tap to watch (height-fixed → keeps each clip's aspect) */}
          {reels.length > 0 && (
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }} onPointerDownCapture={(e) => e.stopPropagation()}>
              {reels.map((r) => (
                <button key={r.id} onClick={() => onOpenReel(r.id)} className="lit-edge relative h-24 flex-none overflow-hidden rounded-xl bg-black/30">
                  {r.thumbnail_url ? <img src={r.thumbnail_url} alt={r.title ?? ''} className="block h-24 w-auto" /> : <div className="h-24 w-16 bg-gradient-to-br from-[#241a3a] to-[#0a0a0a]" />}
                </button>
              ))}
            </div>
          )}

          {/* Tap actions — borderless, floating icons with labels */}
          <div className="mt-5 flex items-center justify-center gap-14" onPointerDownCapture={(e) => e.stopPropagation()}>
            <FloatIcon label={profile.is_following ? 'Following' : 'Follow'} active={profile.is_following} onClick={onTapFollow}>
              {profile.is_following ? <UserCheck className="h-[26px] w-[26px]" strokeWidth={1.9} /> : <UserPlus className="h-[26px] w-[26px]" strokeWidth={1.9} />}
            </FloatIcon>
            <FloatIcon label="Message" onClick={onMessage}>
              <MessageCircle className="h-[26px] w-[26px]" strokeWidth={1.9} />
            </FloatIcon>
          </div>

          <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">Swipe → follow · ← later</p>
        </div>
      </div>
    </motion.div>
  );
}

function FloatIcon({ children, label, active, onClick }: { children: React.ReactNode; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={label} className={cn('flex flex-col items-center gap-1.5 transition-colors active:scale-95', active ? 'text-[#8fb4ff]' : 'text-white')}>
      <span className="relative grid place-items-center">
        <span className={cn('pointer-events-none absolute h-9 w-9 rounded-full blur-md', active ? 'bg-[#3f78ff]/45' : 'bg-white/15')} />
        <span className="relative">{children}</span>
      </span>
      <span className="font-display text-[11px] font-semibold drop-shadow">{label}</span>
    </button>
  );
}
