/**
 * CreatorProfile — a mobile public profile for another creator (route /u/:id).
 *
 * View their media (published reels, media-native aspect via MediaTile), follow
 * / unfollow (real user_follows graph through usePublicProfile), and send them a
 * direct message (send_direct_message, which enforces the recipient's DM
 * permission server-side). Your own id redirects to /you.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, MessageCircle, UserPlus, UserCheck, Send, X, Loader2, Clapperboard } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePublicProfile } from '@/hooks/usePublicProfile';
import { AuroraBackdrop } from '@/components/native/AuroraBackdrop';
import { MasonryGrid, MediaTile } from '@/components/native/MediaTile';
import { hapticTap } from '@/lib/native/shell';
import { cn } from '@/lib/utils';

const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}k` : String(n));

interface Reel { id: string; title: string | null; thumbnail_url: string | null; play_count: number }

function useCreatorReels(creatorId?: string) {
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!creatorId) return;
    let cancel = false; setLoading(true);
    (async () => {
      try {
        const { data } = await supabase.from('published_reels' as never)
          .select('id, title, thumbnail_url, play_count').eq('creator_id', creatorId).eq('is_taken_down', false)
          .order('play_count', { ascending: false }).limit(30);
        if (!cancel) { setReels((data ?? []) as unknown as Reel[]); setLoading(false); }
      } catch { if (!cancel) { setReels([]); setLoading(false); } }
    })();
    return () => { cancel = true; };
  }, [creatorId]);
  return { reels, loading };
}

export default function CreatorProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, isLoading, followUser, unfollowUser } = usePublicProfile(id);
  const { reels, loading } = useCreatorReels(id);
  const [messaging, setMessaging] = useState(false);

  // Your own card → the full owner profile.
  useEffect(() => { if (id && user?.id === id) navigate('/you', { replace: true }); }, [id, user?.id, navigate]);

  const name = profile?.display_name || 'Creator';
  const handle = `@${name.replace(/\s+/g, '').toLowerCase()}`;
  const isSelf = user?.id === id;

  const toggleFollow = () => {
    void hapticTap();
    if (!user) { navigate('/auth'); return; }
    if (profile?.is_following) unfollowUser.mutate(); else followUser.mutate();
  };

  return (
    <div className="fixed inset-0 overflow-y-auto text-white">
      <AuroraBackdrop />

      <button onClick={() => navigate(-1)} aria-label="Back" className="fixed z-20 grid h-9 w-9 place-items-center rounded-full bg-black/35 text-white backdrop-blur-md"
        style={{ top: 'calc(var(--safe-top,0px) + 12px)', left: '14px' }}><ChevronLeft className="h-5 w-5" /></button>

      <div className="relative z-10 px-5" style={{ paddingTop: 'calc(var(--safe-top,0px) + 64px)', paddingBottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 44px)' }}>
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-white/40" /></div>
        ) : !profile ? (
          <div className="py-20 text-center text-[14px] text-white/50">Creator not found.</div>
        ) : (
          <>
            {/* Identity */}
            <div className="flex flex-col items-center text-center">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-24 w-24 rounded-full object-cover ring-4 ring-[#0a0a0f]" />
              ) : (
                <span className="grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-[#9c8bff] to-[#6b3bff] font-display text-3xl font-bold ring-4 ring-[#0a0a0f]">{name[0]?.toUpperCase()}</span>
              )}
              <h1 className="mt-3 text-[25px] font-light leading-tight" style={{ fontFamily: 'Fraunces, serif' }}>{name}</h1>
              <div className="font-mono text-[12.5px] text-white/40">{handle}</div>
            </div>

            {/* Stats */}
            <div className="mt-6 flex items-stretch">
              <Stat label="Followers" value={compact(profile.followers_count)} />
              <Stat label="Following" value={compact(profile.following_count)} divider />
              <Stat label="Films" value={String(reels.length || profile.videos_count)} divider />
            </div>

            {/* Actions */}
            {!isSelf && (
              <div className="mt-6 flex gap-3">
                <button onClick={toggleFollow}
                  className={cn('flex h-12 flex-1 items-center justify-center gap-2 rounded-full font-display text-[14.5px] font-bold transition-colors',
                    profile.is_following ? 'bg-white/[0.07] text-white/85' : 'bg-gradient-to-r from-[#2f6bff] to-[#7a3bff] text-white')}>
                  {profile.is_following ? <><UserCheck className="h-[18px] w-[18px]" />Following</> : <><UserPlus className="h-[18px] w-[18px]" />Follow</>}
                </button>
                <button onClick={() => { void hapticTap(); user ? setMessaging(true) : navigate('/auth'); }} aria-label="Message"
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-white/[0.07] font-display text-[14.5px] font-bold text-white/85">
                  <MessageCircle className="h-[18px] w-[18px]" />Message
                </button>
              </div>
            )}

            {/* Media */}
            <div className="mt-8">
              <div className="mb-3 flex items-center gap-2">
                <Clapperboard className="h-3.5 w-3.5 text-white/45" strokeWidth={1.8} />
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">Media</span>
              </div>
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-white/40" /></div>
              ) : reels.length === 0 ? (
                <div className="py-12 text-center text-[13px] text-white/40">No public films yet.</div>
              ) : (
                <MasonryGrid cols={2}>
                  {reels.map((r) => (
                    <MediaTile key={r.id} src={r.thumbnail_url} title={r.title} play={r.play_count} onClick={() => navigate(`/r/${r.id}`)} />
                  ))}
                </MasonryGrid>
              )}
            </div>
          </>
        )}
      </div>

      {messaging && id && <MessageSheet recipientId={id} name={name} onClose={() => setMessaging(false)} />}
    </div>
  );
}

function Stat({ label, value, divider }: { label: string; value: string; divider?: boolean }) {
  return (
    <div className={cn('flex flex-1 flex-col items-center', divider && 'border-l border-white/[0.08]')}>
      <span className="font-display text-[19px] font-semibold tabular-nums">{value}</span>
      <span className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-white/45">{label}</span>
    </div>
  );
}

function MessageSheet({ recipientId, name, onClose }: { recipientId: string; name: string; onClose: () => void }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    void hapticTap();
    setSending(true);
    try {
      const { error } = await supabase.rpc('send_direct_message' as never, { p_recipient: recipientId, p_content: body } as never);
      if (error) {
        const m = error.message || '';
        if (m.includes('recipient_dms_disabled')) throw new Error("This creator isn't accepting messages.");
        if (m.includes('recipient_dms_followers_only')) throw new Error('They only accept messages from people they follow.');
        if (m.includes('blocked')) throw new Error('You can’t message this creator.');
        throw new Error(m || 'Could not send');
      }
      toast.success(`Message sent to ${name}`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not send');
    } finally { setSending(false); }
  };
  return (
    <div className="fixed inset-0 z-[60]">
      <div onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div className="absolute inset-x-0 bottom-0 rounded-t-[28px] bg-[#0c0c12]/96 px-5 pt-3 backdrop-blur-2xl" style={{ paddingBottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 14px)' }}>
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/15" />
        <div className="mb-3 flex items-center justify-between">
          <span className="font-display text-[15px] font-semibold">Message {name}</span>
          <button onClick={onClose} aria-label="Close" className="text-white/50"><X className="h-5 w-5" /></button>
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} autoFocus placeholder={`Say something to ${name}…`}
          className="surface-1 w-full resize-none rounded-[18px] bg-transparent px-4 py-3 text-[15px] text-white outline-none placeholder:text-white/30" />
        <button onClick={send} disabled={!text.trim() || sending}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#2f6bff] to-[#7a3bff] font-display text-[15px] font-bold disabled:opacity-50">
          {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Send className="h-[18px] w-[18px]" />Send</>}
        </button>
      </div>
    </div>
  );
}
