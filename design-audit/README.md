# Design Audit

Read-only design-consistency tooling for the Genesis Director web app. It
screenshots every route at desktop + mobile, assembles a contact sheet, and
extracts design tokens (colors, type, spacing, buttons) to flag drift
**quantitatively**. It never modifies app source.

## Run

The Vite dev server must be running (`bun dev`, port **7777**). Then:

```bash
cd design-audit
node audit.mjs          # capture + report in one shot
```

Outputs (this folder):

- `contact-sheet.png` / `contact-sheet.html` — every page thumbnail in a labeled grid
- `report.md` — flagged inconsistencies + token frequency tables
- `shots/<route>__<viewport>.{fold,full}.png` — above-the-fold + full-page per route
- `capture.json` — raw per-route token data (machine-readable)

Run steps individually if you prefer: `node capture.mjs` then `node report.mjs`.

## Configure

Everything editable lives at the top of **`config.mjs`**: `BASE_URL`, `VIEWPORTS`,
the `ROUTES` list, and stub values for param routes. The route list was derived
from `src/App.tsx` (React Router) + `src/components/business/businessNav.ts`.

Override the base URL without editing: `AUDIT_BASE_URL=http://localhost:8080 node audit.mjs`.

## Authenticated capture (important)

By default the audit runs **unauthenticated**, so all protected / business /
admin routes redirect to `/auth` and their screenshots show the sign-in page.
The report flags every redirected route. To audit the real gated surfaces:

1. Sign in once and save the session:
   ```bash
   bunx playwright codegen http://localhost:7777   # log in, then close
   # use the "save storage state" option, or run a small script to context.storageState({path})
   ```
2. Re-run with the session:
   ```bash
   AUDIT_STORAGE_STATE=./auth.json node audit.mjs
   ```

To audit a business or admin account specifically, log in as that account type
when generating the storage state.

## What the report flags

- **Near-duplicate colors** — RGB distance < 12 (e.g. `#1a1a1a` vs `#1b1b1b`)
- **Button radius inconsistency** — distinct `border-radius` tokens in use
- **Font sizes off a clean scale** — fractional / odd px sizes
- **Spacing off the 4px grid**
- **Heading scale** — multiple computed sizes mapped to the same `h1`–`h6` tag
- **Per-page deviation** — pages whose dominant font differs from the global one
