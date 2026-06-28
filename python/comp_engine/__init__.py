"""
comp_engine — a headless, node-based, AOV-driven compositor ("our Nuke").

Scene-linear float32 pipeline. Pure-numpy ops; OpenImageIO/OpenColorIO used when
present for EXR/AOV IO + colour. The graph core is deterministic and tested.

    from comp_engine import evaluate, make_demo
    from comp_engine.io_nodes import write_image
    write_image(evaluate(make_demo()), "out.png")
"""
from .graph import Node, evaluate, topo_order  # noqa: F401
from .image import Image  # noqa: F401
from .nodes import (  # noqa: F401
    Blur, Clamp, Constant, Defocus, Glow, Grade, Grain, LensDistort, LightWrap,
    Merge, MotionBlur, Premult, Ramp, Shuffle, Transform, Unpremult,
)
from .recipes import Source, breakthrough_comp, make_demo  # noqa: F401

__all__ = [
    "Node", "evaluate", "topo_order", "Image", "Source",
    "Constant", "Ramp", "Merge", "Grade", "Premult", "Unpremult", "Clamp",
    "Shuffle", "Blur", "Transform", "Defocus", "MotionBlur", "LightWrap",
    "Glow", "Grain", "LensDistort", "breakthrough_comp", "make_demo",
]
