/**
 * BusinessShell — the sole chrome for every /business/* route.
 *
 * Copies the regular account's shell: a SpineBackdrop atmosphere, the
 * frosted slide-in BusinessRail (with floating handle), and a content
 * column that shifts right when the rail is open on md+. Each page paints
 * its own cover-band hero via <BusinessPage>.
 *
 * Parallel to WorkspaceLayout — /workspace stays live until cutover.
 */
import { type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Building2 } from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { ModuleBaseContext } from "@/components/foundation/moduleBase";
import { BusinessBackdrop, toneForBusinessPath } from "./BusinessBackdrop";
import { BusinessRail } from "./BusinessRail";

export function BusinessShell({ children }: { children: ReactNode }) {
  const { currentOrg, loading } = useWorkspace();
  const { pathname } = useLocation();
  const tone = toneForBusinessPath(pathname);

  return (
    <div className="relative min-h-[100dvh] text-foreground">
      <BusinessBackdrop tone={tone} />
      <BusinessRail />

      {/* Always-on icon rail — reserve its width (matches the <aside> in
          BusinessRail.tsx: 72px phone / 96px md+). */}
      <div className="relative pl-[72px] md:pl-[96px]">
        <main className="relative z-10 min-h-[100dvh]">
          {loading ? (
            <div className="flex min-h-[60vh] items-center justify-center text-white/55">
              <div className="font-mono text-[11px] uppercase tracking-[0.32em] animate-pulse">Loading business…</div>
            </div>
          ) : !currentOrg ? (
            <div className="flex min-h-[60vh] items-center justify-center px-6">
              <div className="max-w-md text-center">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl ring-1 ring-white/10 bg-white/[0.03] flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-[hsl(215,100%,68%)]" />
                </div>
                <h2 className="text-xl font-display italic font-light text-white/90 tracking-[-0.01em]">No workspace selected</h2>
                <p className="text-[13px] text-white/45 mt-2 font-light">Create or switch to a business workspace from the rail to continue.</p>
              </div>
            </div>
          ) : (
            <ModuleBaseContext.Provider value="/business">{children}</ModuleBaseContext.Provider>
          )}
        </main>
      </div>
    </div>
  );
}
