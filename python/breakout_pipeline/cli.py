"""
cli.py — command-line entry point.

Examples:

  # Render a specific template by slug, pulling its prompt from Supabase:
  python -m breakout_pipeline.cli \\
    --template-slug the-dancers-leap \\
    --model cogvideox-5b \\
    --seed 42

  # Render a fully custom prompt with the TikTok chrome:
  python -m breakout_pipeline.cli \\
    --prompt "Floating phone showing TikTok. A break-dancer leaps out..." \\
    --chrome tiktok --aspect 9:16 --model hunyuan

  # Render with a user-supplied source video as the "inside the UI" clip:
  python -m breakout_pipeline.cli \\
    --template-slug the-hypebeast-step-out \\
    --source-video ./my_clip.mp4
"""
from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path
from typing import Optional

from .breakout_pipeline import render, render_from_template_dict
from .config import MODEL_REGISTRY, RenderRequest


def _setup_logging(level: str) -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s · %(levelname)-7s · %(name)s · %(message)s",
        datefmt="%H:%M:%S",
    )


def _fetch_template_from_supabase(slug: str) -> Optional[dict]:
    """Read a single row from vfx_templates via the public REST endpoint.

    Reads VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY from env (or
    the corresponding non-VITE_ keys). Returns None if not configured —
    the caller falls back to --prompt.
    """
    import json as _json
    import urllib.request as _ureq

    base = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
    key  = os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY")
    if not base or not key:
        return None
    url = f"{base.rstrip('/')}/rest/v1/vfx_templates?slug=eq.{slug}&select=*"
    req = _ureq.Request(url, headers={"apikey": key, "Authorization": f"Bearer {key}"})
    try:
        with _ureq.urlopen(req, timeout=10) as resp:
            data = _json.loads(resp.read())
        return data[0] if data else None
    except Exception as e:
        logging.getLogger(__name__).warning("Supabase fetch failed: %s", e)
        return None


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Breakout pipeline — Crossover renderer")

    # Source of the prompt
    parser.add_argument("--template-slug", help="vfx_templates.slug to pull from Supabase")
    parser.add_argument("--prompt",        help="Raw prompt to use (overrides template fetch)")

    # Composition
    parser.add_argument("--chrome", default="tiktok", help="Chrome kind (tiktok, youtube, crt, ...)")
    parser.add_argument("--aspect", default="9:16", choices=["9:16", "16:9", "1:1"])

    # Model + inference
    parser.add_argument("--model", default="cogvideox-5b", choices=list(MODEL_REGISTRY.keys()))
    parser.add_argument("--seed",  type=int, default=None)
    parser.add_argument("--frames", type=int, default=None)
    parser.add_argument("--steps",  type=int, default=None)
    parser.add_argument("--guidance", type=float, default=None)

    # Optional creator inputs
    parser.add_argument("--subject-image", help="Path to a subject portrait (currently used for prompt enrichment only)")
    parser.add_argument("--source-video",  help="Path to a user clip — replaces the 'inside the UI' content")

    # Output naming
    parser.add_argument("--output-name", default=None, help="Basename for the output video + thumbnail")

    # Logging
    parser.add_argument("--log-level", default="INFO", choices=["DEBUG", "INFO", "WARNING", "ERROR"])

    args = parser.parse_args(argv)
    _setup_logging(args.log_level)

    if not args.template_slug and not args.prompt:
        parser.error("either --template-slug or --prompt is required")

    overrides = {
        "model":             args.model,
        "seed":              args.seed,
        "num_frames":        args.frames,
        "inference_steps":   args.steps,
        "guidance_scale":    args.guidance,
        "subject_image_path": Path(args.subject_image) if args.subject_image else None,
        "source_video_path": Path(args.source_video) if args.source_video else None,
        "aspect":            args.aspect,
    }

    if args.template_slug:
        template = _fetch_template_from_supabase(args.template_slug)
        if template is None:
            logging.getLogger(__name__).warning(
                "Could not fetch template %s — set SUPABASE_URL + SUPABASE_ANON_KEY or use --prompt directly",
                args.template_slug,
            )
            return 2
        if args.prompt:
            template = {**template, "pure_prompt": args.prompt}
        # chrome from CLI overrides template
        template["chrome_kind"] = args.chrome or template.get("chrome_kind", "tiktok")
        result = render_from_template_dict(template, output_name=args.output_name, **overrides)
    else:
        req = RenderRequest(
            prompt=args.prompt,
            template_slug="custom",
            chrome_kind=args.chrome,
            aspect=args.aspect,
            model=args.model,
            seed=args.seed,
            num_frames=args.frames,
            inference_steps=args.steps,
            guidance_scale=args.guidance,
            subject_image_path=Path(args.subject_image) if args.subject_image else None,
            source_video_path=Path(args.source_video) if args.source_video else None,
        )
        result = render(req, output_name=args.output_name or "custom")

    print(f"\n→ {result['video_path']}")
    print(f"   thumbnail: {result['thumbnail_path']}")
    print(f"   timing: {result['timing']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
