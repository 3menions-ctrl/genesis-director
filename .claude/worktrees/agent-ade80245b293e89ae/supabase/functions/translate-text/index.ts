// Translate one or more strings into a target language using Lovable AI.
// Public function — no auth required (translations are not sensitive).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TranslateRequest {
  texts: string[];
  targetLanguage: string;   // e.g. "es"
  languageName?: string;    // e.g. "Spanish"
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = (await req.json()) as TranslateRequest;
    const texts = Array.isArray(body?.texts) ? body.texts.filter(Boolean) : [];
    const targetLanguage = (body?.targetLanguage || "").trim();
    const languageName = (body?.languageName || targetLanguage).trim();

    if (texts.length === 0 || !targetLanguage) {
      return new Response(
        JSON.stringify({ error: "texts[] and targetLanguage are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (targetLanguage === "en") {
      return new Response(
        JSON.stringify({ translations: texts }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const systemPrompt =
      `You are a professional UI translator. Translate the given UI strings ` +
      `into ${languageName} (${targetLanguage}). Rules:\n` +
      `1. Preserve placeholders like {{name}}, {0}, %s exactly.\n` +
      `2. Keep brand names ("Apex Studio", "Lovable Cloud", "Stripe", "Supabase", "GitHub", "Google", "Apple") in English.\n` +
      `3. Match tone — concise, premium, cinematic.\n` +
      `4. Do NOT add explanations or quotes around output.\n` +
      `5. Return strictly via the provided tool.`;

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content:
                `Translate these ${texts.length} strings to ${languageName}. ` +
                `Return them in the SAME order via the tool.\n\n` +
                texts.map((t, i) => `${i + 1}. ${t}`).join("\n"),
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "return_translations",
                description: "Return translated strings in the same order as input.",
                parameters: {
                  type: "object",
                  properties: {
                    translations: {
                      type: "array",
                      items: { type: "string" },
                      description: "Translated strings, same length and order as input",
                    },
                  },
                  required: ["translations"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "return_translations" } },
        }),
      },
    );

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const text = await aiResponse.text();
      console.error("AI gateway error", status, text);
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "RATE_LIMIT", fallback: true, translations: texts }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "CREDITS_EXHAUSTED", fallback: true, translations: texts }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: "TRANSLATION_FAILED", fallback: true, translations: texts }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const json = await aiResponse.json();
    const toolCall = json?.choices?.[0]?.message?.tool_calls?.[0];
    let translations: string[] = texts;
    try {
      const args = toolCall?.function?.arguments;
      if (args) {
        const parsed = typeof args === "string" ? JSON.parse(args) : args;
        if (Array.isArray(parsed?.translations)) {
          translations = parsed.translations.map((t: unknown, i: number) =>
            typeof t === "string" && t.length > 0 ? t : texts[i],
          );
          // Safety: pad/truncate to original length
          if (translations.length !== texts.length) {
            translations = texts.map((t, i) => translations[i] ?? t);
          }
        }
      }
    } catch (e) {
      console.error("Failed to parse tool args", e);
    }

    return new Response(
      JSON.stringify({ translations }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("translate-text error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});