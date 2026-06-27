"""
graph.py — the node graph + evaluator.

Pull-based (demand-driven) evaluation like Nuke: you evaluate the output node
and it pulls its inputs. Results are memoised within one evaluate() pass, so a
node feeding several downstream nodes computes once. Cycles are detected and
raise. Nodes are pure functions of (inputs, params) → Image, which makes the
whole graph deterministic and trivially testable.
"""
from __future__ import annotations

from typing import Dict, List, Optional

from .image import Image


class Node:
    """Base class. Subclasses implement `compute(inputs) -> Image`."""

    def __init__(self, *inputs: "Node", name: Optional[str] = None, **params):
        self.inputs: List["Node"] = [i for i in inputs if i is not None]
        self.params = params
        self.name = name or type(self).__name__

    def compute(self, inputs: List[Image]) -> Image:  # pragma: no cover - abstract
        raise NotImplementedError

    def __repr__(self) -> str:
        return f"<{self.name} inputs={len(self.inputs)}>"


def evaluate(
    node: Node,
    cache: Optional[Dict[int, Image]] = None,
    _stack: Optional[set] = None,
) -> Image:
    """Evaluate `node`, memoising shared sub-results. Raises on a cycle."""
    cache = {} if cache is None else cache
    stack = set() if _stack is None else _stack
    key = id(node)
    if key in cache:
        return cache[key]
    if key in stack:
        raise ValueError(f"cycle in comp graph at {node!r}")
    stack.add(key)
    ins = [evaluate(i, cache, stack) for i in node.inputs]
    out = node.compute(ins)
    stack.discard(key)
    cache[key] = out
    return out


def topo_order(node: Node) -> List[Node]:
    """Post-order DAG flatten (inputs before the node). Raises on a cycle."""
    out: List[Node] = []
    seen: set = set()
    stack: set = set()

    def visit(n: Node) -> None:
        k = id(n)
        if k in seen:
            return
        if k in stack:
            raise ValueError(f"cycle in comp graph at {n!r}")
        stack.add(k)
        for i in n.inputs:
            visit(i)
        stack.discard(k)
        seen.add(k)
        out.append(n)

    visit(node)
    return out
