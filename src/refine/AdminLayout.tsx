/**
 * Refine Admin Layout — Apple-esque dark admin shell.
 * 
 * This wraps the Refine-powered admin pages with a consistent
 * sidebar + header layout.
 */
import { useState, useEffect } from "react";
import { Outlet, Link, useLocation, Navigate } from "react-router-dom";
import { useGetIdentity } from "@refinedev/core";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  DollarSign,
  History,
  MessageSquare,
  Shield,
  ChevronLeft,
  Settings,
  Coins,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AppHeader } from "@/components/layout/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface NavSection {
  label: string;
  items: { key: string; label: string; icon: React.ElementType; path: string }[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [
      { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/admin" },
    ],
  },
  {
    label: "Manage",
    items: [
      { key: "users", label: "Users", icon: Users, path: "/admin/users" },
      { key: "projects", label: "Projects", icon: FolderKanban, path: "/admin/projects" },
      { key: "credits", label: "Transactions", icon: Coins, path: "/admin/credits" },
      { key: "messages", label: "Support", icon: MessageSquare, path: "/admin/messages" },
    ],
  },
  {
    label: "System",
    items: [
      { key: "financials", label: "Financials", icon: DollarSign, path: "/admin/financials" },
      { key: "audit", label: "Audit Log", icon: History, path: "/admin/audit" },
      { key: "settings", label: "Settings", icon: Settings, path: "/admin/settings" },
    ],
  },
];

export function RefineAdminLayout() {
  const location = useLocation();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  // Verify admin access
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        setIsAdmin(false);
        return;
      }
      const { data, error } = await supabase.rpc("is_admin", { _user_id: user.id });
      setIsAdmin(error ? false : data === true);
    };
    checkAdmin();
  }, [user]);

  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-[#060609] flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
        <span className="ml-3 text-[13px] text-white/30">Verifying admin access…</span>
      </div>
    );
  }

  if (!user || isAdmin === false) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-[#060609] text-white">
      <AppHeader showCreate={false} />

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={cn(
            "sticky top-14 h-[calc(100vh-56px)] border-r border-white/[0.04] transition-all duration-200 shrink-0 overflow-y-auto",
            collapsed ? "w-14" : "w-56"
          )}
          style={{ background: "rgba(8,8,12,0.6)" }}
        >
          <div className="p-3 space-y-5">
            {/* Collapse toggle */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="w-full flex items-center justify-center h-7 rounded-lg hover:bg-white/[0.04] transition-colors"
            >
              <ChevronLeft
                className={cn(
                  "w-3.5 h-3.5 text-white/25 transition-transform duration-200",
                  collapsed && "rotate-180"
                )}
              />
            </button>

            {NAV_SECTIONS.map((section) => (
              <div key={section.label}>
                {!collapsed && (
                  <span className="px-2 text-[9px] font-semibold text-white/20 uppercase tracking-[0.15em]">
                    {section.label}
                  </span>
                )}
                <div className="mt-1.5 space-y-0.5">
                  {section.items.map(({ key, label, icon: Icon, path }) => {
                    const active = location.pathname === path;
                    return (
                      <Link
                        key={key}
                        to={path}
                        className={cn(
                          "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] font-medium transition-all duration-150",
                          active
                            ? "bg-white/[0.08] text-white"
                            : "text-white/35 hover:text-white/60 hover:bg-white/[0.03]"
                        )}
                        title={collapsed ? label : undefined}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        {!collapsed && <span>{label}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Admin badge */}
          {!collapsed && (
            <div className="absolute bottom-4 left-3 right-3">
              <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[hsl(var(--warning)/0.06)] border border-[hsl(var(--warning)/0.1)]">
                <Shield className="w-3 h-3 text-[hsl(var(--warning))]" />
                <span className="text-[10px] font-medium text-[hsl(var(--warning)/0.7)]">Admin Mode</span>
              </div>
            </div>
          )}
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
