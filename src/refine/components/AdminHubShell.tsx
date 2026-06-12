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
import { cn } from "@/lib/utils";
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
        className="flex items-center gap-1 flex-wrap mb-6 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-1.5 backdrop-blur-md"
      >
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
                "relative flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-mono uppercase tracking-[0.22em] transition-colors",
                isActive
                  ? "text-white bg-[#0A84FF]/[0.10] shadow-[inset_0_0_0_1px_rgba(10,132,255,0.20)]"
                  : "text-white/45 hover:text-white hover:bg-white/[0.025]",
              )}
            >
              {t.label}
              {t.badge !== undefined && (
                <span className={cn(
                  "text-[9px] tracking-normal px-1.5 py-0.5 rounded-full",
                  isActive
                    ? "bg-[#0A84FF]/20 text-[#6FB6FF]"
                    : "bg-white/[0.05] text-white/45",
                )}>
                  {t.badge}
                </span>
              )}
              {t.suggested && !isActive && (
                <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-[#0A84FF] shadow-[0_0_6px_#0A84FF]" />
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
