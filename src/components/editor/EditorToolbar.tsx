import { ArrowLeft, Save, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

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
    <div className="h-14 border-b border-border bg-card flex items-center gap-3 px-4 shrink-0">
      <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
        <ArrowLeft className="h-4 w-4" />
      </Button>

      <Input
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        className="max-w-[240px] h-8 text-sm font-medium bg-muted/50 border-none"
      />

      <div className="flex-1" />

      {renderStatus === "rendering" && (
        <div className="flex items-center gap-2 mr-4">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <Progress value={renderProgress} className="w-32 h-2" />
          <span className="text-xs text-muted-foreground">{renderProgress}%</span>
        </div>
      )}

      {renderStatus === "completed" && (
        <span className="text-xs text-success mr-4">✓ Render complete</span>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={onSave}
        disabled={isSaving}
        className="gap-1.5"
      >
        {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        Save
      </Button>

      <Button
        size="sm"
        onClick={onExport}
        disabled={renderStatus === "rendering"}
        className="gap-1.5 bg-primary hover:bg-primary/90"
      >
        <Download className="h-3.5 w-3.5" />
        Export
      </Button>
    </div>
  );
};
