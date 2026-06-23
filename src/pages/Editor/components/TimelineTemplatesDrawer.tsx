/**
 * TimelineTemplatesDrawer — the one-click "50 templates" picker.
 *
 * A full modal of pre-built LOOK + PACING + AUDIO recipes. Pick one and the
 * timeline is instantly styled (or laid out, if empty) and scored — via
 * applyTimelineTemplate(), which composes the existing store mutators so
 * undo/redo and the bake see a normal edit.
 *
 * Mobile-first templates (9:16 / 4:5) are surfaced first on phones.
 */
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Sparkles, Music2, Check } from "lucide-react";
import {
  applyTimelineTemplate,
  CATEGORY_LABELS,
  MUSIC_BEDS,
  type TimelineTemplate,
  type TimelineTemplateCategory,
} from "@/lib/editor/timeline-template-apply";
import { TIMELINE_TEMPLATES } from "@/lib/editor/timeline-templates";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Filter = "all" | TimelineTemplateCategory;

const CATEGORY_ORDER: TimelineTemplateCategory[] = [
  "cinematic", "social", "vlog", "commercial", "trailer",
  "travel", "music", "corporate", "story", "lifestyle",
];

function isPhone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(max-width: 640px)")?.matches ?? false;
}

export function TimelineTemplatesDrawer({ open, onClose }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [appliedId, setAppliedId] = useState<string | null>(null);

  const templates = useMemo(() => {
    const list = filter === "all"
      ? TIMELINE_TEMPLATES
      : TIMELINE_TEMPLATES.filter((t) => t.category === filter);
    // On phones, float the vertical/portrait templates to the top.
    if (isPhone()) {
      return [...list].sort((a, b) => Number(!!b.mobileFirst) - Number(!!a.mobileFirst));
    }
    return list;
  }, [filter]);

  const apply = (t: TimelineTemplate) => {
    const res = applyTimelineTemplate(t);
    if (!res.ok) {
      toast.error("Open a project first to apply a template.");
      return;
    }
    setAppliedId(t.id);
    const what = res.mode === "filled-empty"
      ? `${res.clipsAdded} slots laid out`
      : `${res.styledExisting} clips restyled`;
    toast.success(`“${t.name}” applied — ${what}, scored & stitched.`, {
      description: "Undo (⌘Z) reverts everything.",
    });
    // Brief confirmation tick, then close.
    window.setTimeout(() => {
      setAppliedId(null);
      onClose();
    }, 650);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[96vw] max-w-5xl max-h-[90vh] overflow-hidden rounded-[24px] border-0 bg-[#0a0b10]/95 p-0 backdrop-blur-2xl">
        <DialogHeader className="border-b border-white/[0.06] px-6 py-4">
          <DialogTitle className="flex items-center gap-2.5 text-[18px] font-semibold text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.05] ring-1 ring-inset ring-white/10">
              <Sparkles className="h-4 w-4 text-accent" strokeWidth={1.7} />
            </span>
            One-click templates
            <span className="ml-1 font-mono text-[11px] font-normal uppercase tracking-[0.16em] text-white/40">
              {TIMELINE_TEMPLATES.length} looks · video + audio
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Category filter strip */}
        <div className="flex flex-wrap gap-1.5 px-6 py-3">
          <Chip active={filter === "all"} onClick={() => setFilter("all")} label="All" />
          {CATEGORY_ORDER.map((c) => (
            <Chip key={c} active={filter === c} onClick={() => setFilter(c)} label={CATEGORY_LABELS[c]} />
          ))}
        </div>

        {/* Grid */}
        <div className="grid max-h-[62vh] grid-cols-2 gap-3 overflow-y-auto px-6 pb-6 sm:grid-cols-3 lg:grid-cols-4">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => apply(t)}
              className="group relative flex flex-col overflow-hidden rounded-2xl text-left ring-1 ring-inset ring-white/[0.08] transition-transform duration-200 hover:-translate-y-0.5 hover:ring-accent/40"
            >
              {/* gradient tile */}
              <div
                className="relative aspect-video w-full"
                style={{ background: `linear-gradient(135deg, ${t.gradient[0]}, ${t.gradient[1]})` }}
              >
                <span className="absolute left-2 top-2 rounded-full bg-black/40 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white/85 backdrop-blur-sm">
                  {t.aspectRatio}
                </span>
                <span className="absolute right-2 top-2 rounded-full bg-black/40 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white/85 backdrop-blur-sm">
                  {t.vibe}
                </span>
                {appliedId === t.id && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/55">
                    <Check className="h-8 w-8 text-emerald-400" strokeWidth={2.4} />
                  </span>
                )}
              </div>
              {/* meta */}
              <div className="flex flex-1 flex-col gap-1 bg-white/[0.02] p-3">
                <div className="text-[13px] font-semibold leading-tight text-white">{t.name}</div>
                <div className="line-clamp-2 text-[11px] leading-snug text-white/50">{t.description}</div>
                <div className="mt-auto flex items-center gap-2 pt-1.5 font-mono text-[9px] uppercase tracking-wider text-white/40">
                  <span>{t.slots.length} shots</span>
                  <span className="flex items-center gap-1">
                    <Music2 className="h-2.5 w-2.5" strokeWidth={2} /> {MUSIC_BEDS[t.music].title}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
        active
          ? "bg-accent/16 text-white ring-1 ring-inset ring-accent/40"
          : "bg-white/[0.04] text-white/55 ring-1 ring-inset ring-white/[0.06] hover:text-white/85",
      )}
    >
      {label}
    </button>
  );
}
