// director-chat — the AI half of the editor's Director Chat (audit #14 / M13).
//
// DirectorChat.tsx invokes "director-chat" with { projectId, prompt,
// playheadSec, context:{clipCount,duration} } and renders { reply,
// appliedVersion? }. The function never existed, so every non-local-command
// prompt 404'd into the "backend brain isn't connected" fallback. editor-ai-scene
// is a structured scene GENERATOR (returns scene JSON), not a chat — so this is
// a small purpose-built chat endpoint over the same AI gateway. It always
// returns 200 with a usable { reply } (even on AI failure) so the editor never
// shows a dead error.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { validateAuth } from "../_shared/auth-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await validateAuth(req);
    if (!auth.authenticated) return json({ error: "Unauthorized" }, 401);

    const { prompt, playheadSec, context } = await req.json().catch(() => ({}));
    if (!prompt || typeof prompt !== "string") {
      return json({ error: "prompt is required" }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      // No AI configured — degrade to a helpful, honest reply (still 200).
      return json({
        reply:
          "I can help with pacing, transitions, speed, and marks right here — try a command like “add a crossfade” or “slow this clip down.”",
      });
    }

    const clipCount = Number(context?.clipCount ?? 0);
    const duration = Number(context?.duration ?? 0);
    const head = Number(playheadSec ?? 0);

    const systemPrompt =
      "You are the Director, a concise, encouraging creative assistant inside a film editor. " +
      "Give short, practical guidance on pacing, transitions, shot choice, music, and story beats. " +
      "Reply in plain text under 80 words. No markdown, no lists unless essential.";

    const messages = [
      { role: "system" as const, content: systemPrompt },
      {
        role: "user" as const,
        content:
          `The project currently has ${clipCount} clip(s), about ${Math.round(duration)}s total, ` +
          `playhead at ${Math.round(head)}s.\n\nDirector, ${prompt}`,
      },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages }),
    });

    if (!response.ok) {
      const note =
        response.status === 429
          ? "I’m a little busy right now — give me a moment and try again."
          : "I couldn’t reach my creative brain just now, but your transition, speed, and mark commands still work.";
      return json({ reply: note });
    }

    const data = await response.json();
    const reply = (data?.choices?.[0]?.message?.content ?? "").trim() || "Noted.";
    return json({ reply });
  } catch (e) {
    console.error("director-chat error:", e);
    // Never hard-fail the editor — return a usable reply.
    return json({
      reply: "Something glitched on my end, but your local edit commands still work. Try me again in a sec.",
    });
  }
});
