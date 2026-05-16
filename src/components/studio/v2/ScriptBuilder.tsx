/**
 * ScriptBuilder — Hollywood-style screenplay + character timeline.
 *
 * LEFT  · formatted screenplay (Courier-style: SLUGLINE → action → CHARACTER →
 *         parenthetical → dialogue). Every field is inline-editable so the
 *         text the user types is the EXACT text shipped to the renderer
 *         (per the verbatim-script preservation rule).
 *
 * RIGHT · scene timeline strip with avatar chips per scene, showing who
 *         speaks, the duration, and the render status. Click a chip to
 *         reassign the speaker. Hover to scrub-jump between scenes.
 *
 * Auto-assignment: scenes with dialogue but no speakerId resolve to the
 * cast member whose NAME is mentioned in the beat/dialogue (case-insensitive
 * whole-word match). Otherwise we round-robin across the cast so two-character
 * conversations alternate organically.
 */
import { useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2, Circle, Clapperboard, Edit3, Loader2, Mic2,
  RefreshCw, Trash2, Users, AlertTriangle, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CastMember, SceneDraft } from "./types";

// ─── helpers ────────────────────────────────────────────────────────────────

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

function statusChip(s: SceneDraft["status"]) {
  switch (s) {
    case "done":       return { Icon: CheckCircle2, color: "text-emerald-400", label: "Rendered" };
    case "generating": return { Icon: Loader2,      color: "text-accent animate-spin", label: "Rendering" };
    case "queued":     return { Icon: Loader2,      color: "text-accent/80 animate-spin", label: "Queued" };
    case "failed":     return { Icon: AlertTriangle, color: "text-red-400", label: "Failed" };
    default:           return { Icon: Circle,       color: "text-white/30", label: "Draft" };
  }
}

function formatSlug(loc: string) {
  const cleaned = (loc || "SCENE").toUpperCase().replace(/\s+/g, " ").trim();
  return cleaned.startsWith("INT") || cleaned.startsWith("EXT") ? cleaned : `INT. ${cleaned}`;
}

// ─── screenplay block (left side) ──────────────────────────────────────────

interface ScreenplayBlockProps {
  scene: SceneDraft;
  cast: CastMember[];
  speaker?: CastMember;
  active: boolean;
  onSelect: () => void;
  onPatch: (patch: Partial<SceneDraft>) => void;
  onRemove: () => void;
  onRender: () => void;
  onReassign: (castId: string) => void;
}

function ScreenplayBlock({
  scene, cast, speaker, active, onSelect, onPatch, onRemove, onRender, onReassign,
}: ScreenplayBlockProps) {
  const s = statusChip(scene.status);
  return (
    <motion.article
      layout
      onClick={onSelect}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "group relative cursor-text rounded-2xl border bg-[hsl(220,14%,3%)]/80 px-6 py-5 font-mono text-[13px] leading-relaxed transition-all",
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
        onFocus={onSelect}
        spellCheck={false}
        className="block w-full bg-transparent font-mono text-[12px] font-semibold uppercase tracking-[0.22em] text-white/90 outline-none placeholder:text-white/30"
        placeholder="INT. LOCATION — DAY"
      />

      {/* ACTION */}
      <textarea
        value={scene.beat}
        onChange={(e) => onPatch({ beat: e.target.value })}
        onFocus={onSelect}
        rows={2}
        spellCheck={false}
        className="mt-3 block w-full resize-none bg-transparent font-serif text-[14px] italic leading-relaxed text-white/75 outline-none placeholder:text-white/25"
        placeholder="Describe the action in this beat…"
      />

      {/* CHARACTER + DIALOGUE — only when there's something to say or cast exists */}
      {(scene.dialogue || cast.length > 0) && (
        <div className="mx-auto mt-4 max-w-[60ch] text-center">
          {/* character cue with reassign menu */}
          <div className="relative inline-block">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onSelect(); }}
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
          <textarea
            value={scene.dialogue}
            onChange={(e) => onPatch({ dialogue: e.target.value })}
            onFocus={onSelect}
            rows={Math.max(1, Math.ceil((scene.dialogue || "").length / 60))}
            spellCheck={false}
            className="mt-1.5 block w-full resize-none bg-transparent text-center font-mono text-[13.5px] leading-snug text-white/85 outline-none placeholder:text-white/30"
            placeholder={cast.length ? "Type the line they say, verbatim…" : "Add cast to write dialogue"}
          />
        </div>
      )}

      {/* Footer: lens · move · duration · actions */}
      <div className="mt-4 flex items-center justify-between border-t border-white/[0.05] pt-3 text-[10px] uppercase tracking-[0.22em] text-white/40">
        <div className="flex items-center gap-3">
          <span>{scene.lens}</span>
          <span>·</span>
          <span>{scene.move}</span>
          <span>·</span>
          <span>{scene.duration}s</span>
        </div>
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button onClick={(e) => { e.stopPropagation(); onRender(); }} className="rounded-md p-1 text-white/60 hover:bg-white/10 hover:text-accent" title="Render this scene">
            <RefreshCw className="h-3 w-3" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="rounded-md p-1 text-white/60 hover:bg-white/10 hover:text-red-400" title="Remove scene">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </motion.article>
  );
}

// ─── timeline strip (right side) ───────────────────────────────────────────

interface TimelineProps {
  scenes: SceneDraft[];
  cast: CastMember[];
  activeId?: string;
  resolved: Record<string, string | undefined>;
  onSelect: (id: string) => void;
}

function Timeline({ scenes, cast, activeId, resolved, onSelect }: TimelineProps) {
  const castMap = useMemo(() => Object.fromEntries(cast.map(c => [c.id, c])), [cast]);
  const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0);
  const dialogueCount = scenes.filter(s => s.dialogue.trim()).length;

  return (
    <div className="flex h-full flex-col">
      {/* Stat header */}
      <div className="border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-white/40">
          <Clapperboard className="h-3 w-3 text-accent" />
          Story Beat Strip
        </div>
        <div className="mt-2 flex items-baseline gap-4 font-mono">
          <div>
            <div className="text-[20px] font-light text-white">{scenes.length}</div>
            <div className="text-[9px] uppercase tracking-[0.22em] text-white/40">scenes</div>
          </div>
          <div>
            <div className="text-[20px] font-light text-white">{totalDuration}<span className="text-[12px] text-white/40">s</span></div>
            <div className="text-[9px] uppercase tracking-[0.22em] text-white/40">runtime</div>
          </div>
          <div>
            <div className="text-[20px] font-light text-white">{dialogueCount}</div>
            <div className="text-[9px] uppercase tracking-[0.22em] text-white/40">lines</div>
          </div>
        </div>
      </div>

      {/* Cast legend */}
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

      {/* Beat strip */}
      <div className="flex-1 space-y-1 overflow-y-auto p-2 premium-scroll">
        {scenes.map((scene) => {
          const speaker = scene.speakerId ? castMap[scene.speakerId] : undefined;
          const resolvedId = resolved[scene.id];
          const resolvedSpeaker = resolvedId ? castMap[resolvedId] : undefined;
          const display = speaker || resolvedSpeaker;
          const st = statusChip(scene.status);
          const isActive = scene.id === activeId;
          // bar width as a function of duration (5/10/15)
          const widthPct = Math.max(15, Math.min(100, (scene.duration / 15) * 100));
          return (
            <button
              key={scene.id}
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
                  </div>
              }
              <div className="min-w-0 flex-1">
                <div className="truncate font-mono text-[10px] uppercase tracking-wider text-white/80">
                  {display?.name || "Narration"}
                </div>
                <div className="truncate font-serif text-[11px] italic text-white/45">
                  {scene.dialogue ? `"${scene.dialogue}"` : scene.beat || "Untitled beat"}
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
          );
        })}
      </div>
    </div>
  );
}

// ─── public component ──────────────────────────────────────────────────────

interface ScriptBuilderProps {
  scenes: SceneDraft[];
  cast: CastMember[];
  activeId?: string;
  onSelect: (id: string) => void;
  onPatch: (id: string, patch: Partial<SceneDraft>) => void;
  onRemove: (id: string) => void;
  onRender: (id: string) => void;
  /** Bulk patch used to back-fill auto-assigned speaker IDs into state. */
  onAutoAssign: (assignments: Array<{ id: string; speakerId: string }>) => void;
}

export function ScriptBuilder({
  scenes, cast, activeId, onSelect, onPatch, onRemove, onRender, onAutoAssign,
}: ScriptBuilderProps) {
  // Compute resolved speakers (without mutating) — used by both columns and
  // back-filled into draft state once on mount / when cast changes so the
  // renderer sees the assignment.
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
    <div className="grid h-full gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* LEFT — screenplay column */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-white/40">
            <Edit3 className="h-3 w-3 text-accent" />
            Screenplay · verbatim sent to renderer
          </div>
          <div className="font-mono text-[10px] text-white/30">{cast.length} cast · {scenes.length} sc.</div>
        </div>
        <div className="space-y-3">
          {scenes.map(scene => (
            <ScreenplayBlock
              key={scene.id}
              scene={scene}
              cast={cast}
              speaker={cast.find(c => c.id === (scene.speakerId || resolved[scene.id]))}
              active={scene.id === activeId}
              onSelect={() => onSelect(scene.id)}
              onPatch={(p) => onPatch(scene.id, p)}
              onRemove={() => onRemove(scene.id)}
              onRender={() => onRender(scene.id)}
              onReassign={(id) => onPatch(scene.id, { speakerId: id })}
            />
          ))}
        </div>
      </div>

      {/* RIGHT — timeline column */}
      <aside className="sticky top-2 hidden h-[calc(100vh-220px)] overflow-hidden rounded-2xl border border-white/[0.06] bg-black/40 lg:flex lg:flex-col">
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
  );
}

export default ScriptBuilder;