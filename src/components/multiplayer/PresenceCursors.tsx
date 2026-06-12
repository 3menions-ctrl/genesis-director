/**
 * PresenceCursors — Figma-style live multiplayer cursors via Supabase
 * Realtime presence + broadcast.
 *
 * Drop into any shared surface (a Crew project, a co-editing studio) by
 * passing a unique `roomKey` and the current user's identity. Renders
 * other participants' cursors as little colored arrows with their
 * display name. Throttled to 24 fps so we don't melt the realtime
 * channel.
 */
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface User {
  id: string;
  displayName?: string | null;
}

interface Props {
  roomKey: string;
  user: User;
  /** Optional element ref to anchor cursor coordinates against. Defaults to window. */
  surfaceRef?: React.RefObject<HTMLElement>;
}

interface CursorState {
  id: string;
  displayName?: string | null;
  x: number;
  y: number;
  hue: number;
  lastSeen: number;
}

// Pleasant colors for cursor identification — 7-evenly-spaced hues.
const HUES = [0, 210, 38, 145, 280, 320, 195];
function hueFromId(id: string): number {
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
  return HUES[sum % HUES.length];
}

export function PresenceCursors({ roomKey, user, surfaceRef }: Props) {
  const [cursors, setCursors] = useState<Map<string, CursorState>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSendRef = useRef<number>(0);

  // Subscribe + broadcast.
  useEffect(() => {
    const channel = supabase.channel(`mp-cursors-${roomKey}`, {
      config: { broadcast: { ack: true }, presence: { key: user.id } },
    });
    channelRef.current = channel;

    channel.on("broadcast", { event: "cursor" }, ({ payload }) => {
      const c = payload as CursorState;
      if (c.id === user.id) return;
      setCursors((m) => {
        const next = new Map(m);
        next.set(c.id, { ...c, lastSeen: Date.now() });
        return next;
      });
    });

    channel.on("presence", { event: "leave" }, ({ key }) => {
      setCursors((m) => {
        if (!m.has(key)) return m;
        const next = new Map(m);
        next.delete(key);
        return next;
      });
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          id: user.id,
          displayName: user.displayName,
        });
      }
    });

    return () => { void supabase.removeChannel(channel); };
  }, [roomKey, user.id, user.displayName]);

  // Track our own cursor + broadcast at most every ~42ms.
  useEffect(() => {
    const surface = surfaceRef?.current ?? document.body;
    const onMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastSendRef.current < 42) return;
      lastSendRef.current = now;
      const rect = (surface as HTMLElement).getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width)  * 100;
      const y = ((e.clientY - rect.top)  / rect.height) * 100;
      void channelRef.current?.send({
        type: "broadcast",
        event: "cursor",
        payload: {
          id: user.id,
          displayName: user.displayName,
          x, y,
          hue: hueFromId(user.id),
          lastSeen: 0,
        },
      });
    };
    surface.addEventListener("pointermove", onMove as EventListener, { passive: true });
    return () => surface.removeEventListener("pointermove", onMove as EventListener);
  }, [surfaceRef, user.id, user.displayName]);

  // GC stale cursors every 3 seconds.
  useEffect(() => {
    const id = setInterval(() => {
      const cutoff = Date.now() - 6000;
      setCursors((m) => {
        let changed = false;
        const next = new Map(m);
        for (const [k, c] of next) {
          if (c.lastSeen < cutoff) { next.delete(k); changed = true; }
        }
        return changed ? next : m;
      });
    }, 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      {Array.from(cursors.values()).map((c) => (
        <div
          key={c.id}
          aria-hidden
          className="absolute -translate-x-1 -translate-y-1 transition-transform duration-75 ease-linear"
          style={{ left: `${c.x}%`, top: `${c.y}%` }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" className="drop-shadow-md">
            <path
              d="M3 2 L17 10 L11 11 L8 17 Z"
              fill={`hsl(${c.hue}, 90%, 60%)`}
              stroke="white"
              strokeWidth="1"
            />
          </svg>
          {c.displayName && (
            <span
              className="ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] font-medium text-white whitespace-nowrap"
              style={{ background: `hsl(${c.hue}, 60%, 40%)` }}
            >
              {c.displayName}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
