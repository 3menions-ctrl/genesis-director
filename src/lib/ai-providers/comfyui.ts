/**
 * ComfyUI-backed AI provider — stub.
 *
 * Routes to a self-hosted ComfyUI instance via a `comfyui-proxy` edge
 * function (added when self-hosting is turned on). ComfyUI is OSS,
 * supports the same SD/SVD/AnimateDiff stack Replicate exposes, and
 * runs on commodity GPUs.
 */
import type {
  AIProvider,
  VideoGenerationRequest,
  VideoGenerationResponse,
  PromptRewriteRequest,
  PromptRewriteResponse,
} from "./index";

export const comfyuiProvider: AIProvider = {
  name: "comfyui",

  async generateVideo(_req: VideoGenerationRequest): Promise<VideoGenerationResponse> {
    throw new Error("ComfyUI provider not configured. Set up the comfyui-proxy edge function.");
  },

  async rewritePrompt(_req: PromptRewriteRequest): Promise<PromptRewriteResponse> {
    throw new Error("ComfyUI provider not configured");
  },
};
