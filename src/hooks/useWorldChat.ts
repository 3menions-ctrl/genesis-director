/**
 * useWorldChat — the single global Lobby chat room.
 *
 * Loads recent messages, keeps the list live via a Supabase Realtime
 * subscription on INSERTs to public.world_chat, and sends through the
 * post_world_chat() RPC (which snapshots the author's name/avatar and enforces
 * the flood guard server-side). Messages may carry an optional image: callers
 * upload via uploadImage() to the public `world-chat` bucket, then pass the
 * resulting URL to send().
 *
 * (public.world_chat / post_world_chat are not in the generated Supabase types,
 * so the calls are cast `as never`, matching the convention for other
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
  body: string | null;
  image_url: string | null;
  created_at: string;
}

const PAGE = 60;
const MAX_KEPT = 250;
const CHAT_BUCKET = "world-chat";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export interface SendResult {
  ok: boolean;
  error?: string;
}

export interface UploadResult {
  url?: string;
  error?: string;
}

export function useWorldChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<WorldChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const seen = useRef<Set<number>>(new Set());

  // Initial load — newest PAGE rows, oldest-first for display.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("world_chat" as never)
        .select("id,user_id,display_name,avatar_url,body,image_url,created_at")
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

  // Realtime — append new messages (deduped; sender sees their own this way too).
  useEffect(() => {
    const ch = supabase
      .channel("world-chat")
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
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  /** Upload an image to the public chat bucket; returns its public URL. */
  const uploadImage = useCallback(
    async (file: File): Promise<UploadResult> => {
      if (!user) return { error: "auth_required" };
      if (!file.type.startsWith("image/")) return { error: "not_an_image" };
      if (file.size > MAX_IMAGE_BYTES) return { error: "too_large" };
      const ext =
        (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${user.id}/${Date.now()}-${Math.round(Math.random() * 1e9).toString(36)}.${ext}`;
      const { error } = await supabase.storage
        .from(CHAT_BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (error) return { error: error.message };
      const { data } = supabase.storage.from(CHAT_BUCKET).getPublicUrl(path);
      return { url: data.publicUrl };
    },
    [user]
  );

  const send = useCallback(
    async (raw: string, imageUrl?: string | null): Promise<SendResult> => {
      const body = raw.trim();
      const img = imageUrl?.trim() || null;
      if (!body && !img) return { ok: false, error: "empty_message" };
      if (!user) return { ok: false, error: "auth_required" };
      setSending(true);
      const { error } = await supabase.rpc("post_world_chat" as never, {
        p_body: body,
        p_image_url: img,
      } as never);
      setSending(false);
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    },
    [user]
  );

  return { messages, loading, sending, send, uploadImage, canSend: !!user };
}
