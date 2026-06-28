"""
orchestrator.py — execute a ShotGraph in dependency order.

`plan()` builds the concrete tool invocations (runnable anywhere — this is what
CI exercises). `execute()` actually runs them on a worker that has the tools;
`dry_run=True` prints the plan + per-stage availability without running anything.
"""
from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass
from typing import List

from .shot_graph import ShotGraph
from .stages import Invocation, build_invocation


@dataclass
class PlanReport:
    shot_id: str
    invocations: List[Invocation]

    def missing_tools(self) -> List[str]:
        miss = []
        for inv in self.invocations:
            inv.check()
            if not inv.available:
                miss.extend([r for r in inv.requires])
        # unique, order-preserving
        seen, out = set(), []
        for m in miss:
            if m not in seen:
                seen.add(m); out.append(m)
        return out

    def render(self) -> str:
        lines = [f"▸ shot {self.shot_id} — {len(self.invocations)} stages"]
        for i, inv in enumerate(self.invocations, 1):
            inv.check()
            mark = "✓" if inv.available else "·"
            lines.append(f"  {i:>2}. [{mark}] {inv.stage_id.split(':')[-1]:<12} "
                         f"{inv.note}")
            lines.append(f"        $ {' '.join(inv.command)}")
        miss = self.missing_tools()
        lines.append("")
        lines.append(f"  tools present: {'all' if not miss else 'partial'}"
                     + (f" — missing: {', '.join(miss)}" if miss else ""))
        return "\n".join(lines)


def plan(graph: ShotGraph, out_dir: str = "runs/shot") -> PlanReport:
    invs = [build_invocation(s, out_dir) for s in graph.topo_order()]
    return PlanReport(graph.shot_id, invs)


def execute(graph: ShotGraph, out_dir: str = "runs/shot", dry_run: bool = True) -> dict:
    report = plan(graph, out_dir)
    if dry_run:
        print(report.render())
        return {"shot_id": graph.shot_id, "dry_run": True,
                "stages": [inv.stage_id for inv in report.invocations],
                "missing_tools": report.missing_tools()}

    results = {}
    for inv in report.invocations:
        if not inv.check():
            raise RuntimeError(
                f"stage {inv.stage_id}: missing {inv.requires} — run on a worker "
                f"with the tool installed, or pick the OPEN tier.")
        if inv.runner == "subprocess":
            subprocess.run(inv.command, check=True)
        else:
            # python entrypoints are invoked the same way (python -m ...)
            subprocess.run(inv.command, check=True)
        results[inv.stage_id] = "ok"
    return {"shot_id": graph.shot_id, "dry_run": False, "results": results}


def plan_json(graph: ShotGraph) -> str:
    return json.dumps(graph.to_dict(), indent=2)
