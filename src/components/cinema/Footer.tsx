/**
 * Footer — the shared, premium site footer (used on the landing and every
 * marketing/blog/legal page).
 *
 * A film-studio nameplate: a closing CTA band, a brand + working newsletter
 * block with scale stats and a live "studio online" pulse, three link columns
 * with accent underline hovers, and a bottom bar with the Missouri entity line
 * + engine credits, behind a large editorial wordmark watermark. Dark, single
 * blue accent, Fraunces. Internal links use the router.
 *
 * (Social links are intentionally omitted until the accounts are live.)
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandTile } from "./Logo";
import { ACCENT } from "./ui";

const COLUMNS: { title: string; links: { label: string; to: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "How it works", to: "/how-it-works" },
      { label: "Pricing", to: "/pricing" },
      { label: "Templates", to: "/how-it-works#templates" },
      { label: "Avatars", to: "/studio-showcase#cast" },
      { label: "Developers", to: "/how-it-works#developers" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Inside the Studio", to: "/studio-showcase" },
      { label: "Blog", to: "/blog" },
      { label: "Press", to: "/press" },
      { label: "Contact", to: "/contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", to: "/privacy" },
      { label: "Terms", to: "/terms" },
      { label: "Unsubscribe", to: "/unsubscribe" },
    ],
  },
];

const ENGINES = ["Wan 2.5", "Kling V3", "Seedance 2.0", "Veo 3", "Runway Gen-4", "Sora 2"];

function FootLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="inline-flex w-fit py-0.5 text-[14px] font-light text-white/55 transition-colors duration-200 hover:text-white">
      {children}
    </Link>
  );
}

function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === "loading") return;
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) { setState("error"); setMsg("Enter a valid email."); return; }
    setState("loading"); setMsg("");
    try {
      const { data, error } = await supabase.functions.invoke("newsletter-subscribe", { body: { email: value, source: "footer" } });
      if (error || (data && (data as { error?: string }).error)) throw new Error((data as { error?: string })?.error || "Failed");
      setState("done"); setEmail("");
    } catch (err) {
      setState("error"); setMsg(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  if (state === "done") {
    return (
      <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/[0.06] py-2.5 pl-4 pr-5 text-[13px] text-emerald-300">
        <Check className="h-4 w-4" /> You're on the list — check your inbox.
      </div>
    );
  }
  return (
    <>
      <form onSubmit={submit} className="relative mt-3 max-w-sm">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (state === "error") setState("idle"); }}
          placeholder="you@studio.com"
          aria-label="Email address"
          className="h-12 w-full rounded-full border border-white/12 bg-white/[0.04] pl-5 pr-[7.5rem] text-[14px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/25"
          style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}
        />
        <button type="submit" disabled={state === "loading"} className="group absolute right-1.5 top-1.5 inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-medium text-[#0a0b0e] transition-colors hover:bg-white/90 disabled:opacity-60">
          {state === "loading" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <>Subscribe <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" /></>}
        </button>
      </form>
      {state === "error" && <p className="mt-2 text-[12px] text-rose-300">{msg}</p>}
    </>
  );
}

export function Footer({ showClosingCta = true }: { showClosingCta?: boolean }) {
  const year = new Date().getFullYear();
  return (
    <footer className="relative isolate overflow-hidden border-t border-white/10 text-white">
      {/* Transparent so the footer adopts the backdrop of whatever page it sits
          on — with only a 70% dark blind on top for legibility. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-black/70" />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-5 sm:px-8">
        {/* ── closing CTA band (hidden on the landing, which has its own CTAs) ── */}
        {showClosingCta && (
          <div className="flex flex-col items-start gap-8 border-b border-white/10 py-14 md:flex-row md:items-center md:justify-between md:py-16">
            <div className="max-w-xl">
              <span className="font-mono text-[11px] uppercase tracking-[0.34em]" style={{ color: `hsl(${ACCENT})` }}>Ready when you are</span>
              <h2 className="mt-3 font-display text-[clamp(2rem,4.6vw,3.2rem)] font-semibold leading-[1.02] tracking-[-0.03em] text-white">
                It starts with a <span className="italic">sentence</span>.
              </h2>
              <p className="mt-3 text-[14px] font-light text-white/50">Your first 5-second video is free.</p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <Link to="/auth?mode=signup" className="group inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-[14.5px] font-semibold text-[#0a0b0e] transition-transform duration-200 hover:-translate-y-0.5" style={{ boxShadow: `0 18px 50px -18px hsl(${ACCENT} / 0.9)` }}>
                Start creating
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
              <Link to="/pricing" className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[14.5px] font-medium text-white ring-1 ring-white/15 backdrop-blur-md transition-colors hover:bg-white/[0.06]">
                View pricing
              </Link>
            </div>
          </div>
        )}

        {/* ── brand + columns ── */}
        <div className="grid gap-x-10 gap-y-12 py-14 md:py-16 lg:grid-cols-[1.35fr_2fr]">
          <div>
            <Link to="/" className="inline-flex items-center gap-3">
              <BrandTile className="h-10 w-10" />
              <span className="font-display text-[20px] tracking-tight text-white">Small <span className="font-semibold italic">Bridges</span></span>
            </Link>
            <p className="mt-5 max-w-xs text-[14px] font-light leading-relaxed text-white/55">The AI film studio in a sentence. Describe it — we cast, score, and cut a finished film.</p>

            <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.24em] text-white/45">New films, features &amp; prompts — monthly</p>
            <NewsletterForm />

            <div className="mt-6 inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.03] py-1.5 pl-3 pr-3.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: `hsl(${ACCENT})` }} />
                <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: `hsl(${ACCENT})` }} />
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/55">Studio online</span>
            </div>
          </div>

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
        <div className="flex flex-col gap-4 border-t border-white/10 py-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-5">
            <p className="font-mono text-[11px] tracking-wide text-white/40">© {year} Small Bridges Studio LLC · Made in Missouri, USA</p>
            <a href="mailto:cole@smallbridges.co" className="font-mono text-[11px] tracking-wide text-white/35 transition-colors hover:text-white/70">cole@smallbridges.co</a>
          </div>
          <p className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-white/30 sm:flex sm:items-center sm:gap-1.5">
            Engines
            <span className="text-white/45">{ENGINES.join(" · ")}</span>
          </p>
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
