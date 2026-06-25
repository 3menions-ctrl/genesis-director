# Landing & Marketing Surface — Audit & Polish Report

**Branch:** `landing-polish` (not merged to `main` — for integration by maintainer)
**Scope:** Landing page, marketing routes, public help/legal pages, SEO/config assets.
**Out of scope (untouched):** editor, studio, business modules, admin, auth/app internals, edge functions, payment integration code.
**Date:** 2026-06-24

Verification for every change: typecheck (`tsc --noEmit`) ✅, full test suite (3550 passed / 0 failed with env provided) ✅, production build ✅, plus per-edit grep verification.

> ⚠️ **Legal text was NOT modified live.** The Terms/Privacy pages are already
> professionally drafted; proposed improvements are DRAFT recommendations in the
> "Legal — needs lawyer review" section below. Nothing in that section has been
> shipped.

---

## 1. Summary of changes made (shipped on `landing-polish`)

| # | File | Category | Change |
|---|------|----------|--------|
| 1 | `public/robots.txt` | SEO / brand | Header + **`Sitemap:` URL** pointed at wrong brand/domain (`Apex Studio` / `apex-studio.ai`). Fixed to Small Bridges / `smallbridges.co`. |
| 2 | `public/llms.txt` | SEO / brand / claims | Entire file was stale **Apex Studio** content with **fabricated, contradictory pricing** ($1=10 credits, 60 free credits, plans that don't exist), a **fake API endpoint** (`api.apex-studio.ai`), and invented competitor/conversion stats. Rewrote from verified current facts (brand, Polar-free, real plans, conservative claims). |
| 3 | `index.html` | SEO / messaging | Default meta description was stale "AI presenters / virtual production" positioning (173 chars). Rewrote to current cinematic positioning (~150 chars). Removed competitor-name keyword stuffing (`HeyGen, ElevenLabs, Runway`). Added `legalName` + `contactPoint` to Organization JSON-LD. |
| 4 | `src/pages/Landing.tsx` | Messaging | Home meta description claim **"Hollywood-quality"** (unsubstantiated) → concrete, substantiated description; also lengthened toward SEO-ideal range. |
| 5 | `src/pages/Pricing.tsx` | Messaging / consistency | (a) Meta said **"No subscriptions"** but the page has a Subscription segment — fixed contradiction + improved title. (b) Engine name `Seedance Pro` → `Seedance 2.0` (matches footer + How-It-Works). (c) `Zero-waste guarantee` (vague) → `Failed renders refunded` (concrete). (d) **Payment provider: `Secure via Stripe` → `Secure checkout via Polar`** and FAQ "processed by Stripe" → **Polar** (billing is Polar; Stripe is creator-payouts only). |
| 6 | `src/pages/HowItWorks.tsx` | Messaging | "the same visual language used in **Hollywood** productions" → "the visual grammar of real film" (less overpromising). |
| 7 | `src/pages/HelpDoc.tsx` | Brand consistency | 3 user-visible **"Genesis Director"** brand leaks (Editor, API, docs) → "Small Bridges". |
| 8 | `src/pages/Contact.tsx` | Security | Added client-side email validation + **rate limiting** (3 msgs / 5 min via existing `checkRateLimit`) and `maxLength` caps on all inputs (name/email/subject/message). |
| 9 | `src/components/cinema/Footer.tsx` | Security | Added a **honeypot** field to the newsletter form (silent no-op on bot hit). |
| 10 | `scripts/generate-sitemap.ts` | SEO | Generator auto-discovered routes that `robots.txt` **disallows** (`/create`, `/create/legacy`, `/loft`, `/editor`, …) and listed them in the sitemap — a mixed-signal SEO bug. Added a `robots.txt`-mirrored disallow filter. |
| 11 | `public/sitemap.xml` | SEO | Regenerated — now 24 entries, none of them robots-disallowed. |

---

## 2. SEO findings

### Fixed
- **Wrong brand/domain in `robots.txt` + `llms.txt`** (critical). Crawlers were pointed at `apex-studio.ai/sitemap.xml`; AI crawlers were fed an entire stale Apex Studio fact sheet. ✅
- **Sitemap ⇄ robots.txt contradiction** — disallowed app routes were being sitemap-listed. ✅
- **Stale / over-long default meta description** in `index.html`. ✅
- **Meta contradiction** on `/pricing` ("No subscriptions" vs a subscriptions section). ✅
- **Organization JSON-LD** now includes `legalName` + `contactPoint`. ✅

### Already healthy (no change needed)
- `usePageMeta` hook gives every marketing route a unique title, description, canonical, OG + Twitter tags (self-referencing canonicals, restore-on-unmount). Good.
- Rich JSON-LD already present in `index.html`: Organization, SoftwareApplication (with priced Offers), and **FAQPage**. Blog posts emit Article schema.
- Single `<h1>` per page; sensible heading order; alt text present on the marketing image components reviewed.
- `manifest.json`, theme-color, favicons, canonical all correct.
- Sitemap generator runs on `predev`/`prebuild` so it can't silently drift.

### Recommendations (not done — need owner decision / assets)
- **SPA = client-side meta injection.** `usePageMeta` runs after JS executes, so crawlers without JS execution see only `index.html` defaults. Google renders JS, but many social/AI crawlers don't. Consider prerendering the marketing routes (e.g. `vite-plugin-prerender`/`react-snap`, or moving marketing to SSR). This is the single biggest structural SEO win and is a larger change than a polish pass should make unilaterally.
- **`og-image.webp` is ~1344×768** (≈1.75:1). Fine, but 1200×630 is the safest ratio across platforms. Optionally add per-page OG images (Pricing, Blog, Press) — `usePageMeta` already accepts `ogImage`.
- **Specific numeric claims in JSON-LD** carried over from the Apex era — `"Voice Synthesis: 50+ voices, 29 languages"` (`index.html` SoftwareApplication featureList + FAQ). Verify these numbers are true for Small Bridges; if not, soften. (Left unchanged because I can't confirm either way — see Messaging §4.)
- **Sitemap contains some app-ish public routes** (`/inbox`, `/search`, `/lobby`, `/music`, `/crossover`, `/films`, `/help-center`). They're public and not robots-disallowed, so inclusion is at least *consistent* — but if they aren't intended ranking targets, add them to the generator's disallow list (or `robots.txt`).

---

## 3. Messaging & claims

### Fixed
- **"Hollywood-quality"** (Landing meta) and **"the same visual language used in Hollywood productions"** (How-It-Works) — softened to substantiated language. The FTC scrutinizes unqualified superlative claims.
- **Payment-provider claims corrected to Polar** (was Stripe in two user-visible spots) — see Consistency §5.
- **Engine naming** unified to `Seedance 2.0`.
- **Vague "Zero-waste guarantee"** → concrete "Failed renders refunded".

### Flagged (left as-is — need owner verification, did not dilute possibly-true specifics)
- **`LiveStatRibbon`** — verified it shows **real** data (polls the `landing-stats` function, degrades gracefully). Not a fabricated stat. 👍
- Specific inventory numbers in How-It-Works: **"461 characters"**, **"120 worlds"**, **"12 Camera Movements · 14 Angles · 9 Lighting Styles"**, **"25+ negative prompts"**. These read as credible *if accurate*; they become false over time if inventory changes. Recommend either (a) confirm they're current and keep, or (b) generalize ("hundreds of characters", "100+ environments"). Not changed — diluting true specifics would be a downgrade.
- **Free-tier scope** (`PricingCrew` "Solo Director"): "first 5-sec video free" + "Full studio access". Acceptable but slightly ambiguous about what's free forever vs. pay-as-you-go after the first clip. Consider one clarifying line.
- **Engine list in footer** (`Wan 2.5, Kling V3, Seedance 2.0, Veo 3, Runway Gen-4, Sora 2`) — confirm all six are actually wired before presenting them as available "Engines".

### Dead code (not user-visible — flag for cleanup, not edited)
- `src/components/landing/ScrollBackdrop.tsx` is **unused**; it contains an overpromise ("worlds Hollywood would budget in seven figures — for the price of a coffee"). Safe to delete.
- `src/components/landing/Footer.tsx` is **unused** (only referenced by tests); the real shared footer is `src/components/cinema/Footer.tsx`. The "two footers" concern is therefore not user-facing.

---

## 4. Consistency (visual / copy / component)

### Fixed
- **Brand leaks removed**: `Apex Studio` (robots/llms), `Genesis Director` (HelpDoc). Brand is consistently **Small Bridges** / **Small Bridges Studio LLC** across the surface now.
- **Payment provider** is now consistently **Polar** in user-visible copy (matches the legal pages).
- **Engine naming** consistent (`Seedance 2.0`).

### Flagged (needs an owner decision — intentionally not forced)
- **Pricing tier names differ between landing and `/pricing`.** The landing `PricingCrew` shows **"Studio Team $49 / 600cr"** and **"Production House $149 / 2,000cr"**; `/pricing` shows the *same* plans (identical price, credits, and Stripe/Polar lookup keys) as **"Pro"** and **"Studio"**. A buyer who clicks "Studio Team $49" lands on a page calling it "Pro $49". This is a genuine cross-page contradiction, but the fix touches billing-system-of-record naming and the intentional "film crew" theme, so it's a product decision — recommend aligning the displayed names (keep the crew silhouettes, use the canonical plan names) rather than leaving two names for one SKU.
- **CTA label drift** across components: `Get Started`, `Get started`, `Get Started Free`, `Start Creating Free`, `Sign up — free`, `Start free workspace`, etc. Some variance is contextual and fine; the capitalization inconsistency is the part worth standardizing. Left untouched to avoid wide low-value churn — recommend picking one canonical primary-CTA string.

### Asset / infra brand leak (must NOT break — flag for re-hosting)
- `src/components/cinema/assets.ts` serves two **live landing videos from `https://apex-studio.ai/...`** (the old project bucket — `EDITOR_VIDEO`, `AVATAR_VIDEO`). The old brand is visible in network requests. **Not changed** — rewriting the URL would break the videos (no equivalent on a Small Bridges bucket). Recommend re-hosting these on a Small Bridges / Supabase bucket, then updating the constants.

---

## 5. Performance & trust

### Observations (landing is already well-optimized)
- Strong perceived-performance work: cinematic loader gate (waits on hero image decode + fonts + paint, 4.5s hard ceiling), below-the-fold sections lazy-split, heavy video layer deferred 600ms after first paint, fonts preloaded with `media="print"` swap, DNS-prefetch/preconnect for fonts. No layout-shift red flags found.
- Trust signals present and well-placed: real-time `LiveStatRibbon`, real renders in `DirectorsReel`, "Free to start / No credit card / $0.10 per credit" under the hero CTA, secure-checkout + refund trust bar on pricing, live "Studio online" pulse + Missouri entity line in the footer.

### Recommendations (not changed)
- `index.html` loads a broad set of font weights (Sora 400–800, Instrument Sans 400–700, JetBrains Mono, full Fraunces optical range). Trimming unused weights would cut font payload — verify which weights are actually used before pruning.
- Largest JS chunks are app/editor bundles (`vendor-observability` ~559kB, `VideoEditor` ~541kB) which are **not** on the marketing path; the marketing entry is reasonable. No action needed for landing.

---

## 6. Security (marketing surface)

### Fixed
- **Contact form**: added client-side email validation + **rate limiting** (3 / 5 min) + `maxLength` caps. Previously only an `isSubmitting` guard, so the public `support_messages` insert + admin email could be spammed from the browser. (Server-side limiting on the edge function is the real backstop and lives outside this scope — see flags.)
- **Newsletter form** (footer): added a **honeypot** to deter bot subscriptions / email enumeration.

### Verified clean
- **No exposed secrets** on the marketing surface. Only `VITE_`-prefixed (publishable) values appear client-side, as designed. No service-role keys, Polar/Resend tokens, or private keys in marketing code.
- **No `dangerouslySetInnerHTML`** misuse on marketing pages (Blog uses it only for JSON-LD, which is non-user content).
- **No `target="_blank"`** without `rel` in marketing components (no reverse-tabnabbing).
- Contact `mailto:` is the same published support address used elsewhere — acceptable for a small team (harvest risk is low-impact; left as-is).

### Flagged (backend / app — out of scope, for the owning agent)
- The public edge functions invoked from marketing (`newsletter-subscribe`, `send-transactional-email`) should enforce **server-side per-IP rate limiting**; client-side limits are best-effort only.
- **CSP/Permissions-Policy in `index.html` whitelist Stripe but not Polar** (`js.stripe.com`, `checkout.stripe.com`, `payment=(self stripe…)`). Since billing is Polar, confirm Polar checkout works under the current CSP (it may rely on a top-level redirect rather than an embedded frame). If Polar needs framing/XHR to its domain, the CSP needs a Polar entry; the Stripe entries are presumably for Stripe Connect payouts. **Not changed** (shared infra; risky to touch blind).

---

## 7. Legal — needs lawyer review (DRAFT recommendations, NOT shipped)

The live `Terms.tsx` and `Privacy.tsx` are already comprehensive and well-drafted
(acceptance/eligibility, accounts, billing, acceptable use, ownership, AI
disclaimer, third-party processors, IP, DMCA, warranty/liability, indemnification,
**binding arbitration + class waiver + 30-day opt-out**, governing law, GDPR legal
bases + rights, CCPA/CPRA, children, international transfers). They did **not** need
a rewrite, and unreviewed legal text must not be shipped. The items below are
**DRAFT suggestions for a lawyer** — none are live.

1. **DRAFT — Payment-processor reconciliation (highest priority).** Terms (§Billing, §Third-Party) and Privacy (§Data We Collect, §Processors) correctly name **Polar** as the payment processor. The *product* surface contradicted this (now fixed in marketing copy: §5). Confirm the legal docs match the live integration, and confirm whether **Stripe Connect** (creator payouts) needs its own disclosure as a processor in the Privacy Policy.
2. **DRAFT — Disclose all sub-processors.** The app's CSP also permits `api.openai.com` and `maps.googleapis.com`. If OpenAI (e.g., script generation) and/or Google Maps are used, add them to Privacy → "Service Providers & Sub-Processors" (currently lists Supabase, Replicate, Polar, Resend, Vercel).
3. **DRAFT — Cookie consent mechanism.** Privacy says it honors GPC and uses "limited analytics," and the build ships PostHog (`posthog-js`). For EEA/UK, non-essential analytics typically require a prior-consent banner. Confirm a consent mechanism exists or add one, and align the Cookies section accordingly.
4. **DRAFT — EU/UK consumer right of withdrawal.** Terms make credits "non-refundable except where required by law." For EU/UK digital-content sales, consider explicit language that the consumer consents to immediate performance and acknowledges loss of the 14-day withdrawal right (a common, lawyer-reviewed clause).
5. **DRAFT — Data-retention specificity.** Privacy says logs are kept "for a limited period." Consider stating an actual window (e.g., "up to 12 months") for clarity and auditability.
6. **DRAFT — Versioning.** Both pages show "Last updated June 22, 2026" but no change log/version. Consider a visible version or effective-date history for material changes.
7. **DRAFT — Accessibility statement.** Optional but increasingly expected; consider a short statement / contact for accessibility issues.

---

## 8. Verification

- `npm run typecheck` → **exit 0** ✅
- `npm test` (full suite, with Supabase env provided) → **3550 passed, 61 skipped, 0 failed** ✅
  - Note: without `VITE_SUPABASE_URL` set, 33 tests fail with `supabaseUrl is required` — this is a **pre-existing environment requirement** (no `.env.local` in this checkout), unrelated to these changes. Confirmed by re-running the affected files (incl. Landing/Pricing module-export tests) with dummy env → all pass.
- `npm run build` → **exit 0** ✅ (also regenerates sitemap via `prebuild`).
- Per-edit `grep` verification of every change ✅.

Incidental files touched by tooling were reverted (`bun.lock` from `bun install`,
`reports/admin-sidebar/wiring-report.json` timestamp from the build) so the commit
contains only intended changes.
