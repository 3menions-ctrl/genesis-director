
# Phase 1 — Cinema Tier + Quality Core

Adds three premium video engines (Veo 3, Runway Gen-4, Sora 2) plus a "Quality Core" upgrade pack (4K upscale, 60fps interpolation, Prompt Enhancer v2, Auto-Retake, Continuity Engine v2). Cinema is gated behind a new **Studio Cinema** subscription tier; one-time credit packs stay on Standard/Pro engines.

This is Phase 1 of a 4-phase roadmap (Cinema → Templates → Audio Suite → Image & Brand). Each phase is independently shippable.

---

## Goals

1. Deliver a visible quality jump for paying customers — Cinema engines produce dramatically better motion, prompt adherence, and physics than Kling V3.
2. Establish a clean **engine registry** so future engines plug in without rewriting the pipeline.
3. Open a recurring revenue line (Studio Cinema subscription) without disrupting existing pay-as-you-go credit users.
4. Zero regressions on the existing Kling V3 / Seedance flows.

---

## Scope

### In scope
- New engines: Veo 3 Fast (Replicate), Runway Gen-4 Turbo (Runway API), Sora 2 (Replicate / OpenAI)
- Quality Core utilities: 4K upscale (Topaz Astra via Replicate), 60fps interpolation (RIFE via Replicate), Prompt Enhancer v2, Auto-Retake (1 silent re-roll on failed quality gate), Continuity Engine v2 (project-wide character/wardrobe embeddings)
- Engine registry + capability matrix
- Studio Cinema subscription product (Stripe), entitlement gating
- Engine picker UI on Create page; pricing/cost preview per engine
- Settings → Plans page: Cinema tier card

### Out of scope (later phases)
- Template marketplace (Phase 2)
- Voice cloning, dubbing, captions (Phase 3)
- Image engines, ControlNets, Brand Kit v2 (Phase 4)

---

## User-facing changes

- **Create page** gets an "Engine" selector with three tiers:
  - **Standard** — Kling V3 (current) — credits only
  - **Pro** — Seedance 2.0 (current) — credits only
  - **Cinema** — Veo 3 / Runway Gen-4 / Sora 2 — requires Studio Cinema subscription
- Cinema engines show a "Studio Cinema" badge; non-subscribers see an "Unlock" CTA that opens the upgrade sheet inline.
- Per-engine cost preview appears in real time as user changes engine/duration/clip count.
- New **Quality** panel under Create → Advanced:
  - Toggle: 4K Upscale (+10 credits/clip)
  - Toggle: 60fps Smooth Motion (+5 credits/clip)
  - Toggle: Auto-Retake on quality failure (free, on by default for Cinema)
- Settings → Plans gets a Studio Cinema card (monthly/annual). Existing one-time credit packs stay untouched.
- Projects page badges Cinema-rendered videos with a small monogram on the thumbnail.

---

## Pricing

### Studio Cinema subscription (new)
| Plan | Monthly | Annual | Includes |
|---|---|---|---|
| Cinema Lite | $79/mo | $790/yr | Cinema engines unlocked, 600 fair-use Cinema-seconds/mo, Quality Core included |
| Cinema Pro | $199/mo | $1,990/yr | 2,000 Cinema-seconds/mo, priority queue, 4K free |
| Cinema Studio | $499/mo | $4,990/yr | 6,000 Cinema-seconds/mo, white-label exports, team seat × 3 |

After fair-use, additional Cinema seconds bill from credit balance at engine-specific rates.

### Per-engine credit cost (charged when over fair-use, or for ad-hoc credit-only purchase if we open it later)
Pass-through provider cost + 30% margin, rounded to clean credit values:

| Engine | 5s | 10s | 15s | Real cost (10s) |
|---|---|---|---|---|
| Veo 3 Fast | 200 | 400 | 600 | ~$3.00 |
| Runway Gen-4 Turbo | 250 | 500 | n/a (max 10s) | ~$3.80 |
| Sora 2 | 300 | 600 | 900 | ~$4.50 |
| Kling V3 (Standard) | 25 | 50 | 75 | $3.38 (existing) |
| Seedance 2.0 (Pro) | 35 | 65 | 95 (12s cap) | $4.50 (existing) |

All in `CREDIT_SYSTEM` with margin documentation, identical to existing pattern.

### Quality Core surcharges
- 4K upscale: +10 credits/clip (real cost ~$0.40, margin 150%)
- 60fps interpolation: +5 credits/clip (real cost ~$0.15, margin 230%)
- Auto-Retake: free (one silent re-roll on failed gate)
- Prompt Enhancer v2: free (LLM call ~$0.002 via Lovable AI)
- Continuity Engine v2: free (one-time embedding extraction ~$0.10/project)

---

## Architecture

### Engine registry (new)
`src/lib/video/engines.ts` — single source of truth:
```ts
type EngineId = 'kling-v3' | 'seedance-2' | 'veo-3' | 'runway-gen4' | 'sora-2';
interface EngineSpec {
  id: EngineId;
  tier: 'standard' | 'pro' | 'cinema';
  label: string;
  durations: number[];
  maxDuration: number;
  supportsImageInput: boolean;
  supportsAudio: boolean;
  supportsAvatar: boolean;
  creditsFor(duration: number, opts?: { upscale4k?: boolean; fps60?: boolean }): number;
  requiresEntitlement?: 'studio_cinema';
}
```
All UI (Create page picker, cost preview, gating) reads from this registry. Backend `generate-video` reads the same registry (mirrored under `supabase/functions/_shared/engines.ts`).

### Edge functions
- `generate-video` — extended with provider routing (`provider: 'kling' | 'seedance' | 'veo3' | 'runway' | 'sora'`). Cinema providers each get their own poll/result handler, but the existing `pending_video_tasks` watchdog pattern is reused unchanged.
- `quality-upscale` — new, calls Topaz Astra on Replicate; idempotent; fires after `generate-video` completes if `upscale4k` flag set.
- `quality-interpolate` — new, calls RIFE; runs after upscale (or directly after generate if no upscale).
- `prompt-enhance-v2` — new, Lovable AI Gateway call (`google/gemini-3-flash-preview`) with cinematographer system prompt (lens, lighting, film stock, lens flares). Runs on Cinema engines automatically; toggleable on Standard/Pro.
- `auto-retake` — runs inside `generate-video` watchdog; if quality gate fails (face distortion / duplicate limbs detector via Lovable AI vision pass on first frame), one silent re-roll with seed shift.
- `extract-continuity-embeddings` — new, runs once per project on first character upload; stores embedding in `projects.continuity_manifest_v2` JSONB; consumed by every subsequent clip.
- `create-cinema-checkout` — new Stripe checkout for Studio Cinema plans. Reuses `_shared/stripe.ts` gateway client. `managed_payments: { enabled: true }`.
- `cinema-entitlement-check` — new RPC wrapping `subscriptions` table, returns `{ tier, fairUseSecondsRemaining, periodEnd }`.

### Database (migrations)
- `subscriptions` table — already exists from prior Stripe work; add CHECK on `tier` to include `'cinema_lite' | 'cinema_pro' | 'cinema_studio'` via validation trigger (not CHECK constraint, per project memory).
- New table `cinema_usage_ledger` — tracks Cinema-seconds consumed per billing period for fair-use enforcement. Columns: `user_id`, `subscription_id`, `period_start`, `period_end`, `engine`, `seconds_used`, `clip_id`. RLS: user reads own; service role writes.
- New columns on `projects`:
  - `engine` text (default `'kling-v3'`)
  - `quality_options` jsonb (default `'{"upscale4k": false, "fps60": false, "autoRetake": true}'`)
  - `continuity_manifest_v2` jsonb (nullable)
- New columns on `videos`:
  - `engine` text
  - `final_resolution` text (`'1080p' | '4k'`)
  - `final_fps` int (`24 | 30 | 60`)

### Stripe products
Create via `payments--batch_create_product`:
- `cinema_lite` → `cinema_lite_monthly` ($79/mo), `cinema_lite_yearly` ($790/yr)
- `cinema_pro` → `cinema_pro_monthly` ($199/mo), `cinema_pro_yearly` ($1,990/yr)
- `cinema_studio` → `cinema_studio_monthly` ($499/mo), `cinema_studio_yearly` ($4,990/yr)
- Tax code: `txcd_10103001` (SaaS)
- All single-purchase: `quantity_min: 1`, `quantity_max: 1`

### Secrets
Need to add at edge function runtime (request via secrets tool when starting Cinema engines):
- `RUNWAY_API_KEY` — for Runway Gen-4
- (Veo 3 and Sora 2 ride on existing `REPLICATE_API_KEY`)

### Entitlement & fair-use enforcement
1. Client calls `cinema-entitlement-check` before opening Cinema picker.
2. `generate-video` re-checks server-side (never trust client). Order:
   - Verify auth → load subscription row → if no Cinema entitlement → 402 with `{ requiresUpgrade: 'studio_cinema' }`.
   - If entitled but fair-use exhausted → calculate overage credits, deduct from credit balance via existing `deduct_credits_atomic` RPC. If insufficient → 402 with credit shortfall.
   - On success → write to `cinema_usage_ledger`.
3. Subscription cancellation: Cinema engines greyed out from `current_period_end` forward.

---

## Quality Core details

### Prompt Enhancer v2
System prompt teaches LLM to inject:
- Lens (35mm/50mm/85mm/anamorphic)
- Lighting (key/fill/rim ratios, golden hour, practical sources)
- Color science (Kodak 2383, Arri LogC look, Fuji Eterna)
- Lens artifacts (anamorphic flare, bokeh shape, chromatic aberration tasteful)
- Camera body cues ("shot on Alexa Mini LF")
Runs as a server-side rewrite step before provider call. User sees the enhanced prompt in a collapsible "Show enhanced prompt" disclosure.

### Auto-Retake
After provider returns first frame:
- Lovable AI vision pass (`google/gemini-3-flash-preview`) scores: face_integrity (0–1), limb_count_correct (bool), prompt_adherence (0–1), motion_artifact (0–1).
- If composite < 0.65 → one silent re-roll with `seed += 1` and slightly lowered guidance.
- Free for user; cost absorbed (~$0.005 per gate check).
- Logged to `clips.quality_gate_log` for analytics.

### Continuity Engine v2
- On first character upload to a project, run face/wardrobe feature extraction (existing Face Lock pipeline, extended).
- Persist embeddings + canonical reference images per character/wardrobe item to `projects.continuity_manifest_v2`.
- Every subsequent clip's prompt builder injects the canonical reference + embedding-anchored description.
- Eliminates per-clip drift across long projects.

### 4K Upscale & 60fps
- Topaz Astra via Replicate (`topazlabs/video-upscale`) — runs post-generation.
- RIFE 4.x via Replicate (`zsxkib/rife`) — runs post-upscale.
- Both are queued as follow-up jobs in `pending_video_tasks` (existing watchdog handles retries).
- Final URL replaces `videos.final_url`; original 1080p stays on `videos.preview_url` for fallback.

---

## Implementation steps (ordered)

```text
Step 1  Engine registry + capability matrix
        - src/lib/video/engines.ts (FE)
        - supabase/functions/_shared/engines.ts (BE mirror)
Step 2  Database migrations
        - cinema_usage_ledger table + RLS
        - projects.engine, quality_options, continuity_manifest_v2
        - videos.engine, final_resolution, final_fps
Step 3  Stripe products (batch_create_product, 3 plans × 2 intervals)
Step 4  Subscription plumbing
        - cinema-entitlement-check RPC
        - useCinemaEntitlement() hook
        - create-cinema-checkout edge function
Step 5  Provider integrations (one PR per engine for safety)
        - Veo 3 Fast handler in generate-video
        - Runway Gen-4 Turbo handler (needs RUNWAY_API_KEY secret)
        - Sora 2 handler
Step 6  Quality Core utilities
        - prompt-enhance-v2
        - auto-retake gate
        - quality-upscale (Topaz)
        - quality-interpolate (RIFE)
        - extract-continuity-embeddings
Step 7  UI
        - Engine picker on Create page
        - Quality panel
        - Cinema upgrade sheet
        - Plans page Cinema card
        - Projects page Cinema badge
Step 8  Cost preview + entitlement gating
Step 9  QA pass: regression on Kling/Seedance, e2e Cinema generation,
        subscription lifecycle, fair-use overflow → credit deduction
```

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Provider outages (Runway, Sora new) | Engine registry exposes per-engine `healthy` flag; auto-disable picker option; fallback to Kling V3 with refund |
| Sora 2 / Veo 3 access not yet granted on Replicate account | Step 5 gates the engine behind a feature flag until access confirmed |
| Fair-use overflow billing complexity | Hard ledger, server-side computed; client never decides; reuses `deduct_credits_atomic` RPC for credit overflow |
| Existing credit-pack users feel downgraded | Cinema is purely additive — no existing engine gets removed or repriced |
| Long generation time (Sora 2 can take 5+ min) | Watchdog pattern already proven; UI shows engine-specific ETA |
| Subscription confusion vs. credit packs | Plans page clearly labels "Includes Cinema engines" vs "Credits only" |

---

## Success criteria

- Cinema generations complete e2e for all 3 engines on test projects
- Subscription purchase → entitlement → first Cinema render < 60 seconds wall-clock
- Fair-use ledger correctly tracks seconds; overage deducts credits atomically
- Zero regressions on existing Kling V3 / Seedance flows (smoke test all current Create-page combinations)
- 4K + 60fps deliver visibly improved final exports
- Auto-Retake catches ≥80% of obvious failures in internal eval

---

## Phases 2–4 preview (for planning only; not built in this phase)

- **Phase 2 — Template Marketplace**: 40+ goal-based templates (Ad/Trailer/UGC/Explainer/Faceless/Talking-head/Music video/Real-estate), filterable by industry/platform/length, each pre-wires script + scenes + music + captions + export. New `templates_marketplace` table, public showcase, "Use template" handoff into Create.
- **Phase 3 — Audio Suite**: ElevenLabs voice cloning, multi-language dubbing with lip-resync, 200+ voice library, Suno/Udio music with vocals, MrBeast/Submagic-style auto-captions, stems separation, mastering.
- **Phase 4 — Image & Brand**: FLUX Ultra Raw / Ideogram 3 / Recraft v3 / Imagen 4, ControlNets, brand-locked LoRA, bulk variants, inpainting brush, object remove/replace, 14 new photo templates, Brand Kit v2.

After Phase 1 ships and stabilizes (~2 weeks), we re-evaluate priority order based on usage signal.
