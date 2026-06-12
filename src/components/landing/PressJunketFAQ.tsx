/**
 * PressJunketFAQ — replaces the accordion FAQ pattern with a mock press
 * junket transcript. Two-column on desktop (Q on left, A on right),
 * stacked on mobile. Q rendered in italic Fraunces, A in plain sans —
 * a small but premium-grade typographic distinction.
 *
 * Each Q/A pair animates in on scroll with a typewriter-style reveal of
 * the answer. The questions are pre-written; this is editorial, not
 * dynamic content.
 */

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

const QA = [
  {
    q: 'How fast does a render really finish?',
    a: 'Median shot takes 89 seconds. Pre-vis previews — the cheap 320p thumbnails before you commit — finish in 8. The four-minute renders you might have seen elsewhere are reserved for the longest 30-second avatar takes.',
  },
  {
    q: 'Can my characters stay consistent across projects?',
    a: 'Yes. Every character you generate lives in your Cast. Drop them into a new project and the model locks them in — same face, same posture, same look. The same goes for Locations and Voices.',
  },
  {
    q: 'What happens when a generation fails?',
    a: 'The credits go back to your balance automatically — your project page shows the refund the moment it lands. Then you get a one-tap retry that picks up exactly where the failure happened.',
  },
  {
    q: 'Do I need a card to start?',
    a: 'No. Small Bridges is free during beta. New accounts receive 100 starter credits the moment they sign up. When paid plans go live we’ll email you 30 days in advance.',
  },
  {
    q: 'What about my prompts and footage — who owns them?',
    a: 'You do. We use your projects internally only to improve quality of service. Nothing is fed back into a training set, and nothing is shared without an opt-in via the public Gallery.',
  },
  {
    q: 'Is there an editor, or just a generator?',
    a: 'There’s an editor. Beat-cut to any audio you drag in, color-match across shots in one click, test the same cut in 16:9 / 9:16 / 1:1 without re-rendering. The editor is fast on purpose — fewer features, sharp ones.',
  },
] as const;

export function PressJunketFAQ() {
  return (
    <section className="relative z-10 py-24 lg:py-32 px-6">
      <div className="max-w-[1100px] mx-auto">
        {/* Eyebrow */}
        <div className="text-center mb-12 lg:mb-16">
          <div className="text-[9px] font-mono uppercase tracking-[0.4em] text-white/30 mb-4">
            The Junket · 06 questions
          </div>
          <h2
            className="font-display text-[36px] sm:text-[48px] lg:text-[56px] font-light text-white leading-[1.05] max-w-2xl mx-auto"
            style={{ fontVariant: 'small-caps' }}
          >
            Small Bridges, on the record.
          </h2>
          <p className="text-white/55 text-[14px] max-w-xl mx-auto mt-4 leading-relaxed">
            Six questions every visiting director seems to ask. The on-the-record answers.
          </p>
        </div>

        <div className="space-y-12 lg:space-y-16">
          {QA.map((entry, i) => (
            <JunketRow key={entry.q} q={entry.q} a={entry.a} index={i} />
          ))}
        </div>

        {/* Tail */}
        <div className="mt-16 text-center text-[10px] font-mono uppercase tracking-[0.4em] text-white/25">
          — Off the record —
        </div>
      </div>
    </section>
  );
}

function JunketRow({ q, a, index }: { q: string; a: string; index: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: '-15% 0px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.04 * (index % 3) }}
      className="grid grid-cols-1 md:grid-cols-[1fr_3px_2fr] gap-6 md:gap-10 items-start"
    >
      {/* Question — italic Fraunces, with portrait-ring journalist label */}
      <div className="md:text-right">
        <div className="flex md:justify-end items-center gap-2 mb-3">
          <span className="w-6 h-6 rounded-full border border-white/15 bg-white/[0.03] flex items-center justify-center text-[10px] font-mono text-white/45 tabular-nums">
            Q
          </span>
          <span className="text-[9px] font-mono uppercase tracking-[0.32em] text-white/35">
            Press
          </span>
        </div>
        <p
          className="font-display italic text-[20px] sm:text-[22px] leading-[1.3] text-white/85"
        >
          {q}
        </p>
      </div>

      {/* Divider — hairline column rule on desktop only */}
      <div aria-hidden className="hidden md:block w-px bg-gradient-to-b from-transparent via-white/10 to-transparent h-full" />

      {/* Answer — plain sans, monospaced "APEX:" prefix */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-brand-light">
            Small Bridges
          </span>
          <span className="h-px w-6 bg-white/10" />
        </div>
        <p className="text-[15px] sm:text-[16px] leading-[1.65] text-white/75">
          {a}
        </p>
      </div>
    </motion.div>
  );
}

export default PressJunketFAQ;
