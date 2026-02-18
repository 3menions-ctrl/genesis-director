/**
 * Hoppy Agent Panel 🐰 — Clean Minimal Design
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, RotateCcw, Zap, ArrowRight, Loader2, Sparkles, ChevronDown, Paperclip, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
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
  }, [messages]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
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
    { text: "What can you do?", icon: "✦" },
    { text: "Show my projects", icon: "◈" },
    { text: "Create a video", icon: "▶" },
    { text: "Check my credits", icon: "⚡" },
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
          {/* Subtle ambient */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div
              className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full opacity-[0.06] blur-[140px]"
              style={{ background: "hsl(var(--primary))" }}
            />
          </div>

          {/* ─── Header ─── */}
          <div className="relative z-10 flex items-center justify-between px-5 py-4 border-b border-border/8">
            <div className="flex items-center gap-3">
              {/* Hoppy avatar */}
              <div className={cn(
                "h-9 w-9 rounded-full overflow-hidden ring-1 transition-all duration-500",
                agentState === "thinking" && "ring-amber-400/40",
                agentState === "speaking" && "ring-primary/50",
                agentState === "idle" && "ring-border/20",
              )}>
                <video src="/hoppy-blink.mp4" autoPlay loop muted playsInline className="w-full h-full object-cover scale-[1.4] object-top" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground leading-none">Hoppy</p>
                <p className="text-[11px] text-muted-foreground/40 mt-0.5">
                  {agentState === "thinking" ? "Thinking…" : agentState === "speaking" ? "Responding" : "AI Creative Director"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={clearMessages}
                className="p-2 rounded-lg text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/10 transition-all"
                title="New conversation"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-muted/10 transition-all"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* ─── Messages ─── */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto scrollbar-hide relative z-10"
          >
            <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
              {loadingHistory && (
                <div className="flex items-center justify-center py-20 gap-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/30" />
                  <span className="text-sm text-muted-foreground/40">Loading…</span>
                </div>
              )}

              {!loadingHistory && messages.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, duration: 0.4 }}
                  className="flex flex-col items-center justify-center min-h-[55vh] text-center"
                >
                  {/* Hoppy face */}
                  <div className="h-20 w-20 rounded-full overflow-hidden ring-1 ring-border/15 shadow-lg mb-6">
                    <video src="/hoppy-blink.mp4" autoPlay loop muted playsInline className="w-full h-full object-cover scale-[1.4] object-top" />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground tracking-tight">Hey, I'm Hoppy 🐰</h2>
                  <p className="text-sm text-muted-foreground/60 max-w-xs mt-2 leading-relaxed">
                    Your AI studio assistant. Ask me anything.
                  </p>

                  <div className="grid grid-cols-2 gap-2 w-full max-w-sm mt-8">
                    {quickPrompts.map((prompt) => (
                      <button
                        key={prompt.text}
                        onClick={() => sendMessage(prompt.text)}
                        className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-left
                                   bg-muted/5 border border-border/10
                                   hover:bg-muted/10 hover:border-border/20
                                   transition-all duration-150 active:scale-[0.98]"
                      >
                        <span className="text-base text-primary/50">{prompt.icon}</span>
                        <span className="text-sm text-foreground/70 font-medium">{prompt.text}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {messages.map((msg, i) => (
                <MessageRow
                  key={msg.id}
                  message={msg}
                  onAction={handleAction}
                  onNavigate={(path) => { navigate(path); onClose(); }}
                  onSendMessage={sendMessage}
                  isLatest={i === messages.length - 1}
                />
              ))}

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-start gap-3"
                >
                  <div className="h-7 w-7 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-border/15 mt-0.5">
                    <video src="/hoppy-blink.mp4" autoPlay loop muted playsInline className="w-full h-full object-cover scale-[1.4] object-top" />
                  </div>
                  <div className="flex items-center gap-1.5 px-4 py-3 rounded-2xl bg-muted/8 border border-border/8 mt-0.5">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="h-[5px] w-[5px] rounded-full bg-muted-foreground/30"
                        animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Scroll down button */}
          <AnimatePresence>
            {showScrollDown && (
              <motion.button
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                onClick={scrollToBottom}
                className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[101]
                           flex items-center gap-1.5 px-3.5 py-1.5 rounded-full
                           bg-background border border-border/15 shadow-md
                           text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                Scroll down
              </motion.button>
            )}
          </AnimatePresence>

          {/* Confirm popup */}
          <AnimatePresence>
            {pendingAction && (
              <motion.div
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 16, opacity: 0 }}
                className="fixed bottom-28 left-1/2 -translate-x-1/2 w-[90%] max-w-sm p-4 rounded-2xl z-[102]
                           bg-background border border-border/15 shadow-xl backdrop-blur-xl"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 text-amber-400" />
                  <span className="text-sm font-semibold text-foreground">
                    {pendingAction.action === "confirm_delete" ? "Confirm deletion" : "Confirm action"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground/70 mb-4 leading-relaxed">
                  {pendingAction.reason || "This action requires your confirmation."}
                  {pendingAction.estimated_credits && (
                    <span className="block mt-1.5 text-amber-400/80 font-medium text-xs">
                      Cost: {pendingAction.estimated_credits} credits
                    </span>
                  )}
                </p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setPendingAction(null)} className="flex-1 h-9">Cancel</Button>
                  <Button size="sm" onClick={confirmAction} className="flex-1 h-9">Confirm</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── Input ─── */}
          <div className="relative z-10 px-4 pb-5 pt-3 border-t border-border/8">
            <div className="max-w-2xl mx-auto">
              {/* Image preview */}
              <AnimatePresence>
                {uploadedImage && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-2 overflow-hidden"
                  >
                    <div className="flex items-center gap-2 px-1 py-1">
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden ring-1 ring-border/20 flex-shrink-0">
                        <img src={uploadedImage.url} alt="Attached" className="w-full h-full object-cover" />
                        <button
                          onClick={() => setUploadedImage(null)}
                          className="absolute top-0.5 right-0.5 bg-background/80 rounded-full p-0.5"
                        >
                          <XCircle className="h-3 w-3 text-foreground/60" />
                        </button>
                      </div>
                      <span className="text-xs text-muted-foreground/50 truncate">{uploadedImage.name}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-end gap-2 px-4 py-3 rounded-2xl border border-border/12 bg-muted/5 backdrop-blur-sm transition-colors focus-within:border-border/25">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Hoppy anything…"
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/35
                             resize-none border-none outline-none focus:ring-0 leading-relaxed max-h-28 min-h-[22px]"
                  rows={1}
                  disabled={isLoading}
                  style={{ fieldSizing: "content" } as any}
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading || isUploading}
                  className={cn(
                    "p-1.5 rounded-lg transition-colors flex-shrink-0 mb-0.5",
                    uploadedImage ? "text-primary" : "text-muted-foreground/30 hover:text-muted-foreground/60"
                  )}
                >
                  {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                </button>

                <button
                  onClick={handleSend}
                  disabled={isLoading || (!input.trim() && !uploadedImage)}
                  className={cn(
                    "p-1.5 rounded-lg transition-all flex-shrink-0 mb-0.5",
                    (input.trim() || uploadedImage)
                      ? "bg-primary text-primary-foreground hover:opacity-90 active:scale-95"
                      : "bg-muted/20 text-muted-foreground/20 cursor-not-allowed"
                  )}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ══════════════════════════════════════════════════════
// Markdown renderer
// ══════════════════════════════════════════════════════

function HoppyMarkdown({ content }: { content: string }) {
  try {
    return (
      <div className="
        [&>p]:text-sm [&>p]:leading-[1.75] [&>p]:text-foreground/80
        [&>p+p]:mt-3
        [&>ul]:space-y-1.5 [&>ol]:space-y-1.5 [&>ul]:mt-3 [&>ol]:mt-3
        [&>ul]:pl-1 [&>ol]:pl-1
        [&_li]:text-sm [&_li]:leading-[1.7] [&_li]:text-foreground/75
        [&_strong]:text-foreground [&_strong]:font-semibold
        [&_em]:text-muted-foreground/70
        [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-primary/30
        [&_code]:text-primary/80 [&_code]:bg-primary/8 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono
        [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-foreground
        [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3]:text-foreground/90
        [&>blockquote]:border-l-2 [&>blockquote]:border-border/30 [&>blockquote]:pl-4 [&>blockquote]:italic [&>blockquote]:text-muted-foreground/60 [&>blockquote]:my-3
        [&>hr]:border-border/10 [&>hr]:my-4
      ">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    );
  } catch {
    return <p className="text-sm leading-[1.75] text-foreground/80">{content}</p>;
  }
}

// ══════════════════════════════════════════════════════
// Message Row
// ══════════════════════════════════════════════════════

function MessageRow({
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

  if (isUser) {
    return (
      <motion.div
        initial={isLatest ? { opacity: 0, y: 6 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex justify-end"
      >
        <div className="max-w-[78%]">
          <div className="px-4 py-2.5 rounded-2xl rounded-br-md text-sm leading-relaxed bg-primary text-primary-foreground">
            {message.content}
          </div>
          <div className="flex justify-end mt-1 pr-1">
            <span className="text-[10px] text-muted-foreground/25">
              {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={isLatest ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex items-start gap-3"
    >
      {/* Avatar */}
      <div className="h-7 w-7 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-border/15 mt-0.5">
        <video src="/hoppy-blink.mp4" autoPlay loop muted playsInline className="w-full h-full object-cover scale-[1.4] object-top" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-semibold text-foreground/60">Hoppy</span>
          {message.creditsCharged && message.creditsCharged > 0 && (
            <span className="text-[10px] text-amber-400/60 flex items-center gap-0.5">
              <Zap className="h-2.5 w-2.5" />{message.creditsCharged}cr
            </span>
          )}
          <span className="text-[10px] text-muted-foreground/25 ml-auto">
            {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        {/* Text */}
        <HoppyMarkdown content={message.content} />

        {/* Rich blocks */}
        {message.richBlocks && message.richBlocks.length > 0 && (
          <div className="mt-3">
            <RichBlocksRenderer blocks={message.richBlocks} onNavigate={onNavigate} onSendMessage={onSendMessage} />
          </div>
        )}

        {/* Action chips */}
        {message.actions && message.actions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {message.actions.map((action, i) => (
              <button
                key={i}
                onClick={() => onAction(action)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                           bg-muted/8 text-foreground/60 border border-border/10
                           hover:bg-muted/15 hover:text-foreground hover:border-border/20
                           transition-all duration-150 active:scale-[0.97]"
              >
                <ArrowRight className="h-3 w-3 opacity-50" />
                {action.action === "navigate" && action.path}
                {action.action === "open_buy_credits" && "Buy Credits"}
                {action.action === "start_creation" && `Create · ${action.estimated_credits}cr`}
                {action.action === "generate_script" && "Preview script"}
                {action.action === "project_created" && "View Projects"}
                {action.action === "project_renamed" && "✅ Renamed"}
                {action.action === "confirm_generation" && `Generate · ${action.estimated_credits}cr`}
                {action.action === "confirm_delete" && "Confirm Delete"}
                {action.action === "insufficient_credits" && "Get Credits"}
                {action.action === "followed_user" && "✅ Followed"}
                {action.action === "unfollowed_user" && "✅ Unfollowed"}
                {action.action === "liked_project" && "❤️ Liked"}
                {action.action === "unliked_project" && "Unliked"}
                {action.action === "dm_sent" && "✅ Sent"}
                {action.action === "profile_updated" && "✅ Updated"}
                {action.action === "clip_updated" && "Clip Updated"}
                {action.action === "clip_retried" && "🔄 Retrying"}
                {action.action === "clips_reordered" && "Reordered"}
                {action.action === "generation_started" && "Generating…"}
                {action.action === "published" && "🌟 Published"}
                {action.action === "unpublished" && "Made Private"}
                {action.action === "project_updated" && "✅ Updated"}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
