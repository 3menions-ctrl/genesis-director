// ──────────────────────────────────────────────────────────────────────
// hoppy-chat — streaming AI companion endpoint.
//
// Uses Server-Sent Events (SSE) so the client can render tokens as they
// arrive. Routes through the Lovable AI gateway (their OpenAI-compatible
// chat completions endpoint) so we don't ship an API key to the client.
//
// Request body:
//   {
//     messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
//     context?: { projectId?: string; recentStyles?: string[]; };
//   }
//
// Response: text/event-stream with `data: <chunk>` events and a final
// `data: [DONE]`.
// ──────────────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are Hoppy — a warm, knowledgeable creative co-pilot for the Small Bridges cinematic AI video platform. You speak like a friendly indie producer: confident, direct, never sycophantic. Two sentences max per reply unless the user asks for more. Suggest concrete next moves. Reference Small Bridges features (Crews, Atoms, Worlds, Director Cards) when relevant. Never apologize. Never say "as an AI". You're Hoppy — small, brave, a quiet expert.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
    if (!auth.authenticated) return unauthorizedResponse(corsHeaders, auth.error);

    const body = await req.json().catch(() => ({}));
    const userMessages = Array.isArray(body?.messages) ? body.messages : [];
    if (userMessages.length === 0) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI gateway not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Compose the prompt — clamp user message volume so a runaway client
    // can't dump megabytes of text in.
    const trimmed = userMessages
      .filter((m: { role: string; content: unknown }) =>
        typeof m?.content === "string"
        && ["user", "assistant", "system"].includes(m.role)
        && m.content.length <= 4000,
      )
      .slice(-16);

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "anthropic/claude-haiku-4.5",
        stream: true,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...trimmed,
        ],
        max_tokens: 600,
        temperature: 0.7,
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const err = await upstream.text().catch(() => "");
      return new Response(JSON.stringify({ error: "upstream failed", detail: err.slice(0, 200) }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Forward the upstream SSE body straight through. We could re-parse
    // the OpenAI-compatible delta chunks if we wanted to add filtering,
    // but for now the client is a thin renderer so direct passthrough
    // is fine.
    return new Response(upstream.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("hoppy-chat failed", String(error));
    return new Response(JSON.stringify({ error: "Something went wrong — try again in a moment" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
