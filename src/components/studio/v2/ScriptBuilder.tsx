/**
 * ScriptBuilder — Hollywood-grade screenplay + dialogue workshop.
 *
 * Layout:
 *   ┌─ Toolbar ──────────────────────────────────────────────────────┐
 *   │ Find · Status filter · Read-through · Export · Page / runtime  │
 *   ├──────────────────────────────────────────┬─────────────────────┤
 *   │ Screenplay (editable, verbatim)           │ Story Beat Strip    │
 *   │  · SLUGLINE · ACTION · (parenthetical) · │  · Cast legend      │
 *   │    CHARACTER · DIALOGUE · NOTES          │  · Scene strip      │
 *   │  · Move ▲▼ · Duplicate · Regenerate ·    │  · Auto-scroll      │
 *   │    Render · Delete                       │                     │
 *   └──────────────────────────────────────────┴─────────────────────┘
 *
 * Multi-speaker: when the dialogue field contains `NAME: line` blocks we
 * render each block as its own character cue (with reassign menu), without
 * altering the verbatim text shipped to the renderer.
 *
 * Continuity warnings flag missing speakers, blank dialogue with cast,
 * repeated locations, and over-long runtime.
 *
 * Keyboard (when the scene block is focused):
 *   ⌘↑/↓  reorder · ⌘D duplicate · ⌘⏎ render · ⌘⌫ delete
 *
 * Read-through mode is a full-screen teleprompter that paginates through the
 * script one beat at a time — for table-reads with the director.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, Circle, Clapperboard,
  Copy, Download, Edit3, Filter, Link2, Loader2, Mic2, Play, RefreshCw, Scissors, Search,
  Sparkles, Trash2, Users, X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { CastMember, SceneDraft, SceneStatus } from "./types";

// ─── helpers ────────────────────────────────────────────────────────────────

const LENS_OPTIONS: SceneDraft["lens"][]  = ["wide", "medium", "close", "macro", "aerial"];
const MOVE_OPTIONS: SceneDraft["move"][]  = ["static", "dolly", "pan", "tilt", "handheld", "crane"];
const DUR_OPTIONS:  SceneDraft["duration"][] = [5, 10, 12, 15];

function resolveSpeakerId(scene: SceneDraft, cast: CastMember[], index: number): string | undefined {
  if (scene.speakerId && cast.some(c => c.id === scene.speakerId)) return scene.speakerId;
  if (!cast.length) return undefined;
  const haystack = `${scene.beat} ${scene.dialogue}`.toLowerCase();
  const matched = cast.find(c => {
    if (!c.name) return false;
    const first = c.name.split(/\s+/)[0].toLowerCase();
    return haystack.includes(first);
  });
  if (matched) return matched.id;
  return cast[index % cast.length]?.id;
}

/** Parse dialogue into (NAME, line) blocks. If no NAME: prefix exists, the
 *  whole text is treated as a single block under the resolved speaker. */
function parseDialogueBlocks(dialogue: string): Array<{ name?: string; text: string }> {
  if (!dialogue.trim()) return [];
  const lines = dialogue.split(/\r?\n/);
  const out: Array<{ name?: string; text: string }> = [];
  let current: { name?: string; text: string } | null = null;
  const cueRe = /^\s*([A-Z][A-Z0-9 .'\-]{0,30}):\s*(.*)$/;
  for (const ln of lines) {
    const m = ln.match(cueRe);
    if (m) {
      if (current) out.push(current);
      current = { name: m[1].trim(), text: m[2] };
    } else if (current) {
      current.text += (current.text ? "\n" : "") + ln;
    } else {
      current = { text: ln };
    }
  }
  if (current) out.push(current);
  return out.map(b => ({ ...b, text: b.text.trim() })).filter(b => b.text || b.name);
}

function statusChip(s: SceneDraft["status"]) {
  switch (s) {
    case "done":       return { Icon: CheckCircle2, color: "text-emerald-400", label: "Rendered" };
    case "generating": return { Icon: Loader2,      color: "text-accent animate-spin", label: "Rendering" };
    case "queued":     return { Icon: Loader2,      color: "text-accent/80 animate-spin", label: "Queued" };
    case "failed":     return { Icon: AlertTriangle, color: "text-red-400", label: "Failed" };
    default:           return { Icon: Circle,       color: "text-white/30", label: "Draft" };
  }
}

function wordCount(text: string) { return text.trim() ? text.trim().split(/\s+/).length : 0; }

/** Quick continuity checks (returns human warnings per scene). */
function continuityWarnings(scene: SceneDraft, cast: CastMember[], prev?: SceneDraft): string[] {
  const w: string[] = [];
  if (cast.length && scene.dialogue.trim() && !scene.speakerId) w.push("No speaker assigned");
  if (cast.length && !scene.dialogue.trim() && scene.beat.toLowerCase().includes("say")) w.push("Action mentions dialogue but line is empty");
  if (prev && prev.location && prev.location === scene.location) w.push("Same location as previous scene — vary the staging");
  if (scene.duration >= 12 && !scene.move) w.push("Long beat with static camera — consider movement");
  if (scene.dialogue.length > 280) w.push("Dialogue is dense (>280 chars) — Kling may truncate");
  // Independent scenes lose all carry-over from the prior shot — they MUST
  // provide their own anchors (reference image, assigned character, or a
  // descriptive location/beat) or Kling has nothing to lock the render to.
  if (scene.chainFromPrevious === false) {
    const hasRefImage = !!scene.refImageUrl;
    const hasCharacter = !!scene.speakerId && cast.some(c => c.id === scene.speakerId && c.imageUrl);
    const locationSpecific = scene.location.trim().length > 0
      && !/^(int\.?|ext\.?)\s*(scene|untitled|location)?\s*(—|-)?\s*(day|night)?$/i.test(scene.location.trim());
    const hasEnvironmentPrompt = locationSpecific || scene.beat.trim().length >= 20;
    if (!hasRefImage && !hasCharacter && !hasEnvironmentPrompt) {
      w.push("Independent scene has no anchor — add a reference image, assign a character, or describe the location/action before rendering");
    } else {
      if (!hasRefImage && !hasCharacter) w.push("Independent scene has no visual anchor — attach a reference image or character for consistent framing");
      if (!hasEnvironmentPrompt) w.push("Independent scene needs a specific location or richer action beat — generic slugline alone won't ground the shot");
    }
  }
  return w;
}

/** Export the script in Fountain format — open standard, opens in Highland,
 *  WriterDuet, Final Draft, etc. */
function toFountain(scenes: SceneDraft[], cast: CastMember[], title: string): string {
  const head = `Title: ${title || "Untitled"}\nAuthor: Small Bridges\n\n`;
  const body = scenes.map(s => {
    const slug = (s.location || "INT. SCENE").toUpperCase();
    const speaker = cast.find(c => c.id === s.speakerId)?.name?.toUpperCase();
    const blocks = parseDialogueBlocks(s.dialogue);
    const dialogueOut = blocks.length
      ? blocks.map(b => {
          const who = (b.name || speaker || "NARRATOR").toUpperCase();
          const paren = s.parenthetical ? `(${s.parenthetical})\n` : "";
          return `${who}\n${paren}${b.text}`;
        }).join("\n\n")
      : "";
    return [slug, "", s.beat || "", dialogueOut].filter(Boolean).join("\n\n");
  }).join("\n\n");
  return head + body + "\n";
}

// ─── screenplay block ──────────────────────────────────────────────────────

interface ScreenplayBlockProps {
  scene: SceneDraft;
  cast: CastMember[];
  speaker?: CastMember;
  active: boolean;
  warnings: string[];
  highlight?: string; // search term
  onSelect: () => void;
  onPatch: (patch: Partial<SceneDraft>) => void;
  onRemove: () => void;
  onRender: () => void;
  onReassign: (castId: string) => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
}

function ScreenplayBlock({
  scene, cast, speaker, active, warnings, highlight, onSelect, onPatch,
  onRemove, onRender, onReassign, onMove, onDuplicate,
}: ScreenplayBlockProps) {
  const s = statusChip(scene.status);
  const blocks = parseDialogueBlocks(scene.dialogue);
  const wc = wordCount(scene.dialogue) + wordCount(scene.beat);

  // Keyboard shortcuts on focus
  const handleKey = (e: React.KeyboardEvent) => {
    const meta = e.metaKey || e.ctrlKey;
    if (!meta) return;
    if (e.key === "ArrowUp")     { e.preventDefault(); onMove(-1); }
    if (e.key === "ArrowDown")   { e.preventDefault(); onMove(1); }
    if (e.key.toLowerCase() === "d") { e.preventDefault(); onDuplicate(); }
    if (e.key === "Enter")       { e.preventDefault(); onRender(); }
    if (e.key === "Backspace")   { e.preventDefault(); onRemove(); }
  };

  const matchesSearch = highlight
    ? `${scene.location} ${scene.beat} ${scene.dialogue}`.toLowerCase().includes(highlight.toLowerCase())
    : true;

  return (
    <motion.article
      layout
      tabIndex={0}
      onClick={onSelect}
      onFocus={onSelect}
      onKeyDown={handleKey}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: matchesSearch ? 1 : 0.25, y: 0 }}
      className={cn(
        "group relative cursor-text rounded-2xl border bg-[hsl(220,14%,3%)]/80 px-6 py-5 font-mono text-[13px] leading-relaxed outline-none transition-all focus-visible:ring-2 focus-visible:ring-accent/50",
        active
          ? "border-accent/60 shadow-[0_0_0_1px_hsl(215,100%,55%/0.35),0_30px_80px_-40px_hsl(215,100%,55%/0.45)]"
          : "border-white/[0.06] hover:border-white/15",
      )}
    >
      {/* Scene number rail */}
      <div className="absolute -left-3 top-5 hidden flex-col items-center gap-2 md:flex">
        <span className={cn(
          "rounded-md border px-1.5 py-0.5 font-mono text-[9px] tracking-[0.18em]",
          active ? "border-accent/60 bg-accent/10 text-accent" : "border-white/10 bg-black/50 text-white/40",
        )}>
          {String(scene.index + 1).padStart(2, "0")}
        </span>
        <s.Icon className={cn("h-3.5 w-3.5", s.color)} />
      </div>

      {/* SLUGLINE */}
      <input
        value={scene.location}
        onChange={(e) => onPatch({ location: e.target.value })}
        spellCheck={false}
        className="block w-full bg-transparent font-mono text-[12px] font-semibold uppercase tracking-[0.22em] text-white/90 outline-none placeholder:text-white/30"
        placeholder="INT. LOCATION — DAY"
      />

      {/* ACTION */}
      <textarea
        value={scene.beat}
        onChange={(e) => onPatch({ beat: e.target.value })}
        rows={2}
        spellCheck={false}
        className="mt-3 block w-full resize-none bg-transparent font-serif text-[14px] italic leading-relaxed text-white/75 outline-none placeholder:text-white/25"
        placeholder="Describe the action in this beat…"
      />

      {/* DIALOGUE block(s) */}
      {(scene.dialogue || cast.length > 0 || scene.parenthetical) && (
        <div className="mx-auto mt-4 max-w-[60ch]">
          {/* Parsed character cues — display only; real edit is in the textarea below */}
          {blocks.length > 1 && (
            <div className="mb-2 flex flex-wrap items-center justify-center gap-1.5">
              {blocks.map((b, i) => {
                const cueName = b.name || speaker?.name?.toUpperCase() || "NARRATOR";
                const matched = cast.find(c => c.name?.toUpperCase().startsWith(cueName.split(" ")[0]));
                return (
                  <span key={i} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/40 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-white/70">
                    {matched?.imageUrl
                      ? <img src={matched.imageUrl} alt="" className="h-3 w-3 rounded-full object-cover" />
                      : <Mic2 className="h-2.5 w-2.5 text-white/40" />}
                    {cueName}
                  </span>
                );
              })}
            </div>
          )}

          {/* Single-speaker cue */}
          {blocks.length <= 1 && (
            <div className="text-center">
              <div className="relative inline-block">
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="font-mono text-[12px] font-bold uppercase tracking-[0.32em] text-white/90 hover:text-accent"
                >
                  {speaker?.name?.toUpperCase() || "NARRATOR"}
                </button>
                {cast.length > 1 && (
                  <select
                    value={scene.speakerId || ""}
                    onChange={(e) => onReassign(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    aria-label="Reassign speaker"
                  >
                    {cast.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
              </div>
            </div>
          )}

          {/* Parenthetical */}
          <input
            value={scene.parenthetical || ""}
            onChange={(e) => onPatch({ parenthetical: e.target.value })}
            placeholder="(whispered, off-screen, V.O.…)"
            className="mx-auto mt-1 block w-full max-w-[36ch] bg-transparent text-center font-mono text-[11px] italic text-white/50 outline-none placeholder:text-white/25"
          />

          {/* Verbatim dialogue */}
          <textarea
            value={scene.dialogue}
            onChange={(e) => onPatch({ dialogue: e.target.value })}
            rows={Math.max(2, Math.min(10, scene.dialogue.split("\n").length + 1))}
            spellCheck={false}
            className="mt-1.5 block w-full resize-none bg-transparent text-center font-mono text-[13.5px] leading-snug text-white/85 outline-none placeholder:text-white/30"
            placeholder={cast.length ? "Type the line they say, verbatim…  (Use NAME: prefix for multi-character lines)" : "Add cast to write dialogue"}
          />
        </div>
      )}

      {/* Director notes */}
      <input
        value={scene.notes || ""}
        onChange={(e) => onPatch({ notes: e.target.value })}
        placeholder="Director notes (not rendered)…"
        className="mt-3 block w-full bg-transparent text-[11px] italic text-white/35 outline-none placeholder:text-white/20"
      />

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="mt-3 space-y-1 rounded-md border border-amber-500/20 bg-amber-500/[0.04] p-2">
          {warnings.map((wn, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[10px] text-amber-300/80">
              <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" /> {wn}
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.05] pt-3 text-[10px] uppercase tracking-[0.22em] text-white/40">
        <div className="flex flex-wrap items-center gap-1.5">
          <PropSelect value={scene.lens}     options={LENS_OPTIONS} onChange={(v) => onPatch({ lens: v as SceneDraft["lens"] })} />
          <PropSelect value={scene.move}     options={MOVE_OPTIONS} onChange={(v) => onPatch({ move: v as SceneDraft["move"] })} />
          <PropSelect value={`${scene.duration}s`} options={DUR_OPTIONS.map(d => `${d}s`)} onChange={(v) => onPatch({ duration: parseInt(v) as SceneDraft["duration"] })} />
          <span className="ml-2 normal-case tracking-normal text-white/30">· {wc} words</span>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <IconBtn icon={ArrowUp}    label="Move up (⌘↑)"     onClick={() => onMove(-1)} />
          <IconBtn icon={ArrowDown}  label="Move down (⌘↓)"   onClick={() => onMove(1)} />
          <IconBtn icon={Copy}       label="Duplicate (⌘D)"   onClick={onDuplicate} />
          <IconBtn icon={RefreshCw}  label="Render scene (⌘⏎)" onClick={onRender} accent />
          <IconBtn icon={Trash2}     label="Delete (⌘⌫)"      onClick={onRemove} danger />
        </div>
      </div>
    </motion.article>
  );
}

function IconBtn({ icon: Icon, label, onClick, accent, danger }: {
  icon: typeof Trash2; label: string; onClick: () => void; accent?: boolean; danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={label}
      aria-label={label}
      className={cn(
        "rounded-md p-1.5 text-white/60 transition-colors hover:bg-white/10",
        accent && "hover:text-accent",
        danger && "hover:text-red-400",
        !accent && !danger && "hover:text-white",
      )}
    >
      <Icon className="h-3 w-3" />
    </button>
  );
}

function PropSelect({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <span className="relative inline-block">
      <span className="rounded-md border border-white/10 bg-black/40 px-2 py-0.5 normal-case tracking-normal text-white/70">{value}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} onClick={(e) => e.stopPropagation()} className="absolute inset-0 cursor-pointer opacity-0">
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </span>
  );
}

// ─── timeline strip ────────────────────────────────────────────────────────

function Timeline({ scenes, cast, activeId, resolved, onSelect }: {
  scenes: SceneDraft[]; cast: CastMember[]; activeId?: string;
  resolved: Record<string, string | undefined>; onSelect: (id: string) => void;
}) {
  const castMap = useMemo(() => Object.fromEntries(cast.map(c => [c.id, c])), [cast]);
  const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0);
  const dialogueCount = scenes.filter(s => s.dialogue.trim()).length;
  const stripRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the active scene into view
  useEffect(() => {
    if (!activeId || !stripRef.current) return;
    const el = stripRef.current.querySelector<HTMLButtonElement>(`[data-scene="${activeId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeId]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-white/40">
          <Clapperboard className="h-3 w-3 text-accent" /> Story Beat Strip
        </div>
        <div className="mt-2 flex items-baseline gap-4 font-mono">
          <Stat label="scenes" value={scenes.length} />
          <Stat label="runtime" value={`${totalDuration}s`} />
          <Stat label="lines" value={dialogueCount} />
        </div>
      </div>

      {cast.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-white/[0.06] px-4 py-3">
          {cast.map(c => (
            <div key={c.id} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-2 py-1">
              {c.imageUrl
                ? <img src={c.imageUrl} alt="" className="h-4 w-4 rounded-full object-cover" />
                : <div className="h-4 w-4 rounded-full bg-accent/30" />}
              <span className="font-mono text-[10px] uppercase tracking-wider text-white/70">{c.name}</span>
            </div>
          ))}
        </div>
      )}

      <div ref={stripRef} className="flex-1 space-y-1 overflow-y-auto p-2 premium-scroll">
        {scenes.map((scene, idx) => {
          const speaker = scene.speakerId ? castMap[scene.speakerId] : undefined;
          const resolvedId = resolved[scene.id];
          const display = speaker || (resolvedId ? castMap[resolvedId] : undefined);
          const st = statusChip(scene.status);
          const isActive = scene.id === activeId;
          const widthPct = Math.max(15, Math.min(100, (scene.duration / 15) * 100));
          const broken = idx > 0 && scene.chainFromPrevious === false;
          return (
            <div key={scene.id}>
              {broken && (
                <div className="my-1 flex items-center gap-1.5 px-1 text-amber-300/80" title="Independent scene — no chain from previous">
                  <Scissors className="h-2.5 w-2.5" />
                  <div className="h-px flex-1 bg-[repeating-linear-gradient(90deg,hsl(45,93%,58%,0.4)_0_4px,transparent_4px_8px)]" />
                </div>
              )}
              <button
                data-scene={scene.id}
                onClick={() => onSelect(scene.id)}
                className={cn(
                  "group relative flex w-full items-center gap-2 rounded-lg border px-2 py-2 text-left transition-all",
                  isActive
                    ? "border-accent/50 bg-accent/[0.06]"
                    : "border-white/[0.05] bg-black/30 hover:border-white/15 hover:bg-black/50",
                )}
              >
              <span className="font-mono text-[10px] tabular-nums text-white/30">
                {String(scene.index + 1).padStart(2, "0")}
              </span>
              {display?.imageUrl
                ? <img src={display.imageUrl} alt="" className="h-7 w-7 flex-shrink-0 rounded-md object-cover ring-1 ring-white/10" />
                : <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-white/[0.04] ring-1 ring-white/10">
                    <Mic2 className="h-3 w-3 text-white/30" />
                  </div>}
              <div className="min-w-0 flex-1">
                <div className="truncate font-mono text-[10px] uppercase tracking-wider text-white/80">
                  {display?.name || "Narration"}
                </div>
                <div className="truncate font-serif text-[11px] italic text-white/45">
                  {scene.dialogue ? `"${scene.dialogue.split("\n")[0]}"` : scene.beat || "Untitled beat"}
                </div>
                <div className="mt-1 h-[2px] w-full overflow-hidden rounded-full bg-white/[0.06]">
                  <div className={cn(
                    "h-full rounded-full transition-all",
                    scene.status === "done" ? "bg-emerald-400/70"
                    : scene.status === "failed" ? "bg-red-400/70"
                    : isActive ? "bg-accent" : "bg-white/30",
                  )} style={{ width: `${widthPct}%` }} />
                </div>
              </div>
              <st.Icon className={cn("h-3.5 w-3.5 flex-shrink-0", st.color)} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-[20px] font-light text-white">{value}</div>
      <div className="text-[9px] uppercase tracking-[0.22em] text-white/40">{label}</div>
    </div>
  );
}

// ─── chain link / chain-break divider ─────────────────────────────────────
//
// Sits between scene N-1 and scene N. Reflects + toggles
// `scenes[N].chainFromPrevious`. Default = chained (frame + identity carry).
// When broken, scene N renders as a standalone shot — no last-frame inherit,
// no character/environment carry-over. Use for anthologies & hard cuts.
function ChainDivider({ chained, onToggle }: { chained: boolean; onToggle: () => void }) {
  return (
    <div className="relative flex items-center justify-center py-1" aria-label={chained ? "Continuous from previous scene" : "Independent scene — chain broken"}>
      <div className={cn(
        "absolute inset-x-8 top-1/2 h-px -translate-y-1/2",
        chained ? "bg-gradient-to-r from-transparent via-accent/30 to-transparent"
                : "bg-[repeating-linear-gradient(90deg,hsl(0,0%,100%,0.18)_0_6px,transparent_6px_12px)]",
      )} />
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "relative inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.22em] backdrop-blur transition-colors",
          chained
            ? "border-accent/30 bg-accent/[0.08] text-accent/90 hover:border-accent/60"
            : "border-amber-400/30 bg-amber-400/[0.06] text-amber-300/90 hover:border-amber-400/60",
        )}
        title={chained ? "Click to break continuity — make next scene independent" : "Click to chain — inherit previous frame & identity"}
      >
        {chained ? <Link2 className="h-3 w-3" /> : <Scissors className="h-3 w-3" />}
        {chained ? "Continuous" : "Independent scene"}
      </button>
    </div>
  );
}

// ─── read-through teleprompter ─────────────────────────────────────────────

function ReadThrough({ scenes, cast, onClose }: { scenes: SceneDraft[]; cast: CastMember[]; onClose: () => void }) {
  const [i, setI] = useState(0);
  const scene = scenes[i];
  const speaker = scene && cast.find(c => c.id === scene.speakerId);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === " ") setI(v => Math.min(scenes.length - 1, v + 1));
      if (e.key === "ArrowLeft") setI(v => Math.max(0, v - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scenes.length, onClose]);

  if (!scene) return null;
  const blocks = parseDialogueBlocks(scene.dialogue);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col bg-[hsl(220,14%,2%)]/98 backdrop-blur-xl"
    >
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.28em] text-white/50">
          <Play className="h-3 w-3 text-accent" /> Read-through · Scene {i + 1} / {scenes.length}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-white/40">
          <span>← / → to navigate · ESC to exit</span>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-y-auto px-8 py-10">
        <motion.div
          key={scene.id}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl space-y-8 text-center"
        >
          <div className="font-mono text-[12px] uppercase tracking-[0.32em] text-accent/80">{scene.location}</div>
          {scene.beat && (
            <p className="font-serif text-[20px] italic leading-relaxed text-white/60">{scene.beat}</p>
          )}
          {blocks.length === 0 && scene.dialogue && (
            <>
              <div className="font-mono text-[14px] font-bold uppercase tracking-[0.4em] text-white">{speaker?.name?.toUpperCase() || "NARRATOR"}</div>
              {scene.parenthetical && <div className="font-mono text-[13px] italic text-white/50">({scene.parenthetical})</div>}
              <p className="font-serif text-[34px] leading-snug text-white">{scene.dialogue}</p>
            </>
          )}
          {blocks.map((b, k) => (
            <div key={k} className="space-y-3">
              <div className="font-mono text-[14px] font-bold uppercase tracking-[0.4em] text-white">
                {b.name || speaker?.name?.toUpperCase() || "NARRATOR"}
              </div>
              <p className="font-serif text-[30px] leading-snug text-white">{b.text}</p>
            </div>
          ))}
        </motion.div>
      </div>

      <div className="border-t border-white/10 px-6 py-3">
        <div className="mx-auto flex h-1.5 max-w-2xl overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${((i + 1) / scenes.length) * 100}%` }} />
        </div>
      </div>
    </motion.div>
  );
}

// ─── toolbar ───────────────────────────────────────────────────────────────

const STATUSES: Array<{ id: SceneStatus | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "idle", label: "Draft" },
  { id: "queued", label: "Queued" },
  { id: "generating", label: "Rendering" },
  { id: "done", label: "Rendered" },
  { id: "failed", label: "Failed" },
];

function Toolbar({
  search, setSearch, filter, setFilter, words, runtimeSec, pageCount,
  onReadThrough, onExportFountain, onCopyAll, onAddScene,
  chainSummary, onSetAllChain,
}: {
  search: string; setSearch: (v: string) => void;
  filter: SceneStatus | "all"; setFilter: (v: SceneStatus | "all") => void;
  words: number; runtimeSec: number; pageCount: number;
  onReadThrough: () => void; onExportFountain: () => void;
  onCopyAll: () => void; onAddScene: () => void;
  /** "all-chained" | "all-independent" | "mixed" — drives bulk toggle visuals. */
  chainSummary: "all-chained" | "all-independent" | "mixed";
  onSetAllChain: (chained: boolean) => void;
}) {
  return (
    <div className="sticky top-0 z-10 -mx-1 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] bg-[hsl(220,14%,3%)]/95 px-3 py-2 backdrop-blur">
      <div className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-black/40 px-2">
        <Search className="h-3 w-3 text-white/40" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find in script…"
          className="w-40 bg-transparent py-1.5 text-[12px] text-white/80 outline-none placeholder:text-white/30"
        />
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-white/[0.06] bg-black/40 px-1.5 py-0.5">
        <Filter className="h-3 w-3 text-white/40" />
        {STATUSES.map(s => (
          <button
            key={s.id}
            onClick={() => setFilter(s.id)}
            className={cn(
              "rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors",
              filter === s.id ? "bg-accent/15 text-accent" : "text-white/50 hover:text-white",
            )}
          >{s.label}</button>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-white/50">
        <span>{words} words</span>
        <span>·</span>
        <span>{runtimeSec}s runtime</span>
        <span>·</span>
        <span>{pageCount} {pageCount === 1 ? "page" : "pages"}</span>
      </div>

      <div className="flex items-center gap-1">
        {/* Bulk continuity — applies to every scene after the first */}
        <div className="flex items-center gap-0 overflow-hidden rounded-lg border border-white/[0.08] bg-black/40" title="Set continuity for every scene">
          <button
            onClick={() => onSetAllChain(true)}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors",
              chainSummary === "all-chained"
                ? "bg-accent/15 text-accent"
                : "text-white/60 hover:bg-white/[0.04] hover:text-white",
            )}
            title="Chain every scene — inherit previous frame & identity"
          >
            <Link2 className="h-3 w-3" /> All continuous
          </button>
          <div className="h-5 w-px bg-white/10" />
          <button
            onClick={() => onSetAllChain(false)}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors",
              chainSummary === "all-independent"
                ? "bg-amber-400/15 text-amber-300"
                : "text-white/60 hover:bg-white/[0.04] hover:text-white",
            )}
            title="Break every chain — render each scene as a standalone shot"
          >
            <Scissors className="h-3 w-3" /> All independent
          </button>
        </div>
        <button onClick={onReadThrough} className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-black/40 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-white/70 hover:border-accent/50 hover:text-accent">
          <Play className="h-3 w-3" /> Read-through
        </button>
        <button onClick={onCopyAll} className="rounded-lg border border-white/[0.08] bg-black/40 p-1.5 text-white/70 hover:text-white" title="Copy whole script">
          <Copy className="h-3 w-3" />
        </button>
        <button onClick={onExportFountain} className="rounded-lg border border-white/[0.08] bg-black/40 p-1.5 text-white/70 hover:text-white" title="Export .fountain">
          <Download className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ─── public component ──────────────────────────────────────────────────────

interface ScriptBuilderProps {
  scenes: SceneDraft[];
  cast: CastMember[];
  title?: string;
  activeId?: string;
  onSelect: (id: string) => void;
  onPatch: (id: string, patch: Partial<SceneDraft>) => void;
  onRemove: (id: string) => void;
  onRender: (id: string) => void;
  onAutoAssign: (assignments: Array<{ id: string; speakerId: string }>) => void;
  onReorder?: (id: string, dir: -1 | 1) => void;
  onDuplicate?: (id: string) => void;
  onAddScene?: () => void;
}

export function ScriptBuilder({
  scenes, cast, title, activeId, onSelect, onPatch, onRemove, onRender,
  onAutoAssign, onReorder, onDuplicate, onAddScene,
}: ScriptBuilderProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<SceneStatus | "all">("all");
  const [readThrough, setReadThrough] = useState(false);

  const resolved = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    scenes.forEach((s, i) => { map[s.id] = resolveSpeakerId(s, cast, i); });
    return map;
  }, [scenes, cast]);

  const assignedRef = useRef<string>("");
  useEffect(() => {
    if (!cast.length) return;
    const pending = scenes
      .filter(s => !s.speakerId && resolved[s.id])
      .map(s => ({ id: s.id, speakerId: resolved[s.id]! }));
    if (!pending.length) return;
    const sig = pending.map(p => `${p.id}:${p.speakerId}`).join("|");
    if (sig === assignedRef.current) return;
    assignedRef.current = sig;
    onAutoAssign(pending);
  }, [scenes, cast, resolved, onAutoAssign]);

  // Stats
  const totalWords = useMemo(
    () => scenes.reduce((sum, s) => sum + wordCount(s.beat) + wordCount(s.dialogue), 0),
    [scenes],
  );
  const totalRuntime = useMemo(() => scenes.reduce((sum, s) => sum + s.duration, 0), [scenes]);
  // Industry rule: ~250 words per screenplay page
  const pageCount = Math.max(1, Math.ceil(totalWords / 250));

  const filtered = useMemo(
    () => filter === "all" ? scenes : scenes.filter(s => s.status === filter),
    [scenes, filter],
  );

  const handleCopyAll = useCallback(async () => {
    const text = toFountain(scenes, cast, title || "Untitled");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Script copied to clipboard");
    } catch {
      toast.error("Could not copy");
    }
  }, [scenes, cast, title]);

  const handleExportFountain = useCallback(() => {
    const text = toFountain(scenes, cast, title || "Untitled");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(title || "screenplay").toLowerCase().replace(/\s+/g, "-")}.fountain`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported .fountain — opens in Highland, Final Draft, WriterDuet");
  }, [scenes, cast, title]);

  // Bulk continuity: only scenes 2..N participate (scene 1 has no predecessor).
  const chainSummary: "all-chained" | "all-independent" | "mixed" = useMemo(() => {
    const tail = scenes.slice(1);
    if (!tail.length) return "all-chained";
    const broken = tail.filter(s => s.chainFromPrevious === false).length;
    if (broken === 0) return "all-chained";
    if (broken === tail.length) return "all-independent";
    return "mixed";
  }, [scenes]);

  const handleSetAllChain = useCallback((chained: boolean) => {
    const targets = scenes.slice(1).filter(s => (s.chainFromPrevious !== false) !== chained);
    if (!targets.length) {
      toast.message(chained ? "All scenes already continuous" : "All scenes already independent");
      return;
    }
    targets.forEach(s => onPatch(s.id, { chainFromPrevious: chained }));
    toast.success(chained
      ? `Chained ${targets.length} scene${targets.length === 1 ? "" : "s"} — frame & identity will carry across`
      : `Broke ${targets.length} chain${targets.length === 1 ? "" : "s"} — each scene renders standalone`);
  }, [scenes, onPatch]);

  if (!scenes.length) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/10 bg-black/30 p-10 text-center">
        <Sparkles className="mb-3 h-8 w-8 text-accent" />
        <div className="font-display text-lg text-white/90">No script yet</div>
        <p className="mt-2 max-w-xs text-sm text-white/50">
          Run <span className="text-accent">Auto-script</span> to draft a Hollywood-formatted
          screenplay from your brief, then refine every line below.
        </p>
      </div>
    );
  }

  return (
    <>
      <Toolbar
        search={search} setSearch={setSearch}
        filter={filter} setFilter={setFilter}
        words={totalWords} runtimeSec={totalRuntime} pageCount={pageCount}
        onReadThrough={() => setReadThrough(true)}
        onExportFountain={handleExportFountain}
        onCopyAll={handleCopyAll}
        onAddScene={onAddScene || (() => {})}
        chainSummary={chainSummary}
        onSetAllChain={handleSetAllChain}
      />

      <div className="grid h-full gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* LEFT — screenplay */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-white/40">
              <Edit3 className="h-3 w-3 text-accent" />
              Screenplay · verbatim sent to renderer
            </div>
            <div className="font-mono text-[10px] text-white/30">
              {filtered.length}/{scenes.length} scenes · {cast.length} cast
            </div>
          </div>

          <AnimatePresence mode="popLayout">
            {filtered.map((scene, idx) => {
              const prev = idx > 0 ? filtered[idx - 1] : undefined;
              const warns = continuityWarnings(scene, cast, prev);
              const chained = scene.chainFromPrevious !== false;
              return (
                <div key={scene.id} className="space-y-2">
                  {prev && (
                    <ChainDivider
                      chained={chained}
                      onToggle={() => onPatch(scene.id, { chainFromPrevious: !chained })}
                    />
                  )}
                  <ScreenplayBlock
                    scene={scene}
                    cast={cast}
                    speaker={cast.find(c => c.id === (scene.speakerId || resolved[scene.id]))}
                    active={scene.id === activeId}
                    warnings={warns}
                    highlight={search}
                    onSelect={() => onSelect(scene.id)}
                    onPatch={(p) => onPatch(scene.id, p)}
                    onRemove={() => onRemove(scene.id)}
                    onRender={() => onRender(scene.id)}
                    onReassign={(id) => onPatch(scene.id, { speakerId: id })}
                    onMove={(dir) => onReorder?.(scene.id, dir)}
                    onDuplicate={() => onDuplicate?.(scene.id)}
                  />
                </div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* RIGHT — timeline */}
        <aside className="sticky top-16 hidden h-[calc(100vh-260px)] overflow-hidden rounded-2xl border border-white/[0.06] bg-black/40 lg:flex lg:flex-col">
          <Timeline scenes={scenes} cast={cast} activeId={activeId} resolved={resolved} onSelect={onSelect} />
          {!cast.length && (
            <div className="border-t border-white/[0.06] p-3">
              <div className="flex items-start gap-2 rounded-lg bg-amber-500/[0.06] p-2 text-[11px] text-amber-300/80">
                <Users className="mt-0.5 h-3 w-3" />
                <span>Add cast members to assign dialogue speakers.</span>
              </div>
            </div>
          )}
        </aside>
      </div>

      <AnimatePresence>
        {readThrough && <ReadThrough scenes={scenes} cast={cast} onClose={() => setReadThrough(false)} />}
      </AnimatePresence>
    </>
  );
}

export default ScriptBuilder;
