/**
 * NativeLive — the live feature.
 *   • /live        → the Live lobby: active rooms + "Go Live".
 *   • /live/:id     → a live room.
 *
 * The live SOCIAL + ECONOMY layer is fully real over Supabase Realtime: presence
 * (viewer count), broadcast chat, floating reactions, and credit gifts (tip_reel
 * on the host's top reel). The host's own camera is shown via getUserMedia.
 *
 * NB: true 1-to-many video fan-out needs a media server (LiveKit/Agora/SFU). Until
 * that's wired, viewers see the host's poster as the stage while sharing the full
 * live room (chat/gifts/reactions/viewers) — the part that drives engagement.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Radio, Users, Heart, Send, Gift as GiftIcon, X, Loader2, Plus, Video, VideoOff } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AuroraBackdrop } from '@/components/native/AuroraBackdrop';
import { GiftSheet } from '@/components/native/GiftSheet';
import { LiveRTC } from '@/lib/native/liveBroadcast';
import { hapticTap } from '@/lib/native/shell';
import { cn } from '@/lib/utils';

interface Room { id: string; host_id: string; title: string; status: string }
interface HostInfo { name: string; avatar: string | null; topReel: string | null }
interface ChatMsg { id: string; name: string; text: string; gift?: { emoji: string; cr: number } }
const REACTIONS = ['❤️', '🔥', '😮', '👏', '🎉'];

export default function NativeLive() {
  const { id } = useParams<{ id: string }>();
  return id ? <LiveRoom roomId={id} /> : <LiveLobby />;
}

/* ── Lobby ──────────────────────────────────────────────────────── */
function LiveLobby() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rooms, setRooms] = useState<(Room & { host?: HostInfo })[]>([]);
  const [loading, setLoading] = useState(true);
  const [going, setGoing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('live_rooms' as never).select('id, host_id, title, status').eq('status', 'live').order('started_at', { ascending: false }).limit(40);
      const rs = (data ?? []) as unknown as Room[];
      const ids = [...new Set(rs.map((r) => r.host_id))];
      let profs: Record<string, HostInfo> = {};
      if (ids.length) {
        const { data: pd } = await supabase.from('profiles_public' as never).select('id, display_name, avatar_url').in('id', ids);
        for (const p of ((pd ?? []) as unknown as { id: string; display_name: string | null; avatar_url: string | null }[])) profs[p.id] = { name: p.display_name ?? 'Live', avatar: p.avatar_url, topReel: null };
      }
      setRooms(rs.map((r) => ({ ...r, host: profs[r.host_id] })));
    } catch { setRooms([]); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const goLive = async () => {
    void hapticTap();
    if (!user) { navigate('/auth'); return; }
    setGoing(true);
    try {
      const { data, error } = await supabase.from('live_rooms' as never)
        .insert({ host_id: user.id, title: 'Live now', kind: 'person', status: 'live' } as never)
        .select('id').single();
      if (error) throw error;
      navigate(`/live/${(data as unknown as { id: string }).id}`);
    } catch { toast.error("Couldn't start your live."); setGoing(false); }
  };

  return (
    <div className="fixed inset-0 overflow-y-auto text-white">
      <AuroraBackdrop />
      <div className="relative z-10 flex items-center gap-3 px-4 pb-1" style={{ paddingTop: 'calc(var(--safe-top,0px) + 12px)' }}>
        <button onClick={() => navigate(-1)} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06] backdrop-blur-md"><ChevronLeft className="h-[18px] w-[18px]" /></button>
        <h1 className="font-display text-[20px] font-semibold">Live</h1>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[#ff3b5c]/20 px-3 py-1 font-mono text-[11px] font-semibold text-[#ff8aa0]"><Radio className="h-3 w-3" />{rooms.length} on</span>
      </div>

      <div className="relative z-10 px-4" style={{ paddingBottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 120px)' }}>
        {loading ? (
          <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-white/40" /></div>
        ) : rooms.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <Video className="h-9 w-9 text-[#ff8aa0]" />
            <div className="text-[16px] font-light italic text-white/75" style={{ fontFamily: 'Fraunces, serif' }}>Nobody's live right now</div>
            <div className="text-[13px] text-white/45">Be the first — go live and bring your fans in.</div>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3">
            {rooms.map((r) => (
              <button key={r.id} onClick={() => { void hapticTap(); navigate(`/live/${r.id}`); }} className="lit-edge relative aspect-[3/4] overflow-hidden rounded-[18px] bg-gradient-to-b from-[#241a3d] to-[#0b0b12] text-left">
                {r.host?.avatar && <img src={r.host.avatar} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/20" />
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[#ff3b5c] px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide"><span className="h-1.5 w-1.5 rounded-full bg-white" />Live</span>
                <div className="absolute inset-x-0 bottom-0 p-2.5">
                  <div className="truncate font-display text-[13.5px] font-semibold drop-shadow">{r.host?.name ?? 'Live'}</div>
                  <div className="truncate text-[11px] text-white/60">{r.title}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 z-20 flex flex-col items-center" style={{ bottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 16px)' }}>
        <button onClick={goLive} disabled={going} aria-label="Go live" className="grid h-[68px] w-[68px] place-items-center text-[#ff7a96] drop-shadow-[0_3px_12px_rgba(0,0,0,.6)] transition-transform active:scale-90 disabled:opacity-50">
          {going ? <Loader2 className="h-6 w-6 animate-spin" /> : <Plus className="h-8 w-8" strokeWidth={2.6} />}
        </button>
        <span className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/55">Go live</span>
      </div>
    </div>
  );
}

/* ── Room ───────────────────────────────────────────────────────── */
function LiveRoom({ roomId }: { roomId: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [host, setHost] = useState<HostInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewers, setViewers] = useState(1);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [floats, setFloats] = useState<{ id: number; emoji: string }[]>([]);
  const [draft, setDraft] = useState('');
  const [giftOpen, setGiftOpen] = useState(false);
  const [ending, setEnding] = useState(false);
  const [live, setLive] = useState(false); // viewer: host stream connected
  const [mediaErr, setMediaErr] = useState(false); // host: camera/mic denied
  const [connectTimedOut, setConnectTimedOut] = useState(false); // viewer: no stream
  const chanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const rtcRef = useRef<LiveRTC | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);       // host: own camera
  const remoteRef = useRef<HTMLVideoElement>(null);      // viewer: host's stream
  const streamRef = useRef<MediaStream | null>(null);
  const floatId = useRef(0);
  const isHost = !!user && !!room && room.host_id === user.id;
  const myName = useMemo(() => (user?.email?.split('@')[0] ?? 'guest'), [user]);

  // Load the room + host.
  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase.from('live_rooms' as never).select('id, host_id, title, status').eq('id', roomId).maybeSingle();
      const r = data as unknown as Room | null;
      if (cancel) return;
      if (!r) { setLoading(false); return; }
      setRoom(r);
      const { data: pd } = await supabase.from('profiles_public' as never).select('display_name, avatar_url').eq('id', r.host_id).maybeSingle();
      const p = pd as unknown as { display_name: string | null; avatar_url: string | null } | null;
      let topReel: string | null = null;
      try {
        const { data: rl } = await supabase.from('published_reels' as never).select('id').eq('creator_id', r.host_id).eq('is_taken_down', false).order('play_count', { ascending: false }).limit(1);
        topReel = ((rl ?? []) as unknown as { id: string }[])[0]?.id ?? null;
      } catch { /* host may have no reel */ }
      if (!cancel) { setHost({ name: p?.display_name ?? 'Live', avatar: p?.avatar_url ?? null, topReel }); setLoading(false); }
    })();
    return () => { cancel = true; };
  }, [roomId]);

  // Realtime: presence (viewers) + broadcast chat/reactions/gifts + WebRTC
  // signalling. Gated on `room` so the host/viewer role is known up front.
  useEffect(() => {
    if (!user || !room) return;
    const host = room.host_id === user.id;
    const ch = supabase.channel(`live-${roomId}`, { config: { presence: { key: user.id }, broadcast: { self: true } } });
    const send = (event: string, payload: Record<string, unknown>) => { void ch.send({ type: 'broadcast', event, payload }); };

    // Live-video transport: host streams its camera to each viewer over WebRTC.
    const rtc = new LiveRTC({
      isHost: host, selfId: user.id, send,
      getLocalStream: () => streamRef.current,
      onRemoteStream: (stream) => { if (remoteRef.current) { remoteRef.current.srcObject = stream; void remoteRef.current.play().catch(() => {}); } setLive(true); },
    });
    rtcRef.current = rtc;

    ch.on('presence', { event: 'sync' }, () => setViewers(Math.max(1, Object.keys(ch.presenceState()).length)));
    ch.on('broadcast', { event: 'chat' }, ({ payload }) => setChat((c) => [...c.slice(-50), payload as ChatMsg]));
    ch.on('broadcast', { event: 'reaction' }, ({ payload }) => pushFloat((payload as { emoji: string }).emoji));
    ch.on('broadcast', { event: 'gift' }, ({ payload }) => {
      const g = payload as { name: string; emoji: string; cr: number };
      setChat((c) => [...c.slice(-50), { id: `${Date.now()}`, name: g.name, text: '', gift: { emoji: g.emoji, cr: g.cr } }]);
      for (let i = 0; i < 8; i++) window.setTimeout(() => pushFloat(g.emoji), i * 90);
    });
    // WebRTC signalling (targeted by `to`).
    ch.on('broadcast', { event: 'rtc-join' }, ({ payload }) => { void rtc.onJoin((payload as { viewerId: string }).viewerId); });
    ch.on('broadcast', { event: 'rtc-offer' }, ({ payload }) => { const p = payload as { to: string; from: string; sdp: RTCSessionDescriptionInit }; if (p.to === user.id) void rtc.onOffer(p.from, p.sdp); });
    ch.on('broadcast', { event: 'rtc-answer' }, ({ payload }) => { const p = payload as { to: string; from: string; sdp: RTCSessionDescriptionInit }; if (p.to === user.id) void rtc.onAnswer(p.from, p.sdp); });
    ch.on('broadcast', { event: 'rtc-ice' }, ({ payload }) => { const p = payload as { to: string; from: string; candidate: RTCIceCandidateInit }; if (p.to === user.id) void rtc.onIce(p.from, p.candidate); });

    ch.subscribe(async (s) => { if (s === 'SUBSCRIBED') { await ch.track({ name: myName, at: Date.now() }); rtc.announce(); } });
    chanRef.current = ch;
    return () => { rtc.destroy(); rtcRef.current = null; void supabase.removeChannel(ch); chanRef.current = null; };
  }, [roomId, user, room, myName]);

  // Host camera + mic. Try A/V; fall back to video-only if the mic is denied.
  useEffect(() => {
    if (!isHost) return;
    let cancel = false;
    (async () => {
      let stream: MediaStream | null = null;
      try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true }); }
      catch { try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false }); } catch { /* no camera */ } }
      if (!stream) { if (!cancel) { setMediaErr(true); toast.error('Camera unavailable — enable camera access in Settings.'); } return; }
      if (cancel) { stream.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; void videoRef.current.play().catch(() => {}); }
      // Offer to any viewers that joined while we were acquiring the camera.
      void rtcRef.current?.flushPending();
    })();
    return () => { cancel = true; streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; };
  }, [isHost]);

  // Viewer: if the host's stream never connects, stop saying "Connecting…" forever.
  useEffect(() => {
    if (isHost || live) { setConnectTimedOut(false); return; }
    const t = window.setTimeout(() => setConnectTimedOut(true), 18000);
    return () => window.clearTimeout(t);
  }, [isHost, live]);

  const pushFloat = (emoji: string) => {
    const fid = ++floatId.current;
    setFloats((f) => [...f.slice(-24), { id: fid, emoji }]);
    window.setTimeout(() => setFloats((f) => f.filter((x) => x.id !== fid)), 2600);
  };

  const sendChat = () => {
    const t = draft.trim(); if (!t || !chanRef.current) return;
    void hapticTap();
    void chanRef.current.send({ type: 'broadcast', event: 'chat', payload: { id: `${Date.now()}`, name: myName, text: t } });
    setDraft('');
  };
  const react = (emoji: string) => { void hapticTap(); void chanRef.current?.send({ type: 'broadcast', event: 'reaction', payload: { emoji } }); pushFloat(emoji); };

  const onGifted = (g: { emoji: string; cr: number }) => {
    void chanRef.current?.send({ type: 'broadcast', event: 'gift', payload: { name: myName, emoji: g.emoji, cr: g.cr } });
  };

  const leave = async () => {
    void hapticTap();
    if (isHost) {
      setEnding(true);
      try { await supabase.rpc('end_live_room' as never, { p_room_id: roomId } as never); } catch { /* best-effort */ }
    }
    navigate('/live', { replace: true });
  };

  if (loading) return <div className="fixed inset-0 grid place-items-center bg-black text-white"><Loader2 className="h-6 w-6 animate-spin text-white/40" /></div>;
  if (!room || room.status !== 'live') return (
    <div className="fixed inset-0 grid place-items-center bg-black text-white">
      <div className="text-center"><p className="text-[14px] text-white/55">This live has ended.</p><button onClick={() => navigate('/live', { replace: true })} className="mt-3 rounded-full bg-white/10 px-4 py-2 text-[13px] font-semibold">Back to Live</button></div>
    </div>
  );

  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-white">
      {/* Stage */}
      {isHost ? (
        <>
          <video ref={videoRef} muted playsInline autoPlay className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />
          {mediaErr && (
            <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-[#241a3d] to-[#0a0a0a] px-8 text-center">
              <div><VideoOff className="mx-auto h-8 w-8 text-white/55" /><p className="mt-3 text-[14px] font-semibold">Camera unavailable</p><p className="mt-1 text-[12.5px] text-white/45">Enable camera access for Small Bridges in Settings, then go live again.</p></div>
            </div>
          )}
        </>
      ) : (
        <>
          {host?.avatar ? <img src={host.avatar} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover blur-sm" /> : <div className="absolute inset-0 bg-gradient-to-br from-[#241a3d] to-[#0a0a0a]" />}
          <video ref={remoteRef} playsInline autoPlay className={cn('absolute inset-0 h-full w-full object-contain transition-opacity duration-500', live ? 'opacity-100' : 'opacity-0')} />
          {!live && (
            <div className="absolute inset-0 grid place-items-center px-8 text-center">
              {connectTimedOut
                ? <span className="rounded-2xl bg-black/55 px-4 py-3 text-[13px] leading-relaxed backdrop-blur-md">Couldn't connect to the stream — the host may have dropped. <button onClick={leave} className="font-semibold text-[#8fb4ff]">Go back</button></span>
                : <span className="inline-flex items-center gap-2 rounded-full bg-black/45 px-3.5 py-2 text-[12.5px] backdrop-blur-md"><Loader2 className="h-3.5 w-3.5 animate-spin" />Connecting to live…</span>}
            </div>
          )}
        </>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/45" />

      {/* Top bar */}
      <div className="absolute inset-x-0 z-30 flex items-center gap-2 px-3" style={{ top: 'calc(var(--safe-top,0px) + 10px)' }}>
        <div className="flex items-center gap-2 rounded-full bg-black/45 py-1 pl-1 pr-3 backdrop-blur-md">
          {host?.avatar ? <img src={host.avatar} className="h-6 w-6 rounded-full object-cover" alt="" /> : <span className="grid h-6 w-6 place-items-center rounded-full bg-white/15 text-[12px] font-bold">{(host?.name ?? 'L')[0]}</span>}
          <span className="max-w-[36vw] truncate text-[13px] font-semibold">{host?.name ?? 'Live'}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#ff3b5c] px-1.5 py-0.5 font-mono text-[8.5px] font-bold uppercase"><span className="h-1.5 w-1.5 rounded-full bg-white" />Live</span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-[12px] font-semibold backdrop-blur-md"><Users className="h-3.5 w-3.5" />{viewers}</span>
        <button onClick={leave} aria-label={isHost ? 'End live' : 'Leave'} className="ml-auto grid h-9 w-9 place-items-center rounded-full bg-black/45 backdrop-blur-md active:scale-95">{ending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-[18px] w-[18px]" />}</button>
      </div>

      {/* Floating reactions */}
      <div className="pointer-events-none absolute bottom-28 right-3 z-20 h-[50vh] w-24">
        {floats.map((f) => (
          <span key={f.id} className="absolute bottom-0 right-6 animate-[floatUp_2.6s_ease-out_forwards] text-[30px]" style={{ right: `${(f.id % 5) * 12}px` }}>{f.emoji}</span>
        ))}
      </div>

      {/* Chat */}
      <div className="absolute inset-x-0 z-20 px-3" style={{ bottom: 'calc(var(--safe-bottom,0px) + 76px)' }}>
        <div className="max-h-[34vh] space-y-1.5 overflow-y-auto pr-16" style={{ maskImage: 'linear-gradient(to top, black 75%, transparent)' }}>
          {chat.map((m) => (
            <div key={m.id} className="w-fit max-w-[78%] rounded-2xl bg-black/45 px-3 py-1.5 backdrop-blur-md">
              {m.gift ? (
                <span className="text-[13px]"><b className="text-[#ffd76b]">{m.name}</b> sent {m.gift.emoji} <span className="font-mono text-[11px] text-[#8fb4ff]">{m.gift.cr}cr</span></span>
              ) : (
                <span className="text-[13px]"><b className="text-[#8fb4ff]">{m.name}</b> {m.text}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom controls */}
      <div className="absolute inset-x-0 z-30 flex items-center gap-2 px-3" style={{ bottom: 'calc(var(--safe-bottom,0px) + 14px)' }}>
        <div className="flex flex-1 items-center gap-2 rounded-full bg-black/45 px-4 py-2.5 backdrop-blur-md">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') sendChat(); }} placeholder="Say something…" className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-white/40" />
          <button onClick={sendChat} aria-label="Send" className="text-[#8fb4ff]"><Send className="h-[18px] w-[18px]" /></button>
        </div>
        {REACTIONS.slice(0, 2).map((e) => <button key={e} onClick={() => react(e)} className="grid h-11 w-11 place-items-center rounded-full bg-black/45 text-[20px] backdrop-blur-md active:scale-90">{e}</button>)}
        {!isHost && (
          <button onClick={() => { void hapticTap(); host?.topReel ? setGiftOpen(true) : react('🎉'); }} aria-label="Gift" className="grid h-11 w-11 place-items-center text-[#9fc6ff] drop-shadow-[0_2px_8px_rgba(0,0,0,.7)] active:scale-90"><GiftIcon className="h-[22px] w-[22px]" /></button>
        )}
      </div>

      {host?.topReel && <GiftSheet open={giftOpen} onClose={() => setGiftOpen(false)} reelId={host.topReel} creatorName={host.name} onSent={(g) => onGifted({ emoji: g.emoji, cr: g.cr })} />}
    </div>
  );
}
