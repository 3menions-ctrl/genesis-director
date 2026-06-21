/**
 * Footer — the shared, premium cinema-styled site footer.
 *
 * A film-studio nameplate: a closing CTA band, a brand + newsletter block with
 * scale stats and a live "studio online" pulse, three link columns with accent
 * underline hovers, an engine-credit bottom bar, and a large editorial wordmark
 * watermark behind ambient accent glow. Dark, single blue accent, Fraunces.
 * Internal links use the router; social links are placeholders.
 */
import { Link } from "react-router-dom";
import { ArrowRight, Twitter, Instagram, Youtube, Linkedin } from "lucide-react";
import { BrandTile } from "./Logo";
import { ACCENT } from "./ui";

const COLUMNS: { title: string; links: { label: string; to: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "How it works", to: "/how-it-works" },
      { label: "Pricing", to: "/pricing" },
      { label: "Templates", to: "/templates" },
      { label: "Environments", to: "/environments" },
      { label: "Avatars", to: "/avatars" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Inside the Studio", to: "/studio-showcase" },
      { label: "Blog", to: "/blog" },
      { label: "Contact", to: "/contact" },
      { label: "Help center", to: "/help" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", to: "/privacy" },
      { label: "Terms", to: "/terms" },
    ],
  },
];

const SOCIALS = [
  { Icon: Twitter, label: "X / Twitter" },
  { Icon: Instagram, label: "Instagram" },
  { Icon: Youtube, label: "YouTube" },
  { Icon: Linkedin, label: "LinkedIn" },
];

const STATS = [
  { value: "534", label: "Avatars" },
  { value: "120", label: "Worlds" },
  { value: "5", label: "Engines" },
];

const ENGINES = ["Wan 2.5", "Kling V3", "Seedance 2.0", "Veo 3", "Sora 2"];

function FootLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="group relative inline-flex w-fit py-0.5 text-[14px] font-light text-white/55 transition-colors duration-200 hover:text-white">
      {children}
      <span aria-hidden className="absolute -bottom-px left-0 h-px w-full origin-left scale-x-0 transition-transform duration-300 ease-out group-hover:scale-x-100" style={{ background: `hsl(${ACCENT})` }} />
    </Link>
  );
}

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative isolate overflow-hidden border-t border-white/10 bg-[#06070a] text-white">
      {/* ── ambient cinematics ── */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, hsl(${ACCENT} / 0.55), transparent)` }} />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{ background: `radial-gradient(80% 120% at 50% 118%, hsl(${ACCENT} / 0.16), transparent 60%)` }} />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-[0.5]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)", backgroundSize: "60px 60px", maskImage: "radial-gradient(120% 100% at 50% 100%, #000 30%, transparent 75%)", WebkitMaskImage: "radial-gradient(120% 100% at 50% 100%, #000 30%, transparent 75%)" }} />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-5 sm:px-8">
        {/* ── closing CTA band ── */}
        <div className="flex flex-col items-start gap-8 border-b border-white/10 py-14 md:flex-row md:items-center md:justify-between md:py-16">
          <div className="max-w-xl">
            <span className="font-mono text-[11px] uppercase tracking-[0.34em]" style={{ color: `hsl(${ACCENT})` }}>Ready when you are</span>
            <h2 className="mt-3 font-display text-[clamp(2rem,4.6vw,3.2rem)] font-semibold leading-[1.02] tracking-[-0.03em] text-white">
              It starts with a <span className="italic">sentence</span>.
            </h2>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <Link to="/studio-showcase" className="group inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-[14.5px] font-semibold text-[#0a0b0e] transition-transform duration-200 hover:-translate-y-0.5" style={{ boxShadow: `0 18px 50px -18px hsl(${ACCENT} / 0.9)` }}>
              Enter the Studio
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <Link to="/pricing" className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[14.5px] font-medium text-white ring-1 ring-white/15 backdrop-blur-md transition-colors hover:bg-white/[0.06]">
              View pricing
            </Link>
          </div>
        </div>

        {/* ── brand + columns ── */}
        <div className="grid gap-x-10 gap-y-12 py-14 md:py-16 lg:grid-cols-[1.35fr_2fr]">
          {/* brand / newsletter */}
          <div>
            <Link to="/" className="inline-flex items-center gap-3">
              <BrandTile className="h-10 w-10" />
              <span className="font-display text-[20px] tracking-tight text-white">Small <span className="font-semibold italic">Bridges</span></span>
            </Link>
            <p className="mt-5 max-w-xs text-[14px] font-light leading-relaxed text-white/55">The AI film studio in a sentence. Describe it — we cast, score, and cut a finished film.</p>

            {/* scale stats */}
            <div className="mt-7 flex items-center gap-7">
              {STATS.map((s) => (
                <div key={s.label}>
                  <div className="font-display text-[22px] font-semibold leading-none text-white">{s.value}</div>
                  <div className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">{s.label}</div>
                </div>
              ))}
            </div>

            {/* newsletter */}
            <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.24em] text-white/45">New films, features &amp; prompts — monthly</p>
            <form onSubmit={(e) => e.preventDefault()} className="relative mt-3 max-w-sm">
              <input
                type="email"
                required
                placeholder="you@studio.com"
                className="h-12 w-full rounded-full border border-white/12 bg-white/[0.04] pl-5 pr-[7.5rem] text-[14px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/25"
                style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}
              />
              <button type="submit" className="group absolute right-1.5 top-1.5 inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-medium text-[#0a0b0e] transition-colors hover:bg-white/90">
                Subscribe
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </button>
            </form>

            {/* live status */}
            <div className="mt-6 inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.03] py-1.5 pl-3 pr-3.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: `hsl(${ACCENT})` }} />
                <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: `hsl(${ACCENT})` }} />
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/55">Studio online</span>
            </div>
          </div>

          {/* link columns */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <div className="font-mono text-[10px] uppercase tracking-[0.26em] text-white/40">{col.title}</div>
                <ul className="mt-5 flex flex-col gap-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}><FootLink to={l.to}>{l.label}</FootLink></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* ── bottom bar ── */}
        <div className="flex flex-col gap-6 border-t border-white/10 py-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-5">
            <p className="font-mono text-[11px] tracking-wide text-white/35">© {year} Small Bridges</p>
            <span aria-hidden className="hidden h-3 w-px bg-white/15 sm:block" />
            <p className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-white/30 sm:flex sm:items-center sm:gap-1.5">
              Engines
              <span className="text-white/45">{ENGINES.join(" · ")}</span>
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {SOCIALS.map(({ Icon, label }) => (
              <a key={label} href="#" aria-label={label} className="group relative flex h-9 w-9 items-center justify-center rounded-full text-white/55 ring-1 ring-white/12 transition-all duration-200 hover:-translate-y-0.5 hover:text-white hover:ring-white/25">
                <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-200 group-hover:opacity-100" style={{ boxShadow: `0 0 22px -2px hsl(${ACCENT} / 0.8)`, background: `radial-gradient(circle, hsl(${ACCENT} / 0.18), transparent 70%)` }} />
                <Icon className="relative h-[17px] w-[17px]" />
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ── giant editorial wordmark watermark ── */}
      <div aria-hidden className="pointer-events-none relative z-0 -mb-[0.14em] select-none text-center">
        <span className="block font-display font-semibold leading-[0.8] tracking-[-0.04em] text-white/[0.035]" style={{ fontSize: "clamp(3.5rem, 18.5vw, 17rem)" }}>
          Small Bridges
        </span>
      </div>
    </footer>
  );
}
