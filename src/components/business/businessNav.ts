/**
 * Business module navigation — the single source of truth for /business/*.
 *
 * Shared by BusinessShell (renders the rail) and App.tsx (generates the
 * routes), so a section is added in exactly one place. Roles gate visibility
 * via useWorkspace().hasPermission(minRole).
 */
import {
  LayoutDashboard, Sparkles, Scissors, Film, Layers, UserSquare2, LayoutTemplate,
  Globe2, GraduationCap, Megaphone,
  Users, Palette, ShieldCheck, ScrollText,
  CreditCard, Coins, BarChart3, FileSpreadsheet,
  Plug, KeyRound, Settings, Share2,
} from "lucide-react";
import type { OrgRole } from "@/contexts/WorkspaceContext";

export interface BusinessNavItem {
  /** Path segment after /business (empty string = the index/overview). */
  slug: string;
  to: string;
  label: string;
  Icon: typeof Users;
  minRole: OrgRole;
  description: string;
  /** Full-bleed pages (canvas surfaces) skip the padded content wrapper. */
  fullBleed?: boolean;
}
export interface BusinessNavGroup { label: string; Icon: typeof Users; items: BusinessNavItem[] }

const item = (
  slug: string, label: string, Icon: typeof Users, minRole: OrgRole, description: string, fullBleed = false,
): BusinessNavItem => ({ slug, to: slug ? `/business/${slug}` : "/business", label, Icon, minRole, description, fullBleed });

export const BUSINESS_NAV: BusinessNavGroup[] = [
  {
    label: "Operate",
    Icon: Sparkles,
    items: [
      item("", "Overview", LayoutDashboard, "viewer", "Operational snapshot"),
      item("ad-studio", "Ad Studio", Megaphone, "producer", "Generate branded ad concepts"),
      item("create", "Create", Sparkles, "producer", "Generate productions", true),
      item("editor", "Editor", Scissors, "producer", "Cut, score, finish", true),
      item("projects", "Projects", Film, "viewer", "All productions"),
      item("assets", "Assets", Layers, "viewer", "Shared library"),
      item("avatars", "Avatars", UserSquare2, "viewer", "Brand cast", true),
      item("environments", "Environments", Globe2, "viewer", "Scene library", true),
      item("templates", "Templates", LayoutTemplate, "producer", "Reusable layouts"),
      item("learning", "Learning", GraduationCap, "viewer", "Train & upskill", true),
    ],
  },
  {
    label: "Govern",
    Icon: ShieldCheck,
    items: [
      item("team", "Team & Access", Users, "viewer", "Roster, roles & approvals"),
      item("brand", "Brand", Palette, "producer", "Identity & voice"),
      item("audit", "Audit log", ScrollText, "admin", "Activity trail"),
    ],
  },
  {
    label: "Optimize",
    Icon: BarChart3,
    items: [
      item("billing", "Billing", CreditCard, "admin", "Plan & invoices"),
      item("credits", "Credits", Coins, "admin", "Pool & top-ups"),
      item("analytics", "Telemetry", BarChart3, "admin", "Usage by member"),
      item("reports", "Reports", FileSpreadsheet, "admin", "Export summaries"),
    ],
  },
  {
    label: "Extend",
    Icon: Plug,
    items: [
      item("distribution", "Distribution", Share2, "producer", "Publish to channels"),
      item("integrations", "Integrations", Plug, "admin", "Slack, Drive, Zapier"),
      item("api", "API & hooks", KeyRound, "admin", "Programmatic access"),
    ],
  },
  {
    label: "Settings",
    Icon: Settings,
    items: [
      item("settings", "Settings", Settings, "admin", "Workspace, security & more"),
    ],
  },
];

export const BUSINESS_NAV_ITEMS: BusinessNavItem[] = BUSINESS_NAV.flatMap((g) => g.items);
