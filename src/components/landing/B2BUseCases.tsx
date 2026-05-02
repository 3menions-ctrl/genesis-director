import { memo } from 'react';
import { Megaphone, Film, ShoppingBag, Users2, Globe, BarChart3 } from 'lucide-react';

const CASES = [
  {
    icon: Megaphone,
    title: 'Performance ads',
    desc: 'Spin up dozens of variants for Meta, TikTok and YouTube — A/B by hook, voiceover, or CTA without re-shoots.',
  },
  {
    icon: ShoppingBag,
    title: 'Product launches',
    desc: 'Hero films, social cuts, and lifecycle emails generated from a single brief — all locked to your brand kit.',
  },
  {
    icon: Globe,
    title: 'Localized campaigns',
    desc: 'One source, every language. Auto-dub avatars and re-voice scripts to ship globally without an agency.',
  },
  {
    icon: Users2,
    title: 'Sales & outbound',
    desc: 'Personalized prospect videos at scale. Bulk-render from a CSV with merge fields like name and company.',
  },
  {
    icon: Film,
    title: 'Brand storytelling',
    desc: 'Cinematic explainers, founder stories, and case-study films directed by AI — shot-by-shot to your guidelines.',
  },
  {
    icon: BarChart3,
    title: 'Always-on social',
    desc: 'A weekly content engine that turns blog posts, launches, and reports into ready-to-publish video.',
  },
];

export const B2BUseCases = memo(function B2BUseCases() {
  return (
    <section id="features" className="relative z-10 py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-[11px] font-medium text-[#0A84FF] tracking-[0.22em] uppercase mb-4">
            Use cases
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white tracking-tight">
            Every video your team needs to ship.
          </h2>
          <p className="mt-4 text-white/50 max-w-2xl mx-auto leading-relaxed">
            From paid ads to global launches, replace half your creative
            production stack with one workspace.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CASES.map((c) => (
            <div
              key={c.title}
              className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-300 p-6"
            >
              <div className="w-10 h-10 rounded-xl bg-[#0A84FF]/10 border border-[#0A84FF]/20 flex items-center justify-center mb-5 group-hover:bg-[#0A84FF]/15 transition-colors">
                <c.icon className="w-4 h-4 text-[#0A84FF]" />
              </div>
              <h3 className="text-base font-semibold text-white mb-2 tracking-tight">
                {c.title}
              </h3>
              <p className="text-sm text-white/50 leading-relaxed font-light">{c.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});

B2BUseCases.displayName = 'B2BUseCases';