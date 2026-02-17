/**
 * Hoppy Agent Panel 🐰 — Immersive Modern Chat
 * 
 * Premium glassmorphic AI assistant interface with:
 * - State-reactive Hoppy face with orbital effects
 * - Frosted glass panels and gradient meshes
 * - Animated message transitions  
 * - Modern action cards with hover effects
 * - Typing indicator with wave animation
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, RotateCcw, Zap, ArrowRight, Loader2, Sparkles, MessageCircle } from "lucide-react";
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 400);
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
      if (pendingAction.action === "start_creation") navigate("/create");
      setPendingAction(null);
      onClose();
    }
  };

  const quickPrompts = [
    { text: "Hey Hoppy! What can you do?", icon: "🐰" },
    { text: "Show me my projects", icon: "📂" },
    { text: "Help me create a video", icon: "✨" },
    { text: "How many credits do I have?", icon: "💰" },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop with mesh gradient */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
            onClick={onClose}
            style={{
              background: `
                radial-gradient(ellipse at 80% 20%, hsl(280 40% 15% / 0.4) 0%, transparent 50%),
                radial-gradient(ellipse at 20% 80%, hsl(220 30% 10% / 0.3) 0%, transparent 50%),
                hsl(0 0% 0% / 0.7)
              `,
              backdropFilter: "blur(12px)",
            }}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[420px] flex flex-col overflow-hidden"
            style={{
              background: `
                linear-gradient(180deg, 
                  hsl(280 15% 7% / 0.95) 0%, 
                  hsl(260 12% 5% / 0.98) 40%,
                  hsl(250 10% 4% / 0.99) 100%
                )
              `,
              borderLeft: "1px solid hsl(280 20% 20% / 0.4)",
              backdropFilter: "blur(40px)",
            }}
          >
            {/* Ambient gradient mesh (decorative) */}
            <div
              className="absolute top-0 left-0 right-0 h-72 pointer-events-none opacity-60"
              style={{
                background: `
                  radial-gradient(ellipse at 50% 0%, hsl(280 50% 30% / 0.15) 0%, transparent 60%),
                  radial-gradient(ellipse at 80% 20%, hsl(320 40% 25% / 0.08) 0%, transparent 40%)
                `,
              }}
            />

            {/* Header */}
            <div className="relative flex flex-col items-center pt-5 pb-4 px-5">
              {/* Top bar */}
              <div className="flex w-full justify-between items-center mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-foreground tracking-wide">Hoppy</span>
                    <span className="text-[10px] text-muted-foreground ml-1.5">AI Assistant</span>
                  </div>
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={clearMessages}
                    className="p-2 rounded-lg hover:bg-muted/40 transition-all text-muted-foreground hover:text-foreground"
                    title="New conversation"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg hover:bg-muted/40 transition-all text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Hoppy face with effects */}
              <AgentFace state={agentState} size={110} />

              {/* Status text */}
              <motion.div
                className="mt-3 text-center"
                key={agentState}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <p className="text-sm font-medium text-foreground">
                  {agentState === "thinking" && "Thinking... 🤔"}
                  {agentState === "speaking" && "Here you go! ✨"}
                  {agentState === "idle" && "How can I help? 💜"}
                  {agentState === "listening" && "Listening... 👂"}
                </p>
              </motion.div>

              {/* Divider with glow */}
              <div className="w-full mt-4 relative">
                <div className="h-px w-full bg-border/30" />
                <div
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-24"
                  style={{
                    background: "linear-gradient(90deg, transparent, hsl(280 50% 50% / 0.4), transparent)",
                  }}
                />
              </div>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-hide relative">
              {loadingHistory && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-12 gap-3"
                >
                  <div className="relative">
                    <Loader2 className="h-6 w-6 animate-spin text-primary/50" />
                    <div className="absolute inset-0 rounded-full animate-ping bg-primary/10" />
                  </div>
                  <span className="text-xs text-muted-foreground">Loading our conversation...</span>
                </motion.div>
              )}

              {!loadingHistory && messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-5">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Start a conversation</p>
                  </div>
                  <p className="text-sm text-muted-foreground/80 text-center max-w-[280px] leading-relaxed">
                    I'm here to help you create amazing videos, track progress, and answer questions!
                  </p>
                  <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
                    {quickPrompts.map((prompt) => (
                      <motion.button
                        key={prompt.text}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => sendMessage(prompt.text)}
                        className="text-left text-xs px-3 py-3 rounded-xl transition-all
                                   text-muted-foreground hover:text-foreground group"
                        style={{
                          background: "hsl(280 10% 10% / 0.5)",
                          border: "1px solid hsl(280 15% 20% / 0.3)",
                        }}
                      >
                        <span className="text-base mb-1 block">{prompt.icon}</span>
                        <span className="group-hover:text-foreground transition-colors leading-snug">{prompt.text}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  onAction={handleAction}
                  isLatest={i === messages.length - 1}
                />
              ))}

              {/* Typing indicator */}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-2.5 items-start"
                >
                  <div className="h-7 w-7 rounded-full overflow-hidden flex-shrink-0 border border-primary/20">
                    <video
                      src="/hoppy-blink.mp4"
                      autoPlay loop muted playsInline
                      className="w-full h-full object-cover scale-[1.5] object-top"
                    />
                  </div>
                  <div
                    className="flex gap-1.5 items-center px-4 py-2.5 rounded-2xl rounded-bl-md"
                    style={{
                      background: "hsl(280 10% 12% / 0.6)",
                      border: "1px solid hsl(280 15% 20% / 0.3)",
                    }}
                  >
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-primary/60"
                        animate={{ y: [0, -4, 0] }}
                        transition={{
                          duration: 0.6,
                          repeat: Infinity,
                          delay: i * 0.15,
                          ease: "easeInOut",
                        }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Confirmation overlay */}
            <AnimatePresence>
              {pendingAction && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 20, opacity: 0 }}
                  className="absolute bottom-24 left-4 right-4 p-4 rounded-2xl z-10"
                  style={{
                    background: "hsl(280 12% 10% / 0.95)",
                    border: "1px solid hsl(280 30% 30% / 0.3)",
                    backdropFilter: "blur(20px)",
                    boxShadow: "0 8px 32px hsl(0 0% 0% / 0.4)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="h-4 w-4 text-warning" />
                    <span className="text-sm font-medium text-foreground">Quick check! 🐰</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    This will use about{" "}
                    <span className="text-warning font-bold">{pendingAction.estimated_credits}</span>{" "}
                    credits. Ready to go?
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPendingAction(null)}
                      className="flex-1 text-xs rounded-xl"
                    >
                      Not yet
                    </Button>
                    <Button
                      size="sm"
                      onClick={confirmAction}
                      className="flex-1 text-xs bg-primary hover:bg-primary/90 rounded-xl"
                    >
                      Let's go! ✨
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input area with frosted glass */}
            <div
              className="relative px-4 pb-5 pt-3"
              style={{
                borderTop: "1px solid hsl(280 15% 15% / 0.4)",
                background: "hsl(260 10% 5% / 0.6)",
              }}
            >
              <div className="flex gap-2.5 items-end">
                <div
                  className="flex-1 flex items-end rounded-2xl overflow-hidden transition-all"
                  style={{
                    background: "hsl(280 8% 10% / 0.6)",
                    border: `1px solid ${input.trim() ? "hsl(280 40% 40% / 0.4)" : "hsl(280 10% 18% / 0.4)"}`,
                    boxShadow: input.trim() ? "0 0 12px hsl(280 50% 40% / 0.08)" : "none",
                  }}
                >
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Message Hoppy..."
                    rows={1}
                    className="flex-1 resize-none bg-transparent px-4 py-3 text-sm
                             text-foreground placeholder:text-muted-foreground/40
                             focus:outline-none transition-all max-h-24 scrollbar-hide w-full"
                    style={{ minHeight: "44px" }}
                  />
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className={cn(
                    "h-11 w-11 rounded-2xl flex items-center justify-center transition-all flex-shrink-0",
                    input.trim() && !isLoading
                      ? "bg-primary text-primary-foreground shadow-[0_0_20px_hsl(263_60%_50%/0.3)]"
                      : "bg-muted/20 text-muted-foreground/40 cursor-not-allowed"
                  )}
                >
                  <Send className="h-4 w-4" />
                </motion.button>
              </div>
              <p className="text-[10px] text-muted-foreground/30 text-center mt-2">
                Hoppy may make mistakes. Verify important info.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ══════════════════════════════════════════════════════
// Message Bubble — Modern Glass Style
// ══════════════════════════════════════════════════════

function MessageBubble({
  message,
  onAction,
  isLatest,
}: {
  message: AgentMessage;
  onAction: (action: AgentAction) => void;
  isLatest: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={isLatest ? { opacity: 0, y: 12, scale: 0.97 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn("flex gap-2.5", isUser ? "justify-end" : "justify-start")}
    >
      {!isUser && (
        <div className="h-7 w-7 rounded-full overflow-hidden flex-shrink-0 mt-0.5 border border-primary/20">
          <video
            src="/hoppy-blink.mp4"
            autoPlay loop muted playsInline
            className="w-full h-full object-cover scale-[1.5] object-top"
          />
        </div>
      )}

      <div className={cn("max-w-[82%] flex flex-col gap-2")}>
        <div
          className={cn(
            "px-4 py-3 rounded-2xl text-sm leading-relaxed",
            isUser ? "rounded-br-md" : "rounded-bl-md"
          )}
          style={
            isUser
              ? {
                  background: "linear-gradient(135deg, hsl(263 60% 45%) 0%, hsl(280 50% 40%) 100%)",
                  color: "hsl(0 0% 100%)",
                  boxShadow: "0 2px 12px hsl(263 60% 40% / 0.2)",
                }
              : {
                  background: "hsl(280 10% 12% / 0.6)",
                  border: "1px solid hsl(280 15% 20% / 0.3)",
                  color: "hsl(0 0% 90%)",
                }
          }
        >
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <div className="prose prose-sm prose-invert max-w-none [&>p]:mb-1.5 [&>p:last-child]:mb-0 [&>ul]:mb-1.5 [&>ol]:mb-1.5 [&_a]:text-primary [&_a]:no-underline [&_a:hover]:underline [&_code]:text-primary/80 [&_code]:bg-primary/10 [&_code]:px-1 [&_code]:rounded">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Credits charged + timestamp */}
        <div className={cn("flex items-center gap-2 px-1", isUser ? "justify-end" : "justify-start")}>
          {!isUser && message.creditsCharged && message.creditsCharged > 0 ? (
            <span className="text-[10px] text-warning/60 flex items-center gap-0.5">
              <Zap className="h-2.5 w-2.5" />
              {message.creditsCharged} credit used
            </span>
          ) : null}
          <span className="text-[10px] text-muted-foreground/40">
            {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        {/* Action cards */}
        {message.actions && message.actions.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {message.actions.map((action, i) => (
              <motion.button
                key={i}
                whileHover={{ scale: 1.01, x: 2 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => onAction(action)}
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs
                         transition-all group text-left"
                style={{
                  background: "hsl(280 15% 12% / 0.5)",
                  border: "1px solid hsl(280 30% 30% / 0.25)",
                }}
              >
                <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 border border-primary/20">
                  <ArrowRight className="h-3 w-3 text-primary group-hover:translate-x-0.5 transition-transform" />
                </div>
                <span className="text-foreground/80 group-hover:text-foreground transition-colors">
                  {action.action === "navigate" && `Go to ${action.path}`}
                  {action.action === "start_creation" && `Create video (${action.estimated_credits} credits) ✨`}
                  {action.action === "generate_script" && "Preview script 📝"}
                </span>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
