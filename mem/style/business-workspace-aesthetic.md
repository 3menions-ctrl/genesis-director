---
name: business-workspace-aesthetic
description: Locked Operations Command Center design language for /workspace/* — distinct from personal Pro-Dark canonical
type: design
---
# Business Workspace — Operations Command Center

The /workspace/* routes (business tier admin) intentionally **break** from the
canonical personal Pro-Dark + #0A84FF blue shell. Goal: feel like an
operations console, not a creator studio.

## Tokens (inline as arbitrary values — do NOT add to global CSS)
- Ground:   hsl(35, 10%, 4%) warm graphite
- Surface:  hsl(35, 12%, 5%) / hsl(35, 12%, 7%)
- Border:   hsl(35, 12%, 12%) / hsl(35, 12%, 16%)
- Text:     hsl(35, 12%, 92%) / 72% / 55% / 40%
- Accent:   hsl(28, 90%, 60%) amber/copper (replaces #0A84FF)
- Nominal:  hsl(140, 70%, 50%)

## Rules (inviolable)
- Square edges only (rounded-sm max); never rounded-xl/2xl.
- All meta labels in JetBrains Mono, uppercase, tracking 0.20em–0.32em.
- Display headings: Fraunces light, end with amber period accent.
- No glow shadows. Active nav rail = 2px left amber border.
- Top utility bar: back-to-Studio link + "Workspace · OPS" + plan chip + role chip.
- Masthead: "ORG · {id8}" + "All systems nominal" pulse.
- Telemetry vocabulary: Modules, Telemetry, Audit, Roster.

## Scope
- src/components/workspace/WorkspaceLayout.tsx (master shell)
- All pages under src/pages/workspace/* inside WorkspaceLayout

## Never mix
- Personal routes = Pro-Dark + blue (canonical, locked).
- Business /workspace/* = Command Center + amber (locked).
