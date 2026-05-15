import { ReactNode, useEffect, useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Sparkles, Film, Scissors, Layers, GraduationCap, User as UserIcon,
  Code2, ArrowRight, ChevronLeft, ChevronRight, Zap, Settings, LogOut,
  Clapperboard, Compass,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import logoImage from "@/assets/apex-studio-logo.webp";

const RAIL_KEY = "apex.director-rail.collapsed";

interface NavItem { label: string; to: string; icon: typeof Film; }

const NAV: NavItem[] = [
  { label: "Library",   to: "/projects",       icon: Film },
  { label: "Create",    to: "/create",         icon: Sparkles },
  { label: "Editor",    to: "/editor",         icon: Scissors },
  { label: "Avatars",   to: "/avatars",        icon: UserIcon },
  { label: "Templates", to: "/templates",      icon: Layers },
  { label: "Training",  to: "/training-video", icon: GraduationCap },
  { label: "Developers",to: "/developers",     icon: Code2 },
];

interface Props {
  children: ReactNode;
  /** Optional content rendered above the main viewport (e.g. cinematic header). */
  topSlot?: ReactNode;
}

export function DirectorShell({ children, topSlot }: Props) {
  const { profile } = useAuth();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(RAIL_KEY) === "1"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(RAIL_KEY, collapsed ? "1" : "0"); } catch { /* noop */ }
  }, [collapsed]);

  const credits = profile?.credits_balance?.toLocaleString() ?? "0";
  const railWidth = collapsed ? "w-[78px]" : "w-[260px]";

  return (
    <TooltipProvider delayDuration={120}>
      <div className="relative flex min-h-screen w-full text-white" style={{ background: "hsl(220 14% 2%)" }}>
        {/* Page-level ambient orbs (behind everything) */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute -top-40 -left-32 w-[640px] h-[640px] rounded-full"
            style={{ background: "radial-gradient(circle, hsla(212,100%,55%,0.18), transparent 60%)" }}
            animate={{ x: [0, 60, 0], y: [0, 40, 0] }}
            transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -bottom-40 -right-32 w-[640px] h-[640px] rounded-full"
            style={{ background: "radial-gradient(circle, hsla(195,100%,60%,0.14), transparent 60%)" }}
            animate={{ x: [0, -50, 0], y: [0, -30, 0] }}
            transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* Faint grain */}
          <div
            className="absolute inset-0 opacity-[0.035] mix-blend-overlay"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
            }}
          />
        </div>

        {/* ── Premium Glass Rail ── */}
        <aside
          className={cn(
            "relative z-20 hidden lg:flex flex-col shrink-0 transition-[width] duration-300 ease-out",
            railWidth,
          )}
        >
          {/* Glass surface */}
          <div
            className="absolute inset-y-3 left-3 right-0 rounded-2xl overflow-hidden"
            style={{
              background:
                "linear-gradient(180deg, hsla(220,18%,5%,0.78) 0%, hsla(220,16%,3%,0.82) 100%)",
              border: "1px solid hsla(0,0%,100%,0.06)",
              backdropFilter: "blur(28px) saturate(160%)",
              WebkitBackdropFilter: "blur(28px) saturate(160%)",
              boxShadow:
                "0 24px 60px -24px hsla(212,100%,40%,0.35), inset 0 1px 0 hsla(0,0%,100%,0.06)",
            }}
          >
            {/* Top hairline */}
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            {/* Inner accent halo */}
            <div
              aria-hidden
              className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full opacity-60"
              style={{
                background: "radial-gradient(closest-side, hsla(212,100%,60%,0.22), transparent 70%)",
                filter: "blur(28px)",
              }}
            />
          </div>

          {/* Rail content */}
          <div className="relative flex flex-1 flex-col min-h-0 px-3 py-5 ml-3">
            {/* Brand */}
            <Link to="/projects" className={cn("group flex items-center gap-3 mb-6 px-2", collapsed && "justify-center px-0")}>
              <div className="relative shrink-0">
                <div className="absolute -inset-1.5 rounded-2xl opacity-60 blur-md transition-opacity group-hover:opacity-100"
                  style={{ background: "radial-gradient(circle, hsla(212,100%,60%,0.45), transparent 70%)" }} />
                <div className="relative w-10 h-10 rounded-2xl flex items-center justify-center overflow-hidden"
                  style={{
                    background: "linear-gradient(135deg, hsla(0,0%,100%,0.08), hsla(0,0%,100%,0.02))",
                    border: "1px solid hsla(0,0%,100%,0.10)",
                    boxShadow: "inset 0 1px 0 hsla(0,0%,100%,0.10)",
                  }}>
                  <img src={logoImage} alt="Apex" className="w-6 h-6 object-contain opacity-95" />
                </div>
              </div>
              {!collapsed && (
                <div className="flex flex-col min-w-0 leading-none">
                  <span
                    className="text-[17px] font-semibold tracking-tight"
                    style={{
                      fontFamily: "'Fraunces', serif",
                      background: "linear-gradient(180deg, #ffffff 0%, #9DCBFF 60%, #0A84FF 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    Apex Studio
                  </span>
                  <span className="mt-1.5 text-[9px] uppercase tracking-[0.32em] text-white/35">
                    Director Suite
                  </span>
                </div>
              )}
            </Link>

            {/* Eyebrow chip */}
            {!collapsed && (
              <div className="mx-2 mb-4 inline-flex items-center gap-2 px-2.5 py-1 rounded-full self-start"
                style={{
                  border: "1px solid hsla(0,0%,100%,0.10)",
                  background: "hsla(0,0%,100%,0.03)",
                  backdropFilter: "blur(8px)",
                }}>
                <Sparkles className="w-3 h-3 text-[#9DCBFF]" />
                <span className="text-[9.5px] tracking-[0.3em] uppercase text-white/65 font-medium">
                  Workspace
                </span>
              </div>
            )}

            {/* Nav */}
            <nav className="flex-1 space-y-1 overflow-y-auto scrollbar-hide -mx-1 px-1">
              {NAV.map((item) => {
                const active =
                  pathname === item.to ||
                  (item.to !== "/" && pathname.startsWith(item.to + "/")) ||
                  (item.to === "/create" && pathname === "/create");
                const Icon = item.icon;
                const link = (
                  <NavLink
                    to={item.to}
                    className={cn(
                      "group relative flex items-center gap-3 h-11 rounded-xl px-3 transition-all duration-300 overflow-hidden",
                      active ? "text-white" : "text-white/55 hover:text-white",
                      collapsed && "justify-center px-0",
                    )}
                    style={
                      active
                        ? {
                            background:
                              "linear-gradient(180deg, hsla(212,100%,55%,0.16), hsla(212,100%,40%,0.04))",
                            border: "1px solid hsla(212,100%,60%,0.28)",
                            boxShadow:
                              "inset 0 1px 0 hsla(0,0%,100%,0.08), 0 12px 28px -16px hsla(212,100%,55%,0.55)",
                          }
                        : { border: "1px solid transparent" }
                    }
                  >
                    {/* Hover radial glow */}
                    {!active && (
                      <span
                        aria-hidden
                        className="absolute -inset-px rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                        style={{
                          background:
                            "radial-gradient(circle at 50% 0%, hsla(212,100%,60%,0.22), transparent 65%)",
                        }}
                      />
                    )}
                    {active && (
                      <>
                        <span
                          aria-hidden
                          className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[2px] rounded-r-full"
                          style={{
                            background:
                              "linear-gradient(180deg, #9DCBFF 0%, #0A84FF 100%)",
                            boxShadow: "0 0 18px hsla(212,100%,60%,0.85)",
                          }}
                        />
                        <span aria-hidden className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#9DCBFF]/40 to-transparent" />
                      </>
                    )}
                    <Icon
                      className="relative w-[18px] h-[18px] shrink-0 transition-transform duration-300 group-hover:scale-[1.08]"
                      strokeWidth={1.5}
                      style={{
                        color: active ? "#9DCBFF" : "hsla(0,0%,100%,0.55)",
                        filter: active ? "drop-shadow(0 0 10px hsla(212,100%,60%,0.7))" : undefined,
                      }}
                    />
                    {!collapsed && (
                      <span className="relative text-[13px] font-light tracking-[-0.005em] truncate"
                        style={{ fontFamily: "'Fraunces', serif" }}>
                        {item.label}
                      </span>
                    )}
                    {active && !collapsed && (
                      <span aria-hidden className="ml-auto h-1.5 w-1.5 rounded-full"
                        style={{ background: "#9DCBFF", boxShadow: "0 0 12px #0A84FF" }} />
                    )}
                  </NavLink>
                );
                return collapsed ? (
                  <Tooltip key={item.to}>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right" sideOffset={12} className="bg-black/90 border-white/10 text-[12px]">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                ) : <div key={item.to}>{link}</div>;
              })}
            </nav>

            {/* Premium CTA card */}
            {!collapsed ? (
              <div
                className="relative mt-4 rounded-2xl p-4 overflow-hidden"
                style={{
                  background:
                    "linear-gradient(135deg, hsla(212,100%,55%,0.18) 0%, hsla(195,100%,60%,0.10) 60%, hsla(220,16%,5%,0.40) 100%)",
                  border: "1px solid hsla(212,100%,60%,0.28)",
                  boxShadow:
                    "inset 0 1px 0 hsla(0,0%,100%,0.10), 0 16px 40px -20px hsla(212,100%,55%,0.55)",
                }}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute -top-10 -right-6 w-28 h-28 rounded-full blur-2xl"
                  style={{ background: "radial-gradient(circle, hsla(195,100%,65%,0.55), transparent 70%)" }}
                />
                <div className="relative inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8.5px] tracking-[0.28em] uppercase font-semibold text-white"
                  style={{
                    background: "linear-gradient(90deg, #0A84FF, #5AC8FA)",
                    boxShadow: "0 0 16px hsla(212,100%,55%,0.55)",
                  }}>
                  Bespoke
                </div>
                <div
                  className="relative mt-3 text-[19px] leading-tight font-semibold"
                  style={{
                    fontFamily: "'Fraunces', serif",
                    background: "linear-gradient(180deg, #fff, #9DCBFF 60%, #0A84FF)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  Director Mode
                </div>
                <p className="relative mt-1 text-[11.5px] leading-snug text-white/60 font-light">
                  Hand-crafted shots, identity-locked actors, score in sync.
                </p>
                <NavLink to="/create" className="relative mt-3 inline-flex items-center gap-1 text-[10.5px] tracking-[0.2em] uppercase text-[#9DCBFF] hover:text-white transition-colors">
                  Begin <ArrowRight className="w-3 h-3" />
                </NavLink>
              </div>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <NavLink to="/create" className="mt-4 mx-auto w-11 h-11 rounded-2xl flex items-center justify-center"
                    style={{
                      background: "linear-gradient(135deg, hsla(212,100%,55%,0.45), hsla(195,100%,60%,0.20))",
                      border: "1px solid hsla(212,100%,65%,0.35)",
                      boxShadow: "0 0 18px hsla(212,100%,55%,0.55), inset 0 1px 0 hsla(0,0%,100%,0.18)",
                    }}>
                    <Sparkles className="w-4 h-4" strokeWidth={1.8} />
                  </NavLink>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={12}>Director Mode</TooltipContent>
              </Tooltip>
            )}

            {/* Footer */}
            <div className="mt-3 space-y-1.5">
              <NavLink
                to="/credits"
                className={cn(
                  "group relative flex items-center gap-2.5 h-10 rounded-full px-3 overflow-hidden transition-all",
                  collapsed && "justify-center px-0",
                )}
                style={{
                  background: "linear-gradient(90deg, hsla(42,30%,12%,0.55), hsla(42,20%,6%,0.30))",
                  border: "1px solid hsla(42,80%,55%,0.20)",
                  boxShadow: "inset 0 1px 0 hsla(0,0%,100%,0.06)",
                }}
              >
                <div className="relative shrink-0">
                  <div className="absolute inset-0 rounded-full blur-[8px] opacity-80 bg-[hsl(42_100%_55%/0.4)]" />
                  <div className="relative w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #FFD27A, #E89B2A)" }}>
                    <Zap className="w-2.5 h-2.5 text-white" strokeWidth={2.5} />
                  </div>
                </div>
                {!collapsed && (
                  <div className="flex-1 flex items-center justify-between min-w-0">
                    <span className="text-[9.5px] uppercase tracking-[0.24em] text-white/40">Credits</span>
                    <span className="text-[13.5px] font-light tabular-nums text-[hsl(42_100%_75%)]">{credits}</span>
                  </div>
                )}
              </NavLink>

              <button
                onClick={() => setCollapsed(c => !c)}
                className={cn(
                  "w-full flex items-center gap-2 h-8 rounded-full px-3 text-[9.5px] uppercase tracking-[0.24em] text-white/35 hover:text-white/70 hover:bg-white/[0.04] transition-all",
                  collapsed && "justify-center px-0",
                )}
                aria-label={collapsed ? "Expand" : "Collapse"}
              >
                {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : (
                  <><ChevronLeft className="w-3.5 h-3.5" /> Collapse</>
                )}
              </button>
            </div>
          </div>
        </aside>

        {/* ── Main viewport ── */}
        <div className="relative z-10 flex-1 min-w-0 flex flex-col">
          {topSlot}
          <main className="flex-1 min-w-0 min-h-screen">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
