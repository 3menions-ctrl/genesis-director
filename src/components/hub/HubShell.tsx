/**
 * HubShell — chrome shared by Lobby, Watch, Market, Music, Crews.
 *
 * It's the visible identity of the consumer-facing surfaces and the way
 * users move between them. Living header with persistent top nav, a
 * left-rail of "Channel Worlds" when the active surface is the Lobby/Watch
 * cluster, ambient backdrop, and a slim status pill in the corner.
 *
 * Design notes:
 *   • Editorial Noir → push toward cinematic. Header is taller, gives the
 *     page room to breathe.
 *   • The active surface is reflected in the chrome — accent colour from
 *     the channel world bleeds into highlights when one is active.
 *   • All nav is one-click reachable; ⌘K opens a global jump palette.
 */
import { ReactNode, useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Film, ShoppingBag, Music2, Users, Sparkles, Search, Tv, Layers,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";

interface HubShellProps {
  /** Optional accent override (HSL string e.g. "213 100% 53%") — usually
   *  inherited from the active channel world. */
  accentHsl?: string;
  /** Slim eyebrow rendered above the main content. */
  eyebrow?: string;
  children: ReactNode;
  /** When true, removes the inner page padding so the child can render its
   *  own full-bleed canvas (used by the Theater). */
  fullBleed?: boolean;
  hideSidebar?: boolean;
}

const NAV: Array<{ label: string; to: string; icon: React.ElementType }> = [
  { label: "Lobby",  to: "/lobby",  icon: Tv },
  { label: "Music",  to: "/music",  icon: Music2 },
  { label: "Market", to: "/market", icon: ShoppingBag },
  { label: "Crews",  to: "/crews",  icon: Users },
  { label: "Studio", to: "/projects", icon: Film },
];

export function HubShell({ accentHsl, eyebrow, children, fullBleed = false, hideSidebar = false }: HubShellProps) {
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const accentStyle = accentHsl ? ({ "--hub-accent": accentHsl } as React.CSSProperties) : undefined;

  return (
    <div
      className="min-h-screen text-white relative"
      style={{
        background: "#040506",
        ...(accentStyle ?? {}),
      }}
    >
      {/* Ambient backdrop — atmospheric glow + grain */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute -top-60 right-0 w-[900px] h-[900px] rounded-full opacity-50"
          style={{
            background: `radial-gradient(circle, hsla(${accentHsl ?? "213 100% 60%"} / 0.10), transparent 65%)`,
            filter: "blur(80px)",
          }}
        />
        <div
          className="absolute -bottom-40 -left-20 w-[700px] h-[700px] rounded-full opacity-30"
          style={{
            background: `radial-gradient(circle, hsla(${accentHsl ?? "213 100% 60%"} / 0.06), transparent 70%)`,
            filter: "blur(100px)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
          style={{ backgroundImage: "url('https://grainy-gradients.vercel.app/noise.svg')" }}
        />
      </div>

      {/* Header */}
      <header
        className={cn(
          "sticky top-0 z-50 transition-all duration-300",
          scrolled
            ? "bg-[#040506]/85 backdrop-blur-xl border-b border-white/[0.06]"
            : "bg-transparent border-b border-transparent",
        )}
      >
        <div className="max-w-[1600px] mx-auto px-6 lg:px-10 h-16 flex items-center gap-8">
          <Link to="/lobby" className="flex items-center gap-2 shrink-0">
            <Logo size="sm" />
            <span className="hidden md:inline font-mono text-[10px] uppercase tracking-[0.32em] text-white/55">
              Small Bridges
            </span>
          </Link>

          <nav className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto">
            {NAV.map((n) => {
              const Icon = n.icon;
              return (
                <NavLink
                  key={n.to}
                  to={n.to}
                  className={({ isActive }) =>
                    cn(
                      "group relative inline-flex items-center gap-2 px-3.5 h-9 rounded-full transition-colors shrink-0",
                      "text-[12px] font-mono uppercase tracking-[0.22em]",
                      isActive
                        ? "text-white bg-white/[0.05] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                        : "text-white/45 hover:text-white hover:bg-white/[0.03]",
                    )
                  }
                >
                  <Icon className="w-3.5 h-3.5" />
                  {n.label}
                  <span
                    aria-hidden
                    className="absolute -bottom-px left-3 right-3 h-px rounded-full opacity-0 group-[.active]:opacity-100"
                    style={{ background: `hsl(var(--hub-accent, 213 100% 60%))`, boxShadow: `0 0 8px hsl(var(--hub-accent, 213 100% 60%))` }}
                  />
                </NavLink>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={() => {
              // Re-use the same ⌘K binding the admin palette listens to.
              // (Lightweight cross-surface palette can be added later — for
              // now this just hints the affordance.)
              document.dispatchEvent(
                new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
              );
            }}
            className="hidden md:flex items-center gap-2 px-3 h-8 rounded-full border border-white/[0.08] hover:border-white/20 hover:text-white text-white/55 transition-colors shrink-0"
            title="Search (⌘K)"
          >
            <Search className="w-3 h-3" />
            <span className="text-[11px] font-mono tracking-[0.12em]">Search</span>
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-white/[0.08] text-white/55">⌘K</kbd>
          </button>
        </div>

        {eyebrow && (
          <div className="border-t border-white/[0.04] bg-white/[0.01]">
            <div className="max-w-[1600px] mx-auto px-6 lg:px-10 h-8 flex items-center text-[10px] font-mono uppercase tracking-[0.32em] text-white/35">
              <Sparkles className="w-3 h-3 mr-2 shrink-0" style={{ color: `hsl(${accentHsl ?? "213 100% 60%"})` }} />
              {eyebrow}
            </div>
          </div>
        )}
      </header>

      {/* Body */}
      <main className={cn("relative z-10", !fullBleed && "max-w-[1600px] mx-auto px-6 lg:px-10 pb-24 pt-8")}>
        {children}
      </main>
    </div>
  );
}

/** Section heading for use inside hub bodies. */
export function HubSectionLabel({ label, meta, icon: Icon }: { label: string; meta?: string; icon?: React.ElementType }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      {Icon ? <Icon className="w-3.5 h-3.5 text-white/45" /> : <Layers className="w-3.5 h-3.5 text-white/45" />}
      <span className="text-[11px] font-mono uppercase tracking-[0.32em] text-white/55">{label}</span>
      <div className="h-px flex-1 bg-white/[0.05]" />
      {meta && <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/30">{meta}</span>}
    </div>
  );
}
