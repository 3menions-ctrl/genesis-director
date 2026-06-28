"""
CLI for the compositor.

    # render the synthetic demo (no assets needed):
    cd python && .venv_comp/bin/python -m comp_engine.cli --demo --out demo.png

    # comp real plates (beauty carries Z/motion AOVs in EXR; PNG = RGBA only):
    ... --beauty beauty.exr --subject subject.png --out comp.png
"""
from __future__ import annotations

import argparse

from .graph import evaluate
from .io_nodes import Read, write_image
from .recipes import breakthrough_comp, make_demo


def main() -> None:
    ap = argparse.ArgumentParser(description="Breakthrough compositor (our Nuke)")
    ap.add_argument("--demo", action="store_true")
    ap.add_argument("--beauty")
    ap.add_argument("--subject")
    ap.add_argument("--out", required=True)
    ap.add_argument("--width", type=int, default=640)
    ap.add_argument("--height", type=int, default=800)
    a = ap.parse_args()

    if a.demo:
        node = make_demo(a.width, a.height)
    else:
        if not (a.beauty and a.subject):
            ap.error("need --beauty and --subject (or --demo)")
        node = breakthrough_comp(Read(a.beauty, is_srgb=False), Read(a.subject))

    write_image(evaluate(node), a.out)
    print(f"wrote {a.out}")


if __name__ == "__main__":
    main()
