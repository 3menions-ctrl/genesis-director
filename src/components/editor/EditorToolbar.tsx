import { ArrowLeft, Save, Download, Loader2, Undo2, Redo2, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface EditorToolbarProps {
  title: string;
  onTitleChange: (title: string) => void;
  onSave: () => void;
  onExport: () => void;
  onBack: () => void;
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
  isSaving,
  renderStatus,
  renderProgress,
}: EditorToolbarProps) => {
  return (
    <div className="h-12 bg-[#1a1a1a] border-b border-[#2a2a2a] flex items-center gap-2 px-3 shrink-0">
      {/* Left: back + title */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onBack}
        className="h-8 w-8 text-[#888] hover:text-white hover:bg-[#2a2a2a] shrink-0"
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>

      <div className="h-5 w-px bg-[#333] mx-1" />

      <Scissors className="h-3.5 w-3.5 text-[#666] shrink-0" />
      <Input
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        className="max-w-[200px] h-7 text-xs font-medium bg-transparent border-none text-[#ccc] placeholder:text-[#555] focus-visible:ring-0 focus-visible:ring-offset-0 hover:bg-[#222] rounded px-2"
      />

      <div className="flex-1" />

      {/* Center: render status */}
      {renderStatus === "rendering" && (
        <div className="flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#4a9eff]" />
          <div className="w-24 h-1.5 bg-[#222] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#4a9eff] rounded-full transition-all duration-300"
              style={{ width: `${renderProgress}%` }}
            />
          </div>
          <span className="text-[10px] text-[#666] tabular-nums">{renderProgress}%</span>
        </div>
      )}

      {renderStatus === "completed" && (
        <span className="text-[10px] text-emerald-400 font-medium">✓ Render complete</span>
      )}

      {/* Right: actions */}
      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={onSave}
          disabled={isSaving}
          className="h-7 px-2.5 text-[11px] text-[#999] hover:text-white hover:bg-[#2a2a2a] gap-1.5"
        >
          {isSaving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Save className="h-3 w-3" />
          )}
          Save
        </Button>

        <Button
          size="sm"
          onClick={onExport}
          disabled={renderStatus === "rendering"}
          className="h-7 px-3 text-[11px] bg-[#4a9eff] hover:bg-[#5aafff] text-white gap-1.5 rounded"
        >
          <Download className="h-3 w-3" />
          Export
        </Button>
      </div>
    </div>
  );
};
