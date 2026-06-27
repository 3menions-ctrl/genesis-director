# Business module vs. Consumer app — design-consistency comparison

_Both passes authenticated + theming-frozen (`AUDIT_FREEZE_THEME=1`), desktop
token pass. Consumer = personal account (50 routes). Business = a business
account with a provisioned org (21 routes)._

## Methodology caveat (read this first)

A freshly-minted business account has **no organization**, so every `/business/*`
cockpit page renders an identical "No workspace selected" empty shell (111
elements, 20/21 pages). Measuring that would have been garbage — it'd show the
business module as "perfectly consistent" because it was the *same empty state*
repeated. So I provisioned a real org + owner membership for the test account
(`provision-org.mjs`: one `organizations` row + one `organization_members` row,
service-role). After provisioning, all 21 pages render real content (0 thin
pages). The numbers below are from that valid state.

## Result — the Business "Aurora" module is 3–10× tighter on every axis

| Metric | Consumer app | Business module | Ratio |
|---|---:|---:|---|
| Distinct opaque colors | 93 | **35** | 2.7× |
| Near-duplicate color pairs (<12) | 161 | **14** | 11.5× |
| Distinct font sizes | 69 | **29** | 2.4× |
| Button radii | 8 | 6 | — |
| Font families | 4 (incl. `Sora` leak) | **2 (clean)** | — |
| `h1` distinct sizes | 18 | **4** | 4.5× |
| `h2` distinct sizes | 22 | **4** | 5.5× |
| `h3` distinct sizes | 15 | 7 | 2.1× |
| `Sora` font-leak elements | 18 | **0** | — |

## Reading

This matches the architectural history (see memory: *Business redesign = Aurora*).
The business module is the **newer, token-driven surface built design-first**;
the consumer app **accreted over time** and carries the drift. Concretely:

- **No font leak in business** — only Fraunces + JetBrains Mono render; the `Sora`
  fallback and stray `monospace` are consumer-only problems.
- **Heading scale is far more disciplined** in business (`h1`/`h2` ≈ 4 sizes each
  vs 18/22). It's not perfect — `h3` still hits 7 sizes and there are 29 font
  sizes — but it's in a different league.
- **Color is dramatically cleaner** — 14 near-dup pairs vs 161. The business
  module mostly draws from `--surface-*` / `--brand`; the consumer app hardcodes.

## Takeaway

The fix for the consumer app isn't "invent a design system" — **one already
exists and the business module proves it works.** The work is **migrating the
legacy consumer surfaces onto the same tokens**: kill ad-hoc `text-[..px]`
headings, remove the `Sora` reference, and replace hardcoded hex with the
`--surface-*` / `--brand` / `--muted` tokens. The business module is the
reference implementation to match.

> Business module is not flawless — 14 near-dup pairs, `h3` at 7 sizes, a `4px`
> radius outlier, and 29 font sizes are worth a smaller follow-up cleanup. But
> directionally it's the target state.

_Artifacts: `report-business.md`, `contact-sheet-business.png`, `shots-business/`,
`report-personal-frozen.md`. Reproduce business with: `node make-auth.mjs`
(AUDIT_ACCOUNT_TYPE=business) → `node provision-org.mjs` → capture with
`AUDIT_GROUPS=Business AUDIT_FREEZE_THEME=1`._
