/**
 * MarketingHeader — the single, consistent top header for the public site
 * (landing + How it works, Pricing, Tour, Blog, Press, Contact, legal…).
 *
 * Route-based (not scroll-dependent) so it behaves identically on every page:
 * a premium glass bar that turns solid on scroll, active-link accent, a full
 * mobile sheet, and white CTAs. One header everywhere — no more per-page navs
 * or double-stacked bars.
 */
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useScroll, useSpring } from "framer-motion";
import { Menu, X, ArrowRight } from "lucide-react";
import { BrandTile } from "@/components/cinema/Logo";
import { ACCENT } from "@/components/cinema/ui";
import { cn } from "@/lib/utils";

const LINKS: { label: string; to: string }[] = [
  { label: "How it works", to: "/how-it-works" },
  { label: "Pricing", to: "/pricing" },
  { label: "Inside the Studio", to: "/studio-showcase" },
  { label: "Blog", to: "/blog" },
];

function isActive(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(to + "/");
}

export function MarketingHeader({ showProgress = false }: { showProgress?: boolean }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 26 });
  const [open, setOpen] = useState(false);

  // Close the mobile sheet on route change + lock body scroll while open.
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-[60]">
      <div className="px-4 sm:px-6 lg:px-10">
        <div className="mx-auto mt-3 flex max-w-7xl items-center justify-between gap-4 rounded-2xl bg-transparent px-4 py-2.5 sm:px-5">
          {/* Brand */}
          <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="Small Bridges home">
            <BrandTile className="h-8 w-8" />
            <span className="font-display text-[16px] tracking-tight text-white">
              Small <span className="font-semibold italic">Bridges</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-0.5 md:flex">
            {LINKS.map((l) => {
              const active = isActive(pathname, l.to);
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  className={cn(
                    "rounded-lg px-3.5 py-1.5 text-[13.5px] font-medium tracking-wide transition-colors duration-200",
                    active ? "text-white" : "text-white/55 hover:text-white",
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>

          {/* CTAs */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => navigate("/auth")}
              className="hidden px-3.5 py-2 text-[13px] font-light text-white/70 transition-colors hover:text-white sm:inline-flex"
            >
              Sign in
            </button>
            <Link
              to="/auth?mode=signup"
              className="group hidden items-center gap-1.5 rounded-full bg-white px-5 py-2 text-[13px] font-semibold text-[#0a0b0e] transition-transform duration-200 hover:-translate-y-0.5 sm:inline-flex"
              style={{ boxShadow: `0 12px 34px -14px hsl(${ACCENT} / 0.9)` }}
            >
              Get Started
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>

            {/* Mobile toggle */}
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-white/80 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/[0.06] md:hidden"
            >
              {open ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Scroll-progress hairline (landing only) */}
      {showProgress && (
        <motion.div className="mx-auto mt-2 h-px max-w-7xl origin-left bg-white/30" style={{ scaleX: progress }} />
      )}

      {/* Mobile sheet */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="px-4 md:hidden"
          >
            <div className="mx-auto mt-2 max-w-7xl rounded-2xl border border-white/[0.08] bg-[#08090c]/95 p-3 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
              <nav className="flex flex-col">
                {LINKS.map((l) => (
                  <Link
                    key={l.to}
                    to={l.to}
                    className={cn(
                      "rounded-xl px-4 py-3 text-[15px] font-medium transition-colors",
                      isActive(pathname, l.to) ? "bg-white/[0.06] text-white" : "text-white/70 hover:bg-white/[0.04] hover:text-white",
                    )}
                  >
                    {l.label}
                  </Link>
                ))}
              </nav>
              <div className="mt-2 flex items-center gap-2 border-t border-white/[0.07] pt-3">
                <button
                  type="button"
                  onClick={() => navigate("/auth")}
                  className="flex-1 rounded-full px-4 py-2.5 text-[14px] font-medium text-white ring-1 ring-inset ring-white/15 transition-colors hover:bg-white/[0.06]"
                >
                  Sign in
                </button>
                <Link
                  to="/auth?mode=signup"
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-[14px] font-semibold text-[#0a0b0e]"
                >
                  Get Started <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

export default MarketingHeader;
