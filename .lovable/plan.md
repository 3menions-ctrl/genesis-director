# Pricing Unification & Checkout Consolidation

## Canonical price catalog (from `/pricing`)

**Personal credit packs (one-time)**
| ID | Price | Credits |
|---|---|---|
| `credits_starter` | $9 | 90 |
| `credits_creator` | $37 | 370 |
| `credits_pro` | $99 | 1,000 |
| `credits_studio` | $249 | 2,500 |

**Business credit packs (one-time)**
| ID | Price | Credits |
|---|---|---|
| `credits_business_starter` | $499 | 5,500 |
| `credits_business_growth` | $999 | 12,000 |
| `credits_business_scale` | $2,499 | 32,000 |

**Subscriptions (monthly recurring)**
| ID | Price | Credits/mo |
|---|---|---|
| `sub_creator_monthly` | $19 | 220 |
| `sub_pro_monthly` | $49 | 600 |
| `sub_studio_monthly` | $149 | 2,000 |

**Enterprise** — contact sales (no Stripe price; CTA → `/contact?topic=sales`).

All credit packs use Stripe tax code `txcd_10000000` (general digital goods). Subscriptions use `txcd_10103001` (SaaS).

## Steps

1. **Register Stripe products** via `payments--batch_create_product` — 10 products above, with correct tax codes, single-purchase quantity (1,1).
2. **Build unified `supabase/functions/create-checkout/index.ts`** — accepts `{ priceId, quantity?, environment, returnUrl, userId?, customerEmail? }`, resolves via `lookup_keys`, picks `mode` from price `type`, uses `resolveOrCreateCustomer` w/ userId metadata, embedded checkout, `managed_payments: { enabled: true }`. `verify_jwt = false` in `config.toml`.
3. **Delete** `create-plan-checkout`, `create-credit-checkout`, `create-cinema-checkout` (and any related config blocks).
4. **Wire Pricing.tsx CTAs**: each card → `useStripeCheckout({ priceId, userId, returnUrl })`. Enterprise → `/contact`. Add the embedded checkout sheet.
5. **Rewrite WorkspaceBilling.tsx tiers** to the canonical Business credit packs (one-time, not monthly/yearly). Update CTA call to unified `create-checkout`.
6. **Rewrite Credits.tsx** (cinema_*) to use the canonical Subscriptions table. Update calls to unified `create-checkout`.
7. **Update BuyCreditsModal & WelcomeOfferModal** to canonical pack IDs and unified `create-checkout`.
8. **Update StartOnboarding plan picker** IDs to canonical set so `/welcome/checkout` works against `create-checkout`.
9. **Update `WelcomeCheckout.tsx`** invoke target to `create-checkout`.
10. **QA**: typecheck, hit `/pricing`, `/credits`, `/workspace/billing`, `/start`, `/welcome/checkout` in console for any stale ID/function references.

## Out of scope
- Changing webhook handler (`payments-webhook`) — already keys off `lookup_key`.
- Migrating existing live subscriptions onto new IDs.
- Touching FAQ / features-comparison copy on `/pricing`.

## Risk notes
- Existing customers on old `cinema_*` / `business_*_monthly` / `sub_*` price IDs keep working through the webhook (their stripe `subscription.id` stays valid). New checkouts route through new IDs.
- `managed_payments` adds +3.5% per transaction; tax/fraud/disputes/support handled end-to-end. If you want to opt out, say so before I enable it.
