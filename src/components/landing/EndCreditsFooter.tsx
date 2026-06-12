/**
 * EndCreditsFooter — replaces the standard landing footer with a literal
 * film end-credits crawl that plays once on first scroll-into-view, then
 * settles into a quiet static state with the practical navigation links
 * underneath. Last impression the visitor takes away.
 *
 * Two layers stacked:
 *   1) Credits crawl — 7 paired role/credit cards centered, scrolled
 *      upward by a slow rAF-driven transform when the section enters the
 *      viewport. Auto-stops at the bottom and locks for an extra beat.
 *   2) Static utility footer — links, legal, copyright. Always rendered.
 */

import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useInView } from 'framer-motion';

const CREDITS = [
  { role: 'Directed by', name: 'Small Bridges' },
  { role: 'Written by', name: 'You' },
  { role: 'Cinematography', name: 'Our Pipeline' },
  { role: 'Casting', name: 'Your Characters' },
  { role: 'Sound Design', name: 'Sonic Cloud · ElevenLabs' },
  { role: 'Visual Effects', name: 'Replicate · In-House Models' },
  { role: 'Special Thanks', name: 'Every creator who tried\nsomething new this week' },
];

export function EndCreditsFooter() {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: '-25% 0px' });
  const [played, setPlayed] = useState(false);

  // Trigger crawl once on enter. After 7s the crawl rests at its final
  // position so the credit list stays legible.
  useEffect(() => {
    if (!inView || reduced) return;
    const t = window.setTimeout(() => setPlayed(true), 7200);
    return () => window.clearTimeout(t);
  }, [inView, reduced]);

  return (
    <footer className="relative z-10 pt-32 pb-16 px-6">
      {/* Reel head sprocket pattern */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-3 opacity-[0.06]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, transparent 0 22px, rgba(255,255,255,0.6) 22px 24px)',
        }}
      />

      {/* Credits crawl */}
      <div
        ref={ref}
        className="relative h-[420px] sm:h-[480px] overflow-hidden mx-auto max-w-[680px] mb-16"
      >
        <motion.div
          className="absolute inset-x-0"
          initial={{ y: '100%' }}
          animate={inView && !reduced ? { y: played ? '-8%' : '-92%' } : { y: '0%' }}
          transition={{
            duration: 7,
            ease: 'linear',
          }}
        >
          <div className="text-center space-y-12 lg:space-y-14 pt-6">
            {CREDITS.map((c) => (
              <div key={c.role}>
                <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/40 mb-2">
                  {c.role}
                </div>
                <div
                  className="font-display text-[24px] sm:text-[28px] text-white/95 leading-tight whitespace-pre-line"
                  style={{ fontVariant: 'small-caps' }}
                >
                  {c.name}
                </div>
              </div>
            ))}
            <div className="pt-12">
              <div
                className="font-display text-[40px] sm:text-[52px] text-white"
                style={{ fontVariant: 'small-caps' }}
              >
                Fin.
              </div>
              <div className="mt-4 text-[10px] font-mono uppercase tracking-[0.4em] text-white/35">
                A Production of Small Bridges · MMXXVI
              </div>
            </div>
          </div>
        </motion.div>

        {/* Edge masks (top + bottom fade) so the crawl reveals into a soft horizon. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-24"
          style={{
            background:
              'linear-gradient(to bottom, hsl(0 0% 3% / 1), transparent)',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24"
          style={{
            background:
              'linear-gradient(to top, hsl(0 0% 3% / 1), transparent)',
          }}
        />
      </div>

      {/* Utility footer (always visible, no flash) */}
      <div className="max-w-[1280px] mx-auto pt-10 border-t border-white/[0.05]">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
          <FooterCol title="Product">
            <FooterLink to="/create">Create</FooterLink>
            <FooterLink to="/gallery">Gallery</FooterLink>
            <FooterLink to="/templates">Templates</FooterLink>
            <FooterLink to="/pricing">Pricing</FooterLink>
          </FooterCol>
          <FooterCol title="Company">
            <FooterLink to="/blog">Blog</FooterLink>
            <FooterLink to="/press">Press</FooterLink>
            <FooterLink to="/contact">Contact</FooterLink>
            <FooterLink to="/developers">Developers</FooterLink>
          </FooterCol>
          <FooterCol title="Help">
            <FooterLink to="/help">Help center</FooterLink>
            <FooterLink to="/settings/support">Support inbox</FooterLink>
            <a
              href="mailto:hello@smallbridges.co"
              className="text-[12px] text-white/55 hover:text-white transition-colors"
            >
              hello@smallbridges.co
            </a>
          </FooterCol>
          <FooterCol title="Legal">
            <FooterLink to="/terms">Terms</FooterLink>
            <FooterLink to="/privacy">Privacy</FooterLink>
            <FooterLink to="/unsubscribe">Unsubscribe</FooterLink>
          </FooterCol>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3 pt-6 border-t border-white/[0.04]">
          <span className="text-[10px] font-mono uppercase tracking-[0.32em] text-white/35">
            © {new Date().getFullYear()} Small Bridges · Built in California
          </span>
          <span className="text-[10px] font-mono uppercase tracking-[0.32em] text-white/35">
            Status: <span className="text-emerald-300">All systems nominal</span>
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-[0.32em] text-white/35 mb-3">
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function FooterLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="block text-[12px] text-white/55 hover:text-white transition-colors"
    >
      {children}
    </Link>
  );
}

export default EndCreditsFooter;
