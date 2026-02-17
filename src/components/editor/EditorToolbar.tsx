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
import { Logo } from "@/components/ui/Logo";

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

const Divider = () => <div className="h-6 w-px bg-white/[0.04] mx-1 shrink-0" />;

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="ml-1.5 px-1.5 py-0.5 rounded-md bg-white/[0.06] text-[9px] font-mono text-white/40 border border-white/[0.04] leading-none">
    {children}
  </kbd>
);

const ToolbarTooltip = ({ children, label, shortcut }: { children: React.ReactNode; label: string; shortcut?: string }) => (
  <Tooltip>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent
      side="bottom"
      sideOffset={8}
      className="text-[11px] font-medium bg-[hsl(0,0%,8%)] border-white/[0.08] text-white shadow-2xl shadow-black/50 px-3 py-2 flex items-center gap-1 rounded-xl"
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
      "h-8 w-8 rounded-xl flex items-center justify-center transition-all duration-200",
      "text-white/40 hover:text-white hover:bg-white/[0.08]",
      "disabled:opacity-15 disabled:pointer-events-none",
      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30",
      active && "text-white bg-white/[0.10] hover:bg-white/[0.14] shadow-inner shadow-white/[0.02]",
      className,
    )}
  >
    {children}
  </button>
);

const ToolCluster = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn(
    "flex items-center gap-0.5 rounded-xl p-0.5",
    "bg-white/[0.02] border border-white/[0.05] backdrop-blur-sm",
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
      <div className="h-14 bg-[hsl(0,0%,5%)]/80 backdrop-blur-xl border-b border-white/[0.06] flex items-center gap-2 px-3 shrink-0 relative z-20">
        {/* Top accent line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        {/* Bottom subtle line */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />

        {/* Back + Logo */}
        <div className="flex items-center gap-1.5">
          <ToolbarTooltip label="Back to projects">
            <ToolBtn onClick={onBack} className="hover:bg-white/[0.06]">
              <ArrowLeft className="h-4 w-4" />
            </ToolBtn>
          </ToolbarTooltip>
          <Logo size="sm" className="opacity-60 hover:opacity-100 transition-opacity cursor-pointer" />
        </div>

        <Divider />

        <ToolbarTooltip label="Media Panel" shortcut="M">
          <ToolBtn onClick={onToggleMediaBrowser} active={showMediaBrowser}>
            {showMediaBrowser ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
          </ToolBtn>
        </ToolbarTooltip>

        <Divider />

        {/* Project title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/25 to-accent/10 border border-primary/15 flex items-center justify-center shrink-0 shadow-lg shadow-primary/5">
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
          <div className="h-4 w-px bg-white/[0.05]" />
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
              "h-8 px-3.5 rounded-xl flex items-center gap-1.5 text-xs font-medium transition-all duration-200",
              "text-white/40 hover:text-white hover:bg-white/[0.06]",
              "border border-white/[0.05] hover:border-white/[0.12]",
            )}>
              <Plus className="h-3.5 w-3.5" />
              <span>Track</span>
              <ChevronDown className="h-3 w-3 opacity-30" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-2 bg-[hsl(0,0%,6%)]/95 backdrop-blur-xl border-white/[0.08] rounded-2xl shadow-2xl shadow-black/50" side="bottom" align="start" sideOffset={8}>
            <p className="text-[9px] font-semibold text-white/20 uppercase tracking-[0.2em] px-3 pt-1 pb-2">
              Add Track
            </p>
            {[
              { type: "video" as const, icon: Film, label: "Video Track", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/15" },
              { type: "audio" as const, icon: Music, label: "Audio Track", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/15" },
              { type: "text" as const, icon: Type, label: "Text Overlay", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/15" },
            ].map(({ type, icon: Icon, label, color, bg }) => (
              <button
                key={type}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs text-white/50 hover:text-white hover:bg-white/[0.05] transition-all group"
                onClick={() => onAddTrack?.(type)}
              >
                <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center border", bg, color, "group-hover:scale-110 transition-transform")}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span className="font-medium">{label}</span>
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <div className="flex-1" />

        {/* Render progress */}
        {renderStatus === "rendering" && (
          <div className="flex items-center gap-3 mr-3 animate-in fade-in duration-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            <div className="w-32 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary via-primary to-accent rounded-full transition-all duration-700 ease-out"
                style={{ width: `${renderProgress}%` }}
              />
            </div>
            <span className="text-[10px] text-white/40 tabular-nums font-mono">{renderProgress}%</span>
          </div>
        )}

        {renderStatus === "completed" && (
          <div className="flex items-center gap-2 mr-3 animate-in fade-in duration-300">
            <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/30 animate-pulse" />
            <span className="text-[11px] text-emerald-400 font-semibold">Ready</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onSave}
            disabled={isSaving}
            className="h-9 px-4 text-xs text-white/50 hover:text-white hover:bg-white/[0.06] gap-1.5 rounded-xl font-medium border border-white/[0.05] hover:border-white/[0.12] transition-all"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </Button>

          <Button
            size="sm"
            onClick={onExport}
            disabled={renderStatus === "rendering"}
            className={cn(
              "h-9 px-6 text-xs font-semibold rounded-xl gap-2 transition-all duration-300",
              "bg-white text-black hover:bg-white/90",
              "shadow-[0_0_30px_rgba(255,255,255,0.10)] hover:shadow-[0_0_50px_rgba(255,255,255,0.18)]",
              "hover:scale-[1.02] active:scale-[0.98]",
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
