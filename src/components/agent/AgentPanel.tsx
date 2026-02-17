/**
 * Hoppy Agent Panel 🐰
 * 
 * Warm, friendly AI assistant interface with:
 * - Hoppy's animated face
 * - Persistent chat with memory
 * - Navigation & action cards
 * - Conversion-aware suggestions
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Heart, RotateCcw, Zap, ArrowRight, Loader2 } from "lucide-react";
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
  const { messages, isLoading, sendMessage, clearMessages, agentState, loadingHistory } = useAgentChat();
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
    "Hey Hoppy! What can you do? 🐰",
    "Show me my projects",
    "Help me create a video ✨",
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
              background: "linear-gradient(180deg, hsl(280 20% 8%) 0%, hsl(260 15% 5%) 100%)",
              borderLeft: "1px solid hsl(280 20% 18%)",
            }}
          >
            {/* Header with Hoppy */}
            <div className="flex flex-col items-center pt-6 pb-4 px-4 border-b border-border/30">
              <div className="flex w-full justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4 text-pink-400" />
                  <span className="text-xs font-medium text-pink-300/80 uppercase tracking-wider">
                    Hoppy 🐰
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
                  {agentState === "thinking" && "Hmm, let me think... 🤔"}
                  {agentState === "speaking" && "Here you go! ✨"}
                  {agentState === "idle" && "Hi there! How can I help? 💜"}
                  {agentState === "listening" && "I'm listening... 👂"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your friendly creative assistant
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-hide">
              {loadingHistory && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-xs text-muted-foreground">Loading our chat history...</span>
                </div>
              )}

              {!loadingHistory && messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <p className="text-sm text-muted-foreground text-center max-w-xs">
                    Hey! I'm Hoppy 🐰 — your friendly assistant here to help you create amazing videos, track your projects, and answer any questions!
                  </p>
                  <div className="grid grid-cols-1 gap-2 w-full max-w-xs">
                    {quickPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => sendMessage(prompt)}
                        className="text-left text-xs px-3 py-2.5 rounded-lg border border-border/50 
                                   hover:border-pink-400/40 hover:bg-pink-400/5 transition-all
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
                  <div className="h-6 w-6 rounded-full bg-pink-400/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs">🐰</span>
                  </div>
                  <div className="flex gap-1 items-center px-3 py-2 rounded-xl bg-muted/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-pink-400/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-pink-400/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-pink-400/60 animate-bounce" style={{ animationDelay: "300ms" }} />
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
                  className="absolute bottom-20 left-4 right-4 p-4 rounded-xl border border-pink-400/30 z-10"
                  style={{ background: "hsl(280 12% 10%)" }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="h-4 w-4 text-warning" />
                    <span className="text-sm font-medium text-foreground">Just checking! 🐰</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    This will use about <span className="text-warning font-bold">{pendingAction.estimated_credits}</span> credits. Ready to go?
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPendingAction(null)}
                      className="flex-1 text-xs"
                    >
                      Not yet
                    </Button>
                    <Button
                      size="sm"
                      onClick={confirmAction}
                      className="flex-1 text-xs bg-primary hover:bg-primary/90"
                    >
                      Let's do it! ✨
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
                  placeholder="Ask Hoppy anything... 🐰"
                  rows={1}
                  className="flex-1 resize-none bg-muted/30 border border-border/50 rounded-xl px-4 py-3 text-sm
                           text-foreground placeholder:text-muted-foreground/50
                           focus:outline-none focus:border-pink-400/50 focus:ring-1 focus:ring-pink-400/20
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
        <div className="h-6 w-6 rounded-full bg-pink-400/20 flex items-center justify-center flex-shrink-0 mt-1">
          <span className="text-xs">🐰</span>
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
                         border border-pink-400/30 bg-pink-400/5 hover:bg-pink-400/10
                         text-pink-300 transition-all group"
              >
                <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                {action.action === "navigate" && `Go to ${action.path}`}
                {action.action === "start_creation" && `Create video (${action.estimated_credits} credits) ✨`}
                {action.action === "generate_script" && "Preview script 📝"}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
