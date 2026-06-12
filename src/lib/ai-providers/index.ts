/**
 * AI provider abstraction — lets us swap Replicate for self-hosted
 * ComfyUI / Ollama / vLLM without changing call sites.
 *
 * The default `replicate` provider routes through the existing edge
 * functions (which talk to api.replicate.com). The `comfyui` provider
 * routes to a self-hosted ComfyUI instance via the
 * `comfyui-proxy` edge function (to be added when self-hosting is
 * enabled). The `local-ollama` provider routes to an Ollama server
 * for prompt rewrites and other text-only ops.
 *
 * Selection is at build time via VITE_AI_PROVIDER (defaults to
 * "replicate"). Subsequent calls dynamically import the matching
 * implementation so unused providers don't bloat the main bundle.
 */

export type AIProviderName = "replicate" | "comfyui" | "local-ollama";

export interface VideoGenerationRequest {
  prompt: string;
  duration: number;       // seconds, 5 or 10 typical
  startImageUrl?: string;
  aspectRatio?: string;
  projectId?: string;
  idempotencyKey?: string;
}

export interface VideoGenerationResponse {
  predictionId: string;
  videoUrl?: string;
  status: "pending" | "running" | "done" | "failed";
}

export interface PromptRewriteRequest {
  prompt: string;
  instruction: string;
}

export interface PromptRewriteResponse {
  text: string;
}

export interface AIProvider {
  name: AIProviderName;
  generateVideo(req: VideoGenerationRequest): Promise<VideoGenerationResponse>;
  rewritePrompt(req: PromptRewriteRequest): Promise<PromptRewriteResponse>;
}

const ACTIVE: AIProviderName =
  (import.meta.env.VITE_AI_PROVIDER as AIProviderName | undefined) || "replicate";

let cached: AIProvider | null = null;

export async function getAIProvider(): Promise<AIProvider> {
  if (cached) return cached;
  switch (ACTIVE) {
    case "replicate": {
      const { replicateProvider } = await import("./replicate");
      cached = replicateProvider;
      return cached;
    }
    case "comfyui": {
      const { comfyuiProvider } = await import("./comfyui");
      cached = comfyuiProvider;
      return cached;
    }
    case "local-ollama": {
      const { ollamaProvider } = await import("./ollama");
      cached = ollamaProvider;
      return cached;
    }
    default:
      throw new Error(`Unknown AI provider: ${ACTIVE}`);
  }
}
