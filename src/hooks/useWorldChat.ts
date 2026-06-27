/**
 * useWorldChat — the single global Lobby chat room.
 *
 * Loads the most recent messages, then keeps the list live via a Supabase
 * Realtime subscription on INSERTs to public.world_chat. Sending goes through
 * the post_world_chat() RPC, which snapshots the author's name/avatar and
 * enforces the flood guard server-side, so the realtime payload that comes
 * back already has everything needed to render — no extra profile lookup.
 *
 * (public.world_chat / post_world_chat are not in the generated Supabase types
 * yet, so the calls are cast `as never`, matching the convention used for other
 * recently-added tables/RPCs in this codebase.)
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface WorldChatMessage {
  id: number;
  user_id: string | null;
  display_name: string | null;
  avatar_url: string | null;
  body: string;
  created_at: string;
}

const PAGE = 60;
const MAX_KEPT = 250;

export interface SendResult {
  ok: boolean;
  error?: string;
}

export function useWorldChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<WorldChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const seen = useRef<Set<number>>(new Set());

  // Initial load — newest PAGE rows, oldest-first for display.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("world_chat" as never)
        .select("id,user_id,display_name,avatar_url,body,created_at")
        .order("created_at", { ascending: false })
        .limit(PAGE);
      if (cancelled) return;
      const rows = ((data as unknown as WorldChatMessage[]) || []).slice().reverse();
      seen.current = new Set(rows.map((r) => r.id));
      setMessages(rows);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Realtime — append new messages (deduped; sender sees their own this way too)
  // AND track presence so the room shows a live "online now" count.
  useEffect(() => {
    const presenceKey = user?.id ?? `guest-${Math.random().toString(36).slice(2)}`;
    const ch = supabase
      .channel("world-chat", { config: { presence: { key: presenceKey } } })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "world_chat" },
        (payload) => {
          const m = payload.new as WorldChatMessage;
          if (m == null || seen.current.has(m.id)) return;
          seen.current.add(m.id);
          setMessages((prev) => [...prev, m].slice(-MAX_KEPT));
        }
      )
      .on("presence", { event: "sync" }, () => {
        // Count distinct presence keys currently in the room.
        const state = ch.presenceState() as Record<string, unknown[]>;
        setOnlineCount(Object.keys(state).length);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void ch.track({ online_at: new Date().toISOString() });
        }
      });
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id]);

  const send = useCallback(
    async (raw: string): Promise<SendResult> => {
      const body = raw.trim();
      if (!body) return { ok: false, error: "empty_message" };
      if (!user) return { ok: false, error: "auth_required" };
      setSending(true);
      const { error } = await supabase.rpc("post_world_chat" as never, { p_body: body } as never);
      setSending(false);
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    },
    [user]
  );

  return { messages, loading, sending, send, canSend: !!user, onlineCount };
}
