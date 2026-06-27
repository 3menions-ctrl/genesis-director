/**
 * BusinessStart — /business/start
 *
 * The dedicated, advanced onboarding for BUSINESS accounts. Reached from the
 * "Set up a business account" entry beneath the sign-up form on /auth.
 *
 * This is intentionally a separate, more mature flow than the personal sign-up
 * (which is just email → verify → studio). A business account provisions an
 * organization, a brand kit, a plan tier, enterprise capability requests, and
 * optional team invites — so we collect that deliberately, one cinematic
 * chapter at a time, with a live workspace preview that assembles as you go.
 *
 * Chapters:
 *   1. vision    — primary objective (drives the workspace defaults + plan)
 *   2. company   — company name, WORK email (free domains rejected), site, industry
 *   3. scale     — team size, your role, monthly volume, current tools
 *   4. brand     — brand voice + brand colors (live preview, lands on the org)
 *   5. account   — display name, password, enterprise toggles, team invites
 *   6. verify    — 6-digit email code
 *   7. provision — cinematic "building your workspace" while we consume the
 *                  intent, write the brand kit onto the organization, fire
 *                  invites, then drop into /business.
 *
 * Data contract (matches the live DB):
 *   - onboarding_intents row (account_type='business', contact/billing email,
 *     company/industry/team/role, expected_volume + monthly_volume, brand
 *     colors/voice, current_tools, needs_sso/sla/api, invited_emails).
 *   - supabase.auth.signUp → verifyOtp(type:'signup').
 *   - rpc consume_onboarding_intent → sets profiles.account_type='business' and
 *     creates the organization (name + plan only).
 *   - follow-up UPDATE organizations with the full brand kit + firmographics
 *     (create_org_for_user does NOT copy those), then organization_invites.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { z } from "zod";
import {
  ArrowRight, ArrowLeft, X, Check, Building2, Mail, Globe, Lock, Eye, EyeOff,
  Target, Megaphone, Package, Briefcase, GraduationCap, Users, ShieldCheck,
  Plug, FileBadge, Sparkles, Plus, Loader2,
} from "lucide-react";
import { useSafeNavigation } from "@/lib/navigation";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";
import { AuthOtpInput } from "@/components/auth/AuthOtpInput";
import { usePageMeta } from "@/hooks/usePageMeta";
import heroEnterprise from "@/assets/onboarding/hero-enterprise.jpg";

/* ── Free-email domains (mirror of public.blocked_email_domains) ─────────── */
const FREE_EMAIL_DOMAINS = new Set([
  "aol.com", "fastmail.com", "gmail.com", "gmx.com", "gmx.net", "googlemail.com",
  "hotmail.co.uk", "hotmail.com", "icloud.com", "live.com", "mac.com", "mail.com",
  "me.com", "msn.com", "outlook.com", "pm.me", "proton.me", "protonmail.com",
  "tutanota.com", "yahoo.co.uk", "yahoo.com", "yandex.com", "ymail.com", "zoho.com",
]);
const isWorkEmail = (email: string) => {
  const domain = email.trim().toLowerCase().split("@")[1] || "";
  return domain.length > 0 && domain.includes(".") && !FREE_EMAIL_DOMAINS.has(domain);
};

/* ── Step definitions ───────────────────────────────────────────────────── */
type StepKey = "vision" | "company" | "scale" | "brand" | "account" | "verify" | "provision";
const STEPS: StepKey[] = ["vision", "company", "scale", "brand", "account", "verify", "provision"];

const META: Record<StepKey, { chapter: string; question: string; whisper: string }> = {
  vision: {
    chapter: "Chapter 01 · Vision",
    question: "What will your\nteam create?",
    whisper: "Your objective tunes the studio defaults, the templates we surface, and the plan we recommend.",
  },
  company: {
    chapter: "Chapter 02 · Company",
    question: "Tell us about\nthe organization.",
    whisper: "Business workspaces are provisioned per company. Use your work email — shared inboxes and free providers aren't supported.",
  },
  scale: {
    chapter: "Chapter 03 · Scale",
    question: "How big is\nthe operation?",
    whisper: "This sizes your plan, seat defaults, and rendering throughput.",
  },
  brand: {
    chapter: "Chapter 04 · Brand",
    question: "Lock in\nyour brand.",
    whisper: "Voice and colors are written to every render, template, and avatar your team produces.",
  },
  account: {
    chapter: "Chapter 05 · Access",
    question: "Secure the\nworkspace.",
    whisper: "Create your owner login, flag the enterprise controls you need, and invite the first producers.",
  },
  verify: {
    chapter: "Chapter 06 · Verify",
    question: "Confirm\nyour email.",
    whisper: "We sent a six-digit code to your work address.",
  },
  provision: {
    chapter: "Final · Provisioning",
    question: "Building your\nworkspace.",
    whisper: "Spinning up your organization, brand kit, and team seats.",
  },
};

const OBJECTIVES = [
  { id: "performance-ads", label: "Performance ads", desc: "High-volume ad variants that convert", Icon: Target, volume: "high" },
  { id: "brand-social", label: "Brand & social", desc: "On-brand content at channel cadence", Icon: Megaphone, volume: "medium" },
  { id: "product-lifecycle", label: "Product & lifecycle", desc: "Launches, demos, onboarding clips", Icon: Package, volume: "medium" },
  { id: "sales-enablement", label: "Sales & enablement", desc: "Personalized outreach and decks", Icon: Briefcase, volume: "high" },
  { id: "training-internal", label: "Training & internal", desc: "Courses, comms, knowledge base", Icon: GraduationCap, volume: "low" },
] as const;

const INDUSTRIES = [
  "E-commerce & retail", "SaaS & technology", "Media & entertainment", "Agency & marketing",
  "Finance & insurance", "Healthcare & wellness", "Education", "Real estate",
  "Travel & hospitality", "Gaming", "Nonprofit", "Other",
];

const TEAM_SIZES = [
  { id: "solo", label: "Just me" }, { id: "2-10", label: "2–10" },
  { id: "11-50", label: "11–50" }, { id: "51-200", label: "51–200" },
  { id: "200+", label: "200+" },
];
const ROLES = [
  { id: "founder", label: "Founder / Exec" }, { id: "marketing", label: "Marketing" },
  { id: "creative", label: "Creative / Brand" }, { id: "growth", label: "Growth / Performance" },
  { id: "product", label: "Product" }, { id: "ops", label: "Ops / Enablement" },
];
const VOLUMES = [
  { id: "low", label: "Under 20 / mo", expected: "low" },
  { id: "medium", label: "20–100 / mo", expected: "medium" },
  { id: "high", label: "100–500 / mo", expected: "high" },
  { id: "very_high", label: "500+ / mo", expected: "very_high" },
];
const TOOLS = [
  "Runway", "Synthesia", "HeyGen", "CapCut", "Adobe Premiere", "Canva",
  "Sora", "Pika", "Descript", "In-house", "None yet",
];
const VOICES = [
  { id: "bold", label: "Bold & punchy", desc: "Short, high-energy, hook-first" },
  { id: "polished", label: "Polished & premium", desc: "Cinematic, considered, elevated" },
  { id: "friendly", label: "Friendly & human", desc: "Warm, conversational, approachable" },
  { id: "authoritative", label: "Authoritative", desc: "Expert, precise, trustworthy" },
];
const BRAND_PRESETS = [
  { primary: "#0A84FF", accent: "#5AC8FA" },
  { primary: "#7C3AED", accent: "#EC4899" },
  { primary: "#10B981", accent: "#A7F3D0" },
  { primary: "#F59E0B", accent: "#EF4444" },
  { primary: "#F43F5E", accent: "#FB923C" },
  { primary: "#E5E7EB", accent: "#9CA3AF" },
];

/* ── Validation ─────────────────────────────────────────────────────────── */
const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Password is too long")
  .refine((v) => /[A-Z]/.test(v) && /[a-z]/.test(v) && /\d/.test(v), "Mix upper, lower, and a number");
const emailSchema = z.string().trim().email("That doesn't look like a valid email").max(255);

interface Form {
  objective: string;
  company_name: string;
  work_email: string;
  website: string;
  industry: string;
  team_size: string;
  job_role: string;
  volume: string;
  tools: string[];
  brand_voice: string;
  brand_primary: string;
  brand_accent: string;
  display_name: string;
  password: string;
  needs_sso: boolean;
  needs_sla: boolean;
  needs_api: boolean;
  invited_emails: string[];
}
const EMPTY: Form = {
  objective: "", company_name: "", work_email: "", website: "", industry: "",
  team_size: "", job_role: "", volume: "", tools: [], brand_voice: "",
  brand_primary: "#0A84FF", brand_accent: "#5AC8FA", display_name: "", password: "",
  needs_sso: false, needs_sla: false, needs_api: false, invited_emails: [],
};

export default function BusinessStart() {
  usePageMeta({
    title: "Business workspace — Small Bridges",
    description: "Provision a Small Bridges studio for your team: brand kit, seats, plan, and enterprise controls.",
  });

  const { user, signUp, signIn, refreshProfile } = useAuth();
  const { navigate } = useSafeNavigation();

  const [stepIdx, setStepIdx] = useState(0);
  const [direction, setDirection] = useState(1);
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [otp, setOtp] = useState("");
  const [inviteDraft, setInviteDraft] = useState("");
  const intentToken = useRef<string | null>(null);

  const currentStep = STEPS[stepIdx];
  const meta = META[currentStep];
  const set = useCallback(<K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => (e[k as string] ? { ...e, [k as string]: "" } : e));
  }, []);

  // Recommended plan tier — same logic the consume RPC uses, surfaced live.
  const plan = useMemo(() => {
    if (form.needs_sso || form.needs_sla) return { id: "enterprise", label: "Enterprise" };
    if (form.volume === "high" || form.volume === "very_high") return { id: "scale", label: "Scale" };
    return { id: "growth", label: "Growth" };
  }, [form.needs_sso, form.needs_sla, form.volume]);

  /* ── Per-step validation ──────────────────────────────────────────────── */
  const validate = useCallback((): boolean => {
    const e: Record<string, string> = {};
    if (currentStep === "vision" && !form.objective) e.objective = "Pick one to continue";
    if (currentStep === "company") {
      if (!form.company_name.trim()) e.company_name = "Enter your company name";
      const em = emailSchema.safeParse(form.work_email);
      if (!em.success) e.work_email = em.error.errors[0].message;
      else if (!isWorkEmail(form.work_email)) e.work_email = "Use your work email — free providers (gmail, outlook…) aren't supported for business workspaces";
      if (!form.industry) e.industry = "Select an industry";
    }
    if (currentStep === "scale") {
      if (!form.team_size) e.team_size = "Select a team size";
      if (!form.job_role) e.job_role = "Select your role";
      if (!form.volume) e.volume = "Select your monthly volume";
    }
    if (currentStep === "brand" && !form.brand_voice) e.brand_voice = "Pick a brand voice";
    if (currentStep === "account") {
      if (!form.display_name.trim()) e.display_name = "Enter your name";
      const pw = passwordSchema.safeParse(form.password);
      if (!pw.success) e.password = pw.error.errors[0].message;
    }
    if (currentStep === "verify" && (otp.length < 6 || otp.length > 8)) e.otp = "Enter the 6-digit code from your email";
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [currentStep, form, otp]);

  /* ── Persistence ──────────────────────────────────────────────────────── */
  const ensureIntent = useCallback(async (): Promise<string | null> => {
    if (intentToken.current) return intentToken.current;
    const token = `int_${crypto.randomUUID()}`;
    const expected = VOLUMES.find((v) => v.id === form.volume)?.expected ?? form.volume ?? null;
    const payload = {
      intent_token: token,
      account_type: "business",
      company_name: form.company_name.trim() || null,
      contact_email: form.work_email.trim() || null,
      billing_email: form.work_email.trim() || null,
      industry: form.industry || null,
      team_size: form.team_size || null,
      job_role: form.job_role || null,
      primary_use_case: form.objective || null,
      expected_volume: expected,
      monthly_volume: form.volume || null,
      brand_voice: form.brand_voice || null,
      brand_colors: [form.brand_primary, form.brand_accent],
      current_tools: form.tools.length ? form.tools : null,
      needs_sso: form.needs_sso,
      needs_sla: form.needs_sla,
      needs_api: form.needs_api,
      display_name: form.display_name.trim() || null,
      invited_emails: form.invited_emails.length ? form.invited_emails : null,
    };
    const { error } = await supabase.from("onboarding_intents").insert(payload);
    if (error) {
      console.error("[business-start] intent persist", error);
      toast.error("Could not save your details. Please try again.");
      return null;
    }
    try { sessionStorage.setItem("smallbridges.intent_token", token); } catch {}
    intentToken.current = token;
    return token;
  }, [form]);

  // After auth: consume intent (sets account_type=business + creates org), then
  // write the full brand kit / firmographics onto the org and fire invites.
  const provisionWorkspace = useCallback(async (): Promise<string | null> => {
    const token = intentToken.current;
    if (!token) return null;
    let orgId: string | null = null;
    try {
      const { data } = await supabase.rpc("consume_onboarding_intent", { p_intent_token: token });
      const r = data as { success?: boolean; organization_id?: string; error?: string } | null;
      if (!r?.success) {
        console.warn("[business-start] consume failed", r?.error);
        if (r?.error) toast.error(r.error);
      }
      orgId = r?.organization_id ?? null;
    } catch (e) {
      console.warn("[business-start] consume threw", e);
    }

    // create_org_for_user only sets name+slug+plan — backfill the rest.
    const { data: { user: authedUser } } = await supabase.auth.getUser();
    if (!orgId && authedUser) {
      const { data: orgs } = await supabase
        .from("organizations").select("id")
        .eq("created_by", authedUser.id)
        .order("created_at", { ascending: true })
        .limit(1);
      orgId = orgs?.[0]?.id ?? null;
    }
    if (orgId) {
      try {
        await supabase.from("organizations").update({
          industry: form.industry || null,
          website: form.website.trim() || null,
          team_size: form.team_size || null,
          brand_primary_color: form.brand_primary,
          brand_accent_color: form.brand_accent,
          brand_colors: [form.brand_primary, form.brand_accent],
          brand_voice: form.brand_voice || null,
          primary_use_case: form.objective || null,
          monthly_volume: form.volume || null,
          billing_email: form.work_email.trim() || null,
          plan: plan.id,
          onboarding_completed: true,
          onboarded_at: new Date().toISOString(),
        }).eq("id", orgId);
      } catch (e) {
        console.warn("[business-start] org backfill", e);
      }
      // Team invites (best-effort).
      if (form.invited_emails.length && authedUser) {
        try {
          const rows = form.invited_emails.map((email) => ({
            organization_id: orgId!, email, role: "producer" as const,
            invited_by: authedUser.id, token: `inv_${crypto.randomUUID()}`,
            expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          }));
          await supabase.from("organization_invites").insert(rows);
        } catch (e) {
          console.warn("[business-start] invites", e);
        }
      }
    }
    try { sessionStorage.removeItem("smallbridges.intent_token"); } catch {}
    await refreshProfile();
    return orgId;
  }, [form, plan.id, refreshProfile]);

  /* ── Navigation ───────────────────────────────────────────────────────── */
  const goTo = (idx: number, dir: number) => { setDirection(dir); setStepIdx(idx); };

  const advance = async () => {
    if (!validate()) return;

    if (currentStep === "account") {
      // Persist intent, create the owner account, move to email verification.
      setSubmitting(true);
      try {
        const token = await ensureIntent();
        if (!token) return;
        if (user) {
          // Already authenticated (rare) — straight to provisioning.
          goTo(STEPS.indexOf("provision"), 1);
          void runProvision();
          return;
        }
        const { error } = await signUp(form.work_email.trim(), form.password);
        if (error) {
          if (/already.*registered/i.test(error.message)) {
            const { error: si } = await signIn(form.work_email.trim(), form.password);
            if (si) { toast.error("That email is already registered — wrong password?"); return; }
            goTo(STEPS.indexOf("provision"), 1);
            void runProvision();
            return;
          }
          toast.error(error.message || "Could not create your account.");
          return;
        }
        toast.success("Check your inbox — we sent a 6-digit code.");
        goTo(STEPS.indexOf("verify"), 1);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (currentStep === "verify") {
      setSubmitting(true);
      try {
        const { error } = await supabase.auth.verifyOtp({
          email: form.work_email.trim(), token: otp, type: "signup",
        });
        if (error) { toast.error(error.message || "Invalid code."); return; }
        toast.success("Email verified.");
        goTo(STEPS.indexOf("provision"), 1);
        void runProvision();
      } finally {
        setSubmitting(false);
      }
      return;
    }

    goTo(stepIdx + 1, 1);
  };

  // The provision step runs its work then routes into the business module.
  const runProvision = useCallback(async () => {
    // Only enter the business module if a workspace was actually provisioned
    // (audit S15) — provisionWorkspace swallows its errors, so the old
    // unconditional navigate landed the user in an org-less /business on
    // failure. On failure, surface it so they can retry instead.
    const orgId = await provisionWorkspace();
    if (orgId) {
      navigate("/business", { replace: true });
    } else {
      toast.error("We couldn't finish setting up your workspace. Please try again.");
    }
  }, [provisionWorkspace, navigate]);

  const back = () => {
    if (stepIdx === 0) { navigate("/auth?mode=signup"); return; }
    if (currentStep === "provision") return;
    goTo(stepIdx - 1, -1);
  };

  const resend = async () => {
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: form.work_email.trim() });
      if (error) toast.error(safeErrorMessage(error, "Couldn't resend the code. Please try again.")); else toast.success("New code sent.");
    } catch { toast.error("Could not resend the code."); }
  };

  const addInvite = () => {
    const email = inviteDraft.trim().toLowerCase();
    if (!email) return;
    if (!emailSchema.safeParse(email).success) { toast.error("That's not a valid email."); return; }
    if (form.invited_emails.includes(email)) { setInviteDraft(""); return; }
    set("invited_emails", [...form.invited_emails, email]);
    setInviteDraft("");
  };

  const isProvision = currentStep === "provision";

  /* ── Render ───────────────────────────────────────────────────────────── */
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[hsl(220,16%,2.5%)] text-white">
      <Backdrop primary={form.brand_primary} accent={form.brand_accent} stepKey={currentStep} />

      {/* Top bar */}
      <header className="relative z-30 flex items-center justify-between px-6 md:px-10 pt-6">
        <Logo size="md" showText textClassName="text-base font-bold tracking-tight" />
        <button
          onClick={() => navigate("/")}
          aria-label="Close"
          className="w-9 h-9 inline-flex items-center justify-center rounded-full text-white/65 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] backdrop-blur-md transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      <div className="relative z-30 mx-auto grid max-w-6xl grid-cols-1 lg:grid-cols-[1fr_320px] gap-10 px-6 pt-8 pb-40">
        {/* ── Main column ──────────────────────────────────────────── */}
        <div className="min-w-0">
          {/* Chapter + progress */}
          <div className="max-w-2xl">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] tracking-[0.32em] uppercase text-[hsla(212,100%,70%,0.85)] font-medium">{meta.chapter}</p>
              <p className="text-[10px] tracking-[0.32em] uppercase text-white/40 font-medium">
                {String(Math.min(stepIdx + 1, STEPS.length)).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {STEPS.map((s, i) => (
                <div key={s} className="relative flex-1 h-[2px] rounded-full overflow-hidden bg-glass-active">
                  <motion.div
                    className="h-full origin-left"
                    style={{ background: i <= stepIdx ? `linear-gradient(90deg, ${form.brand_primary}, ${form.brand_accent})` : "transparent" }}
                    initial={false}
                    animate={{ scaleX: i <= stepIdx ? 1 : 0 }}
                    transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Question */}
          <div className="mt-9 max-w-2xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={`q-${currentStep}`}
                initial={{ opacity: 0, y: 16, filter: "blur(10px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -10, filter: "blur(8px)" }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              >
                <h1 className="font-display text-[40px] md:text-[60px] leading-[0.96] tracking-[-0.035em] font-light whitespace-pre-line">
                  {meta.question}
                </h1>
                <p className="mt-4 text-[14px] md:text-[15px] text-white/55 max-w-xl leading-relaxed">{meta.whisper}</p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Step content */}
          <main className="mt-10">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={`step-${currentStep}`}
                custom={direction}
                initial={{ opacity: 0, x: direction > 0 ? 40 : -40, filter: "blur(8px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, x: direction > 0 ? -40 : 40, filter: "blur(8px)" }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* VISION */}
                {currentStep === "vision" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
                    {OBJECTIVES.map(({ id, label, desc, Icon }, i) => {
                      const active = form.objective === id;
                      return (
                        <motion.button
                          key={id}
                          onClick={() => set("objective", id)}
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, delay: 0.04 + i * 0.05 }}
                          whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }}
                          className={cn(
                            "group relative min-h-[120px] p-5 rounded-2xl text-left flex flex-col gap-2.5 overflow-hidden backdrop-blur-xl transition-all",
                            active
                              ? "bg-primary/[0.16] shadow-[0_0_0_1px_hsla(212,100%,62%,0.5),0_18px_50px_-16px_hsla(212,100%,55%,0.75)]"
                              : "bg-white/[0.04] hover:bg-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
                          )}
                        >
                          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center backdrop-blur-md", active ? "bg-primary/[0.22]" : "bg-white/[0.06]")}>
                            <Icon className="w-5 h-5 text-[hsla(212,100%,72%,0.95)]" />
                          </div>
                          <p className="text-[15px] font-semibold text-white">{label}</p>
                          <p className="text-[12px] text-white/55 leading-snug">{desc}</p>
                          {active && <CheckDot />}
                        </motion.button>
                      );
                    })}
                  </div>
                )}

                {/* COMPANY */}
                {currentStep === "company" && (
                  <div className="space-y-6 max-w-xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field label="Company name" error={errors.company_name}>
                        <IconInput Icon={Building2} autoFocus placeholder="Acme Studios"
                          value={form.company_name} onChange={(v) => set("company_name", v)} />
                      </Field>
                      <Field label="Industry" error={errors.industry}>
                        <div className="relative">
                          <select
                            value={form.industry} onChange={(e) => set("industry", e.target.value)}
                            className={cn(inputCls, "appearance-none pr-9", !form.industry && "text-white/40")}
                          >
                            <option value="" disabled>Select…</option>
                            {INDUSTRIES.map((ind) => <option key={ind} value={ind} className="bg-[#0c0e14] text-white">{ind}</option>)}
                          </select>
                          <ArrowRight className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rotate-90 w-3.5 h-3.5 text-white/40" />
                        </div>
                      </Field>
                    </div>
                    <Field label="Work email" error={errors.work_email}>
                      <IconInput Icon={Mail} type="email" placeholder="you@company.com"
                        value={form.work_email} onChange={(v) => set("work_email", v)} />
                    </Field>
                    <Field label="Website (optional)">
                      <IconInput Icon={Globe} placeholder="company.com"
                        value={form.website} onChange={(v) => set("website", v)} />
                    </Field>
                  </div>
                )}

                {/* SCALE */}
                {currentStep === "scale" && (
                  <div className="space-y-8 max-w-2xl">
                    <Block label="Team size" error={errors.team_size}>
                      <Pills options={TEAM_SIZES} selected={form.team_size} onSelect={(v) => set("team_size", v)} />
                    </Block>
                    <Block label="Your role" error={errors.job_role}>
                      <Pills options={ROLES} selected={form.job_role} onSelect={(v) => set("job_role", v)} />
                    </Block>
                    <Block label="Monthly video volume" error={errors.volume}>
                      <Pills options={VOLUMES} selected={form.volume} onSelect={(v) => set("volume", v)} />
                    </Block>
                    <Block label="Tools you use today (optional)">
                      <Pills multi options={TOOLS.map((t) => ({ id: t, label: t }))} selectedMulti={form.tools}
                        onToggle={(id) => set("tools", form.tools.includes(id) ? form.tools.filter((t) => t !== id) : [...form.tools, id])} />
                    </Block>
                  </div>
                )}

                {/* BRAND */}
                {currentStep === "brand" && (
                  <div className="space-y-8 max-w-2xl">
                    <Block label="Brand voice" error={errors.brand_voice}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {VOICES.map(({ id, label, desc }) => {
                          const active = form.brand_voice === id;
                          return (
                            <button key={id} onClick={() => set("brand_voice", id)}
                              className={cn("relative p-4 rounded-2xl text-left backdrop-blur-xl transition-all",
                                active
                                  ? "bg-primary/[0.16] shadow-[0_0_0_1px_hsla(212,100%,62%,0.5),0_16px_44px_-18px_hsla(212,100%,55%,0.7)]"
                                  : "bg-white/[0.04] hover:bg-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]")}>
                              <p className="text-[14px] font-semibold">{label}</p>
                              <p className="text-[12px] text-white/55 mt-1">{desc}</p>
                              {active && <CheckDot />}
                            </button>
                          );
                        })}
                      </div>
                    </Block>
                    <Block label="Brand colors" hint="Applied to renders, templates & avatars">
                      <div className="flex flex-wrap items-center gap-3">
                        {BRAND_PRESETS.map((p) => {
                          const active = form.brand_primary === p.primary && form.brand_accent === p.accent;
                          return (
                            <button key={p.primary}
                              onClick={() => { set("brand_primary", p.primary); set("brand_accent", p.accent); }}
                              className={cn("h-12 w-12 rounded-xl overflow-hidden transition-all", active ? "scale-110 shadow-[0_0_0_2px_rgba(255,255,255,0.9),0_10px_30px_-8px_rgba(0,0,0,0.6)]" : "opacity-80 hover:opacity-100 hover:scale-105")}
                              style={{ background: `linear-gradient(135deg, ${p.primary}, ${p.accent})` }}
                              aria-label="brand color preset"
                            />
                          );
                        })}
                        <div className="flex items-center gap-2 ml-1">
                          <ColorPick label="Primary" value={form.brand_primary} onChange={(v) => set("brand_primary", v)} />
                          <ColorPick label="Accent" value={form.brand_accent} onChange={(v) => set("brand_accent", v)} />
                        </div>
                      </div>
                    </Block>
                  </div>
                )}

                {/* ACCOUNT */}
                {currentStep === "account" && (
                  <div className="space-y-8 max-w-xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field label="Your name" error={errors.display_name}>
                        <IconInput Icon={Users} autoFocus placeholder="Jordan Lee"
                          value={form.display_name} onChange={(v) => set("display_name", v)} />
                      </Field>
                      <Field label="Work email">
                        <IconInput Icon={Mail} value={form.work_email} onChange={() => {}} disabled />
                      </Field>
                    </div>
                    <Field label="Create password" error={errors.password}>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/45" />
                        <input
                          type={showPw ? "text" : "password"} placeholder="At least 8 characters"
                          value={form.password} onChange={(e) => set("password", e.target.value)}
                          className={cn(inputCls, "pl-10 pr-11")}
                        />
                        <button type="button" onClick={() => setShowPw((s) => !s)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/45 hover:text-white">
                          {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </Field>

                    <Block label="Enterprise controls (optional)" hint="We'll provision or reach out">
                      <div className="space-y-2.5">
                        <Toggle Icon={ShieldCheck} label="SAML / SSO" desc="Single sign-on for your domain"
                          on={form.needs_sso} onChange={(v) => set("needs_sso", v)} />
                        <Toggle Icon={FileBadge} label="SLA & priority support" desc="Uptime guarantee + dedicated CSM"
                          on={form.needs_sla} onChange={(v) => set("needs_sla", v)} />
                        <Toggle Icon={Plug} label="API & webhooks" desc="Programmatic rendering access"
                          on={form.needs_api} onChange={(v) => set("needs_api", v)} />
                      </div>
                    </Block>

                    <Block label="Invite your team (optional)" hint={`${form.invited_emails.length} pending`}>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/45" />
                          <input
                            type="email" placeholder="producer@company.com" value={inviteDraft}
                            onChange={(e) => setInviteDraft(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addInvite(); } }}
                            className={cn(inputCls, "pl-10")}
                          />
                        </div>
                        <button onClick={addInvite}
                          className="h-12 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] backdrop-blur-md inline-flex items-center gap-1.5 text-sm transition-all">
                          <Plus className="w-4 h-4" /> Add
                        </button>
                      </div>
                      {form.invited_emails.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {form.invited_emails.map((em) => (
                            <span key={em} className="inline-flex items-center gap-1.5 h-8 pl-3 pr-2 rounded-full bg-primary/[0.16] backdrop-blur-md text-[12.5px] shadow-[0_0_0_1px_hsla(212,100%,62%,0.35)]">
                              {em}
                              <button onClick={() => set("invited_emails", form.invited_emails.filter((x) => x !== em))}
                                className="w-5 h-5 rounded-full hover:bg-white/10 inline-flex items-center justify-center">
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </Block>
                  </div>
                )}

                {/* VERIFY */}
                {currentStep === "verify" && (
                  <div className="max-w-md space-y-6">
                    <p className="text-[13px] text-white/60">
                      Code sent to <span className="text-white font-medium">{form.work_email}</span>
                    </p>
                    <AuthOtpInput value={otp} onChange={setOtp} onComplete={() => { if (!submitting) void advance(); }} length={8} />
                    {errors.otp && <p className="text-[12px] text-rose-400">{errors.otp}</p>}
                    <button onClick={resend} className="text-[12.5px] text-white/55 hover:text-white underline underline-offset-4">
                      Resend code
                    </button>
                  </div>
                )}

                {/* PROVISION */}
                {currentStep === "provision" && (
                  <div className="max-w-md">
                    <div className="flex items-center gap-3 text-white/70">
                      <Loader2 className="w-5 h-5 animate-spin text-[hsla(212,100%,72%,0.95)]" />
                      <span className="text-[14px]">Provisioning {form.company_name || "your workspace"}…</span>
                    </div>
                    <div className="mt-6 space-y-2.5">
                      {["Creating your organization", "Writing your brand kit", "Assigning seats & plan", "Opening the studio"].map((line, i) => (
                        <motion.div key={line} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 + i * 0.5 }} className="flex items-center gap-2.5 text-[13px] text-white/60">
                          <Check className="w-4 h-4 text-emerald-400" /> {line}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        {/* ── Live workspace preview rail ──────────────────────────── */}
        <aside className="hidden lg:block">
          <div className="sticky top-8">
            <PreviewCard form={form} plan={plan} />
          </div>
        </aside>
      </div>

      {/* Footer nav */}
      {!isProvision && (
        <div className="fixed bottom-0 inset-x-0 z-40">
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent pointer-events-none" />
          <div className="relative max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
            <button onClick={back} disabled={submitting}
              className="inline-flex items-center gap-2 h-11 px-4 rounded-full text-white/65 hover:text-white text-sm transition-colors disabled:opacity-40">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button onClick={advance} disabled={submitting}
              className="inline-flex items-center gap-2 h-12 px-7 rounded-full text-sm font-semibold text-black bg-white hover:bg-white/90 shadow-[0_8px_30px_-8px_rgba(255,255,255,0.4)] transition-all disabled:opacity-60">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <>
                  {currentStep === "account" ? "Create workspace" : currentStep === "verify" ? "Verify & launch" : "Continue"}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Live preview rail ──────────────────────────────────────────────────── */
function PreviewCard({ form, plan }: { form: Form; plan: { id: string; label: string } }) {
  const objective = OBJECTIVES.find((o) => o.id === form.objective)?.label;
  const voice = VOICES.find((v) => v.id === form.brand_voice)?.label;
  return (
    <div className="rounded-3xl bg-white/[0.05] backdrop-blur-2xl overflow-hidden shadow-[0_30px_80px_-30px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="h-20 relative" style={{ background: `linear-gradient(135deg, ${form.brand_primary}, ${form.brand_accent})` }}>
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute -bottom-5 left-5 w-12 h-12 rounded-2xl bg-[#0c0e14]/90 backdrop-blur-md flex items-center justify-center shadow-xl shadow-black/50">
          <Building2 className="w-5 h-5 text-white/80" />
        </div>
      </div>
      <div className="px-5 pt-8 pb-5">
        <p className="text-[15px] font-semibold truncate">{form.company_name || "Your workspace"}</p>
        <p className="text-[12px] text-white/45 truncate">{form.work_email || "work email"}</p>

        <div className="mt-4 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-primary/[0.18] backdrop-blur-md text-[11.5px] font-medium shadow-[0_0_0_1px_hsla(212,100%,62%,0.35)]">
            <Sparkles className="w-3 h-3" /> {plan.label} plan
          </span>
          {form.team_size && (
            <span className="inline-flex items-center h-7 px-3 rounded-full bg-white/[0.07] backdrop-blur-md text-[11.5px] text-white/65">
              {TEAM_SIZES.find((t) => t.id === form.team_size)?.label}
            </span>
          )}
        </div>

        <div className="mt-5 space-y-2.5 text-[12.5px]">
          <PreviewRow label="Objective" value={objective} />
          <PreviewRow label="Industry" value={form.industry} />
          <PreviewRow label="Voice" value={voice} />
          <PreviewRow label="Seats" value={form.invited_emails.length ? `You + ${form.invited_emails.length}` : "You"} />
          <PreviewRow label="Controls" value={[form.needs_sso && "SSO", form.needs_sla && "SLA", form.needs_api && "API"].filter(Boolean).join(" · ") || undefined} />
        </div>
        <div className="mt-5 pt-4 flex items-center gap-2" style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)" }}>
          {[form.brand_primary, form.brand_accent].map((c) => (
            <span key={c} className="h-5 w-5 rounded-md shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]" style={{ background: c }} />
          ))}
          <span className="text-[11px] text-white/40 ml-1">Brand kit</span>
        </div>
      </div>
    </div>
  );
}
function PreviewRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-white/40">{label}</span>
      <span className={cn("text-right truncate", value ? "text-white/80" : "text-white/25")}>{value || "—"}</span>
    </div>
  );
}

/* ── Shared bits ────────────────────────────────────────────────────────── */
// Borderless: translucent fill + inset hairline via ring, focus lifts the fill
// and adds a soft brand glow — no hard 1px borders anywhere.
const inputCls =
  "w-full h-12 px-4 rounded-xl bg-white/[0.05] backdrop-blur-md text-white text-sm placeholder:text-white/35 focus:outline-none focus:bg-white/[0.09] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus:shadow-[0_0_0_1px_hsla(212,100%,62%,0.5),0_8px_30px_-12px_hsla(212,100%,55%,0.6)] transition-all";

function CheckDot() {
  return (
    <span className="absolute top-3 right-3 w-5 h-5 rounded-full inline-flex items-center justify-center"
      style={{ background: "linear-gradient(135deg, #0A84FF, #5AC8FA)", boxShadow: "0 0 12px hsla(212,100%,60%,0.6)" }}>
      <Check className="w-3 h-3 text-white" strokeWidth={3} />
    </span>
  );
}

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <label className="block">
      <span className="block text-[10px] tracking-[0.22em] uppercase text-white/55 font-medium mb-2">{label}</span>
      {children}
      {error && <span className="block text-[11px] text-rose-400 mt-1.5">{error}</span>}
    </label>
  );
}

function Block({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-[10px] tracking-[0.28em] uppercase text-white/55 font-medium">{label}</p>
        {hint && <p className="text-[10.5px] text-white/35">{hint}</p>}
      </div>
      {children}
      {error && <p className="text-[11px] text-rose-400 mt-2.5">{error}</p>}
    </section>
  );
}

function IconInput({
  Icon, value, onChange, placeholder, type = "text", autoFocus, disabled,
}: {
  Icon: React.ComponentType<{ className?: string }>; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; autoFocus?: boolean; disabled?: boolean;
}) {
  return (
    <div className="relative">
      <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/45" />
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        autoFocus={autoFocus} disabled={disabled}
        className={cn(inputCls, "pl-10", disabled && "opacity-60 cursor-not-allowed")}
      />
    </div>
  );
}

function Pills({
  options, selected, onSelect, multi, selectedMulti, onToggle,
}: {
  options: { id: string; label: string }[];
  selected?: string; onSelect?: (v: string) => void;
  multi?: boolean; selectedMulti?: string[]; onToggle?: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {options.map(({ id, label }) => {
        const active = multi ? selectedMulti?.includes(id) : selected === id;
        return (
          <button key={id}
            onClick={() => (multi ? onToggle?.(id) : onSelect?.(id))}
            className={cn(
              "h-11 px-4 rounded-full text-[13px] font-medium transition-all backdrop-blur-md inline-flex items-center gap-2",
              active ? "bg-primary/[0.18] text-white shadow-[0_0_0_1px_hsla(212,100%,62%,0.5),0_8px_24px_-8px_hsla(212,100%,55%,0.6)]"
                     : "bg-white/[0.05] text-white/70 hover:bg-white/[0.09] hover:text-white",
            )}>
            {active && <Check className="w-3 h-3 text-[hsla(212,100%,72%,0.95)]" />}
            {label}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({
  Icon, label, desc, on, onChange,
}: {
  Icon: React.ComponentType<{ className?: string }>; label: string; desc: string;
  on: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <button onClick={() => onChange(!on)}
      className={cn("w-full flex items-center gap-3 p-3.5 rounded-xl text-left transition-all backdrop-blur-md",
        on ? "bg-primary/[0.14] shadow-[0_0_0_1px_hsla(212,100%,62%,0.45)]" : "bg-white/[0.04] hover:bg-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]")}>
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0 backdrop-blur-md", on ? "bg-primary/[0.2]" : "bg-white/[0.06]")}>
        <Icon className="w-4 h-4 text-[hsla(212,100%,72%,0.95)]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold">{label}</p>
        <p className="text-[11.5px] text-white/50 truncate">{desc}</p>
      </div>
      <span className={cn("w-10 h-6 rounded-full p-0.5 transition-colors shrink-0", on ? "bg-primary" : "bg-white/15")}>
        <motion.span layout className="block w-5 h-5 rounded-full bg-white shadow" style={{ marginLeft: on ? "auto" : 0 }} />
      </span>
    </button>
  );
}

function ColorPick({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer" title={`${label} color`}>
      <span className="relative h-10 w-10 rounded-xl overflow-hidden shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]" style={{ background: value }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer" aria-label={`${label} color`} />
      </span>
    </label>
  );
}

/* ── Backdrop — full-bleed cinematic photography, borderless ────────────── */
function Backdrop({ primary, accent, stepKey }: { primary: string; accent: string; stepKey: StepKey }) {
  // Single cinematic plate for the whole flow — the corridor toward the light.
  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-[hsl(220,18%,3%)]" />
      <div
        className="absolute inset-0 bg-cover"
        style={{ backgroundImage: `url(${heroEnterprise})`, backgroundPosition: "center 40%" }}
      />
      {/* Legibility scrims — heavier on the left where the copy + cards live */}
      <div className="absolute inset-0 bg-gradient-to-r from-[hsl(220,18%,3%)] via-[hsl(220,18%,3%)]/82 to-[hsl(220,18%,3%)]/45" />
      <div className="absolute inset-0 bg-gradient-to-t from-[hsl(220,18%,3%)] via-transparent to-[hsl(220,18%,3%)]/70" />
      {/* Brand wash that tracks the chosen colors */}
      <AnimatePresence>
        <motion.div
          key={stepKey + primary}
          initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
          transition={{ duration: 1.2 }}
          className="absolute -top-1/3 -right-1/4 w-[60vw] h-[60vw] rounded-full blur-[160px]"
          style={{ background: `radial-gradient(circle, ${primary}2e, transparent 70%)` }}
        />
      </AnimatePresence>
      <div className="absolute -bottom-1/3 -left-1/4 w-[55vw] h-[55vw] rounded-full blur-[170px]"
        style={{ background: `radial-gradient(circle, ${accent}1f, transparent 70%)` }} />
      {/* Vignette */}
      <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 200px 60px rgba(0,0,0,0.7)" }} />
    </div>
  );
}
