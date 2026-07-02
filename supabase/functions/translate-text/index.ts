// Translate one or more strings into a target language using Lovable AI.
// Public function — no auth required (translations are not sensitive).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { checkRateLimitDb, extractClientIp } from "../_shared/rate-limiter.ts";
import { publicErrorMessage } from "../_shared/safe-error.ts";

// Abuse caps (DB-backed, cross-isolate). This endpoint is public and spends
// money on the shared LOVABLE_API_KEY, so cap both total daily volume and
// per-IP burst regardless of (spoofable) x-forwarded-for.
const GLOBAL_DAILY_CAP = 5000; // translate-text calls per UTC-ish 24h window
const PER_IP_HOURLY_CAP = 60;  // per-IP calls per hour

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

    // 🔒 DB-backed abuse caps. Fail CLOSED on RPC error (this spends money).
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const ip = extractClientIp(req.headers, "unknown");
    const globalAllowed = await checkRateLimitDb(
      supabase,
      "translate-text:global",
      GLOBAL_DAILY_CAP,
      86400,
    );
    const ipAllowed = globalAllowed
      ? await checkRateLimitDb(
          supabase,
          `translate-text:ip:${ip}`,
          PER_IP_HOURLY_CAP,
          3600,
        )
      : false;
    if (!globalAllowed || !ipAllowed) {
      return new Response(
        JSON.stringify({ error: "RATE_LIMIT", message: "Translation rate limit reached. Try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = (await req.json()) as TranslateRequest;
    // Preserve the input array shape so the caller can map back
    // index-for-index. PREVIOUSLY: `body.texts.filter(Boolean)` dropped
    // empty/null strings, and the caller — which assumes a 1:1 mapping
    // — assigned wrong translations to each source string. Now we
    // preserve the slot and only ship the non-empty subset to the LLM.
    const rawTexts = Array.isArray(body?.texts) ? body.texts : [];

    // AUDIT FIX M-9: this endpoint is intentionally public (UI i18n for
    // logged-out visitors), so auth isn't viable — but it was uncapped, letting
    // a caller drain the shared LOVABLE_API_KEY with huge payloads. Bound the
    // per-request cost: cap the array length and total characters. (Per-IP rate
    // limiting is a recommended follow-up.)
    const MAX_ITEMS = 200;
    const MAX_TOTAL_CHARS = 20000;
    if (rawTexts.length > MAX_ITEMS) {
      return new Response(
        JSON.stringify({ error: `Too many strings (max ${MAX_ITEMS})` }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const totalChars = rawTexts.reduce((n: number, v: unknown) => n + (typeof v === "string" ? v.length : 0), 0);
    if (totalChars > MAX_TOTAL_CHARS) {
      return new Response(
        JSON.stringify({ error: `Payload too large (max ${MAX_TOTAL_CHARS} chars)` }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const nonEmptyIdx: number[] = [];
    const texts: string[] = [];
    for (let i = 0; i < rawTexts.length; i++) {
      const v = rawTexts[i];
      if (typeof v === "string" && v.length > 0) {
        nonEmptyIdx.push(i);
        texts.push(v);
      }
    }
    const targetLanguage = (body?.targetLanguage || "").trim();
    const languageName = (body?.languageName || targetLanguage).trim();

    if (rawTexts.length === 0 || !targetLanguage) {
      return new Response(
        JSON.stringify({ error: "texts[] and targetLanguage are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (targetLanguage === "en") {
      // Echo the raw shape — empty slots stay empty.
      return new Response(
        JSON.stringify({ translations: rawTexts }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const systemPrompt =
      `You are a professional UI translator. Translate the given UI strings ` +
      `into ${languageName} (${targetLanguage}). Rules:\n` +
      `1. Preserve placeholders like {{name}}, {0}, %s exactly.\n` +
      `2. Keep brand names ("Small Bridges", "Lovable Cloud", "Stripe", "Supabase", "GitHub", "Google", "Apple") in English.\n` +
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

    // Merge translations back into the original-shape array. Empty
    // slots stay empty; non-empty slots get the translated string.
    const merged: string[] = rawTexts.map((v) => (typeof v === "string" ? v : ""));
    for (let k = 0; k < nonEmptyIdx.length; k++) {
      merged[nonEmptyIdx[k]] = translations[k] ?? merged[nonEmptyIdx[k]];
    }

    return new Response(
      JSON.stringify({ translations: merged }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("translate-text error", e);
    return new Response(
      JSON.stringify({ error: publicErrorMessage(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});