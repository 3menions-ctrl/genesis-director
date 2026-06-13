/**
 * TopStatusBar — the floating chrome that sits at the top of the
 * Editor across every view. Pure typography on the ProjectBackdrop —
 * no cards, no borders, no pills.
 *
 * Layout (left → right):
 *   - Back link to /library with the underline-on-hover treatment
 *   - Pulsing accent dot + project title (italic Fraunces) + status
 *     ◆ eyebrow (mono uppercase)
 *   - ViewSwitcher (centered visually but right-anchored in flow on
 *     wide screens, will move to its own row on narrow)
 *   - Aspect ratio + duration pill (typography only) on the far right
 */
import { Link } from "react-router-dom";
import { ArrowLeft, Download, Eye, MessageCircle, Sparkles, GitBranch, Wand2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";
import type { EditorProject, EditorView } from "@/lib/editor/types";
import { ASPECT_RATIOS } from "@/lib/editor/types";
import { ViewSwitcher } from "./ViewSwitcher";

interface Props {
  project: EditorProject | null;
  view: EditorView;
  onViewChange: (view: EditorView) => void;
  onOpenExport: () => void;
  onToggleComments: () => void;
  onOpenDirector?: () => void;
  onOpenVersions?: () => void;
  onOpenLibrary?: () => void;
  onOpenCreate?: () => void;
  presenceCount: number;
}

function fmtDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TopStatusBar({
  project,
  view,
  onViewChange,
  onOpenExport,
  onToggleComments,
  onOpenDirector,
  onOpenVersions,
  onOpenLibrary,
  onOpenCreate,
  presenceCount,
}: Props) {
  return (
    <header className="relative z-30 px-6 pt-6 pb-5 sm:px-9 lg:px-12">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* LEFT — back + identity */}
        <div className="flex items-center gap-5 min-w-0">
          <Link
            to="/library"
            className="group/back inline-flex items-center gap-1.5 text-[13px] text-muted-foreground/65 hover:text-foreground transition-colors"
          >
            <ArrowLeft
              className="h-3.5 w-3.5 transition-transform group-hover/back:-translate-x-0.5"
              strokeWidth={1.5}
            />
            <span className="relative">
              Library
              <span
                aria-hidden
                className="absolute -bottom-1 left-0 right-0 h-px origin-left scale-x-0 bg-foreground/70 transition-transform duration-500 group-hover/back:scale-x-100"
              />
            </span>
          </Link>

          {/* Pulsing accent + project title */}
          <div className="min-w-0">
            <div
              className={cn(
                TYPE_META,
                "text-muted-foreground/55 tracking-[0.34em] flex items-center gap-2",
              )}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inset-0 rounded-full bg-accent/60 animate-ping opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
              </span>
              <span className="truncate">
                ◆ Cutting room
                {project ? ` · ${project.status}` : " · loading"}
              </span>
            </div>
            <h1
              className="mt-1 font-display italic font-light leading-[1.05] tracking-tight truncate"
              style={{
                fontFamily: "'Fraunces', serif",
                fontSize: "clamp(1.4rem, 2.4vw, 1.9rem)",
              }}
            >
              <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/65 bg-clip-text text-transparent">
                {project?.title ?? "Untitled."}
              </span>
            </h1>
          </div>
        </div>

        {/* CENTER — view switcher */}
        <div className="flex justify-center">
          <ViewSwitcher view={view} onChange={onViewChange} />
        </div>

        {/* RIGHT — aspect / duration / export */}
        <div className="flex items-center gap-5 lg:justify-end shrink-0">
          {project && (
            <>
              <div className="text-right">
                <div className={cn(TYPE_META, "text-muted-foreground/55")}>
                  Aspect
                </div>
                <div className="font-mono text-[13px] tabular-nums text-foreground/85">
                  {project.aspectRatio}
                  <span className="text-muted-foreground/45 ml-1.5">
                    {ASPECT_RATIOS[project.aspectRatio].label}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className={cn(TYPE_META, "text-muted-foreground/55")}>
                  Runtime
                </div>
                <div className="font-mono text-[13px] tabular-nums text-foreground/85">
                  {fmtDuration(project.durationSec)}
                </div>
              </div>
              {/* Presence chip — N people viewing (incl. self) */}
              {presenceCount > 1 && (
                <div className="inline-flex items-center gap-1.5 text-foreground/80">
                  <Eye className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
                  <span className="font-mono text-[12.5px] tabular-nums">{presenceCount}</span>
                  <span className={cn(TYPE_META, "text-muted-foreground/55")}>viewing</span>
                </div>
              )}
              {onOpenCreate && (
                <button
                  type="button"
                  onClick={onOpenCreate}
                  className="group/new inline-flex items-center gap-2 text-[13px] text-accent hover:text-foreground transition-colors"
                  aria-label="Add clip (N)"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
                  <span className="relative">
                    Create
                    <span
                      aria-hidden
                      className="absolute -bottom-1 left-0 right-0 h-px origin-left scale-x-0 bg-accent/60 transition-transform duration-500 group-hover/new:scale-x-100"
                    />
                  </span>
                  <span className={cn(TYPE_META, "text-muted-foreground/40 font-mono")}>N</span>
                </button>
              )}
              {onOpenLibrary && (
                <button
                  type="button"
                  onClick={onOpenLibrary}
                  className="group/lib inline-flex items-center gap-2 text-[13px] text-foreground/80 hover:text-accent transition-colors"
                  aria-label="Studio library (Shift+L)"
                >
                  <Wand2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                  <span className="relative">
                    Library
                    <span
                      aria-hidden
                      className="absolute -bottom-1 left-0 right-0 h-px origin-left scale-x-0 bg-accent/60 transition-transform duration-500 group-hover/lib:scale-x-100"
                    />
                  </span>
                  <span className={cn(TYPE_META, "text-muted-foreground/40 font-mono")}>⇧L</span>
                </button>
              )}
              {onOpenDirector && (
                <button
                  type="button"
                  onClick={onOpenDirector}
                  className="group/dir inline-flex items-center gap-2 text-[13px] text-foreground/80 hover:text-accent transition-colors"
                  aria-label="Director chat (Cmd+/)"
                >
                  <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
                  <span className="relative">
                    Director
                    <span
                      aria-hidden
                      className="absolute -bottom-1 left-0 right-0 h-px origin-left scale-x-0 bg-accent/60 transition-transform duration-500 group-hover/dir:scale-x-100"
                    />
                  </span>
                  <span className={cn(TYPE_META, "text-muted-foreground/40 font-mono")}>⌘/</span>
                </button>
              )}
              {onOpenVersions && (
                <button
                  type="button"
                  onClick={onOpenVersions}
                  className="group/ver inline-flex items-center gap-2 text-[13px] text-foreground/80 hover:text-foreground transition-colors"
                  aria-label="Versions (Cmd+Shift+V)"
                >
                  <GitBranch className="h-3.5 w-3.5" strokeWidth={1.5} />
                  <span className="relative">
                    Versions
                    <span
                      aria-hidden
                      className="absolute -bottom-1 left-0 right-0 h-px origin-left scale-x-0 bg-foreground/70 transition-transform duration-500 group-hover/ver:scale-x-100"
                    />
                  </span>
                  <span className={cn(TYPE_META, "text-muted-foreground/40 font-mono")}>⌘⇧V</span>
                </button>
              )}
              <button
                type="button"
                onClick={onToggleComments}
                className="group/com inline-flex items-center gap-2 text-[13px] text-foreground/80 hover:text-foreground transition-colors"
                aria-label="Toggle comments (C)"
              >
                <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.5} />
                <span className="relative">
                  Comments
                  <span
                    aria-hidden
                    className="absolute -bottom-1 left-0 right-0 h-px origin-left scale-x-0 bg-foreground/70 transition-transform duration-500 group-hover/com:scale-x-100"
                  />
                </span>
                <span className={cn(TYPE_META, "text-muted-foreground/40 font-mono")}>C</span>
              </button>
              <button
                type="button"
                onClick={onOpenExport}
                className="group/exp inline-flex items-center gap-2 text-[13px] text-accent transition-colors hover:text-foreground"
                aria-label="Open export panel (E)"
              >
                <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
                <span className="relative">
                  Export
                  <span
                    aria-hidden
                    className="absolute -bottom-1 left-0 right-0 h-px origin-left scale-x-0 bg-accent/60 transition-transform duration-500 group-hover/exp:scale-x-100"
                  />
                </span>
                <span className={cn(TYPE_META, "text-muted-foreground/40 font-mono")}>E</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
