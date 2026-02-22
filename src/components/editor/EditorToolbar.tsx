import {
  ArrowLeft, Save, Download, Loader2, Undo2, Redo2, Scissors, 
  Copy, Magnet, Maximize, PanelLeftClose, PanelLeft, Plus, Film, Music, Type,
  ChevronDown, Bookmark, Pause as FreezeIcon, ArrowDownUp, Unlink, ExternalLink,
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
  onFreezeFrame?: () => void;
  onReverseClip?: () => void;
  onDetachAudio?: () => void;
  onAddMarker?: () => void;
  onOpenInOpenReel?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  canSplit?: boolean;
  canDuplicate?: boolean;
  hasSelectedClip?: boolean;
  snapEnabled?: boolean;
  showMediaBrowser?: boolean;
  isSaving: boolean;
  renderStatus: string;
  renderProgress: number;
}

const Divider = () => <div className="h-5 w-px bg-white/[0.06] mx-1.5 shrink-0" />;

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="ml-1.5 px-1.5 py-0.5 rounded bg-white/[0.06] text-[9px] font-mono text-white/30 leading-none">
    {children}
  </kbd>
);

const ToolbarTooltip = ({ children, label, shortcut }: { children: React.ReactNode; label: string; shortcut?: string }) => (
  <Tooltip>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent
      side="bottom"
      sideOffset={8}
      className="text-[11px] font-medium bg-[#1a1a1f] border-white/[0.08] text-white/80 shadow-2xl px-3 py-2 flex items-center gap-1 rounded-lg"
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
      "h-7 w-7 rounded-lg flex items-center justify-center transition-all duration-150",
      "text-white/35 hover:text-white/80 hover:bg-white/[0.06]",
      "disabled:opacity-[0.12] disabled:pointer-events-none",
      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20",
      active && "text-white/90 bg-white/[0.08]",
      className,
    )}
  >
    {children}
  </button>
);

const ToolGroup = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-px">
    {children}
  </div>
);

export const EditorToolbar = ({
  title, onTitleChange, onSave, onExport, onBack,
  onUndo, onRedo, onSplit, onDuplicate, onFitToView, onToggleSnap, onToggleMediaBrowser, onAddTrack,
  onFreezeFrame, onReverseClip, onDetachAudio, onAddMarker, onOpenInOpenReel,
  canUndo = false, canRedo = false, canSplit = false, canDuplicate = false,
  hasSelectedClip = false,
  snapEnabled = true, showMediaBrowser = true,
  isSaving, renderStatus, renderProgress,
}: EditorToolbarProps) => {
  return (
    <TooltipProvider delayDuration={400}>
      <div className="h-12 bg-[#0d0d11]/95 backdrop-blur-2xl border-b border-white/[0.04] flex items-center gap-1.5 px-3 shrink-0 relative z-20">

        {/* Back + Logo */}
        <div className="flex items-center gap-1">
          <ToolbarTooltip label="Back to projects">
            <ToolBtn onClick={onBack}>
              <ArrowLeft className="h-3.5 w-3.5" />
            </ToolBtn>
          </ToolbarTooltip>
          <Logo size="sm" className="opacity-40 hover:opacity-70 transition-opacity cursor-pointer" />
        </div>

        <Divider />

        <ToolbarTooltip label="Media Panel" shortcut="M">
          <ToolBtn onClick={onToggleMediaBrowser} active={showMediaBrowser}>
            {showMediaBrowser ? <PanelLeftClose className="h-3.5 w-3.5" /> : <PanelLeft className="h-3.5 w-3.5" />}
          </ToolBtn>
        </ToolbarTooltip>

        <Divider />

        {/* Project title — clean, no icon */}
        <Input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="max-w-[180px] h-7 text-[12px] font-medium bg-transparent border-none text-white/50 placeholder:text-white/20 focus-visible:ring-0 focus-visible:ring-offset-0 hover:text-white/70 hover:bg-white/[0.03] rounded-lg px-2 transition-all"
        />

        <Divider />

        {/* Edit tools */}
        <ToolGroup>
          <ToolbarTooltip label="Undo" shortcut="⌘Z">
            <ToolBtn onClick={onUndo} disabled={!canUndo}><Undo2 className="h-3.5 w-3.5" /></ToolBtn>
          </ToolbarTooltip>
          <ToolbarTooltip label="Redo" shortcut="⌘⇧Z">
            <ToolBtn onClick={onRedo} disabled={!canRedo}><Redo2 className="h-3.5 w-3.5" /></ToolBtn>
          </ToolbarTooltip>
          <Divider />
          <ToolbarTooltip label="Split" shortcut="S">
            <ToolBtn onClick={onSplit} disabled={!canSplit}><Scissors className="h-3.5 w-3.5" /></ToolBtn>
          </ToolbarTooltip>
          <ToolbarTooltip label="Duplicate" shortcut="⌘D">
            <ToolBtn onClick={onDuplicate} disabled={!canDuplicate}><Copy className="h-3.5 w-3.5" /></ToolBtn>
          </ToolbarTooltip>
        </ToolGroup>

        <Divider />

        {/* Clip tools */}
        <ToolGroup>
          <ToolbarTooltip label="Freeze frame" shortcut="F">
            <ToolBtn onClick={onFreezeFrame} disabled={!hasSelectedClip}><FreezeIcon className="h-3.5 w-3.5" /></ToolBtn>
          </ToolbarTooltip>
          <ToolbarTooltip label="Reverse" shortcut="R">
            <ToolBtn onClick={onReverseClip} disabled={!hasSelectedClip}><ArrowDownUp className="h-3.5 w-3.5" /></ToolBtn>
          </ToolbarTooltip>
          <ToolbarTooltip label="Detach audio">
            <ToolBtn onClick={onDetachAudio} disabled={!hasSelectedClip}><Unlink className="h-3.5 w-3.5" /></ToolBtn>
          </ToolbarTooltip>
          <Divider />
          <ToolbarTooltip label="Marker" shortcut="B">
            <ToolBtn onClick={onAddMarker}><Bookmark className="h-3.5 w-3.5" /></ToolBtn>
          </ToolbarTooltip>
        </ToolGroup>

        <Divider />

        {/* View tools */}
        <ToolGroup>
          <ToolbarTooltip label={`Snap ${snapEnabled ? "On" : "Off"}`} shortcut="N">
            <ToolBtn onClick={onToggleSnap} active={snapEnabled}><Magnet className="h-3.5 w-3.5" /></ToolBtn>
          </ToolbarTooltip>
          <ToolbarTooltip label="Fit to view" shortcut="⌘⇧F">
            <ToolBtn onClick={onFitToView}><Maximize className="h-3.5 w-3.5" /></ToolBtn>
          </ToolbarTooltip>
        </ToolGroup>

        <Divider />

        {/* Add Track — minimal popover */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="h-7 px-2.5 rounded-lg flex items-center gap-1 text-[11px] font-medium text-white/35 hover:text-white/70 hover:bg-white/[0.06] transition-all duration-150">
              <Plus className="h-3 w-3" />
              <span>Track</span>
              <ChevronDown className="h-2.5 w-2.5 opacity-40" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-44 p-1.5 bg-[#1a1a1f]/95 backdrop-blur-2xl border-white/[0.08] rounded-xl shadow-2xl" side="bottom" align="start" sideOffset={6}>
            {[
              { type: "video" as const, icon: Film, label: "Video Track" },
              { type: "audio" as const, icon: Music, label: "Audio Track" },
              { type: "text" as const, icon: Type, label: "Text Overlay" },
            ].map(({ type, icon: Icon, label }) => (
              <button
                key={type}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] text-white/50 hover:text-white/90 hover:bg-white/[0.06] transition-all"
                onClick={() => onAddTrack?.(type)}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="font-medium">{label}</span>
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <div className="flex-1" />

        {/* Render progress — minimal */}
        {renderStatus === "rendering" && (
          <div className="flex items-center gap-2.5 mr-3 animate-in fade-in duration-300">
            <Loader2 className="h-3 w-3 animate-spin text-white/40" />
            <div className="w-24 h-1 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-white/40 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${renderProgress}%` }}
              />
            </div>
            <span className="text-[10px] text-white/25 tabular-nums font-mono">{renderProgress}%</span>
          </div>
        )}

        {renderStatus === "completed" && (
          <div className="flex items-center gap-1.5 mr-3 animate-in fade-in duration-300">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/80" />
            <span className="text-[10px] text-emerald-400/70 font-medium">Ready</span>
          </div>
        )}

        {/* Actions — clean, minimal */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onSave}
            disabled={isSaving}
            className="h-7 px-3 rounded-lg flex items-center gap-1.5 text-[11px] font-medium text-white/40 hover:text-white/70 hover:bg-white/[0.06] disabled:opacity-30 transition-all duration-150"
          >
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Save
          </button>

          <button
            onClick={onExport}
            disabled={renderStatus === "rendering"}
            className={cn(
              "h-7 px-4 text-[11px] font-semibold rounded-lg flex items-center gap-1.5 transition-all duration-200",
              "bg-white text-black hover:bg-white/90",
              "disabled:opacity-30",
            )}
          >
            <Download className="h-3 w-3" />
            Export
          </button>

          <ToolbarTooltip label="Open clips in OpenReel Video — a professional browser editor with full export">
            <button
              onClick={onOpenInOpenReel}
              className="h-7 px-3 rounded-lg flex items-center gap-1.5 text-[11px] font-medium text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-all duration-150"
            >
              <ExternalLink className="h-3 w-3" />
              OpenReel
            </button>
          </ToolbarTooltip>
        </div>
      </div>
    </TooltipProvider>
  );
};
