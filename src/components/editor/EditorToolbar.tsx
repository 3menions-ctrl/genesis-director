import { ArrowLeft, Save, Download, Loader2, Undo2, Redo2, Scissors, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface EditorToolbarProps {
  title: string;
  onTitleChange: (title: string) => void;
  onSave: () => void;
  onExport: () => void;
  onBack: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onSplit?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  canSplit?: boolean;
  isSaving: boolean;
  renderStatus: string;
  renderProgress: number;
}

export const EditorToolbar = ({
  title,
  onTitleChange,
  onSave,
  onExport,
  onBack,
  onUndo,
  onRedo,
  onSplit,
  canUndo = false,
  canRedo = false,
  canSplit = false,
  isSaving,
  renderStatus,
  renderProgress,
}: EditorToolbarProps) => {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="h-11 bg-[hsl(260,15%,7%)] border-b border-white/[0.06] flex items-center gap-1.5 px-2 shrink-0 relative">
        {/* Subtle top highlight */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="h-7 w-7 text-white/40 hover:text-white/80 hover:bg-white/[0.06] rounded-md transition-all"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-[10px] bg-[hsl(260,20%,12%)] border-white/10">Back</TooltipContent>
        </Tooltip>

        <div className="h-4 w-px bg-white/[0.06] mx-0.5" />

        {/* Logo accent */}
        <div className="flex items-center gap-1.5 mr-1">
          <div className="w-5 h-5 rounded bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Scissors className="h-2.5 w-2.5 text-primary" />
          </div>
        </div>

        <Input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="max-w-[180px] h-6 text-[11px] font-medium bg-transparent border-none text-white/70 placeholder:text-white/20 focus-visible:ring-0 focus-visible:ring-offset-0 hover:bg-white/[0.04] rounded px-1.5 font-[family-name:var(--font-heading)]"
        />

        <div className="h-4 w-px bg-white/[0.06] mx-1" />

        {/* Edit tools cluster */}
        <div className="flex items-center gap-0.5 bg-white/[0.03] rounded-md p-0.5 border border-white/[0.04]">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onUndo}
                disabled={!canUndo}
                className="h-6 w-6 text-white/40 hover:text-white/80 hover:bg-white/[0.08] disabled:opacity-15 rounded-sm transition-all"
              >
                <Undo2 className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[10px] bg-[hsl(260,20%,12%)] border-white/10">
              Undo <kbd className="ml-1 text-[8px] text-white/30">⌘Z</kbd>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onRedo}
                disabled={!canRedo}
                className="h-6 w-6 text-white/40 hover:text-white/80 hover:bg-white/[0.08] disabled:opacity-15 rounded-sm transition-all"
              >
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
              <Button
                variant="ghost"
                size="icon"
                onClick={onSplit}
                disabled={!canSplit}
                className="h-6 w-6 text-white/40 hover:text-white/80 hover:bg-white/[0.08] disabled:opacity-15 rounded-sm transition-all"
              >
                <Scissors className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[10px] bg-[hsl(260,20%,12%)] border-white/10">
              Split <kbd className="ml-1 text-[8px] text-white/30">S</kbd>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex-1" />

        {/* Render progress */}
        {renderStatus === "rendering" && (
          <div className="flex items-center gap-2.5 mr-3">
            <div className="relative">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <div className="absolute inset-0 blur-md bg-primary/30 animate-pulse" />
            </div>
            <div className="w-28 h-1 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${renderProgress}%` }}
              />
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
          <Button
            variant="ghost"
            size="sm"
            onClick={onSave}
            disabled={isSaving}
            className="h-7 px-2.5 text-[10px] text-white/50 hover:text-white/80 hover:bg-white/[0.06] gap-1.5 rounded-md font-medium tracking-wide transition-all"
          >
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Save
          </Button>

          <Button
            size="sm"
            onClick={onExport}
            disabled={renderStatus === "rendering"}
            className="h-7 px-3.5 text-[10px] bg-gradient-to-b from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white gap-1.5 rounded-md font-semibold tracking-wide shadow-[0_0_20px_hsl(263,70%,50%,0.15)] hover:shadow-[0_0_24px_hsl(263,70%,50%,0.25)] border border-primary/40 transition-all"
          >
            <Download className="h-3 w-3" />
            Export
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
};