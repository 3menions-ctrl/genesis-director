// ═══════════════════════════════════════════════════════════════════════════
// llm-complete.ts — ONE chat-completion helper with provider fallback.
//
// WHY: prod lost every direct LLM key when the app moved off the Lovable
// gateway (no OPENAI_API_KEY / GEMINI key in edge secrets), which silently
// killed the whole "LLM director" layer — every cinematic script fell back
// to naive prompt-splitting. But the REPLICATE_API_KEY that powers video
// generation is always present, and Replicate hosts the same frontier LLMs
// (openai/gpt-5, openai/gpt-4o, anthropic/claude-4.5-sonnet,
// google/gemini-3-pro — all verified live 2026-07-02).
//
// Provider order:
//   1. OPENAI_API_KEY set → api.openai.com chat/completions (cheapest, JSON mode)
//   2. REPLICATE_API_KEY  → Replicate-hosted model, sync via `Prefer: wait`
//
// Returns the raw completion text. Callers keep their own JSON recovery
// (Replicate's LLM endpoints have no response_format enforcement, so the
// system prompt must demand JSON — parseJsonWithRecovery handles slack).
// ═══════════════════════════════════════════════════════════════════════════

export interface LLMCompleteOptions {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  /** Ask the provider for a JSON object (OpenAI json mode; prompt-enforced on Replicate). */
  json?: boolean;
  /** Replicate model slug for the fallback provider. */
  replicateModel?: string;
}

export interface LLMCompleteResult {
  text: string;
  provider: 'openai' | 'replicate';
  model: string;
  usage?: unknown;
}

const REPLICATE_DEFAULT_LLM = 'openai/gpt-4o';

export async function completeLLM(opts: LLMCompleteOptions): Promise<LLMCompleteResult> {
  const {
    systemPrompt,
    userPrompt,
    maxTokens = 4000,
    temperature = 0.8,
    json = false,
    replicateModel = REPLICATE_DEFAULT_LLM,
  } = opts;

  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (openaiKey) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: maxTokens,
        temperature,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`OpenAI API error: ${res.status} ${errText.slice(0, 200)}`);
    }
    const data = await res.json();
    return {
      text: data.choices?.[0]?.message?.content ?? '',
      provider: 'openai',
      model: 'gpt-4o',
      usage: data.usage,
    };
  }

  const replicateKey = Deno.env.get('REPLICATE_API_KEY');
  if (!replicateKey) {
    throw new Error('No LLM provider configured: neither OPENAI_API_KEY nor REPLICATE_API_KEY is set.');
  }

  // Replicate language models return output as an array of text chunks.
  // `Prefer: wait` holds the connection until done (or ~60s), so no polling
  // for typical script-sized completions; poll as a safety net if needed.
  const sys = json
    ? `${systemPrompt}\n\nCRITICAL OUTPUT RULE: respond with ONE valid JSON object and NOTHING else — no markdown fences, no commentary.`
    : systemPrompt;
  const create = await fetch(`https://api.replicate.com/v1/models/${replicateModel}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${replicateKey}`,
      'Content-Type': 'application/json',
      Prefer: 'wait',
    },
    body: JSON.stringify({
      input: {
        prompt: userPrompt,
        system_prompt: sys,
        max_completion_tokens: maxTokens,
        // Reasoning models (gpt-5 family) reject `temperature` — mirror
        // OpenAI's own API constraint.
        ...(replicateModel.includes('gpt-5') ? {} : { temperature }),
      },
    }),
  });
  if (!create.ok) {
    const errText = await create.text().catch(() => '');
    throw new Error(`Replicate LLM error: ${create.status} ${errText.slice(0, 200)}`);
  }
  let pred = await create.json();

  // Safety-net poll for completions that outlive the sync window.
  const startedAt = Date.now();
  while (pred.status !== 'succeeded' && pred.status !== 'failed' && pred.status !== 'canceled') {
    if (Date.now() - startedAt > 120_000) throw new Error('Replicate LLM timeout after 120s');
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, {
      headers: { Authorization: `Bearer ${replicateKey}` },
    });
    if (poll.ok) pred = await poll.json();
  }
  if (pred.status !== 'succeeded') {
    throw new Error(`Replicate LLM prediction ${pred.status}: ${String(pred.error ?? '').slice(0, 200)}`);
  }

  const text = Array.isArray(pred.output) ? pred.output.join('') : String(pred.output ?? '');
  return { text, provider: 'replicate', model: replicateModel, usage: pred.metrics };
}
