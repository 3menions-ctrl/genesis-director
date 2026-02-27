/**
 * Landing Page Hoppy Concierge 🐰
 * 
 * A warm, curiosity-driven chat widget for unauthenticated visitors.
 * - Sticky corner button with Hoppy's face
 * - Glassmorphic chat panel with streaming responses
 * - One free demo prompt → signup CTA after first response
 * - No auth required
 */

import { useState, useRef, useEffect, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Sparkles, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

// ─── Types ────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: "assistant" | "user";
  content: string;
}

// ─── Constants ────────────────────────────────────────────────────
const GREETING: Message = {
  id: "greeting",
  role: "assistant",
  content: "Hey there! 👋 I'm Hoppy, your creative concierge. What kind of video have you always dreamed of making? A sci-fi short? A music video? Tell me your wildest idea 🎬",
};

const DEMO_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/landing-demo-chat`;

const PROMPT_SUGGESTIONS = [
  "A noir detective story set in Tokyo",
  "An epic fantasy battle on a floating island",
  "A dreamy music video in a neon-lit city",
];

// ─── SSE Stream Helper ───────────────────────────────────────────
async function streamDemoChat({
  message,
  onDelta,
  onDone,
  onError,
}: {
  message: string;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}) {
  try {
    const resp = await fetch(DEMO_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ message }),
    });

    if (!resp.ok) {
      const data = await resp.json().catch(() => ({ error: "Something went wrong" }));
      onError(data.error || "Something went wrong");
      return;
    }

    if (!resp.body) {
      onError("No response stream");
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, newlineIdx);
        buffer = buffer.slice(newlineIdx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") { onDone(); return; }
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onDelta(content);
        } catch {
          buffer = line + "\n" + buffer;
          break;
        }
      }
    }
    onDone();
  } catch (e) {
    onError(e instanceof Error ? e.message : "Connection failed");
  }
}

// ─── Message Bubble ──────────────────────────────────────────────
const MessageBubble = memo(function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25 }}
      className={cn("flex", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-primary/20 text-foreground border border-primary/20"
            : "bg-white/[0.06] text-foreground/90 border border-white/[0.08]"
        )}
      >
        {isUser ? (
          <p>{msg.content}</p>
        ) : (
          <div className="prose prose-sm prose-invert max-w-none [&_strong]:text-primary/90 [&_p]:mb-1.5 [&_p:last-child]:mb-0">
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </motion.div>
  );
});

// ─── Signup CTA Card ─────────────────────────────────────────────
function SignupCTA({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="mx-2 mt-3 p-4 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent backdrop-blur-xl"
    >
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground mb-1">
            Love the vision? Let's make it real ✨
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            Sign up free and turn this into an actual cinematic video with Genesis.
          </p>
          <button
            onClick={() => onNavigate("/auth?mode=signup")}
            className="group flex items-center gap-2 h-9 px-5 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]"
          >
            Get Started Free
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Component ──────────────────────────────────────────────
export const LandingHoppy = memo(function LandingHoppy({
  onNavigate,
}: {
  onNavigate: (path: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasUsedDemo, setHasUsedDemo] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text.trim(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setShowSuggestions(false);
    setIsStreaming(true);

    let assistantContent = "";
    const assistantId = `assistant-${Date.now()}`;

    const upsertAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.id === assistantId) {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantContent } : m
          );
        }
        return [...prev, { id: assistantId, role: "assistant", content: assistantContent }];
      });
    };

    await streamDemoChat({
      message: text.trim(),
      onDelta: upsertAssistant,
      onDone: () => {
        setIsStreaming(false);
        setHasUsedDemo(true);
      },
      onError: (error) => {
        setMessages(prev => [
          ...prev,
          { id: assistantId, role: "assistant", content: `Oops! ${error} 🐰` },
        ]);
        setIsStreaming(false);
      },
    });
  }, [isStreaming]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  }, [input, sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }, [input, sendMessage]);

  return (
    <>
      {/* ─── Floating Hoppy Button ─────────────────────────── */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className={cn(
              "fixed bottom-6 right-6 z-50",
              "h-16 w-16 rounded-full overflow-hidden",
              "shadow-[0_0_30px_hsl(263_70%_58%/0.3)]",
              "hover:shadow-[0_0_50px_hsl(263_70%_58%/0.5)]",
              "border-2 border-primary/40",
              "transition-shadow duration-300"
            )}
            aria-label="Chat with Hoppy"
          >
            <video
              src="/hoppy-blink.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover scale-[1.3] object-top"
            />
            {/* Attention pulse */}
            <span className="absolute inset-0 rounded-full animate-ping bg-primary/15 pointer-events-none" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ─── Chat Panel ────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className={cn(
              "fixed bottom-6 right-6 z-50",
              "w-[380px] max-w-[calc(100vw-3rem)]",
              "h-[520px] max-h-[calc(100vh-3rem)]",
              "rounded-3xl overflow-hidden",
              "bg-black/80 backdrop-blur-3xl",
              "border border-white/[0.08]",
              "shadow-[0_20px_80px_rgba(0,0,0,0.6),0_0_40px_hsl(263_70%_58%/0.15)]",
              "flex flex-col"
            )}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
              <div className="h-10 w-10 rounded-full overflow-hidden ring-2 ring-primary/30 flex-shrink-0">
                <video
                  src="/hoppy-blink.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover scale-[1.15]"
                  style={{ objectPosition: "50% 25%" }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Hoppy</p>
                <p className="text-xs text-muted-foreground">
                  {isStreaming ? (
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      Imagining your vision...
                    </span>
                  ) : (
                    "Creative Concierge 🐰"
                  )}
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-white/[0.06] transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-hide">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}

              {/* Streaming indicator */}
              {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl px-4 py-3">
                    <div className="flex gap-1.5">
                      {[0, 1, 2].map(i => (
                        <div
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce"
                          style={{ animationDelay: `${i * 150}ms` }}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Signup CTA after demo */}
              {hasUsedDemo && !isStreaming && (
                <SignupCTA onNavigate={onNavigate} />
              )}
            </div>

            {/* Prompt Suggestions (shown initially) */}
            {showSuggestions && !hasUsedDemo && (
              <div className="px-4 pb-2 flex flex-wrap gap-2">
                {PROMPT_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => sendMessage(suggestion)}
                    className="text-xs px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-muted-foreground hover:text-foreground hover:bg-white/[0.1] transition-all"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <form
              onSubmit={handleSubmit}
              className="px-4 pb-4 pt-2 border-t border-white/[0.06]"
            >
              <div className="flex items-end gap-2 bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    hasUsedDemo
                      ? "Sign up to keep chatting ✨"
                      : "Describe your dream video..."
                  }
                  disabled={hasUsedDemo}
                  rows={1}
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none resize-none max-h-24 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isStreaming || hasUsedDemo}
                  className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center hover:bg-primary/30 disabled:opacity-30 transition-all flex-shrink-0"
                >
                  <Send className="w-3.5 h-3.5 text-primary" />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});
