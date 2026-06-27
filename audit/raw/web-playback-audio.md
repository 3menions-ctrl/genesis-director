# Web Playback & Audio Audit — Genesis Director

Branch: `full-audit`. Scope: client-side video playback + audio (crossfades, A/V sync). READ-ONLY trace.
Deps: `hls.js@^1.6.15` (only streaming lib). No `wavesurfer`, no `Tone.js`, no `ffmpeg.wasm` on the client.

Two completely separate playback engines exist:

| Surface | Engine | File |
|---|---|---|
| Public / final-video player (landing, share, embed, production, reel) | `BrandedVideoPlayer` (hls.js) | `src/components/intro/BrandedVideoPlayer.tsx` |
| Editor program monitor (multi-clip timeline preview) | `StitchedPlayer` (dual `<video>` + canvas compositor + Web Audio) | `src/pages/Editor/components/StitchedPlayer.tsx` |
| Render-free "watch your edit" player (read-only) | `TimelinePlayer` (A/B `<video>` ping-pong) | `src/components/player/TimelinePlayer.tsx` |
| Library/grid thumbnails | `LazyVideoThumbnail` (canvas frame extract) | `src/components/ui/LazyVideoThumbnail.tsx` |
| Final bake (server) | `seamless-stitcher` FFmpeg (xfade+acrossfade+loudnorm) | `supabase/functions/seamless-stitcher/index.ts` |

This is the central finding: **the editor preview, the render-free preview, and the server bake are THREE different audio/video pipelines** that approximate each other. None of them is the "same path" as final playback.

---

## 1. PREMIUM PLAYER — `BrandedVideoPlayer` — **DONE (with caveats)**

### Call chain / wiring
- Used by: `ExamplesGallery`, `PublicShare:178`, `EmbedPlayer:85`, `Production.tsx:1849`, `ProductionFinalVideo:173`, `Reel:646`, `TrainingVideo:732`, `CreationHub:979`. This is the real "premium player."
- HLS attach: `BrandedVideoPlayer.tsx:261-338`.
  - `isHlsManifest()` (`:132`) detects `.m3u8` / `application/vnd.apple.mpegurl`.
  - Native HLS first: `canPlayHlsNatively()` (`:135` `video.canPlayType(...)`) → Safari/iOS get `video.src = url` directly. **Correct.**
  - Else `Hls.isSupported()` (`:281`) → `new Hls({maxBufferLength:30, maxMaxBufferLength:60, startLevel:-1, enableWorker:true})`, `loadSource`/`attachMedia`. **Correct.**
  - Quality picker driven by `MANIFEST_PARSED` → `hls.levels` (`:291-297`); `setQuality` writes `hls.currentLevel` (`:365-371`). **DONE.**
  - Error recovery: `Hls.Events.ERROR` (`:301`) — only acts on `fatal`. On `NETWORK_ERROR` it tries a naive `.m3u8 → .mp4` URL guess (`:305-313`), else sets error + dispatches `branded-video:error`. **PARTIAL:** does NOT call `hls.startLoad()` / `hls.recoverMediaError()` — the canonical hls.js recovery ladder for `MEDIA_ERROR` is absent; a recoverable media (buffer-append) error is treated as terminal. Network errors that aren't an `.mp4` sibling are also terminal.
  - Cleanup destroys hls + clears `src` + `load()` on unmount (`:324-337`) — good for connection/instance leak.
- Buffering UI: `waiting`/`canplay`/`playing` listeners (`:341-355`) → spinner. **DONE.**

### Where src comes from
- `resolvedSrc` (`:196-210`): if `src` prop given, use it; else fetch `movie_projects.video_url` by `projectId` via Supabase. **No signed-URL generation, no `createSignedUrl`** — it consumes whatever URL is stored (public bucket URL or a `manifest_*.json` URL). No 404/expiry handling at this layer (relies on hls.js error or VideoSourceValidator if caller used it).
- `generate-hls-playlist` edge function exists in `supabase/functions/` but **is NOT invoked anywhere in `src/`** (grep returns zero client call sites). HLS playlists are produced offline/by the pipeline and surfaced as stored URLs. In `ExamplesGallery`, the HLS URL is pulled by `parseManifestForHLS()` (`ExamplesGallery.tsx:26-40`) which `fetch()`es the `manifest_*.json` and reads `data.hlsPlaylistUrl`. If that field is absent it returns `null` and falls back to playing the raw `manifest.json` URL as a video `src` (`ExamplesGallery.tsx:285-299`) — **BROKEN fallback path: a `.json` manifest is not a playable media source**, it will simply error and `onError` auto-advances. So manifests lacking `hlsPlaylistUrl` silently skip.

### Risks
- `isManifestUrl` (`ExamplesGallery.tsx:14`) keys on `url.endsWith('.json') || url.includes('manifest_')` — brittle string sniffing.
- Admin has a SECOND independent hls.js wiring (`AdminProjectsBrowser.tsx:107-112`) — duplicate logic, divergence risk, no error handler there.

**Verdict: DONE for the happy path (adaptive HLS + native Safari + quality + buffering). PARTIAL on error recovery (no media-error recovery ladder) and on the manifest-without-hlsPlaylistUrl fallback.**

---

## 2. EDITOR / PREVIEW PLAYBACK — `StitchedPlayer` + `PlayerCanvas` — **PARTIAL**

### Call chain
`PlayerCanvas.tsx:1143` mounts `<StitchedPlayer ref={stitchedRef} clips={clips} playheadSec=...>`. Transport (play/pause/JKL/seek/PiP/snapshot/fullscreen) is routed through the imperative handle `stitchedRef` (`PlayerCanvas.tsx:629-797`). The store playhead (`setPlayhead`) is the source of truth; `StitchedPlayer` reacts to `playheadSec` and emits `onTimeUpdate`/`onClipEnded` back.

### How it previews the assembled timeline
- `StitchedPlayer` owns **two** `<video>` elements (A/B) always mounted, `opacity:0`, and paints a **canvas compositor** (`StitchedPlayer.tsx:648-771`) reading frames via `drawImage`. One slot "shows"+plays, the other preloads the next clip. Boundary = role flip (no src swap on the playing element). This is a genuine NLE-style ping-pong. **Strong implementation.**
- Boundary detection via rAF (`:332-361`) at 60Hz with an `ended` safety net (`:309-316`); store writes throttled to ~12Hz (`:331`). Good.
- PRIME (1.0s→0.32s) + ROLL (last 320ms) pre-roll the hidden buffer's decoder (`:399-499`) so the swap is seamless. Elaborate and race-guarded.

### Divergence risks (the core problem)
- **Preview ≠ render transitions.** `StitchedPlayer` performs a **fixed 320ms cross-dissolve at EVERY clip boundary** (`CROSSFADE_MS=320`, `:636`; canvas blends both buffers when `remaining < CROSSFADE_MS/1000`, `:730-751`) **regardless of whether the user authored a transition**. The server bake (`seamless-stitcher`) also "always crossfades" but at `DEFAULT_TRANSITION_DURATION` (0.4s, body-overridable, per-boundary kind/duration honored — `seamless-stitcher` `:170-180,232-233`). So preview shows a 0.32s fade on joins where render produces a 0.4s fade or a user-specified `fadeblack`/`dissolve`. **Preview crossfade duration and kind do not match the export.**
- **Dead authored-transition preview path.** `PlayerCanvas` still computes `xfadeInfo` from `project.transitions` (`:400-414`) and runs a B-buffer crossfade effect (`:587-621`) on `videoBRef` — but `videoBRef` is **never attached to any element** (StitchedPlayer owns the buffers; comment at `:313-324`). So the authored-transition visual preview through `videoBRef` is a **no-op**. Only two things survive: (a) the `fadeblack`/`fadewhite` solid-pane overlay (`PlayerCanvas:1203-1219`) and (b) the StitchedPlayer opacity prop is multiplied by `(1 - xfadeInfo.progress)` (`:1150-1154`) — which, layered on StitchedPlayer's own internal 320ms crossfade, can **double-fade** authored crossfades.
- **Legacy dead `videoRef` path.** `PlayerCanvas`'s own `videoRef` + Effect-A timeupdate/seek chain (`:440-572`) is documented dead since StitchedPlayer landed; `videoRef` is never attached. Transport correctly routes through `stitchedRef`, but ~130 lines of dead effect code remain and could mislead future edits (multiple-source-of-truth smell).
- VuMeter (`PlayerCanvas:228-301`) is explicitly **pseudo-real** (sine+random jitter, `:265-273`), not driven by an AnalyserNode. Cosmetic — labeled as such.

**Verdict: PARTIAL. The dual-buffer preview WORKS, but it is a separate engine from final render, it crossfades every boundary at a fixed 320ms unlike the bake, and the authored-transition preview wiring is largely dead/double-applied.**

### Render-free preview — `TimelinePlayer` — **PARTIAL (has a seek/advance bug)**
- Self-contained A/B player (`TimelinePlayer.tsx`), simpler than StitchedPlayer (CSS opacity swap, no canvas, no Web Audio — just `<video>.volume/.muted`).
- **Edge-case bug — seek breaks the A/B parity invariant.** `advance()` picks the "soon-to-be-active" element by index parity: `(i % 2 === 0 ? bRef : aRef)` (`:120`). This only holds because `activeKey` and `index` start aligned and advance together. But `seekToGlobal()` (`:165-182`) changes `index` to an arbitrary target **without flipping `activeKey`**. After a seek to a non-adjacent clip whose parity no longer matches `activeKey`, the next `advance()` rewinds the WRONG buffer and the swap can show a stale/incorrect clip. Real, reproducible by scrubbing across multiple clips then letting it play to a boundary.
- Zero-length clips: `starts` uses `Math.max(0.1, durationSec)` (`:77`) but `onActiveTime` only auto-advances when `clip.durationSec > 0` (`:131`); a 0-duration clip relies solely on `onEnded`. Minor.

---

## 3. AUDIO / CROSSFADES — **PARTIAL (client crossfade exists but clobbers per-clip mix)**

### Is audio mixed client-side?
Yes — a full Web Audio chain per buffer: `useAudioMixChain` (`src/hooks/editor/useAudioMixChain.ts`). Topology (`:41-201`): `source → lowShelf → midPeak → highShelf → compressor → stereoPanner → masterGain → destination`. Mirrors the FFmpeg bake (`src/lib/editor/audio-mix.ts` doc `:1-26`; server compiler `_shared/audio-mix-filters.ts`). `MediaElementAudioSourceNode` cached per-element in a `WeakMap` (`:51`) because it can only be created once — and the code is very careful about NOT re-keying the `<video>` (StitchedPlayer comment `:804-810`). Fallback passthrough on graph-build failure routes `source→gain→destination` so audio isn't silently captured-and-muted (`:186-200`). **Thoughtful.**

### Crossfade boundary logic
- Audio crossfade is driven from the **canvas rAF loop**, not a dedicated audio scheduler: during the last `CROSSFADE_MS=320ms`, `StitchedPlayer.tsx:738-751` computes equal-power `cos/sin` curves and calls `setElementGain(showingEl, cos)` + `setElementGain(hiddenEl, sin)` **every frame**. Outside the window it calls `setElementGain(showingEl, 1)` every frame (`:757`). A separate role-flip effect `rampElementGain(a/b, 1/0, 60ms)` on `isShowingA` change (`:605-619`) also writes `master.gain`.
- **BUG — per-clip volume/mute is clobbered during playback.** `applyMix()` sets `master.gain = volume × makeup` and `0` when muted (`useAudioMixChain.ts:206-237`). But the canvas loop unconditionally writes `setElementGain(showingEl, 1)` every frame while playing (`StitchedPlayer.tsx:757`) and `cos/sin` (0..1) during the fade (`:750-751`). These overwrite the per-clip `mix.volume`, `mix.muted`, and compressor makeup gain. **Net effect: a clip with reduced volume or `muted:true` in its AudioMix will play at unity gain in the editor preview** (until the next `applyMix` fires, which is only on mix-fingerprint change, not per frame). This is a real multiple-writer race over `master.gain` (three writers: `applyMix`, `rampElementGain`, `setElementGain`).
- **Element-level vs node-level gain split.** Master volume/mute from the transport (`PlayerCanvas:809-814`) goes through `handle.setVolume`/`setMuted` which write `el.volume`/`el.muted` (`StitchedPlayer.tsx:569-576`) — i.e. the **HTMLMediaElement** gain, a different control surface than the Web Audio `master.gain`. Two independent gain stages with no single source of truth.
- **First/last clip:** crossfade only triggers when a hidden buffer is loaded AND playing AND `remaining<320ms`. Last clip has no next buffer → no fade-out, hard stop (consistent with bake's tail, acceptable). First clip: prime/decode + an explicit mount-prime play→pause (`:159-197`) that mutes during prime — looks handled.
- **Autoplay-blocked degradation:** if `hidden.play()` is rejected (no gesture), both the visual blend (needs `!hidden.paused`, `:732`) and audio crossfade fail together → graceful hard cut. OK.
- **Overlapping fades:** because the fade always runs in the last 320ms and the next clip starts at currentTime 0, two clips shorter than ~0.7s could chain fades; not specifically guarded, but ROLL only fires once per `nextClipId`.

### Test coverage
`src/test/hooks/useAudioMixChain.test.tsx` has 4 tests (`:57-83`) — all jsdom null-safety/leak checks. **No test exercises actual gain output, the crossfade curves, or the clobber bug.** Audio path is effectively UNVERIFIED by tests.

**Verdict: PARTIAL. A real client-side equal-power crossfade + per-clip EQ/compressor/pan chain exists and is sophisticated, but the canvas loop overwrites per-clip volume/mute every frame, there are three competing gain writers, and there is zero behavioral test coverage.**

---

## 4. A/V SYNC — **DONE (low drift) for single-element; the crossfade is the only multi-element window**

- **No separate audio track element.** Audio always rides the SAME `<video>` element that produces the picture (audio is tapped from that element via `createMediaElementSource`). There is **no offset logic, no `currentTime` syncing across distinct audio vs video elements** — so the classic multi-element A/V drift problem essentially does not exist here. Picture and its own audio cannot drift because they're one decoder.
- The only multi-element window is the 320ms crossfade where buffer A and buffer B both play. Each carries its own in-sync audio; they're independently correct, equal-power summed. No cross-element `currentTime` alignment is attempted or needed.
- StitchedPlayer re-seeks the showing element to the playhead only on `drift > 0.5s` (`:269-279`) / `>0.25s` (`:511-520`) to avoid fighting natural playback. Reasonable.
- `masterAudioUrl` appears in the manifest type (`ExamplesGallery.tsx:23`) but is unused on the client — i.e. there is no client path that plays a separate master audio bed against video (that would be a drift risk); it's baked server-side. Good.

**Verdict: DONE. A/V drift risk is LOW because there is no independent audio element to drift. The render path bakes a single muxed stream.**

---

## 5. CLIP / LIBRARY PLAYBACK & THUMBNAILS — **DONE / PARTIAL**

- Library grid thumbnails: `LazyVideoThumbnail` (`src/components/ui/LazyVideoThumbnail.tsx`). IntersectionObserver-gated, **client-side frame extraction**: creates an offscreen `<video crossOrigin=anonymous preload=metadata>`, seeks to `seekFraction*duration` (`:173`), `drawImage`→`canvas.toDataURL('jpeg',0.72)` (`:176-189`). Concurrency-limited to 6 (`:19`), persisted to IndexedDB + in-memory cache + subscriber fan-out (`:54-126`), 6s timeout, 5-min failure cooldown. **Robust; DONE.**
  - **PARTIAL:** `crossOrigin='anonymous'` is hardcoded (`:155`); on CORS-rejecting CDNs the `onerror` path just `finish(null)` (`:190-196`) — comment admits it "won't be able to read pixels — so we skip extract and fail." So cross-origin clips that don't send CORS headers get NO extracted thumbnail (falls back to poster/placeholder). Silent.
- Server thumbnail/frame functions exist and are the authoritative source: `generate-project-thumbnail`, `extract-video-frame` (edge functions present). The client extractor is a best-effort overlay; the stored `thumbnailUrl`/poster is the poster fallback in every player. SourceMonitor (`PlayerCanvas:90-226`) is an independent isolated single-clip preview (`preload=metadata`, no Web Audio) for dual-monitor mode — separate yet again from StitchedPlayer (minor divergence, cosmetic).
- `VideoSourceValidator` (`src/lib/video/VideoSourceValidator.ts`) provides deterministic pre-mount validation (EMPTY/CORS/404/codec) but is **not** called inside BrandedVideoPlayer's `resolvedSrc` path — it's opt-in per caller, so most player mounts don't validate.

---

## TALLY

| Feature | Status |
|---|---|
| Premium player HLS (adaptive + native Safari + quality + buffering) | **DONE** |
| Premium player error recovery (media-error ladder, manifest fallback) | **PARTIAL/BROKEN** |
| `generate-hls-playlist` client wiring | **MISSING** (fn exists, no call site) |
| Editor dual-buffer preview (StitchedPlayer) | **PARTIAL** (separate engine; dead authored-transition wiring) |
| Render-free preview (TimelinePlayer) | **PARTIAL** (seek/advance parity bug) |
| Client audio mix chain (EQ/comp/pan/Web Audio) | **DONE** (build) / **PARTIAL** (clobbered at runtime) |
| Client audio crossfade at boundaries | **PARTIAL** (works, but overwrites per-clip volume/mute) |
| A/V sync | **DONE** (low risk by design) |
| Library thumbnails | **DONE** (client) + **PARTIAL** (CORS-blocked clips fail silently) |
| Audio behavioral test coverage | **MISSING** |

DONE: 4 · PARTIAL: 5 · BROKEN: 1 (manifest-without-hlsPlaylistUrl fallback) · MISSING: 2

---

## TOP PLAYBACK / AUDIO RISKS (real-vs-handled)

1. **Render ↔ playback timing divergence — REAL, NOT fully handled.** Three distinct pipelines (StitchedPlayer canvas+WebAudio, TimelinePlayer, server FFmpeg). The editor preview crossfades EVERY boundary at a fixed **320ms** (`StitchedPlayer.tsx:636,730`) while the bake uses **0.4s** defaults with per-boundary authored kind/duration (`seamless-stitcher:232-233,170-180`). Authored transitions (`project.transitions`) are previewed through a **dead `videoBRef`** (`PlayerCanvas:587-621`, ref never attached) and double-applied via the opacity prop. What the user sees is NOT what they export. Evidence-rated: **HIGH likelihood, MEDIUM severity** (cosmetic-but-promised "preview = export").

2. **Crossfade clobbers per-clip audio mix — REAL, NOT handled.** Canvas rAF writes `setElementGain(showingEl, 1)` every frame (`StitchedPlayer.tsx:757`), overwriting `mix.volume`/`mix.muted`/makeup-gain set by `applyMix` (`useAudioMixChain.ts:206-237`). Three writers contend over `master.gain` (`applyMix`, `rampElementGain`, `setElementGain`) plus a 4th element-level stage (`el.volume`/`el.muted`). A muted or attenuated clip plays at full volume in preview. **HIGH likelihood, MEDIUM-HIGH severity**, zero test coverage.

3. **A/V sync drift — REAL risk MITIGATED by design.** No independent audio element exists; audio rides the same decoder as picture, so picture/audio cannot drift. The only multi-element window is the 320ms crossfade, where each element is internally synced. **LOW likelihood, LOW severity.** This is the strongest area.

4. **Crossfade boundary edge cases — PARTIALLY handled.** First-clip mount prime, race-guarded PRIME/ROLL, and `nextClipId`-keyed firing are handled. NOT handled: TimelinePlayer's seek→advance parity bug (`TimelinePlayer.tsx:120` vs `:165-182`) shows the wrong buffer after cross-clip scrubbing; sub-0.7s clips can chain overlapping fades unguarded; autoplay-blocked degrades to a hard cut (acceptable). **MEDIUM likelihood, LOW-MEDIUM severity.**

5. **Premium player terminal-error handling — REAL.** hls.js fatal `MEDIA_ERROR` is not recovered (`recoverMediaError()` absent, `BrandedVideoPlayer.tsx:301-319`); only a naive `.m3u8→.mp4` guess for network errors. Manifests lacking `hlsPlaylistUrl` fall back to playing a `.json` URL as media (`ExamplesGallery.tsx:285-299`) → guaranteed error → silent skip. **MEDIUM likelihood, MEDIUM severity.**

### Untested / unverified paths
- All audio gain/crossfade behavior (no behavioral tests; `useAudioMixChain.test.tsx` is null-safety only).
- `generate-hls-playlist` edge fn has no client caller — playlist provenance unverified from the client side.
- CORS-blocked thumbnail extraction silently yields no frame.
- `VideoSourceValidator` exists but is bypassed by the main player mount path.
