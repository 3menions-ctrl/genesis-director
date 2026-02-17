/**
 * APEX Agent Panel
 * 
 * Immersive AI agent interface with:
 * - Futuristic digital face with lip-sync
 * - Streaming-style chat messages
 * - Rich action cards with confirmation gates
 * - Pop-up guided flows
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Sparkles, RotateCcw, ChevronDown, Zap, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentFace } from "./AgentFace";
import { useAgentChat, AgentAction, AgentMessage } from "@/hooks/useAgentChat";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";

interface AgentPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AgentPanel({ isOpen, onClose }: AgentPanelProps) {
  const { messages, isLoading, sendMessage, clearMessages, agentState } = useAgentChat();
  const [input, setInput] = useState("");
  const [pendingAction, setPendingAction] = useState<AgentAction | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    const msg = input;
    setInput("");
    await sendMessage(msg);
  }, [input, isLoading, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAction = (action: AgentAction) => {
    if (action.action === "navigate" && action.path) {
      navigate(action.path);
      onClose();
    } else if (action.action === "start_creation" && action.requires_confirmation) {
      setPendingAction(action);
    } else if (action.action === "start_creation") {
      navigate("/create");
      onClose();
    } else if (action.action === "generate_script") {
      navigate("/create");
      onClose();
    }
  };

  const confirmAction = () => {
    if (pendingAction) {
      if (pendingAction.action === "start_creation") {
        navigate("/create");
      }
      setPendingAction(null);
      onClose();
    }
  };

  const quickPrompts = [
    "What can you help me with?",
    "Show me my projects",
    "I want to create a video",
    "How many credits do I have?",
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md flex flex-col"
            style={{
              background: "linear-gradient(180deg, hsl(250 15% 6%) 0%, hsl(250 15% 4%) 100%)",
              borderLeft: "1px solid hsl(250 10% 16%)",
            }}
          >
            {/* Header with Face */}
            <div className="flex flex-col items-center pt-6 pb-4 px-4 border-b border-border/30">
              <div className="flex w-full justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    APEX Agent
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={clearMessages}
                    className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                    title="New conversation"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <AgentFace state={agentState} size={120} />

              <div className="mt-3 text-center">
                <p className="text-sm font-medium text-foreground">
                  {agentState === "thinking" && "Analyzing..."}
                  {agentState === "speaking" && "Here's what I found"}
                  {agentState === "idle" && "Ready to create"}
                  {agentState === "listening" && "Listening..."}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your AI creative director
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-hide">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <p className="text-sm text-muted-foreground text-center max-w-xs">
                    I'm APEX — your AI creative director. Tell me what you want to create, or ask me anything about your projects.
                  </p>
                  <div className="grid grid-cols-1 gap-2 w-full max-w-xs">
                    {quickPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => sendMessage(prompt)}
                        className="text-left text-xs px-3 py-2.5 rounded-lg border border-border/50 
                                   hover:border-primary/40 hover:bg-primary/5 transition-all
                                   text-muted-foreground hover:text-foreground"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  onAction={handleAction}
                />
              ))}

              {isLoading && (
                <div className="flex gap-2 items-start">
                  <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-3 w-3 text-primary animate-pulse" />
                  </div>
                  <div className="flex gap-1 items-center px-3 py-2 rounded-xl bg-muted/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Confirmation overlay */}
            <AnimatePresence>
              {pendingAction && (
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  className="absolute bottom-20 left-4 right-4 p-4 rounded-xl border border-primary/30 z-10"
                  style={{ background: "hsl(250 12% 10%)" }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="h-4 w-4 text-warning" />
                    <span className="text-sm font-medium text-foreground">Confirm Action</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    This will use approximately <span className="text-warning font-bold">{pendingAction.estimated_credits}</span> credits.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPendingAction(null)}
                      className="flex-1 text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={confirmAction}
                      className="flex-1 text-xs bg-primary hover:bg-primary/90"
                    >
                      Confirm & Create
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input */}
            <div className="px-4 pb-4 pt-2 border-t border-border/30">
              <div className="flex gap-2 items-end">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Tell me what you want to create..."
                  rows={1}
                  className="flex-1 resize-none bg-muted/30 border border-border/50 rounded-xl px-4 py-3 text-sm
                           text-foreground placeholder:text-muted-foreground/50
                           focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20
                           transition-all max-h-24 scrollbar-hide"
                  style={{ minHeight: "44px" }}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className={cn(
                    "h-11 w-11 rounded-xl flex items-center justify-center transition-all flex-shrink-0",
                    input.trim() && !isLoading
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[var(--shadow-glow)]"
                      : "bg-muted/30 text-muted-foreground cursor-not-allowed"
                  )}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ══════════════════════════════════════════════════════
// Message Bubble Component
// ══════════════════════════════════════════════════════

function MessageBubble({
  message,
  onAction,
}: {
  message: AgentMessage;
  onAction: (action: AgentAction) => void;
}) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-2", isUser ? "justify-end" : "justify-start")}
    >
      {!isUser && (
        <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
          <Sparkles className="h-3 w-3 text-primary" />
        </div>
      )}

      <div className={cn("max-w-[85%] flex flex-col gap-2")}>
        <div
          className={cn(
            "px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed",
            isUser
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-muted/40 text-foreground rounded-bl-md border border-border/30"
          )}
        >
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <div className="prose prose-sm prose-invert max-w-none [&>p]:mb-1.5 [&>p:last-child]:mb-0 [&>ul]:mb-1.5 [&>ol]:mb-1.5">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Action cards */}
        {message.actions && message.actions.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {message.actions.map((action, i) => (
              <button
                key={i}
                onClick={() => onAction(action)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs
                         border border-primary/30 bg-primary/5 hover:bg-primary/10
                         text-primary transition-all group"
              >
                <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                {action.action === "navigate" && `Go to ${action.path}`}
                {action.action === "start_creation" && `Create video (${action.estimated_credits} credits)`}
                {action.action === "generate_script" && "Preview script"}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
