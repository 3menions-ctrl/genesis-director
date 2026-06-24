/**
 * ClusterTabs — a lightweight second-level tab strip used inside a hub tab.
 *
 * Hubs with many sub-pages (e.g. Growth) group them into a few clusters; each
 * cluster renders its member pages behind this compact pill strip. Keeps the
 * top-level hub tab bar short while preserving access to every page.
 */
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ACCENT_HSL, accent } from "@/admin/ui/primitives";

export interface ClusterTab {
  id: string;
  label: string;
  render: () => ReactNode;
}

export function ClusterTabs({ tabs, defaultTab }: { tabs: ClusterTab[]; defaultTab?: string }) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  return (
    <div>
      <div className="mb-7 flex flex-wrap items-center gap-1.5" role="tablist">
        {tabs.map((t) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActive(t.id)}
              className={cn(
                "rounded-full px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors",
                on ? "" : "text-white/45 hover:text-white/80",
              )}
              style={on ? { background: accent(0.16), color: ACCENT_HSL } : undefined}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {/* key forces a clean remount + fade when switching member pages */}
      <div className="animate-fade-in" key={current?.id}>{current?.render()}</div>
    </div>
  );
}
