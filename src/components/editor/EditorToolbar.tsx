import {
  ArrowLeft, Save, Download, Loader2, Undo2, Redo2, Scissors, Sparkles,
  Copy, Magnet, Maximize, PanelLeftClose, PanelLeft, Plus, Film, Music, Type,
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

export const EditorToolbar = ({
  title, onTitleChange, onSave, onExport, onBack,
  onUndo, onRedo, onSplit, onDuplicate, onFitToView, onToggleSnap, onToggleMediaBrowser, onAddTrack,
  canUndo = false, canRedo = false, canSplit = false, canDuplicate = false,
  snapEnabled = true, showMediaBrowser = true,
  isSaving, renderStatus, renderProgress,
}: EditorToolbarProps) => {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="h-11 bg-[hsl(260,15%,7%)] border-b border-white/[0.06] flex items-center gap-1 px-2 shrink-0 relative">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

        {/* Back */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onBack}
              className="h-7 w-7 text-white hover:text-white hover:bg-white/[0.08] rounded-md transition-all">
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-[10px] bg-[hsl(260,20%,12%)] border-white/10">Back</TooltipContent>
        </Tooltip>

        <div className="h-4 w-px bg-white/[0.06] mx-0.5" />

        {/* Toggle media browser */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onToggleMediaBrowser}
              className={cn("h-7 w-7 rounded-md transition-all",
                showMediaBrowser ? "text-white bg-white/[0.06]" : "text-white/40 hover:text-white hover:bg-white/[0.08]"
              )}>
              {showMediaBrowser ? <PanelLeftClose className="h-3.5 w-3.5" /> : <PanelLeft className="h-3.5 w-3.5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-[10px] bg-[hsl(260,20%,12%)] border-white/10">
            Media Panel <kbd className="ml-1 text-[8px] text-white/30">M</kbd>
          </TooltipContent>
        </Tooltip>

        <div className="h-4 w-px bg-white/[0.06] mx-0.5" />

        {/* Project title */}
        <div className="flex items-center gap-1.5 mr-1">
          <div className="w-5 h-5 rounded bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Scissors className="h-2.5 w-2.5 text-primary" />
          </div>
        </div>
        <Input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="max-w-[160px] h-6 text-[11px] font-medium bg-transparent border-none text-white/70 placeholder:text-white/20 focus-visible:ring-0 focus-visible:ring-offset-0 hover:bg-white/[0.04] rounded px-1.5"
        />

        <div className="h-4 w-px bg-white/[0.06] mx-0.5" />

        {/* Edit tools cluster */}
        <div className="flex items-center gap-0.5 bg-white/[0.03] rounded-md p-0.5 border border-white/[0.04]">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onUndo} disabled={!canUndo}
                className="h-6 w-6 text-white hover:text-white hover:bg-white/[0.08] disabled:opacity-15 rounded-sm transition-all">
                <Undo2 className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[10px] bg-[hsl(260,20%,12%)] border-white/10">
              Undo <kbd className="ml-1 text-[8px] text-white/30">⌘Z</kbd>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onRedo} disabled={!canRedo}
                className="h-6 w-6 text-white hover:text-white hover:bg-white/[0.08] disabled:opacity-15 rounded-sm transition-all">
                <Redo2 className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[10px] bg-[hsl(260,20%,12%)] border-white/10">
              Redo <kbd className="ml-1 text-[8px] text-white/30">⌘⇧Z</kbd>
            </TooltipContent>
          </Tooltip>

          <div className="h-3.5 w-px bg-white/[0.06]" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onSplit} disabled={!canSplit}
                className="h-6 w-6 text-white hover:text-white hover:bg-white/[0.08] disabled:opacity-15 rounded-sm transition-all">
                <Scissors className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[10px] bg-[hsl(260,20%,12%)] border-white/10">
              Split <kbd className="ml-1 text-[8px] text-white/30">S</kbd>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onDuplicate} disabled={!canDuplicate}
                className="h-6 w-6 text-white hover:text-white hover:bg-white/[0.08] disabled:opacity-15 rounded-sm transition-all">
                <Copy className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[10px] bg-[hsl(260,20%,12%)] border-white/10">
              Duplicate <kbd className="ml-1 text-[8px] text-white/30">⌘D</kbd>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="h-4 w-px bg-white/[0.06] mx-0.5" />

        {/* View tools cluster */}
        <div className="flex items-center gap-0.5 bg-white/[0.03] rounded-md p-0.5 border border-white/[0.04]">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onToggleSnap}
                className={cn("h-6 w-6 rounded-sm transition-all",
                  snapEnabled ? "text-primary bg-primary/10" : "text-white/30 hover:text-white hover:bg-white/[0.08]"
                )}>
                <Magnet className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[10px] bg-[hsl(260,20%,12%)] border-white/10">
              Snap {snapEnabled ? "On" : "Off"} <kbd className="ml-1 text-[8px] text-white/30">N</kbd>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onFitToView}
                className="h-6 w-6 text-white/40 hover:text-white hover:bg-white/[0.08] rounded-sm transition-all">
                <Maximize className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[10px] bg-[hsl(260,20%,12%)] border-white/10">
              Fit to View <kbd className="ml-1 text-[8px] text-white/30">⌘⇧F</kbd>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="h-4 w-px bg-white/[0.06] mx-0.5" />

        {/* Add Track */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm"
              className="h-6 px-2 text-[10px] text-white/50 hover:text-white hover:bg-white/[0.08] gap-1 rounded-md transition-all">
              <Plus className="h-3 w-3" />
              Track
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-36 p-1.5 bg-[hsl(260,20%,10%)] border-white/10" side="bottom" align="start">
            {[
              { type: "video" as const, icon: Film, label: "Video Track", color: "text-primary" },
              { type: "audio" as const, icon: Music, label: "Audio Track", color: "text-emerald-400" },
              { type: "text" as const, icon: Type, label: "Text Track", color: "text-amber-400" },
            ].map(({ type, icon: Icon, label, color }) => (
              <button key={type}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-[10px] text-white/60 hover:text-white hover:bg-white/[0.08] transition-all"
                onClick={() => onAddTrack?.(type)}>
                <Icon className={cn("h-3 w-3", color)} />
                {label}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <div className="flex-1" />

        {/* Render progress */}
        {renderStatus === "rendering" && (
          <div className="flex items-center gap-2.5 mr-3">
            <div className="relative">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <div className="absolute inset-0 blur-md bg-primary/30 animate-pulse" />
            </div>
            <div className="w-28 h-1 bg-white/[0.06] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${renderProgress}%` }} />
            </div>
            <span className="text-[10px] text-white/40 tabular-nums font-mono">{renderProgress}%</span>
          </div>
        )}

        {renderStatus === "completed" && (
          <div className="flex items-center gap-1.5 mr-3">
            <Sparkles className="h-3 w-3 text-emerald-400" />
            <span className="text-[10px] text-emerald-400 font-medium">Export ready</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onSave} disabled={isSaving}
            className="h-7 px-2.5 text-[10px] text-white hover:text-white hover:bg-white/[0.08] gap-1.5 rounded-md font-medium tracking-wide transition-all">
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Save
          </Button>

          <Button size="sm" onClick={onExport} disabled={renderStatus === "rendering"}
            className="h-7 px-3.5 text-[10px] bg-white text-black hover:bg-white/90 gap-1.5 rounded-md font-semibold tracking-wide shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_24px_rgba(255,255,255,0.15)] border border-white/20 transition-all">
            <Download className="h-3 w-3" />
            Export
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
};
