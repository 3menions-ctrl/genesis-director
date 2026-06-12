/**
 * Auth — /auth
 *
 * The Director's entry hall. Two-pane on desktop (cinematic hero left,
 * focused form right), single-column on mobile with the hero collapsed
 * to a heading. Surfaces real Supabase errors with direct one-tap
 * remediation links. Apple / Google OAuth front and center.
 *
 * Flows handled:
 *   - Sign in (email + password)
 *   - Create account (email + password + agree-to-terms + strength meter)
 *   - OTP verification after signup (six-cell code, paste-friendly)
 *   - OAuth (Apple, Google) via existing OAuthProviders component
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
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { useSafeNavigation } from "@/lib/navigation";
import { usePageMeta } from "@/hooks/usePageMeta";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { OAuthProviders } from "@/components/auth/OAuthProviders";
import { AuthHeroStage } from "@/components/auth/AuthHeroStage";
import { AuthOtpInput } from "@/components/auth/AuthOtpInput";
import { AuthErrorBanner, classifyAuthError, type AuthErrorCue } from "@/components/auth/AuthErrorBanner";
import { AutoSectionAurora } from "@/components/studio/AutoSectionAurora";
import { sfx } from "@/lib/sound";
import { celebrate } from "@/lib/celebrate";

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

  // ── Auto-redirect after sign in ─────────────────────────────────────
  useEffect(() => {
    if (authLoading || !user || !profile) return;
    if (isAdmin) {
      navigate("/admin", { replace: true });
      return;
    }
    if (!profile.onboarding_completed) {
      const target = nextParam ? `/onboarding?next=${encodeURIComponent(nextParam)}` : "/onboarding";
      navigate(target, { replace: true });
      return;
    }
    navigate(nextParam || "/projects", { replace: true });
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
    <div className="relative min-h-[100dvh] w-full bg-background text-foreground overflow-hidden">
      {/* Backdrop — aurora + a soft top vignette */}
      <AutoSectionAurora intensity="subtle" />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(80vmax 40vmax at 50% -10%, hsla(215, 100%, 60%, 0.15), transparent 60%)",
        }}
      />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] min-h-[100dvh]">
        {/* HERO — desktop only. */}
        <div className="hidden lg:block">
          <AuthHeroStage />
        </div>

        {/* FORM column */}
        <div className="relative flex items-center justify-center px-6 py-10 md:py-14">
          <motion.div
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "relative w-full max-w-md rounded-3xl overflow-hidden",
              "border border-white/[0.08] bg-white/[0.025] backdrop-blur-2xl",
              "shadow-[0_30px_90px_-20px_rgba(0,0,0,0.7),0_0_0_1px_hsla(0,0%,100%,0.04)_inset]",
              "p-7 sm:p-8",
            )}
          >
            {/* Mobile-only mini header */}
            <div className="lg:hidden mb-6">
              <div className="text-[10px] uppercase tracking-[0.24em] text-white/55">Small Bridges</div>
              <div className="font-display text-2xl text-white font-light mt-1 leading-tight">
                Step onto the set.
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
                  {/* Tab toggle */}
                  <div className="inline-flex p-1 rounded-full border border-white/[0.08] bg-white/[0.02] mb-6">
                    <button
                      type="button"
                      onClick={() => { setMode("signin"); setBanner(null); sfx.play("click"); }}
                      className={cn(
                        "px-4 py-1.5 rounded-full text-[12px] uppercase tracking-[0.16em] transition-colors",
                        mode === "signin"
                          ? "bg-white text-black"
                          : "text-white/65 hover:text-white",
                      )}
                    >
                      Sign in
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMode("signup"); setBanner(null); sfx.play("click"); }}
                      className={cn(
                        "px-4 py-1.5 rounded-full text-[12px] uppercase tracking-[0.16em] transition-colors",
                        mode === "signup"
                          ? "bg-white text-black"
                          : "text-white/65 hover:text-white",
                      )}
                    >
                      Create account
                    </button>
                  </div>

                  <h2 className="font-display text-2xl text-white font-light leading-snug">
                    {mode === "signin"
                      ? "Welcome back, Director."
                      : "Get a director's chair."}
                  </h2>
                  <p className="text-sm text-white/55 mt-1.5">
                    {mode === "signin"
                      ? "Pick up where you left off."
                      : "Free during beta. 100 starter credits when you confirm."}
                  </p>

                  {/* OAuth row */}
                  <div className="mt-6">
                    <OAuthProviders next={nextParam} />
                  </div>

                  <div className="relative my-5" aria-hidden>
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-white/[0.08]" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-background/0 px-3 text-[10px] uppercase tracking-[0.18em] text-white/45">
                        or with email
                      </span>
                    </div>
                  </div>

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
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
