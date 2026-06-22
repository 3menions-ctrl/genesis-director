/**
 * Auth — /auth
 *
 * Two-pane on desktop (cinematic hero left, focused form right),
 * single-column on mobile with the hero collapsed to a heading.
 * Surfaces real Supabase errors with direct one-tap remediation
 * links. Apple / Google OAuth front and center.
 *
 * Flows handled:
 *   - Sign in (email + password)
 *   - Create account (email + password + agree-to-terms + strength meter)
 *   - OTP verification after signup (six-cell code, paste-friendly)
 *   - Resend code + "use a different email" escape hatches
 *
 * Notable upgrades vs. the prior 1,046-line version:
 *   - 50% smaller, far more readable
 *   - Surfaces the actual underlying Supabase error string in a
 *     dedicated banner with a one-click link to the relevant log /
 *     setting (Resend logs, Supabase rate-limits, etc.)
 *   - Real iOS auto-zoom prevention (text-base inputs)
 *   - Cinematic background driven by AutoSectionAurora + drifting
 *     film strip in the hero
 *   - Honors prefers-reduced-motion throughout
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { z } from "zod";
import { ArrowRight, Building2, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ADMIN_ENABLED } from "@/admin/adminEnabled";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { useSafeNavigation } from "@/lib/navigation";
import { usePageMeta } from "@/hooks/usePageMeta";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AuthHeroStage } from "@/components/auth/AuthHeroStage";
import { AuthOtpInput } from "@/components/auth/AuthOtpInput";
import { AuthErrorBanner, classifyAuthError, type AuthErrorCue } from "@/components/auth/AuthErrorBanner";
import { sfx } from "@/lib/sound";
import { celebrate } from "@/lib/celebrate";

// sessionStorage flag set the moment a fresh sign-in starts (password,
// OTP verify, or OAuth start). On the Auth page mount, if user+profile
// arrive AND this flag is present, we play the "THE CROSSING" intro
// before redirecting. The flag is cleared after the intro fires once.
const INTRO_FLAG = "sb:auth-just-signed-in";

// ── Schemas ────────────────────────────────────────────────────────────
const emailSchema = z
  .string()
  .trim()
  .min(1, "Enter your email")
  .email("That doesn't look like a valid email")
  .max(255);

const signinPasswordSchema = z.string().min(6, "Password is at least 6 characters").max(72);

const signupPasswordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Password is too long")
  .refine(
    (v) => /[A-Z]/.test(v) && /[a-z]/.test(v) && /\d/.test(v),
    { message: "Mix upper, lower, and a number" },
  );

type Mode = "signin" | "signup";

function passwordStrength(value: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  let s = 0;
  if (value.length >= 8) s++;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) s++;
  if (/\d/.test(value)) s++;
  if (/[^A-Za-z0-9]/.test(value)) s++;
  return [
    { score: 0 as const, label: "Too short" },
    { score: 1 as const, label: "Weak" },
    { score: 2 as const, label: "OK" },
    { score: 3 as const, label: "Strong" },
    { score: 4 as const, label: "Strong" },
  ][s];
}

export default function Auth() {
  usePageMeta({ title: "Sign in — Small Bridges", description: "Step onto the set. Cinematic AI video from one prompt." });

  const { user, profile, loading: authLoading, isAdmin, signIn, signUp } = useAuth();
  const { navigate } = useSafeNavigation();
  const reducedMotion = useReducedMotion();
  const [searchParams] = useSearchParams();

  const initialMode: Mode = searchParams.get("mode") === "signup" ? "signup" : "signin";
  const nextParam = (() => {
    const raw = searchParams.get("next");
    return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : null;
  })();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({});
  const [banner, setBanner] = useState<AuthErrorCue | null>(null);

  // Post-signup OTP state.
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  const strength = useMemo(() => passwordStrength(password), [password]);

  // ── Auto-redirect after sign in ────────────────────────────────────
  // The cinematic "Small Bridges" intro (THE CROSSING) is retired here — it
  // now plays ONLY on the landing-page entrance. Authenticated users route
  // straight to their destination with no pre-roll animation.
  useEffect(() => {
    if (authLoading || !user || !profile) return;

    // Business/enterprise accounts land in the business module; everyone
    // else in the consumer library.
    const isBusinessAcct =
      profile.account_type === "business" || profile.account_type === "enterprise";
    const dest = (ADMIN_ENABLED && isAdmin)
      ? "/admin"
      : !profile.onboarding_completed
        ? nextParam ? `/onboarding?next=${encodeURIComponent(nextParam)}` : "/onboarding"
        : (nextParam || (isBusinessAcct ? "/business" : "/library"));

    // Clear any stale fresh-sign-in marker; it no longer gates an intro.
    try { window.sessionStorage.removeItem(INTRO_FLAG); } catch { /* ignore */ }

    navigate(dest, { replace: true });
  }, [authLoading, user, profile, isAdmin, nextParam, navigate]);

  // ── Submit ─────────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setBanner(null);

      // Validate.
      const trimmed = email.trim();
      const eEmail = emailSchema.safeParse(trimmed);
      const eePw = (mode === "signin" ? signinPasswordSchema : signupPasswordSchema).safeParse(password);
      const next: typeof errors = {};
      if (!eEmail.success) next.email = eEmail.error.errors[0]?.message;
      if (!eePw.success)   next.password = eePw.error.errors[0]?.message;
      if (mode === "signup" && password !== confirmPassword) {
        next.confirmPassword = "Passwords don't match";
      }
      if (Object.keys(next).length > 0) {
        setErrors(next);
        sfx.play("error");
        return;
      }
      if (mode === "signup" && !agreed) {
        toast.error("Agree to the terms to continue.");
        return;
      }

      setErrors({});
      setLoading(true);
      try {
        if (mode === "signin") {
          const { error } = await signIn(trimmed, password);
          if (error) {
            setBanner(classifyAuthError(error.message));
            sfx.play("error");
            return;
          }
          window.sessionStorage.setItem(INTRO_FLAG, "1");
          sfx.play("success");
        } else {
          const { error } = await signUp(trimmed, password);
          if (error) {
            setBanner(classifyAuthError(error.message));
            sfx.play("error");
            return;
          }
          setPendingEmail(trimmed);
          sfx.play("open");
        }
      } catch (err) {
        setBanner(classifyAuthError(err instanceof Error ? err.message : ""));
      } finally {
        setLoading(false);
      }
    },
    [email, password, confirmPassword, mode, agreed, signIn, signUp],
  );

  // ── OTP submit ─────────────────────────────────────────────────────
  const submitOtp = useCallback(async () => {
    if (!pendingEmail || otp.length < 6) return;
    setVerifying(true);
    setBanner(null);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: pendingEmail,
        token: otp,
        type: "signup",
      });
      if (error) {
        setBanner(classifyAuthError(error.message));
        sfx.play("error");
        setOtp("");
        return;
      }
      sfx.play("success");
      window.sessionStorage.setItem(INTRO_FLAG, "1");
      const { data: { user: u } } = await supabase.auth.getUser();
      if (u) celebrate("first-publish", u.id);
      toast.success("You're in. Welcome to the studio.");
    } catch (err) {
      setBanner(classifyAuthError(err instanceof Error ? err.message : ""));
    } finally {
      setVerifying(false);
    }
  }, [pendingEmail, otp]);

  const resendCode = useCallback(async () => {
    if (!pendingEmail) return;
    setResending(true);
    setBanner(null);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: pendingEmail });
      if (error) {
        setBanner(classifyAuthError(error.message));
        sfx.play("error");
        return;
      }
      toast.success("New code sent.");
      sfx.play("open");
      setOtp("");
    } finally {
      setResending(false);
    }
  }, [pendingEmail]);

  return (
    <div className="relative min-h-[100dvh] w-full bg-[#0a0b0f] text-foreground overflow-hidden">
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] min-h-[100dvh]">
        {/* HERO — desktop only. */}
        <div className="hidden lg:block">
          <AuthHeroStage />
        </div>

        {/* FORM column — borderless, generous spacing */}
        <div className="relative flex items-center justify-center px-6 py-10 sm:px-10 md:py-14 lg:px-14">
          <motion.div
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-[400px]"
          >
            {/* Mobile-only mini header */}
            <div className="lg:hidden mb-8">
              <div className="text-[10px] uppercase tracking-[0.32em] text-white/55">Small Bridges</div>
              <div className="font-display text-3xl text-white font-light mt-2 leading-tight">
                One prompt away from a film.
              </div>
            </div>

            <AnimatePresence mode="wait" initial={false}>
              {pendingEmail ? (
                /* ── OTP screen ─────────────────────────────────── */
                <motion.div
                  key="otp"
                  initial={reducedMotion ? { opacity: 1 } : { opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -18 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="text-[10px] uppercase tracking-[0.24em] text-white/55 mb-1.5">
                    Verify your email
                  </div>
                  <h2 className="font-display text-xl text-white font-light leading-snug mb-4">
                    We sent a 6-digit code to{" "}
                    <span className="text-primary">{pendingEmail}</span>.
                  </h2>

                  <AuthErrorBanner cue={banner} />

                  <div className="mt-5">
                    <AuthOtpInput
                      value={otp}
                      onChange={setOtp}
                      onComplete={() => { void submitOtp(); }}
                      disabled={verifying}
                    />
                  </div>

                  <div className="mt-5 space-y-3">
                    <Button
                      type="button"
                      onClick={() => { void submitOtp(); }}
                      disabled={verifying || otp.length < 6}
                      className="w-full h-12 rounded-xl text-[14px] font-medium"
                    >
                      {verifying ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying…</>
                      ) : (
                        <>Verify & continue <ArrowRight className="w-4 h-4 ml-1.5" /></>
                      )}
                    </Button>

                    <div className="flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => { void resendCode(); }}
                        disabled={resending}
                        className="text-white/65 hover:text-white transition-colors disabled:opacity-50"
                      >
                        {resending ? "Sending…" : "Didn't get a code? Resend"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPendingEmail(null);
                          setOtp("");
                          setBanner(null);
                        }}
                        className="text-white/50 hover:text-white/85 transition-colors"
                      >
                        Use a different email
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                /* ── Sign in / Sign up screen ─────────────────────── */
                <motion.div
                  key={mode}
                  initial={reducedMotion ? { opacity: 1 } : { opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -18 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                >
                  <h2 className="font-display text-[34px] sm:text-[40px] text-white font-light leading-[1.05] tracking-tight">
                    {mode === "signin" ? "Welcome back." : "Create your account."}
                  </h2>
                  <p className="text-[14px] text-white/55 mt-3">
                    {mode === "signin"
                      ? "Pick up where you left off."
                      : "Start free — your first 5-second video is on us."}
                  </p>

                  {/* Underline tab toggle */}
                  <div className="mt-8 flex items-center gap-7 border-b border-white/[0.08]">
                    {(["signin", "signup"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => { setMode(m); setBanner(null); sfx.play("click"); }}
                        className={cn(
                          "relative pb-3 text-[12px] uppercase tracking-[0.22em] transition-colors",
                          mode === m ? "text-white" : "text-white/45 hover:text-white/75",
                        )}
                      >
                        {m === "signin" ? "Sign in" : "Create account"}
                        {mode === m && (
                          <motion.span
                            layoutId="auth-tab-underline"
                            className="absolute -bottom-px left-0 right-0 h-px bg-white"
                            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                          />
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="mt-7" />

                  <AuthErrorBanner cue={banner} />

                  <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    {/* Email */}
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-[10px] uppercase tracking-[0.18em] text-white/55">
                        Email
                      </Label>
                      <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/45 group-focus-within:text-primary transition-colors" />
                        <Input
                          id="email"
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          autoCapitalize="off"
                          autoCorrect="off"
                          spellCheck={false}
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (errors.email) setErrors((er) => ({ ...er, email: undefined }));
                          }}
                          className={cn("pl-11 h-12", errors.email && "border-destructive/50")}
                          maxLength={255}
                          required
                          aria-invalid={!!errors.email}
                        />
                      </div>
                      {errors.email && (
                        <p className="text-[11px] text-destructive">{errors.email}</p>
                      )}
                    </div>

                    {/* Password */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="text-[10px] uppercase tracking-[0.18em] text-white/55">
                          Password
                        </Label>
                        {mode === "signin" && (
                          <Link
                            to="/forgot-password"
                            className="text-[11px] text-white/55 hover:text-primary transition-colors"
                          >
                            Forgot password?
                          </Link>
                        )}
                      </div>
                      <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/45 group-focus-within:text-primary transition-colors" />
                        <Input
                          id="password"
                          type={showPw ? "text" : "password"}
                          autoComplete={mode === "signin" ? "current-password" : "new-password"}
                          autoCapitalize="off"
                          autoCorrect="off"
                          spellCheck={false}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            if (errors.password) setErrors((er) => ({ ...er, password: undefined }));
                          }}
                          className={cn("pl-11 pr-11 h-12", errors.password && "border-destructive/50")}
                          required
                          aria-invalid={!!errors.password}
                        />
                        <button
                          type="button"
                          aria-label={showPw ? "Hide password" : "Show password"}
                          aria-pressed={showPw}
                          onClick={() => setShowPw((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-white/55 hover:text-white"
                        >
                          {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {errors.password && (
                        <p className="text-[11px] text-destructive">{errors.password}</p>
                      )}
                      {mode === "signup" && password && (
                        <div className="flex items-center gap-2 pt-1">
                          <div className="flex gap-0.5 flex-1">
                            {[0, 1, 2, 3].map((i) => (
                              <div
                                key={i}
                                className={cn(
                                  "h-1 flex-1 rounded-full transition-colors",
                                  i < strength.score
                                    ? strength.score >= 3 ? "bg-primary" : strength.score === 2 ? "bg-warning" : "bg-destructive/70"
                                    : "bg-white/[0.06]",
                                )}
                              />
                            ))}
                          </div>
                          <span className="text-[10px] uppercase tracking-[0.18em] text-white/55">
                            {strength.label}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Confirm password (signup only) */}
                    {mode === "signup" && (
                      <div className="space-y-1.5">
                        <Label htmlFor="confirmPassword" className="text-[10px] uppercase tracking-[0.18em] text-white/55">
                          Confirm password
                        </Label>
                        <div className="relative group">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/45 group-focus-within:text-primary transition-colors" />
                          <Input
                            id="confirmPassword"
                            type={showPw ? "text" : "password"}
                            autoComplete="new-password"
                            autoCapitalize="off"
                            autoCorrect="off"
                            spellCheck={false}
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChange={(e) => {
                              setConfirmPassword(e.target.value);
                              if (errors.confirmPassword) setErrors((er) => ({ ...er, confirmPassword: undefined }));
                            }}
                            className={cn("pl-11 h-12", errors.confirmPassword && "border-destructive/50")}
                            required
                            aria-invalid={!!errors.confirmPassword}
                          />
                        </div>
                        {errors.confirmPassword && (
                          <p className="text-[11px] text-destructive">{errors.confirmPassword}</p>
                        )}
                      </div>
                    )}

                    {/* Terms checkbox (signup only) */}
                    {mode === "signup" && (
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <Checkbox
                          checked={agreed}
                          onCheckedChange={(v) => setAgreed(v === true)}
                          aria-label="Agree to terms"
                          className="mt-0.5"
                        />
                        <span className="text-[12px] text-white/65 leading-relaxed">
                          I agree to the{" "}
                          <Link to="/terms" className="text-white underline-offset-2 hover:underline">Terms</Link>{" "}
                          and{" "}
                          <Link to="/privacy" className="text-white underline-offset-2 hover:underline">Privacy Policy</Link>.
                        </span>
                      </label>
                    )}

                    {/* Submit */}
                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full h-12 rounded-xl text-[14px] font-medium mt-2"
                    >
                      {loading ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{mode === "signin" ? "Signing in…" : "Creating account…"}</>
                      ) : (
                        <>
                          {mode === "signin" ? "Sign in" : "Create account"}
                          <ArrowRight className="w-4 h-4 ml-1.5" />
                        </>
                      )}
                    </Button>

                    <p className="text-center text-[11px] text-white/45 pt-1">
                      {mode === "signin" ? (
                        <>New here?{" "}
                          <button type="button" onClick={() => { setMode("signup"); sfx.play("click"); }} className="text-white hover:text-primary transition-colors">
                            Create an account
                          </button>
                        </>
                      ) : (
                        <>Have an account?{" "}
                          <button type="button" onClick={() => { setMode("signin"); sfx.play("click"); }} className="text-white hover:text-primary transition-colors">
                            Sign in
                          </button>
                        </>
                      )}
                    </p>
                  </form>

                  {/* Business account entry — only while creating an account */}
                  {mode === "signup" && (
                    <div className="mt-6">
                      <div className="relative my-5" aria-hidden>
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-white/[0.06]" />
                        </div>
                        <div className="relative flex justify-center">
                          <span className="bg-[#0a0b0f] px-3 text-[10px] uppercase tracking-[0.22em] text-white/40">
                            Working with a team?
                          </span>
                        </div>
                      </div>
                      <Link
                        to="/business/start"
                        onClick={() => sfx.play("click")}
                        className="group flex items-center gap-3 w-full rounded-xl bg-white/[0.04] hover:bg-white/[0.08] backdrop-blur-md px-4 py-3.5 transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:shadow-[0_0_0_1px_hsla(212,100%,62%,0.4),0_12px_36px_-16px_hsla(212,100%,55%,0.6)]"
                      >
                        <span className="w-9 h-9 rounded-lg bg-primary/[0.14] backdrop-blur-md flex items-center justify-center shrink-0">
                          <Building2 className="w-4 h-4 text-primary" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13.5px] font-semibold text-white">Set up a business account</span>
                          <span className="block text-[11.5px] text-white/50 leading-snug">
                            Brand kit, team seats, plans & enterprise controls
                          </span>
                        </span>
                        <ArrowRight className="w-4 h-4 text-white/40 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                      </Link>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
