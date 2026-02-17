/**
 * APEX Agent Chat Hook
 * 
 * Manages conversation state, message sending, and action handling
 * for the AI agent interface.
 */

import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface AgentMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: AgentAction[];
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
}

export function useAgentChat(): UseAgentChatReturn {
  const { user } = useAuth();
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [agentState, setAgentState] = useState<"idle" | "thinking" | "speaking" | "listening">("idle");
  const messageIdCounter = useRef(0);

  const generateId = () => {
    messageIdCounter.current++;
    return `msg-${Date.now()}-${messageIdCounter.current}`;
  };

  const ensureConversation = useCallback(async (): Promise<string | null> => {
    if (conversationId) return conversationId;
    if (!user?.id) return null;

    const { data, error } = await supabase
      .from("agent_conversations")
      .insert({ user_id: user.id, title: "New Conversation" })
      .select("id")
      .single();

    if (error || !data) {
      console.error("[AgentChat] Failed to create conversation:", error);
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
      // Build messages array for the API
      const apiMessages = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: content.trim() },
      ];

      const { data, error } = await supabase.functions.invoke("agent-chat", {
        body: {
          messages: apiMessages,
          conversationId: convId,
        },
      });

      if (error) throw error;

      // Simulate speaking state while "typing"
      setAgentState("speaking");

      const assistantMessage: AgentMessage = {
        id: generateId(),
        role: "assistant",
        content: data.content || "I'm here to help!",
        actions: data.actions || [],
        timestamp: new Date(),
      };

      // Slight delay for speaking animation
      await new Promise((r) => setTimeout(r, 300));
      setMessages((prev) => [...prev, assistantMessage]);

      // Handle navigation actions automatically
      const navAction = data.actions?.find((a: AgentAction) => a.action === "navigate");
      if (navAction) {
        // Will be handled by the UI component
      }
    } catch (err) {
      console.error("[AgentChat] Send error:", err);
      
      const errorContent = err instanceof Error && err.message.includes("429")
        ? "I'm a bit overwhelmed right now. Give me a moment and try again! 🎬"
        : err instanceof Error && err.message.includes("402")
        ? "AI service needs credits. Please contact support."
        : "Something went wrong. Let me try again...";

      toast.error("Agent communication error");
      
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
      // Return to idle after a brief speaking period
      setTimeout(() => setAgentState("idle"), 1500);
    }
  }, [messages, isLoading, user?.id, ensureConversation]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setAgentState("idle");
  }, []);

  return {
    messages,
    isLoading,
    conversationId,
    sendMessage,
    clearMessages,
    agentState,
  };
}
