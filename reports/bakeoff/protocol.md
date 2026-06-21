# Creation-engine bake-off — protocol

**Question we're answering:** Does *our* approach (prompt-engineering + per-shot model routing, later + finishing) produce visibly better output than (a) the best single model raw, and (b) LTX Studio? If not, the "best automatic finished output" wedge isn't real and we re-pick **before** building UI.

This is a **human blind evaluation.** The harness generates the clips and builds an anonymized side-by-side page; a person watches and scores. No one (including the people scoring) should know which column is which until after scoring.

## Contenders
- **A — Ours (engineered + routed):** our golden-prompt structure (camera/lens/lighting/motion/quality + negatives, engine-tuned) and each prompt routed to its best-fit engine per our matrix.
- **B — Baseline (single model, raw):** the *raw* one-line prompt → the strongest all-rounder (Veo 3 / Veo 3-fast). No engineering.
- **C — LTX Studio:** the same prompts run in LTX Studio. **Manual** — must be done by a human with an LTX account (can't be automated). Optional for v1.

## The 5 prompts (archetypes, so the result generalizes)
1. **Establishing / scenic** — "A lighthouse on a storm-battered cliff at dawn." → route: **Veo 3**
2. **Action / physics** — "A motorcyclist drifts around a rain-slicked hairpin turn at night." → route: **Kling 2.5** (Sora is being retired)
3. **Dialogue / avatar** — "A detective leans toward the camera and says: 'You were never supposed to find this.'" → route: **Kling** (only real lip-sync)
4. **Character consistency (2 shots)** — "A young woman in a red coat walks a foggy street" → then "she stops and turns to face the camera." → route: **Kling** (start-image chaining)
5. **Stylized** — "An ink-wash dragon coiling through bamboo, sumi-e style." → route: **Seedance 1 Pro**

## Layers (run cheapest → most expensive; stop early if a layer fails)
- **L1 — Prompt engineering** (cheapest, foundational): engineered vs raw on the *same* model, 1 prompt. If engineering doesn't visibly help, routing/finishing won't save it.
- **L2 — Routing:** each prompt via its best-fit engine (A) vs all on the single baseline (B).
- **L3 — Finishing:** add our color grade + seamless stitch + (when built) sound design / beat-synced score / 4K. *Note: finishing is partly unbuilt — tested last.*
- **L4 — LTX:** manual, same prompts.

## Scoring rubric (1–5 each, score blind, A/B/C hidden)
| Criterion | What to watch for |
|---|---|
| Prompt adherence | Did it make what was asked? |
| Motion realism | Weight, momentum, no morphing/jitter |
| Character / continuity | Same subject across the shot/scene |
| Cinematic quality | Light, composition, grade, "looks expensive" |
| **Would you ship it?** | The only score that really matters |

**Decision rule:** if A doesn't clearly beat B on "would you ship it" across the 5 prompts, the wedge is not real → re-pick before building.

## Budget
- L1 proof: ~$0.50 (seedance, 2 clips).
- Full L2 (A vs B, 5 prompts, ~6 gens): est. $8–15 depending on Veo usage. Greenlight required before running.

## Output
`reports/bakeoff/index.html` — anonymized side-by-side `<video>` grid + a scoring sheet. Open it locally to evaluate.
