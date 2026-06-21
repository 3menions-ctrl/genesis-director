# 🎬 GOLDEN PROMPT STYLE GUIDE — v1.0 (Locked 2026-02-22)

## STATUS: CANONICAL — DO NOT DEVIATE

This document captures the **exact prompting architecture** that produces world-class
results with Kling V3. All pipelines (Avatar, Text-to-Video, Image-to-Video) MUST
follow these patterns. Any changes require explicit approval.

---

## 1. PROMPT ANATOMY (The Sacred Structure)

Every clip prompt follows this exact ordering:

```
[ENVIRONMENT LOCK] [SCENE CONTEXT] [SHOT SIZE] [CAMERA ANGLE] [CAMERA MOVEMENT] [LIGHTING] [NARRATIVE BEAT] [MOTION/ACTION BLOCK] [DIALOGUE] [PERFORMANCE STYLE] [LIFELIKE DIRECTIVE] [QUALITY BASELINE]
```

### 1.1 Environment Lock (Clips 2+)
```
[SAME ENVIRONMENT: Continue in the exact same location with consistent lighting and props.]
```

### 1.2 Scene Context
```
Cinematic scene set in {sceneDescription}, shot on ARRI Alexa with anamorphic lenses.
```
- Always reference ARRI Alexa + anamorphic — this primes Kling for cinema-grade output
- Scene description comes from screenplay or user input, never generic

### 1.3 Camera Work (Layered)
Three independent camera dimensions combined:
- **Shot Size**: extreme_wide → medium → close_up → extreme_close_up
- **Camera Angle**: eye_level → low_angle → dutch → over_shoulder → profile
- **Camera Movement**: dolly_in → tracking → orbit → steadicam → static

Each uses a progression system indexed by clip position for variety.

### 1.4 Lighting
Selects from a library of 9 styles (classic_key, chiaroscuro, rembrandt, golden_hour,
blue_hour, overcast_soft, neon_accent, rim_dramatic, volumetric).

### 1.5 Narrative Beat (Position-Aware)
```
Clip 0: "OPENING ENERGY: This is the hook — confident, attention-grabbing delivery."
Middle: "BUILDING MOMENTUM: The story is developing — natural escalation of energy."
Final:  "CLOSING MOMENT: This is the payoff — land the final beat with impact."
```

### 1.6 Motion/Action Block
Built from screenplay data with rich natural language:
```
The subject is {action}, {movement}.{physicalDetail}.
```
Movement map converts single words to full cinematic descriptions:
- 'walk' → "walking naturally through the scene with confident strides, arms swinging gently"
- 'gesture' → "using expressive hand gestures and animated body language, hands painting the air"
- 'laugh' → "breaking into genuine laughter, head tilting back, shoulders shaking, eyes crinkling"

**CRITICAL**: Never use bare verbs. Always expand to sensory-rich descriptions.

### 1.7 Dialogue (The Backbone)
```
Speaking naturally with authentic delivery: "{full verbatim dialogue}"
```
- NEVER truncate dialogue — Kling uses it for lip-sync audio generation
- Always wrap in quotes
- Always prefix with "Speaking naturally with authentic delivery"

### 1.8 Performance Style (Emotion-Driven)
Maps emotional tone to full-body performance descriptions:
```
excited  → "Eyes BLAZING with enthusiasm, animated hand gestures cutting through the air..."
dramatic → "Intense locked-in gaze, deliberate measured gestures..."
warm     → "Genuine warm smile reaching the eyes (Duchenne smile)..."
confident→ "Rock-solid eye contact with the lens, open commanding posture..."
```

### 1.9 Lifelike Directive (ALWAYS INCLUDED)
```
Continuous lifelike motion: breathing visible in chest/shoulders, natural eye
movements tracking between focal points, involuntary micro-expressions (slight
brow raises, lip movements between words), authentic weight shifts,
hair/clothing responding to movement with physics-accurate motion.
```

### 1.10 Quality Baseline (ALWAYS INCLUDED)
```
Ultra-high definition 4K cinematic quality. Natural skin tones with subsurface
scattering. Rich vibrant colors with cinematic color grading. Shallow depth of
field with natural bokeh. Volumetric warm lighting with soft fill.
Film-quality motion blur on movement.
```

---

## 2. ANTI-PATTERNS (What Kills Quality)

| ❌ DO NOT | ✅ DO INSTEAD |
|-----------|---------------|
| "person talking" | Full motion block with body language |
| Bare camera terms like "close-up" | Rich descriptions: "Intimate close-up isolating facial micro-expressions, shallow depth of field blurring background into bokeh" |
| Generic "professional setting" | Specific scene: "modern executive office with floor-to-ceiling windows and city skyline view" |
| Truncated dialogue | Full verbatim script text |
| Skip emotion | Map emotion to full performance style |
| Static poses | Always include lifelike directive |
| Missing quality block | Always append quality baseline |

---

## 3. NEGATIVE PROMPT (Kling V3)

```
blurry, distorted, glitchy, unnatural movements, closed mouth, frozen face,
robotic, stiff, static, face morphing, identity change, different person,
age change
```

---

## 4. KLING V3 PARAMETERS (Locked)

| Parameter | Value | Reason |
|-----------|-------|--------|
| mode | "pro" | Highest quality |
| generate_audio | true (avatar) / false (t2v/i2v) | Native lip-sync for avatars |
| safety_tolerance | 2 | Max with images, prevents E006 |
| aspect_ratio | From user selection | 16:9, 9:16, 1:1 |
| duration | 3-15s | Calculated from script length |

---

## 5. CONTINUITY FIELDS (Cross-Clip)

Every clip prediction stores and propagates:
- `action` — what the character is doing
- `movement` — how they're moving
- `emotion` — performance energy
- `cameraHint` — camera direction
- `physicalDetail` — micro-actions and details
- `sceneNote` — scene-specific context
- `transitionNote` — narrative bridge from previous clip
- `startPose` — starting position for continuity
- `endPose` — ending position for next clip
- `visualContinuity` — visual consistency notes
- `segmentText` — full verbatim dialogue

---

## 6. APPLYING TO OTHER PIPELINES

### Text-to-Video
- Use same prompt anatomy but without dialogue/lip-sync
- Replace `Speaking naturally...` with rich action descriptions
- Keep all camera, lighting, motion, quality blocks identical

### Image-to-Video
- Same structure, but prepend: `[IMAGE ANCHOR: The reference image IS the visual truth]`
- First clip uses subtle "unfreezing" motion
- Subsequent clips maintain visual identity from reference

### Learning/Educational
- Use `education` scene journey
- Default to `medium` and `medium_close` shot sizes
- Prefer `classic_key` and `overcast_soft` lighting
- Performance style defaults to `confident` or `warm`

---

*This guide was frozen on 2026-02-22. The prompting architecture described here
produced consistently excellent results and should be treated as the gold standard.*
