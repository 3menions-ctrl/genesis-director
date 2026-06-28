# Multi-Agent Coordination

Three agents are working this repo in parallel. This file is the **shared source of
truth** for who-owns-what and how we integrate without clobbering each other.
Read it before you start; update it when you claim/finish a lane.

## Why this exists
Concurrent agents on one repo destroy each other's work. Observed already this
session: a sub-agent ran `git reset --hard` on a shared tree and transiently wiped
others' edits, and `breakthrough-fx` hit merge conflicts from divergence. The rules
below prevent that.

## Hard rules
1. **One lane per agent. No overlap.** Edit only files in your lane (table below).
2. **Own branch + own git worktree.** Never share a branch. Never edit another
   agent's worktree directory.
3. **Integrate via PR into `main`, one at a time.** Rebase on `origin/main` before
   opening; resolve conflicts in YOUR PR.
4. **NEVER `git reset --hard` or `git push --force` on `main` or a shared branch.**
5. **Verify before merge:** `npm run build` green + relevant tests + (for UI) the
   `design-law` lint guardrail (eslint.config.js).
6. **Shared files** (base UI primitives `src/components/ui/*`, `src/index.css`,
   `types.ts`, `eslint.config.js`, edge-fn `_shared/*`): do NOT edit unless it's your
   lane — ping in this file first to avoid two agents touching the same primitive.

## Lanes (claim yours — edit this table)
| Lane | Owner | Branch / worktree | Status |
|---|---|---|---|
| **Core pipeline reliability** — create→render→watch loop: edge fns (generate-*, mode-router, seamless-stitcher), retry/failure handling, render success rate, observability, drift cleanup. | Claude (pipeline) | `agent/pipeline-reliability` @ `genesis-pipeline-reliability/` | **active** |
| Output / VFX generation — model choice, prompting, character/identity consistency, audio sync, new VFX capabilities. | Agent 2 (assumed: `feat/creative-vfx-gen`) | `feat/creative-vfx-gen` @ `genesis-director/` | confirm |
| Lobby / immersive feed (UI) — feed, lobby surfaces, social UI. | Agent 3 (assumed: `feat/lobby-immersive-feed`) | `feat/lobby-immersive-feed` @ `genesis-full-audit/` | confirm |

## Overlap watch
- **Pipeline ↔ VFX** both touch generation edge functions. Split: *VFX agent* owns
  generation CAPABILITY (what/how we generate); *pipeline agent* owns RELIABILITY
  (does it succeed, retries, error surfacing, observability). If a file is genuinely
  shared, coordinate here before editing.
- **VFX/pipeline ↔ Lobby** mostly disjoint (backend vs UI).

## References
- `reports/design-law-audit/AUDIT.md` — the design-law inventory + remediation plan.
- Design guardrail: `design-law/*` rules in `eslint.config.js` (warn; escalate to error when clean).
