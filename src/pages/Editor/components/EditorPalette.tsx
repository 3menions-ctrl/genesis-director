/**
 * EditorPalette — Cmd+P opens an inline fuzzy-search command bar.
 *
 * Searches across:
 *   - Views (Stage / Timeline / Script / Storyboard)
 *   - Actions (Export, Comments, Help, Regenerate selected clip)
 *   - Clips by prompt
 *   - Scenes by title
 *
 * Picking a clip selects it + seeks the playhead to its start.
 * Picking a scene selects it + switches to Storyboard.
 *
 * This is the editor's own palette, distinct from the global
 * Cmd+K Command Center — keeps editor concerns out of the global
 * surface and vice versa.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Film,
  Scissors,
  Layers,
  Sparkles,
  MessageCircle,
  Download,
  Keyboard,
  Wand2,
  CornerDownLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";
import { Surface, SurfaceFooter } from "./Surface";
import type { EditorClip, EditorProject, EditorView } from "@/lib/editor/types";
import { selectClip, selectScene, setPlayhead, setView } from "@/lib/editor/store";

type Cmd =
  | { kind: "view"; id: EditorView; label: string; sub: string; Icon: typeof Film }
  | { kind: "action"; id: string; label: string; sub: string; Icon: typeof Film; run: () => void }
  | { kind: "clip"; id: string; label: string; sub: string; clip: EditorClip }
  | { kind: "scene"; id: string; label: string; sub: string; sceneId: string };

interface Props {
  project: EditorProject;
  open: boolean;
  onClose: () => void;
  onOpenExport: () => void;
  onOpenComments: () => void;
  onOpenHelp: () => void;
}

export function EditorPalette({
  project,
  open,
  onClose,
  onOpenExport,
  onOpenComments,
  onOpenHelp,
}: Props) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelected(0);
    setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  // Build the unfiltered command list once per project
  const all: Cmd[] = useMemo(() => {
    const list: Cmd[] = [
      { kind: "view", id: "stage", label: "Go to Stage", sub: "Cinematic player", Icon: Film },
      { kind: "view", id: "timeline", label: "Go to Timeline", sub: "Magnetic editor", Icon: Scissors },
      { kind: "view", id: "script", label: "Go to Script", sub: "Screenplay editor", Icon: Layers },
      { kind: "view", id: "storyboard", label: "Go to Storyboard", sub: "Scene cards", Icon: Sparkles },
      {
        kind: "action",
        id: "export",
        label: "Open export panel",
        sub: "Render in every aspect",
        Icon: Download,
        run: onOpenExport,
      },
      {
        kind: "action",
        id: "comments",
        label: "Open comments",
        sub: "Notes pinned to timecodes",
        Icon: MessageCircle,
        run: onOpenComments,
      },
      {
        kind: "action",
        id: "library",
        label: "Back to Library",
        sub: "Pick a different project",
        Icon: Film,
        run: () => navigate("/library"),
      },
      {
        kind: "action",
        id: "help",
        label: "Keyboard shortcuts",
        sub: "Every key, one sheet",
        Icon: Keyboard,
        run: onOpenHelp,
      },
    ];

    for (const s of project.scenes) {
      list.push({
        kind: "scene",
        id: `scene-${s.id}`,
        label: `Scene ${s.number} — ${s.title}`,
        sub: [s.timeOfDay, s.mood].filter(Boolean).join(" · ") || "Scene",
        sceneId: s.id,
      });
      for (const c of s.clips) {
        list.push({
          kind: "clip",
          id: `clip-${c.id}`,
          label: `Clip ${String(c.index + 1).padStart(2, "0")} — ${c.prompt}`,
          sub: `${c.durationSec.toFixed(1)}s · take ${c.takes[0]?.takeNumber ?? 1}`,
          clip: c,
        });
      }
    }
    return list;
  }, [project, onOpenExport, onOpenComments, onOpenHelp, navigate]);

  // Tiny fuzzy filter — substring match across label + sub
  const filtered: Cmd[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all.slice(0, 40);
    return all
      .filter((c) => {
        const hay = `${c.label} ${c.sub}`.toLowerCase();
        return q.split(/\s+/).every((tok) => hay.includes(tok));
      })
      .slice(0, 40);
  }, [query, all]);

  useEffect(() => {
    if (selected >= filtered.length) setSelected(0);
  }, [filtered.length, selected]);

  const execute = (cmd: Cmd) => {
    onClose();
    switch (cmd.kind) {
      case "view":
        setView(cmd.id);
        return;
      case "action":
        cmd.run();
        return;
      case "clip":
        setView("timeline");
        selectClip(cmd.clip.id);
        setPlayhead(cmd.clip.timelineStartSec);
        return;
      case "scene":
        setView("storyboard");
        selectScene(cmd.sceneId);
        return;
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = filtered[selected];
      if (cmd) execute(cmd);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  // Keep selected row in view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const el = list.children[selected] as HTMLElement | undefined;
    if (!el) return;
    const top = el.offsetTop;
    const bottom = top + el.offsetHeight;
    const viewTop = list.scrollTop;
    const viewBottom = viewTop + list.clientHeight;
    if (top < viewTop) list.scrollTop = top - 4;
    else if (bottom > viewBottom) list.scrollTop = bottom - list.clientHeight + 4;
  }, [selected]);

  return (
    <Surface open={open} onClose={onClose} size="md" blockEscClose>
      {/* Search field */}
      <div className="relative shrink-0 px-6 pt-5 pb-3 flex items-center gap-3">
        <Search className="h-4 w-4 text-muted-foreground/60" strokeWidth={1.5} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Direct anywhere…"
          className={cn(
            "flex-1 bg-transparent outline-none",
            "text-[16px] text-foreground placeholder:text-foreground/35",
            "font-display italic font-light",
          )}
          style={{ fontFamily: "'Fraunces', serif" }}
        />
        <span className={cn(TYPE_META, "text-muted-foreground/45 font-mono")}>
          ⌘ P
        </span>
        <span
          aria-hidden
          className="absolute left-6 right-6 bottom-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent"
        />
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <p className={cn(TYPE_META, "text-muted-foreground/55")}>
            No matches.
          </p>
        </div>
      ) : (
        <ul
          ref={listRef}
          className="flex-1 min-h-0 overflow-y-auto scrollbar-hide py-2"
        >
          {filtered.map((cmd, i) => (
            <CommandRow
              key={cmd.id}
              cmd={cmd}
              active={i === selected}
              onClick={() => execute(cmd)}
              onHover={() => setSelected(i)}
            />
          ))}
        </ul>
      )}

      <SurfaceFooter>
        <span>{filtered.length} {filtered.length === 1 ? "result" : "results"}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd><Kbd>↓</Kbd>
            <span className="ml-0.5">move</span>
          </span>
          <span className="flex items-center gap-1">
            <Kbd><CornerDownLeft className="h-2.5 w-2.5" strokeWidth={2.2} /></Kbd>
            <span>open</span>
          </span>
          <span className="flex items-center gap-1">
            <Kbd>Esc</Kbd>
            <span>close</span>
          </span>
        </span>
      </SurfaceFooter>
    </Surface>
  );
}

function CommandRow({
  cmd,
  active,
  onClick,
  onHover,
}: {
  cmd: Cmd;
  active: boolean;
  onClick: () => void;
  onHover: () => void;
}) {
  const Icon: typeof Film =
    cmd.kind === "view" ? cmd.Icon
    : cmd.kind === "action" ? cmd.Icon
    : cmd.kind === "clip" ? Wand2
    : Sparkles;
  return (
    <li
      onMouseEnter={onHover}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg cursor-pointer transition-colors",
        active ? "bg-white/[0.06]" : "hover:bg-white/[0.03]",
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          active ? "text-accent" : "text-muted-foreground/65",
        )}
        strokeWidth={1.5}
      />
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] text-foreground/95 truncate">
          {cmd.label}
        </div>
        <div className={cn(TYPE_META, "text-muted-foreground/55 truncate")}>
          {cmd.sub}
        </div>
      </div>
      {active && (
        <CornerDownLeft className="h-3 w-3 text-accent/65" strokeWidth={2} />
      )}
    </li>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1",
        "font-mono text-[10px] tabular-nums",
        "rounded border border-white/[0.10] bg-white/[0.03] text-foreground/85",
      )}
    >
      {children}
    </span>
  );
}
