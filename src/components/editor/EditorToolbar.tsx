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
    <div className="h-12 bg-surface-1 border-b border-border flex items-center gap-2 px-3 shrink-0">
      <Button
        variant="ghost"
        size="icon"
        onClick={onBack}
        className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-surface-2 shrink-0"
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>

      <div className="h-5 w-px bg-border mx-1" />

      <Scissors className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
      <Input
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        className="max-w-[200px] h-7 text-xs font-medium bg-transparent border-none text-foreground/80 placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:ring-offset-0 hover:bg-surface-2 rounded px-2"
      />

      <div className="flex-1" />

      {renderStatus === "rendering" && (
        <div className="flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <div className="w-24 h-1.5 bg-surface-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${renderProgress}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground tabular-nums">{renderProgress}%</span>
        </div>
      )}

      {renderStatus === "completed" && (
        <span className="text-[10px] text-success font-medium">✓ Render complete</span>
      )}

      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={onSave}
          disabled={isSaving}
          className="h-7 px-2.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-surface-2 gap-1.5"
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
          className="h-7 px-3 text-[11px] bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 rounded"
        >
          <Download className="h-3 w-3" />
          Export
        </Button>
      </div>
    </div>
  );
};
