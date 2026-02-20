/**
 * Hoppy Agent Panel 🐰 — Clean Rebuild
 * All original features preserved. Focus management completely rewritten.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Send, RotateCcw, Zap, ArrowRight, Loader2, Sparkles,
  ChevronDown, Paperclip, XCircle, MessageSquarePlus, Eraser,
  Star, Keyboard, MessageCircle, Settings,
} from "lucide-react";
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
  const {
    messages,
    isLoading,
    sendMessage,
    clearMessages,
    agentState,
    loadingHistory,
  } = useAgentChat();

  const [input, setInput] = useState("");
  const [pendingAction, setPendingAction] = useState<AgentAction | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<{ url: string; name: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const navigate = useNavigate();
  const location = useLocation();

  // ── Close panel on route change ──
  const prevPathRef = useRef(location.pathname);
  useEffect(() => {
    if (prevPathRef.current !== location.pathname && isOpen) onClose();
    prevPathRef.current = location.pathname;
  }, [location.pathname, isOpen, onClose]);

  // ── Prevent body scroll when panel is open ──
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // ── Focus on open ──
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 350);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // ── Keep focus in the textarea at all times while panel is open.
  //    This is the only 100% reliable approach on mobile (iOS Safari).
  //    When the textarea loses focus for any reason (Hoppy streaming,
  //    button clicks, etc.) we immediately reclaim it — UNLESS the user
  //    tapped an interactive element like the file picker or send button.
  const handleTextareaBlur = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
    if (!isOpen) return;
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    // Allow blur if focus moved to a real interactive element
    const isInteractive = relatedTarget && (
      relatedTarget.tagName === "BUTTON" ||
      relatedTarget.tagName === "INPUT" ||
      relatedTarget.tagName === "A" ||
      relatedTarget.getAttribute("role") === "button"
    );
    if (isInteractive) return;
    // Otherwise immediately reclaim focus
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [isOpen]);

  // ── Auto-scroll on new messages ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Show "scroll to bottom" pill ──
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onScroll = () =>
      setShowScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 120);
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // ── Image upload ──
  const handleImageUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be less than 10MB");
      return;
    }
    setIsUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage
        .from("hoppy-uploads")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage
        .from("hoppy-uploads")
        .getPublicUrl(path);
      setUploadedImage({ url: urlData.publicUrl, name: file.name });
    } catch (err) {
      console.error("Image upload failed:", err);
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleImageUpload(file);
      e.target.value = "";
    },
    [handleImageUpload]
  );

  // ── Send message ──
  const handleSend = useCallback(async () => {
    if ((!input.trim() && !uploadedImage) || isLoading) return;
    let msg = input;
    if (uploadedImage) {
      msg = msg
        ? `${msg}\n\n[Image attached: ${uploadedImage.url}]`
        : `[Image attached: ${uploadedImage.url}]`;
    }
    setInput("");
    setUploadedImage(null);
    await sendMessage(msg);
  }, [input, uploadedImage, isLoading, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Action buttons ──
  const handleAction = (action: AgentAction) => {
    const act = action.action;
    if (act === "navigate" && action.path) { navigate(action.path); onClose(); }
    else if (act === "open_buy_credits") { navigate("/pricing"); onClose(); }
    else if (act === "project_created" && (action as any).navigate_to) { navigate((action as any).navigate_to); onClose(); }
    else if (act === "generation_started" && (action as any).navigate_to) { navigate((action as any).navigate_to); onClose(); }
    else if (act === "start_creation") {
      const params = (action as any).params || {};
      const qp = new URLSearchParams();
      if (params.mode) qp.set("mode", params.mode);
      if (params.prompt) qp.set("prompt", params.prompt);
      if (params.image_url) {
        sessionStorage.setItem("imageToVideoUrl", params.image_url);
        qp.set("mode", "image-to-video");
      }
      navigate(`/create?${qp.toString()}`);
      onClose();
    } else if (act === "confirm_generation" || act === "confirm_delete") {
      setPendingAction(action);
    } else if (act === "insufficient_credits") { navigate("/pricing"); onClose(); }
    else if (act === "generate_script") { navigate("/create"); onClose(); }
  };

  const confirmAction = async () => {
    if (!pendingAction) return;
    if (pendingAction.action === "start_creation") {
      const params = (pendingAction as any).params || {};
      const qp = new URLSearchParams();
      if (params.mode) qp.set("mode", params.mode);
      if (params.prompt) qp.set("prompt", params.prompt);
      if (params.image_url) {
        sessionStorage.setItem("imageToVideoUrl", params.image_url);
        qp.set("mode", "image-to-video");
      }
      navigate(`/create?${qp.toString()}`);
    } else if (pendingAction.action === "confirm_generation") {
      await sendMessage(`Yes, go ahead and generate project ${(pendingAction as any).project_id}`);
    } else if (pendingAction.action === "confirm_delete") {
      await sendMessage(`Yes, delete project ${(pendingAction as any).project_id}`);
    }
    const wasStart = pendingAction.action === "start_creation";
    setPendingAction(null);
    if (wasStart) onClose();
  };

  const scrollToBottom = () =>
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  // ── Derived UI state ──
  const stateLabel =
    agentState === "thinking" ? "Thinking…" :
    agentState === "speaking" ? "Responding" :
    agentState === "listening" ? "Listening…" : "Ready";

  const stateDot =
    agentState === "thinking" ? "bg-amber-400" :
    agentState === "speaking" ? "bg-primary" :
    agentState === "listening" ? "bg-cyan-400" : "bg-emerald-400";

  const canSend = !!(input.trim() || uploadedImage) && !isLoading;

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
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex flex-col"
          style={{ background: "hsl(var(--background))" }}
        >
          {/* ── Ambient background ── */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <motion.div
              animate={{ scale: [1, 1.05, 1], opacity: [0.06, 0.09, 0.06] }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full blur-[120px]"
              style={{ background: "hsl(var(--primary))" }}
            />
            <motion.div
              animate={{ scale: [1, 1.08, 1], opacity: [0.04, 0.07, 0.04] }}
              transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 3 }}
              className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full blur-[100px]"
              style={{ background: "hsl(var(--accent))" }}
            />
            <div
              className="absolute inset-0 opacity-[0.015]"
              style={{
                backgroundImage: `radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)`,
                backgroundSize: "28px 28px",
              }}
            />
          </div>

          {/* ── Header ── */}
          <motion.header
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.05, duration: 0.3 }}
            className="relative z-10 flex items-center gap-3 px-5 py-4"
            style={{ borderBottom: "1px solid hsl(var(--border) / 0.07)" }}
          >
            <div className="relative flex-shrink-0">
              <motion.div
                animate={
                  agentState !== "idle"
                    ? { boxShadow: ["0 0 0 0 hsl(var(--primary)/0.4)", "0 0 0 8px hsl(var(--primary)/0)", "0 0 0 0 hsl(var(--primary)/0.4)"] }
                    : {}
                }
                transition={{ duration: 2, repeat: Infinity }}
                className="h-9 w-9 rounded-xl overflow-hidden"
              >
                <video
                  src="/hoppy-blink.mp4"
                  autoPlay loop muted playsInline
                  className="w-full h-full object-cover scale-[1.4] object-top"
                />
              </motion.div>
              <span
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background transition-all duration-500",
                  stateDot
                )}
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-foreground tracking-tight">Hoppy</span>
                <span className="text-[10px] text-muted-foreground/50 font-mono">AI</span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", stateDot)} />
                <span className="text-[11px] text-muted-foreground/40">{stateLabel}</span>
              </div>
            </div>

            {/* Header actions */}
            <div className="flex items-center gap-1">
              {/* Settings menu */}
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className={cn(
                    "p-2 rounded-lg transition-all duration-150",
                    menuOpen
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground/40 hover:text-foreground hover:bg-muted/10"
                  )}
                >
                  <Settings className="h-3.5 w-3.5" />
                </button>

                <AnimatePresence>
                  {menuOpen && (
                    <>
                      <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-10"
                        onClick={() => setMenuOpen(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-10 z-20 w-52 rounded-2xl overflow-hidden shadow-2xl"
                        style={{
                          background: "hsl(var(--surface-1) / 0.97)",
                          border: "1px solid hsl(var(--border) / 0.12)",
                          backdropFilter: "blur(32px)",
                        }}
                      >
                        <div className="p-1.5">
                          <MenuGroup label="Conversation">
                            <MenuItem
                              icon={<MessageSquarePlus className="h-3.5 w-3.5" />}
                              label="New Chat"
                              accent
                              onClick={() => {
                                clearMessages();
                                setMenuOpen(false);
                                setTimeout(() => inputRef.current?.focus(), 100);
                              }}
                            />
                            <MenuItem
                              icon={<Eraser className="h-3.5 w-3.5" />}
                              label="Clear Messages"
                              onClick={() => { clearMessages(); setMenuOpen(false); }}
                            />
                          </MenuGroup>
                          <div className="h-px bg-border/8 my-1" />
                          <MenuGroup label="Quick Actions">
                            <MenuItem icon={<Star className="h-3.5 w-3.5" />} label="Capabilities"
                              onClick={() => { sendMessage("What can you do?"); setMenuOpen(false); }} />
                            <MenuItem icon={<Zap className="h-3.5 w-3.5" />} label="My Credits"
                              onClick={() => { sendMessage("Check my credits"); setMenuOpen(false); }} />
                            <MenuItem icon={<Sparkles className="h-3.5 w-3.5" />} label="Create Video"
                              onClick={() => { sendMessage("Create a video"); setMenuOpen(false); }} />
                            <MenuItem icon={<MessageCircle className="h-3.5 w-3.5" />} label="My Projects"
                              onClick={() => { sendMessage("Show my projects"); setMenuOpen(false); }} />
                          </MenuGroup>
                          <div className="h-px bg-border/8 my-1" />
                          <MenuGroup label="Info">
                            <MenuItem
                              icon={<Keyboard className="h-3.5 w-3.5" />}
                              label="Enter to send · ⇧ for newline"
                              isStatic
                            />
                          </MenuGroup>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              <button
                onClick={clearMessages}
                title="New conversation"
                className="p-2 rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-muted/10 transition-all"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/8 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.header>

          {/* ── Messages ── */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto relative z-10"
            style={{ scrollbarWidth: "none" }}
            onClick={() => inputRef.current?.focus()}
          >
            <div className="max-w-2xl mx-auto px-4 md:px-6 pt-8 pb-4">

              {/* Loading history */}
              {loadingHistory && (
                <div className="flex flex-col items-center justify-center py-28 gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary/30" />
                  <span className="text-xs text-muted-foreground/30">Loading conversation…</span>
                </div>
              )}

              {/* Empty state */}
              {!loadingHistory && messages.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="flex flex-col items-center justify-center min-h-[62vh] text-center"
                >
                  <motion.div
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <AgentFace state={agentState} size={80} />
                  </motion.div>

                  <h1 className="font-semibold text-2xl md:text-3xl text-foreground mt-7 tracking-tight">
                    Hey, I'm Hoppy 🐰
                  </h1>
                  <p className="text-sm text-muted-foreground/50 max-w-xs mt-2.5 leading-relaxed">
                    Your AI studio director. Ask me anything about your projects, credits, or creative work.
                  </p>

                  <div className="grid grid-cols-2 gap-2 w-full max-w-sm mt-8">
                    {quickPrompts.map((prompt, idx) => (
                      <motion.button
                        key={prompt.text}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 + idx * 0.06 }}
                        onClick={() => sendMessage(prompt.text)}
                        className="group flex flex-col items-start gap-1 px-3.5 py-3 rounded-xl text-left
                                   transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]
                                   hover:border-primary/25 hover:bg-primary/4"
                        style={{
                          background: "hsl(var(--surface-1) / 0.4)",
                          border: "1px solid hsl(var(--border) / 0.08)",
                        }}
                      >
                        <span className="text-sm text-primary/40 group-hover:text-primary/70 transition-colors font-mono">
                          {prompt.icon}
                        </span>
                        <span className="text-[13px] font-medium text-foreground/70 group-hover:text-foreground transition-colors leading-tight">
                          {prompt.text}
                        </span>
                        <span className="text-[10px] text-muted-foreground/30">{prompt.sub}</span>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Message list */}
              <div className="space-y-6">
                {messages.map((msg, i) => (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    onAction={handleAction}
                    onNavigate={(path) => { navigate(path); onClose(); }}
                    onSendMessage={sendMessage}
                    isLatest={i === messages.length - 1}
                  />
                ))}

                {/* Typing indicator — only shown before any streaming token arrives */}
                {isLoading && !messages.some((m) => m.streaming && m.content.length > 0) && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-3 items-end"
                  >
                    <div className="h-7 w-7 rounded-xl overflow-hidden flex-shrink-0 ring-1 ring-primary/10">
                      <video
                        src="/hoppy-blink.mp4"
                        autoPlay loop muted playsInline
                        className="w-full h-full object-cover scale-[1.4] object-top"
                      />
                    </div>
                    <div
                      className="flex items-center gap-1 px-4 py-3 rounded-2xl rounded-bl-sm"
                      style={{
                        background: "hsl(var(--surface-1) / 0.6)",
                        border: "1px solid hsl(var(--border) / 0.08)",
                      }}
                    >
                      {[0, 1, 2].map((dot) => (
                        <motion.span
                          key={dot}
                          className="h-[5px] w-[5px] rounded-full bg-primary/50"
                          animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 0.7, repeat: Infinity, delay: dot * 0.13, ease: "easeInOut" }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>
          </div>

          {/* Scroll-down pill */}
          <AnimatePresence>
            {showScrollDown && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                onClick={scrollToBottom}
                className="absolute bottom-28 left-1/2 -translate-x-1/2 z-20
                           flex items-center gap-1.5 px-3.5 py-1.5 rounded-full
                           text-xs text-muted-foreground hover:text-foreground
                           transition-colors shadow-lg"
                style={{
                  background: "hsl(var(--surface-1) / 0.95)",
                  border: "1px solid hsl(var(--border) / 0.12)",
                  backdropFilter: "blur(16px)",
                }}
              >
                <ChevronDown className="h-3 w-3" /> New messages
              </motion.button>
            )}
          </AnimatePresence>

          {/* Confirm overlay */}
          <AnimatePresence>
            {pendingAction && (
              <motion.div
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 16, opacity: 0 }}
                className="absolute bottom-32 left-1/2 -translate-x-1/2 w-[90%] max-w-sm p-5 rounded-2xl z-30 shadow-2xl"
                style={{
                  background: "hsl(var(--surface-1) / 0.98)",
                  border: "1px solid hsl(var(--border) / 0.12)",
                  backdropFilter: "blur(32px)",
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-7 w-7 rounded-lg bg-amber-400/10 flex items-center justify-center">
                    <Zap className="h-3.5 w-3.5 text-amber-400" />
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {pendingAction.action === "confirm_delete" ? "Confirm deletion" : "Confirm action"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground/70 mb-4 leading-relaxed">
                  {pendingAction.reason || "This action requires your confirmation."}
                  {pendingAction.estimated_credits && (
                    <span className="block mt-1.5 text-amber-400/80 font-semibold text-xs">
                      Cost: {pendingAction.estimated_credits} credits
                    </span>
                  )}
                </p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setPendingAction(null)} className="flex-1 h-9 rounded-xl">
                    Cancel
                  </Button>
                  <Button size="sm" onClick={confirmAction} className="flex-1 h-9 rounded-xl">
                    Confirm
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Input bar ── */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="relative z-10 px-4 md:px-6 pb-6 pt-3"
          >
            <div className="max-w-2xl mx-auto">

              {/* Attached image preview */}
              <AnimatePresence>
                {uploadedImage && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-2.5 overflow-hidden"
                  >
                    <div
                      className="flex items-center gap-2.5 px-3 py-2 rounded-2xl"
                      style={{
                        background: "hsl(var(--surface-1) / 0.5)",
                        border: "1px solid hsl(var(--border) / 0.1)",
                      }}
                    >
                      <div className="relative w-10 h-10 rounded-xl overflow-hidden ring-1 ring-primary/20 flex-shrink-0">
                        <img src={uploadedImage.url} alt="Attached" className="w-full h-full object-cover" />
                        <button
                          onClick={() => setUploadedImage(null)}
                          className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                        >
                          <XCircle className="h-3.5 w-3.5 text-white" />
                        </button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground/60 truncate">{uploadedImage.name}</p>
                        <p className="text-[10px] text-muted-foreground/30 mt-0.5">Image attached</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Input container */}
              <div className="group/input relative">
                {/* Ambient glow on focus */}
                <div
                  className="absolute -inset-px rounded-[22px] opacity-0 group-focus-within/input:opacity-100 transition-all duration-300 pointer-events-none"
                  style={{
                    background: "linear-gradient(135deg, hsl(var(--primary) / 0.2), hsl(var(--accent) / 0.1))",
                    filter: "blur(8px)",
                  }}
                />

                <div
                  className="relative rounded-[20px] transition-all duration-200"
                  style={{
                    background: "linear-gradient(145deg, hsl(var(--surface-1) / 0.85), hsl(var(--surface-1) / 0.65))",
                    border: "1px solid hsl(var(--border) / 0.12)",
                    backdropFilter: "blur(32px)",
                    boxShadow: "0 4px 32px hsl(0 0% 0% / 0.12), inset 0 1px 0 hsl(var(--foreground) / 0.04)",
                  }}
                >
                  {/* Focus ring */}
                  <div
                    className="absolute inset-0 rounded-[20px] opacity-0 group-focus-within/input:opacity-100 transition-opacity pointer-events-none"
                    style={{ boxShadow: "0 0 0 1.5px hsl(var(--primary) / 0.3), inset 0 0 20px hsl(var(--primary) / 0.02)" }}
                  />

                  {/* Single row — avatar + textarea + actions always visible */}
                  <div className="flex items-end gap-2 px-3 py-3">
                    {/* Mini Hoppy avatar */}
                    <div
                      className="flex-shrink-0 w-7 h-7 rounded-xl overflow-hidden opacity-35 group-focus-within/input:opacity-60 transition-opacity duration-300 mb-0.5"
                      style={{ boxShadow: "0 0 0 1px hsl(var(--primary) / 0.15)" }}
                    >
                      <video
                        src="/hoppy-blink.mp4"
                        autoPlay loop muted playsInline
                        className="w-full h-full object-cover scale-[1.25]"
                        style={{ objectPosition: "50% 20%" }}
                      />
                    </div>

                    {/* Textarea — grows with content */}
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onBlur={handleTextareaBlur}
                      placeholder={isLoading ? "Hoppy is thinking…" : "Ask Hoppy anything…"}
                      rows={1}
                      style={{ fieldSizing: "content" } as React.CSSProperties}
                      className={cn(
                        "flex-1 bg-transparent text-[14px] text-foreground",
                        "resize-none border-none outline-none focus:outline-none focus:ring-0",
                        "leading-relaxed max-h-32 min-h-[24px] font-sans transition-opacity duration-300 py-0.5",
                        isLoading
                          ? "opacity-40 placeholder:text-muted-foreground/20"
                          : "opacity-100 placeholder:text-muted-foreground/30"
                      )}
                    />

                    {/* Action buttons — always in the same row, always visible */}
                    <div className="flex items-center gap-1.5 flex-shrink-0 mb-0.5">
                      {/* Attach */}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isLoading || isUploading}
                        className={cn(
                          "flex items-center justify-center w-7 h-7 rounded-xl transition-all duration-150",
                          uploadedImage
                            ? "text-primary bg-primary/10 border border-primary/15"
                            : "text-muted-foreground/40 hover:text-muted-foreground/70 hover:bg-muted/10 border border-transparent"
                        )}
                      >
                        {isUploading
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Paperclip className="h-3.5 w-3.5" />
                        }
                      </button>

                      {/* Send — always rendered, dimmed when disabled */}
                      <motion.button
                        onClick={handleSend}
                        disabled={!canSend}
                        whileTap={canSend ? { scale: 0.88 } : {}}
                        className={cn(
                          "h-8 w-8 rounded-2xl flex items-center justify-center transition-all duration-200",
                          canSend
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/20 text-muted-foreground/25 cursor-not-allowed"
                        )}
                        style={canSend ? {
                          boxShadow: "0 2px 12px hsl(var(--primary) / 0.4), inset 0 1px 0 hsl(var(--primary-foreground) / 0.12)",
                        } : {}}
                      >
                        {isLoading
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Send className="h-3.5 w-3.5" />
                        }
                      </motion.button>
                    </div>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Menu helpers ────────────────────────────────────────────

function MenuGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <p className="text-[9px] font-bold text-muted-foreground/25 tracking-[0.15em] uppercase px-2.5 mb-1">
        {label}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function MenuItem({
  icon, label, accent, isStatic, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  accent?: boolean;
  isStatic?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={isStatic}
      className={cn(
        "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all text-[13px]",
        isStatic
          ? "cursor-default opacity-50 text-muted-foreground/40"
          : accent
            ? "text-primary/70 hover:text-primary hover:bg-primary/8"
            : "text-foreground/60 hover:text-foreground hover:bg-muted/10"
      )}
    >
      <span className={cn("flex-shrink-0", accent ? "text-primary/50" : "text-muted-foreground/35")}>
        {icon}
      </span>
      {label}
    </button>
  );
}

// ── Markdown renderer ────────────────────────────────────────

function HoppyMarkdown({ content }: { content: string }) {
  try {
    return (
      <div
        className={cn(
          "prose prose-sm max-w-none",
          "[&>p]:text-[14.5px] [&>p]:leading-[1.85] [&>p]:text-foreground/80 [&>p]:mb-3 [&>p:last-child]:mb-0",
          "[&>p:first-child]:text-[15px] [&>p:first-child]:text-foreground/90",
          "[&>ul]:space-y-1.5 [&>ol]:space-y-1.5 [&>ul]:pl-4 [&>ol]:pl-4 [&>ul]:mb-3 [&>ol]:mb-3",
          "[&_li]:text-[14px] [&_li]:leading-[1.8] [&_li]:text-foreground/75",
          "[&_li::marker]:text-primary/40",
          "[&_strong]:text-foreground [&_strong]:font-semibold",
          "[&_em]:text-primary/70 [&_em]:not-italic",
          "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-primary/30",
          "[&_code]:text-primary/80 [&_code]:bg-primary/8 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:text-[12px] [&_code]:font-mono",
          "[&_pre]:bg-muted/20 [&_pre]:rounded-xl [&_pre]:p-4 [&_pre]:overflow-auto [&_pre]:text-xs [&_pre]:mb-3",
          "[&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-foreground",
          "[&_h3]:text-[13px] [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3]:text-foreground/90",
          "[&>blockquote]:border-l-2 [&>blockquote]:border-primary/25 [&>blockquote]:pl-4 [&>blockquote]:py-0.5 [&>blockquote]:text-muted-foreground/60 [&>blockquote]:my-3",
          "[&>hr]:border-border/8 [&>hr]:my-4",
        )}
      >
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    );
  } catch {
    return <p className="text-[14.5px] leading-[1.85] text-foreground/80">{content}</p>;
  }
}

// ── Chat Message ─────────────────────────────────────────────

function ChatMessage({
  message, onAction, onNavigate, onSendMessage, isLatest,
}: {
  message: AgentMessage;
  onAction: (action: AgentAction) => void;
  onNavigate: (path: string) => void;
  onSendMessage: (content: string) => void;
  isLatest: boolean;
}) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <motion.div
        initial={isLatest ? { opacity: 0, y: 8 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex justify-end"
      >
        <div className="max-w-[78%] md:max-w-[70%]">
          <div
            className="relative px-5 py-3 rounded-3xl rounded-br-lg text-[14.5px] leading-[1.78] font-sans overflow-hidden"
            style={{
              background: "linear-gradient(135deg, hsl(var(--primary) / 0.95), hsl(var(--primary) / 0.75))",
              color: "hsl(var(--primary-foreground))",
              boxShadow: "0 4px 20px hsl(var(--primary) / 0.3), inset 0 1px 0 hsl(var(--primary-foreground) / 0.1)",
            }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: "linear-gradient(165deg, hsl(var(--primary-foreground) / 0.06) 0%, transparent 50%)" }}
            />
            <span className="relative">{message.content}</span>
          </div>
          <div className="flex justify-end mt-1 pr-1.5">
            <span className="text-[10px] text-muted-foreground/20 tabular-nums font-mono">
              {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>
      </motion.div>
    );
  }

  // Hoppy message
  return (
    <motion.div
      initial={isLatest ? { opacity: 0, y: 12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex gap-3 items-start"
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0 mt-0.5">
        <div
          className="h-8 w-8 rounded-2xl overflow-hidden"
          style={{ boxShadow: "0 0 0 1.5px hsl(var(--primary) / 0.18), 0 4px 12px hsl(var(--primary) / 0.12)" }}
        >
          <video
            src="/hoppy-blink.mp4"
            autoPlay loop muted playsInline
            className="w-full h-full object-cover scale-[1.4] object-top"
          />
        </div>
        {isLatest && (
          <motion.div
            className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-background"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Label row */}
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[11px] font-bold text-foreground/35 tracking-[0.12em] uppercase font-mono">
            Hoppy
          </span>
          {message.creditsCharged && message.creditsCharged > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-400/60 bg-amber-400/8 px-1.5 py-0.5 rounded-full">
              <Zap className="h-2 w-2" />{message.creditsCharged}cr
            </span>
          )}
          <span className="ml-auto text-[10px] text-muted-foreground/20 tabular-nums font-mono">
            {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        {/* Bubble */}
        <div
          className="relative rounded-3xl rounded-tl-lg overflow-hidden"
          style={{
            background: "linear-gradient(145deg, hsl(var(--surface-1) / 0.65), hsl(var(--surface-1) / 0.4))",
            border: "1px solid hsl(var(--border) / 0.1)",
            backdropFilter: "blur(24px)",
            boxShadow: "0 2px 20px hsl(0 0% 0% / 0.06), inset 0 1px 0 hsl(var(--foreground) / 0.03)",
          }}
        >
          {/* Shimmer line */}
          <div
            className="h-px w-full"
            style={{ background: "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.35), hsl(var(--accent) / 0.15), transparent)" }}
          />

          {/* Text */}
          <div className="px-5 py-4">
            {message.content ? (
              <HoppyMarkdown content={message.content} />
            ) : (
              <span className="text-muted-foreground/30 text-sm italic">Thinking…</span>
            )}
            {message.streaming && (
              <motion.span
                className="inline-block w-0.5 h-[1.1em] bg-primary/60 ml-0.5 rounded-full align-middle"
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.45, repeat: Infinity, repeatType: "reverse" }}
              />
            )}
          </div>

          {/* Rich blocks */}
          {!message.streaming && message.richBlocks && message.richBlocks.length > 0 && (
            <div className="px-4 pb-4">
              <RichBlocksRenderer
                blocks={message.richBlocks}
                onNavigate={onNavigate}
                onSendMessage={onSendMessage}
              />
            </div>
          )}

          {/* Action chips */}
          {!message.streaming && message.actions && message.actions.length > 0 && (
            <div className="px-4 pb-4 pt-0.5">
              <div
                className="h-px mb-3"
                style={{ background: "linear-gradient(90deg, hsl(var(--primary) / 0.08), transparent)" }}
              />
              <div className="flex flex-wrap gap-1.5">
                {message.actions.map((action, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: i * 0.06, duration: 0.2 }}
                    onClick={() => onAction(action)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold
                               text-primary/80 hover:text-primary
                               transition-all duration-150 active:scale-[0.96] hover:-translate-y-px"
                    style={{
                      background: "linear-gradient(135deg, hsl(var(--primary) / 0.08), hsl(var(--primary) / 0.04))",
                      border: "1px solid hsl(var(--primary) / 0.14)",
                      boxShadow: "0 1px 6px hsl(var(--primary) / 0.06)",
                    }}
                  >
                    <ArrowRight className="h-2.5 w-2.5" />
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
                    {action.action === "generation_started" && "🎬 Generating…"}
                    {action.action === "published" && "🌟 Published!"}
                    {action.action === "unpublished" && "🔒 Made Private"}
                    {action.action === "project_updated" && "✅ Updated"}
                  </motion.button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
