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

const Divider = () => <div className="h-5 w-px bg-white/[0.06] mx-0.5 shrink-0" />;

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="ml-1.5 px-1 py-0.5 rounded bg-white/10 text-[9px] font-mono text-white/50 border border-white/[0.08] leading-none">
    {children}
  </kbd>
);

const ToolbarTooltip = ({ children, label, shortcut }: { children: React.ReactNode; label: string; shortcut?: string }) => (
  <Tooltip>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent
      side="bottom"
      sideOffset={8}
      className="text-[11px] font-medium bg-[hsl(0,0%,10%)] border-white/10 text-white shadow-2xl px-2.5 py-1.5 flex items-center gap-1"
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
      "h-8 w-8 rounded-lg flex items-center justify-center transition-all duration-200",
      "text-white/50 hover:text-white hover:bg-white/[0.08]",
      "disabled:opacity-20 disabled:pointer-events-none",
      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20",
      active && "text-white bg-white/[0.12] hover:bg-white/[0.15]",
      className,
    )}
  >
    {children}
  </button>
);

const ToolCluster = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn(
    "flex items-center gap-0.5 rounded-xl p-0.5",
    "bg-white/[0.03] border border-white/[0.06]",
    className,
  )}>
    {children}
  </div>
);

export const EditorToolbar = ({
  title, onTitleChange, onSave, onExport, onBack,
  onUndo, onRedo, onSplit, onDuplicate, onFitToView, onToggleSnap, onToggleMediaBrowser, onAddTrack,
  canUndo = false, canRedo = false, canSplit = false, canDuplicate = false,
  snapEnabled = true, showMediaBrowser = true,
  isSaving, renderStatus, renderProgress,
}: EditorToolbarProps) => {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="h-14 bg-[hsl(0,0%,6%)] border-b border-white/[0.06] flex items-center gap-2 px-3 shrink-0 relative z-20">
        {/* Top accent line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

        <ToolbarTooltip label="Back to projects">
          <ToolBtn onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </ToolBtn>
        </ToolbarTooltip>

        <Divider />

        <ToolbarTooltip label="Media Panel" shortcut="M">
          <ToolBtn onClick={onToggleMediaBrowser} active={showMediaBrowser}>
            {showMediaBrowser ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
          </ToolBtn>
        </ToolbarTooltip>

        <Divider />

        {/* Project title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shrink-0">
            <Film className="h-3.5 w-3.5 text-primary" />
          </div>
          <Input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            className="max-w-[200px] h-8 text-xs font-semibold bg-transparent border-none text-white/80 placeholder:text-white/20 focus-visible:ring-0 focus-visible:ring-offset-0 hover:bg-white/[0.04] rounded-lg px-2.5 transition-colors"
          />
        </div>

        <Divider />

        {/* Edit tools */}
        <ToolCluster>
          <ToolbarTooltip label="Undo" shortcut="⌘Z">
            <ToolBtn onClick={onUndo} disabled={!canUndo}><Undo2 className="h-3.5 w-3.5" /></ToolBtn>
          </ToolbarTooltip>
          <ToolbarTooltip label="Redo" shortcut="⌘⇧Z">
            <ToolBtn onClick={onRedo} disabled={!canRedo}><Redo2 className="h-3.5 w-3.5" /></ToolBtn>
          </ToolbarTooltip>
          <div className="h-4 w-px bg-white/[0.06]" />
          <ToolbarTooltip label="Split at playhead" shortcut="S">
            <ToolBtn onClick={onSplit} disabled={!canSplit}><Scissors className="h-3.5 w-3.5" /></ToolBtn>
          </ToolbarTooltip>
          <ToolbarTooltip label="Duplicate clip" shortcut="⌘D">
            <ToolBtn onClick={onDuplicate} disabled={!canDuplicate}><Copy className="h-3.5 w-3.5" /></ToolBtn>
          </ToolbarTooltip>
        </ToolCluster>

        <Divider />

        {/* View tools */}
        <ToolCluster>
          <ToolbarTooltip label={`Snap ${snapEnabled ? "On" : "Off"}`} shortcut="N">
            <ToolBtn onClick={onToggleSnap} active={snapEnabled}><Magnet className="h-3.5 w-3.5" /></ToolBtn>
          </ToolbarTooltip>
          <ToolbarTooltip label="Fit timeline to view" shortcut="⌘⇧F">
            <ToolBtn onClick={onFitToView}><Maximize className="h-3.5 w-3.5" /></ToolBtn>
          </ToolbarTooltip>
        </ToolCluster>

        <Divider />

        {/* Add Track */}
        <Popover>
          <PopoverTrigger asChild>
            <button className={cn(
              "h-8 px-3 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-all duration-200",
              "text-white/50 hover:text-white hover:bg-white/[0.08]",
              "border border-white/[0.06] hover:border-white/[0.12]",
            )}>
              <Plus className="h-3.5 w-3.5" />
              <span>Track</span>
              <ChevronDown className="h-3 w-3 opacity-40" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1.5 bg-[hsl(0,0%,8%)] border-white/[0.08] rounded-xl" side="bottom" align="start" sideOffset={8}>
            <p className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.2em] px-2.5 pt-1 pb-2">
              Add Track
            </p>
            {[
              { type: "video" as const, icon: Film, label: "Video Track", color: "text-blue-400" },
              { type: "audio" as const, icon: Music, label: "Audio Track", color: "text-emerald-400" },
              { type: "text" as const, icon: Type, label: "Text Overlay", color: "text-amber-400" },
            ].map(({ type, icon: Icon, label, color }) => (
              <button
                key={type}
                className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-xs text-white/60 hover:text-white hover:bg-white/[0.06] transition-all"
                onClick={() => onAddTrack?.(type)}
              >
                <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center bg-white/[0.04] border border-white/[0.06]", color)}>
                  <Icon className="h-3 w-3" />
                </div>
                {label}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <div className="flex-1" />

        {/* Render progress */}
        {renderStatus === "rendering" && (
          <div className="flex items-center gap-2.5 mr-3 animate-in fade-in duration-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
            <div className="w-28 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-white rounded-full transition-all duration-700 ease-out"
                style={{ width: `${renderProgress}%` }}
              />
            </div>
            <span className="text-[10px] text-white/50 tabular-nums font-mono">{renderProgress}%</span>
          </div>
        )}

        {renderStatus === "completed" && (
          <div className="flex items-center gap-1.5 mr-3 animate-in fade-in duration-300">
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-[11px] text-emerald-400 font-semibold">Ready</span>
          </div>
        )}

        {/* Actions — WHITE BUTTONS */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onSave}
            disabled={isSaving}
            className="h-9 px-4 text-xs text-white/60 hover:text-white hover:bg-white/[0.08] gap-1.5 rounded-xl font-medium border border-white/[0.06]"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </Button>

          <Button
            size="sm"
            onClick={onExport}
            disabled={renderStatus === "rendering"}
            className={cn(
              "h-9 px-5 text-xs font-semibold rounded-xl gap-1.5 transition-all duration-200",
              "bg-white text-black hover:bg-white/90",
              "shadow-[0_0_24px_rgba(255,255,255,0.12)] hover:shadow-[0_0_40px_rgba(255,255,255,0.18)]",
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
