/**
 * Local Ollama-backed text provider — for prompt rewrites only.
 * No video generation (Ollama is text-only). Falls through to the
 * `ollama-proxy` edge function so the local Ollama doesn't need to be
 * exposed to the public internet.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  AIProvider,
  VideoGenerationRequest,
  VideoGenerationResponse,
  PromptRewriteRequest,
  PromptRewriteResponse,
} from "./index";

export const ollamaProvider: AIProvider = {
  name: "local-ollama",

  async generateVideo(_req: VideoGenerationRequest): Promise<VideoGenerationResponse> {
    throw new Error("Ollama provider does not support video generation");
  },

  async rewritePrompt(req: PromptRewriteRequest): Promise<PromptRewriteResponse> {
    const { data, error } = await supabase.functions.invoke("ollama-proxy", {
      body: { prompt: req.prompt, instruction: req.instruction, model: "llama3.1" },
    });
    if (error) throw new Error(error.message || "Ollama rewrite failed");
    const d = data as { text?: string };
    if (typeof d?.text !== "string") throw new Error("Bad ollama response");
    return { text: d.text };
  },
};
