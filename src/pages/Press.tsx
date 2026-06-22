import { motion } from "framer-motion";
import { usePageMeta } from '@/hooks/usePageMeta';
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Download,
  Mail,
  ImageIcon,
  FileText,
  Sparkles,
  Quote,
  Building2,
  Calendar,
  MapPin,
  Cpu,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";
import { PageHero } from "@/components/page/PageHero";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";

const FAST_FACTS = [
  { icon: Building2, label: "Company", value: "Small Bridges-studio LLC" },
  { icon: MapPin, label: "Headquarters", value: "Missouri, U.S." },
  { icon: Calendar, label: "Studio launch", value: "June 2026" },
  { icon: Cpu, label: "Engines", value: "Kling V3 · Seedance · Wan" },
  { icon: Sparkles, label: "Category", value: "AI cinematic video studio" },
  { icon: CreditCard, label: "Pricing", value: "Free first clip · then credits" },
];

const MEDIA_KIT = [
  {
    title: "Logo & brandmark",
    desc: "The Small Bridges keystone mark in SVG and PNG, on light and dark.",
    href: "/favicon.svg",
    icon: null as null | typeof ImageIcon,
    isLogo: true,
    cta: "Download SVG",
  },
  {
    title: "App OG image",
    desc: "Full-bleed social card and high-resolution app icon for thumbnails.",
    href: "/og-image.webp",
    icon: ImageIcon,
    isLogo: false,
    cta: "Download image",
  },
  {
    title: "Studio screenshot",
    desc: "The cinematic editor loaded with a multi-scene timeline.",
    href: "/cinema-assets/editor-loaded.jpg",
    icon: ImageIcon,
    isLogo: false,
    cta: "Download JPG",
  },
  {
    title: "Character profile",
    desc: "The character-consistency surface used across cuts and scenes.",
    href: "/cinema-assets/surface-profile.jpg",
    icon: ImageIcon,
    isLogo: false,
    cta: "Download JPG",
  },
];

const PRODUCT_SHOTS = [
  { src: "/cinema-assets/editor-loaded.jpg", caption: "The Small Bridges editor — multi-scene cinematic timeline." },
  { src: "/cinema-assets/surface-profile.jpg", caption: "Character consistency across every cut." },
];

const sectionFade = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.55 },
};

export default function Press() {
  usePageMeta({
    title: 'Press & Media — Small Bridges',
    description:
      'Newsroom for Small Bridges, the browser-based cinematic AI filmmaking studio. Read the launch announcement, company fast-facts, downloadable brand assets, and press contact.',
  });

  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <MarketingHeader />

      <main className="container mx-auto px-6 pt-28 pb-10 sm:pt-32 sm:pb-14 max-w-6xl">
        {/* Hero */}
        <PageHero
          accentKey="press"
          eyebrow="Newsroom"
          title="Press & Media"
          subtitle="The latest from Small Bridges — the browser-based studio turning a single prompt into cinematic, studio-grade video. Find our launch announcement, company facts, and downloadable brand assets below."
          meta="Updated June 22, 2026"
          actions={
            <>
              <Button asChild size="lg" className="rounded-2xl gap-2">
                <a href="#press-release">
                  <FileText className="w-4 h-4" /> Read the release
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-2xl gap-2 border-white/20 bg-white/[0.02] text-white hover:bg-white/[0.06]">
                <a href="mailto:cole@smallbridges.co">
                  <Mail className="w-4 h-4" /> Media inquiries
                </a>
              </Button>
            </>
          }
        />

        {/* ── 1. Press release (featured) ───────────────────────────── */}
        <motion.section id="press-release" {...sectionFade} className="mt-16 scroll-mt-24">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/45">Featured</span>
            <span className="h-px flex-1 bg-white/[0.08]" />
          </div>

          <article className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.025] p-8 sm:p-12 lg:p-16">
            <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 w-[420px] h-[420px] rounded-full bg-indigo-500/10 blur-[120px]" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] px-3.5 py-1.5 text-[11px] font-mono uppercase tracking-[0.28em] text-white/70">
                For Immediate Release
              </div>

              <h2 className="mt-7 font-display font-bold tracking-[-0.02em] leading-[1.08] text-[clamp(1.7rem,3.6vw,2.75rem)]">
                Small Bridges Launches Its Cinematic AI Filmmaking Studio — and Your First 5-Second Video Is Free
              </h2>
              <p className="mt-4 text-white/65 text-lg sm:text-xl leading-relaxed max-w-3xl">
                A new browser-based studio turns a single written prompt into studio-grade cinematic video — complete
                with AI avatars, original scoring, and characters that stay consistent across every cut.
              </p>

              <div className="mt-7 text-[12px] font-mono uppercase tracking-[0.28em] text-white/40">
                Missouri, U.S. — June 22, 2026
              </div>

              <div className="mt-8 space-y-5 text-[15.5px] leading-[1.75] text-white/80 max-w-3xl">
                <p>
                  Small Bridges today opened public access to its cinematic AI filmmaking studio, a browser-based
                  platform that lets anyone direct professional-quality video without a camera, a crew, or an editing
                  suite. New filmmakers can generate their first five-second cinematic clip free of charge on the Wan
                  engine, no subscription required — lowering the barrier to high-end video generation to effectively
                  zero.
                </p>
                <p>
                  Built for creators and businesses alike, Small Bridges transforms a written prompt into finished
                  footage. The studio spans text-to-video and image-to-video generation, lifelike AI avatars, and AI
                  music scoring, and it strings individual shots into multi-scene films while preserving character
                  consistency from one cut to the next — long one of the hardest problems in generative video. The
                  result is a single workspace where an idea becomes a watchable scene in minutes.
                </p>
                <p>
                  Under the hood, Small Bridges orchestrates the leading video models — including Kling V3, Seedance,
                  and Wan — and routes each shot to the engine best suited to it, so creators get state-of-the-art
                  output without choosing or managing models themselves. Everything runs in the browser, with no
                  downloads, plug-ins, or specialized hardware.
                </p>
                <p>
                  The launch arrives as demand for short-form cinematic video outpaces the cost and complexity of
                  traditional production. By pairing a free first clip with transparent, pay-as-you-go pricing, Small
                  Bridges is betting that the next wave of filmmakers will start with a prompt rather than a budget.
                </p>

                <blockquote className="my-8 rounded-2xl border-l-2 border-indigo-400/70 bg-white/[0.03] py-5 pl-6 pr-5">
                  <Quote className="w-7 h-7 text-white/20 mb-3" />
                  <p className="text-white/90 text-lg leading-relaxed italic">
                    “We started Small Bridges because the best storytelling tools were locked behind studios and steep
                    learning curves. Giving every new filmmaker their first cinematic clip for free is how we prove the
                    point: if you can describe a scene, you can make one.”
                  </p>
                  <footer className="mt-4 text-sm text-white/55 not-italic">— A Small Bridges spokesperson</footer>
                </blockquote>

                <p>
                  <span className="text-white font-semibold">Availability and pricing.</span> Small Bridges is available
                  now at smallbridges.co. Every creator's first five-second video is free on the Wan engine; beyond
                  that, the studio runs on pay-as-you-go credits, with optional monthly plans for higher volume — Indie
                  at $19, Pro at $49, and Studio at $149 per month.
                </p>
              </div>

              {/* Boilerplate */}
              <div className="mt-12 rounded-2xl border border-white/[0.07] bg-black/40 p-6 sm:p-8 max-w-3xl">
                <h3 className="text-sm font-semibold tracking-wide text-white/90">About Small Bridges</h3>
                <p className="mt-3 text-[14.5px] leading-[1.7] text-white/65">
                  Small Bridges makes cinematic, studio-grade video generation accessible to any creator or business. Its
                  browser-based studio turns a single prompt into finished film — text-to-video, image-to-video, AI
                  avatars, AI music scoring, and multi-scene stories with consistent characters — powered by leading
                  models including Kling V3, Seedance, and Wan. By starting every filmmaker with a free clip and
                  transparent pay-as-you-go pricing, the company is building a world where anyone can direct. Small
                  Bridges is built by Small Bridges-studio LLC, a Missouri company.
                </p>
                <p className="mt-5 text-[13px] text-white/45">
                  Media contact:{" "}
                  <a href="mailto:cole@smallbridges.co" className="text-white/70 underline-offset-4 hover:underline">
                    cole@smallbridges.co
                  </a>
                  <span className="mx-2 text-white/25">·</span># # #
                </p>
              </div>
            </div>
          </article>
        </motion.section>

        {/* ── 2. Company at a glance ────────────────────────────────── */}
        <motion.section {...sectionFade} className="mt-20">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/45">Fast facts</span>
            <span className="h-px flex-1 bg-white/[0.08]" />
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-[-0.02em]">Company at a glance</h2>
          <p className="mt-3 text-white/55 max-w-2xl">The essentials, ready to quote.</p>

          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FAST_FACTS.map((fact) => (
              <div
                key={fact.label}
                className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6 transition-colors hover:border-white/[0.14]"
              >
                <div className="flex items-center gap-2.5 text-white/45">
                  <fact.icon className="w-4 h-4" />
                  <span className="text-[11px] font-mono uppercase tracking-[0.22em]">{fact.label}</span>
                </div>
                <div className="mt-3 text-lg font-semibold tracking-[-0.01em]">{fact.value}</div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── 3. Media kit / brand assets ───────────────────────────── */}
        <motion.section {...sectionFade} className="mt-20">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/45">Media kit</span>
            <span className="h-px flex-1 bg-white/[0.08]" />
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-[-0.02em]">Brand assets &amp; screenshots</h2>
          <p className="mt-3 text-white/55 max-w-2xl">
            Logos, social cards, and product screenshots, cleared for editorial use. Please don't alter the marks.
          </p>

          {/* Product screenshots */}
          <div className="mt-8 grid md:grid-cols-2 gap-5">
            {PRODUCT_SHOTS.map((shot) => (
              <figure
                key={shot.src}
                className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]"
              >
                <img
                  src={shot.src}
                  alt={shot.caption}
                  loading="lazy"
                  className="aspect-video w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <figcaption className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 p-4">
                  <span className="text-[13px] text-white/85">{shot.caption}</span>
                  <a
                    href={shot.src}
                    download
                    className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/50 px-3 py-1.5 text-[11px] text-white/85 backdrop-blur-md transition-colors hover:bg-white/15"
                  >
                    <Download className="w-3.5 h-3.5" /> Download
                  </a>
                </figcaption>
              </figure>
            ))}
          </div>

          {/* Asset download tiles */}
          <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {MEDIA_KIT.map((asset) => (
              <div
                key={asset.title}
                className="flex flex-col rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6 transition-colors hover:border-white/[0.14]"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03]">
                  {asset.isLogo ? (
                    <Logo size="sm" />
                  ) : (
                    asset.icon && <asset.icon className="w-5 h-5 text-white/70" />
                  )}
                </div>
                <h3 className="font-semibold">{asset.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-white/55 flex-1">{asset.desc}</p>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="mt-5 gap-2 rounded-xl border-white/15 bg-transparent text-white hover:bg-white/[0.07]"
                >
                  <a href={asset.href} download>
                    <Download className="w-4 h-4" /> {asset.cta}
                  </a>
                </Button>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── 4. Press contact ──────────────────────────────────────── */}
        <motion.section {...sectionFade} className="mt-20 mb-8">
          <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.025] p-10 sm:p-14 text-center">
            <div aria-hidden className="pointer-events-none absolute -bottom-24 left-1/2 -translate-x-1/2 w-[520px] h-[320px] rounded-full bg-indigo-500/10 blur-[130px]" />
            <div className="relative mx-auto max-w-xl">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.1] bg-white/[0.04]">
                <Mail className="w-6 h-6 text-white/80" />
              </div>
              <h2 className="mt-6 font-display text-3xl sm:text-4xl font-bold tracking-[-0.02em]">Press contact</h2>
              <p className="mt-3 text-white/60 leading-relaxed">
                For interviews, review access, fact-checking, or partnership inquiries, reach the Small Bridges team
                directly. We typically respond within one business day.
              </p>
              <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button asChild size="lg" className="rounded-2xl gap-2">
                  <a href="mailto:cole@smallbridges.co">
                    <Mail className="w-5 h-5" /> cole@smallbridges.co
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-2xl gap-2 border-white/15 bg-transparent text-white hover:bg-white/[0.07]">
                  <Link to="/contact">
                    Contact page <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </motion.section>
      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-white/[0.06]">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Logo size="sm" />
              <span className="text-sm text-white/45">© 2026 Small Bridges-studio LLC. All rights reserved.</span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <Link to="/privacy" className="text-white/45 hover:text-white transition-colors">Privacy</Link>
              <Link to="/terms" className="text-white/45 hover:text-white transition-colors">Terms</Link>
              <Link to="/blog" className="text-white/45 hover:text-white transition-colors">Blog</Link>
              <Link to="/contact" className="text-white/45 hover:text-white transition-colors">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
