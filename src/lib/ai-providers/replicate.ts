/**
 * Replicate-backed AI provider. Routes video generation through the
 * existing `editor-generate-clip` edge function (which talks to the
 * Seedance / Replicate APIs server-side). Prompt rewrites go through
 * the `script-assistant` edge function.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  AIProvider,
  VideoGenerationRequest,
  VideoGenerationResponse,
  PromptRewriteRequest,
  PromptRewriteResponse,
} from "./index";

export const replicateProvider: AIProvider = {
  name: "replicate",

  async generateVideo(req: VideoGenerationRequest): Promise<VideoGenerationResponse> {
    const { data, error } = await supabase.functions.invoke("editor-generate-clip", {
      body: {
        action: "submit",
        prompt: req.prompt,
        duration: req.duration,
        startImageUrl: req.startImageUrl,
        aspectRatio: req.aspectRatio ?? "16:9",
        projectId: req.projectId,
        idempotencyKey: req.idempotencyKey,
      },
    });
    if (error) throw new Error(error.message || "Video generation failed");
    const d = data as { predictionId?: string; videoUrl?: string; status?: string };
    if (!d?.predictionId) throw new Error("Bad response from generator");
    return {
      predictionId: d.predictionId,
      videoUrl: d.videoUrl,
      status: (d.status as VideoGenerationResponse["status"]) ?? "pending",
    };
  },

  async rewritePrompt(req: PromptRewriteRequest): Promise<PromptRewriteResponse> {
    const { data, error } = await supabase.functions.invoke("script-assistant", {
      body: { prompt: req.prompt, instruction: req.instruction },
    });
    if (error) throw new Error(error.message || "Prompt rewrite failed");
    const d = data as { text?: string };
    if (typeof d?.text !== "string") throw new Error("Bad rewrite response");
    return { text: d.text };
  },
};
