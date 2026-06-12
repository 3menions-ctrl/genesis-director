/**
 * WatchParty — runs a synchronized group viewing of a reel.
 *
 * The host's playback state (current time + paused/playing) is broadcast
 * over Supabase Realtime; guests' players seek/play/pause to match.
 * A right-rail chat lets the group react in real time.
 *
 * Mount this component inside the Theater view when a watch_party_id is
 * present in the URL; the parent owns the <video> ref.
 */
import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ChatMessage {
  id: number | string;
  user_id: string | null;
  body: string;
  created_at: string;
}

interface Sync {
  t: number;          // currentTime
  paused: boolean;
  ts: number;         // sender wall clock (ms)
}

interface Props {
  partyId: string;
  hostId: string;
  videoRef: React.RefObject<HTMLVideoElement>;
}

export function WatchParty({ partyId, hostId, videoRef }: Props) {
  const { user } = useAuth();
  const isHost = user?.id === hostId;
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSyncRef = useRef<Sync | null>(null);

  // Subscribe to chat + sync.
  useEffect(() => {
    const channel = supabase.channel(`watch-party-${partyId}`, {
      config: { broadcast: { ack: true } },
    });
    channelRef.current = channel;

    // Chat (broadcast — quick); also fetch initial 50 from DB.
    void (async () => {
      const { data } = await supabase
        .from("watch_party_chat")
        .select("id, user_id, body, created_at")
        .eq("party_id", partyId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (data) setChat((data as ChatMessage[]).reverse());
    })();

    channel.on("broadcast", { event: "chat" }, ({ payload }) => {
      setChat((c) => [...c, payload as ChatMessage]);
    });

    // Playback sync — only the host emits; guests apply.
    channel.on("broadcast", { event: "sync" }, ({ payload }) => {
      if (isHost) return;
      const s = payload as Sync;
      lastSyncRef.current = s;
      const video = videoRef.current;
      if (!video) return;
      // Account for the latency between the host's tick and our render.
      const slip = Math.max(0, (Date.now() - s.ts) / 1000);
      const target = s.t + (s.paused ? 0 : slip);
      if (Math.abs(video.currentTime - target) > 0.6) {
        video.currentTime = target;
      }
      if (s.paused && !video.paused) video.pause();
      if (!s.paused && video.paused) void video.play().catch(() => {});
    });

    channel.subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [partyId, isHost, videoRef]);

  // Host: broadcast playback state once per second.
  useEffect(() => {
    if (!isHost) return;
    const id = setInterval(() => {
      const video = videoRef.current;
      const channel = channelRef.current;
      if (!video || !channel) return;
      void channel.send({
        type: "broadcast",
        event: "sync",
        payload: {
          t: video.currentTime,
          paused: video.paused,
          ts: Date.now(),
        } satisfies Sync,
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isHost, videoRef]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim().slice(0, 500);
    if (!body || !user) return;
    setDraft("");
    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      user_id: user.id,
      body,
      created_at: new Date().toISOString(),
    };
    setChat((c) => [...c, optimistic]);
    // Broadcast first so the group sees it instantly.
    void channelRef.current?.send({
      type: "broadcast",
      event: "chat",
      payload: optimistic,
    });
    // Persist asynchronously.
    void supabase.from("watch_party_chat").insert({
      party_id: partyId,
      user_id: user.id,
      body,
    });
  };

  return (
    <aside
      className="fixed right-0 top-0 bottom-0 w-[min(360px,40vw)] z-40 border-l border-glass-active bg-glass backdrop-blur-xl flex flex-col"
      aria-label="Watch party chat"
    >
      <header className="px-4 py-3 border-b border-glass-active/50">
        <div className="text-[10px] uppercase tracking-[0.16em] text-foreground/55">
          Watch party
        </div>
        <div className="text-sm font-medium text-foreground">
          {isHost ? "You're hosting" : "Synced with the host"}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {chat.length === 0 ? (
          <div className="text-xs text-foreground/50 text-center py-8">
            Say hi to the room.
          </div>
        ) : chat.map((m) => (
          <div
            key={m.id}
            className={[
              "max-w-[85%] text-sm rounded-2xl px-3 py-1.5",
              m.user_id === user?.id
                ? "ml-auto bg-primary/15"
                : "mr-auto bg-glass-hover",
            ].join(" ")}
          >
            {m.body}
          </div>
        ))}
      </div>

      <form onSubmit={send} className="px-3 py-3 border-t border-glass-active/50 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Say something…"
          maxLength={500}
          className="flex-1 text-sm rounded-xl bg-background/40 border border-glass-active/50 px-3 py-2 placeholder:text-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        />
        <Button type="submit" size="icon" disabled={!draft.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </aside>
  );
}
