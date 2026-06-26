/**
 * ReelViewer — the NATIVE immersive single-reel player. Opening any reel on the
 * mobile app (/r/:id) must be 100% full-screen: no web sidebar, no chrome. This
 * is a single full-bleed FeedVideo with the floating action rail + caption + a
 * close button, mirroring the feed. Reuses FeedVideo + FeedComments.
 */
import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { X, Heart, MessageCircle, Repeat2, Share2, Volume2, VolumeX, Loader2, Gift } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FILMS } from '@/data/filmsLibrary';
import { FeedVideo } from '@/components/feed/FeedVideo';
import { FeedComments } from '@/components/feed/FeedComments';
import { GiftSheet } from '@/components/native/GiftSheet';
import { GrainOverlay } from '@/components/native/AuroraBackdrop';
import { hapticTap, shareLink } from '@/lib/native/shell';
import { cn } from '@/lib/utils';

const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}k` : String(n));

interface Reel {
  id: string; video_url: string; thumbnail_url: string | null; title: string | null; synopsis: string | null;
  tags: string[]; creator_id: string; like_count: number; comment_count: number; project_id: string | null;
  creator_name?: string | null; creator_avatar?: string | null; isStatic?: boolean;
}

// Bundled sample film → an immersive reel (for demo/anon taps on static cards).
function filmToReel(id: string): Reel | null {
  const f = FILMS.find((x) => x.id === id && x.clips?.[0]);
  if (!f) return null;
  return { id, video_url: f.clips[0], thumbnail_url: null, title: f.title, synopsis: (f as { synopsis?: string }).synopsis ?? null, tags: [], creator_id: '', like_count: 0, comment_count: 0, project_id: null, creator_name: 'Small Bridges', isStatic: true };
}

export default function ReelViewer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [reel, setReel] = useState<Reel | null>(null);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancel = false; setLoading(true);
    (async () => {
      try {
        // NB: omit comment_count here — it's column-restricted for anon and would
        // 400 the whole query. The real count loads when comments open.
        const { data } = await supabase.from('published_reels' as never)
          .select('id, video_url, thumbnail_url, title, synopsis, tags, creator_id, like_count, project_id')
          .eq('id', id).eq('is_taken_down', false).maybeSingle();
        const r = data as unknown as Reel | null;
        if (!r) { if (!cancel) { setReel(filmToReel(id)); setLoading(false); } return; }
        let name: string | null = null, avatar: string | null = null;
        try {
          const { data: prof } = await supabase.from('profiles_public' as never).select('display_name, avatar_url').eq('id', r.creator_id).maybeSingle();
          const p = prof as unknown as { display_name: string | null; avatar_url: string | null } | null;
          name = p?.display_name ?? null; avatar = p?.avatar_url ?? null;
        } catch { /* creator best-effort */ }
        if (!cancel) {
          setReel({ ...r, creator_name: name, creator_avatar: avatar });
          setLikeCount(r.like_count ?? 0); setLoading(false);
        }
        // Comment count: separate best-effort head count (the published_reels
        // comment_count column is anon-restricted, so we can't select it inline).
        try {
          const { count } = await supabase.from('reel_comments' as never).select('id', { count: 'exact', head: true }).eq('reel_id', r.id);
          if (!cancel && typeof count === 'number') setCommentCount(count);
        } catch { /* count is best-effort */ }
      } catch { if (!cancel) { setReel(filmToReel(id)); setLoading(false); } }
    })();
    return () => { cancel = true; };
  }, [id]);

  const close = () => { void hapticTap(); if (window.history.length > 1) navigate(-1); else navigate('/feed'); };

  const like = useCallback(async () => {
    void hapticTap();
    if (reel?.isStatic) { toast('Sign in on the full app to like films'); return; }
    if (!user) { toast.error('Sign in to like'); navigate('/auth'); return; }
    if (!reel) return;
    const was = liked; setLiked(!was); setLikeCount((c) => Math.max(0, c + (was ? -1 : 1)));
    try { const { error } = await supabase.rpc('toggle_like_reel' as never, { p_reel_id: reel.id } as never); if (error) throw error; }
    catch { setLiked(was); setLikeCount((c) => Math.max(0, c + (was ? 1 : -1))); toast.error("Couldn't update like"); }
  }, [liked, reel, user, navigate]);

  const remix = useCallback(async () => {
    void hapticTap();
    if (reel?.isStatic) { navigate(`/studio?prompt=${encodeURIComponent(reel.title ?? '')}`); return; }
    if (!user) { toast.error('Sign in to remix'); navigate('/auth'); return; }
    if (!reel || busy) return; setBusy(true);
    try {
      const { data, error } = await supabase.rpc('remix_reel' as never, { p_reel_id: reel.id } as never);
      if (error) throw error;
      const out = data as { new_project_id?: string };
      if (out?.new_project_id) { toast.success('Remix started'); navigate(`/editor/${out.new_project_id}`); }
      else navigate(`/studio?prompt=${encodeURIComponent(reel.title ?? '')}`);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Remix failed'); } finally { setBusy(false); }
  }, [reel, user, busy, navigate]);

  const share = useCallback(async () => {
    void hapticTap();
    if (!reel) return;
    await shareLink({ title: reel.title ?? 'A film on Small Bridges', url: `${window.location.origin}/r/${reel.id}` });
  }, [reel]);

  if (loading) return <div className="fixed inset-0 grid place-items-center bg-black text-white"><Loader2 className="h-7 w-7 animate-spin text-white/40" /></div>;
  if (!reel) return (
    <div className="fixed inset-0 grid place-items-center bg-black text-white">
      <div className="text-center"><p className="text-[14px] text-white/55">This reel isn't available.</p><button onClick={close} className="mt-3 rounded-full bg-white/10 px-4 py-2 text-[13px] font-semibold">Back</button></div>
    </div>
  );

  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-white">
      <FeedVideo src={reel.video_url} poster={reel.thumbnail_url ?? undefined} active muted={muted} />
      <GrainOverlay opacity={0.05} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/60 via-black/10 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-80 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

      {/* Close + mute */}
      <button onClick={close} aria-label="Close" className="absolute left-3 z-30 grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur-md active:scale-95" style={{ top: 'calc(var(--safe-top,0px) + 10px)' }}><X className="h-5 w-5" /></button>
      <button onClick={() => { void hapticTap(); setMuted((m) => !m); }} aria-label={muted ? 'Unmute' : 'Mute'} className="absolute right-3 z-30 grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur-md active:scale-95" style={{ top: 'calc(var(--safe-top,0px) + 10px)' }}>{muted ? <VolumeX className="h-[18px] w-[18px]" /> : <Volume2 className="h-[18px] w-[18px]" />}</button>

      {/* Right rail — anchored to the bottom safe area (no tab bar here) */}
      <div className="absolute right-3 z-20 flex flex-col items-center gap-5" style={{ bottom: 'calc(var(--safe-bottom,0px) + 28px)' }}>
        <button onClick={() => navigate(reel.creator_id ? `/u/${reel.creator_id}` : '/you')} aria-label="Creator" className="relative drop-shadow-[0_4px_12px_rgba(0,0,0,.6)]">
          {reel.creator_avatar ? <img src={reel.creator_avatar} alt="" className="h-12 w-12 rounded-full object-cover" /> : <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-[#ffb86b] to-[#ff6bcb] font-display text-lg font-bold">{(reel.creator_name ?? 'S').charAt(0).toUpperCase()}</span>}
        </button>
        <Rail label={compact(likeCount)} onClick={like} active={liked}><Heart className={cn('h-7 w-7', liked && 'fill-[#ff3b6b] stroke-[#ff3b6b]')} /></Rail>
        <Rail label={commentCount > 0 ? compact(commentCount) : 'Comments'} onClick={() => { void hapticTap(); setCommentsOpen(true); }}><MessageCircle className="h-7 w-7" /></Rail>
        {!reel.isStatic && <Rail label="Gift" highlight onClick={() => { void hapticTap(); setGiftOpen(true); }}><Gift className="h-7 w-7" /></Rail>}
        <Rail label="Remix" onClick={remix}><Repeat2 className="h-7 w-7" /></Rail>
        <Rail label="Share" onClick={share}><Share2 className="h-7 w-7" /></Rail>
      </div>

      {/* Caption */}
      <div className="absolute left-4 z-20 max-w-[72%]" style={{ bottom: 'calc(var(--safe-bottom,0px) + 30px)' }}>
        <button onClick={() => navigate(reel.creator_id ? `/u/${reel.creator_id}` : '/you')} className="flex items-center gap-2 font-display text-[16px] font-bold">@{(reel.creator_name ?? 'smallbridges').replace(/\s+/g, '').toLowerCase()}<span className="text-[#7aa2ff]">✦</span></button>
        {(reel.title || reel.synopsis) && <div className="mt-1.5 line-clamp-2 text-[14px] leading-snug text-white/90">{reel.synopsis || reel.title}</div>}
        {reel.tags?.length > 0 && <div className="mt-1.5 line-clamp-1 text-[13px] font-semibold text-[#7aa2ff]">{reel.tags.slice(0, 3).map((t) => `#${t}`).join(' ')}</div>}
      </div>

      <FeedComments open={commentsOpen} reelId={reel.id} isStatic={reel.isStatic ?? false} onClose={() => setCommentsOpen(false)} onPosted={() => setCommentCount((c) => c + 1)} />
      <GiftSheet open={giftOpen} onClose={() => setGiftOpen(false)} reelId={reel.id} creatorName={reel.creator_name ?? 'this creator'} />
    </div>
  );
}

function Rail({ children, label, onClick, highlight, active }: { children: React.ReactNode; label: string; onClick: () => void; highlight?: boolean; active?: boolean }) {
  return (
    <button onClick={onClick} className={cn('flex flex-col items-center gap-1 drop-shadow-[0_2px_6px_rgba(0,0,0,.6)] transition-transform', highlight ? 'text-[#8fb4ff]' : 'text-white', active && 'scale-105')}>
      {children}<span className="font-display text-[11px] font-semibold tabular-nums">{label}</span>
    </button>
  );
}
