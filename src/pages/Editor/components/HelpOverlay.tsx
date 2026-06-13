/**
 * HelpOverlay — every editor keyboard shortcut, in one floating
 * sheet. Press ? to open, Esc to close.
 *
 * Discoverability is the entire point — the editor is keyboard-
 * dense (1/2/3/4, space, R, E, C, ?, ⌘P, +/-, arrows) and nobody
 * memorises a shortcut they haven't seen.
 */
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";
import { Surface, SurfaceHeader, SurfaceBody, SurfaceFooter } from "./Surface";

interface Shortcut {
  keys: string[];
  label: string;
}
interface Group {
  title: string;
  items: Shortcut[];
}

const SHORTCUTS: Group[] = [
  {
    title: "Views",
    items: [
      { keys: ["1"], label: "Stage — cinematic player" },
      { keys: ["2"], label: "Timeline — magnetic editor" },
      { keys: ["3"], label: "Script — screenplay editor" },
      { keys: ["4"], label: "Storyboard — scene cards" },
    ],
  },
  {
    title: "Playback",
    items: [
      { keys: ["Space"], label: "Play / pause" },
      { keys: [",", "."], label: "Step playhead one frame" },
      { keys: ["←", "→"], label: "Step playhead 1s" },
      { keys: ["Shift", "←/→"], label: "Step playhead 0.1s" },
      { keys: ["Alt", "←/→"], label: "Step playhead 5s" },
    ],
  },
  {
    title: "Edit (history & clipboard)",
    items: [
      { keys: ["⌘", "Z"], label: "Undo" },
      { keys: ["⌘", "⇧", "Z"], label: "Redo" },
      { keys: ["⌘", "C"], label: "Copy selected clips" },
      { keys: ["⌘", "V"], label: "Paste after selection (or at end)" },
      { keys: ["Esc"], label: "Clear selection" },
    ],
  },
  {
    title: "Selection",
    items: [
      { keys: ["click"], label: "Select clip" },
      { keys: ["⇧", "click"], label: "Add to selection" },
      { keys: ["⌘", "click"], label: "Toggle in selection" },
      { keys: ["⌫"], label: "Delete selected (single or many)" },
    ],
  },
  {
    title: "Tools",
    items: [
      { keys: ["V"], label: "Selection tool" },
      { keys: ["B"], label: "Blade — split clip at playhead" },
      { keys: ["H"], label: "Hand / pan tool" },
      { keys: ["N"], label: "Toggle snap" },
      { keys: ["F"], label: "Effects palette (looks · motion · transitions)" },
    ],
  },
  {
    title: "Animate · Mix",
    items: [
      { keys: ["◇"], label: "Click the diamond in Inspector to capture a keyframe at playhead" },
      { keys: ["⇧ ◇"], label: "Clear all keyframes for that property" },
      { keys: ["X"], label: "Audio mixer (V1 · A1 · A2 · Master)" },
    ],
  },
  {
    title: "Multicam",
    items: [
      { keys: ["⇧", "1–9"], label: "Switch active take of selected clip (alt angles)" },
    ],
  },
  {
    title: "Markers · In/Out",
    items: [
      { keys: ["M"], label: "Drop marker at playhead" },
      { keys: ["⇧", "M"], label: "Open markers panel" },
      { keys: ["I"], label: "Set In point at playhead" },
      { keys: ["O"], label: "Set Out point at playhead" },
      { keys: ["dbl-click marker"], label: "Remove marker" },
      { keys: ["click marker"], label: "Seek to marker" },
    ],
  },
  {
    title: "Timeline",
    items: [
      { keys: ["T"], label: "Drop title card at playhead (V2)" },
      { keys: ["+", "−"], label: "Zoom in / out" },
      { keys: ["⌘", "scroll"], label: "Pinch zoom anchored to cursor" },
      { keys: ["⌫"], label: "Ripple-delete selected clip" },
      { keys: ["drag clip"], label: "Reorder (magnetic)" },
      { keys: ["drag edge"], label: "Trim clip" },
    ],
  },
  {
    title: "AI · Versions",
    items: [
      { keys: ["R"], label: "Regenerate selected clip" },
      { keys: ["⌘", "↵"], label: "Submit regenerate prompt" },
      { keys: ["Esc"], label: "Cancel composer / close panel" },
    ],
  },
  {
    title: "Collaboration",
    items: [
      { keys: ["C"], label: "Toggle comments panel" },
      { keys: ["⌘", "↵"], label: "Post comment (in composer)" },
    ],
  },
  {
    title: "Export · Help",
    items: [
      { keys: ["E"], label: "Open export panel" },
      { keys: ["Q"], label: "Render queue (persistent jobs)" },
      { keys: ["⌘", "P"], label: "Editor command palette" },
      { keys: ["?"], label: "This sheet" },
    ],
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function HelpOverlay({ open, onClose }: Props) {
  return (
    <Surface open={open} onClose={onClose} size="lg" labelledBy="help-title">
      <SurfaceHeader
        id="help-title"
        eyebrow="◆ Keyboard"
        title="Direct from the keyboard."
        description="Every shortcut in one sheet. The editor is keyboard-dense by design."
        onClose={onClose}
      />
      <SurfaceBody>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-7">
          {SHORTCUTS.map((g) => (
            <section key={g.title}>
              <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.30em] mb-3")}>
                ◆ {g.title}
              </div>
              <ul className="space-y-2">
                {g.items.map((s) => (
                  <li
                    key={s.label}
                    className="flex items-center justify-between gap-4 text-[13px]"
                  >
                    <span className="text-foreground/85">{s.label}</span>
                    <span className="flex items-center gap-1 shrink-0">
                      {s.keys.map((k, i) => (
                        <Kbd key={i}>{k}</Kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </SurfaceBody>
      <SurfaceFooter>
        <span>Inputs always win — keys ignored while typing</span>
        <span className="flex items-center gap-1.5">
          <Kbd>?</Kbd>
          <span>any time</span>
        </span>
      </SurfaceFooter>
    </Surface>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5",
        "font-mono text-[10.5px] tabular-nums tracking-[0.04em]",
        "rounded-md border border-white/[0.10] bg-white/[0.03] text-foreground/85",
      )}
    >
      {children}
    </span>
  );
}
