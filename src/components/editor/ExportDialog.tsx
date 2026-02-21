import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Download, Monitor, Smartphone, Square, Layout } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExportSettings } from "./types";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: ExportSettings;
  onSettingsChange: (settings: ExportSettings) => void;
  onExport: () => void;
  isExporting: boolean;
}

const resolutions = [
  { id: "720p" as const, label: "720p", desc: "1280×720 • Fast", icon: Smartphone },
  { id: "1080p" as const, label: "1080p", desc: "1920×1080 • Standard", icon: Monitor },
  { id: "4k" as const, label: "4K", desc: "3840×2160 • Premium", icon: Monitor },
];

const aspectRatios = [
  { id: "16:9" as const, label: "16:9", desc: "Landscape", icon: Layout },
  { id: "9:16" as const, label: "9:16", desc: "Vertical/Reels", icon: Smartphone },
  { id: "1:1" as const, label: "1:1", desc: "Square", icon: Square },
  { id: "4:3" as const, label: "4:3", desc: "Classic", icon: Monitor },
];

const formats = [
  { id: "mp4" as const, label: "MP4", desc: "Most compatible" },
  { id: "webm" as const, label: "WebM", desc: "Web optimized" },
  { id: "mov" as const, label: "MOV", desc: "Apple/Final Cut" },
];

const qualities = [
  { id: "standard" as const, label: "Standard", desc: "Smaller file" },
  { id: "high" as const, label: "High", desc: "Balanced" },
  { id: "ultra" as const, label: "Ultra", desc: "Maximum quality" },
];

const fpsOptions = [
  { id: 24 as const, label: "24fps", desc: "Cinematic" },
  { id: 30 as const, label: "30fps", desc: "Standard" },
  { id: 60 as const, label: "60fps", desc: "Smooth" },
];

export const ExportDialog = ({
  open, onOpenChange, settings, onSettingsChange, onExport, isExporting,
}: ExportDialogProps) => {
  const update = (updates: Partial<ExportSettings>) => {
    onSettingsChange({ ...settings, ...updates });
  };

  const OptionGrid = ({ children, cols = 3 }: { children: React.ReactNode; cols?: number }) => (
    <div className={cn("grid gap-1.5 mt-2", cols === 4 ? "grid-cols-4" : cols === 2 ? "grid-cols-2" : "grid-cols-3")}>
      {children}
    </div>
  );

  const OptionBtn = ({ active, onClick, children, className }: {
    active: boolean; onClick: () => void; children: React.ReactNode; className?: string;
  }) => (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 p-3 rounded-xl border transition-all text-center",
        active
          ? "bg-primary/10 border-primary/30 text-foreground shadow-sm"
          : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary",
        className,
      )}
    >
      {children}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Download className="h-4 w-4 text-primary" />
            Export Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Resolution */}
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-semibold">Resolution</Label>
            <OptionGrid>
              {resolutions.map((r) => (
                <OptionBtn key={r.id} active={settings.resolution === r.id} onClick={() => update({ resolution: r.id })}>
                  <r.icon className="h-4 w-4 mb-0.5" />
                  <span className="text-[11px] font-semibold">{r.label}</span>
                  <span className="text-[8px] text-muted-foreground">{r.desc}</span>
                </OptionBtn>
              ))}
            </OptionGrid>
          </div>

          {/* Aspect Ratio */}
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-semibold">Aspect Ratio</Label>
            <OptionGrid cols={4}>
              {aspectRatios.map((a) => (
                <OptionBtn key={a.id} active={settings.aspectRatio === a.id} onClick={() => update({ aspectRatio: a.id })}>
                  <a.icon className="h-3.5 w-3.5 mb-0.5" />
                  <span className="text-[10px] font-semibold">{a.label}</span>
                  <span className="text-[7px] text-muted-foreground">{a.desc}</span>
                </OptionBtn>
              ))}
            </OptionGrid>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {/* Format */}
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-semibold">Format</Label>
              <div className="flex flex-col gap-1 mt-2">
                {formats.map((f) => (
                  <button
                    key={f.id}
                    className={cn(
                      "text-left px-2.5 py-1.5 rounded-lg border text-[9px] transition-all",
                      settings.format === f.id
                        ? "bg-primary/10 border-primary/30 text-foreground font-semibold"
                        : "border-border text-muted-foreground hover:bg-secondary"
                    )}
                    onClick={() => update({ format: f.id })}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quality */}
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-semibold">Quality</Label>
              <div className="flex flex-col gap-1 mt-2">
                {qualities.map((q) => (
                  <button
                    key={q.id}
                    className={cn(
                      "text-left px-2.5 py-1.5 rounded-lg border text-[9px] transition-all",
                      settings.quality === q.id
                        ? "bg-primary/10 border-primary/30 text-foreground font-semibold"
                        : "border-border text-muted-foreground hover:bg-secondary"
                    )}
                    onClick={() => update({ quality: q.id })}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>

            {/* FPS */}
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-semibold">Frame Rate</Label>
              <div className="flex flex-col gap-1 mt-2">
                {fpsOptions.map((f) => (
                  <button
                    key={f.id}
                    className={cn(
                      "text-left px-2.5 py-1.5 rounded-lg border text-[9px] transition-all",
                      settings.fps === f.id
                        ? "bg-primary/10 border-primary/30 text-foreground font-semibold"
                        : "border-border text-muted-foreground hover:bg-secondary"
                    )}
                    onClick={() => update({ fps: f.id })}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-xs">
            Cancel
          </Button>
          <Button
            onClick={onExport}
            disabled={isExporting}
            className="bg-white text-black hover:bg-white/90 text-xs font-semibold gap-2"
          >
            <Download className="h-3.5 w-3.5" />
            {isExporting ? "Exporting..." : "Export"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
