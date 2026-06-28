# Breakout Pipeline

Open-source Python renderer for Small Bridges **Crossover** — the
"Digital Frame Breakout" video effect (character / object steps out of a
digital UI into the physical world).

Generates the AI video, composites the digital chrome (TikTok, YouTube,
CRT, oscilloscope, X-ray, thermal, etc.), animates the glass-shatter
transition at the breakout moment, and writes a Safari-safe MP4 +
thumbnail.

## Architecture

```
python/breakout_pipeline/
  ├─ config.py             # CFG + RenderRequest dataclasses, model registry,
  │                        # framing & timing constants.
  ├─ video_generator.py    # Lazy-loaded diffusers wrapper around
  │                        # HunyuanVideoPipeline / CogVideoXPipeline with
  │                        # bnb 4-bit quantisation, CPU offload, VAE tiling.
  ├─ frame_compositor.py   # OpenCV per-frame composition + chrome painters
  │                        # (tiktok, youtube, crt, oscilloscope, thermal,
  │                        # xray, radar, ...) + glass-shatter FX (cracks,
  │                        # particles, chromatic aberration).
  ├─ assembler.py          # H.264 high@4.1 + AAC stereo + +faststart writer.
  │                        # ffmpeg-python preferred, moviepy fallback.
  ├─ breakout_pipeline.py  # End-to-end orchestrator: render() + manifest.
  └─ cli.py                # Command-line interface, can fetch templates from
                           # the live Supabase project.
```

## Install

```bash
cd python
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

Hardware notes:
- Tested on RTX 3090 (24 GB) and RTX 4070 Ti SUPER (16 GB).
- 4-bit bitsandbytes + `enable_model_cpu_offload` + `vae.enable_tiling` brings
  HunyuanVideo down to ~14 GB peak VRAM.
- For sub-12 GB cards, set `ENABLE_SEQUENTIAL_CPU_OFFLOAD = True` in
  `config.py` (about 4× slower).

## Run

### From a Crossover template slug

```bash
export SUPABASE_URL=https://ywcwaumozoejierlfkgj.supabase.co
export SUPABASE_ANON_KEY=...                       # the publishable key

python -m breakout_pipeline.cli \
  --template-slug the-dancers-leap \
  --model cogvideox-5b \
  --seed 42 \
  --output-name dancer-001
```

### From a custom prompt

```bash
python -m breakout_pipeline.cli \
  --prompt "A floating phone shows a TikTok. A break-dancer leaps forward, shattering the glass, lands in a concrete warehouse." \
  --chrome tiktok --aspect 9:16 \
  --model hunyuan
```

### With a user-supplied source video

The user's clip replaces the "video inside the UI" portion. The AI fills
in the breakout transition + the real-world space afterward.

```bash
python -m breakout_pipeline.cli \
  --template-slug the-hypebeast-step-out \
  --source-video ./creator-clip.mp4 \
  --output-name hypebeast-001
```

### From Python

```python
from breakout_pipeline import render, RenderRequest

result = render(RenderRequest(
    prompt="...",
    chrome_kind="tiktok",
    aspect="9:16",
    model="cogvideox-5b",
    seed=42,
))
print(result["video_path"])
```

## Output

Each run writes to `python/runs/<run-id>/`:
- `<name>.mp4`            — final composited clip (H.264 high@4.1, AAC stereo, +faststart)
- `<name>.png`            — frame 0 thumbnail
- `<name>.manifest.json`  — machine-readable run metadata (timings, dims, model, etc.)

## Timing budget (CogVideoX-5b @ 49 frames, 720×480)

| Stage         | RTX 4090 | RTX 3090 |
|---------------|----------|----------|
| Generation    | ~50 s    | ~90 s    |
| Composite     | ~3 s     | ~3 s     |
| Encode        | ~4 s     | ~4 s     |

HunyuanVideo is roughly 2.5× slower but visibly higher quality.

## Adding a new chrome kind

1. Add a painter function to `frame_compositor.CHROME_PAINTERS` keyed by
   slug.
2. Add the same slug to the Supabase migration's `chrome_kind` CHECK
   constraint.
3. (Optional) add a matching CSS preview in `src/components/crossover/ChromePreview.tsx`.

## Integration with the rest of Small Bridges

The renderer is invoked by `seedance-pipeline`'s job worker (the same
worker that handles standard text-to-video) when the project's source
mode is `crossover`. The worker:

1. Reads the project's `template_slug` and any uploaded subject /
   source-video assets.
2. Shells out to `python -m breakout_pipeline.cli` with the right flags.
3. Uploads the resulting MP4 to `final-videos/{project_id}/breakout.mp4`.
4. Updates `movie_projects.video_url` and marks the project completed,
   firing the `notify_render_complete` email.
