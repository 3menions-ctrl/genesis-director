# 00 — Structure, Topology & Cross-Surface Contracts

> Audit date: 2026-06-26 · Repo: `genesis-director` (3menions-ctrl) · Audited branch: `full-audit` (== `main` @ e9062618) for web/admin/backend; `ios-app` @ d7667976 for iOS.
> Method: read-only static trace. Build/test run locally (see `06-HEALTH.md`). iOS not built (no Xcode toolchain on this host).

## 0.1 The three surfaces — one repo, three builds

All three surfaces are produced from a **single Git repository** and (mostly) a **single React/TypeScript codebase**. They are differentiated by **build entry point**, not by separate projects.

| Surface | Lives in | Framework / build | Entry point | Deploy target |
|---|---|---|---|---|
| **Web app** (consumer + business) | `src/` on `main`/`full-audit` | Vite 5 + React 18 + React-Router (SWC), TS | `index.html` → `src/main.tsx` → `src/App.tsx` (106 `<Route>`s) | Cloudflare Pages on push to `main` (`.github/workflows/deploy-cloudflare.yml`, `wrangler.toml` → `dist/`) |
| **Admin app** | `src/admin/` + `src/refine/` (89 files) | Same Vite, **separate entry** via `ADMIN_BUILD=1 VITE_ADMIN=true` | `admin.html` → `src/admin/main-admin.tsx` → `AdminStandalone.tsx` → `src/refine/*` | Vercel noindex subdomain (`vercel.admin.json`, `outDir: dist-admin`) **and** Electron desktop app (`electron/main.cjs`, "Small Bridges Admin.app") wrapping `dist-admin/` |
| **iOS app** | `ios-app` branch: `ios/` (Xcode/SPM) + `capacitor.config.ts` + same `src/` web bundle + new `src/pages/Feed.tsx`, `src/components/feed/*` | Capacitor 8 (Swift Package Manager, no CocoaPods) wrapping the web build | Xcode `ios/App/App.xcodeproj` → loads the Vite web bundle in a WKWebView | App Store (not built here — Xcode absent) |

**Key fact:** the web and admin apps are tree-shaken siblings of the same source tree (admin is compiled in only when `VITE_ADMIN=true`; otherwise `src/refine/*` and `src/admin/*` are excluded from the public bundle — see `vite.config.ts` `IS_ADMIN_BUILD`). The iOS app is the *same web app* plus a native shell and an extra `/feed` screen, living on a divergent branch (460 files differ vs `full-audit`).

### Build/run commands (package.json `name: "small-bridges"`)
- `npm run dev` — Vite dev server, port 7777
- `npm run build` — public web build → `dist/`
- `npm run build:admin` — `ADMIN_BUILD=1 VITE_ADMIN=true vite build` → `dist-admin/`
- `npm run desktop` / `build:desktop` — Electron admin (`electron .` / `electron-builder --mac dmg`)
- `npm run typecheck` — `tsc --noEmit`; `npm test` — vitest; `npm run e2e` — Playwright
- iOS: `npx cap sync ios` + Xcode (see `IOS_SETUP.md` on `ios-app`)

## 0.2 Shared backend — the common substrate

All three surfaces talk to **one Supabase project** (`src/integrations/supabase/client.ts`, `createClient<Database>(VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY)`, session in `localStorage`).

Backend components:
- **Supabase Postgres** — schema defined by **387 SQL migrations** (`supabase/migrations/`); typed for the frontend by the generated **`src/integrations/supabase/types.ts`** (single source of truth for client types — known to drift, see `04-CROSS.md`).
- **146 Supabase Edge Functions** (Deno) in `supabase/functions/` — the RPC/HTTP API for generation, render orchestration, billing, auth, admin, email, distribution. **61 have `verify_jwt = false`** in `supabase/config.toml` (public/webhook endpoints — auth must be enforced in-code; see `04-CROSS.md` for the privileged-unauth audit).
- **Python `breakout_pipeline`** (`python/breakout_pipeline/`, 26 files) — a VFX/assembly pipeline (ffmpeg available on host). Wiring to the live product is verified in `02-WEB.md` (render section) / `07-RISKS.md`.
- **External services** (env-driven): Replicate (Wan/Kling/Seedance video models), ElevenLabs (music/SFX/voice), OpenAI (script/story/chat), **Polar.sh** (billing — note: DB columns are legacy `stripe_*`-named but hold Polar values), **Stripe Connect** (creator payouts only; Stripe *billing* is kill-switched via `src/lib/stripe-lock.ts`), Resend (email), Sentry + PostHog (observability).

## 0.3 Dependency graph

```
                       ┌─────────────────────────────────────────┐
                       │              Supabase project            │
   iOS (Capacitor)     │  Postgres (387 migr) ── types.ts (client)│
   ┌──────────────┐    │  146 Edge Functions (Deno)               │
   │ WKWebView     │───▶│  Auth (GoTrue)                           │◀── Admin app
   │ = web bundle  │    │  Storage buckets (media/private-media)   │    (dist-admin,
   │ + /feed native│    └───────┬───────────────┬─────────────────┘    Electron/Vercel)
   └──────────────┘            │               │
          ▲                     │               │  service-role
   Web app (dist) ──────────────┘               ▼
   Cloudflare Pages                   External: Replicate, ElevenLabs,
                                       OpenAI, Polar, Stripe Connect,
                                       Resend, Sentry, PostHog
                                                │
                                       python/breakout_pipeline (wiring → see 02-WEB)
```

**Data ownership:** the Supabase Postgres schema is the single owner of all durable state (projects, clips/media, profiles, organizations, credits/ledger, subscriptions, social graph, notifications). Every surface is a *client* of that schema — none owns its own store (the Electron admin even talks to the same remote Supabase; `electron/main.cjs` only serves static files + SPA fallback). This means **schema/RLS/edge-fn contracts are the only real integration boundary** — and the place silent breaks hide (see `04-CROSS.md`).

## 0.4 Per-surface module map (high level)

**Web (`src/`):** `pages/` (123 files, 106 routes incl. `/studio`, `/create`, `/director`, `/editor`, `/production`, `/library`, `/cinema`, `/feed`-adjacent social, `/business/*`, `/c/:id` creator pages, `/live`, `/market`), `components/` (241), `lib/` (123 — incl. `stripe-lock.ts`, theme, observability, credit/video helpers), `hooks/` (55), `contexts/` (7 — auth/org/etc.), `integrations/supabase`, `i18n/`. Deep traces: render → `02-WEB.md`; playback/audio → `02-WEB.md`; AI-gen/library/templates → `02-WEB.md`; auth/credits/editor → `02-WEB.md`.

**Admin (`src/admin/` + `src/refine/`):** entry `AdminStandalone` → `AdminLayout` + `rbac/`; `refine/pages/` (Dashboard, Users, Finance/Financials, Credits, Costs, Pipeline, Production, Moderation, Emails) + `refine/pages/ops/*` (~40 ops pages, governed by `ops/_registry.ts`) + `hubs/` (Growth/Money/People/Production/System). Admin-only edge fns: `admin-analytics`, `admin-user-action`, `admin-delete-auth-user`, `admin-force-logout`, `admin-stuck-jobs-watchdog`, `admin-alert-dispatch`. Deep trace → `03-ADMIN.md`.

**iOS (`ios-app`):** `ios/App/*` (Xcode project, `AppDelegate.swift`, `Info.plist`, `PrivacyInfo.xcprivacy`, SPM `Package.swift`), `capacitor.config.ts`, `IOS_SETUP.md`, plus native-feel web screens `src/pages/Feed.tsx`, `src/components/feed/{FeedVideo,FeedComments,LiveFlow}.tsx`. Deep trace → `01-IOS.md`.

## 0.5 Cross-surface contracts (where things silently break)

1. **`src/integrations/supabase/types.ts`** — the client-side schema contract shared by web+admin+iOS. Drift between it and the 387 migrations = silent runtime breakage / `as never` casts. Quantified in `04-CROSS.md`.
2. **Edge-function HTTP contract** — request/response shapes are untyped across the boundary (Deno fns ↔ TS clients). 61 fns are unauthenticated at the gateway; in-code auth is the only guard. Inventory + privileged-unauth risks in `04-CROSS.md`.
3. **Auth model** — one Supabase GoTrue instance for all surfaces; admin adds a server-enforced `is_admin()` + RLS layer (claimed in `electron/main.cjs`; verified in `03-ADMIN.md`). Consistency assessed in `04-CROSS.md`.
4. **Storage buckets** — `media` (public) vs `private-media`; gated content in public buckets = leaky-paywall risk (per project memory, currently unused). Assessed in `02-WEB.md` (library) + `07-RISKS.md`.
5. **Billing columns** — `stripe_*` column names holding Polar values is a naming-contract trap for anyone reading the schema cold. Flagged in `04-CROSS.md`.
6. **Push/webhook event formats** — `send-push-notification`, `polar-webhook`, `replicate-webhook`, `webhook-dispatch`, `api-v1`/`api-keys-manage` public API. Versioning assessed in `04-CROSS.md`.

> Routes, edge-fn list, and module counts above are established facts from this audit. The DONE/PARTIAL/BROKEN/MISSING judgments for each subsystem live in `01-IOS.md`, `02-WEB.md`, `03-ADMIN.md`, and are rolled up in `STATUS.md`.
