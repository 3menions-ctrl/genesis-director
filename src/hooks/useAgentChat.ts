/**
 * APEX Agent Chat Hook — Hoppy 🐰
 * 
 * Manages conversation state, message sending, persistent memory,
 * and action handling for the AI agent interface.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";

export interface RichBlock {
  type: string;
  data: any;
}

export interface AgentMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: AgentAction[];
  richBlocks?: RichBlock[];
  creditsCharged?: number;
  timestamp: Date;
  /** True while SSE tokens are still being received */
  streaming?: boolean;
}

export interface AgentAction {
  action: string;
  path?: string;
  reason?: string;
  requires_confirmation?: boolean;
  estimated_credits?: number;
  params?: Record<string, unknown>;
}

interface UseAgentChatReturn {
  messages: AgentMessage[];
  isLoading: boolean;
  conversationId: string | null;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  agentState: "idle" | "thinking" | "speaking" | "listening";
  loadingHistory: boolean;
}

export function useAgentChat(): UseAgentChatReturn {
  const { user } = useAuth();
  const location = useLocation();
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [agentState, setAgentState] = useState<"idle" | "thinking" | "speaking" | "listening">("idle");
  const messageIdCounter = useRef(0);
  const historyLoaded = useRef(false);
  // Track the in-progress streaming message id so we can patch it
  const streamingMsgId = useRef<string | null>(null);
  // Use a ref to track loading so sendMessage closure doesn't go stale
  // (avoids isLoading being stuck true when the closure is recreated mid-stream)
  const isLoadingRef = useRef(false);

  const generateId = () => {
    messageIdCounter.current++;
    return `msg-${Date.now()}-${messageIdCounter.current}`;
  };

  // Load most recent conversation on mount
  useEffect(() => {
    if (!user?.id || historyLoaded.current) return;
    historyLoaded.current = true;

    const loadHistory = async () => {
      setLoadingHistory(true);
      try {
        const { data: conv } = await supabase
          .from("agent_conversations")
          .select("id")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (conv) {
          setConversationId(conv.id);

          const { data: msgs } = await supabase
            .from("agent_messages")
            .select("id, role, content, metadata, created_at")
            .eq("conversation_id", conv.id)
            .order("created_at", { ascending: true })
            .limit(50);

          if (msgs && msgs.length > 0) {
            const loaded: AgentMessage[] = msgs.map((m) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              content: m.content || "",
              actions: (m.metadata as any)?.actions || [],
              timestamp: new Date(m.created_at),
            }));
            setMessages(loaded);
          }
        }
      } catch (err) {
        console.error("[Hoppy] Failed to load history:", err);
      } finally {
        setLoadingHistory(false);
      }
    };

    loadHistory();
  }, [user?.id]);

  const ensureConversation = useCallback(async (): Promise<string | null> => {
    if (conversationId) return conversationId;
    if (!user?.id) return null;

    const { data, error } = await supabase
      .from("agent_conversations")
      .insert({ user_id: user.id, title: "Chat with Hoppy 🐰" })
      .select("id")
      .single();

    if (error || !data) {
      console.error("[Hoppy] Failed to create conversation:", error);
      return null;
    }

    setConversationId(data.id);
    return data.id;
  }, [conversationId, user?.id]);

  const sendMessage = useCallback(async (content: string) => {
    // Use ref to check loading so this closure never goes stale
    if (!content.trim() || isLoadingRef.current || !user?.id) return;

    const convId = await ensureConversation();

    // Add user message immediately
    const userMessage: AgentMessage = {
      id: generateId(),
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    isLoadingRef.current = true;
    setIsLoading(true);
    setAgentState("thinking");

    // Create a placeholder streaming assistant message
    const placeholderId = generateId();
    streamingMsgId.current = placeholderId;
    const placeholderMsg: AgentMessage = {
      id: placeholderId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      streaming: true,
    };
    setMessages((prev) => [...prev, placeholderMsg]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            ...(accessToken ? { "Authorization": `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: content.trim() }],
            conversationId: convId,
            currentPage: location.pathname,
          }),
        }
      );

      if (!response.ok) {
        const status = response.status;
        throw new Error(`HTTP ${status}`);
      }

      const contentType = response.headers.get("content-type") || "";

      // ── SSE Streaming path ──
      if (contentType.includes("text/event-stream") && response.body) {
        setAgentState("speaking");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulatedContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (!payload || payload === "[DONE]") continue;

            try {
              const evt = JSON.parse(payload);

              if (evt.type === "token") {
                accumulatedContent += evt.chunk;
                // Patch the placeholder message with the growing text
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === placeholderId
                      ? { ...m, content: accumulatedContent, streaming: true }
                      : m
                  )
                );
              } else if (evt.type === "done") {
                // Final frame: apply full metadata
                if (evt.updatedBalance !== undefined) {
                  window.dispatchEvent(new CustomEvent("credits-updated", { detail: { balance: evt.updatedBalance } }));
                }
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === placeholderId
                      ? {
                          ...m,
                          content: accumulatedContent || m.content,
                          actions: evt.actions || [],
                          richBlocks: evt.richBlocks || [],
                          creditsCharged: evt.creditsCharged || 0,
                          streaming: false,
                        }
                      : m
                  )
                );
              }
            } catch {
              // Ignore malformed SSE frames
            }
          }
        }
      } else {
        // ── JSON fallback path (e.g. Lovable gateway) ──
        const data = await response.json();
        setAgentState("speaking");

        if (data.updatedBalance !== undefined) {
          window.dispatchEvent(new CustomEvent("credits-updated", { detail: { balance: data.updatedBalance } }));
        }

        await new Promise((r) => setTimeout(r, 300));
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholderId
              ? {
                  ...m,
                  content: data.content || "Hey there! I'm Hoppy — how can I help? 🐰",
                  actions: data.actions || [],
                  richBlocks: data.richBlocks || [],
                  creditsCharged: data.creditsCharged || 0,
                  streaming: false,
                }
              : m
          )
        );
      }
    } catch (err: any) {
      console.error("[Hoppy] Send error:", err);

      const errMsg = String(err?.message || "");
      const status = errMsg.includes("429") ? 429 : errMsg.includes("402") ? 402 : 0;

      const errorContent =
        status === 429
          ? "Oops, I'm getting a lot of messages right now! Give me just a sec and try again 💜"
          : "Hmm, something went a bit wonky on my end. Let me try that again! 🐰";

      toast.error("Hoppy had a hiccup — try again!");

      // Replace the placeholder with the error message
      setMessages((prev) =>
        prev.map((m) =>
          m.id === placeholderId
            ? { ...m, content: errorContent, streaming: false }
            : m
        )
      );
    } finally {
      streamingMsgId.current = null;
      isLoadingRef.current = false;
      setIsLoading(false);
      setTimeout(() => setAgentState("idle"), 1500);
    }
  }, [user?.id, ensureConversation, location.pathname]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    historyLoaded.current = false;
    setAgentState("idle");
  }, []);

  return {
    messages,
    isLoading,
    conversationId,
    sendMessage,
    clearMessages,
    agentState,
    loadingHistory,
  };
}
