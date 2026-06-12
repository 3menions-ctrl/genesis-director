/**
 * OAuthProviders — Sign in / sign up with Apple, Google, or GitHub.
 *
 * Three buttons that delegate to Supabase auth's signInWithOAuth. The
 * redirect lands back at `/auth/callback` (already routed) which finishes
 * the session and bounces to /onboarding or /projects.
 *
 * Visible on top of the email form. If a particular provider is
 * disabled in Supabase config, the button just shows an error toast on
 * click; the SDK rejects before any redirect.
 */
import { useState } from "react";
import { Apple, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Provider = "apple" | "google" | "github";

interface Props {
  /** Optional `?next=` to preserve for post-OAuth landing. */
  next?: string | null;
  /** Hide github by default — only enable for dev / power users. */
  showGithub?: boolean;
  className?: string;
}

const PROVIDER_LABELS: Record<Provider, string> = {
  apple:  "Continue with Apple",
  google: "Continue with Google",
  github: "Continue with GitHub",
};

export function OAuthProviders({ next, showGithub = false, className }: Props) {
  const [busy, setBusy] = useState<Provider | null>(null);

  const sign = async (provider: Provider) => {
    setBusy(provider);
    try {
      const redirectTo = new URL("/auth/callback", window.location.origin);
      if (next && next.startsWith("/")) redirectTo.searchParams.set("next", next);
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectTo.toString(),
          // Force a fresh consent so the email scope is always granted.
          queryParams: provider === "google"
            ? { access_type: "offline", prompt: "select_account" }
            : undefined,
        },
      });
      if (error) {
        toast.error(`${provider} sign-in didn't go through — try again.`);
        setBusy(null);
        return;
      }
      // signInWithOAuth navigates the page; nothing else to do.
    } catch {
      toast.error("Sign-in didn't go through — try again.");
      setBusy(null);
    }
  };

  return (
    <div className={"space-y-2 " + (className ?? "")}>
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={() => sign("apple")}
        disabled={busy !== null}
        className="w-full justify-center bg-white text-black hover:bg-white/90 border-white"
      >
        {busy === "apple" ? (
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
        ) : (
          <Apple className="w-4 h-4 mr-2" aria-hidden />
        )}
        {PROVIDER_LABELS.apple}
      </Button>

      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={() => sign("google")}
        disabled={busy !== null}
        className="w-full justify-center"
      >
        {busy === "google" ? (
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
        ) : (
          // Inline Google "G" logo so we don't ship the whole branding pack.
          <svg viewBox="0 0 24 24" className="w-4 h-4 mr-2" aria-hidden>
            <path
              fill="#EA4335"
              d="M12 10.2v3.96h5.52c-.24 1.5-1.74 4.4-5.52 4.4-3.32 0-6.04-2.76-6.04-6.16s2.72-6.16 6.04-6.16c1.9 0 3.16.8 3.88 1.5l2.64-2.56C16.86 3.6 14.66 2.6 12 2.6 6.84 2.6 2.68 6.76 2.68 11.92S6.84 21.24 12 21.24c6.92 0 11.5-4.86 11.5-11.68 0-.78-.08-1.36-.2-1.96H12z"
            />
          </svg>
        )}
        {PROVIDER_LABELS.google}
      </Button>

      {showGithub && (
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => sign("github")}
          disabled={busy !== null}
          className="w-full justify-center"
        >
          {busy === "github" ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          ) : null}
          {PROVIDER_LABELS.github}
        </Button>
      )}
    </div>
  );
}
