/**
 * PublicReelCTA — the conversion surface shown to logged-out visitors on a
 * shared reel (/r/:id). Replaces the reactions + comments block (which require
 * auth) with a single, unmissable "make your own" call to action. This is the
 * back half of the growth loop: a shared link brings a visitor in, the reel
 * plays for free, and this panel turns the viewer into a signup.
 */
import { motion, useReducedMotion } from "framer-motion";
import { Sparkles, ArrowRight } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { GlassPanel, GlassButton } from "@/components/foundation/Floating";
import { EASE_PREMIUM, TYPE_EYEBROW, TYPE_META } from "@/lib/design-system";

export function PublicReelCTA({ creatorName }: { creatorName?: string | null }) {
  const reducedMotion = useReducedMotion();
  // Preserve a referral code arriving on the share link (/r/:id?ref=CODE)
  // through the signup CTA — otherwise the referral attribution is lost.
  const [params] = useSearchParams();
  const refCode = params.get("ref");
  const signupTo = `/auth?mode=signup${refCode ? `&ref=${encodeURIComponent(refCode)}` : ""}`;
  return (
    <motion.div
      initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_PREMIUM, delay: 0.15 }}
      className="mt-10"
    >
      <GlassPanel className="flex flex-col items-center gap-5 px-6 py-10 text-center sm:px-10">
        <span className={cn(TYPE_EYEBROW, "text-accent")}>
          <Sparkles className="mr-1.5 inline h-3 w-3" strokeWidth={1.5} />
          Made with Small Bridges
        </span>
        <h2 className="max-w-xl font-display text-2xl font-light tracking-tight text-foreground sm:text-3xl">
          {creatorName
            ? `${creatorName} made this with a single prompt.`
            : "This was made from a single prompt."}
          <br className="hidden sm:block" />
          <span className="text-foreground/70">You can too — free.</span>
        </h2>
        <p className={cn(TYPE_META, "max-w-md text-muted-foreground/70")}>
          Turn a sentence into cinematic AI video — consistent characters, real
          locations, and sound. Your first 5-second clip is free, up to 4K HDR.
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
          <Link to={signupTo}>
            <GlassButton tone="accent" ariaLabel="Make your own free">
              <span>Make your own — free</span>
              <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
            </GlassButton>
          </Link>
          <Link to="/how-it-works">
            <GlassButton tone="neutral" ariaLabel="See how it works">
              <span>See how it works</span>
            </GlassButton>
          </Link>
        </div>
      </GlassPanel>
    </motion.div>
  );
}
