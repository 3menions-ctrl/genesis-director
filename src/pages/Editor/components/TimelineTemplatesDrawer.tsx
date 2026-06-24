/**
 * TimelineTemplatesDrawer — the one-click "50 templates" picker.
 *
 * A premium, centred modal gallery of pre-built LOOK + PACING + AUDIO recipes.
 * Pick one and the timeline is instantly styled (or laid out, if empty) and
 * scored — via applyTimelineTemplate(), which composes the existing store
 * mutators so undo/redo and the bake see a normal edit.
 *
 * Mobile-first templates (9:16 / 4:5) are surfaced first on phones.
 */
import { useMemo, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Sparkles, Music2, Check, Clapperboard, X } from "lucide-react";
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

/** A framed preview of the template's canvas orientation, sized from its
 *  aspect ratio so landscape / portrait / square all read at a glance. */
function aspectFrameStyle(aspect: string): React.CSSProperties {
  const [w, h] = aspect.split(/[:x/]/).map((n) => Number(n) || 1);
  const ratio = w / h;
  // Landscape & square hang off a fixed height; portrait off a taller one.
  return { aspectRatio: `${w} / ${h}`, height: ratio >= 1 ? "44%" : "70%" };
}

export function TimelineTemplatesDrawer({ open, onClose }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [appliedId, setAppliedId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: TIMELINE_TEMPLATES.length };
    for (const t of TIMELINE_TEMPLATES) m[t.category] = (m[t.category] ?? 0) + 1;
    return m;
  }, []);

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
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        {/* Flex-centring layer: a viewport-fixed flexbox centres the modal. This
            is immune to the translate(-50%)/zoom-animation conflict that pinned
            the modal to a corner, and to any transformed editor ancestor (the
            content is portalled to <body>). pointer-events-none lets clicks in
            the empty margin fall through to the overlay to close. */}
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none">
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="pointer-events-auto relative flex max-h-[88vh] w-[96vw] max-w-6xl flex-col overflow-hidden rounded-[28px] border border-white/[0.07] bg-[#070810]/95 backdrop-blur-2xl shadow-[0_40px_120px_-30px_rgba(0,0,0,0.95)] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          >
        {/* Aurora bloom — soft coloured light behind the header for depth. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-0 h-56 overflow-hidden">
          <span className="absolute -left-16 -top-24 h-72 w-72 rounded-full opacity-60 blur-[90px]" style={{ background: "radial-gradient(closest-side, rgba(120,140,255,0.30), transparent 70%)" }} />
          <span className="absolute right-0 -top-20 h-64 w-64 rounded-full opacity-50 blur-[90px]" style={{ background: "radial-gradient(closest-side, rgba(255,150,210,0.22), transparent 70%)" }} />
          <span className="absolute left-1/2 -top-16 h-56 w-72 -translate-x-1/2 rounded-full opacity-40 blur-[90px]" style={{ background: "radial-gradient(closest-side, rgba(140,230,255,0.20), transparent 70%)" }} />
        </div>

        <DialogPrimitive.Close className="absolute right-5 top-5 z-20 flex h-8 w-8 items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/[0.07] hover:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30">
          <X className="h-4 w-4" strokeWidth={2} />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>

        <div className="relative z-10 shrink-0 px-7 pb-4 pt-7 pr-14 text-left">
          <DialogPrimitive.Title className="flex items-baseline gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center self-center rounded-2xl bg-white/[0.06] ring-1 ring-inset ring-white/15">
              <Sparkles className="h-4 w-4 text-white" strokeWidth={1.7} />
            </span>
            <span className="font-display text-[26px] font-semibold leading-none tracking-tight text-white">
              Templates
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">
              {TIMELINE_TEMPLATES.length} one-click looks · video + audio
            </span>
          </DialogPrimitive.Title>
          <p className="mt-2 max-w-2xl text-[13px] font-light leading-relaxed text-white/45">
            A complete look, pacing and score in one click. Pick a recipe — your timeline is instantly graded, transitioned and scored. Undo reverts everything.
          </p>
        </div>

        {/* Category filter strip */}
        <div className="relative z-10 flex shrink-0 flex-wrap gap-1.5 px-7 pb-4">
          <Chip active={filter === "all"} onClick={() => setFilter("all")} label="All" count={counts.all} />
          {CATEGORY_ORDER.map((c) => (
            <Chip key={c} active={filter === c} onClick={() => setFilter(c)} label={CATEGORY_LABELS[c]} count={counts[c] ?? 0} />
          ))}
        </div>

        {/* Hairline above the scroll region. */}
        <div className="relative z-10 mx-7 h-px shrink-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Gallery — the only scroll region; flex-1 + min-h-0 lets it fill the
            remaining height and scroll instead of pushing the modal off-screen. */}
        <div className="relative z-10 grid min-h-0 flex-1 grid-cols-2 gap-3.5 overflow-y-auto px-7 py-6 sm:grid-cols-3 lg:grid-cols-4">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => apply(t)}
              className="group relative flex flex-col rounded-2xl bg-white/[0.025] text-left ring-1 ring-inset ring-white/[0.07] transition-all duration-300 ease-out hover:-translate-y-1 hover:bg-white/[0.045] hover:ring-white/20 hover:shadow-[0_28px_64px_-28px_rgba(0,0,0,0.95)]"
            >
              {/* Hero — the template's signature gradient + framed canvas. A
                  FIXED pixel height (not aspect/%): percentage & aspect-ratio
                  heights don't contribute to CSS-grid intrinsic row sizing, so a
                  fixed height is what keeps every card from collapsing. */}
              <div
                className="relative h-[150px] w-full shrink-0 overflow-hidden rounded-t-2xl"
                style={{ background: `linear-gradient(135deg, ${t.gradient[0]}, ${t.gradient[1]})` }}
              >
                {/* top-left sheen + bottom vignette for depth */}
                <span aria-hidden className="absolute inset-0" style={{ background: "radial-gradient(80% 60% at 22% 12%, rgba(255,255,255,0.35), transparent 60%)" }} />
                <span aria-hidden className="absolute inset-0" style={{ background: "radial-gradient(130% 130% at 50% 0%, transparent 42%, rgba(0,0,0,0.5))" }} />

                {/* canvas-orientation frame */}
                <span aria-hidden className="absolute inset-0 flex items-center justify-center">
                  <span
                    className="rounded-md ring-1 ring-inset ring-white/35 transition-transform duration-300 group-hover:scale-105"
                    style={{ ...aspectFrameStyle(t.aspectRatio), background: "rgba(255,255,255,0.06)", boxShadow: "0 8px 30px -10px rgba(0,0,0,0.6)" }}
                  />
                </span>

                {/* chips */}
                <span className="absolute left-2.5 top-2.5 rounded-full bg-black/35 px-2 py-0.5 font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-white/90 backdrop-blur-sm">
                  {t.vibe}
                </span>
                <span className="absolute right-2.5 top-2.5 rounded-full bg-black/35 px-2 py-0.5 font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-white/90 backdrop-blur-sm">
                  {t.aspectRatio}
                </span>

                {/* hover apply affordance */}
                <span className="pointer-events-none absolute inset-x-0 bottom-0 flex translate-y-3 items-center justify-center pb-3 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[11px] font-semibold text-[#06070a] shadow-lg">
                    <Clapperboard className="h-3 w-3" strokeWidth={2.2} /> Apply
                  </span>
                </span>

                {/* applied confirmation */}
                {appliedId === t.id && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400/15 ring-1 ring-inset ring-emerald-400/50">
                      <Check className="h-6 w-6 text-emerald-300" strokeWidth={2.6} />
                    </span>
                  </span>
                )}
              </div>

              {/* Meta */}
              <div className="flex flex-1 flex-col gap-1.5 p-3.5">
                <div className="font-display text-[15px] font-semibold leading-tight text-white">{t.name}</div>
                <div className="line-clamp-2 text-[11.5px] font-light leading-snug text-white/45">{t.description}</div>
                <div className="mt-auto flex items-center gap-2.5 pt-2 font-mono text-[9px] uppercase tracking-[0.14em] text-white/40">
                  <span>{t.slots.length} shots</span>
                  <span aria-hidden className="h-2.5 w-px bg-white/15" />
                  <span className="flex min-w-0 items-center gap-1">
                    <Music2 className="h-2.5 w-2.5 shrink-0" strokeWidth={2} />
                    <span className="truncate">{MUSIC_BEDS[t.music].title}</span>
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Chip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-colors",
        active
          ? "bg-white text-[#06070a] ring-1 ring-inset ring-white"
          : "bg-white/[0.04] text-white/55 ring-1 ring-inset ring-white/[0.07] hover:text-white/90 hover:bg-white/[0.07]",
      )}
    >
      {label}
      <span className={cn("font-mono text-[10px] tabular-nums", active ? "text-[#06070a]/55" : "text-white/30")}>{count}</span>
    </button>
  );
}
