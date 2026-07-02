/**
 * ExportPanel — Save & Export (NO render).
 *
 * The editor never renders. Generation (clips → timeline) is the only
 * place compute runs. "Export" here just:
 *   1. Flushes the edit to the DB (clip properties, editor_state, doc),
 *   2. Publishes the project to the Lobby via `publish_reel`,
 * so it plays everywhere through the timeline player WITH effects — no
 * FFmpeg/Replicate stitch. Downloading the file lives on the reel page.
 */
import { useEffect, useState } from "react";
import { Loader2, Check, Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";
import { Surface, SurfaceHeader, SurfaceBody, SurfaceFooter } from "./Surface";
import { supabase } from "@/integrations/supabase/client";
import type { EditorProject } from "@/lib/editor/types";
import { useReelPublisher } from "@/hooks/useReelPublisher";
import { toast } from "sonner";

interface Props {
  project: EditorProject;
  open: boolean;
  onClose: () => void;
}

export function ExportPanel({ project, open, onClose }: Props) {
  const { publish } = useReelPublisher();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open) { setBusy(false); setDone(false); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  const saveAndPublish = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // 1) Flush every pending edit so the published copy reflects the
      //    latest clips/effects/arrangement — no render, just persistence.
      const clipSync = await import("@/hooks/editor/useClipPropertiesSync");
      await clipSync.flushPendingClipWrites();
      const esSync = await import("@/hooks/editor/useEditorStateSync");
      await esSync.flushEditorState();
      const docStore = await import("@/lib/editor/document-store");
      await docStore.flushNow();

      // 2) Publish to the Lobby (publish_reel — no render).
      const reelId = await publish(project.id, {
        toastWorldLabel: undefined,
      });
      if (!reelId) {
        // useReelPublisher already toasted the reason (e.g. no video yet).
        setBusy(false);
        return;
      }
      // Check the write — the old code fired-and-forgot, so a failed
      // is_public update still reported "published" while staying private.
      const { error: pubErr } = await supabase
        .from("movie_projects")
        .update({ is_public: true })
        .eq("id", project.id);
      if (pubErr) throw pubErr;
      setDone(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't export", {
        description: "Your edit is still saved — please retry.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Surface
      open={open}
      onClose={onClose}
      size="sm"
      labelledBy="export-title"
      blockBackdropClose={busy}
      blockEscClose={busy}
    >
      <SurfaceHeader
        id="export-title"
        eyebrow="◆ Export"
        title="Save & publish."
        description="Publishes your edit to the Lobby — it plays everywhere with your effects, no render. Generation is the only step that uses compute."
        onClose={busy ? undefined : onClose}
      />

      <SurfaceBody noPadding className="px-7 py-5">
        {done ? (
          <div className="flex items-start gap-3 py-4">
            <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/15 ring-1 ring-inset ring-emerald-400/40">
              <Check className="h-3.5 w-3.5 text-emerald-300" strokeWidth={2.4} />
            </span>
            <div>
              <div className="text-[14px] text-foreground">Published to the Lobby</div>
              <p className={cn(TYPE_META, "mt-1 text-muted-foreground/60 normal-case tracking-normal")}>
                It now shows on your profile and the Lobby, and plays with your effects on the reel page. Open the reel to download it.
              </p>
            </div>
          </div>
        ) : (
          <ul className="space-y-3 py-2">
            {[
              "Saves your latest clips, effects, and arrangement",
              "Publishes the reel so it's watchable on your profile + the Lobby",
              "Plays everywhere with your effects — no render, no waiting",
              "Download the file anytime from the reel page",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5 text-[13px] text-foreground/80">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent/70" strokeWidth={1.5} />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        )}
      </SurfaceBody>

      <SurfaceFooter className="!normal-case">
        <span className={cn(TYPE_META, "tracking-[0.30em] text-muted-foreground/55")}>
          {done ? "Live" : "No render"}
        </span>
        <div className="flex items-center gap-4">
          {!busy && (
            <button
              type="button"
              onClick={onClose}
              className="text-[13px] normal-case tracking-normal text-muted-foreground/65 hover:text-foreground transition-colors font-sans"
            >
              {done ? "Close" : "Cancel"}
            </button>
          )}
          {!done && (
            <button
              type="button"
              onClick={saveAndPublish}
              disabled={busy}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-5 h-10",
                "border border-accent/40 bg-gradient-to-br from-accent/22 to-accent/6",
                "text-[13.5px] normal-case tracking-normal font-sans text-foreground transition-all",
                "hover:border-accent/60 hover:from-accent/30",
                "disabled:opacity-40 disabled:cursor-not-allowed",
              )}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin text-accent" strokeWidth={1.5} /> : <Send className="h-4 w-4 text-accent" strokeWidth={1.5} />}
              <span>{busy ? "Publishing…" : "Save & publish"}</span>
            </button>
          )}
        </div>
      </SurfaceFooter>
    </Surface>
  );
}
