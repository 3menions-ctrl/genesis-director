/**
 * Hoppy Agent Panel 🐰 — Full-Screen Immersive Experience
 * 
 * Editorial card-based layout (NOT traditional chat bubbles):
 * - User messages: compact pills on the right
 * - Hoppy messages: full-width editorial cards with accent bars
 * - Cinematic ambient backgrounds
 * - Large display typography (Sora)
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, RotateCcw, Zap, ArrowRight, Loader2, Sparkles, ChevronDown, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentFace } from "./AgentFace";
import { useAgentChat, AgentAction, AgentMessage } from "@/hooks/useAgentChat";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import { RichBlocksRenderer } from "./HoppyRichBlocks";

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
  const location = useLocation();

  // Close on route change
  const prevPathRef = useRef(location.pathname);
  useEffect(() => {
    if (prevPathRef.current !== location.pathname && isOpen) {
      onClose();
    }
    prevPathRef.current = location.pathname;
  }, [location.pathname, isOpen, onClose]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 400);
  }, [isOpen]);

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

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
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
    } else if (act === "generation_started" && (action as any).navigate_to) {
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
    } else if (act === "published" || act === "unpublished" || act === "project_updated" || act === "dm_sent" || act === "followed_user" || act === "unfollowed_user" || act === "liked_project" || act === "unliked_project" || act === "profile_updated") {
      // confirmation-only actions
    }
  };

  const confirmAction = async () => {
    if (!pendingAction) return;
    if (pendingAction.action === "start_creation") {
      navigate("/create");
    } else if (pendingAction.action === "confirm_generation") {
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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] flex flex-col"
          style={{ background: "hsl(var(--background))" }}
        >
          {/* ─── Ambient Background Graphics ─── */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div
              className="absolute -top-[20%] -left-[10%] w-[600px] h-[600px] rounded-full opacity-20 blur-[120px]"
              style={{ background: "hsl(var(--primary))" }}
            />
            <div
              className="absolute -bottom-[15%] -right-[10%] w-[500px] h-[500px] rounded-full opacity-15 blur-[100px]"
              style={{ background: "hsl(var(--accent))" }}
            />
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-[0.04]"
              style={{ background: "radial-gradient(circle, hsl(var(--primary)), transparent 70%)" }}
            />
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 rounded-full bg-primary/30"
                style={{ top: `${15 + i * 14}%`, left: `${10 + i * 15}%` }}
                animate={{ y: [0, -30, 0], opacity: [0.2, 0.5, 0.2] }}
                transition={{ duration: 4 + i * 0.5, repeat: Infinity, delay: i * 0.8, ease: "easeInOut" }}
              />
            ))}
            <div
              className="absolute inset-0 opacity-[0.015]"
              style={{
                backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px),
                                  linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
                backgroundSize: "60px 60px",
              }}
            />
          </div>

          {/* ─── Header ─── */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="relative flex items-center justify-between px-6 md:px-10 pt-6 pb-4 z-10"
          >
            <div className="flex items-center gap-4">
              <div className="relative">
                <div
                  className={cn(
                    "h-12 w-12 rounded-2xl overflow-hidden ring-2 ring-offset-2 ring-offset-background transition-all duration-500",
                    agentState === "thinking" && "ring-amber-400/40",
                    agentState === "speaking" && "ring-primary/50",
                    agentState === "listening" && "ring-accent/40",
                    agentState === "idle" && "ring-emerald-400/30",
                  )}
                >
                  <video
                    src="/hoppy-blink.mp4"
                    autoPlay loop muted playsInline
                    className="w-full h-full object-cover scale-[1.4] object-top"
                  />
                </div>
                <div
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background transition-colors duration-300",
                    agentState === "thinking" && "bg-amber-400",
                    agentState === "speaking" && "bg-primary",
                    agentState === "listening" && "bg-accent",
                    agentState === "idle" && "bg-emerald-400",
                  )}
                />
              </div>
              <div className="flex flex-col">
                <h1 className="font-display text-xl font-bold text-foreground tracking-tight leading-none">
                  Hoppy
                </h1>
                <span className="text-xs text-muted-foreground mt-1 font-medium tracking-wide uppercase">
                  {agentState === "thinking" ? "Thinking..." : agentState === "speaking" ? "Responding" : "AI Creative Director"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={clearMessages}
                className="p-2.5 rounded-xl bg-surface-1/60 border border-border/10 hover:bg-surface-2/80 
                           transition-all text-muted-foreground hover:text-foreground backdrop-blur-sm"
                title="New conversation"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                onClick={onClose}
                className="p-2.5 rounded-xl bg-surface-1/60 border border-border/10 hover:bg-destructive/20 
                           transition-all text-muted-foreground hover:text-foreground backdrop-blur-sm"
                title="Exit Hoppy"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>

          <div className="h-px bg-border/8 mx-6 md:mx-10" />

          {/* ─── Messages Area ─── */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto px-4 md:px-10 pt-6 pb-4 scrollbar-hide relative z-10"
          >
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Loading history */}
              {loadingHistory && (
                <div className="flex flex-col items-center justify-center py-24 gap-4 animate-fade-in">
                  <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
                  <span className="text-sm text-muted-foreground/60 tracking-wide font-display">
                    Resuming conversation...
                  </span>
                </div>
              )}

              {/* Empty state */}
              {!loadingHistory && messages.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="flex flex-col items-center justify-center min-h-[60vh] text-center"
                >
                  <AgentFace state={agentState} size={100} />

                  <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mt-8 tracking-tight">
                    Hey! I'm Hoppy 🐰
                  </h2>
                  <p className="text-base md:text-lg text-muted-foreground/70 max-w-md mt-3 leading-relaxed">
                    Your AI studio assistant. Ask me anything about your projects, credits, or video creation.
                  </p>

                  <div className="grid grid-cols-2 gap-3 w-full max-w-lg mt-10">
                    {quickPrompts.map((prompt, idx) => (
                      <motion.button
                        key={prompt.text}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.35 + idx * 0.08 }}
                        onClick={() => sendMessage(prompt.text)}
                        className="group flex flex-col items-start gap-2 px-5 py-4 rounded-2xl text-left
                                   transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]
                                   bg-surface-1/50 border border-border/10 hover:border-primary/25 
                                   hover:bg-surface-2/60 backdrop-blur-md
                                   hover:shadow-[0_0_30px_hsl(var(--primary)/0.08)]"
                      >
                        <span className="text-lg text-primary/60 group-hover:text-primary transition-colors">
                          {prompt.icon}
                        </span>
                        <span className="font-display text-sm font-semibold text-foreground/85 leading-tight group-hover:text-foreground transition-colors">
                          {prompt.text}
                        </span>
                        <span className="text-[11px] text-muted-foreground/45 leading-none">{prompt.sub}</span>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Message thread */}
              {messages.map((msg, i) => (
                <ImmersiveMessageBubble
                  key={msg.id}
                  message={msg}
                  onAction={handleAction}
                  onNavigate={(path) => { navigate(path); onClose(); }}
                  onSendMessage={sendMessage}
                  isLatest={i === messages.length - 1}
                />
              ))}

              {/* Typing indicator */}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full"
                >
                  <div
                    className="w-full rounded-3xl overflow-hidden backdrop-blur-xl px-6 py-5"
                    style={{
                      background: "hsl(var(--surface-1) / 0.45)",
                      border: "1px solid hsl(var(--border) / 0.08)",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-7 w-7 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-primary/10">
                        <video
                          src="/hoppy-blink.mp4"
                          autoPlay loop muted playsInline
                          className="w-full h-full object-cover scale-[1.4] object-top"
                        />
                      </div>
                      <div className="flex gap-1.5 items-center">
                        {[0, 1, 2].map((i) => (
                          <motion.span
                            key={i}
                            className="h-[6px] w-[6px] rounded-full bg-primary/50"
                            animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
                            transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Scroll-to-bottom pill */}
          <AnimatePresence>
            {showScrollDown && (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                onClick={scrollToBottom}
                className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[101]
                           flex items-center gap-1.5 px-4 py-2 rounded-full
                           bg-surface-1/90 border border-border/15 backdrop-blur-md
                           text-xs text-muted-foreground hover:text-foreground
                           shadow-xl transition-colors font-display"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                New messages
              </motion.button>
            )}
          </AnimatePresence>

          {/* Confirmation overlay */}
          <AnimatePresence>
            {pendingAction && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                className="fixed bottom-32 left-1/2 -translate-x-1/2 w-[90%] max-w-md p-5 rounded-2xl z-[102]
                           bg-surface-1/95 border border-border/15 backdrop-blur-xl
                           shadow-[0_12px_60px_hsl(0_0%_0%/0.5)]"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-4 w-4 text-amber-400" />
                  <span className="font-display text-sm font-semibold text-foreground">
                    {pendingAction.action === "confirm_delete" ? "Confirm deletion" : "Confirm action"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                  {pendingAction.reason || "This action requires your confirmation."}
                  {pendingAction.estimated_credits && (
                    <span className="block mt-2 text-amber-400/80 font-display font-semibold text-xs">
                      Cost: {pendingAction.estimated_credits} credits
                    </span>
                  )}
                </p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setPendingAction(null)} className="flex-1">
                    Cancel
                  </Button>
                  <Button variant="default" size="sm" onClick={confirmAction} className="flex-1">
                    Confirm
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── Input Bar ─── */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="relative z-10 px-4 md:px-10 pb-6 pt-3"
          >
            <div className="max-w-3xl mx-auto">
              <div
                className="flex items-end gap-3 rounded-2xl px-5 py-3 backdrop-blur-xl"
                style={{
                  background: "hsl(var(--surface-1) / 0.6)",
                  border: "1px solid hsl(var(--border) / 0.1)",
                  boxShadow: "0 -4px 40px hsl(0 0% 0% / 0.08)",
                }}
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Hoppy anything..."
                  className="flex-1 bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground/40 
                             resize-none border-none outline-none font-sans leading-[1.6] max-h-28 min-h-[24px]"
                  rows={1}
                  disabled={isLoading}
                  style={{ fieldSizing: "content" } as any}
                />
                <button
                  onClick={handleSend}
                  disabled={isLoading || !input.trim()}
                  className={cn(
                    "p-2.5 rounded-xl transition-all duration-200 flex-shrink-0",
                    input.trim()
                      ? "bg-primary text-primary-foreground shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-95"
                      : "bg-transparent text-muted-foreground/30 cursor-not-allowed"
                  )}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ══════════════════════════════════════════════════════
// Hoppy Markdown — Safe renderer with error boundary
// ══════════════════════════════════════════════════════

function HoppyMarkdown({ content }: { content: string }) {
  try {
    return (
      <div className="space-y-4
                    [&>p]:text-[15.5px] [&>p]:leading-[1.9] [&>p]:text-foreground/85
                    [&>p:first-child]:text-[17px] [&>p:first-child]:font-medium [&>p:first-child]:text-foreground [&>p:first-child]:leading-[1.7]
                    [&>ul]:space-y-2 [&>ol]:space-y-2
                    [&>ul]:pl-1 [&>ol]:pl-1
                    [&_li]:text-[15px] [&_li]:leading-[1.8] [&_li]:text-foreground/80
                    [&_strong]:text-foreground [&_strong]:font-semibold
                    [&_em]:text-primary/70
                    [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-primary/30 [&_a:hover]:decoration-primary
                    [&_code]:text-primary/80 [&_code]:bg-primary/8 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-lg [&_code]:text-[13px] [&_code]:font-mono
                    [&_h2]:text-xl [&_h2]:font-display [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:text-foreground [&_h2]:tracking-tight
                    [&_h3]:text-[17px] [&_h3]:font-display [&_h3]:font-semibold [&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-foreground/90
                    [&>blockquote]:border-l-[3px] [&>blockquote]:border-primary/30 [&>blockquote]:pl-5 [&>blockquote]:py-2 [&>blockquote]:italic [&>blockquote]:text-muted-foreground [&>blockquote]:bg-primary/[0.03] [&>blockquote]:rounded-r-2xl [&>blockquote]:my-5
                    [&>hr]:border-border/8 [&>hr]:my-6">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    );
  } catch {
    return <p className="font-sans text-[15px] leading-[1.85]">{content}</p>;
  }
}

// ══════════════════════════════════════════════════════
// Editorial Message Card — NOT chat bubbles
// ══════════════════════════════════════════════════════

function ImmersiveMessageBubble({
  message,
  onAction,
  onNavigate,
  onSendMessage,
  isLatest,
}: {
  message: AgentMessage;
  onAction: (action: AgentAction) => void;
  onNavigate: (path: string) => void;
  onSendMessage: (content: string) => void;
  isLatest: boolean;
}) {
  const isUser = message.role === "user";
  const handleRichBlockNav = onNavigate;

  // ── User message: compact pill on the right ──
  if (isUser) {
    return (
      <motion.div
        initial={isLatest ? { opacity: 0, y: 8 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex justify-end"
      >
        <div className="max-w-[75%]">
          <div
            className="px-5 py-3 rounded-2xl rounded-br-lg text-sm leading-[1.7] font-sans"
            style={{
              background: "hsl(var(--primary))",
              color: "hsl(var(--primary-foreground))",
            }}
          >
            {message.content}
          </div>
          <div className="flex justify-end mt-1.5 pr-1">
            <span className="text-[10px] text-muted-foreground/25 tabular-nums font-display">
              {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>
      </motion.div>
    );
  }

  // ── Hoppy message: full-width editorial card ──
  return (
    <motion.div
      initial={isLatest ? { opacity: 0, y: 12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="w-full"
    >
      <div
        className="w-full rounded-3xl overflow-hidden backdrop-blur-xl"
        style={{
          background: "hsl(var(--surface-1) / 0.45)",
          border: "1px solid hsl(var(--border) / 0.08)",
        }}
      >
        {/* Top accent gradient bar */}
        <div className="h-[2px] w-full" style={{ background: "linear-gradient(90deg, hsl(var(--primary) / 0.4), hsl(var(--accent) / 0.2), transparent)" }} />

        {/* Header with avatar + timestamp */}
        <div className="flex items-center gap-3 px-6 pt-5 pb-1">
          <div className="h-7 w-7 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-primary/10">
            <video
              src="/hoppy-blink.mp4"
              autoPlay loop muted playsInline
              className="w-full h-full object-cover scale-[1.4] object-top"
            />
          </div>
          <span className="font-display text-xs font-semibold text-foreground/60 tracking-wide uppercase">Hoppy</span>
          <div className="flex-1" />
          {message.creditsCharged && message.creditsCharged > 0 && (
            <span className="text-[10px] text-amber-400/60 flex items-center gap-0.5 font-medium">
              <Zap className="h-2.5 w-2.5" />
              {message.creditsCharged} cr
            </span>
          )}
          <span className="text-[10px] text-muted-foreground/30 tabular-nums font-display">
            {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        {/* Main content area */}
        <div className="px-6 py-4">
          <HoppyMarkdown content={message.content} />
        </div>

        {/* Rich content blocks */}
        {message.richBlocks && message.richBlocks.length > 0 && (
          <div className="px-5 pb-4">
            <RichBlocksRenderer blocks={message.richBlocks} onNavigate={handleRichBlockNav} onSendMessage={onSendMessage} />
          </div>
        )}

        {/* Action chips footer */}
        {message.actions && message.actions.length > 0 && (
          <div className="px-6 pb-5">
            <div className="h-px w-full mb-4" style={{ background: "hsl(var(--border) / 0.06)" }} />
            <div className="flex flex-wrap gap-2">
              {message.actions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => onAction(action)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-display font-semibold
                           bg-primary/8 text-primary/80 border border-primary/12
                           hover:bg-primary/15 hover:text-primary hover:border-primary/25
                           transition-all duration-150 active:scale-[0.97]
                           backdrop-blur-sm"
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
                  {action.action === "clip_updated" && "✏️ Clip Updated"}
                  {action.action === "clip_retried" && "🔄 Retrying"}
                  {action.action === "clips_reordered" && "🎬 Reordered"}
                  {action.action === "generation_started" && "🎬 Generating..."}
                  {action.action === "published" && "🌟 Published!"}
                  {action.action === "unpublished" && "🔒 Made Private"}
                  {action.action === "project_updated" && "✅ Updated"}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
