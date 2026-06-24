# Admin landing-page mockup spec — READ FULLY

You are building ONE static HTML mockup file for ONE admin menu landing page. The file
shows **3 layout directions** of that same page, stacked vertically. These are visual
templates for the operator to pick a direction — borderless, maximum-space, data-dense,
cinema-noir. Use REPRESENTATIVE realistic data (names, numbers, statuses) — invent
plausible values; this is a design mock, not wired.

## Hard rules
- Output a single self-contained `.html` file. NO inline `<style>` for the skin — link the shared sheet.
- **Borderless.** Never use `border:` or ring outlines on surfaces. Depth comes from the
  `.glass` gradient + shadow + top specular highlight only.
- **Maximum space.** Full-bleed `.page` (no centered max-width). Edge-to-edge grids.
- Single blue accent `hsl(214 90% 62%)`. Cyan/violet/rose/amber only for data viz + status.
- Headings in Fraunces (`.display`/`.title`/`.num`), labels in mono (`.mono`/`.label`),
  body in Inter. Use ONLY the classes defined in `skin.css` (compose them). You may add
  small inline `style="..."` for one-off widths/heights/grid spans, but NOT for re-skinning.
- Icons: inline SVG, 1.8 stroke, `currentColor`, ~15px. Keep them simple (lucide-style).
- Each of the 3 directions must feel genuinely DIFFERENT in layout, not recolored copies.

## Required HTML skeleton (copy exactly, fill the 3 sections)
```html
<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..600;1,9..144,400..600&family=Inter:wght@300;400;500;600&family=Roboto+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../skin.css">
<title>PAGE — mockups</title></head>
<body>
<div class="atmos"><div class="aurora a1"></div><div class="aurora a2"></div><div class="aurora a3"></div></div>

<section id="A" class="page">
  <div class="vlabel"><span class="tag">DIR A</span><b>Command Deck</b><span class="desc">full-bleed KPI rail · one dominant chart · dense action list</span></div>
  <!-- … direction A … -->
</section>

<section id="B" class="page">
  <div class="vlabel"><span class="tag">DIR B</span><b>Control Grid</b><span class="desc">edge-to-edge bento of glass tiles, packed for density</span></div>
  <!-- … direction B … -->
</section>

<section id="C" class="page">
  <div class="vlabel"><span class="tag">DIR C</span><b>Split Console</b><span class="desc">left summary rail + large right data canvas</span></div>
  <!-- … direction C … -->
</section>
</body></html>
```
The `#A`/`#B`/`#C` section ids are REQUIRED (the screenshotter targets them).

## The 3 directions (apply the SAME definition on every page)
**DIR A — Command Deck:** Page header (eyebrow + Fraunces title + sub + a right-aligned
action button). Then a full-width KPI rail of 5–6 `.kpi` tiles (`.grid .g5`/`.g6`). Then
ONE dominant chart card (`.glass` with `.cardhead` + `.area`/`.bars`/`.donut`) spanning most
width, optionally a 1/3 companion card beside it (`grid-template-columns:1.6fr 1fr`). Then a
two-column "action queue + secondary list" row. Generous whitespace, big numbers.

**DIR B — Control Grid:** Compact header. Then a single dense BENTO grid (e.g. `.grid` with
`grid-template-columns:repeat(4,1fr)` and varied `.span2`/`.span3`/row-spanning tiles): mix
KPI tiles, a wide chart tile, a donut tile, 2–3 list/table tiles, a status tile — all
borderless glass, packed edge-to-edge with consistent 16px gaps. Maximal information per
screen. This is the "everything visible at once" option.

**DIR C — Split Console:** Header spans full width. Below, a flex `.row`: a fixed left
`.rail` (340px) holding stacked summary KPIs + a segmented control (`.segwrap`) + a couple
mini stat blocks, and a large right `.canvas` dominated by the page's PRIMARY data surface —
a big borderless `.tbl` data table (or a large chart) using the full remaining width, with a
toolbar (filter chips, search) above it. Operator-workspace feel.

## Per-page content — build with THESE metrics/lists (representative values)
See the PAGE BRIEF passed to you for the specific page. Each page brief lists: the eyebrow +
title, the 5–6 KPIs, the primary chart, and the primary table/list columns + ~6 sample rows.
Honor it. Where a direction needs a second visual, reuse the page's data (e.g. a donut of the
same breakdown, a small ranked list).

## Quality bar
Match the reference overview page feel: airy, premium, confident. Numbers are large and
Fraunces; labels are tiny mono uppercase; surfaces float (no borders); the accent is used
sparingly for emphasis and one or two glows. Make it look like a finished product screenshot.
