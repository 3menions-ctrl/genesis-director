// ─────────────────────────────────────────────────────────────────────────────
// Design-audit configuration — EDIT HERE.
//
// Everything the audit needs is configurable in this file: the base URL, the
// viewports, and the full route list. The route list was derived from
// src/App.tsx (React Router) + src/components/business/businessNav.ts.
//
// Routes that take params use stubbed placeholder values (see `stub` notes).
// Protected / account-type-gated routes are captured unauthenticated; they
// redirect to /auth (or their gate target) and the report flags this.
// ─────────────────────────────────────────────────────────────────────────────

export const BASE_URL = process.env.AUDIT_BASE_URL || "http://localhost:7777";

// Optional Playwright storageState JSON (a logged-in session) to capture
// protected pages authenticated. Generate with `playwright codegen` after
// signing in, then: AUDIT_STORAGE_STATE=./auth.json node audit.mjs
export const STORAGE_STATE = process.env.AUDIT_STORAGE_STATE || undefined;

export const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

// Per-page settle budget (ms) after networkidle, for late fonts/animations.
export const SETTLE_MS = 600;
export const NAV_TIMEOUT_MS = 30000;

// Placeholder values for routes that need params. Listed in the report.
export const STUBS = {
  id: "demo",
  slug: "demo",
  token: "demo",
  projectId: "demo",
  publicKey: "demo",
  helpSlug: "editor-manual",
  blogSlug: "sample-post",
};

// Each route: { path, label, group, auth, stub? }
//   auth: "public" | "protected" | "business" | "admin"
//   stub: human note on any placeholder params used
export const ROUTES = [
  // ── Public / marketing ───────────────────────────────────────────────────
  { path: "/", label: "Home (Cinema)", group: "Public", auth: "public" },
  { path: "/studio-showcase", label: "Studio Showcase", group: "Public", auth: "public" },
  { path: "/films", label: "Films Gallery", group: "Public", auth: "public" },
  { path: "/pricing", label: "Pricing", group: "Public", auth: "public" },
  { path: "/how-it-works", label: "How It Works", group: "Public", auth: "public" },
  { path: "/pipeline-preview", label: "Pipeline Preview", group: "Public", auth: "public" },
  { path: "/enterprise/coming-soon", label: "Enterprise (Coming Soon)", group: "Public", auth: "public" },
  { path: "/press", label: "Press", group: "Public", auth: "public" },
  { path: "/blog", label: "Blog", group: "Public", auth: "public" },
  { path: "/blog/sample-post", label: "Blog Post", group: "Public", auth: "public", stub: ":slug = 'sample-post'" },
  { path: "/contact", label: "Contact", group: "Public", auth: "public" },
  { path: "/terms", label: "Terms", group: "Public", auth: "public" },
  { path: "/privacy", label: "Privacy", group: "Public", auth: "public" },
  { path: "/unsubscribe", label: "Unsubscribe", group: "Public", auth: "public" },

  // ── Auth flows ────────────────────────────────────────────────────────────
  { path: "/auth", label: "Sign In / Up", group: "Auth", auth: "public" },
  { path: "/forgot-password", label: "Forgot Password", group: "Auth", auth: "public" },
  { path: "/reset-password", label: "Reset Password", group: "Auth", auth: "public" },
  { path: "/business/start", label: "Business Onboarding", group: "Auth", auth: "public" },

  // ── Help / support ────────────────────────────────────────────────────────
  { path: "/help", label: "Help", group: "Help", auth: "public" },
  { path: "/help/editor-manual", label: "Help Doc", group: "Help", auth: "public", stub: ":slug = 'editor-manual'" },
  { path: "/help-center", label: "Help Center (legacy)", group: "Help", auth: "public" },

  // ── Public watch / share (params stubbed) ────────────────────────────────
  { path: "/search", label: "Search Hub", group: "Discover", auth: "public" },
  { path: "/lobby", label: "Lobby", group: "Discover", auth: "public" },
  { path: "/music", label: "Music Hub", group: "Discover", auth: "public" },
  { path: "/crossover", label: "Crossover (VFX)", group: "Discover", auth: "public" },
  { path: "/loft", label: "Hidden Room (Loft)", group: "Discover", auth: "public" },
  { path: "/r/demo", label: "Reel", group: "Watch/Share", auth: "public", stub: ":id = 'demo'" },
  { path: "/world/demo", label: "World Detail", group: "Watch/Share", auth: "public", stub: ":slug = 'demo'" },
  { path: "/c/demo", label: "Channel/Profile (public)", group: "Watch/Share", auth: "public", stub: ":id = 'demo'" },
  { path: "/c/demo/patron", label: "Patron Hub", group: "Watch/Share", auth: "public", stub: ":id = 'demo'" },
  { path: "/p/demo", label: "Public Share", group: "Watch/Share", auth: "public", stub: ":slug = 'demo'" },
  { path: "/w/demo", label: "Widget Landing", group: "Watch/Share", auth: "public", stub: ":slug = 'demo'" },
  { path: "/embed/demo", label: "Embed Player", group: "Watch/Share", auth: "public", stub: ":slug = 'demo'" },
  { path: "/widget/demo", label: "Widget Embed", group: "Watch/Share", auth: "public", stub: ":publicKey = 'demo'" },

  // ── Protected consumer app (redirects to /auth unauthenticated) ──────────
  { path: "/studio", label: "Studio", group: "App (protected)", auth: "protected" },
  { path: "/onboarding", label: "Onboarding", group: "App (protected)", auth: "protected" },
  { path: "/welcome/checkout", label: "Welcome Checkout", group: "App (protected)", auth: "protected" },
  { path: "/library", label: "Library", group: "App (protected)", auth: "protected" },
  { path: "/account", label: "Account", group: "App (protected)", auth: "protected" },
  { path: "/account/notifications", label: "Notification Settings", group: "App (protected)", auth: "protected" },
  { path: "/profile", label: "Profile Dashboard", group: "App (protected)", auth: "protected" },
  { path: "/inbox", label: "Inbox", group: "App (protected)", auth: "protected" },
  { path: "/me/year", label: "Director Cards (Year)", group: "App (protected)", auth: "protected" },
  { path: "/avatars", label: "Avatars Studio", group: "App (protected)", auth: "protected" },
  { path: "/templates", label: "Templates", group: "App (protected)", auth: "protected" },
  { path: "/environments", label: "Environments", group: "App (protected)", auth: "protected" },
  { path: "/training-video", label: "Training Video", group: "App (protected)", auth: "protected" },
  { path: "/production", label: "Production", group: "App (protected)", auth: "protected" },
  { path: "/production/demo", label: "Production (project)", group: "App (protected)", auth: "protected", stub: ":projectId = 'demo'" },
  { path: "/editor", label: "Video Editor", group: "App (protected)", auth: "protected" },
  { path: "/editor/demo", label: "Video Editor (project)", group: "App (protected)", auth: "protected", stub: ":id = 'demo'" },

  // ── Business module (account-type gated → redirects unauthenticated) ──────
  { path: "/business", label: "Business Overview", group: "Business", auth: "business" },
  { path: "/business/ad-studio", label: "Ad Studio", group: "Business", auth: "business" },
  { path: "/business/create", label: "Business Create", group: "Business", auth: "business" },
  { path: "/business/editor", label: "Business Editor", group: "Business", auth: "business" },
  { path: "/business/projects", label: "Business Projects", group: "Business", auth: "business" },
  { path: "/business/assets", label: "Business Assets", group: "Business", auth: "business" },
  { path: "/business/avatars", label: "Business Avatars", group: "Business", auth: "business" },
  { path: "/business/environments", label: "Business Environments", group: "Business", auth: "business" },
  { path: "/business/templates", label: "Business Templates", group: "Business", auth: "business" },
  { path: "/business/learning", label: "Business Learning", group: "Business", auth: "business" },
  { path: "/business/team", label: "Team & Access", group: "Business", auth: "business" },
  { path: "/business/brand", label: "Brand", group: "Business", auth: "business" },
  { path: "/business/audit", label: "Audit Log", group: "Business", auth: "business" },
  { path: "/business/billing", label: "Billing", group: "Business", auth: "business" },
  { path: "/business/credits", label: "Credits", group: "Business", auth: "business" },
  { path: "/business/analytics", label: "Telemetry", group: "Business", auth: "business" },
  { path: "/business/reports", label: "Reports", group: "Business", auth: "business" },
  { path: "/business/distribution", label: "Distribution", group: "Business", auth: "business" },
  { path: "/business/integrations", label: "Integrations", group: "Business", auth: "business" },
  { path: "/business/api", label: "API & Hooks", group: "Business", auth: "business" },
  { path: "/business/settings", label: "Business Settings", group: "Business", auth: "business" },

  // ── Admin (only if ADMIN_ENABLED in this build) ───────────────────────────
  { path: "/admin", label: "Admin Console", group: "Admin", auth: "admin" },

  // ── Fallback ──────────────────────────────────────────────────────────────
  { path: "/__audit_not_found__", label: "404 / Not Found", group: "Misc", auth: "public", stub: "unknown path → NotFound" },
];
