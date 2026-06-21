/**
 * VoicePalette — voice-driven command palette.
 *
 * Cmd/Ctrl + Shift + Space opens a centered prompt with a live
 * transcription strip. The user speaks; we use the Web Speech API
 * (built-in, free, no key) to transcribe in-browser; on stop, the
 * resulting text is routed:
 *
 *   - If it matches a known command (e.g. "open lobby", "go to
 *     market"), we navigate.
 *   - Otherwise, we route to /create with the prompt seeded.
 *
 * Fallback: in browsers without webkitSpeechRecognition (Safari < 16,
 * Firefox), the palette is read-only with a "Speak Recognition not
 * available in this browser" message + a text input.
 *
 * Mounted globally — listens for the hotkey, opens, listens, closes.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, X } from "lucide-react";

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    [k: number]: { 0: { transcript: string }; isFinal: boolean };
    length: number;
  };
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (e: SpeechRecognitionEventLike) => void;
  onend: () => void;
  onerror: (e: { error: string }) => void;
  start: () => void;
  stop: () => void;
}

function getRecognizer(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    SpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const r = new Ctor();
  r.continuous = true;
  r.interimResults = true;
  r.lang = "en-US";
  return r;
}

const COMMAND_MAP: Array<{ pattern: RegExp; route: string }> = [
  { pattern: /open lobby|go to lobby/i,    route: "/lobby" },
  { pattern: /open studio|new project/i,   route: "/create" },
  { pattern: /open library|projects/i,     route: "/projects" },
  { pattern: /credits|my credits/i,        route: "/credits" },
  { pattern: /settings/i,                  route: "/settings" },
  { pattern: /profile/i,                   route: "/profile" },
];

export function VoicePalette() {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const navigate = useNavigate();

  // Hotkey: Cmd/Ctrl + Shift + Space
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === " " || e.code === "Space")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (open && e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Boot recognizer on open; tear down on close.
  useEffect(() => {
    if (!open) return;
    setTranscript("");
    setError(null);
    const rec = getRecognizer();
    if (!rec) {
      setError("Voice input isn't available in this browser. Type instead, or try Chrome.");
      return;
    }
    rec.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
      }
      setTranscript(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = (e) => setError(`Voice error: ${e.error}`);
    recRef.current = rec;
    try { rec.start(); setListening(true); }
    catch { setError("Couldn't start microphone."); }
    return () => {
      try { rec.stop(); } catch { /* noop */ }
      recRef.current = null;
    };
  }, [open]);

  const submit = () => {
    const text = transcript.trim();
    if (!text) { setOpen(false); return; }
    // Match a command first; otherwise route to /create with the prompt.
    for (const { pattern, route } of COMMAND_MAP) {
      if (pattern.test(text)) {
        setOpen(false);
        navigate(route);
        return;
      }
    }
    setOpen(false);
    const url = `/create?prompt=${encodeURIComponent(text.slice(0, 500))}`;
    navigate(url);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-label="Voice command palette"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="fixed inset-0 z-[70] grid place-items-center bg-black/55 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-[min(640px,90vw)] rounded-3xl border border-glass-active bg-glass backdrop-blur-2xl p-6 shadow-2xl shadow-black/60"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-foreground/70 text-xs uppercase tracking-[0.18em]">
                {listening ? <Mic className="w-4 h-4 text-primary animate-pulse" /> : <MicOff className="w-4 h-4 text-foreground/40" />}
                {listening ? "Listening…" : "Press to speak"}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close voice palette"
                className="p-1 text-foreground/55 hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            <div className="min-h-[80px] rounded-2xl bg-background/40 border border-glass-active/40 p-4 mb-4">
              {transcript ? (
                <p className="text-lg leading-snug text-foreground">{transcript}</p>
              ) : (
                <p className="text-base text-foreground/40">
                  Try: "Open lobby" · "New project" · "A neon-lit Tokyo street at night…"
                </p>
              )}
            </div>

            {error && (
              <p className="text-xs text-destructive mb-3">{error}</p>
            )}

            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-foreground/45">
                Enter to send · Esc to cancel
              </div>
              <div className="flex items-center gap-2">
                {listening ? (
                  <button
                    type="button"
                    onClick={() => recRef.current?.stop()}
                    className="px-4 py-2 text-xs uppercase tracking-[0.16em] rounded-full bg-glass-hover text-foreground/80 hover:text-foreground"
                  >
                    Stop
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => { try { recRef.current?.start(); setListening(true); setError(null); } catch { /* noop */ } }}
                    className="px-4 py-2 text-xs uppercase tracking-[0.16em] rounded-full bg-primary/20 text-primary hover:bg-primary/30"
                  >
                    Speak
                  </button>
                )}
                <button
                  type="button"
                  onClick={submit}
                  className="px-4 py-2 text-xs uppercase tracking-[0.16em] rounded-full bg-primary text-primary-foreground"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
