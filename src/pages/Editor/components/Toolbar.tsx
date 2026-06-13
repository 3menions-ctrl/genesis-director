/**
 * Toolbar — floating chip-row above the Timeline. Visualises the
 * active tool (selection / blade / hand) plus quick-access actions
 * (snap toggle, marker, in/out, clear in/out).
 *
 * Buttons mirror real keyboard shortcuts so the toolbar is also the
 * teaching surface for keyboard users.
 */
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";
import {
  MousePointer2,
  Scissors,
  Hand,
  Magnet,
  Flag,
  Brackets,
} from "lucide-react";
import type { TimelineTool } from "@/lib/editor/types";
import {
  setTool,
  toggleSnap,
  addMarkerAtPlayhead,
  setInPoint,
  setOutPoint,
  clearInOut,
} from "@/lib/editor/store";

interface Props {
  tool: TimelineTool;
  snapEnabled: boolean;
  hasInOut: boolean;
  playheadSec: number;
}

export function Toolbar({ tool, snapEnabled, hasInOut, playheadSec }: Props) {
  return (
    <div className="flex items-center gap-1.5">
      {/* Tools */}
      <ToolButton
        active={tool === "select"}
        Icon={MousePointer2}
        label="Select"
        keyHint="V"
        onClick={() => setTool("select")}
      />
      <ToolButton
        active={tool === "blade"}
        Icon={Scissors}
        label="Blade"
        keyHint="B"
        onClick={() => setTool("blade")}
      />
      <ToolButton
        active={tool === "hand"}
        Icon={Hand}
        label="Hand"
        keyHint="H"
        onClick={() => setTool("hand")}
      />

      {/* Divider */}
      <span className="mx-1.5 h-5 w-px bg-white/[0.06]" />

      {/* Snap toggle */}
      <ToolButton
        active={snapEnabled}
        Icon={Magnet}
        label="Snap"
        keyHint="N"
        onClick={() => toggleSnap()}
      />

      {/* Marker */}
      <ToolButton
        Icon={Flag}
        label="Marker"
        keyHint="M"
        onClick={() => addMarkerAtPlayhead()}
      />

      {/* In / Out */}
      <ToolButton
        Icon={Brackets}
        label="In"
        keyHint="I"
        onClick={() => setInPoint(playheadSec)}
      />
      <ToolButton
        Icon={Brackets}
        iconReversed
        label="Out"
        keyHint="O"
        onClick={() => setOutPoint(playheadSec)}
      />
      {hasInOut && (
        <button
          type="button"
          onClick={() => clearInOut()}
          className={cn(
            TYPE_META,
            "ml-1 px-1.5 h-7 inline-flex items-center text-muted-foreground/55 hover:text-foreground rounded transition-colors",
          )}
        >
          clear ↺
        </button>
      )}
    </div>
  );
}

function ToolButton({
  active,
  Icon,
  label,
  keyHint,
  onClick,
  iconReversed,
}: {
  active?: boolean;
  Icon: typeof MousePointer2;
  label: string;
  keyHint: string;
  onClick: () => void;
  iconReversed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${label} (${keyHint})`}
      aria-label={`${label} (${keyHint})`}
      className={cn(
        "group/tool relative inline-flex items-center justify-center h-7 w-7 rounded-md transition-all",
        active
          ? "bg-[hsl(var(--accent)/0.18)] ring-1 ring-inset ring-accent/55 text-accent"
          : "text-muted-foreground/65 hover:text-foreground hover:bg-white/[0.04]",
      )}
    >
      <Icon
        className="h-3.5 w-3.5"
        strokeWidth={1.6}
        style={iconReversed ? { transform: "scaleX(-1)" } : undefined}
      />
      <span
        className={cn(
          "pointer-events-none absolute -bottom-5 left-1/2 -translate-x-1/2",
          TYPE_META,
          "text-muted-foreground/35 font-mono",
        )}
      >
        {keyHint}
      </span>
    </button>
  );
}
