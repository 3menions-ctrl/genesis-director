import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface StitchClip {
  url: string;
  duration: number;
  volume?: number;
  speed?: number;
  fadeIn?: number;
  fadeOut?: number;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  transition?: string;
  transitionDuration?: number;
}

export interface StitchConfig {
  crossfadeDuration?: number; // seconds, default 0 (seamless join). Set > 0 for crossfade.
  transition?: string; // "fade" | "wipeleft" | "wiperight" | "slideup" | "slidedown" etc.
}

type StitchStatus = "idle" | "submitting" | "processing" | "completed" | "failed";

export function useEditorStitch() {
  const [status, setStatus] = useState<StitchStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryCountRef = useRef(0);
  const lastSubmitRef = useRef<{ sessionId: string; clips: StitchClip[]; config: StitchConfig } | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    stopPolling();
    retryCountRef.current = 0;
    lastSubmitRef.current = null;
    setStatus("idle");
    setProgress(0);
    setOutputUrl(null);
    setError(null);
  }, [stopPolling]);

  const pollStatus = useCallback(async (sessionId: string) => {
    try {
      const { data, error: err } = await supabase.functions.invoke("editor-stitch", {
        body: { action: "status", sessionId },
      });

      if (err) {
        console.error("[Stitch] Poll error:", err);
        return;
      }

      if (data.status === "completed") {
        stopPolling();
        setStatus("completed");
        setProgress(100);
        setOutputUrl(data.outputUrl);
        toast.success("Video stitched successfully!");

        // Auto-download
        if (data.outputUrl) {
          const a = document.createElement("a");
          a.href = data.outputUrl;
          a.download = `Apex_Stitch_${Date.now()}.mp4`;
          a.click();
        }
      } else if (data.status === "failed") {
        stopPolling();
        const isTransient = /upload output|temporarily unavailable|timeout/i.test(data.error || "");
        
        if (isTransient && retryCountRef.current < 2 && lastSubmitRef.current) {
          retryCountRef.current++;
          toast.warning(`Stitch failed (server issue), retrying… (${retryCountRef.current}/2)`);
          setStatus("submitting");
          setProgress(5);
          // Re-submit after short delay
          setTimeout(() => {
            const { sessionId, clips, config } = lastSubmitRef.current!;
            submitStitchInternal(sessionId, clips, config);
          }, 2000);
          return;
        }
        
        setStatus("failed");
        setError(data.error || "Stitch failed");
        toast.error(`Stitch failed: ${data.error || "Unknown error"}`, {
          action: lastSubmitRef.current ? {
            label: "Retry",
            onClick: () => {
              if (lastSubmitRef.current) {
                const { sessionId, clips, config } = lastSubmitRef.current;
                retryCountRef.current = 0;
                submitStitchInternal(sessionId, clips, config);
              }
            },
          } : undefined,
        });
      } else {
        setProgress(data.progress || 30);
      }
    } catch (e) {
      console.error("[Stitch] Poll exception:", e);
    }
  }, [stopPolling]);

  const submitStitchInternal = useCallback(async (
    sessionId: string,
    clips: StitchClip[],
    config: StitchConfig = {}
  ) => {
    stopPolling();
    setStatus("submitting");
    lastSubmitRef.current = { sessionId, clips, config };

    try {
      const { data, error: err } = await supabase.functions.invoke("editor-stitch", {
        body: {
          action: "submit",
          sessionId,
          clips,
          crossfadeDuration: config.crossfadeDuration ?? 0,
          transition: config.transition ?? "fade",
        },
      });

      if (err) throw new Error(err.message);
      if (!data?.success) throw new Error(data?.error || "Submit failed");

      setStatus("processing");
      setProgress(10);
      toast.info(`Stitching ${clips.length} clips with ${config.transition || "fade"} crossfade...`);

      pollRef.current = setInterval(() => pollStatus(sessionId), 3000);
    } catch (e: any) {
      setStatus("failed");
      setError(e.message);
      toast.error(`Stitch error: ${e.message}`);
    }
  }, [stopPolling, pollStatus]);

  const submitStitch = useCallback(async (
    sessionId: string,
    clips: StitchClip[],
    config: StitchConfig = {}
  ) => {
    if (clips.length < 2) {
      toast.error("Need at least 2 clips to stitch");
      return;
    }
    reset();
    retryCountRef.current = 0;
    await submitStitchInternal(sessionId, clips, config);
  }, [reset, submitStitchInternal]);

  return {
    submitStitch,
    status,
    progress,
    outputUrl,
    error,
    reset,
    isStitching: status === "submitting" || status === "processing",
  };
}
