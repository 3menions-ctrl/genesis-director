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
        // Find most recent conversation
        const { data: conv } = await supabase
          .from("agent_conversations")
          .select("id")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (conv) {
          setConversationId(conv.id);

          // Load last 30 messages
          const { data: msgs } = await supabase
            .from("agent_messages")
            .select("id, role, content, metadata, created_at")
            .eq("conversation_id", conv.id)
            .order("created_at", { ascending: true })
            .limit(30);

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
    if (!content.trim() || isLoading || !user?.id) return;

    const convId = await ensureConversation();

    // Add user message
    const userMessage: AgentMessage = {
      id: generateId(),
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setAgentState("thinking");

    try {
      // Build messages array for the API (include history for memory)
      const apiMessages = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: content.trim() },
      ];

      const { data, error } = await supabase.functions.invoke("agent-chat", {
        body: {
          messages: apiMessages,
          conversationId: convId,
          currentPage: location.pathname,
        },
      });

      if (error) throw error;

      setAgentState("speaking");

      // Refresh credits in the UI if the backend returned an updated balance
      if (data.updatedBalance !== undefined) {
        // Trigger a profile refetch by dispatching a custom event
        window.dispatchEvent(new CustomEvent('credits-updated', { detail: { balance: data.updatedBalance } }));
      }

      const assistantMessage: AgentMessage = {
        id: generateId(),
        role: "assistant",
        content: data.content || "Hey there! I'm Hoppy — how can I help? 🐰",
        actions: data.actions || [],
        richBlocks: data.richBlocks || [],
        creditsCharged: data.creditsCharged || 0,
        timestamp: new Date(),
      };

      await new Promise((r) => setTimeout(r, 300));
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error("[Hoppy] Send error:", err);
      
      const errMsg = String(err?.message || '');
      const errContext = err?.context;
      const status = errContext?.status || (errMsg.includes('402') ? 402 : errMsg.includes('429') ? 429 : 0);

      const errorContent = status === 429 || errMsg.includes('429')
        ? "Oops, I'm getting a lot of messages right now! Give me just a sec and try again 💜"
        : status === 402 || errMsg.includes('402') || errMsg.includes('credits')
        ? "Oh no, my brain power needs a recharge! ⚡ Try again in a moment — I'll be right back!"
        : "Hmm, something went a bit wonky. Let me try that again! 🐰";

      if (status !== 402) {
        toast.error("Hoppy had a hiccup — try again!");
      } else {
        toast.error("AI service temporarily unavailable");
      }
      
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: "assistant",
          content: errorContent,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => setAgentState("idle"), 1500);
    }
  }, [messages, isLoading, user?.id, ensureConversation, location.pathname]);

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
