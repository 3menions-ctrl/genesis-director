/**
 * Companion panel — minimal sidekick UI mounted from HoppyPresence.
 *
 * This is the seed of the "Muse" co-pilot described in the spectacular
 * roadmap. Today it's a slide-in side panel with a single-input
 * chat-style affordance. Streaming responses, project-context awareness,
 * and voice come in future phases — but the surface is wired now so
 * the rest of the app can route to it.
 *
 * Mounted globally from App.tsx alongside HoppyPresence.
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HoppyPresence } from "./HoppyPresence";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const STARTER_PROMPTS = [
  "Suggest a noir scene to start my next reel",
  "Make this script sound more cinematic",
  "What's working in my recent reels?",
  "Pick the next style I should try",
];

export function CompanionPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "intro",
      role: "assistant",
      content:
        "Hi — I'm Hoppy. I can help you tighten a script, pick a style, or kick off your next reel. What are you in the mood to make tonight?",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  // Escape closes the panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content) return;
    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content };
    const assistantId = `a-${Date.now() + 1}`;
    setMessages((m) => [...m, userMsg, { id: assistantId, role: "assistant", content: "" }]);
    setDraft("");
    setSending(true);

    try {
      // Stream the response from the hoppy-chat edge function.
      const { data: { session } } = await (await import("@/integrations/supabase/client"))
        .supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hoppy-chat`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: session ? `Bearer ${session.access_token}` : "",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
        },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({
            role: m.role, content: m.content,
          })),
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`upstream ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      // Parse the OpenAI-compatible SSE stream: `data: { ... }` lines,
      // terminator `data: [DONE]`. Extract the `choices[0].delta.content`
      // from each chunk and append to the assistant message.
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload);
            const piece = parsed?.choices?.[0]?.delta?.content;
            if (typeof piece === "string" && piece) {
              accumulated += piece;
              setMessages((m) =>
                m.map((msg) => msg.id === assistantId ? { ...msg, content: accumulated } : msg)
              );
            }
          } catch { /* skip malformed line */ }
        }
      }
    } catch {
      setMessages((m) =>
        m.map((msg) => msg.id === assistantId
          ? { ...msg, content: "I lost the line for a second — try that again?" }
          : msg)
      );
    } finally {
      setSending(false);
      // Pulse Hoppy when an answer arrives.
      try { window.dispatchEvent(new CustomEvent("sb:hoppy:react")); } catch { /* noop */ }
    }
  };

  return (
    <>
      <HoppyPresence open={open} onToggle={() => setOpen((o) => !o)} />

      <AnimatePresence>
        {open && (
          <motion.aside
            key="companion"
            role="dialog"
            aria-label="Hoppy — Small Bridges co-pilot"
            initial={{ x: 360, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 360, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className={[
              "fixed bottom-24 right-6 z-50",
              "w-[min(360px,calc(100vw-3rem))]",
              "max-h-[70vh]",
              "rounded-3xl border border-glass-active bg-glass backdrop-blur-xl",
              "shadow-2xl shadow-black/60 overflow-hidden flex flex-col",
            ].join(" ")}
          >
            <header className="flex items-center justify-between px-4 py-3 border-b border-glass-active/40">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" aria-hidden />
                <span className="text-sm font-medium text-foreground/90">Hoppy</span>
                <span className="text-[10px] uppercase tracking-[0.18em] text-foreground/40">Beta</span>
              </div>
              <button
                type="button"
                aria-label="Close Hoppy"
                onClick={() => setOpen(false)}
                className="p-1 rounded-md text-foreground/60 hover:text-foreground hover:bg-glass-hover"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={[
                    "max-w-[88%] text-sm leading-relaxed rounded-2xl px-3 py-2",
                    m.role === "user"
                      ? "ml-auto bg-primary/15 text-foreground"
                      : "mr-auto bg-glass-hover text-foreground/90",
                  ].join(" ")}
                >
                  {m.content}
                </div>
              ))}
              {messages.length === 1 && (
                <div className="pt-2 space-y-2">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-foreground/40">
                    Try one of these
                  </div>
                  <div className="grid grid-cols-1 gap-1">
                    {STARTER_PROMPTS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => void send(p)}
                        className="text-left text-xs rounded-lg px-3 py-2 text-foreground/70 hover:text-foreground hover:bg-glass-hover transition-colors"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); void send(draft); }}
              className="flex items-center gap-2 px-3 py-3 border-t border-glass-active/40"
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask Hoppy something…"
                aria-label="Message Hoppy"
                className={[
                  "flex-1 text-sm rounded-xl bg-background/40 border border-glass-active/40",
                  "px-3 py-2 placeholder:text-foreground/40",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                ].join(" ")}
              />
              <Button type="submit" size="icon" disabled={sending || !draft.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
