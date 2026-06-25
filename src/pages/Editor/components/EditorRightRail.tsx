/**
 * EditorRightRail — the editor's persistent right rail.
 *
 * Replaces the bare TakesDrawer mount with a tabbed, collapsible
 * container that surfaces every Era 1 capability:
 *
 *   Tab 1 — INSPECTOR
 *     The per-clip Inspector (color grade, effects, audio mix, takes,
 *     transitions, properties). This is the existing TakesDrawer
 *     content; the rail just hosts it.
 *
 *   Tab 2 — TOOLS
 *     Always-on quick-apply toolkit. Surfaces every keyboard-only
 *     surface as a visible action: insert title, add transition,
 *     LUT presets, effect presets, audio presets, regenerate clip,
 *     open the global mixer / VFX composer / Director chat. No
 *     selection required — actions hint at what's missing rather
 *     than disappearing.
 *
 *   Tab 3 — PROJECT
 *     Project-level surfaces that don't belong on a single clip:
 *     master loudness (was buried in Export), all transitions list,
 *     all titles list, total runtime, clip count, export shortcut.
 *
 * The rail can collapse to a 44px vertical strip — chevron in the
 * header, plus the keyboard shortcut `[`. Collapsed state shows just
 * the tab icons. State persists to localStorage so the choice
 * survives reload. The Editor's stage and timeline expand to fill
 * the reclaimed space automatically (the rail is `shrink-0` only
 * when expanded).
 *
 * The tab choice is "sticky" but also responsive: selecting a clip
 * flips the active tab to Inspector if currently on Tools (because
 * the user just clicked a thing they want to inspect). Selecting a
 * transition does the same.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  ChevronLeft, ChevronRight, Sparkles, Wand2, FolderCog, Library as LibraryIcon, Type,
  Film, Volume2, Crown, Layers, ArrowRight, MessageCircle,
  GitBranch, Palette as PaletteIcon, Plus, Download, Search,
  Users, Mic2, AlertTriangle, CaseSensitive, Save, Captions, Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { generateCaptionsForVideo } from "@/lib/editor/auto-captions";
import { generateAndInsertTts } from "@/lib/editor/editor-tts";
import { supabase } from "@/integrations/supabase/client";
import { MyLibraryPanel } from "./MyLibraryPanel";
import { TextStudioPanel } from "@/components/editor/TextStudioPanel";
import { getDocumentState, subscribeDocument } from "@/lib/editor/document-store";
import { selectClip, setClipProperty, setPlayhead } from "@/lib/editor/store";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";
import { toast } from "sonner";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import type { EditorProject, EditorClip, TransitionKind } from "@/lib/editor/types";
import { TRANSITION_LABELS } from "@/lib/editor/types";
import { TakesDrawer } from "./TakesDrawer";
import { useEditor } from "@/hooks/editor/useEditor";
import {
  insertTitleAtPlayhead,
  addTransition,
  applyColorGradeToClips,
  addClipEffect,
  setClipAudioMix,
  setMasterLoudness,
  setAspectRatio,
} from "@/lib/editor/store";
import { ASPECT_RATIOS, type AspectRatio } from "@/lib/editor/types";
import { LUT_LIBRARY } from "@/lib/editor/lut-library";
import { IDENTITY_GRADE } from "@/lib/editor/color-grade";
import { EFFECT_REGISTRY } from "@/lib/editor/effects-registry";
import { newEffectInstance } from "@/lib/editor/effects";
import {
  COMPRESSOR_PRESETS, DEFAULT_AUDIO_MIX, MASTER_LOUDNESS_TILES,
  type MasterLoudnessPreset,
} from "@/lib/editor/audio-mix";

const STORAGE_KEY = "smallbridges.editor.rightRail.v1";

type TabId = "inspector" | "tools" | "text" | "project" | "library";

interface PersistedState {
  collapsed: boolean;
  tab: TabId;
}

function readState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { collapsed: false, tab: "inspector" };
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      collapsed: !!parsed.collapsed,
      tab: parsed.tab === "tools" || parsed.tab === "project" || parsed.tab === "inspector" || parsed.tab === "text" || parsed.tab === "library"
        ? parsed.tab : "inspector",
    };
  } catch {
    return { collapsed: false, tab: "inspector" };
  }
}

function writeState(s: PersistedState): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* quota */ }
}

interface Props {
  project: EditorProject;
  selectedClipId: string | null;
  /** Bus the editor uses to open palettes the rail links to. Each is
   *  optional — when unset, the corresponding tile is hidden so the
   *  rail never advertises an unwired affordance. */
  onOpenEffectsPalette?: () => void;
  onOpenAudioMixer?: () => void;
  onOpenCrossover?: () => void;
  onOpenDirector?: () => void;
  onOpenExport?: () => void;
  onOpenTemplates?: () => void;
}

export function EditorRightRail({
  project, selectedClipId,
  onOpenEffectsPalette, onOpenAudioMixer, onOpenCrossover,
  onOpenDirector, onOpenExport, onOpenTemplates,
}: Props) {
  const [{ collapsed, tab }, setPersist] = useState<PersistedState>(() => readState());

  const setTab = useCallback((next: TabId) => {
    setPersist((p) => {
      const ns = { ...p, tab: next };
      writeState(ns);
      return ns;
    });
  }, []);
  const setCollapsed = useCallback((next: boolean) => {
    setPersist((p) => {
      const ns = { ...p, collapsed: next };
      writeState(ns);
      return ns;
    });
  }, []);

  // NOTE: previously we auto-flipped Tools → Inspector when the user
  // selected a new clip. Removed because users reported that
  // applying an effect on one clip then clicking the next clip to
  // continue editing kept yanking them away from Tools back to
  // Inspector — the rail "reset after selecting an effect." The rail
  // now stays on whichever tab the user explicitly chose; it changes
  // only on direct tab-button click. Selection in the timeline never
  // moves the rail.
  const prevSelectedRef = useRef<string | null>(selectedClipId);
  useEffect(() => {
    prevSelectedRef.current = selectedClipId;
  }, [selectedClipId]);

  // T jumps to the Text tab — mirrors common NLE behavior.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || t?.isContentEditable) return;
      if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        setCollapsed(false);
        setTab("text");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setTab, setCollapsed]);

  // Open the Text tab on demand — fired when the user clicks a text
  // overlay on the timeline (TextOverlayTrack → Timeline onSelect).
  useEffect(() => {
    const onOpenText = () => {
      setCollapsed(false);
      setTab("text");
    };
    window.addEventListener("editor:open-text-tab", onOpenText);
    return () => window.removeEventListener("editor:open-text-tab", onOpenText);
  }, [setTab, setCollapsed]);

  // `[` toggles collapse. Skip when typing in an input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || t?.isContentEditable) return;
      if (e.key === "[") {
        e.preventDefault();
        setCollapsed(!collapsed);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [collapsed, setCollapsed]);

  // ────── Collapsed strip ─────────────────────────────────────────
  if (collapsed) {
    return (
      <aside
        aria-label="Editor right rail (collapsed)"
        className="shrink-0 w-[44px] border-l border-white/[0.04] bg-[hsl(220_30%_4%/0.35)] flex flex-col items-center py-3 gap-2"
      >
        <RailIconButton
          icon={<ChevronLeft className="h-4 w-4" strokeWidth={1.5} />}
          label="Expand rail · ["
          onClick={() => setCollapsed(false)}
          tone="muted"
        />
        <div className="my-2 h-px w-6 bg-white/[0.06]" />
        <RailIconButton
          icon={<Sparkles className="h-4 w-4" strokeWidth={1.5} />}
          label="Inspector"
          active={tab === "inspector"}
          onClick={() => { setCollapsed(false); setTab("inspector"); }}
        />
        <RailIconButton
          icon={<Wand2 className="h-4 w-4" strokeWidth={1.5} />}
          label="Tools"
          active={tab === "tools"}
          onClick={() => { setCollapsed(false); setTab("tools"); }}
        />
        <RailIconButton
          icon={<CaseSensitive className="h-4 w-4" strokeWidth={1.5} />}
          label="Text"
          active={tab === "text"}
          onClick={() => { setCollapsed(false); setTab("text"); }}
        />
        <RailIconButton
          icon={<FolderCog className="h-4 w-4" strokeWidth={1.5} />}
          label="Project"
          active={tab === "project"}
          onClick={() => { setCollapsed(false); setTab("project"); }}
        />
        <RailIconButton
          icon={<LibraryIcon className="h-4 w-4" strokeWidth={1.5} />}
          label="Library"
          active={tab === "library"}
          onClick={() => { setCollapsed(false); setTab("library"); }}
        />
      </aside>
    );
  }

  // ────── Expanded rail ───────────────────────────────────────────
  // Wider to comfortably fit 4 tabs + collapse chevron in the header
  // without truncating any label, and to give Tools / Text / Project
  // panels enough room for sliders + tile grids.
  return (
    <aside
      aria-label="Editor right rail"
      className="shrink-0 w-[380px] border-l border-white/[0.04] bg-[hsl(220_30%_4%/0.35)] flex flex-col min-h-0"
    >
      {/* Header — tab strip + collapse handle. All four tabs share
          equal flex weight; the chevron has a fixed width so it never
          shrinks the tabs into truncation. */}
      <header className="shrink-0 flex items-stretch border-b border-white/[0.04]">
        <div className="flex-1 min-w-0 flex items-stretch">
          <TabButton id="inspector" active={tab === "inspector"} onClick={() => setTab("inspector")}
            icon={<Sparkles className="h-3 w-3" strokeWidth={1.6} />} label="Inspect" />
          <TabButton id="tools" active={tab === "tools"} onClick={() => setTab("tools")}
            icon={<Wand2 className="h-3 w-3" strokeWidth={1.6} />} label="Tools" />
          <TabButton id="text" active={tab === "text"} onClick={() => setTab("text")}
            icon={<CaseSensitive className="h-3 w-3" strokeWidth={1.6} />} label="Text" />
          <TabButton id="project" active={tab === "project"} onClick={() => setTab("project")}
            icon={<FolderCog className="h-3 w-3" strokeWidth={1.6} />} label="Project" />
          <TabButton id="library" active={tab === "library"} onClick={() => setTab("library")}
            icon={<LibraryIcon className="h-3 w-3" strokeWidth={1.6} />} label="Library" />
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="shrink-0 w-9 inline-flex items-center justify-center text-muted-foreground/65 hover:text-foreground transition-colors border-l border-white/[0.04]"
          title="Collapse rail · ["
          aria-label="Collapse rail"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 min-h-0 flex flex-col">
        {tab === "inspector" && (
          // TakesDrawer in embedded mode owns its own width when mounted
          // standalone, but inside the rail we want it to fill the
          // available space. The drawer's outer `<aside w-[340px]>` is
          // shadowed by this wrapper.
          <div className="flex-1 min-h-0 [&>aside]:!w-full [&>aside]:!border-l-0">
            <TakesDrawer project={project} selectedClipId={selectedClipId} embedded />
          </div>
        )}
        {tab === "tools" && (
          <ToolsPanel
            project={project}
            selectedClipId={selectedClipId}
            onRequestInspector={() => setTab("inspector")}
            onOpenEffectsPalette={onOpenEffectsPalette}
            onOpenAudioMixer={onOpenAudioMixer}
            onOpenCrossover={onOpenCrossover}
            onOpenDirector={onOpenDirector}
            onOpenTemplates={onOpenTemplates}
          />
        )}
        {tab === "text" && (
          <TextTabBody project={project} />
        )}
        {tab === "project" && (
          <ProjectPanel project={project} onOpenExport={onOpenExport} />
        )}
        {tab === "library" && (
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
            <div className="px-5 py-5">
              <MyLibraryPanel project={project} />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TabButton — top-of-rail tab pill
// ─────────────────────────────────────────────────────────────────────────────
function TabButton({
  active, onClick, icon, label,
}: { id: TabId; active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={cn(
        "flex-1 min-w-0 group/tab relative inline-flex items-center justify-center gap-1.5 h-10 px-1.5",
        "text-[10px] font-mono uppercase tracking-[0.18em] transition-colors",
        active
          ? "text-foreground bg-[hsl(var(--accent)/0.06)]"
          : "text-muted-foreground/65 hover:text-foreground hover:bg-white/[0.02]",
      )}
    >
      <span className={cn("shrink-0", active ? "text-accent" : "text-muted-foreground/55")}>{icon}</span>
      <span className="truncate">{label}</span>
      {active && (
        <span aria-hidden className="absolute inset-x-2 bottom-0 h-px bg-accent/65" />
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RailIconButton — collapsed-strip button
// ─────────────────────────────────────────────────────────────────────────────
function RailIconButton({
  icon, label, onClick, active, tone,
}: { icon: React.ReactNode; label: string; onClick: () => void; active?: boolean; tone?: "muted" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex items-center justify-center h-8 w-8 rounded-md transition-all",
        active
          ? "bg-[hsl(var(--accent)/0.10)] text-accent ring-1 ring-inset ring-accent/30"
          : tone === "muted"
            ? "text-muted-foreground/60 hover:text-foreground hover:bg-white/[0.04]"
            : "text-foreground/75 hover:text-foreground hover:bg-white/[0.04]",
      )}
    >
      {icon}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOLS PANEL — always-on quick-apply toolkit
// ─────────────────────────────────────────────────────────────────────────────
function ToolsPanel({
  project, selectedClipId, onRequestInspector,
  onOpenEffectsPalette, onOpenAudioMixer, onOpenCrossover, onOpenDirector, onOpenTemplates,
}: {
  project: EditorProject;
  selectedClipId: string | null;
  /** Switch the rail to the Inspector tab. Threaded from the parent
   *  because ToolsPanel is a module-level component and can't reach the
   *  parent's setTab directly. */
  onRequestInspector?: () => void;
  onOpenEffectsPalette?: () => void;
  onOpenAudioMixer?: () => void;
  onOpenCrossover?: () => void;
  onOpenDirector?: () => void;
  onOpenTemplates?: () => void;
}) {
  const allClips = useMemo(
    () => project.scenes.flatMap((s) => s.clips).filter((c) => c.kind === "video"),
    [project],
  );
  const selectedClipIds = selectedClipId ? [selectedClipId] : [];
  const targetIds = selectedClipIds.length > 0 ? selectedClipIds : allClips.map((c) => c.id);
  const needsSelection = selectedClipIds.length === 0;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
      <div className="px-5 py-5 space-y-7">
        <SectionHint
          title="Quick tools"
          hint={needsSelection
            ? `No clip selected — actions apply to all ${allClips.length} clips`
            : `Apply to ${selectedClipIds.length} selected ${selectedClipIds.length === 1 ? "clip" : "clips"}`}
        />

        {/* — Search — jumps the playhead to the first matching clip */}
        <ClipSearchSection allClips={allClips} />

        {/* — Cast picker — applies a Character (from ScriptDocument)
              to the selected clip's properties so Regenerate can use
              identityDNA. Empty when no script document loaded. */}
        <CastPickerSection targetClipId={selectedClipId} />

        {/* — Voice picker — same shape as Cast for VoiceProfile. */}
        <VoicePickerSection targetClipId={selectedClipId} />

        {/* — Insert / structure — */}
        <Group label="Insert">
          <ToolTile
            icon={<Type className="h-3.5 w-3.5" />}
            title="Title at playhead"
            hint="3s overlay · V2 track"
            onClick={() => {
              const id = insertTitleAtPlayhead();
              if (id) toast.success("Title inserted — double-click on the timeline to edit");
            }}
          />
          <TransitionPicker
            disabled={selectedClipIds.length < 1 || allClips.length < 2}
            onPick={(kind, label) => {
              if (!selectedClipId) return;
              const idx = allClips.findIndex((c) => c.id === selectedClipId);
              const next = allClips[idx + 1];
              if (!next) { toast.message("No clip after this one"); return; }
              addTransition(selectedClipId, next.id, kind, 0.6);
              toast.success(`Transition: ${label}`, {
                description: "Plays between this clip and the next on render. Tweak duration in Takes drawer.",
              });
            }}
          />
          <ToolTile
            icon={<Plus className="h-3.5 w-3.5" />}
            title="Regenerate clip · R"
            hint="Spin a new take"
            disabled={!selectedClipId}
            disabledHint="Select a clip first"
            onClick={() => {
              // The R-key composer lives in TakesDrawer, which only mounts on
              // the Inspector tab. Dispatching the synthetic key from here (the
              // Tools tab) hit no listener. Switch to Inspector first, then fire
              // R once TakesDrawer (and its listener) has mounted.
              // NOTE: setTab lives on the parent EditorRightRail — ToolsPanel
              // is module-level and can't reach it, so it's threaded in as
              // onRequestInspector. Calling setTab here was a ReferenceError
              // that crashed the handler before the key ever dispatched.
              onRequestInspector?.();
              setTimeout(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "R" })), 80);
            }}
          />
        </Group>

        {/* — Color presets — */}
        <Group label="Color · LUT presets">
          <p className={cn(TYPE_META, "text-muted-foreground/55 mb-2")}>
            Click to apply · {needsSelection ? "all clips" : `${selectedClipIds.length} selected`}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {LUT_QUICK_PICKS.map((id) => {
              const lut = LUT_LIBRARY.find((l) => l.id === id);
              if (!lut) return null;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    const n = applyColorGradeToClips({ ...IDENTITY_GRADE, lutId: id, lutMix: 1 }, targetIds);
                    toast.success(`Applied ${lut.name}`, {
                      description: n > 0
                        ? `${n} clip${n === 1 ? "" : "s"} graded — open the preview to see it`
                        : "No clips on the timeline to grade — drop a clip first.",
                    });
                  }}
                  className="text-left rounded-lg ring-1 ring-inset ring-white/[0.05] hover:ring-white/[0.18] bg-white/[0.02] hover:bg-white/[0.05] px-3 py-2 transition-all"
                >
                  <div className="text-[12.5px] text-foreground/95 truncate">{lut.name}</div>
                  <div className={cn(TYPE_META, "text-muted-foreground/55 mt-0.5 truncate")}>{lut.category}</div>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              const n = applyColorGradeToClips(IDENTITY_GRADE, targetIds);
              toast.success(`Color reset on ${n} clip${n === 1 ? "" : "s"}`);
            }}
            className={cn(TYPE_META, "mt-2 text-muted-foreground/65 hover:text-foreground inline-flex items-center gap-1.5 transition-colors")}
          >
            Reset to identity <ArrowRight className="h-3 w-3" />
          </button>
        </Group>

        {/* — VFX presets — */}
        <Group label="VFX · Effect presets">
          <p className={cn(TYPE_META, "text-muted-foreground/55 mb-2")}>
            Adds an effect instance to {needsSelection ? "all clips" : "the selected clip"}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {EFFECT_QUICK_PICKS.map((slug) => {
              const meta = EFFECT_REGISTRY.find((r) => r.slug === slug);
              if (!meta) return null;
              const Icon = meta.icon;
              return (
                <button
                  key={slug}
                  type="button"
                  onClick={() => {
                    const fx = newEffectInstance(meta.slug, meta.modes[0] ?? "sustained");
                    let count = 0;
                    for (const id of targetIds) { addClipEffect(id, { ...fx, id: `${fx.id}-${count++}` }); }
                    toast.success(`${meta.name} added to ${count} clip${count === 1 ? "" : "s"}`);
                  }}
                  className="text-left rounded-lg ring-1 ring-inset ring-white/[0.05] hover:ring-white/[0.18] bg-white/[0.02] hover:bg-white/[0.05] px-3 py-2 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-accent/85" strokeWidth={1.5} />
                    <div className="text-[12.5px] text-foreground/95 truncate">{meta.name}</div>
                  </div>
                  <div className={cn(TYPE_META, "text-muted-foreground/55 mt-0.5 truncate")}>{meta.category}</div>
                </button>
              );
            })}
          </div>
          {onOpenEffectsPalette && (
            <button
              type="button"
              onClick={onOpenEffectsPalette}
              className={cn(TYPE_META, "mt-2 text-accent/85 hover:text-accent inline-flex items-center gap-1.5 transition-colors")}
            >
              All 20 recipes · F <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </Group>

        {/* — Audio presets — */}
        <Group label="Audio · Compressor presets">
          <p className={cn(TYPE_META, "text-muted-foreground/55 mb-2")}>
            Drops a compressor onto {needsSelection ? "all clips" : "the selected clip"}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {AUDIO_QUICK_PICKS.map((key) => {
              const preset = COMPRESSOR_PRESETS[key];
              if (!preset) return null;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    for (const id of targetIds) {
                      const target = allClips.find((c) => c.id === id);
                      const baseMix = target?.properties?.audioMix ?? DEFAULT_AUDIO_MIX;
                      setClipAudioMix(id, {
                        ...baseMix,
                        compressor: { ...preset, enabled: true },
                      });
                    }
                    toast.success(`${AUDIO_PRESET_LABELS[key]} compressor applied`);
                  }}
                  className="text-left rounded-lg ring-1 ring-inset ring-white/[0.05] hover:ring-white/[0.18] bg-white/[0.02] hover:bg-white/[0.05] px-3 py-2 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-3.5 w-3.5 text-accent/85" strokeWidth={1.5} />
                    <div className="text-[12.5px] text-foreground/95 truncate">{AUDIO_PRESET_LABELS[key]}</div>
                  </div>
                  <div className={cn(TYPE_META, "text-muted-foreground/55 mt-0.5 truncate")}>
                    {preset.ratio.toFixed(1)}:1 · {preset.threshold.toFixed(0)} dB
                  </div>
                </button>
              );
            })}
          </div>
          {onOpenAudioMixer && (
            <button
              type="button"
              onClick={onOpenAudioMixer}
              className={cn(TYPE_META, "mt-2 text-accent/85 hover:text-accent inline-flex items-center gap-1.5 transition-colors")}
            >
              Global mixer · X <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </Group>

        {/* — Voice over (TTS) — */}
        <Group label="Voice over">
          <p className={cn(TYPE_META, "text-muted-foreground/55 mb-2")}>
            ElevenLabs voice synthesis · lands on A1 (voice) track
          </p>
          <VoiceOverPanel projectId={project.id} />
        </Group>

        {/* — Auto-captions — runs on the selected clip's video */}
        <Group label="Auto-captions">
          <AutoCaptionsTile
            allClips={allClips}
            selectedClipId={selectedClipId}
          />
        </Group>

        {/* — Open palettes / panels — */}
        <Group label="Open">
          {onOpenTemplates && (
            <ToolTile
              icon={<Sparkles className="h-3.5 w-3.5" />}
              title="Templates"
              hint="50 one-click looks · video + audio"
              onClick={onOpenTemplates}
            />
          )}
          {onOpenCrossover && (
            <ToolTile
              icon={<Layers className="h-3.5 w-3.5" />}
              title="Crossover composer · ⇧V"
              hint="Compose a VFX shot"
              onClick={onOpenCrossover}
            />
          )}
          {onOpenDirector && (
            <ToolTile
              icon={<MessageCircle className="h-3.5 w-3.5" />}
              title="Director chat · ⌘/"
              hint="Brief the assistant"
              onClick={onOpenDirector}
            />
          )}
        </Group>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VoiceOverPanel — TTS composer in the Tools tab. Text input + voice
// picker (stub list of ElevenLabs voice ids) + generate button. On
// success a new A1 audio clip lands on the timeline via the
// generateAndInsertTts helper which closes the loop the edge function
// used to leave open.
// ─────────────────────────────────────────────────────────────────────────────
const VOICE_PICKS: Array<{ id: string; label: string; sub: string }> = [
  { id: "JBFqnCBsd6RMkjVDRZzb", label: "George",  sub: "Warm narrator" },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah",   sub: "Bright, clear" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", label: "Liam",    sub: "Casual male" },
  { id: "XB0fDUnXU5powFXDhCwa", label: "Charlotte", sub: "Soft, friendly" },
];

function VoiceOverPanel({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [voiceId, setVoiceId] = useState<string>(VOICE_PICKS[0].id);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    if (!user) {
      toast.error("Sign in to generate voice over");
      return;
    }
    if (projectId === "no-project") {
      toast.error("Open or create a project first");
      return;
    }
    setSubmitting(true);
    try {
      const result = await generateAndInsertTts({
        text: trimmed,
        projectId,
        userId: user.id,
        voiceId,
      });
      if (result) {
        toast.success("Voice over added to A1", {
          description: "It's on the timeline now — Cmd-Z to remove.",
        });
        setText("");
      } else {
        toast.error("TTS returned no audio");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "TTS failed";
      toast.error("Voice over failed", { description: msg, duration: 9000 });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-2.5">
      <textarea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 1200))}
        placeholder="Type the line you'd like spoken…"
        className={cn(
          "block w-full resize-none rounded-md px-3 py-2",
          "bg-white/[0.03] text-foreground placeholder:text-foreground/40",
          "text-[13px] leading-snug",
          "ring-1 ring-inset ring-white/[0.06] focus:ring-accent/45 outline-none",
        )}
      />
      <div>
        <div className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.22em] mb-1.5")}>
          Voice
        </div>
        <select
          value={voiceId}
          onChange={(e) => setVoiceId(e.target.value)}
          className="w-full rounded-md bg-white/[0.03] ring-1 ring-inset ring-white/[0.06] focus:ring-white/[0.18] outline-none px-3 h-9 text-[12.5px] text-foreground"
        >
          {VOICE_PICKS.map((v) => (
            <option key={v.id} value={v.id} className="bg-[hsl(220_30%_8%)]">
              {v.label} · {v.sub}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={() => void submit()}
        disabled={!text.trim() || submitting}
        className={cn(
          "w-full inline-flex items-center justify-center gap-2 h-9 rounded-md",
          "bg-white/[0.04] ring-1 ring-inset ring-white/[0.08]",
          "text-[12.5px] text-foreground/90 hover:bg-white/[0.07] hover:ring-white/[0.16] transition-all",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        )}
      >
        {submitting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" strokeWidth={1.5} />
        ) : (
          <Mic2 className="h-3.5 w-3.5 text-accent/85" strokeWidth={1.5} />
        )}
        <span>{submitting ? "Synthesizing…" : "Generate voice over"}</span>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AutoCaptionsTile — runs generateCaptionsForVideo on the selected clip
// (or first clip with a videoUrl when nothing is selected).
// ─────────────────────────────────────────────────────────────────────────────
function AutoCaptionsTile({
  allClips, selectedClipId,
}: {
  allClips: EditorClip[];
  selectedClipId: string | null;
}) {
  const [running, setRunning] = useState(false);
  const target = useMemo(() => {
    if (selectedClipId) {
      return allClips.find((c) => c.id === selectedClipId) ?? null;
    }
    return allClips.find((c) => !!c.videoUrl) ?? null;
  }, [allClips, selectedClipId]);

  const onClick = async () => {
    if (running) return;
    if (!target?.videoUrl) {
      toast.error("Select a clip with a rendered video first");
      return;
    }
    setRunning(true);
    try {
      const { inserted } = await generateCaptionsForVideo(target.videoUrl);
      if (inserted === 0) {
        toast.message("No speech detected", {
          description: "Scribe found nothing to transcribe.",
        });
      } else {
        toast.success(`${inserted} caption${inserted === 1 ? "" : "s"} added`, {
          description: "Styled with the subtitle template.",
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't generate captions";
      toast.error("Auto-captions failed", { description: msg, duration: 9000 });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className={cn(TYPE_META, "text-muted-foreground/55")}>
        {target
          ? selectedClipId
            ? "Transcribe the selected clip · ElevenLabs Scribe v2"
            : "Transcribe the first rendered clip · ElevenLabs Scribe v2"
          : "Generate a clip first so there's something to transcribe."}
      </p>
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={running || !target?.videoUrl}
        className={cn(
          "w-full inline-flex items-center justify-center gap-2 h-9 rounded-md",
          "bg-white/[0.04] ring-1 ring-inset ring-white/[0.08]",
          "text-[12.5px] text-foreground/90 hover:bg-white/[0.07] hover:ring-white/[0.16] transition-all",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        )}
      >
        {running ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" strokeWidth={1.5} />
        ) : (
          <Captions className="h-3.5 w-3.5 text-accent/85" strokeWidth={1.5} />
        )}
        <span>{running ? "Transcribing…" : "Auto-generate captions"}</span>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT PANEL — project-level state, not per-clip
// ─────────────────────────────────────────────────────────────────────────────
function ProjectPanel({
  project, onOpenExport,
}: {
  project: EditorProject;
  onOpenExport?: () => void;
}) {
  const { masterLoudness, transitions } = project;
  const totalClips = project.scenes.reduce((sum, s) => sum + s.clips.length, 0);
  const titleCount = project.scenes.reduce(
    (sum, s) => sum + s.clips.filter((c) => c.kind === "title").length, 0,
  );

  return (
    <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
      <div className="px-5 py-5 space-y-7">
        <SectionHint
          title="Project state"
          hint="Settings that apply to the whole edit"
        />

        {/* Stats */}
        <Group label="Summary">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Runtime" value={fmtDuration(project.durationSec)} />
            <Stat label="Clips"   value={String(totalClips)} />
            <Stat label="Titles"  value={String(titleCount)} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Stat label="Transitions" value={String(transitions?.length ?? 0)} />
            <AspectStat project={project} />
            <Stat label="Status"      value={project.status} />
          </div>
        </Group>

        {/* Master loudness */}
        <Group label="Delivery loudness">
          <p className={cn(TYPE_META, "text-muted-foreground/55 mb-3")}>
            Applied after the audio xfade chain at export · EBU R128
          </p>
          <div className="space-y-1.5">
            {MASTER_LOUDNESS_TILES.map((tile) => {
              const active = (masterLoudness ?? "off") === tile.preset;
              return (
                <button
                  key={tile.preset}
                  type="button"
                  onClick={() => setMasterLoudness(tile.preset as MasterLoudnessPreset)}
                  className={cn(
                    "w-full text-left rounded-lg px-3 py-2 transition-all ring-1 ring-inset",
                    active
                      ? "ring-accent/55 bg-[hsl(var(--accent)/0.07)]"
                      : "ring-white/[0.05] hover:ring-white/[0.18] hover:bg-white/[0.02]",
                  )}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[12.5px] text-foreground/95">{tile.title}</span>
                    <span className="font-mono text-[11px] tabular-nums text-accent/85">{tile.target}</span>
                  </div>
                  <div className={cn(TYPE_META, "text-muted-foreground/55 mt-0.5 truncate")}>
                    {tile.platforms}
                  </div>
                </button>
              );
            })}
          </div>
        </Group>

        {/* Transitions list */}
        {transitions && transitions.length > 0 && (
          <Group label={`Transitions · ${transitions.length}`}>
            <ul className="space-y-1.5">
              {transitions.slice(0, 12).map((t) => (
                <li key={t.id} className="flex items-center justify-between rounded-md px-3 py-1.5 bg-white/[0.02] ring-1 ring-inset ring-white/[0.04]">
                  <span className="text-[12px] text-foreground/85 truncate">
                    {t.kind}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground/65">
                    {t.durationSec.toFixed(2)}s
                  </span>
                </li>
              ))}
              {transitions.length > 12 && (
                <li className={cn(TYPE_META, "text-muted-foreground/45 pt-1")}>
                  +{transitions.length - 12} more
                </li>
              )}
            </ul>
          </Group>
        )}

        {/* Export shortcut — Save lives in the top header bar now. */}
        {onOpenExport && (
          <Group label="Ship it">
            <p className={cn(TYPE_META, "text-muted-foreground/55 mb-1")}>
              Auto-save runs continuously. Use the Save icon in the top
              header bar to mark this project Complete; then Publish
              from Export to push it to the Lobby.
            </p>
            <button
              type="button"
              onClick={onOpenExport}
              className={cn(
                "w-full inline-flex items-center justify-center gap-2 px-4 h-10 rounded-full",
                "border border-accent/40 bg-gradient-to-br from-accent/20 to-accent/5",
                "text-[13px] text-foreground hover:border-accent/60 hover:from-accent/30 transition-all",
              )}
            >
              <Download className="h-4 w-4 text-accent" strokeWidth={1.5} />
              <span>Open Export · E</span>
            </button>
          </Group>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared pieces
// ─────────────────────────────────────────────────────────────────────────────
function SectionHint({ title, hint }: { title: string; hint: string }) {
  return (
    <div>
      <div className={cn(TYPE_META, "text-amber-300/85 tracking-[0.34em] inline-flex items-center gap-2")}>
        <Crown className="h-3 w-3" strokeWidth={1.8} />◆ {title}
      </div>
      <p className={cn(TYPE_META, "mt-2 text-muted-foreground/55 leading-relaxed")}>{hint}</p>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.30em] mb-3")}>
        ◆ {label}
      </h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function ToolTile({
  icon, title, hint, onClick, disabled, disabledHint,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
  disabledHint?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => { if (!disabled) onClick(); }}
      disabled={disabled}
      title={disabled ? disabledHint : undefined}
      className={cn(
        "group/tile w-full text-left flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all ring-1 ring-inset",
        disabled
          ? "ring-white/[0.04] bg-white/[0.01] opacity-60 cursor-not-allowed"
          : "ring-white/[0.06] hover:ring-white/[0.20] bg-white/[0.02] hover:bg-white/[0.05]",
      )}
    >
      <span className={cn(
        "shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-md",
        disabled ? "bg-white/[0.02] text-muted-foreground/45" : "bg-[hsl(var(--accent)/0.08)] text-accent",
      )}>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[12.5px] text-foreground/95 truncate">{title}</div>
        <div className={cn(TYPE_META, "text-muted-foreground/55 mt-0.5 truncate")}>
          {disabled ? disabledHint ?? hint : hint}
        </div>
      </div>
    </button>
  );
}

/**
 * TransitionPicker — replaces the single hardcoded "Crossfade boundary"
 * button. Surfaces every TransitionKind grouped by family so the user
 * can discover PowerPoint-style wipes/slides/circles without leaving
 * the right rail.
 */
function TransitionPicker({
  disabled, onPick,
}: {
  disabled: boolean;
  onPick: (kind: TransitionKind, label: string) => void;
}) {
  const families: { label: string; kinds: TransitionKind[] }[] = [
    { label: "Crossfades", kinds: ["fade", "dissolve", "fadeblack", "fadewhite"] },
    { label: "Wipes",      kinds: ["wipeleft", "wiperight", "wipeup", "wipedown"] },
    { label: "Slides",     kinds: ["slideleft", "slideright", "slideup", "slidedown"] },
    { label: "Specials",   kinds: ["circleopen", "circleclose", "radial", "smoothleft", "smoothright"] },
  ];
  return (
    <div className={cn(
      "rounded-lg ring-1 ring-inset px-3 py-3 space-y-3",
      disabled ? "ring-white/[0.04] bg-white/[0.01] opacity-60" : "ring-white/[0.06] bg-white/[0.02]",
    )}>
      <div className="flex items-baseline justify-between">
        <div className="text-[12.5px] text-foreground/95">Transition · boundary</div>
        <div className={cn(TYPE_META, "text-muted-foreground/55")}>
          {disabled ? "select a clip with a neighbor" : "click to add"}
        </div>
      </div>
      {families.map((fam) => (
        <div key={fam.label}>
          <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.24em] mb-1.5")}>
            {fam.label}
          </div>
          <div className="grid grid-cols-2 gap-1">
            {fam.kinds.map((k) => (
              <button
                key={k}
                type="button"
                disabled={disabled}
                onClick={() => { if (!disabled) onPick(k, TRANSITION_LABELS[k]); }}
                className={cn(
                  "rounded-md px-2 py-1.5 text-left text-[12px] text-foreground/95 ring-1 ring-inset transition-colors",
                  disabled
                    ? "ring-white/[0.04] bg-white/[0.01] cursor-not-allowed text-muted-foreground/45"
                    : "ring-white/[0.05] bg-white/[0.02] hover:bg-white/[0.06] hover:ring-white/[0.18]",
                )}
              >
                {TRANSITION_LABELS[k]}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * AspectStat — replaces the read-only Aspect Stat tile with an inline
 * <select>. Updates the in-memory project immediately (so PlayerCanvas
 * remeasures) and persists movie_projects.aspect_ratio in the same
 * tick. We don't bother with optimistic-rollback because the local
 * mutation already wins on the next render — the DB write just makes
 * it survive a reload.
 */
function AspectStat({ project }: { project: EditorProject }) {
  return (
    <div className="rounded-md bg-white/[0.02] ring-1 ring-inset ring-white/[0.04] px-3 py-2">
      <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.22em]")}>Aspect</div>
      <select
        value={project.aspectRatio}
        onChange={(e) => {
          const next = e.target.value as AspectRatio;
          setAspectRatio(next);
          void supabase
            .from("movie_projects")
            .update({ aspect_ratio: next })
            .eq("id", project.id)
            .then(({ error }) => {
              if (error) {
                toast.error("Aspect ratio saved locally but DB write failed", {
                  description: safeErrorMessage(error, "Please try again."),
                });
              }
            });
        }}
        className="mt-0.5 w-full bg-transparent font-mono text-[12.5px] tabular-nums text-foreground/95 outline-none cursor-pointer hover:text-accent transition-colors"
      >
        {(Object.entries(ASPECT_RATIOS) as Array<[AspectRatio, { label: string }]>).map(([k, v]) => (
          <option key={k} value={k} className="bg-[hsl(220_30%_8%)]">
            {k} · {v.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white/[0.02] ring-1 ring-inset ring-white/[0.04] px-3 py-2">
      <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.22em]")}>{label}</div>
      <div className="mt-0.5 font-mono text-[12.5px] tabular-nums text-foreground/95 truncate">
        {value}
      </div>
    </div>
  );
}

function fmtDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Text tab body — thin wrapper that subscribes to the playhead so new
// overlays land at the current time rather than 0:00.
// ─────────────────────────────────────────────────────────────────────────────
function TextTabBody({ project }: { project: EditorProject }) {
  const { playheadSec } = useEditor();
  return <TextStudioPanel project={project} playheadSec={playheadSec} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Clip search — fuzzy match against clip.prompt, jumps playhead on click
// ─────────────────────────────────────────────────────────────────────────────
function ClipSearchSection({ allClips }: { allClips: EditorClip[] }) {
  const [q, setQ] = useState("");
  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [] as EditorClip[];
    return allClips
      .filter((c) => (c.prompt ?? "").toLowerCase().includes(needle))
      .slice(0, 6);
  }, [allClips, q]);

  return (
    <Group label="Search clips">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/45" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search clip prompts…"
          className="w-full pl-9 pr-3 h-9 rounded-md bg-white/[0.03] ring-1 ring-inset ring-white/[0.06] focus:ring-white/[0.18] outline-none text-[12.5px] text-foreground placeholder:text-muted-foreground/45 transition-all"
        />
      </div>
      {q.trim() !== "" && (
        matches.length === 0 ? (
          <p className={cn(TYPE_META, "text-muted-foreground/55 mt-2 px-1")}>
            No clip matches “{q.trim()}”
          </p>
        ) : (
          <ul className="mt-2 space-y-1">
            {matches.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    selectClip(c.id);
                    setPlayhead(c.timelineStartSec);
                    setQ("");
                  }}
                  className="w-full text-left rounded-md px-2.5 py-1.5 ring-1 ring-inset ring-white/[0.05] hover:ring-white/[0.18] bg-white/[0.02] hover:bg-white/[0.05] transition-all flex items-center gap-2"
                >
                  <Film className="h-3 w-3 text-accent shrink-0" strokeWidth={1.6} />
                  <span className="min-w-0 flex-1 text-[12px] text-foreground/95 truncate">
                    {c.prompt || "Untitled clip"}
                  </span>
                  <span className={cn(TYPE_META, "shrink-0 text-muted-foreground/55 tabular-nums")}>
                    {fmtTimecode(c.timelineStartSec)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )
      )}
    </Group>
  );
}

function fmtTimecode(sec: number): string {
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cast picker — pulls from ScriptDocument.cast[]
// ─────────────────────────────────────────────────────────────────────────────
function CastPickerSection({ targetClipId }: { targetClipId: string | null }) {
  const docState = useSyncExternalStore(subscribeDocument, getDocumentState, getDocumentState);
  const cast = docState.doc?.cast ?? [];

  if (cast.length === 0) {
    return (
      <Group label="Cast">
        <EmptyRow icon={<Users className="h-3.5 w-3.5" />} hint="No characters in this project's script. Open Director chat to draft one — or generate a project to seed the cast." />
      </Group>
    );
  }
  return (
    <Group label={`Cast · ${cast.length}`}>
      <p className={cn(TYPE_META, "text-muted-foreground/55 mb-2")}>
        {targetClipId ? "Anchor this clip's character" : "Select a clip first"}
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {cast.map((ch) => (
          <button
            key={ch.id}
            type="button"
            disabled={!targetClipId}
            onClick={() => {
              if (!targetClipId) return;
              setClipProperty(targetClipId, { characterId: ch.id });
              toast.success(`${ch.name} anchored to clip`);
            }}
            className={cn(
              "text-left rounded-lg ring-1 ring-inset px-3 py-2 transition-all",
              targetClipId
                ? "ring-white/[0.06] hover:ring-white/[0.18] bg-white/[0.02] hover:bg-white/[0.05]"
                : "ring-white/[0.03] bg-white/[0.01] opacity-50 cursor-not-allowed",
            )}
          >
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-accent/85" strokeWidth={1.5} />
              <span className="text-[12.5px] text-foreground/95 truncate">{ch.name}</span>
            </div>
            <div className={cn(TYPE_META, "text-muted-foreground/55 mt-0.5 truncate")}>{ch.role}</div>
          </button>
        ))}
      </div>
    </Group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Voice picker — pulls from ScriptDocument.voices[]
// ─────────────────────────────────────────────────────────────────────────────
function VoicePickerSection({ targetClipId }: { targetClipId: string | null }) {
  const docState = useSyncExternalStore(subscribeDocument, getDocumentState, getDocumentState);
  const voices = docState.doc?.voices ?? [];

  if (voices.length === 0) {
    return (
      <Group label="Voice">
        <EmptyRow icon={<Mic2 className="h-3.5 w-3.5" />} hint="No voice profiles. Voices are seeded when a project's narration / dialogue is authored — Training Video and Hollywood pipelines both write them." />
      </Group>
    );
  }
  return (
    <Group label={`Voice · ${voices.length}`}>
      <p className={cn(TYPE_META, "text-muted-foreground/55 mb-2")}>
        {targetClipId ? "Set voice for dialogue / VO generation" : "Select a clip first"}
      </p>
      <div className="grid grid-cols-1 gap-1.5">
        {voices.map((v) => (
          <button
            key={v.id}
            type="button"
            disabled={!targetClipId}
            onClick={() => {
              if (!targetClipId) return;
              setClipProperty(targetClipId, { voiceProfileId: v.id });
              toast.success(`Voice set to ${v.name}`);
            }}
            className={cn(
              "text-left rounded-lg ring-1 ring-inset px-3 py-2 transition-all flex items-center gap-3",
              targetClipId
                ? "ring-white/[0.06] hover:ring-white/[0.18] bg-white/[0.02] hover:bg-white/[0.05]"
                : "ring-white/[0.03] bg-white/[0.01] opacity-50 cursor-not-allowed",
            )}
          >
            <Mic2 className="h-3.5 w-3.5 text-accent/85 shrink-0" strokeWidth={1.5} />
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] text-foreground/95 truncate">{v.name}</div>
              <div className={cn(TYPE_META, "text-muted-foreground/55 mt-0.5 truncate")}>
                {v.provider}{v.registers?.length ? ` · ${v.registers.slice(0, 3).join(" · ")}` : ""}
              </div>
            </div>
            {v.previewUrl && (
              <a
                href={v.previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={cn(TYPE_META, "shrink-0 text-muted-foreground/65 hover:text-foreground")}
                title="Preview voice sample"
              >
                Sample
              </a>
            )}
          </button>
        ))}
      </div>
    </Group>
  );
}

function EmptyRow({ icon, hint }: { icon: React.ReactNode; hint: string }) {
  return (
    <div className="rounded-lg ring-1 ring-inset ring-white/[0.04] bg-white/[0.01] px-3 py-3 flex items-start gap-2.5">
      <span className="shrink-0 mt-0.5 text-muted-foreground/55">
        <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.5} />
      </span>
      <div className="min-w-0">
        <div className="text-[12px] text-foreground/80 inline-flex items-center gap-1.5">
          <span className="text-muted-foreground/65">{icon}</span>
          <span>Nothing here yet</span>
        </div>
        <p className={cn(TYPE_META, "text-muted-foreground/55 mt-1 leading-relaxed")}>{hint}</p>
      </div>
    </div>
  );
}

// Curated quick picks — chosen to span a wide tonal range without
// drowning the rail in 30+ tiles. The "All recipes" links in the
// Tools panel give power users access to the full registries.
const LUT_QUICK_PICKS = [
  "kodak-2383", "fuji-eterna", "portra-400",
  "teal-orange", "bladerunner-2049", "wong-kar-wai",
];

const EFFECT_QUICK_PICKS: import("@/lib/editor/effects").RecipeSlug[] = [
  "light_beam", "neon_zap", "particle_burst", "smoke_burst",
  "static_fizz", "ink_bloom",
];

const AUDIO_QUICK_PICKS: Array<keyof typeof COMPRESSOR_PRESETS> = [
  "voice", "music", "drum", "broadcast",
];

const AUDIO_PRESET_LABELS: Record<keyof typeof COMPRESSOR_PRESETS, string> = {
  voice:     "Voice",
  music:     "Music",
  drum:      "Drum",
  broadcast: "Broadcast",
  limiter:   "Limiter",
};
