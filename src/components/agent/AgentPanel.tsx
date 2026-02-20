/**
 * Hoppy Agent Panel 🐰 — Modern Immersive Chat
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, RotateCcw, Zap, ArrowRight, Loader2, Sparkles, ChevronDown, MessageCircle, Paperclip, XCircle, Menu, Plus, Trash2, Keyboard, HelpCircle, Settings, ChevronLeft, MessageSquarePlus, Eraser, Star } from "lucide-react";
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
  const [uploadedImage, setUploadedImage] = useState<{ url: string; name: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const prevPathRef = useRef(location.pathname);
  useEffect(() => {
    if (prevPathRef.current !== location.pathname && isOpen) onClose();
    prevPathRef.current = location.pathname;
  }, [location.pathname, isOpen, onClose]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    // Re-focus input after each message so cursor never gets trapped in the chat container
    // This is critical on iOS where the cursor can lock into scroll containers
    if (isOpen && !isLoading) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [messages, isLoading, isOpen]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 400);
  }, [isOpen]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      setShowScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 120);
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [isOpen]);

  const handleImageUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) { toast?.error?.("Image must be less than 10MB"); return; }
    setIsUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("hoppy-uploads").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("hoppy-uploads").getPublicUrl(path);
      setUploadedImage({ url: urlData.publicUrl, name: file.name });
    } catch (err) {
      console.error("Image upload failed:", err);
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
    e.target.value = "";
  }, [handleImageUpload]);

  const handleSend = useCallback(async () => {
    if ((!input.trim() && !uploadedImage) || isLoading) return;
    let msg = input;
    if (uploadedImage) {
      msg = msg ? `${msg}\n\n[Image attached: ${uploadedImage.url}]` : `[Image attached: ${uploadedImage.url}]`;
    }
    setInput("");
    setUploadedImage(null);
    await sendMessage(msg);
  }, [input, uploadedImage, isLoading, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

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
      if (params.image_url) { sessionStorage.setItem("imageToVideoUrl", params.image_url); qp.set("mode", "image-to-video"); }
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
      if (params.image_url) { sessionStorage.setItem("imageToVideoUrl", params.image_url); qp.set("mode", "image-to-video"); }
      navigate(`/create?${qp.toString()}`);
    } else if (pendingAction.action === "confirm_generation") {
      await sendMessage(`Yes, go ahead and generate project ${(pendingAction as any).project_id}`);
    } else if (pendingAction.action === "confirm_delete") {
      await sendMessage(`Yes, delete project ${(pendingAction as any).project_id}`);
    }
    setPendingAction(null);
    if (pendingAction.action === "start_creation") onClose();
  };

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  const quickPrompts = [
    { text: "What can you do?", icon: "✦", sub: "Explore capabilities" },
    { text: "Show my projects", icon: "◈", sub: "View & track progress" },
    { text: "Create a video", icon: "▶", sub: "Start generating" },
    { text: "Check my credits", icon: "⚡", sub: "Balance & usage" },
  ];

  const stateLabel = agentState === "thinking" ? "Thinking..." : agentState === "speaking" ? "Responding" : agentState === "listening" ? "Listening..." : "Online";
  const stateDot = agentState === "thinking" ? "bg-amber-400" : agentState === "speaking" ? "bg-primary" : agentState === "listening" ? "bg-cyan-400" : "bg-emerald-400";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[100] flex"
          style={{ background: "hsl(var(--background))" }}
        >
          {/* Subtle ambient BG */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-1/4 -left-1/4 w-[800px] h-[800px] rounded-full opacity-[0.07] blur-[140px]"
              style={{ background: "hsl(var(--primary))" }} />
            <div className="absolute -bottom-1/4 -right-1/4 w-[600px] h-[600px] rounded-full opacity-[0.05] blur-[120px]"
              style={{ background: "hsl(var(--accent))" }} />
            {/* Subtle dot grid */}
            <div className="absolute inset-0 opacity-[0.018]"
              style={{
                backgroundImage: `radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)`,
                backgroundSize: "32px 32px",
              }} />
          </div>

          {/* ─── Settings Sidebar ─── */}
          <AnimatePresence>
            {sidebarOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  onClick={() => setSidebarOpen(false)}
                  className="absolute inset-0 z-[110] bg-background/50 backdrop-blur-sm"
                />
                <motion.aside
                  initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }}
                  transition={{ type: "spring", stiffness: 380, damping: 38 }}
                  className="absolute left-0 top-0 bottom-0 z-[120] w-72 flex flex-col"
                  style={{
                    background: "hsl(var(--surface-1) / 0.97)",
                    borderRight: "1px solid hsl(var(--border) / 0.1)",
                    backdropFilter: "blur(32px)",
                    boxShadow: "24px 0 64px hsl(0 0% 0% / 0.25)",
                  }}
                >
                  <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.5), transparent)" }} />

                  <div className="flex items-center justify-between px-5 pt-5 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl overflow-hidden ring-1 ring-primary/20">
                        <video src="/hoppy-blink.mp4" autoPlay loop muted playsInline className="w-full h-full object-cover scale-[1.4] object-top" />
                      </div>
                      <div>
                        <p className="font-display text-sm font-bold text-foreground">Hoppy</p>
                        <p className="text-[10px] text-muted-foreground/40 tracking-widest uppercase font-medium mt-0.5">Settings</p>
                      </div>
                    </div>
                    <button onClick={() => setSidebarOpen(false)}
                      className="p-2 rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-muted/10 transition-all">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mx-5 h-px bg-border/8 mb-2" />

                  <div className="flex-1 overflow-y-auto px-3 py-1 space-y-0.5">
                    <SidebarSection label="Conversation">
                      <SidebarButton icon={<MessageSquarePlus className="h-3.5 w-3.5" />} label="New Chat" description="Start fresh" accent
                        onClick={() => { clearMessages(); setSidebarOpen(false); setTimeout(() => inputRef.current?.focus(), 200); }} />
                      <SidebarButton icon={<Eraser className="h-3.5 w-3.5" />} label="Clear Messages" description="Wipe current thread"
                        onClick={() => { clearMessages(); setSidebarOpen(false); }} />
                    </SidebarSection>
                    <SidebarSection label="Quick Actions">
                      <SidebarButton icon={<Star className="h-3.5 w-3.5" />} label="Capabilities" description="Explore Hoppy's tools"
                        onClick={() => { sendMessage("What can you do?"); setSidebarOpen(false); }} />
                      <SidebarButton icon={<Zap className="h-3.5 w-3.5" />} label="My Credits" description="Check balance"
                        onClick={() => { sendMessage("Check my credits"); setSidebarOpen(false); }} />
                      <SidebarButton icon={<Sparkles className="h-3.5 w-3.5" />} label="Create Video" description="Start a new project"
                        onClick={() => { sendMessage("Create a video"); setSidebarOpen(false); }} />
                      <SidebarButton icon={<MessageCircle className="h-3.5 w-3.5" />} label="My Projects" description="View all projects"
                        onClick={() => { sendMessage("Show my projects"); setSidebarOpen(false); }} />
                    </SidebarSection>
                    <SidebarSection label="Help">
                      <SidebarButton icon={<Keyboard className="h-3.5 w-3.5" />} label="Shortcuts" description="Enter to send · Shift+Enter for newline" static />
                      <SidebarButton icon={<HelpCircle className="h-3.5 w-3.5" />} label="About Hoppy" description="Your AI Creative Director"
                        onClick={() => { sendMessage("Tell me about yourself"); setSidebarOpen(false); }} />
                    </SidebarSection>
                  </div>

                  <div className="px-5 pb-5 pt-3">
                    <div className="h-px bg-border/8 mb-3" />
                    <div className="flex items-center gap-2">
                      <span className={cn("h-1.5 w-1.5 rounded-full", stateDot)} style={{ boxShadow: "0 0 6px currentColor" }} />
                      <span className="text-[11px] text-muted-foreground/40 font-display">Hoppy is online</span>
                      <span className="ml-auto text-[10px] text-muted-foreground/20 font-mono">v2.0</span>
                    </div>
                  </div>
                </motion.aside>
              </>
            )}
          </AnimatePresence>

          {/* ─── Main Chat ─── */}
          <div className="flex flex-col flex-1 min-w-0 relative z-10">

            {/* ─── Top Bar ─── */}
            <motion.header
              initial={{ y: -16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.08, duration: 0.35 }}
              className="flex items-center gap-3 px-4 md:px-8 py-3.5 border-b"
              style={{ borderColor: "hsl(var(--border) / 0.08)" }}
            >
              {/* Menu */}
              <button
                onClick={() => setSidebarOpen(v => !v)}
                className={cn(
                  "p-2 rounded-lg transition-all duration-200",
                  sidebarOpen ? "bg-primary/10 text-primary" : "text-muted-foreground/50 hover:text-foreground hover:bg-muted/10"
                )}
              >
                <Menu className="h-4 w-4" />
              </button>

              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className={cn(
                  "h-9 w-9 rounded-xl overflow-hidden ring-2 ring-offset-1 ring-offset-background transition-all duration-500",
                  agentState === "thinking" && "ring-amber-400/50",
                  agentState === "speaking" && "ring-primary/60",
                  agentState === "listening" && "ring-cyan-400/50",
                  agentState === "idle" && "ring-emerald-400/40",
                )}>
                  <video src="/hoppy-blink.mp4" autoPlay loop muted playsInline className="w-full h-full object-cover scale-[1.4] object-top" />
                </div>
                <div className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background transition-colors", stateDot)} />
              </div>

              {/* Title */}
              <div className="flex flex-col min-w-0">
                <span className="font-display text-sm font-bold text-foreground leading-none">Hoppy</span>
                <span className="text-[10px] text-muted-foreground/50 mt-0.5 tracking-wide">{stateLabel}</span>
              </div>

              <div className="flex-1" />

              {/* Actions */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={clearMessages}
                  title="New conversation"
                  className="p-2 rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-muted/10 transition-all"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={onClose}
                  title="Close"
                  className="p-2 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/8 transition-all"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.header>

            {/* ─── Messages ─── */}
            <div
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto px-4 md:px-8 pt-6 pb-4 scroll-smooth"
              style={{ scrollbarWidth: "none" }}
              onClick={() => inputRef.current?.focus()}
            >
              <div className="max-w-2xl mx-auto space-y-5">

                {loadingHistory && (
                  <div className="flex flex-col items-center justify-center py-24 gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary/40" />
                    <span className="text-sm text-muted-foreground/40 font-display">Resuming conversation...</span>
                  </div>
                )}

                {!loadingHistory && messages.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.18, duration: 0.45 }}
                    className="flex flex-col items-center justify-center min-h-[62vh] text-center"
                  >
                    <AgentFace state={agentState} size={88} />

                    <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mt-7 tracking-tight">
                      Hey! I'm Hoppy 🐰
                    </h2>
                    <p className="text-sm md:text-base text-muted-foreground/55 max-w-sm mt-3 leading-relaxed">
                      Your AI studio assistant. Ask about projects, credits, or video creation.
                    </p>

                    <div className="grid grid-cols-2 gap-2.5 w-full max-w-md mt-9">
                      {quickPrompts.map((prompt, idx) => (
                        <motion.button
                          key={prompt.text}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 + idx * 0.07 }}
                          onClick={() => sendMessage(prompt.text)}
                          className={cn(
                            "group flex flex-col items-start gap-1.5 px-4 py-3.5 rounded-xl text-left",
                            "transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]",
                            "border border-border/8 hover:border-primary/20",
                            "bg-surface-1/40 hover:bg-surface-1/70 backdrop-blur-sm"
                          )}
                        >
                          <span className="text-base text-primary/50 group-hover:text-primary transition-colors">
                            {prompt.icon}
                          </span>
                          <span className="font-display text-[13px] font-semibold text-foreground/80 leading-tight group-hover:text-foreground transition-colors">
                            {prompt.text}
                          </span>
                          <span className="text-[10px] text-muted-foreground/35 leading-none">{prompt.sub}</span>
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}

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

                {/* Typing indicator — only show when loading AND no streaming message yet */}
                {isLoading && !messages.some((m) => m.streaming && m.content.length > 0) && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 items-start">
                    <div className="h-7 w-7 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-primary/10 mt-0.5">
                      <video src="/hoppy-blink.mp4" autoPlay loop muted playsInline className="w-full h-full object-cover scale-[1.4] object-top" />
                    </div>
                    <div className="px-4 py-3 rounded-2xl rounded-tl-sm border border-border/8 bg-surface-1/50 backdrop-blur-xl flex items-center gap-1.5">
                      {[0, 1, 2].map((i) => (
                        <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-primary/40"
                          animate={{ y: [0, -4, 0], opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 0.65, repeat: Infinity, delay: i * 0.11, ease: "easeInOut" }} />
                      ))}
                    </div>
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Scroll down pill */}
            <AnimatePresence>
              {showScrollDown && (
                <motion.button
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                  onClick={scrollToBottom}
                  className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[101]
                             flex items-center gap-1.5 px-3.5 py-1.5 rounded-full
                             bg-surface-1/95 border border-border/12 backdrop-blur-md
                             text-xs text-muted-foreground hover:text-foreground
                             shadow-lg transition-colors font-display"
                >
                  <ChevronDown className="h-3 w-3" /> New messages
                </motion.button>
              )}
            </AnimatePresence>

            {/* Confirm overlay */}
            <AnimatePresence>
              {pendingAction && (
                <motion.div
                  initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }}
                  className="fixed bottom-28 left-1/2 -translate-x-1/2 w-[90%] max-w-sm p-5 rounded-2xl z-[102]
                             bg-surface-1/97 border border-border/12 backdrop-blur-xl
                             shadow-[0_16px_64px_hsl(0_0%_0%/0.4)]"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="h-4 w-4 text-amber-400" />
                    <span className="font-display text-sm font-semibold text-foreground">
                      {pendingAction.action === "confirm_delete" ? "Confirm deletion" : "Confirm action"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground/70 mb-4 leading-relaxed">
                    {pendingAction.reason || "This action requires your confirmation."}
                    {pendingAction.estimated_credits && (
                      <span className="block mt-1.5 text-amber-400/80 font-display font-semibold text-xs">
                        Cost: {pendingAction.estimated_credits} credits
                      </span>
                    )}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setPendingAction(null)} className="flex-1">Cancel</Button>
                    <Button size="sm" onClick={confirmAction} className="flex-1">Confirm</Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ─── Input Bar ─── */}
            <motion.div
              initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.12, duration: 0.35 }}
              className="px-4 md:px-8 pb-5 pt-2 relative z-10"
            >
              <div className="max-w-2xl mx-auto">
                {/* Attached image preview */}
                <AnimatePresence>
                  {uploadedImage && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                      className="mb-2 overflow-hidden"
                    >
                      <div className="flex items-center gap-2 px-1 py-1">
                        <div className="relative w-12 h-12 rounded-lg overflow-hidden ring-1 ring-primary/20 flex-shrink-0">
                          <img src={uploadedImage.url} alt="Attached" className="w-full h-full object-cover" />
                          <button onClick={() => setUploadedImage(null)}
                            className="absolute top-0.5 right-0.5 bg-background/80 rounded-full p-0.5 hover:bg-destructive/80 transition-colors">
                            <XCircle className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="text-xs text-muted-foreground/50 truncate">{uploadedImage.name}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Input field */}
                <div
                  className="relative flex items-end gap-2 rounded-2xl px-4 py-3 transition-all duration-200 group/input"
                  style={{
                    background: "hsl(var(--surface-1) / 0.6)",
                    border: "1px solid hsl(var(--border) / 0.12)",
                    backdropFilter: "blur(20px)",
                    boxShadow: "0 2px 24px hsl(0 0% 0% / 0.08)",
                  }}
                >
                  {/* Focus glow ring */}
                  <div className="absolute inset-0 rounded-2xl opacity-0 group-focus-within/input:opacity-100 transition-opacity pointer-events-none"
                    style={{ boxShadow: "0 0 0 1px hsl(var(--primary) / 0.2), 0 0 20px hsl(var(--primary) / 0.06)" }} />

                  {/* Hoppy avatar hint */}
                  <div className="flex-shrink-0 w-6 h-6 rounded-full overflow-hidden ring-1 ring-primary/10 mb-0.5 opacity-50 group-focus-within/input:opacity-80 transition-opacity">
                    <video src="/hoppy-blink.mp4" autoPlay loop muted playsInline className="w-full h-full object-cover scale-[1.15]" style={{ objectPosition: "50% 25%" }} />
                  </div>

                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask Hoppy anything..."
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/25
                               resize-none border-none outline-none focus:outline-none focus:ring-0
                               font-sans leading-[1.6] max-h-32 min-h-[22px]"
                    rows={1}
                    disabled={isLoading}
                    style={{ fieldSizing: "content" } as any}
                  />

                  <div className="flex items-center gap-1 flex-shrink-0 mb-0.5">
                    {/* Attach image */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isLoading || isUploading}
                      className={cn(
                        "p-1.5 rounded-lg transition-all duration-150",
                        uploadedImage ? "text-primary bg-primary/10" : "text-muted-foreground/30 hover:text-muted-foreground/70 hover:bg-muted/10"
                      )}
                    >
                      {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                    </button>

                    {/* Send */}
                    <button
                      onClick={handleSend}
                      disabled={isLoading || (!input.trim() && !uploadedImage)}
                      className={cn(
                        "p-2 rounded-xl transition-all duration-200",
                        (input.trim() || uploadedImage) && !isLoading
                          ? "bg-primary text-primary-foreground shadow-[0_2px_12px_hsl(var(--primary)/0.35)] hover:-translate-y-px active:scale-95"
                          : "bg-muted/20 text-muted-foreground/20 cursor-not-allowed"
                      )}
                    >
                      {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    </button>
                  </div>

                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp,image/gif" onChange={handleFileSelect} className="hidden" />
                </div>

                <p className="text-center text-[10px] text-muted-foreground/20 mt-2 font-display tracking-wide">
                  Enter to send · Shift+Enter for new line
                </p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Sidebar helpers ──

function SidebarSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2">
      <p className="text-[9px] font-display font-bold text-muted-foreground/25 tracking-[0.15em] uppercase px-2 mb-1.5">{label}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function SidebarButton({ icon, label, description, accent, static: isStatic, onClick }: {
  icon: React.ReactNode; label: string; description?: string; accent?: boolean; static?: boolean; onClick?: () => void;
}) {
  return (
    <button onClick={onClick} disabled={isStatic}
      className={cn(
        "w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 group",
        isStatic ? "cursor-default opacity-60"
          : accent ? "hover:bg-primary/8 border border-transparent active:scale-[0.98]"
          : "hover:bg-muted/10 border border-transparent active:scale-[0.98]"
      )}>
      <span className={cn("mt-0.5 flex-shrink-0 transition-colors",
        accent ? "text-primary/60 group-hover:text-primary" : "text-muted-foreground/35 group-hover:text-muted-foreground/70"
      )}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className={cn("text-[13px] font-display font-medium leading-none mb-0.5 transition-colors",
          accent ? "text-primary/70 group-hover:text-primary" : "text-foreground/60 group-hover:text-foreground/90"
        )}>
          {label}
        </p>
        {description && (
          <p className="text-[11px] text-muted-foreground/30 leading-snug group-hover:text-muted-foreground/45 transition-colors">{description}</p>
        )}
      </div>
    </button>
  );
}

// ── Markdown renderer ──

function HoppyMarkdown({ content }: { content: string }) {
  try {
    return (
      <div className="space-y-3.5
                     [&>p]:text-[15px] [&>p]:leading-[1.85] [&>p]:text-foreground/80
                     [&>p:first-child]:text-[16px] [&>p:first-child]:text-foreground/90
                     [&>ul]:space-y-1.5 [&>ol]:space-y-1.5
                     [&_li]:text-[14.5px] [&_li]:leading-[1.8] [&_li]:text-foreground/75
                     [&_strong]:text-foreground [&_strong]:font-semibold
                     [&_em]:text-primary/70 [&_em]:not-italic
                     [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-primary/30
                     [&_code]:text-primary/80 [&_code]:bg-primary/8 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:text-[12.5px] [&_code]:font-mono
                     [&_h2]:text-lg [&_h2]:font-display [&_h2]:font-bold [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-foreground
                     [&_h3]:text-base [&_h3]:font-display [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3]:text-foreground/90
                     [&>blockquote]:border-l-2 [&>blockquote]:border-primary/25 [&>blockquote]:pl-4 [&>blockquote]:py-1 [&>blockquote]:text-muted-foreground/70 [&>blockquote]:rounded-r-xl [&>blockquote]:my-4
                     [&>hr]:border-border/8 [&>hr]:my-4">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    );
  } catch {
    return <p className="text-[15px] leading-[1.85] text-foreground/80">{content}</p>;
  }
}

// ── Message Bubble ──

function ImmersiveMessageBubble({
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
        initial={isLatest ? { opacity: 0, y: 6 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="flex justify-end"
      >
        <div className="max-w-[78%]">
          <div
            className="px-4 py-2.5 rounded-2xl rounded-br-sm text-sm leading-[1.7] font-sans"
            style={{
              background: "hsl(var(--primary))",
              color: "hsl(var(--primary-foreground))",
            }}
          >
            {message.content}
          </div>
          <div className="flex justify-end mt-1 pr-0.5">
            <span className="text-[10px] text-muted-foreground/20 tabular-nums font-display">
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
      initial={isLatest ? { opacity: 0, y: 10 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex gap-3 items-start"
    >
      {/* Avatar */}
      <div className="h-7 w-7 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-primary/12 mt-0.5 shadow-sm">
        <video src="/hoppy-blink.mp4" autoPlay loop muted playsInline
          className="w-full h-full object-cover scale-[1.4] object-top" />
      </div>

      {/* Bubble */}
      <div className="flex-1 min-w-0">
        {/* Name + time */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[11px] font-display font-semibold text-foreground/50 tracking-wide uppercase">Hoppy</span>
          {message.creditsCharged && message.creditsCharged > 0 && (
            <span className="text-[10px] text-amber-400/50 flex items-center gap-0.5">
              <Zap className="h-2.5 w-2.5" />{message.creditsCharged}cr
            </span>
          )}
          <span className="text-[10px] text-muted-foreground/20 tabular-nums font-display ml-auto">
            {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        {/* Content card — tabIndex={-1} prevents iOS from trapping cursor here */}
        <div
          className="rounded-2xl rounded-tl-sm overflow-hidden"
          tabIndex={-1}
          style={{
            background: "hsl(var(--surface-1) / 0.5)",
            border: "1px solid hsl(var(--border) / 0.09)",
            backdropFilter: "blur(16px)",
            WebkitUserSelect: "none",
          }}
        >
          {/* Accent top bar */}
          <div className="h-[1.5px] w-full" style={{ background: "linear-gradient(90deg, hsl(var(--primary) / 0.35), hsl(var(--accent) / 0.15), transparent)" }} />

          {/* Text — with blinking cursor while streaming */}
          <div className="px-5 py-4">
            {message.content ? (
              <HoppyMarkdown content={message.content} />
            ) : (
              <span className="text-muted-foreground/30 text-sm italic">Thinking…</span>
            )}
            {message.streaming && (
              <motion.span
                className="inline-block w-[2px] h-[1.1em] bg-primary/60 ml-0.5 rounded-full align-middle"
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.55, repeat: Infinity, repeatType: "reverse" }}
              />
            )}
          </div>

          {/* Rich blocks — only show when streaming is complete */}
          {!message.streaming && message.richBlocks && message.richBlocks.length > 0 && (
            <div className="px-4 pb-4">
              <RichBlocksRenderer blocks={message.richBlocks} onNavigate={onNavigate} onSendMessage={onSendMessage} />
            </div>
          )}

          {/* Action chips — only show when streaming is complete */}
          {!message.streaming && message.actions && message.actions.length > 0 && (
            <div className="px-5 pb-4 pt-1">
              <div className="h-px mb-3" style={{ background: "hsl(var(--border) / 0.07)" }} />
              <div className="flex flex-wrap gap-1.5">
                {message.actions.map((action, i) => (
                  <button key={i} onClick={() => onAction(action)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12px] font-display font-semibold
                               bg-primary/6 text-primary/70 border border-primary/10
                               hover:bg-primary/12 hover:text-primary hover:border-primary/20
                               transition-all duration-150 active:scale-[0.97]">
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
      </div>
    </motion.div>
  );
}
