/**
 * Hoppy Agent Panel 🐰 — Next-Gen Immersive Chat
 * 
 * Ultra-modern conversational interface:
 * - Minimal chrome, maximum content
 * - Large modern typography with refined spacing
 * - Translucent layered surfaces
 * - Fluid micro-interactions
 * - Contextual action chips
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, RotateCcw, Zap, ArrowRight, Loader2, Sparkles, ChevronDown } from "lucide-react";
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
  const [showScrollDown, setShowScrollDown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 400);
  }, [isOpen]);

  // Track scroll position for scroll-down indicator
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollDown(distFromBottom > 120);
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

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
    const act = action.action;
    if (act === "navigate" && action.path) {
      navigate(action.path);
      onClose();
    } else if (act === "open_buy_credits") {
      navigate("/pricing");
      onClose();
    } else if (act === "project_created" && (action as any).navigate_to) {
      navigate((action as any).navigate_to);
      onClose();
    } else if (act === "confirm_generation" || act === "confirm_delete" || act === "start_creation") {
      setPendingAction(action);
    } else if (act === "insufficient_credits") {
      navigate("/pricing");
      onClose();
    } else if (act === "generate_script") {
      navigate("/create");
      onClose();
    } else if (act === "dm_sent" || act === "followed_user" || act === "unfollowed_user" || act === "liked_project" || act === "unliked_project" || act === "profile_updated") {
      // These are confirmation-only actions, no navigation needed
    }
  };

  const confirmAction = async () => {
    if (!pendingAction) return;
    if (pendingAction.action === "start_creation") {
      navigate("/create");
    } else if (pendingAction.action === "confirm_generation") {
      // Tell Hoppy to confirm
      await sendMessage(`Yes, go ahead and generate project ${(pendingAction as any).project_id}`);
    } else if (pendingAction.action === "confirm_delete") {
      await sendMessage(`Yes, delete project ${(pendingAction as any).project_id}`);
    }
    setPendingAction(null);
    if (pendingAction.action === "start_creation") onClose();
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const quickPrompts = [
    { text: "What can you do?", icon: "✦", sub: "Explore capabilities" },
    { text: "Show my projects", icon: "◈", sub: "View & track progress" },
    { text: "Create a video", icon: "▶", sub: "Start generating" },
    { text: "Check my credits", icon: "⚡", sub: "Balance & usage" },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop — deep translucent */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50"
            onClick={onClose}
            style={{
              background: "hsl(var(--background) / 0.75)",
              backdropFilter: "blur(20px) saturate(1.2)",
            }}
          />

          {/* Panel — edge-to-edge right drawer */}
          <motion.div
            initial={{ x: "100%", opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[440px] flex flex-col overflow-hidden"
            style={{
              background: `linear-gradient(180deg, 
                hsl(var(--card) / 0.97) 0%, 
                hsl(var(--background) / 0.99) 100%
              )`,
              borderLeft: "1px solid hsl(var(--border) / 0.15)",
            }}
          >
            {/* Ambient light — subtle top glow */}
            <div
              className="absolute top-0 left-0 right-0 h-48 pointer-events-none"
              style={{
                background: `radial-gradient(ellipse at 50% -20%, hsl(var(--primary) / 0.06) 0%, transparent 70%)`,
              }}
            />

            {/* ─── Header: Compact, modern ─── */}
            <div className="relative flex items-center justify-between px-5 pt-4 pb-3">
              <div className="flex items-center gap-3">
                {/* Mini Hoppy avatar */}
                <div className="relative">
                  <div className="h-9 w-9 rounded-full overflow-hidden ring-2 ring-primary/20 ring-offset-1 ring-offset-background">
                    <video
                      src="/hoppy-blink.mp4"
                      autoPlay loop muted playsInline
                      className="w-full h-full object-cover scale-[1.4] object-top"
                    />
                  </div>
                  {/* Live status dot */}
                  <div
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background transition-colors duration-300",
                      agentState === "thinking" && "bg-amber-400",
                      agentState === "speaking" && "bg-primary",
                      agentState === "listening" && "bg-cyan-400",
                      agentState === "idle" && "bg-emerald-400",
                    )}
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-[13px] font-semibold text-foreground tracking-tight leading-none">Hoppy</span>
                  <span className="text-[11px] text-muted-foreground mt-0.5 leading-none">
                    {agentState === "thinking" ? "Thinking..." : agentState === "speaking" ? "Responding" : "Online"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={clearMessages}
                  className="p-2 rounded-xl hover:bg-muted/50 transition-all text-muted-foreground hover:text-foreground"
                  title="New conversation"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl hover:bg-muted/50 transition-all text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Hairline divider */}
            <div className="h-px bg-border/10 mx-5" />

            {/* ─── Messages ─── */}
            <div
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto px-5 pt-4 pb-3 space-y-4 scrollbar-hide relative"
            >
              {/* Loading history */}
              {loadingHistory && (
                <div className="flex flex-col items-center justify-center py-16 gap-3 animate-fade-in">
                  <Loader2 className="h-5 w-5 animate-spin text-primary/40" />
                  <span className="text-[12px] text-muted-foreground/60 tracking-wide">Resuming conversation...</span>
                </div>
              )}

              {/* Empty state — Welcome */}
              {!loadingHistory && messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full animate-fade-in">
                  {/* Compact Hoppy face */}
                  <AgentFace state={agentState} size={80} />
                  
                  <h3 className="text-[15px] font-semibold text-foreground mt-4 tracking-tight">
                    Hey! I'm Hoppy 🐰
                  </h3>
                  <p className="text-[13px] text-muted-foreground/70 text-center max-w-[260px] mt-1.5 leading-relaxed">
                    Your AI studio assistant. Ask me anything about your projects, credits, or video creation.
                  </p>

                  {/* Quick prompts — pill style */}
                  <div className="grid grid-cols-2 gap-2 w-full max-w-[320px] mt-6">
                    {quickPrompts.map((prompt) => (
                      <button
                        key={prompt.text}
                        onClick={() => sendMessage(prompt.text)}
                        className="group flex flex-col items-start gap-1 px-3.5 py-3 rounded-2xl text-left
                                   transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]
                                   bg-muted/30 border border-border/10 hover:border-primary/20 hover:bg-muted/50"
                      >
                        <span className="text-[13px] text-primary/70 font-medium">{prompt.icon}</span>
                        <span className="text-[12px] text-foreground/80 font-medium leading-tight group-hover:text-foreground transition-colors">
                          {prompt.text}
                        </span>
                        <span className="text-[10px] text-muted-foreground/50 leading-none">{prompt.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Message thread */}
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
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3 items-start"
                >
                  <div className="h-7 w-7 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-primary/15">
                    <video
                      src="/hoppy-blink.mp4"
                      autoPlay loop muted playsInline
                      className="w-full h-full object-cover scale-[1.4] object-top"
                    />
                  </div>
                  <div className="flex gap-1 items-center px-4 py-3 rounded-2xl rounded-tl-md bg-muted/30 border border-border/10">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="h-[5px] w-[5px] rounded-full bg-primary/50"
                        animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
                        transition={{
                          duration: 0.7,
                          repeat: Infinity,
                          delay: i * 0.12,
                          ease: "easeInOut",
                        }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Scroll-to-bottom pill */}
            <AnimatePresence>
              {showScrollDown && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  onClick={scrollToBottom}
                  className="absolute bottom-28 left-1/2 -translate-x-1/2 z-10
                             flex items-center gap-1.5 px-3 py-1.5 rounded-full
                             bg-card/90 border border-border/20 backdrop-blur-sm
                             text-[11px] text-muted-foreground hover:text-foreground
                             shadow-lg transition-colors"
                >
                  <ChevronDown className="h-3 w-3" />
                  New messages
                </motion.button>
              )}
            </AnimatePresence>

            {/* Confirmation overlay */}
            <AnimatePresence>
              {pendingAction && (
                <motion.div
                  initial={{ y: 16, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 16, opacity: 0 }}
                  className="absolute bottom-28 left-5 right-5 p-4 rounded-2xl z-10
                             bg-card/95 border border-border/20 backdrop-blur-xl
                             shadow-[0_8px_40px_hsl(0_0%_0%/0.5)]"
                >
                  <div className="flex items-center gap-2 mb-2.5">
                    <Zap className="h-4 w-4 text-amber-400" />
                    <span className="text-[13px] font-semibold text-foreground">
                      {pendingAction.action === "confirm_delete" ? "Confirm deletion" : "Confirm action"}
                    </span>
                  </div>
                  <p className="text-[12px] text-muted-foreground mb-4 leading-relaxed">
                    {(pendingAction as any).message || 
                      `This will use approximately ${pendingAction.estimated_credits || 0} credits. Ready to proceed?`}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPendingAction(null)}
                      className="flex-1 text-[12px] rounded-xl h-9 border-border/20"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={confirmAction}
                      className="flex-1 text-[12px] bg-primary hover:bg-primary/90 rounded-xl h-9"
                    >
                      Confirm ✨
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ─── Input area ─── */}
            <div className="relative px-5 pb-5 pt-3 border-t border-border/8">
              <div
                className={cn(
                  "flex items-end gap-2 rounded-2xl transition-all duration-200",
                  "bg-muted/25 border",
                  input.trim()
                    ? "border-primary/25 shadow-[0_0_0_1px_hsl(var(--primary)/0.08)]"
                    : "border-border/10"
                )}
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Hoppy anything..."
                  rows={1}
                  className="flex-1 resize-none bg-transparent px-4 py-3
                           text-[13px] text-foreground placeholder:text-muted-foreground/35
                           focus:outline-none transition-all max-h-28 scrollbar-hide w-full
                           leading-relaxed"
                  style={{ minHeight: "44px" }}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className={cn(
                    "h-9 w-9 rounded-xl flex items-center justify-center transition-all flex-shrink-0 mr-1.5 mb-1.5",
                    input.trim() && !isLoading
                      ? "bg-primary text-primary-foreground shadow-[0_0_16px_hsl(var(--primary)/0.25)]"
                      : "bg-transparent text-muted-foreground/25 cursor-not-allowed"
                  )}
                >
                  {isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground/25 text-center mt-2 tracking-wide">
                Free Q&A · Actions may cost credits
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ══════════════════════════════════════════════════════
// Message Bubble — Next-Gen Conversational Style
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
      initial={isLatest ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}
    >
      {/* Hoppy avatar — assistant only */}
      {!isUser && (
        <div className="h-7 w-7 rounded-full overflow-hidden flex-shrink-0 mt-1 ring-1 ring-primary/15">
          <video
            src="/hoppy-blink.mp4"
            autoPlay loop muted playsInline
            className="w-full h-full object-cover scale-[1.4] object-top"
          />
        </div>
      )}

      <div className={cn("max-w-[85%] flex flex-col gap-1.5")}>
        {/* Message content */}
        <div
          className={cn(
            "px-4 py-3 text-[13px] leading-[1.65]",
            isUser
              ? "rounded-[20px] rounded-br-lg"
              : "rounded-[20px] rounded-tl-lg"
          )}
          style={
            isUser
              ? {
                  background: "hsl(var(--primary))",
                  color: "hsl(var(--primary-foreground))",
                }
              : {
                  background: "hsl(var(--muted) / 0.35)",
                  border: "1px solid hsl(var(--border) / 0.08)",
                  color: "hsl(var(--foreground) / 0.92)",
                }
          }
        >
          {isUser ? (
            <p className="font-[420]">{message.content}</p>
          ) : (
            <div className="prose prose-sm prose-invert max-w-none
                          [&>p]:mb-2 [&>p:last-child]:mb-0
                          [&>ul]:mb-2 [&>ol]:mb-2 [&>li]:mb-0.5
                          [&_strong]:text-foreground [&_strong]:font-semibold
                          [&_a]:text-primary [&_a]:no-underline [&_a:hover]:underline
                          [&_code]:text-primary/80 [&_code]:bg-primary/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:text-[12px]
                          [&_h3]:text-[13px] [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1
                          [&>blockquote]:border-l-2 [&>blockquote]:border-primary/30 [&>blockquote]:pl-3 [&>blockquote]:italic [&>blockquote]:text-muted-foreground">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Meta row: credits + time */}
        <div className={cn("flex items-center gap-2 px-1", isUser ? "justify-end" : "justify-start")}>
          {!isUser && message.creditsCharged && message.creditsCharged > 0 && (
            <span className="text-[10px] text-amber-400/50 flex items-center gap-0.5 font-medium">
              <Zap className="h-2.5 w-2.5" />
              {message.creditsCharged} cr
            </span>
          )}
          <span className="text-[10px] text-muted-foreground/30 tabular-nums">
            {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        {/* Action chips */}
        {message.actions && message.actions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-0.5">
            {message.actions.map((action, i) => (
              <button
                key={i}
                onClick={() => onAction(action)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium
                         bg-primary/8 text-primary/80 border border-primary/12
                         hover:bg-primary/15 hover:text-primary hover:border-primary/25
                         transition-all duration-150 active:scale-[0.97]"
              >
                <ArrowRight className="h-3 w-3" />
                {action.action === "navigate" && action.path}
                {action.action === "open_buy_credits" && "💳 Buy Credits"}
                {action.action === "start_creation" && `Create · ${action.estimated_credits}cr`}
                {action.action === "generate_script" && "Preview script"}
                {action.action === "project_created" && "📁 View Projects"}
                {action.action === "project_renamed" && "✅ Renamed"}
                {action.action === "confirm_generation" && `🎬 Generate · ${action.estimated_credits}cr`}
                {action.action === "confirm_delete" && "🗑️ Confirm Delete"}
                {action.action === "insufficient_credits" && "💳 Get Credits"}
                {action.action === "followed_user" && "✅ Followed"}
                {action.action === "unfollowed_user" && "✅ Unfollowed"}
                {action.action === "liked_project" && "❤️ Liked"}
                {action.action === "unliked_project" && "💔 Unliked"}
                {action.action === "dm_sent" && "💬 Sent"}
                {action.action === "profile_updated" && "✅ Updated"}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
