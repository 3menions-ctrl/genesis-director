# Edge Function Consolidation Plan

## Current State: ~65 Edge Functions (reduced from 80+)

Recent cleanup removed Cloud Run dependencies and consolidated stitching to manifest-only mode.

## Proposed Consolidated Architecture

### Core Functions (Keep)
| Function | Purpose | Status |
|----------|---------|--------|
| `hollywood-pipeline` | Main orchestrator | ✅ Keep |
| `generate-single-clip` | Video generation | ✅ Keep |
| `generate-script` | Script generation | ✅ Keep |
| `check-video-status` | Poll Kling status | ✅ Keep |
| `stripe-webhook` | Payment handling | ✅ Keep |
| `create-credit-checkout` | Stripe checkout | ✅ Keep |
| `pipeline-watchdog` | Recovery system | ✅ Keep |
| `simple-stitch` | Manifest creation | ✅ Keep |
| `intelligent-stitch` | Bridge clip orchestration | ✅ Keep |

### Recently Removed
| Function | Reason |
|----------|--------|
| `stitch-video` | Replaced by manifest-only mode |
| `finalize-stitch` | No longer needed without Cloud Run |
| `wan2-stitch` | Removed Cloud Run dependency |
| `wan2-bridge-clip` | Covered by `generate-bridge-clip` |
| `analyze-motion-vectors` | Not actively used |
| `health-check-stitcher` | Cloud Run removed |

### Consolidate Into Single Functions
| New Function | Merges |
|--------------|--------|
| `extract-frame` | `extract-first-frame`, `extract-last-frame`, `extract-video-frame` |
| `validate-continuity` | `validate-clothing-hair`, `validate-color-histogram`, `validate-environment`, `validate-temporal-consistency`, `verify-character-identity`, `verify-face-embedding` |
| `analyze-scene` | `analyze-depth-consistency`, `analyze-lip-sync`, `analyze-reference-image`, `analyze-transition-gap` |
| `generate-audio` | `generate-voice`, `generate-voice-openai`, `generate-music`, `generate-sfx`, `regenerate-audio` |
| `generate-assets` | `generate-thumbnail`, `generate-project-thumbnail`, `generate-missing-thumbnails`, `generate-video-thumbnails`, `extract-video-thumbnails` |

### Remove (Unused/Redundant)
| Function | Reason |
|----------|--------|
| `compare-scene-anchors` | Not actively used |
| `extract-style-anchor` | Not actively used |
| `spatial-action-lock` | Not actively used |
| `multi-camera-orchestrator` | Not actively used |
| `comprehensive-clip-validator` | Redundant with continuity-orchestrator |
| `comprehensive-validation-orchestrator` | Redundant |
| `cinematic-auditor` | Not actively used |
| `visual-debugger` | Debug only |

## Implementation Priority

### Phase 1 (Completed)
1. ✅ Removed Cloud Run dependencies
2. ✅ Simplified stitching to manifest-only mode
3. ✅ Removed unused motion-vectors and wan2 functions

### Phase 2 (Week 2)
1. Consolidate frame extraction (3 → 1)
2. Consolidate thumbnail generation (5 → 1)

### Phase 3 (Week 3)
1. Consolidate validation functions (6 → 1)
2. Consolidate analysis functions (4 → 1)

### Phase 4 (Week 4)
1. Consolidate audio generation (5 → 1)
2. Remove unused functions
3. Update all call sites
4. Test end-to-end

## Current External API Dependencies

| Service | Secret | Used For |
|---------|--------|----------|
| Replicate | `REPLICATE_API_KEY` | Kling v2.6 video generation, frame extraction |
| OpenAI | `OPENAI_API_KEY` | Script/story generation, TTS |
| ElevenLabs | `ELEVENLABS_API_KEY` | Premium voice generation |
| Stripe | `STRIPE_SECRET_KEY` | Payment processing |
| Lovable AI | `LOVABLE_API_KEY` | Scene analysis, style/motion transfer |

## Estimated Reduction
- **Before cleanup**: 80+ functions
- **After Phase 1**: ~65 functions
- **Target after Phase 4**: ~25 functions
- **Reduction**: 70%

## Notes
- Each consolidation should maintain backward compatibility via action parameters
- Example: `extract-frame?action=first` vs `extract-frame?action=last`
- All existing URLs should continue working during transition
