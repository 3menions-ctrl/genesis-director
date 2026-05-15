
## What's actually wired right now (audit)

I checked `mode-router`, `generate-video`, `hollywood-pipeline`, `replicate-catalog`, and `CreationHub`. The truth:

| Surface | Status |
|---|---|
| `mode-router` accepts modes: `text-to-video`, `image-to-video`, `avatar`, `video-to-video`, `motion-transfer`, `b-roll` | Wired |
| Avatar pipeline (`handleAvatarDirectMode` → Kling V3 native audio) | Working |
| Text-to-video (Kling V3) | Working |
| Image-to-video (Kling V3 with `start_image`) | Working but not tuned per-model |
| **Seedance 2.0** — UI offers it as an engine card | **Broken**: `generate-video.ts` hardcodes Kling V3 and silently ignores `videoEngine='seedance'` |
| **Veo 3 Fast** — typed in `hollywood-pipeline`, listed in `replicate-catalog` | **Not implemented** — no actual call path |
| **Sora 2** — listed in `replicate-catalog`, typed in `hollywood-pipeline` | **Not implemented** — no pipeline, no UI exposure |
| `video-to-video` (style transfer) | Routed but uses fixed model, no engine choice |
| `motion-transfer` | Routed but minimal |

So when a user picks "Seedance" on the Create page, they pay Seedance pricing but get Kling output. And there is no Sora path at all. That is the gap you called out.

## Plan — build the missing pipelines and optimize per model

### 1. Generation router refactor (`generate-video/index.ts`)
Replace the hardcoded Kling-only branch with a dispatcher:

```text
videoEngine ──► dispatcher
     ├─ kling     → kwaivgi/kling-v3-video       (T2V, I2V, Avatar w/ native audio)
     ├─ seedance  → bytedance/seedance-1-pro     (hyperreal motion, 1080p, 5/10s)
     ├─ veo       → google/veo-3-fast            (cinema, native audio, 8s)
     └─ sora      → openai/sora-2                (cinema, narrative coherence)
```

Each engine gets its own `generateWith<Engine>()` builder with model-specific input shape (e.g. Sora uses `prompt` + `aspect_ratio` + `duration`; Veo 3 uses `prompt` + `image` for I2V; Seedance uses `prompt` + `image` + `resolution`).

### 2. Per-model prompt optimization (`_shared/prompt-optimizers.ts`, new)
Each model rewards different prompt shapes. I'll add a small per-engine optimizer:
- Kling V3 → camera + lens grammar, lip-sync hints for avatar
- Seedance → motion verbs + lighting nouns, no camera jargon
- Veo 3 → audio cues (it generates audio), 8s pacing
- Sora 2 → narrative beats, character-action-camera triplet, longer-form coherent shots

The optimizer runs after `buildConsistentPrompt` and is engine-aware.

### 3. Engine-aware credit + duration tables
Source of truth in `_shared/engine-config.ts`:

```text
kling     5–10s  $0.10/s  audio:native
seedance  5,10s  $0.15/s  audio:overlay
veo       8s     $0.20/s  audio:native
sora      4,8,12 $0.30/s  audio:overlay
```

`hollywood-pipeline` and `mode-router` both read from this table — no more drift.

### 4. CreationHub UI — expose all four engines honestly
Engine selector becomes 4 cards with real model names, taglines, per-second cost, and supported durations. The duration picker reacts to engine. Selecting Sora/Veo gates on entitlement (cinema tier).

### 5. Image-to-video — model-aware
- Kling: `start_image`
- Seedance: `image`
- Veo 3: `image` (first-frame conditioning)
- Sora 2: `prompt` only (Sora 2 doesn't take image; UI disables I2V card when Sora selected, with explanation)

### 6. Avatar pipeline — keep on Kling V3 (lip-sync king), but add Veo 3 fallback for non-dialogue avatar B-roll.

### 7. Replicate webhook + status polling — engine-tagged
`check-video-status` and `replicate-webhook` already poll generic predictions. Add `engine` to the persisted task so the UI can show "Sora 2 rendering…" instead of generic "Rendering…".

### 8. Verification
After build, I'll:
- Curl `mode-router` for each (mode × engine) combo with a tiny test prompt and confirm correct model ID is logged on Replicate side via `kling-v3-audit-test` pattern (will add `seedance-audit-test`, `veo-audit-test`, `sora-audit-test`).
- Confirm credits deducted match the `engine-config` table.
- Confirm UI engine card → backend model ID is consistent.

## Open questions before I start

1. **Sora 2 access** — Sora 2 on Replicate requires `openai/sora-2` model access on your Replicate account. Confirm `REPLICATE_API_KEY` already has it, or I'll detect 404 and surface a friendly "request access" message.
2. **Pricing** — the per-second numbers above are placeholders matching Replicate's published rates × your $0.10/credit margin. Want me to use those, or set custom margins?
3. **Scope cut** — this is ~6–10 hours of work. Want me to do all 4 engines, or start with **Sora 2 + fix Seedance** (the two you specifically called out) and follow up with Veo 3 in a second pass?

Tell me which of (1), (2), (3) and I'll start immediately.
</content>
