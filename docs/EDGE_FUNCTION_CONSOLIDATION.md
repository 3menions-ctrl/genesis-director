# Edge Function Consolidation Plan

## Current State: 80+ Edge Functions

Many functions have overlapping responsibilities. This document outlines a consolidation plan.

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

### Consolidate Into Single Functions
| New Function | Merges |
|--------------|--------|
| `extract-frame` | `extract-first-frame`, `extract-last-frame`, `extract-video-frame` |
| `validate-continuity` | `validate-clothing-hair`, `validate-color-histogram`, `validate-environment`, `validate-temporal-consistency`, `verify-character-identity`, `verify-face-embedding` |
| `analyze-scene` | `analyze-depth-consistency`, `analyze-lip-sync`, `analyze-motion-vectors`, `analyze-reference-image`, `analyze-transition-gap` |
| `generate-audio` | `generate-voice`, `generate-voice-openai`, `generate-music`, `generate-sfx`, `regenerate-audio` |
| `generate-assets` | `generate-thumbnail`, `generate-project-thumbnail`, `generate-missing-thumbnails`, `generate-video-thumbnails`, `extract-video-thumbnails` |
| `stitch-video` | `stitch-video`, `simple-stitch`, `intelligent-stitch`, `wan2-stitch`, `finalize-stitch` |

### Remove (Unused/Redundant)
| Function | Reason |
|----------|--------|
| `generate-bridge-clip` | Covered by `generate-single-clip` |
| `wan2-bridge-clip` | Covered by `generate-single-clip` |
| `compare-scene-anchors` | Not actively used |
| `extract-style-anchor` | Not actively used |
| `spatial-action-lock` | Not actively used |
| `multi-camera-orchestrator` | Not actively used |
| `comprehensive-clip-validator` | Redundant with continuity-orchestrator |
| `comprehensive-validation-orchestrator` | Redundant |
| `cinematic-auditor` | Not actively used |
| `visual-debugger` | Debug only |

## Implementation Priority

### Phase 1 (Week 1)
1. Consolidate frame extraction (3 → 1)
2. Consolidate thumbnail generation (5 → 1)

### Phase 2 (Week 2)
1. Consolidate validation functions (6 → 1)
2. Consolidate analysis functions (5 → 1)

### Phase 3 (Week 3)
1. Consolidate audio generation (5 → 1)
2. Consolidate stitching (5 → 1)

### Phase 4 (Week 4)
1. Remove unused functions
2. Update all call sites
3. Test end-to-end

## Estimated Reduction
- **Before**: 80+ functions
- **After**: ~25 functions
- **Reduction**: 70%

## Notes
- Each consolidation should maintain backward compatibility via action parameters
- Example: `extract-frame?action=first` vs `extract-frame?action=last`
- All existing URLs should continue working during transition
