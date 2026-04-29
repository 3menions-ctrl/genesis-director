---
name: editorial-shell-primitives
description: Shared in-app shell primitives (PageShell, PageHeader, Surface, SegmentedControl) under src/components/shell. Editorial spacious layout with #0A84FF blue accent.
type: design
---
All in-app pages (non-landing) should use:
- `PageShell` (max-w narrow|default|wide|full, pt-24 sm:pt-28, px-6→10) for the page container
- `PageHeader` { eyebrow, title, subtitle, actions, toolbar } — eyebrow is uppercase 11px Sora tracking 0.22em, title uses .text-display (clamp 32–46, -0.025em), hairline divider after, toolbar slot below
- `Surface` for any glass card (rounded-2xl, border white/[0.06], bg white/[0.025], blur-xl, optional hover lift)
- `SegmentedControl` for tab rows — minimal blue underline, NO filled pills, NO violet/cyan

Index.css now uses Pro-Dark blue tokens (--primary 211 100% 52% = #0A84FF). Removed violet (#7c3aed). Heavy animated page backgrounds (ProjectsBackground, PipelineBackground, ClipsBackground) were dropped from Projects, Production, and Create for editorial spaciousness — do not re-introduce on those pages.

Grid spacing standard for galleries: `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8`.