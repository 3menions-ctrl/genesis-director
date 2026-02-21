/**
 * APEX Agent Chat Hook — Hoppy 🐰
 * 
 * Manages conversation state, message sending, persistent memory,
 * and action handling for the AI agent interface.
 * 
 * KEY FIX: Users can now send messages while Hoppy is still responding.
 * Messages are queued and processed sequentially.
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
  /** True when Hoppy is actively generating a response */
  isResponding: boolean;
  /** @deprecated Use isResponding instead */
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
  const [isResponding, setIsResponding] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [agentState, setAgentState] = useState<"idle" | "thinking" | "speaking" | "listening">("idle");
  const messageIdCounter = useRef(0);
  const historyLoaded = useRef(false);
  // Abort controller for current stream — allows cancellation
  const abortRef = useRef<AbortController | null>(null);
  // Queue for messages sent while Hoppy is responding
  const messageQueue = useRef<string[]>([]);
  const processingQueue = useRef(false);

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

  /**
   * Core send logic — processes a single message through the SSE pipeline.
   * This is separated from the public sendMessage so the queue can call it.
   */
  const processSingleMessage = useCallback(async (content: string) => {
    if (!user?.id) return;

    const convId = await ensureConversation();

    // Add user message immediately
    const userMessage: AgentMessage = {
      id: generateId(),
      role: "user",
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsResponding(true);
    setAgentState("thinking");

    // Create placeholder streaming assistant message
    const placeholderId = generateId();
    const placeholderMsg: AgentMessage = {
      id: placeholderId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      streaming: true,
    };
    setMessages((prev) => [...prev, placeholderMsg]);

    // Create abort controller for this stream
    const abortController = new AbortController();
    abortRef.current = abortController;

    // Safety timeout: if stream doesn't complete in 120s, force-finish
    // (Increased from 90s — complex tool calls can take longer)
    const safetyTimeout = setTimeout(() => {
      if (abortRef.current === abortController) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholderId && m.streaming
              ? { ...m, streaming: false, content: m.content || "Sorry, my response timed out. Please try again! 🐰" }
              : m
          )
        );
        setIsResponding(false);
        setAgentState("idle");
        abortRef.current = null;
      }
    }, 120_000);

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
            messages: [{ role: "user", content }],
            conversationId: convId,
            currentPage: location.pathname,
          }),
          signal: abortController.signal,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get("content-type") || "";

      // ── SSE Streaming path ──
      if (contentType.includes("text/event-stream") && response.body) {
        setAgentState("speaking");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulatedContent = "";
        let receivedDone = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (!payload || payload === "[DONE]") {
              receivedDone = true;
              continue;
            }

            try {
              const evt = JSON.parse(payload);

              if (evt.type === "token") {
                accumulatedContent += evt.chunk;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === placeholderId
                      ? { ...m, content: accumulatedContent, streaming: true }
                      : m
                  )
                );
              } else if (evt.type === "done") {
                receivedDone = true;
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

        // Stream ended — ensure streaming flag is cleared even if no "done" event
        if (!receivedDone) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === placeholderId
                ? { ...m, content: accumulatedContent || m.content, streaming: false }
                : m
            )
          );
        }
      } else {
        // ── JSON fallback path ──
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
      // Don't show error for intentional aborts
      if (err?.name === "AbortError") return;

      console.error("[Hoppy] Send error:", err);

      const errMsg = String(err?.message || "");
      const status = errMsg.includes("429") ? 429 : errMsg.includes("402") ? 402 : 0;

      const errorContent =
        status === 429
          ? "Oops, I'm getting a lot of messages right now! Give me just a sec and try again 💜"
          : "Hmm, something went a bit wonky on my end. Let me try that again! 🐰";

      toast.error("Hoppy had a hiccup — try again!");

      setMessages((prev) =>
        prev.map((m) =>
          m.id === placeholderId
            ? { ...m, content: errorContent, streaming: false }
            : m
        )
      );
    } finally {
      clearTimeout(safetyTimeout);
      abortRef.current = null;
      setIsResponding(false);
      setTimeout(() => setAgentState("idle"), 800);
    }
  }, [user?.id, ensureConversation, location.pathname]);

  /**
   * Process queued messages sequentially
   */
  const processQueue = useCallback(async () => {
    if (processingQueue.current) return;
    processingQueue.current = true;

    try {
      while (messageQueue.current.length > 0) {
        const nextMessage = messageQueue.current.shift()!;
        await processSingleMessage(nextMessage);
      }
    } finally {
      // CRITICAL: Always release the lock, even if processSingleMessage throws
      processingQueue.current = false;
    }
  }, [processSingleMessage]);

  /**
   * Public send function — NEVER blocks.
   * If Hoppy is responding, the message is queued and sent after she finishes.
   */
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || !user?.id) return;

    // Rate limit: max 5 queued messages to prevent spam
    if (messageQueue.current.length >= 5) {
      toast.error("Slow down! Let Hoppy catch up first 🐰");
      return;
    }

    const trimmed = content.trim();

    if (processingQueue.current) {
      // Hoppy is busy — queue the message and show it immediately
      messageQueue.current.push(trimmed);
      // Show user message immediately even though it's queued
      setMessages((prev) => [...prev, {
        id: generateId(),
        role: "user" as const,
        content: trimmed,
        timestamp: new Date(),
      }]);
      return;
    }

    // Process immediately — and then drain the queue
    messageQueue.current.push(trimmed);
    await processQueue();
  }, [user?.id, processQueue]);

  const clearMessages = useCallback(() => {
    // Abort any in-flight stream
    abortRef.current?.abort();
    abortRef.current = null;
    messageQueue.current = [];
    processingQueue.current = false;
    setMessages([]);
    setConversationId(null);
    historyLoaded.current = false;
    setIsResponding(false);
    setAgentState("idle");
  }, []);

  return {
    messages,
    isLoading: isResponding, // backward compat
    isResponding,
    conversationId,
    sendMessage,
    clearMessages,
    agentState,
    loadingHistory,
  };
}
