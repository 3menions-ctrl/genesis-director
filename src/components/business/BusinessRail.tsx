/**
 * BusinessRail — the /business navigation rail.
 *
 * Always-on vertical icon bar, mirroring the regular account's LeftRail: each
 * destination is a GIANT icon tile with a small label beneath it (VS Code /
 * Discord activity-bar lineage). Borderless frosted-glass column. The top tile
 * is the workspace switcher (org initials → popover to switch orgs); the body
 * is the role-gated business nav (Operate / Govern / Optimize / Extend /
 * Settings); Sign out is pinned at the base.
 */
import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Check, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { SignOutDialog } from "@/components/auth/SignOutDialog";
import { BUSINESS_NAV, BUSINESS_NAV_ITEMS, type BusinessNavItem } from "./businessNav";

const initialsOf = (name?: string) =>
  (name ?? "SB").split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "SB";

// Shorter labels under the giant icon when the full name is long.
const SHORT_LABEL: Record<string, string> = {
  "Team & Access": "Team",
  "Audit log": "Audit",
  "API & hooks": "API",
  "Environments": "Worlds",
  "Distribution": "Publish",
};

export function BusinessRail() {
  const { pathname } = useLocation();
  const reducedMotion = useReducedMotion();
  const { currentOrg, organizations, switchOrg, hasPermission } = useWorkspace();
  const [orgOpen, setOrgOpen] = useState(false);

  // Active item for the current route (longest matching prefix).
  const activeItemTo = useMemo(() => {
    let best: BusinessNavItem | null = null;
    for (const it of BUSINESS_NAV_ITEMS) {
      const match = it.to === "/business" ? pathname === "/business" : pathname.startsWith(it.to);
      if (match && (!best || it.to.length > best.to.length)) best = it;
    }
    return best?.to ?? "/business";
  }, [pathname]);

  // Only groups that have at least one role-permitted item are rendered.
  const visibleGroups = useMemo(
    () => BUSINESS_NAV
      .map((g) => ({ ...g, items: g.items.filter((i) => hasPermission(i.minRole)) }))
      .filter((g) => g.items.length > 0),
    [hasPermission],
  );

  return (
    <aside
      aria-label="Business navigation"
      className="fixed top-0 left-0 z-40 h-[100dvh] w-[72px] md:w-[96px] flex flex-col"
      style={{
        backgroundColor: "hsl(220 28% 5% / 0.72)",
        backdropFilter: "blur(28px) saturate(1.5)",
        WebkitBackdropFilter: "blur(28px) saturate(1.5)",
        boxShadow: [
          "1px 0 0 hsl(0 0% 100% / 0.06)",
          "24px 0 60px -40px hsl(0 0% 0% / 0.7)",
          "inset 0 1px 0 hsl(0 0% 100% / 0.05)",
        ].join(", "),
      }}
    >
      {/* Workspace switcher — org initials tile + small name */}
      <Popover open={orgOpen} onOpenChange={setOrgOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Switch workspace"
            className="group/org shrink-0 flex flex-col items-center justify-center gap-1 pt-3 pb-2.5 px-1"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.05] group-hover/org:bg-white/[0.1] transition-colors font-mono text-[10px] font-bold text-white/80">
              {initialsOf(currentOrg?.name)}
            </span>
            <span className="max-w-full px-0.5 truncate text-[8.5px] font-medium leading-none tracking-tight text-white/45 group-hover/org:text-white/75 transition-colors">
              {currentOrg?.name ?? "Workspace"}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" side="right" sideOffset={10} className="w-[260px] p-1.5 bg-[hsl(220,16%,5%)]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="px-2.5 py-2 font-mono text-[9.5px] uppercase tracking-[0.22em] text-white/40">Workspaces</div>
          {organizations.map((o) => {
            const active = o.id === currentOrg?.id;
            return (
              <button
                key={o.id}
                onClick={() => { switchOrg(o.id); setOrgOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors",
                  active ? "bg-white/[0.08]" : "hover:bg-white/[0.04]",
                )}
              >
                <span className="w-6 h-6 shrink-0 rounded-lg bg-white/[0.06] text-white/85 font-mono text-[9px] font-bold flex items-center justify-center">{initialsOf(o.name)}</span>
                <span className="flex-1 truncate text-[13px] text-white/85">{o.name}</span>
                {active && <Check className="h-4 w-4 shrink-0 text-[hsl(215,100%,72%)]" />}
              </button>
            );
          })}
        </PopoverContent>
      </Popover>

      {/* Hairline under the workspace switcher */}
      <span aria-hidden className="block h-px mx-3 bg-white/[0.06]" />

      {/* Tile stack */}
      <nav className="flex-1 overflow-y-auto scrollbar-hide px-2 py-2" aria-label="Business pages">
        {visibleGroups.map((g, gi) => (
          <div key={g.label}>
            {gi > 0 && <span aria-hidden className="block h-px mx-3 my-2 bg-white/[0.06]" />}
            <ul className="space-y-1">
              {g.items.map((item) => (
                <li key={item.to}>
                  <BizRailTile item={item} active={item.to === activeItemTo} reducedMotion={!!reducedMotion} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Sign out pinned at the base */}
      <div className="shrink-0 px-2 pb-3 pt-2" style={{ boxShadow: "inset 0 1px 0 hsl(0 0% 100% / 0.05)" }}>
        <SignOutDialog>
          <button
            type="button"
            aria-label="Sign out"
            className="group/out relative w-full flex flex-col items-center justify-center gap-1.5 py-2 rounded-2xl text-muted-foreground/55 hover:text-rose-200 transition-colors"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.04] group-hover/out:bg-[hsl(350_80%_55%/0.14)] transition-colors">
              <LogOut className="h-[22px] w-[22px]" strokeWidth={1.7} />
            </span>
            <span className="text-[9.5px] font-medium leading-none tracking-tight">Sign out</span>
          </button>
        </SignOutDialog>
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BizRailTile — one giant icon + small label beneath (mirrors LeftRail's tile)
// ─────────────────────────────────────────────────────────────────────────────
function BizRailTile({ item, active, reducedMotion }: { item: BusinessNavItem; active: boolean; reducedMotion: boolean }) {
  const Icon = item.Icon;
  return (
    <Link
      to={item.to}
      aria-current={active ? "page" : undefined}
      className={cn(
        // Borderless: just the icon + label, no tile box. Active = a glowing
        // accent line below.
        "group/tile relative flex flex-col items-center justify-center gap-1.5 w-full py-2.5 transition-colors",
        active ? "text-white" : "text-white/45 hover:text-white/85",
      )}
    >
      <Icon
        className="h-[18px] w-[18px] transition-transform duration-200 group-hover/tile:scale-110"
        strokeWidth={active ? 2 : 1.7}
        style={active ? { filter: "drop-shadow(0 0 9px hsl(215 90% 60% / 0.55))" } : undefined}
      />
      <span className="max-w-full px-0.5 text-[9.5px] font-medium leading-tight text-center tracking-tight">
        {SHORT_LABEL[item.label] ?? item.label}
      </span>
      {active && (
        <motion.span
          layoutId="business-rail-active-line"
          aria-hidden
          className="pointer-events-none absolute bottom-0 h-[2px] w-7 rounded-full"
          style={{
            background: "linear-gradient(90deg, hsl(215 90% 60%), hsl(188 92% 58%))",
            boxShadow: "0 0 10px hsl(215 90% 60% / 0.6)",
          }}
          transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 34 }}
        />
      )}
    </Link>
  );
}

export default BusinessRail;
