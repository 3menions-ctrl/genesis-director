/**
 * Script — the screenplay surface, document-driven, richly visual.
 *
 * Reads from the ScriptDocument (via document-store) when present.
 * Falls back to the legacy parser on script_content when the doc
 * hasn't been hydrated yet.
 *
 * What you see, top to bottom:
 *
 *   Header        Title, word count, scenes/clips, redraft/edit.
 *
 *   Cast strip    Round avatars of every character. Click any to
 *                 open the Cast editor + inline-edit identity DNA +
 *                 reference image. Missing-identity warning chip
 *                 surfaces when a character has no DNA.
 *
 *   Scene strip   Horizontal scroller of slug-line chips. Click to
 *                 seek the playhead to that scene's first shot.
 *
 *   Pending draft When generated_script meaningfully differs from
 *                 script_content, an amber banner surfaces with
 *                 Approve / Discard.
 *
 *   For each scene:
 *     ◆ Slug-line + timecode + mood / time-of-day badges
 *     ◆ Action paragraphs (Fraunces italic body)
 *     ◆ Dialogue blocks WITH SPEAKER AVATAR on the left, character
 *       cue centered, dialogue text centered Fraunces italic at
 *       72% width. Audio-bus badge on hover.
 *     ◆ Shot strip — visual cards per Shot showing:
 *         • Clip thumbnail (or last-frame fallback)
 *         • Frame-chain indicator when this shot inherits the
 *           previous shot's last frame (arrow from prev → this)
 *         • Engine pill + duration + cost credits
 *         • Approval state pill (draft / ready / rendering / etc)
 *         • Click → seeks playhead + selects the underlying clip
 *
 *   Live cursor   As playback runs, the active block (and active
 *                 shot card) highlight with the accent rail.
 *                 Auto-scroll keeps them in view.
 *
 * Edit UI:
 *   - Click any action/dialogue block → just that block enters
 *     inline edit. ⌘↵ saves to the document; Esc cancels. The rest
 *     of the screenplay stays read-only the whole time.
 *   - Click any character cue → opens the cast editor focused on
 *     that character.
 *   - Click a shot card's approve CTA → setShotApproval + enqueue
 *     via orchestrator (the same gate the inspector uses).
 */

import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Layers,
  Check,
  Loader2,
  Pencil,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  AlertOctagon,
  UserCircle2,
  AlertTriangle,
  Plus,
  Mic,
  Music2,
  Disc3,
  ArrowRight,
  Film,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE_META, EASE_PREMIUM } from "@/lib/design-system";
import type { EditorProject } from "@/lib/editor/types";
import {
  setScriptContent,
  selectScene,
  selectClip,
  setPlayhead,
} from "@/lib/editor/store";
import {
  parseScreenplay,
  fmtSceneTimecode,
  coerceScreenplay,
} from "@/lib/editor/screenplay";
import { useEditor } from "@/hooks/editor/useEditor";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { createDraftProject } from "@/lib/editor/createDraftProject";
import { toast } from "sonner";
import {
  getDocumentState,
  subscribeDocument,
  updateBeat,
  setShotApproval,
} from "@/lib/editor/document-store";
import type {
  Scene,
  Shot,
  Beat,
  Character,
  ScriptDocument,
} from "@/lib/editor/script-document";
import { findShot } from "@/lib/editor/script-document";
import { enqueueShot } from "@/lib/editor/generation/orchestrator";
import {
  buildEngineInput,
  selectEngineForShot,
} from "@/lib/editor/generation/pipeline";
import { buildChainContext } from "@/lib/editor/generation/chains";
import {
  latestEventForShot,
  isShotRendering,
  subscribeStatusBus,
  getStatusBus,
} from "@/lib/editor/generation/status-bus";
import { getEngine } from "@/lib/editor/model-catalog";

interface Props {
  project: EditorProject;
}

// ─────────────────────────────────────────────────────────────────────────────
// ScriptErrorBoundary — keep editor alive on render-time errors
// ─────────────────────────────────────────────────────────────────────────────
class ScriptErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }
  static getDerivedStateFromError(err: Error) {
    return { hasError: true, message: err.message };
  }
  componentDidCatch(err: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[Script] render crashed:", err, info);
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <section className="relative flex-1 min-h-0 flex items-center justify-center px-8">
        <div className="text-center max-w-md">
          <AlertOctagon className="h-7 w-7 text-rose-300/85 mx-auto" strokeWidth={1.4} />
          <p
            className="mt-5 font-display italic text-[22px] font-light text-foreground/90"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            The screenplay couldn&rsquo;t render.
          </p>
          <p className={cn(TYPE_META, "mt-3 text-muted-foreground/55")}>
            {this.state.message || "Unknown error"}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, message: "" })}
            className={cn(
              "mt-6 inline-flex items-center gap-2 px-4 h-9 rounded-full",
              "bg-white/[0.04] text-foreground/85 ring-1 ring-inset ring-white/[0.08]",
              "text-[13px] hover:bg-white/[0.08] transition-colors",
            )}
          >
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span>Try again</span>
          </button>
        </div>
      </section>
    );
  }
}

export function Script({ project }: Props) {
  return (
    <ScriptErrorBoundary>
      <ScriptInner project={project} />
    </ScriptErrorBoundary>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ScriptInner — the page
// ─────────────────────────────────────────────────────────────────────────────
function ScriptInner({ project }: Props) {
  const reducedMotion = useReducedMotion();
  const { playheadSec } = useEditor();
  // Subscribe to the status bus so shot cards re-render on stage changes.
  useSyncExternalStore(subscribeStatusBus, getStatusBus, getStatusBus);
  // Document state.
  const docState = useSyncExternalStore(
    subscribeDocument,
    getDocumentState,
    getDocumentState,
  );
  const doc = docState.doc;
  const navigate = useNavigate();

  const isEmptyProject = !project.id || project.id === "no-project";
  const initial = (project.scriptContent ?? "").trim();

  const [value, setValue] = useState(initial);
  const [editingBlock, setEditingBlock] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // Pending AI draft loader.
  useEffect(() => {
    if (isEmptyProject) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("movie_projects")
          .select("script_content, generated_script")
          .eq("id", project.id)
          .maybeSingle();
        if (cancelled || error || !data) return;
        const draft = coerceScreenplay(data.generated_script);
        const approved = coerceScreenplay(data.script_content);
        if (draft && draft.toLowerCase() !== approved.toLowerCase()) {
          setPendingDraft(draft);
        } else {
          setPendingDraft(null);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[Script] load failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project.id, isEmptyProject]);

  useEffect(() => {
    setValue(initial);
  }, [initial]);

  // V1 clip list — for parser anchoring.
  const v1Clips = useMemo(() => {
    const scenes = Array.isArray(project?.scenes) ? project.scenes : [];
    return scenes
      .flatMap((s) => (Array.isArray(s?.clips) ? s.clips : []))
      .filter((c) => c && c.kind !== "title");
  }, [project]);

  // Resolve scenes: prefer document scenes when present, otherwise
  // parse the screenplay text into synthetic scenes.
  const displayText = pendingDraft ?? (value || initial);
  const parsed = useMemo(() => {
    try {
      return parseScreenplay({ raw: displayText, clips: v1Clips });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[Script] parse failed", e);
      return { blocks: [], sceneCount: 0, contentCount: 0 };
    }
  }, [displayText, v1Clips]);

  // The rendered scenes — ALWAYS use parsed blocks for the text body
  // (that's what the user wrote / what the AI generated). Attach doc
  // shots when available so the visual shot strip renders.
  //
  // Previously this preferred doc scenes when shots existed but no
  // beats — that left scenes blank because the hydration ran before
  // any screenplay was on disk, populating shots but no beats. Bug
  // fix: never render an empty scene. Parser is the canonical text
  // source until wave 5 properly populates doc beats.
  const renderScenes: ScriptSceneView[] = useMemo(() => {
    const byScene = new Map<number, ScriptSceneView>();
    for (const b of parsed.blocks) {
      const key = b.sceneIdx;
      const existing = byScene.get(key);
      if (!existing) {
        byScene.set(key, {
          kind: "parsed" as const,
          sceneId: `parsed-${key}`,
          slug: b.kind === "slug" ? b.text : `SCENE ${key + 1}`,
          beats: [],
          shots: [],
          parsedBlocks: [b],
        });
      } else {
        existing.parsedBlocks.push(b);
        if (b.kind === "slug") existing.slug = b.text;
      }
    }
    const result = Array.from(byScene.values());

    // Attach doc shots by scene index. This gives the visual shot
    // strip while the parsed blocks drive the body text.
    if (doc && doc.scenes.length > 0) {
      for (let i = 0; i < result.length && i < doc.scenes.length; i++) {
        result[i].shots = doc.scenes[i].shots;
        result[i].mood = doc.scenes[i].mood;
        result[i].timeOfDay = doc.scenes[i].timeOfDay;
      }
    }
    return result;
  }, [doc, parsed.blocks]);

  // Active block tracking via playhead → first matching shot/clip.
  const activeShotId = useMemo(() => {
    for (const scene of renderScenes) {
      for (const shot of scene.shots) {
        const clip = v1Clips.find((c) => c.id === shot.id);
        if (
          clip &&
          playheadSec >= clip.timelineStartSec &&
          playheadSec < clip.timelineStartSec + clip.durationSec
        ) {
          return shot.id;
        }
      }
    }
    // Parser path — match to clip-aware block.
    for (const scene of renderScenes) {
      for (const b of scene.parsedBlocks) {
        if (b.clip && playheadSec >= b.clip.timelineStartSec && playheadSec < b.clip.timelineStartSec + b.clip.durationSec) {
          return b.id;
        }
      }
    }
    return null;
  }, [renderScenes, playheadSec, v1Clips]);

  // Auto-scroll active block into view.
  useEffect(() => {
    if (!activeShotId) return;
    const root = bodyRef.current;
    if (!root) return;
    const el = root.querySelector<HTMLElement>(`[data-block-id="${activeShotId}"]`);
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      try {
        const r = root.getBoundingClientRect();
        const e = el.getBoundingClientRect();
        if (e.top < r.top + 80 || e.bottom > r.bottom - 80) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      } catch {
        /* ignore */
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [activeShotId]);

  useEffect(() => {
    if (!savedAt) return;
    const t = window.setTimeout(() => setSavedAt(null), 2400);
    return () => window.clearTimeout(t);
  }, [savedAt]);

  // ── Save the whole script (used by Redraft + global Edit fallback)
  const saveWholeScript = useCallback(async () => {
    setSaving(true);
    setScriptContent(value);
    try {
      // If the user is writing into the empty NLE surface, mint a draft
      // project so their first save just works. The project id is then
      // used for the update; we navigate after the write lands so the
      // editor re-mounts on the new project with the script loaded.
      let targetId = project.id;
      let mintedProjectId: string | null = null;
      if (isEmptyProject) {
        const newId = await createDraftProject();
        if (!newId) throw new Error("Couldn't create a project to save into.");
        targetId = newId;
        mintedProjectId = newId;
      }
      const { error } = await supabase
        .from("movie_projects")
        .update({ script_content: value })
        .eq("id", targetId);
      if (error) throw error;
      setSavedAt(Date.now());
      if (mintedProjectId) {
        toast.success("Project created · screenplay saved");
        navigate(`/editor/${mintedProjectId}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }, [value, project.id, isEmptyProject, navigate]);

  // Per-block edit: save just the one beat.
  const commitBlockEdit = useCallback(
    async (beatId: string, text: string) => {
      setSaving(true);
      const ok = updateBeat(beatId, { text }, { by: "user" });
      setEditingBlock(null);
      if (ok) setSavedAt(Date.now());
      else toast.error("Couldn't save — block not found.");
      setSaving(false);
    },
    [],
  );

  // Approve & render a shot from the script tab (same gate).
  const approveAndRenderShot = useCallback(
    (shotId: string) => {
      if (!doc) return;
      const shot = findShot(doc, shotId);
      if (!shot) return;
      setShotApproval(shotId, "ready", { by: "user", reason: "Approved from Script tab" });
      const ctx = buildChainContext(doc, shotId);
      const inputs = buildEngineInput(shot, doc, ctx);
      const engine = selectEngineForShot(shot, doc);
      enqueueShot({
        projectId: doc.meta.projectId,
        shotId,
        inputs,
        engine,
        tier: doc.capabilities.qualityTier,
      });
      toast.success("Approved & queued");
    },
    [doc],
  );

  // Whole-script regenerate.
  const regenerate = useCallback(async () => {
    if (isEmptyProject) return;
    setRegenerating(true);
    const toastId = toast.loading("Drafting a new screenplay…");
    try {
      const { data, error } = await supabase.functions.invoke<{
        script?: string;
        error?: string;
      }>("generate-script", {
        body: {
          title: project.title,
          topic: project.title,
          synopsis: initial || undefined,
          mood: project.mood ?? undefined,
          genre: project.genre ?? undefined,
          setting: project.setting ?? undefined,
          clipCount: v1Clips.length || undefined,
        },
      });
      if (error) throw error;
      if (!data || data.error || !data.script) {
        throw new Error(data?.error ?? "no_script_returned");
      }
      const draft = data.script.trim();
      await supabase
        .from("movie_projects")
        .update({ generated_script: draft })
        .eq("id", project.id);
      setPendingDraft(draft);
      toast.success("Draft ready for review", {
        id: toastId,
        description: "Approve to make it canonical.",
      });
    } catch (e) {
      toast.error("Couldn't generate a new draft", {
        id: toastId,
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setRegenerating(false);
    }
  }, [project, initial, v1Clips.length, isEmptyProject]);

  const approveDraft = useCallback(async () => {
    if (!pendingDraft) return;
    setSaving(true);
    setScriptContent(pendingDraft);
    setValue(pendingDraft);
    try {
      await supabase
        .from("movie_projects")
        .update({
          script_content: pendingDraft,
          generated_script: null,
        })
        .eq("id", project.id);
      setPendingDraft(null);
      setSavedAt(Date.now());
      toast.success("Script approved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Approval failed.");
    } finally {
      setSaving(false);
    }
  }, [pendingDraft, project.id]);

  const rejectDraft = useCallback(async () => {
    setSaving(true);
    try {
      await supabase
        .from("movie_projects")
        .update({ generated_script: null })
        .eq("id", project.id);
      setPendingDraft(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't discard.");
    } finally {
      setSaving(false);
    }
  }, [project.id]);

  const seekToShotOrClipId = useCallback(
    (id: string) => {
      const clip = v1Clips.find((c) => c.id === id);
      if (clip) {
        setPlayhead(clip.timelineStartSec);
        selectClip(clip.id);
        for (const s of project.scenes) {
          if (s.clips.some((c) => c.id === clip.id)) {
            selectScene(s.id);
            break;
          }
        }
      }
    },
    [v1Clips, project],
  );

  const wordCount = displayText.split(/\s+/).filter(Boolean).length;
  const sceneCount = renderScenes.length;

  // ── Render: empty project ──────────────────────────────────────
  if (isEmptyProject) {
    return (
      <section className="relative flex-1 min-h-0 flex items-center justify-center px-8">
        <div className="text-center max-w-md">
          <Layers className="h-7 w-7 text-muted-foreground/55 mx-auto" strokeWidth={1.4} />
          <p
            className="mt-5 font-display italic text-[22px] font-light text-foreground/85"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            Open a project to read its screenplay.
          </p>
        </div>
      </section>
    );
  }

  // ── Render: no script yet ──────────────────────────────────────
  // Differentiate two cases:
  //   1. Generated project that just hasn't been written yet — show
  //      "Draft with AI" CTA.
  //   2. Upload-only project (every clip is `Imported:` / `User upload:` —
  //      no generator wrote a screenplay) — show "No script available
  //      for this video" honest empty state.
  const allClips = project.scenes.flatMap((s) => s.clips);
  const isUploadOnly = allClips.length > 0 && allClips.every((c) => {
    const p = (c.prompt ?? "").toLowerCase();
    return p.startsWith("imported:") || p.startsWith("user upload:");
  });
  if (!displayText.trim()) {
    return (
      <section className="relative flex-1 min-h-0 flex items-center justify-center px-8">
        <div className="text-center max-w-md">
          <Layers className="h-7 w-7 text-muted-foreground/55 mx-auto" strokeWidth={1.4} />
          <p
            className="mt-5 font-display italic text-[22px] font-light text-foreground/85"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            {isUploadOnly ? "No script available for this video." : "No screenplay yet."}
          </p>
          {isUploadOnly && (
            <p className={cn(TYPE_META, "mt-3 text-muted-foreground/55 leading-relaxed")}>
              This project was assembled from uploaded clips. A screenplay can still be drafted from the video — click Draft with AI.
            </p>
          )}
          <button
            type="button"
            onClick={() => void regenerate()}
            disabled={regenerating}
            className={cn(
              "mt-7 inline-flex items-center gap-2 px-4 h-9 rounded-full",
              "bg-[hsl(var(--accent)/0.14)] text-accent ring-1 ring-inset ring-accent/40",
              "text-[13px] font-display italic transition-colors",
              "hover:bg-[hsl(var(--accent)/0.22)]",
              "disabled:opacity-40 disabled:cursor-not-allowed",
            )}
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            {regenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
            ) : (
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
            )}
            <span>{regenerating ? "Drafting…" : "Draft with AI"}</span>
          </button>
        </div>
      </section>
    );
  }

  // ── Render: the rich screenplay ─────────────────────────────────
  return (
    <section className="relative flex-1 min-h-0 flex flex-col">
      {/* Header */}
      <header className="shrink-0 px-6 sm:px-10 pt-6 pb-3 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.32em] flex items-center gap-2")}>
            <Layers className="h-3 w-3 text-accent/70" strokeWidth={1.5} />
            <span>◆ Screenplay</span>
          </div>
          <h2
            className="mt-1 font-display italic text-[clamp(1.5rem,2.4vw,2rem)] font-light tracking-tight leading-none"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/60 bg-clip-text text-transparent">
              {wordCount.toLocaleString()} words
            </span>
          </h2>
          <p className={cn(TYPE_META, "mt-1 text-muted-foreground/55 flex items-center gap-3 flex-wrap")}>
            <span>{sceneCount} {sceneCount === 1 ? "scene" : "scenes"}</span>
            <span className="text-muted-foreground/30">·</span>
            <span>{v1Clips.length} {v1Clips.length === 1 ? "clip" : "clips"}</span>
            {doc?.cast && doc.cast.length > 0 && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <span>{doc.cast.length} {doc.cast.length === 1 ? "character" : "characters"}</span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <AnimatePresence mode="wait">
            {saving ? (
              <motion.span
                key="saving"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={cn(TYPE_META, "text-muted-foreground/55 flex items-center gap-1.5")}
              >
                <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
                Saving
              </motion.span>
            ) : savedAt ? (
              <motion.span
                key="saved"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={cn(TYPE_META, "text-emerald-300 flex items-center gap-1.5")}
              >
                <Check className="h-3 w-3" strokeWidth={2} />
                Saved
              </motion.span>
            ) : null}
          </AnimatePresence>
          <button
            type="button"
            onClick={() => void regenerate()}
            disabled={regenerating}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 h-7 rounded-full",
              "text-[12px] font-mono uppercase tracking-[0.18em]",
              "bg-white/[0.03] text-foreground/85 ring-1 ring-inset ring-white/[0.06]",
              "hover:bg-white/[0.07] transition-colors",
              "disabled:opacity-40 disabled:cursor-not-allowed",
            )}
            title="Generate a fresh AI draft"
          >
            {regenerating ? (
              <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
            ) : (
              <RefreshCw className="h-3 w-3" strokeWidth={1.5} />
            )}
            <span>{regenerating ? "Drafting" : "Redraft"}</span>
          </button>
        </div>
      </header>

      {/* Cast strip */}
      {doc?.cast && doc.cast.length > 0 && (
        <CastStrip cast={doc.cast} />
      )}

      {/* Pending AI draft */}
      {pendingDraft && (
        <div className="shrink-0 mx-6 sm:mx-10 mt-4 rounded-xl ring-1 ring-inset ring-amber-300/35 bg-amber-500/[0.06] p-4 flex items-start gap-3">
          <Sparkles className="h-4 w-4 text-amber-300 mt-0.5 shrink-0" strokeWidth={1.5} />
          <div className="min-w-0 flex-1">
            <p className="font-display italic text-[14px] text-foreground/95" style={{ fontFamily: "'Fraunces', serif" }}>
              Fresh AI draft awaiting approval.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => void approveDraft()}
                disabled={saving}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 h-7 rounded-full",
                  "text-[12px] font-mono uppercase tracking-[0.18em]",
                  "bg-emerald-500/[0.18] text-emerald-200 ring-1 ring-inset ring-emerald-400/40",
                  "hover:bg-emerald-500/[0.28] transition-colors",
                )}
              >
                <ShieldCheck className="h-3 w-3" strokeWidth={1.5} />
                Approve
              </button>
              <button
                type="button"
                onClick={() => void rejectDraft()}
                disabled={saving}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 h-7 rounded-full",
                  "text-[12px] font-mono uppercase tracking-[0.18em]",
                  "bg-white/[0.03] text-foreground/75 ring-1 ring-inset ring-white/[0.06]",
                  "hover:bg-white/[0.07] transition-colors",
                )}
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scene strip — horizontal scroller */}
      {renderScenes.length > 0 && (
        <nav className="shrink-0 px-6 sm:px-10 py-2 border-y border-white/[0.04] bg-[hsl(220_30%_4%/0.20)]">
          <ul className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            {renderScenes.map((scene, sIdx) => {
              const firstShot = scene.shots[0];
              const firstClip = firstShot
                ? v1Clips.find((c) => c.id === firstShot.id)
                : null;
              const isActive = scene.shots.some(
                (sh) => sh.id === activeShotId,
              );
              return (
                <li key={scene.sceneId} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => firstShot && seekToShotOrClipId(firstShot.id)}
                    disabled={!firstShot}
                    className={cn(
                      "inline-flex items-center gap-2 px-3 h-7 rounded-full",
                      "text-[11px] font-mono uppercase tracking-[0.14em]",
                      "transition-colors ring-1 ring-inset",
                      isActive
                        ? "bg-[hsl(212_100%_60%/0.16)] text-accent ring-accent/45"
                        : "bg-white/[0.02] text-foreground/75 ring-white/[0.06] hover:bg-white/[0.06]",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        isActive ? "bg-accent" : "bg-foreground/35",
                      )}
                    />
                    <span className="truncate max-w-[220px]">
                      {scene.slug}
                    </span>
                    {firstClip && (
                      <span className="text-muted-foreground/55 font-mono">
                        {fmtSceneTimecode(firstClip.timelineStartSec)}
                      </span>
                    )}
                    <span className="text-muted-foreground/40 font-mono tabular-nums">
                      {sIdx + 1}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {/* Body — scenes */}
      <div
        ref={bodyRef}
        className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-6 sm:px-10 py-7"
      >
        <article className="mx-auto max-w-[800px] space-y-12">
          {renderScenes.map((scene, sIdx) => (
            <SceneSection
              key={scene.sceneId}
              scene={scene}
              sceneIndex={sIdx}
              doc={doc}
              v1Clips={v1Clips}
              activeShotId={activeShotId}
              editingBlock={editingBlock}
              draftText={draftText}
              setEditingBlock={(id, text) => {
                setEditingBlock(id);
                setDraftText(text ?? "");
              }}
              setDraftText={setDraftText}
              onCommitBlock={commitBlockEdit}
              onCancelEdit={() => setEditingBlock(null)}
              onSeek={seekToShotOrClipId}
              onApproveShot={approveAndRenderShot}
              reducedMotion={!!reducedMotion}
            />
          ))}

          {/* Footer — global edit fallback when user wants to rewrite at the whole-script level */}
          {!editingBlock && (
            <div className="text-center pt-6 pb-4">
              <p className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.30em]")}>
                ◆ Click any block to edit it
              </p>
              <button
                type="button"
                onClick={() => void saveWholeScript()}
                disabled={saving}
                className={cn(
                  "mt-3 text-[11.5px] font-mono uppercase tracking-[0.18em]",
                  "text-muted-foreground/55 hover:text-foreground transition-colors",
                  "disabled:opacity-40",
                )}
              >
                Force-save whole script
              </button>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Types — the rendered scene shape (doc OR parsed)
// ─────────────────────────────────────────────────────────────────────────────
interface ScriptSceneView {
  kind: "doc" | "parsed";
  sceneId: string;
  slug: string;
  mood?: string;
  timeOfDay?: string;
  actNumber?: number;
  beats: Beat[];
  shots: Shot[];
  parsedBlocks: import("@/lib/editor/screenplay").ScreenplayBlock[];
}

// ─────────────────────────────────────────────────────────────────────────────
// CastStrip — round avatars of every character
// ─────────────────────────────────────────────────────────────────────────────

function CastStrip({ cast }: { cast: Character[] }) {
  return (
    <div className="shrink-0 px-6 sm:px-10 mt-3">
      <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.28em] mb-2 flex items-center gap-2")}>
        <UserCircle2 className="h-3 w-3 text-accent/70" strokeWidth={1.5} />
        <span>◆ Cast</span>
      </div>
      <ul className="flex items-center gap-3 overflow-x-auto scrollbar-hide pb-2">
        {cast.map((c) => (
          <li key={c.id} className="shrink-0">
            <CharacterAvatar character={c} size="lg" showLabel />
          </li>
        ))}
      </ul>
    </div>
  );
}

function CharacterAvatar({
  character,
  size = "md",
  showLabel = false,
}: {
  character: Character;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}) {
  const dim = size === "lg" ? "h-12 w-12" : size === "sm" ? "h-6 w-6" : "h-8 w-8";
  const hasDNA = !!character.identityDNA;
  return (
    <div className={cn("inline-flex items-center gap-2", showLabel && "min-w-[120px]")}>
      <div
        className={cn(
          dim,
          "shrink-0 rounded-full overflow-hidden ring-1 ring-inset",
          "bg-white/[0.04]",
          hasDNA ? "ring-white/[0.12]" : "ring-amber-300/40",
        )}
        title={`${character.name} · ${character.role}${hasDNA ? "" : " (no identity DNA)"}`}
      >
        {character.referenceImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={character.referenceImageUrl}
            alt={character.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <UserCircle2
              className={cn(
                size === "lg" ? "h-6 w-6" : "h-4 w-4",
                "text-muted-foreground/65",
              )}
              strokeWidth={1.3}
            />
          </div>
        )}
      </div>
      {showLabel && (
        <div className="min-w-0">
          <p
            className="font-display italic text-[13px] text-foreground/95 truncate leading-tight"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            {character.name}
          </p>
          <p className={cn(TYPE_META, "text-muted-foreground/55 truncate")}>
            {character.role}
            {!hasDNA && (
              <span className="ml-1 text-amber-300/85">⚠ no DNA</span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SceneSection — one scene with its header + blocks + shot strip
// ─────────────────────────────────────────────────────────────────────────────

function SceneSection({
  scene,
  sceneIndex,
  doc,
  v1Clips,
  activeShotId,
  editingBlock,
  draftText,
  setEditingBlock,
  setDraftText,
  onCommitBlock,
  onCancelEdit,
  onSeek,
  onApproveShot,
  reducedMotion,
}: {
  scene: ScriptSceneView;
  sceneIndex: number;
  doc: ScriptDocument | null;
  v1Clips: EditorProject["scenes"][number]["clips"];
  activeShotId: string | null;
  editingBlock: string | null;
  draftText: string;
  setEditingBlock: (id: string | null, text?: string) => void;
  setDraftText: (s: string) => void;
  onCommitBlock: (beatId: string, text: string) => Promise<void>;
  onCancelEdit: () => void;
  onSeek: (id: string) => void;
  onApproveShot: (shotId: string) => void;
  reducedMotion: boolean;
}) {
  const firstShot = scene.shots[0];
  const firstClip = firstShot
    ? v1Clips.find((c) => c.id === firstShot.id)
    : null;

  return (
    <motion.section
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: EASE_PREMIUM }}
    >
      {/* Slug-line header */}
      <header className="mb-4">
        <button
          type="button"
          onClick={() => firstShot && onSeek(firstShot.id)}
          disabled={!firstShot}
          className={cn(
            "group/slug w-full text-left transition-colors disabled:opacity-60 disabled:cursor-not-allowed",
          )}
        >
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className={cn(TYPE_META, "tabular-nums tracking-[0.24em] text-muted-foreground/55 font-mono")}>
              SCENE {String(sceneIndex + 1).padStart(2, "0")}
            </span>
            <span className="font-mono uppercase tracking-[0.18em] text-[15px] text-accent group-hover/slug:text-foreground transition-colors">
              ◆ {scene.slug}
            </span>
            {firstClip && (
              <span className={cn(TYPE_META, "font-mono tabular-nums text-muted-foreground/55")}>
                {fmtSceneTimecode(firstClip.timelineStartSec)}
              </span>
            )}
          </div>
          {(scene.mood || scene.timeOfDay) && (
            <div className="mt-1.5 flex items-center gap-2 text-[12.5px] font-mono uppercase tracking-[0.16em] text-muted-foreground/65">
              {scene.timeOfDay && <span>{scene.timeOfDay}</span>}
              {scene.timeOfDay && scene.mood && <span className="text-muted-foreground/30">·</span>}
              {scene.mood && <span>{scene.mood}</span>}
            </div>
          )}
        </button>
      </header>

      {/* Block stream — either from doc beats or parsed blocks */}
      <div className="space-y-3">
        {scene.kind === "doc"
          ? scene.beats.map((beat) => (
              <BeatRenderer
                key={beat.id}
                beat={beat}
                doc={doc}
                isEditing={editingBlock === beat.id}
                draftText={draftText}
                onEdit={() => setEditingBlock(beat.id, beat.text)}
                onDraftChange={setDraftText}
                onCommit={(text) => void onCommitBlock(beat.id, text)}
                onCancel={onCancelEdit}
              />
            ))
          : scene.parsedBlocks
              .filter((b) => b.kind !== "slug")
              .map((b) => <ParsedBlockRenderer key={b.id} block={b} />)}
      </div>

      {/* Shot strip — visual cards */}
      {scene.shots.length > 0 && (
        <div className="mt-6">
          <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.28em] mb-3 flex items-center gap-2")}>
            <Film className="h-3 w-3 text-accent/70" strokeWidth={1.5} />
            <span>◆ Shots in this scene</span>
          </div>
          <ul className="flex items-stretch gap-3 overflow-x-auto scrollbar-hide pb-2">
            {scene.shots.map((shot, idx) => {
              const prevShot = idx > 0 ? scene.shots[idx - 1] : null;
              return (
                <li key={shot.id} className="shrink-0">
                  <ShotCard
                    shot={shot}
                    prevShot={prevShot}
                    doc={doc}
                    isActive={shot.id === activeShotId}
                    onSeek={() => onSeek(shot.id)}
                    onApprove={() => onApproveShot(shot.id)}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </motion.section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BeatRenderer — formatted block with avatar + inline edit
// ─────────────────────────────────────────────────────────────────────────────

function BeatRenderer({
  beat,
  doc,
  isEditing,
  draftText,
  onEdit,
  onDraftChange,
  onCommit,
  onCancel,
}: {
  beat: Beat;
  doc: ScriptDocument | null;
  isEditing: boolean;
  draftText: string;
  onEdit: () => void;
  onDraftChange: (s: string) => void;
  onCommit: (text: string) => void;
  onCancel: () => void;
}) {
  const character = beat.characterId
    ? doc?.cast.find((c) => c.id === beat.characterId)
    : null;
  const audioBadge =
    beat.audioBus === "A1"
      ? { icon: <Mic className="h-3 w-3" strokeWidth={1.5} />, label: "A1 dialog" }
      : beat.audioBus === "A2"
      ? { icon: <Music2 className="h-3 w-3" strokeWidth={1.5} />, label: "A2 score" }
      : beat.kind === "action"
      ? { icon: <Disc3 className="h-3 w-3" strokeWidth={1.5} />, label: "ambient" }
      : null;

  // Inline edit mode
  if (isEditing) {
    return (
      <div className="rounded-lg ring-1 ring-inset ring-accent/45 bg-white/[0.02] p-3">
        <textarea
          value={draftText}
          onChange={(e) => onDraftChange(e.target.value)}
          rows={3}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onCancel();
            } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              onCommit(draftText);
            }
          }}
          className={cn(
            "block w-full resize-none bg-transparent outline-none",
            "font-display italic text-[17px] leading-[1.6] text-foreground",
            "caret-accent",
          )}
          style={{ fontFamily: "'Fraunces', serif" }}
        />
        <div className="mt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground/65 hover:text-foreground"
          >
            Cancel <span className="text-muted-foreground/40 ml-1">Esc</span>
          </button>
          <button
            type="button"
            onClick={() => onCommit(draftText)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 h-7 rounded-full",
              "text-[11px] font-mono uppercase tracking-[0.18em]",
              "bg-[hsl(var(--accent)/0.16)] text-accent ring-1 ring-inset ring-accent/40",
              "hover:bg-[hsl(var(--accent)/0.24)]",
            )}
          >
            <Check className="h-3 w-3" strokeWidth={1.8} />
            Save <span className="text-muted-foreground/55 ml-1">⌘↵</span>
          </button>
        </div>
      </div>
    );
  }

  switch (beat.kind) {
    case "action":
      return (
        <div className="group/blk relative">
          <button
            type="button"
            onClick={onEdit}
            className="block w-full text-left rounded-md py-1 px-2 -mx-2 transition-colors hover:bg-white/[0.025]"
          >
            <p
              className="text-[20px] leading-[1.65] whitespace-pre-wrap font-display italic text-foreground"
              style={{ fontFamily: "'Fraunces', serif", fontWeight: 400 }}
            >
              {beat.text}
            </p>
          </button>
          <div className="absolute top-1.5 right-2 opacity-0 group-hover/blk:opacity-100 transition-opacity">
            {audioBadge && <AudioBadge {...audioBadge} />}
          </div>
        </div>
      );

    case "character":
      return (
        <div className="text-center mt-3">
          <span className="font-mono uppercase tracking-[0.18em] text-[14px] text-foreground/95">
            {beat.text}
          </span>
        </div>
      );

    case "paren":
      return (
        <div className="mx-auto max-w-[60%] text-center text-[13.5px] text-muted-foreground/75 italic leading-snug">
          {beat.text}
        </div>
      );

    case "dialogue":
      return (
        <div className="group/dlg relative">
          {/* Character cue with avatar */}
          {character && (
            <div className="flex items-center justify-center gap-2 mb-1">
              <CharacterAvatar character={character} size="sm" />
              <span className="font-mono uppercase tracking-[0.18em] text-[14px] text-foreground/95">
                {character.name}
              </span>
              {beat.voiceDirection && (
                <span className="text-[12.5px] text-muted-foreground/75 italic">({beat.voiceDirection})</span>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={onEdit}
            className={cn(
              "block w-full text-center rounded-md py-1 transition-colors",
              "hover:bg-white/[0.025]",
            )}
          >
            <p
              className="mx-auto max-w-[72%] text-[17.5px] leading-[1.6] whitespace-pre-wrap font-display italic text-foreground/95"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              {beat.text}
            </p>
          </button>
          <div className="absolute top-0 right-0 opacity-0 group-hover/dlg:opacity-100 transition-opacity">
            {audioBadge && <AudioBadge {...audioBadge} />}
          </div>
        </div>
      );

    case "transition":
      return (
        <div className="font-mono uppercase tracking-[0.16em] text-[13.5px] text-muted-foreground/75 text-right my-5">
          {beat.text}
        </div>
      );

    case "vo":
    case "sfx":
    case "music-cue":
    default:
      return (
        <div className="mx-auto max-w-[72%] text-center text-[14px] text-muted-foreground/85 italic leading-snug">
          [{beat.kind}] {beat.text}
        </div>
      );
  }
}

function AudioBadge({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 h-5 rounded",
        "text-[9.5px] font-mono uppercase tracking-[0.14em]",
        "bg-white/[0.04] text-muted-foreground/75 ring-1 ring-inset ring-white/[0.06]",
      )}
    >
      {icon}
      <span>{label}</span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ParsedBlockRenderer — fallback when document has no beats
// ─────────────────────────────────────────────────────────────────────────────

function ParsedBlockRenderer({
  block,
}: {
  block: import("@/lib/editor/screenplay").ScreenplayBlock;
}) {
  switch (block.kind) {
    case "action":
      return (
        <p
          className="text-[20px] leading-[1.65] whitespace-pre-wrap font-display italic text-foreground"
          style={{ fontFamily: "'Fraunces', serif", fontWeight: 400 }}
        >
          {block.text}
        </p>
      );
    case "character":
      return (
        <div className="text-center mt-3">
          <span className="font-mono uppercase tracking-[0.18em] text-[14px] text-foreground/95">
            {block.speaker ?? block.text}
            {block.speakerExtension && (
              <span className="text-muted-foreground/55 ml-2">({block.speakerExtension})</span>
            )}
          </span>
        </div>
      );
    case "paren":
      return (
        <div className="mx-auto max-w-[60%] text-center text-[13.5px] text-muted-foreground/75 italic leading-snug">
          {block.text}
        </div>
      );
    case "dialogue":
      return (
        <p
          className="mx-auto max-w-[72%] text-center text-[17.5px] leading-[1.6] whitespace-pre-wrap font-display italic text-foreground/95"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          {block.text}
        </p>
      );
    case "transition":
      return (
        <div className="font-mono uppercase tracking-[0.16em] text-[13.5px] text-muted-foreground/75 text-right my-5">
          {block.text}
        </div>
      );
    default:
      return <p className="text-[17px] leading-[1.7]">{block.text}</p>;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ShotCard — visual card per shot with frame chain
// ─────────────────────────────────────────────────────────────────────────────

function ShotCard({
  shot,
  prevShot,
  doc,
  isActive,
  onSeek,
  onApprove,
}: {
  shot: Shot;
  prevShot: Shot | null;
  doc: ScriptDocument | null;
  isActive: boolean;
  onSeek: () => void;
  onApprove: () => void;
}) {
  const engineRow = doc ? getEngine(shot.engineOverride ?? doc.capabilities.defaultEngine) : null;
  const event = latestEventForShot(shot.id);
  const inFlight = isShotRendering(shot.id);
  const state = inFlight ? "rendering" : shot.approval.state;
  const lastFrame = shot.generated?.lastFrameUrl;
  const startFrame = prevShot?.generated?.lastFrameUrl;
  const thumb = shot.generated?.thumbnailUrl ?? shot.generated?.lastFrameUrl;
  const videoFrame =
    shot.generated?.videoUrl && !shot.generated?.thumbnailUrl
      ? shot.generated.videoUrl
      : null;

  return (
    <div
      data-block-id={shot.id}
      className={cn(
        "relative w-[240px] rounded-xl ring-1 ring-inset overflow-hidden transition-all",
        isActive
          ? "ring-accent/65 bg-[hsl(var(--accent)/0.04)]"
          : "ring-white/[0.06] bg-white/[0.012] hover:ring-white/[0.18]",
      )}
    >
      {/* Frame chain indicator — connects to previous shot's last frame */}
      {startFrame && (
        <div className="px-2 pt-2 flex items-center gap-1.5">
          <div className="relative h-8 w-12 shrink-0 rounded overflow-hidden ring-1 ring-inset ring-white/[0.08]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={startFrame} alt="start frame" className="w-full h-full object-cover" />
          </div>
          <ArrowRight className="h-3 w-3 text-accent/65 shrink-0" strokeWidth={1.8} />
          <span className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.18em] truncate")}>
            frame chain
          </span>
        </div>
      )}

      {/* Main thumbnail / poster */}
      <button
        type="button"
        onClick={onSeek}
        className="block w-full text-left"
      >
        <div className="relative aspect-[16/9] bg-[hsl(220_30%_8%)]">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="w-full h-full object-cover" />
          ) : videoFrame ? (
            <video
              src={videoFrame}
              poster={undefined}
              className="w-full h-full object-cover"
              muted
              playsInline
              preload="metadata"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Film className="h-5 w-5 text-muted-foreground/45" strokeWidth={1.4} />
            </div>
          )}
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-[hsl(220_30%_4%/0.85)] to-transparent"
          />
          {/* State pill — top right */}
          <div className="absolute top-2 right-2">
            <ShotStatePill state={state} />
          </div>
          {/* Frame chain badge — top left */}
          {shot.inheritsFromShotId && (
            <div className="absolute top-2 left-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-1.5 h-5 rounded",
                  "text-[9.5px] font-mono uppercase tracking-[0.14em]",
                  "bg-amber-500/[0.20] text-amber-200 ring-1 ring-inset ring-amber-400/45",
                )}
                title="Pose-chained from another shot"
              >
                pose-chain
              </span>
            </div>
          )}
          {/* Shot number bottom left */}
          <div className="absolute bottom-2 left-2">
            <span className={cn(TYPE_META, "font-mono tabular-nums tracking-[0.24em] mix-blend-difference text-foreground/85")}>
              SHOT {String(shot.number).padStart(2, "0")}
            </span>
          </div>
        </div>
      </button>

      {/* Body — engine + duration + cost */}
      <div className="p-3">
        <p
          className="text-[12.5px] text-foreground/85 line-clamp-2 leading-snug"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          {shot.cameraDirection || shot.modelPrompt || `Shot ${shot.number}`}
        </p>
        <div className="mt-2 flex items-center justify-between text-[10.5px] font-mono uppercase tracking-[0.14em] text-muted-foreground/65">
          <span className="truncate">{engineRow?.displayName ?? "—"}</span>
          <span className="font-mono tabular-nums">{shot.durationSec.toFixed(1)}s</span>
          <span className="font-mono tabular-nums text-accent">{shot.cost.credits}cr</span>
        </div>

        {/* Approve CTA */}
        <div className="mt-3">
          <ShotCardCta state={state} onApprove={onApprove} />
        </div>
      </div>

      {/* Live status bar at the bottom */}
      {event && state === "rendering" && typeof event.progress === "number" && (
        <div className="h-0.5 bg-white/[0.06]">
          <div
            className="h-full bg-accent transition-[width] duration-300"
            style={{ width: `${Math.min(100, event.progress * 100)}%` }}
          />
        </div>
      )}

      {/* Last-frame strip — shows what feeds into the NEXT shot */}
      {lastFrame && (
        <div className="px-2 pb-2 pt-1 flex items-center gap-1.5 border-t border-white/[0.04]">
          <span className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.18em] truncate")}>
            feeds next →
          </span>
          <div className="relative h-8 w-12 shrink-0 rounded overflow-hidden ring-1 ring-inset ring-white/[0.08]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lastFrame} alt="last frame" className="w-full h-full object-cover" />
          </div>
        </div>
      )}
    </div>
  );
}

function ShotStatePill({ state }: { state: import("@/lib/editor/script-document").ShotApprovalState }) {
  switch (state) {
    case "draft":
      return null;
    case "ready":
      return (
        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-[hsl(var(--accent)/0.22)] ring-1 ring-inset ring-accent/55" title="Approved — ready to render">
          <Sparkles className="h-2.5 w-2.5 text-accent" strokeWidth={1.8} />
        </span>
      );
    case "rendering":
      return (
        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-amber-500/[0.22] ring-1 ring-inset ring-amber-400/55" title="Rendering">
          <Loader2 className="h-2.5 w-2.5 text-amber-200 animate-spin" strokeWidth={1.8} />
        </span>
      );
    case "completed":
      return (
        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-emerald-500/[0.22] ring-1 ring-inset ring-emerald-400/55" title="Completed">
          <Check className="h-2.5 w-2.5 text-emerald-200" strokeWidth={2} />
        </span>
      );
    case "needs-regen":
      return (
        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-amber-500/[0.18] ring-1 ring-inset ring-amber-400/45" title="Edit after approval — re-render to refresh">
          <AlertTriangle className="h-2.5 w-2.5 text-amber-200" strokeWidth={1.8} />
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-rose-500/[0.20] ring-1 ring-inset ring-rose-400/55" title="Failed">
          <AlertOctagon className="h-2.5 w-2.5 text-rose-200" strokeWidth={1.8} />
        </span>
      );
    default:
      return null;
  }
}

function ShotCardCta({
  state,
  onApprove,
}: {
  state: import("@/lib/editor/script-document").ShotApprovalState;
  onApprove: () => void;
}) {
  if (state === "rendering") {
    return (
      <button
        type="button"
        disabled
        className="w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-full text-[11px] font-mono uppercase tracking-[0.18em] bg-[hsl(var(--accent)/0.10)] text-accent ring-1 ring-inset ring-accent/35 opacity-90 cursor-not-allowed"
      >
        <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
        <span>Rendering</span>
      </button>
    );
  }
  if (state === "completed") {
    return (
      <button
        type="button"
        onClick={onApprove}
        className="w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-full text-[11px] font-mono uppercase tracking-[0.18em] bg-emerald-500/[0.14] text-emerald-200 ring-1 ring-inset ring-emerald-400/35 hover:bg-emerald-500/[0.22] transition-colors"
        title="Re-render this shot"
      >
        <Lock className="h-3 w-3" strokeWidth={1.8} />
        <span>Locked</span>
      </button>
    );
  }
  if (state === "needs-regen") {
    return (
      <button
        type="button"
        onClick={onApprove}
        className="w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-full text-[11px] font-mono uppercase tracking-[0.18em] bg-amber-500/[0.18] text-amber-200 ring-1 ring-inset ring-amber-400/40 hover:bg-amber-500/[0.28] transition-colors"
      >
        <RefreshCw className="h-3 w-3" strokeWidth={1.5} />
        <span>Re-render</span>
      </button>
    );
  }
  if (state === "failed") {
    return (
      <button
        type="button"
        onClick={onApprove}
        className="w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-full text-[11px] font-mono uppercase tracking-[0.18em] bg-rose-500/[0.14] text-rose-200 ring-1 ring-inset ring-rose-400/40 hover:bg-rose-500/[0.22] transition-colors"
      >
        <RefreshCw className="h-3 w-3" strokeWidth={1.5} />
        <span>Retry</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onApprove}
      className="w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-full text-[11px] font-display italic bg-[hsl(var(--accent)/0.14)] text-accent ring-1 ring-inset ring-accent/40 hover:bg-[hsl(var(--accent)/0.22)] transition-colors"
      style={{ fontFamily: "'Fraunces', serif" }}
    >
      <Sparkles className="h-3 w-3" strokeWidth={1.5} />
      <span>Approve & Render</span>
    </button>
  );
}

// Unused symbol suppressions for forward-compat
void Plus;
