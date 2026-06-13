/**
 * DirectorChat — the AI co-director surface.
 *
 * The promise: every editing operation can be expressed in plain
 * English. "Tighten the third scene." "Add a 0.6 second fade between
 * clip 2 and 3." "Find me three seconds of B-roll for the chase."
 * The director hears, decides, and executes — committing each change
 * as a labelled version so the user can A/B at any time.
 *
 * v1 surface: a floating right-side panel opened by Cmd+/ or the
 * sparkle button in the top bar. Text input, transcript, sample
 * prompts. The backend integration is stubbed for now — the panel
 * recognizes a few canonical commands client-side (transitions,
 * playback, navigation) and POSTs unknown commands to the
 * `director-chat` edge function. When that function ships, the same
 * UI carries through unchanged.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Send, Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";
import { Surface, SurfaceHeader, SurfaceFooter, SurfaceKbdHint } from "./Surface";
import { supabase } from "@/integrations/supabase/client";
import type { EditorProject } from "@/lib/editor/types";
import {
  setPlayhead,
  setPlaybackSpeed,
  toggleLoopRegion,
  toggleTheaterMode,
  addTransition,
  setView,
  setInPoint,
  setOutPoint,
  clearInOut,
  applyEffectToClips,
  applyProjectTemplate,
} from "@/lib/editor/store";
import {
  PREMIUM_EFFECTS,
  PROJECT_TEMPLATES,
} from "@/lib/editor/library";
import { useEditor } from "@/hooks/editor/useEditor";

interface Props {
  project: EditorProject;
  open: boolean;
  onClose: () => void;
}

interface ChatTurn {
  id: string;
  role: "user" | "director";
  text: string;
  /** When the director executed a real mutation, the label that was
   *  recorded on the undo stack — surfaces as a "version" link. */
  appliedVersion?: string;
  /** True while waiting for the backend (or local rule) to reply. */
  pending?: boolean;
}

const SUGGESTIONS = [
  "Add a 0.5s fade between every clip",
  "Make playback 1.5×",
  "Loop between in and out",
  "Jump to the start",
  "Open the storyboard",
  "Tighten the cut by 10%",
];

export function DirectorChat({ project, open, onClose }: Props) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [pending, setPending] = useState(false);
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const { playheadSec } = useEditor();

  // Focus on open. Surface handles Esc.
  useEffect(() => {
    if (!open) return;
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  // Auto-scroll on new turn
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [turns.length, pending]);

  const clips = useMemo(
    () => project.scenes.flatMap((s) => s.clips).filter((c) => c.kind !== "title"),
    [project],
  );

  /**
   * Try to resolve `prompt` against local NLE rules. Returns an
   * acknowledgement message if matched (the side-effect already
   * fired), or null to fall through to the backend.
   */
  const tryLocalResolve = (raw: string): string | null => {
    const p = raw.toLowerCase().trim();

    // Transition application — "add Xs fade between every clip"
    {
      const m = p.match(/(?:add|apply|set)\s+(?:a\s+)?(\d+(?:\.\d+)?)?\s*s?\s*(fade|dissolve|wipe|slide|circle|radial|smooth|fadeblack|fadewhite)?.*(?:between|every|all)/);
      if (m) {
        const dur = m[1] ? parseFloat(m[1]) : 0.4;
        const kindRaw = m[2] || "fade";
        const kind = kindRaw === "wipe" ? "wipeleft" : kindRaw === "slide" ? "slideleft" : kindRaw;
        let count = 0;
        for (let i = 0; i < clips.length - 1; i++) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          addTransition(clips[i].id, clips[i + 1].id, kind as any, dur);
          count += 1;
        }
        return count > 0
          ? `Applied ${kindRaw} (${dur.toFixed(2)}s) at ${count} boundaries.`
          : "No boundaries to apply a transition between.";
      }
    }

    // Studio Library — "apply the wedding template" / "grade with teal & orange"
    {
      const templateMatch = p.match(
        /(?:apply|use|do)\s+(?:the\s+)?(.+?)\s+(?:template|recipe|preset)/,
      );
      if (templateMatch) {
        const needle = templateMatch[1].toLowerCase();
        const t = PROJECT_TEMPLATES.find(
          (x) =>
            x.name.toLowerCase().includes(needle) ||
            needle.includes(x.name.toLowerCase()) ||
            x.id.includes(needle.replace(/\s+/g, "-")),
        );
        if (t) {
          const effect = t.effectId
            ? PREMIUM_EFFECTS.find((e) => e.id === t.effectId)
            : undefined;
          const result = applyProjectTemplate({
            filter: effect?.cssFilter,
            fadeInSec: t.clipFades.fadeInSec,
            fadeOutSec: t.clipFades.fadeOutSec,
            transitionKind: t.transition.kind,
            transitionDurationSec: t.transition.durationSec,
            playbackSpeed: t.playbackSpeed,
          });
          return `Applied ${t.name} — ${result.clipsTouched} clips, ${result.boundariesTouched} transitions, ${t.playbackSpeed}× playback.`;
        }
      }
    }
    {
      const gradeMatch = p.match(
        /(?:grade|color|apply|look like|in the look of)\s+(?:with|like|using)?\s+(.+)/,
      );
      if (gradeMatch) {
        const needle = gradeMatch[1].toLowerCase();
        const e = PREMIUM_EFFECTS.find(
          (x) =>
            x.name.toLowerCase().includes(needle) ||
            needle.includes(x.name.toLowerCase()) ||
            x.attribution.toLowerCase().includes(needle) ||
            x.id.includes(needle.replace(/\s+/g, "-")),
        );
        if (e) {
          applyEffectToClips(e.cssFilter);
          return `Graded with ${e.name} — ${e.attribution}.`;
        }
      }
    }

    // Playback speed
    {
      const m = p.match(/(?:make|set|play(?:back)?)\s+(?:speed\s+)?(?:to\s+)?(\d+(?:\.\d+)?)x?/);
      if (m) {
        const v = parseFloat(m[1]);
        setPlaybackSpeed(v);
        return `Playback speed is now ${v}×.`;
      }
    }

    // Loop
    if (/(start|stop|toggle)?\s*loop/.test(p)) {
      toggleLoopRegion();
      return "Loop region toggled.";
    }

    // Theater mode
    if (/(theater|theatre|focus mode)/.test(p)) {
      toggleTheaterMode();
      return "Theater mode toggled.";
    }

    // Navigation
    if (/(jump|go|seek)\s+(?:to\s+)?(?:the\s+)?(start|beginning|top)/.test(p)) {
      setPlayhead(0);
      return "Playhead is at the start.";
    }
    if (/(jump|go|seek)\s+(?:to\s+)?(?:the\s+)?(end|finish)/.test(p)) {
      setPlayhead(project.durationSec);
      return `Playhead is at the end (${project.durationSec.toFixed(2)}s).`;
    }
    if (/open\s+(?:the\s+)?(stage|timeline|script|storyboard)/.test(p)) {
      const lens = p.match(/(stage|timeline|script|storyboard)/)?.[1];
      if (lens) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setView(lens as any);
        return `Switched to ${lens}.`;
      }
    }

    // In/out marks
    if (/mark\s+in\b/.test(p)) {
      setInPoint(playheadSec);
      return `In-point at ${playheadSec.toFixed(2)}s.`;
    }
    if (/mark\s+out\b/.test(p)) {
      setOutPoint(playheadSec);
      return `Out-point at ${playheadSec.toFixed(2)}s.`;
    }
    if (/clear\s+(in|out|range|marks)/.test(p)) {
      clearInOut();
      return "Range cleared.";
    }

    return null;
  };

  const submit = async (raw?: string) => {
    const t = (raw ?? text).trim();
    if (!t || pending) return;
    const userTurn: ChatTurn = { id: `u-${Date.now()}`, role: "user", text: t };
    setTurns((prev) => [...prev, userTurn]);
    setText("");
    setPending(true);

    // Local rule resolution first — gives instant feedback without a
    // round-trip for the canonical edits.
    const localReply = tryLocalResolve(t);
    if (localReply) {
      setTurns((prev) => [
        ...prev,
        { id: `d-${Date.now()}`, role: "director", text: localReply },
      ]);
      setPending(false);
      return;
    }

    // Fall through to the backend (stubbed for v1 — when the
    // edge function ships, this same call works untouched).
    try {
      const { data, error } = await supabase.functions.invoke<{
        reply: string;
        appliedVersion?: string;
      }>("director-chat", {
        body: {
          projectId: project.id,
          prompt: t,
          playheadSec,
          context: {
            clipCount: clips.length,
            duration: project.durationSec,
          },
        },
      });
      if (error) throw error;
      setTurns((prev) => [
        ...prev,
        {
          id: `d-${Date.now()}`,
          role: "director",
          text: data?.reply ?? "Noted.",
          appliedVersion: data?.appliedVersion,
        },
      ]);
    } catch {
      // Backend not wired yet — graceful fallback.
      setTurns((prev) => [
        ...prev,
        {
          id: `d-${Date.now()}`,
          role: "director",
          text:
            "I heard you. The backend brain isn't connected yet — but I can already do transitions, playback speed, loop, theater, in/out marks, and view switching. Try “add a 0.5s fade between every clip.”",
        },
      ]);
    } finally {
      setPending(false);
    }
  };

  /**
   * Web Speech API — when supported, hold the mic to dictate. The
   * recognized text streams into the input; release to send. Browsers
   * that don't have it just don't render the mic button.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recogRef = useRef<any>(null);
  const startListening = () => {
    const W = window as unknown as {
      SpeechRecognition?: new () => unknown;
      webkitSpeechRecognition?: new () => unknown;
    };
    const Ctor = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!Ctor) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = new Ctor();
    r.continuous = false;
    r.interimResults = true;
    r.lang = navigator.language || "en-US";
    let final = "";
    r.onresult = (e: { results: { isFinal: boolean; 0: { transcript: string } }[] }) => {
      let interim = "";
      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) final += res[0].transcript;
        else interim += res[0].transcript;
      }
      setText((final + interim).trim());
    };
    r.onend = () => {
      setListening(false);
      recogRef.current = null;
      if (final.trim()) void submit(final.trim());
    };
    r.onerror = () => {
      setListening(false);
      recogRef.current = null;
    };
    r.start();
    recogRef.current = r;
    setListening(true);
  };
  const stopListening = () => {
    if (recogRef.current) {
      try {
        recogRef.current.stop();
      } catch {
        /* ignored */
      }
      recogRef.current = null;
    }
    setListening(false);
  };

  return (
    <Surface
      open={open}
      onClose={onClose}
      size="md"
      labelledBy="director-chat-title"
      blockEscClose
    >
      <SurfaceHeader
        id="director-chat-title"
        eyebrow="◆ Director"
        title="How should we shape this?"
        onClose={onClose}
      />

      {/* Transcript */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 scrollbar-hide">
              {turns.length === 0 && !pending ? (
                <div className="text-center py-6">
                  <p
                    className="font-display italic text-[15px] text-foreground/80 leading-snug"
                    style={{ fontFamily: "'Fraunces', serif" }}
                  >
                    Speak as you would to a co-director.
                  </p>
                  <p className={cn(TYPE_META, "mt-3 text-muted-foreground/55 tracking-[0.30em]")}>
                    ◆ Suggestions
                  </p>
                  <div className="mt-3 flex flex-col gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => void submit(s)}
                        className={cn(
                          "text-left px-3 py-2 rounded-md text-[13px] text-foreground/80",
                          "bg-white/[0.02] hover:bg-white/[0.06] ring-1 ring-inset ring-white/[0.05]",
                          "transition-colors",
                        )}
                      >
                        “{s}”
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <ul className="space-y-3">
                  {turns.map((turn) => (
                    <li key={turn.id} className={cn("flex", turn.role === "user" ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl px-3.5 py-2 text-[13.5px] leading-snug",
                          turn.role === "user"
                            ? "bg-[hsl(212_100%_60%/0.14)] text-foreground/95 ring-1 ring-inset ring-accent/30"
                            : "bg-white/[0.04] text-foreground/90 ring-1 ring-inset ring-white/[0.06]",
                        )}
                      >
                        {turn.role === "director" ? (
                          <span
                            className="font-display italic"
                            style={{ fontFamily: "'Fraunces', serif" }}
                          >
                            {turn.text}
                          </span>
                        ) : (
                          turn.text
                        )}
                        {turn.appliedVersion && (
                          <div className={cn(TYPE_META, "mt-2 text-accent/85 tracking-[0.24em]")}>
                            ◆ Version · {turn.appliedVersion}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                  {pending && (
                    <li className="flex justify-start">
                      <div className="max-w-[85%] rounded-2xl px-3.5 py-2 text-[13.5px] bg-white/[0.04] text-foreground/55 ring-1 ring-inset ring-white/[0.06] flex items-center gap-2">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-foreground/55 animate-pulse" />
                        <span
                          className="font-display italic"
                          style={{ fontFamily: "'Fraunces', serif" }}
                        >
                          Listening…
                        </span>
                      </div>
                    </li>
                  )}
                </ul>
              )}
            </div>

      {/* Composer */}
      <div className="relative shrink-0 px-6 py-3.5">
        <span
          aria-hidden
          className="absolute left-6 right-6 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent"
        />
        <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={listening ? stopListening : startListening}
                  className={cn(
                    "shrink-0 h-9 w-9 rounded-md flex items-center justify-center",
                    "transition-colors",
                    listening
                      ? "bg-rose-500/[0.18] text-rose-200 ring-1 ring-inset ring-rose-400/50"
                      : "bg-white/[0.03] text-foreground/70 hover:bg-white/[0.08] ring-1 ring-inset ring-white/[0.06]",
                  )}
                  title={listening ? "Stop dictating" : "Dictate (hold to speak)"}
                  aria-label={listening ? "Stop dictating" : "Dictate"}
                >
                  {listening ? (
                    <MicOff className="h-4 w-4" strokeWidth={1.5} />
                  ) : (
                    <Mic className="h-4 w-4" strokeWidth={1.5} />
                  )}
                </button>
                <textarea
                  ref={inputRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void submit();
                    }
                  }}
                  rows={1}
                  placeholder="“Tighten this cut.”  ⌘↩ to send."
                  className={cn(
                    "flex-1 resize-none rounded-md px-3 py-2",
                    "bg-white/[0.03] text-foreground/95 placeholder:text-muted-foreground/45",
                    "text-[13.5px] leading-snug",
                    "ring-1 ring-inset ring-white/[0.06] focus:ring-accent/45 outline-none",
                    "max-h-32",
                  )}
                />
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!text.trim() || pending}
            className={cn(
              "shrink-0 h-9 w-9 rounded-md flex items-center justify-center",
              "bg-[hsl(var(--accent)/0.16)] text-accent ring-1 ring-inset ring-accent/40",
              "transition-colors hover:bg-[hsl(var(--accent)/0.24)]",
              "disabled:opacity-30 disabled:cursor-not-allowed",
            )}
            aria-label="Send"
            title="Send (Enter)"
          >
            <Send className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <SurfaceFooter>
        <span className="flex items-center gap-2">
          <SurfaceKbdHint keys="⌘/" label="open" />
          <span aria-hidden>·</span>
          <SurfaceKbdHint keys="Esc" label="close" />
        </span>
        <span>
          {turns.length} {turns.length === 1 ? "turn" : "turns"}
        </span>
      </SurfaceFooter>
    </Surface>
  );
}
