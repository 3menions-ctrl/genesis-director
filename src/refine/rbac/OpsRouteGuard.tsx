import { Loader2, ShieldOff } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useOpsAccess } from "./OpsAccessProvider";
import { scopeForPath, type OpsScope } from "./scopes";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Override path-derived scope (rarely needed). */
  scope?: OpsScope;
};

export function OpsRouteGuard({ children, scope }: Props) {
  const { loading, hasScope } = useOpsAccess();
  const location = useLocation();
  const required = scope ?? scopeForPath(location.pathname);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-4 h-4 text-[#0A84FF] animate-spin" />
        <span className="ml-3 text-[10px] uppercase tracking-[0.32em] text-white/40 font-mono">
          Verifying scope: {required}
        </span>
      </div>
    );
  }

  if (!hasScope(required)) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-10">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto w-12 h-12 rounded-full border border-white/10 flex items-center justify-center">
            <ShieldOff className="w-5 h-5 text-white/50" />
          </div>
          <div className="space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-[0.32em] text-white/40">
              403 · Insufficient scope
            </div>
            <h1 className="text-2xl text-white" style={{ fontFamily: "'Fraunces', serif", fontWeight: 300 }}>
              You don't have access to this surface
            </h1>
            <p className="text-sm text-white/50">
              This page requires the <span className="text-[#0A84FF] font-mono">{required}</span> scope.
              Ask the super-admin to grant it on your operator account.
            </p>
          </div>
          <Link
            to="/admin"
            className="inline-block text-[10px] font-mono uppercase tracking-[0.28em] text-[#0A84FF] hover:underline"
          >
            ← Back to telemetry
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}