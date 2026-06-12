/**
 * AuthErrorBanner — surfaces the real Supabase error with a one-tap
 * "Open relevant log" link, instead of the previous swallow-and-toast.
 */
import { AlertTriangle, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface AuthErrorCue {
  /** Human-readable message we render. */
  title: string;
  /** Optional one-liner explanation. */
  body?: string;
  /** Optional direct link to a relevant log / docs / setting. */
  href?: string;
  /** Label for the optional link. */
  hrefLabel?: string;
}

export function classifyAuthError(rawMessage: string | undefined): AuthErrorCue {
  const msg = (rawMessage ?? "").trim();
  const lc = msg.toLowerCase();

  if (lc.includes("error sending confirmation email") || lc.includes("smtp")) {
    return {
      title: "Confirmation email didn't send.",
      body:
        "Your Resend SMTP setup is either misconfigured or the domain hasn't verified yet. Check the latest send attempt in Resend's logs.",
      href: "https://resend.com/emails",
      hrefLabel: "Open Resend logs",
    };
  }
  if (lc.includes("rate limit") || lc.includes("over_email_send_rate_limit") || lc.includes("too many")) {
    return {
      title: "Hit the email-send rate limit.",
      body:
        "Raise the Supabase auth email rate limit (you're on Pro — you can crank it up) or wait an hour for the window to reset.",
      href: "https://supabase.com/dashboard/project/ywcwaumozoejierlfkgj/auth/rate-limits",
      hrefLabel: "Open rate limits",
    };
  }
  if (lc.includes("already registered") || lc.includes("user already registered")) {
    return { title: "That email is already registered.", body: "Sign in instead." };
  }
  if (lc.includes("invalid email") || lc.includes("email_address_invalid")) {
    return { title: "That email address looks invalid.", body: "Use a different one." };
  }
  if (lc.includes("invalid login") || lc.includes("invalid credentials")) {
    return { title: "Email or password is incorrect." };
  }
  if (lc.includes("email not confirmed")) {
    return { title: "Email not verified yet.", body: "Enter the code we just sent." };
  }
  if (lc.includes("database error saving new user") || lc.includes("database error")) {
    return {
      title: "We couldn't save the new account.",
      body: "Refresh and try again. If it persists, the auth trigger may be misconfigured.",
    };
  }
  if (lc.includes("password")) {
    return { title: "Password didn't meet the requirements.", body: "Use 6 or more characters." };
  }
  if (!msg) {
    return { title: "Something went wrong.", body: "Try again in a moment." };
  }
  // Last resort — show the raw message for diagnosis.
  return { title: "Sign-up failed.", body: msg.slice(0, 200) };
}

interface Props {
  cue: AuthErrorCue | null;
}

export function AuthErrorBanner({ cue }: Props) {
  return (
    <AnimatePresence>
      {cue && (
        <motion.div
          role="alert"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="rounded-2xl border border-destructive/30 bg-destructive/[0.06] backdrop-blur-xl p-3 flex items-start gap-2.5"
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 text-destructive shrink-0" aria-hidden />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-white">{cue.title}</div>
            {cue.body && (
              <div className="text-[12px] text-white/65 mt-0.5 leading-relaxed">{cue.body}</div>
            )}
            {cue.href && (
              <a
                href={cue.href}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 mt-1.5"
              >
                {cue.hrefLabel ?? "Open"} <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
