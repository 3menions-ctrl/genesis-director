import {
  ArrowLeft, Save, Download, Loader2, Undo2, Redo2, Scissors, Sparkles,
  Copy, Magnet, Maximize, PanelLeftClose, PanelLeft, Plus, Film, Music, Type,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface EditorToolbarProps {
  title: string;
  onTitleChange: (title: string) => void;
  onSave: () => void;
  onExport: () => void;
  onBack: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onSplit?: () => void;
  onDuplicate?: () => void;
  onFitToView?: () => void;
  onToggleSnap?: () => void;
  onToggleMediaBrowser?: () => void;
  onAddTrack?: (type: "video" | "audio" | "text") => void;
  canUndo?: boolean;
  canRedo?: boolean;
  canSplit?: boolean;
  canDuplicate?: boolean;
  snapEnabled?: boolean;
  showMediaBrowser?: boolean;
  isSaving: boolean;
  renderStatus: string;
  renderProgress: number;
}

/* ─── Small reusable pieces ─── */

const Divider = () => <div className="h-5 w-px bg-border/40 mx-1 shrink-0" />;

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="ml-1.5 px-1 py-0.5 rounded bg-muted/60 text-[9px] font-mono text-muted-foreground/60 border border-border/30 leading-none">
    {children}
  </kbd>
);

const ToolbarTooltip = ({ children, label, shortcut }: { children: React.ReactNode; label: string; shortcut?: string }) => (
  <Tooltip>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent
      side="bottom"
      sideOffset={8}
      className="text-[11px] font-medium bg-popover border-border/60 shadow-xl px-2.5 py-1.5 flex items-center gap-1"
    >
      {label}
      {shortcut && <Kbd>{shortcut}</Kbd>}
    </TooltipContent>
  </Tooltip>
);

const ToolBtn = ({
  onClick, disabled, active, className, children,
}: {
  onClick?: () => void; disabled?: boolean; active?: boolean; className?: string; children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "h-7 w-7 rounded-md flex items-center justify-center transition-all duration-150",
      "text-muted-foreground hover:text-foreground hover:bg-secondary",
      "disabled:opacity-20 disabled:pointer-events-none",
      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
      active && "text-primary bg-primary/10 hover:bg-primary/15 hover:text-primary",
      className,
    )}
  >
    {children}
  </button>
);

/* ─── Toolbar cluster wrapper ─── */
const ToolCluster = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn(
    "flex items-center gap-0.5 rounded-lg p-0.5",
    "bg-secondary/40 border border-border/30",
    className,
  )}>
    {children}
  </div>
);

/* ═══════════════════════════════════════════
   Main Toolbar
   ═══════════════════════════════════════════ */

export const EditorToolbar = ({
  title, onTitleChange, onSave, onExport, onBack,
  onUndo, onRedo, onSplit, onDuplicate, onFitToView, onToggleSnap, onToggleMediaBrowser, onAddTrack,
  canUndo = false, canRedo = false, canSplit = false, canDuplicate = false,
  snapEnabled = true, showMediaBrowser = true,
  isSaving, renderStatus, renderProgress,
}: EditorToolbarProps) => {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="h-12 bg-card/80 backdrop-blur-xl border-b border-border/50 flex items-center gap-1.5 px-2 shrink-0 relative z-20">
        {/* Top highlight line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />

        {/* ── Back ── */}
        <ToolbarTooltip label="Back to projects">
          <ToolBtn onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </ToolBtn>
        </ToolbarTooltip>

        <Divider />

        {/* ── Media panel toggle ── */}
        <ToolbarTooltip label="Media Panel" shortcut="M">
          <ToolBtn onClick={onToggleMediaBrowser} active={showMediaBrowser}>
            {showMediaBrowser ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
          </ToolBtn>
        </ToolbarTooltip>

        <Divider />

        {/* ── Project title ── */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
            <Film className="h-3 w-3 text-primary" />
          </div>
          <Input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            className="max-w-[180px] h-7 text-xs font-semibold bg-transparent border-none text-foreground/80 placeholder:text-muted-foreground/30 focus-visible:ring-0 focus-visible:ring-offset-0 hover:bg-secondary/50 rounded-md px-2 transition-colors"
          />
        </div>

        <Divider />

        {/* ── Edit tools ── */}
        <ToolCluster>
          <ToolbarTooltip label="Undo" shortcut="⌘Z">
            <ToolBtn onClick={onUndo} disabled={!canUndo}>
              <Undo2 className="h-3.5 w-3.5" />
            </ToolBtn>
          </ToolbarTooltip>

          <ToolbarTooltip label="Redo" shortcut="⌘⇧Z">
            <ToolBtn onClick={onRedo} disabled={!canRedo}>
              <Redo2 className="h-3.5 w-3.5" />
            </ToolBtn>
          </ToolbarTooltip>

          <div className="h-4 w-px bg-border/30" />

          <ToolbarTooltip label="Split at playhead" shortcut="S">
            <ToolBtn onClick={onSplit} disabled={!canSplit}>
              <Scissors className="h-3.5 w-3.5" />
            </ToolBtn>
          </ToolbarTooltip>

          <ToolbarTooltip label="Duplicate clip" shortcut="⌘D">
            <ToolBtn onClick={onDuplicate} disabled={!canDuplicate}>
              <Copy className="h-3.5 w-3.5" />
            </ToolBtn>
          </ToolbarTooltip>
        </ToolCluster>

        <Divider />

        {/* ── View tools ── */}
        <ToolCluster>
          <ToolbarTooltip label={`Snap ${snapEnabled ? "On" : "Off"}`} shortcut="N">
            <ToolBtn onClick={onToggleSnap} active={snapEnabled}>
              <Magnet className="h-3.5 w-3.5" />
            </ToolBtn>
          </ToolbarTooltip>

          <ToolbarTooltip label="Fit timeline to view" shortcut="⌘⇧F">
            <ToolBtn onClick={onFitToView}>
              <Maximize className="h-3.5 w-3.5" />
            </ToolBtn>
          </ToolbarTooltip>
        </ToolCluster>

        <Divider />

        {/* ── Add Track ── */}
        <Popover>
          <PopoverTrigger asChild>
            <button className={cn(
              "h-7 px-2.5 rounded-md flex items-center gap-1.5 text-xs font-medium transition-all duration-150",
              "text-muted-foreground hover:text-foreground hover:bg-secondary",
              "border border-transparent hover:border-border/40",
            )}>
              <Plus className="h-3.5 w-3.5" />
              <span>Track</span>
              <ChevronDown className="h-3 w-3 opacity-40" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-44 p-1.5" side="bottom" align="start" sideOffset={8}>
            <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest px-2.5 pt-1 pb-2">
              Add Track
            </p>
            {[
              { type: "video" as const, icon: Film, label: "Video Track", color: "text-primary" },
              { type: "audio" as const, icon: Music, label: "Audio Track", color: "text-success" },
              { type: "text" as const, icon: Type, label: "Text Overlay", color: "text-warning" },
            ].map(({ type, icon: Icon, label, color }) => (
              <button
                key={type}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-all"
                onClick={() => onAddTrack?.(type)}
              >
                <div className={cn("w-5 h-5 rounded flex items-center justify-center bg-secondary/60", color)}>
                  <Icon className="h-3 w-3" />
                </div>
                {label}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        {/* ── Spacer ── */}
        <div className="flex-1" />

        {/* ── Render progress ── */}
        {renderStatus === "rendering" && (
          <div className="flex items-center gap-2.5 mr-2 animate-in fade-in duration-300">
            <div className="relative">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <div className="absolute inset-0 blur-lg bg-primary/20 animate-pulse" />
            </div>
            <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary via-primary/80 to-accent rounded-full transition-all duration-700 ease-out"
                style={{ width: `${renderProgress}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums font-mono">{renderProgress}%</span>
          </div>
        )}

        {renderStatus === "completed" && (
          <div className="flex items-center gap-1.5 mr-2 animate-in fade-in duration-300">
            <Sparkles className="h-3.5 w-3.5 text-success" />
            <span className="text-[11px] text-success font-semibold">Ready</span>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={onSave}
            disabled={isSaving}
            className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground gap-1.5 rounded-lg font-medium"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </Button>

          <Button
            size="sm"
            onClick={onExport}
            disabled={renderStatus === "rendering"}
            className={cn(
              "h-8 px-4 text-xs font-semibold rounded-lg gap-1.5 transition-all duration-200",
              "bg-foreground text-background hover:bg-foreground/90",
              "shadow-[0_0_20px_hsl(var(--foreground)/0.08)] hover:shadow-[0_0_28px_hsl(var(--foreground)/0.12)]",
              "border border-foreground/10",
            )}
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
};
