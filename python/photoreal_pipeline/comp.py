"""
comp.py — the photoreal pipeline's COMP stage, backed by our own compositor
(`comp_engine`). This is what the `programmatic` comp tool runs.

Reads the rendered beauty (+ AOVs) and the matted subject, runs the breakthrough
comp graph, writes the finished frame(s). Needs numpy (comp_engine); EXR/AOV IO
uses OpenImageIO when present, else 8-bit via imageio.

    python3 -m photoreal_pipeline.comp --beauty beauty.exr --subject subj.png --out comp.exr
"""
from __future__ import annotations

import argparse

# comp_engine is a sibling top-level package under python/
from comp_engine import Image, Source, breakthrough_comp, evaluate
from comp_engine.io_nodes import Read, write_image


def run_comp(beauty: Image, subject: Image, **params) -> Image:
    """Composite a matted subject over a rendered beauty (with Z/motion AOVs)."""
    return evaluate(breakthrough_comp(Source(beauty), Source(subject), **params))


def _read(path: str, is_srgb: bool) -> Image:
    return evaluate(Read(path, is_srgb=is_srgb))


def main() -> None:
    ap = argparse.ArgumentParser(description="Breakthrough COMP stage (comp_engine)")
    ap.add_argument("--beauty", required=True)
    ap.add_argument("--subject", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    # beauty is a linear render; subject (matte) typically sRGB 8-bit
    beauty = _read(a.beauty, is_srgb=False)
    subject = _read(a.subject, is_srgb=True)
    write_image(run_comp(beauty, subject), a.out)
    print(f"comp → {a.out}")


if __name__ == "__main__":
    main()
