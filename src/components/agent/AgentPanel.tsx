/**
 * Hoppy Chat — Clean Rebuild
 * Messenger-style bottom sheet. No glassmorphism hacks.
 * Send button always works. Focus is simple.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Paperclip, Loader2, RefreshCw, XCircle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentFace } from "./AgentFace";
import { useAgentChat, AgentMessage } from "@/hooks/useAgentChat";
import { RichBlocksRenderer } from "./HoppyRichBlocks";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

interface AgentPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// ─── Message bubble ───────────────────────────────────────────────
function MessageBubble({ msg }: { msg: AgentMessage }) {
  const isUser = msg.role === "user";

  return (
    <div className={cn("flex gap-2 mb-4", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full overflow-hidden border border-primary/30 mt-1">
          <video src="/hoppy-blink.mp4" autoPlay loop muted playsInline className="w-full h-full object-cover scale-[1.2]" style={{ objectPosition: "50% 20%" }} />
        </div>
      )}

      <div className={cn("max-w-[78%] flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
        {!isUser && (
          <span className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/40 px-1">Hoppy</span>
        )}

        {msg.content && (
          <div
            className={cn(
              "px-4 py-3 rounded-2xl text-sm leading-relaxed",
              isUser
                ? "bg-primary text-primary-foreground rounded-br-sm"
                : "bg-muted/30 text-foreground rounded-bl-sm border border-border/20"
            )}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{msg.content}</p>
            ) : (
              <div className="prose prose-sm max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0 [&>p]:text-sm [&>p]:leading-relaxed [&_code]:bg-black/30 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            )}
            {msg.streaming && (
              <span className="inline-block w-0.5 h-3.5 bg-current ml-0.5 animate-pulse align-middle" />
            )}
          </div>
        )}

        {!msg.streaming && msg.richBlocks && msg.richBlocks.length > 0 && (
          <div className="w-full mt-1">
            <RichBlocksRenderer blocks={msg.richBlocks} />
          </div>
        )}
      </div>

      {isUser && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center mt-1">
          <span className="text-[10px] font-bold text-primary">You</span>
        </div>
      )}
    </div>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex gap-2 mb-4 items-end">
      <div className="flex-shrink-0 w-7 h-7 rounded-full overflow-hidden border border-primary/30">
        <video src="/hoppy-blink.mp4" autoPlay loop muted playsInline className="w-full h-full object-cover scale-[1.2]" style={{ objectPosition: "50% 20%" }} />
      </div>
      <div className="bg-muted/30 border border-border/20 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────
export function AgentPanel({ isOpen, onClose }: AgentPanelProps) {
  const { messages, isLoading, agentState, clearMessages, sendMessage, loadingHistory } = useAgentChat();

  const [input, setInput] = useState("");
  const [uploadedImage, setUploadedImage] = useState<{ url: string; name: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevLoadingRef = useRef(isLoading);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Refocus after Hoppy finishes — no blur hacks needed
  useEffect(() => {
    const wasLoading = prevLoadingRef.current;
    prevLoadingRef.current = isLoading;
    if (wasLoading && !isLoading && isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isLoading, isOpen]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Lock body scroll
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  const canSend = !!(input.trim() || uploadedImage) && !isLoading;

  const handleSend = useCallback(async () => {
    if (!canSend) return;
    let msg = input.trim();
    if (uploadedImage) msg = msg ? `${msg}\n\n[Image: ${uploadedImage.url}]` : `[Image: ${uploadedImage.url}]`;
    setInput("");
    setUploadedImage(null);
    await sendMessage(msg);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [input, uploadedImage, canSend, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    setIsUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `agent-uploads/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("project-assets").upload(path, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("project-assets").getPublicUrl(path);
      setUploadedImage({ url: publicUrl, name: file.name });
    } catch {
      toast.error("Upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const showTyping = isLoading && !messages.some((m) => m.streaming && m.content.length > 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel — full-height right drawer on desktop, full-screen on mobile */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className={cn(
              "fixed right-0 top-0 bottom-0 z-50 flex flex-col",
              "w-full sm:w-[400px] md:w-[440px]",
              "bg-background border-l border-border"
            )}
          >
            {/* ── Header ── */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border flex-shrink-0">
              <AgentFace state={agentState} size={36} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground text-sm">Hoppy</p>
                <p className="text-xs text-muted-foreground">
                  {isLoading ? (
                    <span className="text-primary">Responding…</span>
                  ) : "AI Creative Director"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { clearMessages(); }}
                  className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                  title="Clear chat"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* ── Messages ── */}
            <div className="flex-1 overflow-y-auto px-4 pt-4" onClick={() => inputRef.current?.focus()}>
              {loadingHistory ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
                  <AgentFace state="idle" size={64} />
                  <div>
                    <p className="font-semibold text-foreground mb-1">Hey! I'm Hoppy 🐰</p>
                    <p className="text-sm text-muted-foreground">Your AI creative director. Ask me anything about your projects, ideas, or how to use the studio.</p>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <MessageBubble key={msg.id} msg={msg} />
                  ))}
                  {showTyping && <TypingIndicator />}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* ── Attached image preview ── */}
            <AnimatePresence>
              {uploadedImage && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-4 pt-2 flex-shrink-0 overflow-hidden"
                >
                  <div className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2 border border-border/30">
                    <img src={uploadedImage.url} alt="Attached" className="w-8 h-8 rounded object-cover" />
                    <span className="flex-1 text-xs text-foreground/60 truncate">{uploadedImage.name}</span>
                    <button onClick={() => setUploadedImage(null)} className="text-muted-foreground hover:text-foreground">
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Input ── */}
            <div className="flex-shrink-0 px-4 py-3 border-t border-border">
              <div className="flex items-end gap-2">
                {/* Attach button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading || isUploading}
                  className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors disabled:opacity-40"
                >
                  {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                </button>

                {/* Text input */}
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Message Hoppy…"
                  rows={1}
                  disabled={isLoading}
                  style={{ fieldSizing: "content" } as React.CSSProperties}
                  className={cn(
                    "flex-1 resize-none bg-muted/30 border border-border rounded-xl px-3 py-2.5",
                    "text-sm text-foreground placeholder:text-muted-foreground/50",
                    "outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40",
                    "max-h-32 min-h-[40px] leading-relaxed transition-colors",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                />

                {/* Send button — always bold purple, dimmed when can't send */}
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!canSend}
                  className={cn(
                    "flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl transition-all",
                    canSend
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95"
                      : "bg-primary/20 text-primary/40 cursor-not-allowed"
                  )}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground/30 text-center mt-2">↵ send · ⇧↵ newline</p>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              onChange={handleFileSelect}
              className="hidden"
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
