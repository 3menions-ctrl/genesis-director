/**
 * NotFound — branded 404 with the same recovery aesthetic as RootErrorBoundary.
 *
 * Direct copy. No "Oops!". The user knows the route is bad; we don't pretend.
 */

import { useLocation, Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Home, ArrowLeft, Compass, LifeBuoy } from "lucide-react";

import { usePageMeta } from '@/hooks/usePageMeta';
import { reportClientError } from '@/lib/errors';

const NotFound = () => {
  usePageMeta({
    title: "Page not found — Apex Studio",
    description: "We couldn't find that page. Head back to Apex Studio.",
  });

  const location = useLocation();
  const navigate = useNavigate();

  // Short stable id for users to reference if they ask support.
  const ref = useMemo(() => {
    const ts = Date.now().toString(36).slice(-4).toUpperCase();
    const rnd = Math.random().toString(36).slice(2, 5).toUpperCase();
    return `404-${ts}-${rnd}`;
  }, []);

  useEffect(() => {
    // Non-blocking — telemetry so we can spot patterns of dead links.
    reportClientError(new Error(`404: ${location.pathname}`), {
      surface: 'router.not-found',
      action: 'navigate',
      extra: { pathname: location.pathname, search: location.search, ref },
    });
  }, [location.pathname, location.search, ref]);

  return (
    <div className="min-h-screen w-full bg-[hsl(220,14%,3%)] text-white antialiased">
      {/* Ambient glow */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-[520px] w-[520px] rounded-full bg-[#0A84FF]/[0.07] blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-[420px] w-[420px] rounded-full bg-amber-400/[0.05] blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-2xl flex-col items-stretch justify-center px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="
            rounded-3xl border border-white/[0.06] bg-[hsl(220,14%,3%)/0.94]
            p-8 backdrop-blur-2xl
            shadow-[0_30px_80px_-20px_rgba(0,0,0,0.85),0_0_120px_-30px_rgba(10,132,255,0.20),inset_0_1px_0_rgba(255,255,255,0.04)]
          "
        >
          <div className="flex items-start gap-4">
            <span
              aria-hidden
              className="
                mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full
                bg-[#0A84FF]/15 ring-1 ring-[#0A84FF]/30
                shadow-[0_0_24px_rgba(10,132,255,0.30)]
              "
            >
              <Compass className="h-5 w-5 text-[#5AB0FF]" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-[26px] font-semibold tracking-[-0.015em] text-white">
                That page doesn't exist.
              </h1>
              <p className="mt-2 text-[15px] leading-relaxed text-white/65">
                The route you tried isn't part of Apex Studio. It may have been
                renamed, moved, or never existed in the first place.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-white/[0.06] bg-black/30 p-4">
            <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-white/40">
              {ref} · not found
            </p>
            <p className="mt-2 font-mono text-[13px] text-white/70 break-all">
              {location.pathname}{location.search}
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/"
              className="
                inline-flex flex-1 items-center justify-center gap-2 rounded-full px-5 py-2.5
                bg-[#0A84FF] text-[14px] font-medium text-white
                ring-2 ring-[#0A84FF]/40 ring-offset-2 ring-offset-[hsl(220,14%,3%)]
                shadow-[0_0_32px_rgba(10,132,255,0.45)]
                hover:bg-[#0A84FF]/90 transition-all duration-150
              "
            >
              <Home className="h-4 w-4" />
              Return home
            </Link>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="
                inline-flex flex-1 items-center justify-center gap-2 rounded-full px-5 py-2.5
                bg-white/[0.05] text-[14px] font-medium text-white/85
                border border-white/[0.08]
                hover:bg-white/[0.10] hover:border-white/[0.16]
                transition-all duration-150
              "
            >
              <ArrowLeft className="h-4 w-4" />
              Go back
            </button>
          </div>

          <div className="mt-6 border-t border-white/[0.05] pt-5">
            <p className="text-[12px] uppercase tracking-[0.16em] text-white/35">Or jump to</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                to="/projects"
                className="rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1 text-[12px] text-white/70 hover:bg-white/[0.07] hover:text-white transition-colors"
              >
                Projects
              </Link>
              <Link
                to="/templates"
                className="rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1 text-[12px] text-white/70 hover:bg-white/[0.07] hover:text-white transition-colors"
              >
                Templates
              </Link>
              <Link
                to="/credits"
                className="rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1 text-[12px] text-white/70 hover:bg-white/[0.07] hover:text-white transition-colors"
              >
                Credits
              </Link>
              <Link
                to="/help"
                className="inline-flex items-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1 text-[12px] text-white/70 hover:bg-white/[0.07] hover:text-white transition-colors"
              >
                <LifeBuoy className="h-3 w-3" />
                Help center
              </Link>
            </div>
          </div>
        </motion.div>

        <p className="mt-5 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-white/30">
          ref · {ref}
        </p>
      </div>
    </div>
  );
};

export default NotFound;
