# brand-video-download

Edge function that prepends the **Small Bridges** intro to any video a
user downloads from the platform.

## Setup (one-time)

1. **Push the buckets migration** so `brand-assets` and
   `branded-downloads` exist:

   ```bash
   npx supabase db push
   ```

2. **Record `intro.mp4`** — a 7.5-second 1920×1080 MP4 of the
   StudioIntro at /enter or any direct route that mounts it. Easiest
   path: open the app, screen-record the intro at 60fps, transcode to
   `H.264 / yuv420p / 30fps / 1080p`:

   ```bash
   ffmpeg -i recording.mov \
     -c:v libx264 -preset slow -crf 18 \
     -pix_fmt yuv420p -r 30 -an \
     intro.mp4
   ```

   (The `-an` strips audio — the intro is silent. If you add scored
   audio, drop that flag and match your project's audio config.)

3. **Upload `intro.mp4`** to the `brand-assets` bucket at path
   `intro/intro.mp4`:

   ```bash
   npx supabase storage cp ./intro.mp4 sb://brand-assets/intro/intro.mp4
   ```

4. **Deploy the function:**

   ```bash
   npx supabase functions deploy brand-video-download --no-verify-jwt
   ```

## Behaviour

- `POST /functions/v1/brand-video-download`
- Body: `{ videoUrl, projectId?, userId? }`
- Returns: `{ ok: true, url: <signed download url>, branded: true }` on
  success.
- If `intro.mp4` is missing or muxing fails, the function returns the
  original `videoUrl` so the user always gets *something* — the client
  hook (`useBrandedDownload`) handles both paths transparently.

## The muxer

The default implementation uses a naive byte-level concat — works only
when both MP4s share H.264/yuv420p/30fps/AAC. For a production-grade
path, swap `runMux()` for a `fetch()` to a worker running real ffmpeg
(Replicate, Modal, a Cloudflare Worker with ffmpeg.wasm, etc).

## Wiring into the UI

```ts
import { useBrandedDownload } from "@/hooks/useBrandedDownload";

const { downloadBranded, downloading } = useBrandedDownload();

<button onClick={() => downloadBranded({ videoUrl, projectId, title })}>
  Download
</button>
```

The hook handles the spinner, the toast, the signed-URL handoff, and
the browser download trigger. If the function is unavailable, the hook
falls back to the un-branded source automatically.
