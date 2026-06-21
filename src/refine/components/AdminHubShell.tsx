/**
 * AdminHubShell — the hub-page primitive.
 *
 * A consolidated admin hub (People / Production / Money / Growth / System)
 * is a single route whose tabs render existing sub-pages inline. This shell
 * exposes:
 *   • A premium Editorial Noir hero (delegates to AdminPageShell)
 *   • A horizontal tab strip with route-stable hash navigation
 *   • Child sections that render the *currently selected* tab only,
 *     so the underlying page components mount lazily and never block the
 *     hub from rendering the tab strip on a slow inner page.
 *
 * Tab state is mirrored to the URL hash so deep links / browser back work,
 * and so the AdminPalette can deep-link into a specific tab.
 */
import { ReactNode, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ACCENT_HSL, accent } from "@/admin/ui/primitives";
import { AdminPageShell, AdminEmbeddedProvider } from "./AdminPageShell";

export interface HubTab {
  id: string;
  label: string;
  /** Lazy rendered — the function is only called when the tab is active. */
  render: () => ReactNode;
  /** Optional inline badge (e.g. count). */
  badge?: ReactNode;
  /** Mark the tab as the suggested entry point. */
  suggested?: boolean;
}

interface AdminHubShellProps {
  eyebrow: string;
  code: string;
  title: string;
  italic?: string;
  description?: string;
  tabs: HubTab[];
  defaultTab?: string;
  stats?: { label: string; value: ReactNode; tone?: "blue" | "amber" | "emerald" | "rose" | "neutral"; sub?: string }[];
  actions?: ReactNode;
}

export function AdminHubShell({
  eyebrow, code, title, italic, description, tabs, defaultTab, stats, actions,
}: AdminHubShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const hash = location.hash.replace(/^#/, "");
  const initial = useMemo(() => {
    if (hash && tabs.some((t) => t.id === hash)) return hash;
    return defaultTab ?? tabs[0]?.id ?? "";
  }, [hash, tabs, defaultTab]);
  const [active, setActive] = useState(initial);

  // Sync the URL hash so deep links + browser nav work.
  useEffect(() => {
    if (active && active !== hash) {
      navigate({ pathname: location.pathname, hash: active }, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // React to the hash changing from outside (e.g. palette deep link).
  useEffect(() => {
    if (hash && tabs.some((t) => t.id === hash) && hash !== active) {
      setActive(hash);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash]);

  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <AdminPageShell
      eyebrow={eyebrow}
      code={code}
      title={title}
      italic={italic}
      description={description}
      stats={stats}
      actions={actions}
    >
      {/* Tab strip */}
      <div
        role="tablist"
        aria-label={`${title} tabs`}
        className="relative mb-6 flex flex-wrap items-center gap-1 overflow-hidden rounded-2xl p-1.5 backdrop-blur-xl shadow-[0_30px_90px_-50px_rgba(0,0,0,0.95)]"
        style={{ background: "linear-gradient(165deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02) 60%, rgba(255,255,255,0.015))" }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)" }}
        />
        {tabs.map((t) => {
          const isActive = t.id === activeTab?.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(t.id)}
              className={cn(
                "relative flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-[12px] uppercase tracking-[0.22em] transition-colors",
                isActive ? "text-white" : "text-white/45 hover:text-white",
              )}
            >
              {isActive && (
                <motion.span
                  layoutId={`hub-tab-${title}`}
                  aria-hidden
                  className="absolute inset-0 rounded-xl"
                  style={{
                    background: `linear-gradient(135deg, ${accent(0.2)}, ${accent(0.06)})`,
                    boxShadow: `0 8px 30px -12px ${accent(0.5)}`,
                  }}
                  transition={{ type: "spring", stiffness: 480, damping: 38 }}
                />
              )}
              <span className="relative">{t.label}</span>
              {t.badge !== undefined && (
                <span
                  className="relative rounded-full px-1.5 py-0.5 text-[9px] tracking-normal"
                  style={
                    isActive
                      ? { background: accent(0.18), color: ACCENT_HSL }
                      : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)" }
                  }
                >
                  {t.badge}
                </span>
              )}
              {t.suggested && !isActive && (
                <span
                  aria-hidden
                  className="relative h-1.5 w-1.5 rounded-full"
                  style={{ background: ACCENT_HSL, boxShadow: `0 0 6px ${accent(0.9)}` }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Body — only the active tab renders. The provider tells any nested
          AdminPageShell to suppress its own hero. */}
      <div role="tabpanel" aria-labelledby={activeTab?.id}>
        <AdminEmbeddedProvider value={true}>
          {activeTab?.render()}
        </AdminEmbeddedProvider>
      </div>
    </AdminPageShell>
  );
}
