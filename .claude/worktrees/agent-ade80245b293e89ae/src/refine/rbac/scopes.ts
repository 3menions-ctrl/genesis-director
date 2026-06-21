/**
 * Ops RBAC scopes.
 *
 * Each ops route is mapped to a single coarse-grained scope. The current
 * production RLS model only recognizes one super-admin (see public.is_admin),
 * so super-admins resolve to ALL_SCOPES. Future per-scope grants can be added
 * by extending OpsAccessProvider.resolveScopes() — no callers need to change.
 */
import { OPS_PAGES } from "@/refine/pages/ops/_registry";

export const OPS_SCOPES = [
  "core",          // baseline admin pages (telemetry, users, projects, etc.)
  "observability", // audit, edge logs, providers, queue, status, backups
  "access",        // roles, team, sessions, gdpr, abuse
  "money",         // subscriptions, refunds, coupons, referrals, invoices, reconcile
  "content",       // avatar catalog, gallery, templates, storage, content safety
  "growth",        // analytics, onboarding, experiments, cohorts, flags, announcements
  "comms",         // email templates, notifications, macros, changelog
  "system",        // api keys, webhooks, secrets, db health, crash forensics
] as const;

export type OpsScope = (typeof OPS_SCOPES)[number];
export const ALL_SCOPES: readonly OpsScope[] = OPS_SCOPES;

/** Section label (from registry) → required scope. */
const SECTION_TO_SCOPE: Record<string, OpsScope> = {
  Observability: "observability",
  Access: "access",
  Money: "money",
  Content: "content",
  Growth: "growth",
  Comms: "comms",
  System: "system",
};

/** Core admin paths that pre-date the ops registry. */
const CORE_PATH_SCOPE: Record<string, OpsScope> = {
  "/admin": "core",
  "/admin/users": "core",
  "/admin/messages": "access",
  "/admin/projects": "core",
  "/admin/production": "observability",
  "/admin/moderation": "content",
  "/admin/credits": "money",
  "/admin/finance": "money",
  "/admin/emails": "comms",
  "/admin/config": "system",
};

const REGISTRY_SCOPE: Record<string, OpsScope> = Object.fromEntries(
  OPS_PAGES.map((p) => [p.path, SECTION_TO_SCOPE[p.section] ?? "system"]),
);

export const PATH_SCOPE: Readonly<Record<string, OpsScope>> = {
  ...CORE_PATH_SCOPE,
  ...REGISTRY_SCOPE,
};

export function scopeForPath(path: string): OpsScope {
  return PATH_SCOPE[path] ?? "system";
}