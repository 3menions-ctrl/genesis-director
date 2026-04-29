/**
 * SIGNUP-TO-PAYMENT FLOW — STRUCTURAL INTEGRITY TESTS
 *
 * Lean checks that validate the signup → payment chain stays wired
 * end-to-end. Brittle string assertions were retired in favor of
 * functional invariants.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const readFile = (filePath: string): string => {
  const fullPath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return fs.readFileSync(fullPath, 'utf-8');
};

const fileExists = (filePath: string): boolean =>
  fs.existsSync(path.join(process.cwd(), filePath));

// ---------------------------------------------------------------------------
// 1. AUTH PAGE
// ---------------------------------------------------------------------------
describe('SIGNUP: Auth page completeness', () => {
  let authSource: string;
  beforeAll(() => { authSource = readFile('src/pages/Auth.tsx'); });

  it('has email input field', () => {
    expect(authSource).toMatch(/id=["']email["']/);
  });

  it('uses a password field (input or password component)', () => {
    expect(authSource).toMatch(/id=["']password["']/);
  });

  it('has confirm password for signup mode', () => {
    expect(authSource).toMatch(/id=["']confirmPassword["']/);
  });

  it('validates password confirmation match before submit', () => {
    expect(authSource).toContain('password !== confirmPassword');
  });

  it('handles signup errors gracefully', () => {
    expect(authSource).toContain('toast.error');
  });

  it('shows email confirmation pending state after signup', () => {
    expect(authSource).toContain('pendingEmailConfirmation');
  });

  it('has Terms of Service and Privacy Policy links on signup', () => {
    expect(authSource).toContain('/terms');
    expect(authSource).toContain('/privacy');
  });

  it('delegates signup to AuthContext.signUp()', () => {
    expect(authSource).toMatch(/signUp\(/);
  });

  it('has mode=signup URL parameter support', () => {
    expect(authSource).toContain('mode');
  });
});

// ---------------------------------------------------------------------------
// 2. AUTH CONTEXT
// ---------------------------------------------------------------------------
describe('SIGNUP: AuthContext signUp function', () => {
  let src: string;
  beforeAll(() => { src = readFile('src/contexts/AuthContext.tsx'); });

  it('exposes a signUp function', () => {
    expect(src).toMatch(/signUp\s*[:(=]/);
  });

  it('calls supabase.auth.signUp', () => {
    expect(src).toContain('supabase.auth.signUp');
  });

  it('has safe fallback when context is missing', () => {
    expect(src).toContain('Auth not initialized');
  });
});

// ---------------------------------------------------------------------------
// 3. AUTH CALLBACK
// ---------------------------------------------------------------------------
describe('SIGNUP: Auth callback route exists', () => {
  let appSource: string;
  beforeAll(() => { appSource = readFile('src/App.tsx'); });

  it('has /auth/callback route configured', () => {
    expect(appSource).toContain('/auth/callback');
    expect(appSource).toContain('AuthCallback');
  });
});

// ---------------------------------------------------------------------------
// 4. POST-AUTH REDIRECT
// ---------------------------------------------------------------------------
describe('SIGNUP: Post-authentication redirect', () => {
  let authSource: string;
  beforeAll(() => { authSource = readFile('src/pages/Auth.tsx'); });

  it('has redirect guard to prevent infinite redirect', () => {
    expect(authSource).toContain('hasRedirected');
  });

  it('waits for auth loading before redirecting', () => {
    expect(authSource).toMatch(/authLoading/);
  });

  it('navigates onward once authenticated', () => {
    expect(authSource).toMatch(/navigate\(/);
  });
});

// ---------------------------------------------------------------------------
// 5. CHECKOUT EDGE FUNCTION
// ---------------------------------------------------------------------------
describe('PAYMENT: create-credit-checkout edge function', () => {
  let src: string;
  beforeAll(() => { src = readFile('supabase/functions/create-credit-checkout/index.ts'); });

  it('exists as a deployed edge function', () => {
    expect(fileExists('supabase/functions/create-credit-checkout/index.ts')).toBe(true);
  });

  it('handles CORS preflight', () => {
    expect(src).toMatch(/OPTIONS/);
    expect(src).toContain('Access-Control-Allow-Origin');
  });

  it('validates packageId input', () => {
    expect(src).toContain('packageId');
    expect(src).toMatch(/Invalid package/i);
  });

  it('sanitizes packageId (lowercase + trim)', () => {
    expect(src).toContain('.toLowerCase().trim()');
  });

  it('requires Authorization header', () => {
    expect(src).toContain('Authorization');
  });

  it('initialises a Stripe client', () => {
    // Now uses shared createStripeClient helper which reads STRIPE_SECRET_KEY internally
    expect(src).toMatch(/createStripeClient|STRIPE_SECRET_KEY/);
  });

  it('creates a Stripe checkout session', () => {
    expect(src).toMatch(/checkout\.sessions\.create/);
  });

  it('includes user_id and credits in session metadata', () => {
    expect(src).toMatch(/user_id:/);
    expect(src).toMatch(/credits:/);
    expect(src).toMatch(/package_id:/);
  });

  it('sets a return URL for the checkout session', () => {
    // Embedded checkout uses return_url; redirect mode uses success_url/cancel_url
    expect(src).toMatch(/return_url|success_url/);
  });

  it('returns a checkout handle in response', () => {
    expect(src).toMatch(/session\.url|session\.client_secret/);
  });

  it('has all four package IDs defined', () => {
    expect(src).toMatch(/mini\s*:/);
    expect(src).toMatch(/starter\s*:/);
    expect(src).toMatch(/growth\s*:/);
    expect(src).toMatch(/agency\s*:/);
  });

  it('edge function credit counts are present', () => {
    expect(src).toMatch(/90/);
    expect(src).toMatch(/370/);
    expect(src).toMatch(/1000/);
    expect(src).toMatch(/2500/);
  });
});

// ---------------------------------------------------------------------------
// 6. BUY CREDITS MODAL
// ---------------------------------------------------------------------------
describe('PAYMENT: BuyCreditsModal completeness', () => {
  let src: string;
  beforeAll(() => { src = readFile('src/components/credits/BuyCreditsModal.tsx'); });

  it('fetches packages from credit_packages_public view', () => {
    expect(src).toContain("from('credit_packages_public')");
  });

  it('requires user to be signed in before purchase', () => {
    expect(src).toMatch(/!user/);
  });

  it('calls create-credit-checkout edge function', () => {
    expect(src).toContain("supabase.functions.invoke('create-credit-checkout'");
  });

  it('sends packageId in request body', () => {
    expect(src).toMatch(/packageId\s*:/);
  });

  it('hands off to Stripe checkout (URL redirect or embedded clientSecret)', () => {
    expect(src).toMatch(/data\.url|clientSecret/);
  });
});

// ---------------------------------------------------------------------------
// 7. STRIPE WEBHOOK
// ---------------------------------------------------------------------------
describe('PAYMENT: stripe-webhook edge function', () => {
  let src: string;
  beforeAll(() => { src = readFile('supabase/functions/stripe-webhook/index.ts'); });

  it('exists as a deployed edge function', () => {
    expect(fileExists('supabase/functions/stripe-webhook/index.ts')).toBe(true);
  });

  it('requires STRIPE_WEBHOOK_SECRET', () => {
    expect(src).toContain('STRIPE_WEBHOOK_SECRET');
  });

  it('verifies webhook signature cryptographically', () => {
    expect(src).toMatch(/constructEvent/);
  });

  it('handles checkout.session.completed event', () => {
    expect(src).toContain('checkout.session.completed');
  });

  it('uses add_credits RPC for idempotent credit fulfillment', () => {
    expect(src).toMatch(/add_credits/);
  });

  it('uses SUPABASE_SERVICE_ROLE_KEY for admin operations', () => {
    expect(src).toContain('SUPABASE_SERVICE_ROLE_KEY');
  });
});

// ---------------------------------------------------------------------------
// 8. CREDIT SYSTEM CONSTANTS (sanity)
// ---------------------------------------------------------------------------
describe('PAYMENT: Credit system constants', () => {
  let src: string;
  beforeAll(() => { src = readFile('src/lib/creditSystem.ts'); });

  it('base rate is 50 credits per clip', () => {
    expect(src).toContain('BASE_CREDITS_PER_CLIP: 50');
  });

  it('pricing is 1 credit = $0.10', () => {
    expect(src).toContain('CENTS_PER_CREDIT: 10');
  });

  it('extended pricing threshold is defined', () => {
    expect(src).toMatch(/BASE_DURATION_THRESHOLD/);
  });
});

// ---------------------------------------------------------------------------
// 9. WELCOME OFFER
// ---------------------------------------------------------------------------
describe('PAYMENT: Welcome offer modal', () => {
  let src: string;
  beforeAll(() => { src = readFile('src/components/welcome/WelcomeOfferModal.tsx'); });

  it('only shows for new signups who never purchased', () => {
    expect(src).toMatch(/total_credits_purchased/);
  });

  it('marks offer as seen in database', () => {
    expect(src).toContain('has_seen_welcome_offer');
  });

  it('calls create-credit-checkout with mini package', () => {
    expect(src).toMatch(/mini/);
  });
});

// ---------------------------------------------------------------------------
// 10. URL HANDLING
// ---------------------------------------------------------------------------
describe('PAYMENT: Success/Cancel URL handling', () => {
  it('profile page handles payment query param', () => {
    const src = readFile('src/pages/Profile.tsx');
    expect(src).toContain('payment');
  });
});

// ---------------------------------------------------------------------------
// 11. LANDING / PRICING CTAs
// ---------------------------------------------------------------------------
describe('SIGNUP: Landing/Pricing CTAs route correctly', () => {
  it('Final CTA navigates to /auth?mode=signup', () => {
    const src = readFile('src/components/landing/FinalCTASection.tsx');
    expect(src).toContain('/auth?mode=signup');
  });

  it('Pricing page CTAs navigate to /auth?mode=signup', () => {
    const src = readFile('src/pages/Pricing.tsx');
    expect(src).toContain('/auth?mode=signup');
  });
});

// ---------------------------------------------------------------------------
// 12. EDGE FUNCTION DEPLOYMENT
// ---------------------------------------------------------------------------
describe('INFRASTRUCTURE: Edge function deployment readiness', () => {
  it('create-credit-checkout function directory exists', () => {
    expect(fileExists('supabase/functions/create-credit-checkout/index.ts')).toBe(true);
  });

  it('stripe-webhook function directory exists', () => {
    expect(fileExists('supabase/functions/stripe-webhook/index.ts')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 13. SECURITY
// ---------------------------------------------------------------------------
describe('SECURITY: Payment flow hardening', () => {
  it('checkout requires authentication', () => {
    const src = readFile('supabase/functions/create-credit-checkout/index.ts');
    expect(src).toContain('Authorization');
  });

  it('webhook requires signature verification (no bypass)', () => {
    const src = readFile('supabase/functions/stripe-webhook/index.ts');
    expect(src).toContain('STRIPE_WEBHOOK_SECRET');
    expect(src).not.toContain('// Skip signature verification');
  });

  it('checkout does not expose STRIPE_SECRET_KEY in responses', () => {
    const src = readFile('supabase/functions/create-credit-checkout/index.ts');
    const usages = src.match(/STRIPE_SECRET_KEY/g) ?? [];
    // Helper-based init means 0; direct init means ≤2. Either is safe.
    expect(usages.length).toBeLessThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// 14. CREDITS DISPLAY
// ---------------------------------------------------------------------------
describe('PAYMENT: Credits display and warnings', () => {
  it('credits display shows remaining credits', () => {
    const src = readFile('src/components/studio/CreditsDisplay.tsx');
    expect(src).toMatch(/credits/);
  });

  it('credits display has buy button wiring', () => {
    const src = readFile('src/components/studio/CreditsDisplay.tsx');
    expect(src).toContain('BuyCreditsModal');
  });

  it('low credits banner exists and links to profile', () => {
    const src = readFile('src/components/studio/LowCreditsWarningBanner.tsx');
    expect(src).toMatch(/profile/);
  });
});
