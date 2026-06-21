/**
 * BusinessRail — the /business navigation rail.
 *
 * A faithful copy of the regular account's LeftRail design: a floating pull
 * handle, a frosted-glass slide-in drawer, an italic display header, and
 * grouped, expandable nav. It shares the same `useLeftRail` open/close store
 * so it behaves identically — only the contents are business-specific
 * (workspace switcher + Operate/Govern/Optimize/Extend/Settings groups,
 * role-gated via useWorkspace).
 */
import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronRight, Lock, Building2, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_PREMIUM, TYPE_META } from "@/lib/design-system";
import { useLeftRail } from "@/hooks/useLeftRail";
import { LEFT_RAIL_WIDTH } from "@/lib/left-rail-store";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { BUSINESS_NAV, BUSINESS_NAV_ITEMS, type BusinessNavGroup, type BusinessNavItem } from "./businessNav";

const HANDLE_SIZE = 56;
const HANDLE_OFFSET_CLOSED = 14;
const EXPANDED_KEY = "smallbridges.businessRail.expanded";

function readExpanded(): Set<string> {
  if (typeof window === "undefined") return new Set(["Operate"]);
  try {
    const raw = window.localStorage.getItem(EXPANDED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set(["Operate"]);
  } catch { return new Set(["Operate"]); }
}

export function BusinessRail() {
  const { open, setOpen, toggle } = useLeftRail();
  const { pathname } = useLocation();
  const reducedMotion = useReducedMotion();
  const { currentOrg, organizations, switchOrg, hasPermission } = useWorkspace();
  const [expanded, setExpanded] = useState<Set<string>>(readExpanded);
  const [orgOpen, setOrgOpen] = useState(false);

  // Which group + item is active for the current route.
  const { activeGroup, activeItemTo } = useMemo(() => {
    let best: BusinessNavItem | null = null;
    for (const it of BUSINESS_NAV_ITEMS) {
      const match = it.to === "/business" ? pathname === "/business" : pathname.startsWith(it.to);
      if (match && (!best || it.to.length > best.to.length)) best = it;
    }
    const grp = BUSINESS_NAV.find((g) => g.items.some((i) => i.to === best?.to));
    return { activeGroup: grp?.label ?? "Operate", activeItemTo: best?.to ?? "/business" };
  }, [pathname]);

  useEffect(() => {
    try { window.localStorage.setItem(EXPANDED_KEY, JSON.stringify(Array.from(expanded))); } catch { /* ignore */ }
  }, [expanded]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  const effectiveExpanded = useMemo(() => new Set(expanded).add(activeGroup), [expanded, activeGroup]);
  const toggleGroup = (id: string) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const handleLeft = open ? LEFT_RAIL_WIDTH - HANDLE_SIZE / 2 : HANDLE_OFFSET_CLOSED;
  const orgInitials = (currentOrg?.name ?? "SB").split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-[hsl(220_30%_2%/0.35)] md:pointer-events-none md:bg-transparent"
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Pull handle */}
      <motion.button
        type="button" onClick={toggle}
        aria-label={open ? "Collapse navigation" : "Expand navigation"} aria-expanded={open}
        initial={false} animate={{ left: handleLeft }}
        transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 32 }}
        style={{ width: HANDLE_SIZE, height: HANDLE_SIZE }}
        className={cn(
          "fixed top-1/2 -translate-y-1/2 z-50 rounded-full border border-white/[0.18]",
          "bg-gradient-to-br from-white/[0.18] via-white/[0.10] to-white/[0.05] backdrop-blur-2xl",
          "shadow-[0_24px_70px_-18px_hsl(0_0%_0%/0.85),0_0_0_1px_hsl(var(--accent)/0.14),inset_0_1px_0_hsl(0_0%_100%/0.24),0_0_40px_-12px_hsl(var(--accent)/0.40)]",
          "hover:shadow-[0_28px_80px_-16px_hsl(0_0%_0%/0.9),0_0_0_1px_hsl(var(--accent)/0.35),inset_0_1px_0_hsl(0_0%_100%/0.32),0_0_60px_-12px_hsl(var(--accent)/0.7)]",
          "inline-flex items-center justify-center group/handle transition-shadow",
        )}
      >
        <span aria-hidden className="pointer-events-none absolute inset-1 rounded-full ring-1 ring-inset ring-white/[0.06]" />
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 28 }} className="relative inline-flex">
          <ChevronRight className="h-7 w-7 text-foreground/95 group-hover/handle:text-accent transition-colors" strokeWidth={2.2} />
        </motion.span>
      </motion.button>

      {/* Frosted drawer */}
      <AnimatePresence>
        {open && (
          <motion.aside
            key="business-rail"
            initial={reducedMotion ? { opacity: 0 } : { x: -LEFT_RAIL_WIDTH, opacity: 0.4 }}
            animate={{ x: 0, opacity: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { x: -LEFT_RAIL_WIDTH, opacity: 0.4 }}
            transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 240, damping: 30 }}
            style={{
              width: LEFT_RAIL_WIDTH,
              backgroundColor: "hsl(220 30% 6% / 0.18)",
              backgroundImage: "linear-gradient(180deg, hsl(0 0% 100% / 0.06) 0%, transparent 25%, transparent 75%, hsl(0 0% 100% / 0.03) 100%)",
              boxShadow: "30px 0 80px -40px hsl(0 0% 0% / 0.6), inset 0 1px 0 hsl(0 0% 100% / 0.08), inset -1px 0 0 hsl(0 0% 100% / 0.08)",
              backdropFilter: "blur(32px) saturate(1.6)",
              WebkitBackdropFilter: "blur(32px) saturate(1.6)",
            }}
            className="fixed top-0 left-0 z-40 h-[100dvh] overflow-hidden"
            aria-label="Business navigation"
          >
            <div className="relative flex h-full flex-col">
              {/* Header */}
              <header className="shrink-0 px-6 pt-8 pb-4">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inset-0 rounded-full bg-accent/60 animate-ping opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
                  </span>
                  <span className={cn(TYPE_META, "text-muted-foreground/60 tracking-[0.32em]")}>◆ Business</span>
                </div>
                <h2 className="mt-3 font-display italic text-[28px] font-light leading-[1.05] tracking-tight" style={{ fontFamily: "'Fraunces', serif" }}>
                  <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/65 bg-clip-text text-transparent">Workspace.</span>
                </h2>
                <p className={cn(TYPE_META, "mt-2 text-muted-foreground/45 tracking-[0.22em]")}>
                  You are in · <span className="text-accent/85">{activeGroup}</span>
                </p>
              </header>

              {/* Org switcher */}
              <div className="px-4 pb-3">
                <Popover open={orgOpen} onOpenChange={setOrgOpen}>
                  <PopoverTrigger asChild>
                    <button className="group w-full flex items-center gap-2.5 px-3 h-12 rounded-2xl text-left ring-1 ring-white/[0.08] hover:ring-white/15 bg-white/[0.02] transition-colors" title={currentOrg?.name}>
                      <span className="w-7 h-7 shrink-0 rounded-lg text-white font-mono text-[10px] font-bold flex items-center justify-center" style={{ background: "linear-gradient(135deg, hsl(215,100%,62%), hsl(215,100%,46%))" }}>{orgInitials || "SB"}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-display italic text-[13px] leading-tight text-white/95 truncate">{currentOrg?.name ?? "Workspace"}</span>
                        <span className="block font-mono text-[9px] uppercase tracking-[0.18em] text-white/35 mt-0.5">{currentOrg?.plan?.replace(/_/g, " ") ?? "—"} · {currentOrg?.role ?? "—"}</span>
                      </span>
                      <ChevronsUpDown className="w-3.5 h-3.5 text-white/40 shrink-0 group-hover:text-white/70" strokeWidth={1.5} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" side="right" sideOffset={8} className="w-[280px] p-0 bg-[hsl(220,16%,5%)]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden">
                    <div className="px-3 py-2.5 border-b border-white/[0.06] font-mono text-[9px] uppercase tracking-[0.32em] text-white/40">Workspaces</div>
                    <div className="max-h-[320px] overflow-y-auto">
                      {organizations.map((o) => (
                        <button key={o.id} onClick={() => { switchOrg(o.id); setOrgOpen(false); }} className={cn("w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/[0.04] transition-colors", o.id === currentOrg?.id && "bg-[hsl(215,60%,12%)]/40")}>
                          <span className="w-6 h-6 shrink-0 rounded-lg bg-white/[0.06] text-white/85 font-mono text-[9px] font-bold flex items-center justify-center">{o.name.split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "SB"}</span>
                          <span className="min-w-0 flex-1"><span className="block text-[12px] text-white/90 truncate">{o.name}</span><span className="block font-mono text-[9px] uppercase tracking-[0.18em] text-white/35 mt-0.5">{o.plan?.replace(/_/g, " ")} · {o.role}</span></span>
                          {o.id === currentOrg?.id && <Check className="w-3.5 h-3.5 text-[hsl(215,100%,72%)] shrink-0" strokeWidth={2} />}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Groups */}
              <nav className="flex-1 overflow-y-auto px-3 pb-3 scrollbar-hide">
                {BUSINESS_NAV.map((group) => (
                  <BusinessGroupNode
                    key={group.label}
                    group={group}
                    expanded={effectiveExpanded.has(group.label)}
                    activeItemTo={activeItemTo}
                    hasPermission={hasPermission}
                    onToggle={() => toggleGroup(group.label)}
                    onItemClick={() => { if (typeof window !== "undefined" && window.innerWidth < 768) setOpen(false); }}
                  />
                ))}
              </nav>

              {/* Footer */}
              <footer className="shrink-0 px-4 pb-6 pt-2">
                <p className={cn(TYPE_META, "px-1 text-muted-foreground/30 flex items-center justify-between")}>
                  <span className="inline-flex items-center gap-1.5"><Building2 className="h-3 w-3" /> Business</span>
                  <span className="tabular-nums">Esc</span>
                </p>
              </footer>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

function BusinessGroupNode({ group, expanded, activeItemTo, hasPermission, onToggle, onItemClick }: {
  group: BusinessNavGroup; expanded: boolean; activeItemTo: string;
  hasPermission: (r: BusinessNavItem["minRole"]) => boolean; onToggle: () => void; onItemClick: () => void;
}) {
  return (
    <div>
      <motion.button
        type="button" onClick={onToggle} aria-expanded={expanded} whileTap={{ scale: 0.99 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="group/grp relative w-full flex items-center gap-3.5 px-4 h-[48px] rounded-md text-muted-foreground/75 hover:text-foreground hover:bg-white/[0.02] transition-all duration-200"
      >
        <group.Icon className="h-[17px] w-[17px] shrink-0 text-muted-foreground/55 group-hover/grp:text-foreground/90 transition-colors" strokeWidth={1.5} />
        <span className="font-mono text-[12.5px] uppercase tracking-[0.30em] text-muted-foreground/75 group-hover/grp:text-foreground/90 transition-colors">{group.label}</span>
        <motion.span animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.25, ease: EASE_PREMIUM }} className="ml-auto inline-flex text-muted-foreground/35 group-hover/grp:text-foreground/65 transition-colors">
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.6} />
        </motion.span>
      </motion.button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.ul initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.32, ease: EASE_PREMIUM }} className="overflow-hidden">
            <div className="relative pt-0.5 pb-1.5 pl-7 pr-1">
              {group.items.map((i, ii) => {
                const allowed = hasPermission(i.minRole);
                const active = i.to === activeItemTo;
                return (
                  <motion.li key={i.to} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.04 + ii * 0.025, duration: 0.32, ease: EASE_PREMIUM }}>
                    <NavLink
                      to={allowed ? i.to : "#"}
                      onClick={(e) => { if (!allowed) { e.preventDefault(); return; } onItemClick(); }}
                      aria-disabled={!allowed}
                      className={cn(
                        "group/item relative flex items-center gap-3 px-3 h-[40px] rounded-md text-[14px] font-light tracking-[-0.005em] transition-all duration-200",
                        active ? "text-foreground bg-[hsl(var(--accent)/0.10)] shadow-[inset_0_0_0_1px_hsl(var(--accent)/0.22)]" : "text-muted-foreground/70 hover:text-foreground hover:bg-white/[0.025]",
                        !allowed && "opacity-35 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground/70",
                      )}
                    >
                      {active && <span aria-hidden className="absolute -left-3 top-1/2 -translate-y-1/2 h-6 w-[2px] rounded-r-full bg-accent shadow-[0_0_12px_hsl(var(--accent)/0.8)]" />}
                      {allowed
                        ? <i.Icon className={cn("h-[16px] w-[16px] shrink-0 transition-colors", active ? "text-accent" : "text-muted-foreground/55 group-hover/item:text-foreground/85")} strokeWidth={1.6} />
                        : <Lock className="h-[14px] w-[14px] shrink-0 text-muted-foreground/35" strokeWidth={1.6} />}
                      <span className="truncate">{i.label}</span>
                    </NavLink>
                  </motion.li>
                );
              })}
            </div>
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
