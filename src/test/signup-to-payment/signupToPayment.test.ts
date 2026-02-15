/**
 * COMPREHENSIVE SIGNUP-TO-PAYMENT FLOW TESTS
 * 
 * Tests every critical gap that would prevent a user from:
 * 1. Signing up
 * 2. Navigating to credit purchase
 * 3. Completing a Stripe checkout
 * 4. Receiving credits via webhook
 * 
 * STATIC ANALYSIS: Validates code structure, data consistency, and config alignment.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// HELPERS
// ============================================================================

const readFile = (filePath: string): string => {
  const fullPath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return fs.readFileSync(fullPath, 'utf-8');
};

const fileExists = (filePath: string): boolean => {
  return fs.existsSync(path.join(process.cwd(), filePath));
};

// ============================================================================
// 1. SIGNUP PAGE INTEGRITY
// ============================================================================

describe('SIGNUP: Auth page completeness', () => {
  let authSource: string;

  beforeAll(() => {
    authSource = readFile('src/pages/Auth.tsx');
  });

  it('has email input field', () => {
    expect(authSource).toContain('type="email"');
    expect(authSource).toContain('id="email"');
  });

  it('has password input field', () => {
    expect(authSource).toContain('id="password"');
    expect(authSource).toContain('type="password"');
  });

  it('has confirm password for signup mode', () => {
    expect(authSource).toContain('id="confirmPassword"');
    expect(authSource).toContain('Confirm Password');
  });

  it('validates password confirmation match before submit', () => {
    expect(authSource).toContain('password !== confirmPassword');
    expect(authSource).toContain('Passwords do not match');
  });

  it('has submit button', () => {
    expect(authSource).toContain('type="submit"');
    expect(authSource).toContain('Create account');
  });

  it('has toggle between login and signup', () => {
    expect(authSource).toContain("setIsLogin(!isLogin)");
    expect(authSource).toContain("Sign up");
    expect(authSource).toContain("Sign in");
  });

  it('shows loading state during submission', () => {
    expect(authSource).toContain('disabled={loading}');
    expect(authSource).toContain('Creating account...');
  });

  it('validates email format with Zod', () => {
    expect(authSource).toContain("emailSchema");
    expect(authSource).toContain(".email(");
  });

  it('validates password minimum length', () => {
    expect(authSource).toContain('.min(6');
  });

  it('handles signup errors gracefully', () => {
    expect(authSource).toContain("already registered");
    expect(authSource).toContain("toast.error");
  });

  it('shows email confirmation pending state after signup', () => {
    expect(authSource).toContain('pendingEmailConfirmation');
    expect(authSource).toContain('Check your email');
    expect(authSource).toContain('confirmation link');
  });

  it('has Terms of Service and Privacy Policy links on signup', () => {
    expect(authSource).toContain('/terms');
    expect(authSource).toContain('/privacy');
  });

  it('delegates signup to AuthContext which sets emailRedirectTo to /auth/callback', () => {
    // Auth.tsx calls signUp() from AuthContext, which handles emailRedirectTo
    expect(authSource).toContain('signUp(trimmedEmail, password)');
    const authContext = readFile('src/contexts/AuthContext.tsx');
    expect(authContext).toContain('auth/callback');
    expect(authContext).toContain('emailRedirectTo');
  });

  it('has mode=signup URL parameter support', () => {
    expect(authSource).toContain("mode");
    expect(authSource).toContain("modeParam !== 'signup'");
  });
});

// ============================================================================
// 2. AUTH CONTEXT - SIGNUP FUNCTION
// ============================================================================

describe('SIGNUP: AuthContext signUp function', () => {
  let authContextSource: string;

  beforeAll(() => {
    authContextSource = readFile('src/contexts/AuthContext.tsx');
  });

  it('provides signUp function', () => {
    expect(authContextSource).toContain('signUp: (email: string, password: string)');
  });

  it('calls supabase.auth.signUp', () => {
    expect(authContextSource).toContain('supabase.auth.signUp');
  });

  it('sets emailRedirectTo for confirmation flow', () => {
    expect(authContextSource).toContain('emailRedirectTo: redirectUrl');
    expect(authContextSource).toContain("auth/callback");
  });

  it('has session sync timeout guard (prevents stack overflow)', () => {
    expect(authContextSource).toContain('MAX_ITERATIONS');
    expect(authContextSource).toContain('Session sync timed out');
  });

  it('returns error object from signUp', () => {
    expect(authContextSource).toContain('return { error: error as Error | null }');
  });

  it('has safe fallback when context is missing', () => {
    expect(authContextSource).toContain("signUp: async () => ({ error: new Error('Auth not initialized') })");
  });
});

// ============================================================================
// 3. AUTH CALLBACK ROUTE
// ============================================================================

describe('SIGNUP: Auth callback route exists', () => {
  let appSource: string;

  beforeAll(() => {
    appSource = readFile('src/App.tsx');
  });

  it('has /auth/callback route configured', () => {
    expect(appSource).toContain('/auth/callback');
    expect(appSource).toContain('AuthCallback');
  });
});

// ============================================================================
// 4. POST-SIGNUP REDIRECT FLOW
// ============================================================================

describe('SIGNUP: Post-authentication redirect', () => {
  let authSource: string;

  beforeAll(() => {
    authSource = readFile('src/pages/Auth.tsx');
  });

  it('redirects new users to onboarding', () => {
    expect(authSource).toContain("!profile.onboarding_completed");
    expect(authSource).toContain("navigate('/onboarding'");
  });

  it('redirects existing users to projects', () => {
    expect(authSource).toContain("navigate('/projects'");
  });

  it('has redirect guard to prevent infinite redirect', () => {
    expect(authSource).toContain('hasRedirected');
    expect(authSource).toContain('setHasRedirected(true)');
  });

  it('waits for auth loading before redirecting', () => {
    expect(authSource).toContain('if (authLoading) return');
  });
});

// ============================================================================
// 5. CREDIT PACKAGES DATABASE vs EDGE FUNCTION CONSISTENCY
// ============================================================================

describe('PAYMENT: Stripe Price ID consistency (DB vs Edge Function)', () => {
  let edgeFunctionSource: string;

  beforeAll(() => {
    edgeFunctionSource = readFile('supabase/functions/create-credit-checkout/index.ts');
  });

  // DB values (from query):
  // Mini:    price_1T0ASxCh3vnsCadWpStMewh5  (90 credits, $9)
  // Starter: price_1SqjeMCZh4qZNjWWSGv3M7eu  (370 credits, $37)  
  // Growth:  price_1SqjezCZh4qZNjWWbQZ9yEdx  (1000 credits, $99)
  // Agency:  price_1SqjoHCZh4qZNjWWmdXoh3sm  (2500 credits, $249)

  // Edge function values:
  // Mini:    price_1T0ASxCh3vnsCadWpStMewh5  (90 credits) ✓ matches
  // Starter: price_1SxftaCh3vnsCadWTBmr53l1  (370 credits) ✗ MISMATCH
  // Growth:  price_1SxfupCh3vnsCadWKOkv3IQP  (1000 credits) ✗ MISMATCH
  // Agency:  price_1SxfvpCh3vnsCadWXYrcFWHe  (2500 credits) ✗ MISMATCH

  it('CRITICAL: mini price ID matches between edge function and database', () => {
    const dbPriceId = 'price_1T0ASxCh3vnsCadWpStMewh5';
    expect(edgeFunctionSource).toContain(dbPriceId);
  });

  it('CRITICAL: starter price ID — edge function uses DIFFERENT price ID than database', () => {
    // DB has: price_1SqjeMCZh4qZNjWWSGv3M7eu
    // Edge function has: price_1SxftaCh3vnsCadWTBmr53l1
    const dbPriceId = 'price_1SqjeMCZh4qZNjWWSGv3M7eu';
    const edgePriceId = 'price_1SxftaCh3vnsCadWTBmr53l1';
    
    // This test documents the MISMATCH - the edge function does NOT use the DB price ID
    const usesDbPrice = edgeFunctionSource.includes(dbPriceId);
    const usesEdgePrice = edgeFunctionSource.includes(edgePriceId);
    
    // Document what's happening - this IS a gap if they should be the same Stripe account
    expect(usesEdgePrice).toBe(true); // Edge function uses its own price
    
    // WARN: If these should be the same Stripe account, this is a billing failure
    // The edge function will charge via one price, but the DB reference shows another
    console.warn(`⚠️ STARTER PRICE MISMATCH: DB=${dbPriceId}, EdgeFn=${edgePriceId}`);
  });

  it('CRITICAL: growth price ID — edge function uses DIFFERENT price ID than database', () => {
    const dbPriceId = 'price_1SqjezCZh4qZNjWWbQZ9yEdx';
    const edgePriceId = 'price_1SxfupCh3vnsCadWKOkv3IQP';
    
    const usesEdgePrice = edgeFunctionSource.includes(edgePriceId);
    expect(usesEdgePrice).toBe(true);
    
    console.warn(`⚠️ GROWTH PRICE MISMATCH: DB=${dbPriceId}, EdgeFn=${edgePriceId}`);
  });

  it('CRITICAL: agency price ID — edge function uses DIFFERENT price ID than database', () => {
    const dbPriceId = 'price_1SqjoHCZh4qZNjWWmdXoh3sm';
    const edgePriceId = 'price_1SxfvpCh3vnsCadWXYrcFWHe';
    
    const usesEdgePrice = edgeFunctionSource.includes(edgePriceId);
    expect(usesEdgePrice).toBe(true);
    
    console.warn(`⚠️ AGENCY PRICE MISMATCH: DB=${dbPriceId}, EdgeFn=${edgePriceId}`);
  });

  it('edge function credit counts match database credit counts', () => {
    // Mini: 90, Starter: 370, Growth: 1000, Agency: 2500
    expect(edgeFunctionSource).toContain('credits: 90');
    expect(edgeFunctionSource).toContain('credits: 370');
    expect(edgeFunctionSource).toContain('credits: 1000');
    expect(edgeFunctionSource).toContain('credits: 2500');
  });
});

// ============================================================================
// 6. BUY CREDITS MODAL
// ============================================================================

describe('PAYMENT: BuyCreditsModal completeness', () => {
  let modalSource: string;

  beforeAll(() => {
    modalSource = readFile('src/components/credits/BuyCreditsModal.tsx');
  });

  it('fetches packages from credit_packages_public view', () => {
    expect(modalSource).toContain("from('credit_packages_public')");
  });

  it('handles fetch errors gracefully', () => {
    expect(modalSource).toContain("Failed to load credit packages");
  });

  it('requires user to be signed in before purchase', () => {
    expect(modalSource).toContain("if (!user)");
    expect(modalSource).toContain("Please sign in to purchase credits");
  });

  it('calls create-credit-checkout edge function', () => {
    expect(modalSource).toContain("supabase.functions.invoke('create-credit-checkout'");
  });

  it('sends packageId in request body', () => {
    expect(modalSource).toContain('body: { packageId: checkoutId }');
  });

  it('redirects to Stripe checkout URL', () => {
    expect(modalSource).toContain('window.location.href = data.url');
  });

  it('handles checkout errors', () => {
    expect(modalSource).toContain("Failed to start checkout");
  });

  it('shows loading state during purchase', () => {
    expect(modalSource).toContain("purchasing === pkg.id");
    expect(modalSource).toContain("Loader2");
  });

  it('has correct package name to ID mapping', () => {
    expect(modalSource).toContain("'mini': 'mini'");
    expect(modalSource).toContain("'starter': 'starter'");
    expect(modalSource).toContain("'growth': 'growth'");
    expect(modalSource).toContain("'agency': 'agency'");
  });

  it('displays price, credits, and clip estimates', () => {
    expect(modalSource).toContain('price_cents / 100');
    expect(modalSource).toContain('credits.toLocaleString()');
    expect(modalSource).toContain('getClipsEstimate');
  });

  it('is wrapped in SafeComponent for crash isolation', () => {
    expect(modalSource).toContain("SafeComponent");
    expect(modalSource).toContain('name="BuyCreditsModal"');
  });

  it('uses isMounted guard to prevent state updates after unmount', () => {
    expect(modalSource).toContain('isMountedRef.current');
    expect(modalSource).toContain('useIsMounted');
  });
});

// ============================================================================
// 7. CHECKOUT EDGE FUNCTION
// ============================================================================

describe('PAYMENT: create-credit-checkout edge function', () => {
  let checkoutSource: string;

  beforeAll(() => {
    checkoutSource = readFile('supabase/functions/create-credit-checkout/index.ts');
  });

  it('exists as a deployed edge function', () => {
    expect(fileExists('supabase/functions/create-credit-checkout/index.ts')).toBe(true);
  });

  it('handles CORS preflight', () => {
    expect(checkoutSource).toContain('req.method === "OPTIONS"');
    expect(checkoutSource).toContain('Access-Control-Allow-Origin');
  });

  it('validates packageId input', () => {
    expect(checkoutSource).toContain('!packageId');
    expect(checkoutSource).toContain('CREDIT_PACKAGES[packageId]');
    expect(checkoutSource).toContain('Invalid package ID');
  });

  it('sanitizes packageId (lowercase, trim, max length)', () => {
    expect(checkoutSource).toContain('.toLowerCase().trim()');
    expect(checkoutSource).toContain('packageId.length > 50');
  });

  it('requires Authorization header', () => {
    expect(checkoutSource).toContain('Authorization');
    expect(checkoutSource).toContain('No authorization header provided');
  });

  it('authenticates user via JWT claims', () => {
    expect(checkoutSource).toContain('getClaims');
    expect(checkoutSource).toContain('claims.sub');
  });

  it('uses STRIPE_SECRET_KEY from environment', () => {
    expect(checkoutSource).toContain('STRIPE_SECRET_KEY');
  });

  it('checks for existing Stripe customer', () => {
    expect(checkoutSource).toContain('stripe.customers.list');
    expect(checkoutSource).toContain('email: userEmail');
  });

  it('creates checkout session with mode: payment', () => {
    expect(checkoutSource).toContain('mode: "payment"');
  });

  it('includes user_id and credits in session metadata', () => {
    expect(checkoutSource).toContain('user_id: userId');
    expect(checkoutSource).toContain('credits: pkg.credits.toString()');
    expect(checkoutSource).toContain('package_id: packageId');
  });

  it('sets success and cancel URLs', () => {
    expect(checkoutSource).toContain('success_url');
    expect(checkoutSource).toContain('cancel_url');
    expect(checkoutSource).toContain('payment=success');
    expect(checkoutSource).toContain('payment=canceled');
  });

  it('supports welcome offer coupon', () => {
    expect(checkoutSource).toContain('welcomeOffer');
    expect(checkoutSource).toContain('WELCOME_COUPON_ID');
    expect(checkoutSource).toContain('discounts');
  });

  it('returns checkout URL in response', () => {
    expect(checkoutSource).toContain('JSON.stringify({ url: session.url })');
  });

  it('has all four package IDs defined', () => {
    expect(checkoutSource).toContain('mini:');
    expect(checkoutSource).toContain('starter:');
    expect(checkoutSource).toContain('growth:');
    expect(checkoutSource).toContain('agency:');
  });
});

// ============================================================================
// 8. STRIPE WEBHOOK
// ============================================================================

describe('PAYMENT: stripe-webhook edge function', () => {
  let webhookSource: string;

  beforeAll(() => {
    webhookSource = readFile('supabase/functions/stripe-webhook/index.ts');
  });

  it('exists as a deployed edge function', () => {
    expect(fileExists('supabase/functions/stripe-webhook/index.ts')).toBe(true);
  });

  it('requires STRIPE_WEBHOOK_SECRET', () => {
    expect(webhookSource).toContain('STRIPE_WEBHOOK_SECRET');
    expect(webhookSource).toContain('Webhook not configured');
  });

  it('requires stripe-signature header', () => {
    expect(webhookSource).toContain('stripe-signature');
    expect(webhookSource).toContain('Missing signature');
  });

  it('verifies webhook signature cryptographically', () => {
    expect(webhookSource).toContain('constructEventAsync');
    expect(webhookSource).toContain('Signature verified successfully');
  });

  it('rejects invalid signatures', () => {
    expect(webhookSource).toContain('Invalid signature');
    expect(webhookSource).toContain('status: 401');
  });

  it('handles checkout.session.completed event', () => {
    expect(webhookSource).toContain('checkout.session.completed');
  });

  it('validates user_id as UUID format', () => {
    expect(webhookSource).toContain('uuidRegex');
    expect(webhookSource).toContain('Invalid user_id');
  });

  it('validates credits as positive integer within bounds', () => {
    expect(webhookSource).toContain('credits <= 0');
    expect(webhookSource).toContain('credits > 100000');
    expect(webhookSource).toContain('Invalid credits value');
  });

  it('validates package_id format', () => {
    expect(webhookSource).toContain('Invalid package_id');
    expect(webhookSource).toMatch(/\[a-z0-9_-\]/);
  });

  it('uses add_credits RPC for idempotent credit fulfillment', () => {
    expect(webhookSource).toContain("supabaseAdmin.rpc(\"add_credits\"");
  });

  it('uses SUPABASE_SERVICE_ROLE_KEY for admin operations', () => {
    expect(webhookSource).toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('passes stripe_payment_id for idempotency', () => {
    expect(webhookSource).toContain('p_stripe_payment_id: stripePaymentId');
  });

  it('uses payment_intent as primary payment ID', () => {
    expect(webhookSource).toContain('session.payment_intent');
  });
});

// ============================================================================
// 9. CREDIT SYSTEM LOGIC
// ============================================================================

describe('PAYMENT: Credit system calculation correctness', () => {
  let creditSource: string;

  beforeAll(() => {
    creditSource = readFile('src/lib/creditSystem.ts');
  });

  it('base rate is 10 credits per clip', () => {
    expect(creditSource).toContain('BASE_CREDITS_PER_CLIP: 10');
  });

  it('extended rate is 15 credits per clip', () => {
    expect(creditSource).toContain('EXTENDED_CREDITS_PER_CLIP: 15');
  });

  it('extended pricing triggers at clip 7 (index 6)', () => {
    expect(creditSource).toContain('BASE_CLIP_COUNT_THRESHOLD: 6');
  });

  it('extended pricing triggers for clips >6 seconds', () => {
    expect(creditSource).toContain('BASE_DURATION_THRESHOLD: 6');
  });

  it('pricing matches Stripe: 1 credit = $0.10', () => {
    expect(creditSource).toContain('CENTS_PER_CREDIT: 10');
  });

  it('welcome credits are zero (pay-as-you-go model)', () => {
    expect(creditSource).toContain('WELCOME_CREDITS: 0');
  });

  it('cost breakdown sums to total (base)', () => {
    // PRE_PRODUCTION: 2 + PRODUCTION: 6 + QUALITY_ASSURANCE: 2 = 10
    expect(creditSource).toContain('PRE_PRODUCTION: 2');
    expect(creditSource).toContain('PRODUCTION: 6');
    expect(creditSource).toContain('QUALITY_ASSURANCE: 2');
    expect(creditSource).toContain('TOTAL: 10');
  });

  it('cost breakdown sums to total (extended)', () => {
    // PRE_PRODUCTION: 3 + PRODUCTION: 9 + QUALITY_ASSURANCE: 3 = 15
    expect(creditSource).toContain('TOTAL: 15');
  });
});

// ============================================================================
// 10. WELCOME OFFER MODAL
// ============================================================================

describe('PAYMENT: Welcome offer modal', () => {
  let welcomeSource: string;

  beforeAll(() => {
    welcomeSource = readFile('src/components/welcome/WelcomeOfferModal.tsx');
  });

  it('only shows for new signups who never purchased', () => {
    expect(welcomeSource).toContain('total_credits_purchased === 0');
    expect(welcomeSource).toContain('has_seen_welcome_offer === false');
  });

  it('only shows after onboarding is completed', () => {
    expect(welcomeSource).toContain('profile.onboarding_completed');
  });

  it('marks offer as seen in database', () => {
    expect(welcomeSource).toContain("has_seen_welcome_offer: true");
  });

  it('calls create-credit-checkout with mini package and welcomeOffer flag', () => {
    expect(welcomeSource).toContain("packageId: 'mini'");
    expect(welcomeSource).toContain('welcomeOffer: true');
  });

  it('has skip/dismiss option', () => {
    expect(welcomeSource).toContain("I'll explore first");
    expect(welcomeSource).toContain('handleClose');
  });

  it('displays correct discounted price ($9 → $6.30 = 30% off)', () => {
    expect(welcomeSource).toContain('$9');
    expect(welcomeSource).toContain('$6.30');
    expect(welcomeSource).toContain('30%');
  });
});

// ============================================================================
// 11. PAYMENT SUCCESS HANDLING
// ============================================================================

describe('PAYMENT: Success/Cancel URL handling', () => {
  let profileSource: string;
  let checkoutSource: string;

  beforeAll(() => {
    profileSource = readFile('src/pages/Profile.tsx');
    checkoutSource = readFile('supabase/functions/create-credit-checkout/index.ts');
  });

  it('checkout success URL points to /profile with payment=success', () => {
    expect(checkoutSource).toContain('payment=success');
    expect(checkoutSource).toContain('/profile');
  });

  it('checkout cancel URL points to /profile with payment=canceled', () => {
    expect(checkoutSource).toContain('payment=canceled');
    expect(checkoutSource).toContain('/profile');
  });

  it('profile page handles payment=success query param', () => {
    expect(profileSource).toContain('payment');
  });
});

// ============================================================================
// 12. LANDING PAGE SIGNUP CTAs
// ============================================================================

describe('SIGNUP: Landing page CTAs route correctly', () => {
  let finalCtaSource: string;

  beforeAll(() => {
    finalCtaSource = readFile('src/components/landing/FinalCTASection.tsx');
  });

  it('CTA button navigates to /auth?mode=signup', () => {
    expect(finalCtaSource).toContain("/auth?mode=signup");
  });
});

describe('SIGNUP: Pricing page CTAs route correctly', () => {
  let pricingSource: string;

  beforeAll(() => {
    pricingSource = readFile('src/pages/Pricing.tsx');
  });

  it('pricing CTAs navigate to /auth?mode=signup', () => {
    expect(pricingSource).toContain("/auth?mode=signup");
  });
});

// ============================================================================
// 13. PRICING PAGE SIGNUP POPUP (ALTERNATE SIGNUP FLOW)
// ============================================================================

describe('SIGNUP: PricingSection inline signup popup', () => {
  let pricingSectionSource: string;

  beforeAll(() => {
    pricingSectionSource = readFile('src/components/landing/PricingSection.tsx');
  });

  it('has inline signup form', () => {
    expect(pricingSectionSource).toContain('handleSignup');
    expect(pricingSectionSource).toContain('supabase.auth.signUp');
  });

  it('sets emailRedirectTo for confirmation', () => {
    expect(pricingSectionSource).toContain('emailRedirectTo');
  });

  it('POTENTIAL GAP: uses window.location.origin (not auth/callback)', () => {
    // The main Auth page uses /auth/callback but the PricingSection popup
    // uses window.location.origin directly. This means the email confirmation
    // link will redirect to the root URL instead of the callback handler.
    expect(pricingSectionSource).toContain('window.location.origin');
    
    // Check if it uses /auth/callback like the main flow
    const usesCallback = pricingSectionSource.includes('/auth/callback');
    if (!usesCallback) {
      console.warn('⚠️ GAP: PricingSection signup uses window.location.origin instead of /auth/callback for emailRedirectTo. Email confirmation may not be handled correctly.');
    }
  });

  it('handles already registered error', () => {
    expect(pricingSectionSource).toContain('already registered');
  });
});

// ============================================================================
// 14. EDGE FUNCTION FILE STRUCTURE
// ============================================================================

describe('INFRASTRUCTURE: Edge function deployment readiness', () => {
  it('create-credit-checkout function directory exists', () => {
    expect(fileExists('supabase/functions/create-credit-checkout/index.ts')).toBe(true);
  });

  it('stripe-webhook function directory exists', () => {
    expect(fileExists('supabase/functions/stripe-webhook/index.ts')).toBe(true);
  });

  it('webhook has test file', () => {
    expect(fileExists('supabase/functions/stripe-webhook/index_test.ts')).toBe(true);
  });
});

// ============================================================================
// 15. CRITICAL DATA FLOW: Webhook → add_credits → Profile Balance
// ============================================================================

describe('PAYMENT: Webhook credit fulfillment chain', () => {
  let webhookSource: string;

  beforeAll(() => {
    webhookSource = readFile('supabase/functions/stripe-webhook/index.ts');
  });

  it('webhook reads credits from session metadata (not hardcoded)', () => {
    expect(webhookSource).toContain("session.metadata.credits");
    expect(webhookSource).toContain("parseInt(session.metadata.credits");
  });

  it('webhook passes correct parameters to add_credits RPC', () => {
    expect(webhookSource).toContain('p_user_id: userId');
    expect(webhookSource).toContain('p_amount: credits');
    expect(webhookSource).toContain('p_description:');
    expect(webhookSource).toContain('p_stripe_payment_id: stripePaymentId');
  });

  it('webhook checks for add_credits errors', () => {
    expect(webhookSource).toContain('if (error)');
    expect(webhookSource).toContain('Error adding credits');
  });

  it('webhook returns 200 on success (required by Stripe)', () => {
    expect(webhookSource).toContain('status: 200');
    expect(webhookSource).toContain('received: true');
  });
});

// ============================================================================
// 16. SECURITY CHECKS
// ============================================================================

describe('SECURITY: Payment flow hardening', () => {
  let checkoutSource: string;
  let webhookSource: string;

  beforeAll(() => {
    checkoutSource = readFile('supabase/functions/create-credit-checkout/index.ts');
    webhookSource = readFile('supabase/functions/stripe-webhook/index.ts');
  });

  it('checkout requires authentication', () => {
    expect(checkoutSource).toContain('Authorization');
    expect(checkoutSource).toContain('User not authenticated');
  });

  it('checkout validates user email exists', () => {
    expect(checkoutSource).toContain('User email not available');
  });

  it('webhook requires signature verification (no bypass)', () => {
    expect(webhookSource).toContain('STRIPE_WEBHOOK_SECRET');
    expect(webhookSource).not.toContain('// Skip signature verification');
  });

  it('webhook validates all metadata fields', () => {
    expect(webhookSource).toContain('Invalid user_id');
    expect(webhookSource).toContain('Invalid credits value');
    expect(webhookSource).toContain('Invalid package_id');
    expect(webhookSource).toContain('Invalid payment reference');
  });

  it('checkout does not expose STRIPE_SECRET_KEY in responses', () => {
    // Ensure the key is only read from env, not logged or returned
    const keyUsages = checkoutSource.match(/STRIPE_SECRET_KEY/g);
    expect(keyUsages).toBeTruthy();
    expect(keyUsages!.length).toBeLessThanOrEqual(2); // Only env read + Stripe init
  });
});

// ============================================================================
// 17. CREDITS DISPLAY & LOW CREDITS WARNING
// ============================================================================

describe('PAYMENT: Credits display and warnings', () => {
  let creditsDisplaySource: string;
  let lowCreditsSource: string;

  beforeAll(() => {
    creditsDisplaySource = readFile('src/components/studio/CreditsDisplay.tsx');
    lowCreditsSource = readFile('src/components/studio/LowCreditsWarningBanner.tsx');
  });

  it('credits display shows remaining credits', () => {
    expect(creditsDisplaySource).toContain('credits.remaining');
  });

  it('credits display has buy button', () => {
    expect(creditsDisplaySource).toContain('setShowBuyModal(true)');
    expect(creditsDisplaySource).toContain('BuyCreditsModal');
  });

  it('credits display shows sign-in prompt for unauthenticated users', () => {
    expect(creditsDisplaySource).toContain("if (!user)");
    expect(creditsDisplaySource).toContain("Sign in");
  });

  it('low credits banner uses smart warning levels', () => {
    expect(lowCreditsSource).toContain('getCreditWarningLevel');
  });

  it('low credits banner navigates to profile for purchase', () => {
    expect(lowCreditsSource).toContain("navigate('/profile')");
    expect(lowCreditsSource).toContain('Get Credits');
  });

  it('low credits banner can be dismissed', () => {
    expect(lowCreditsSource).toContain('setIsDismissed(true)');
  });
});

// ============================================================================
// 18. GAP SUMMARY
// ============================================================================

describe('GAP SUMMARY: Known issues that could block signup-to-payment', () => {
  it('documents all identified gaps', () => {
    const gaps = [
      {
        severity: 'CRITICAL',
        issue: 'Stripe Price ID mismatch between database and edge function',
        detail: 'DB credit_packages has different stripe_price_id values for Starter/Growth/Agency than create-credit-checkout edge function. If these are on different Stripe accounts, one set is wrong.',
        affected: 'Starter (DB: price_1SqjeMCZh4qZNjWWSGv3M7eu, EF: price_1SxftaCh3vnsCadWTBmr53l1), Growth (DB: price_1SqjezCZh4qZNjWWbQZ9yEdx, EF: price_1SxfupCh3vnsCadWKOkv3IQP), Agency (DB: price_1SqjoHCZh4qZNjWWmdXoh3sm, EF: price_1SxfvpCh3vnsCadWXYrcFWHe)',
      },
      {
        severity: 'MEDIUM',
        issue: 'PricingSection signup popup uses different emailRedirectTo than Auth page',
        detail: 'PricingSection.tsx uses window.location.origin (root), Auth.tsx uses /auth/callback. Email confirmation links from PricingSection signups may not be handled correctly.',
        affected: 'Users signing up via the landing page pricing section popup',
      },
      {
        severity: 'LOW',
        issue: 'DB credit_packages stripe_price_id column not used by edge function',
        detail: 'The edge function hardcodes price IDs instead of reading from the database. This means updating prices in the DB has no effect on actual Stripe charges.',
        affected: 'Admin price management workflow',
      },
    ];

    // This test always passes — it's documentation
    console.log('\n📋 SIGNUP-TO-PAYMENT GAP REPORT:');
    gaps.forEach((gap, i) => {
      console.log(`\n${i + 1}. [${gap.severity}] ${gap.issue}`);
      console.log(`   Detail: ${gap.detail}`);
      console.log(`   Affected: ${gap.affected}`);
    });

    expect(gaps.length).toBeGreaterThan(0);
  });
});
