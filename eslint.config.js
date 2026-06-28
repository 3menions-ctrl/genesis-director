import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

/**
 * High-leverage rules only — each catches a category of bug that has
 * actually shown up in this codebase. Documented in TEST_PLAN.md.
 *
 * Rules are added at `warn` first so they surface real bugs without
 * breaking the build. We escalate to `error` once the warning count
 * for each rule drops to zero.
 *
 * If a rule starts producing noise without catching real bugs, it goes.
 */

// ── Design-law guardrail ───────────────────────────────────────────────
// Enforces the borderless / icon+text design law on surfaces already
// migrated (see reports/design-law-audit/AUDIT.md). It flags the
// highest-signal anti-patterns in className strings — solid button fills
// and the `ring-1 ring-inset` glass-tile chrome — across both string
// literals and `cn(...)`/template chunks. Deliberately narrow to avoid
// false positives on inputs/dividers. Scoped (below) to cleaned dirs only;
// expand the `files` list as more areas are migrated.
// High-signal CTA fills only. `bg-primary text-primary-foreground` is
// deliberately excluded — it's shared by chat bubbles / calendar cells, so
// it would false-positive on legitimately-exempt surfaces.
const FILLED_BUTTON_PATTERNS = [
  /\bbg-foreground\s+text-background\b/,
  /\bbg-white\s+text-black\b/,
  /\bbg-white\s+text-\[#/,
];
const BORDERED_CARD_PATTERNS = [/\bring-1\s+ring-inset\b/];

function makeClassNameRule(patterns, message) {
  return {
    meta: { type: "problem", docs: { description: message }, schema: [] },
    create(context) {
      const flag = (node, value) => {
        if (typeof value !== "string") return;
        if (patterns.some((re) => re.test(value))) context.report({ node, message });
      };
      return {
        Literal(node) { flag(node, node.value); },
        TemplateElement(node) { flag(node, node.value && node.value.raw); },
      };
    },
  };
}

const designLaw = {
  rules: {
    "no-filled-button": makeClassNameRule(
      FILLED_BUTTON_PATTERNS,
      "Design law: no filled buttons — use borderless icon+text (drop the bg-* fill).",
    ),
    "no-bordered-card": makeClassNameRule(
      BORDERED_CARD_PATTERNS,
      "Design law: no bordered/ring cards — float content (drop `ring-1 ring-inset`).",
    ),
  },
};

export default tseslint.config(
  { ignores: ["dist", "supabase/functions/**", ".claude/**", "node_modules/**"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      // ── React hooks ────────────────────────────────────────────
      ...reactHooks.configs.recommended.rules,
      "react-hooks/exhaustive-deps": "warn",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      // ── Unused names ───────────────────────────────────────────
      // Flags dead-code candidates. Many UI files have stale imports
      // / unused props that became unused mid-refactor. Renamed-to-
      // underscore vars are intentionally ignored as a placeholder.
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        ignoreRestSiblings: true,
      }],

      // ── Common bug sources ────────────────────────────────────
      // Loose equality has zero benefit in our code and quietly
      // coerces nullable values into truthy strings.
      "eqeqeq": ["warn", "always"],
      // Empty catch blocks hide silent failures (we've found a few
      // where the catch was supposed to surface an error but ate it).
      "no-empty": ["warn", { allowEmptyCatch: false }],
      // `console.log` left in production is a smell; `console.warn`
      // and `console.error` are fine — they're deliberate.
      "no-console": ["warn", { allow: ["warn", "error"] }],
      // Promise constructors with throws that go nowhere.
      "no-async-promise-executor": "warn",
    },
  },

  // ── Design-law guardrail — scoped to migrated surfaces ─────────────
  // Severity is `warn` per this file's "warn first, escalate to error once
  // the count hits zero" convention. It surfaces regressions (and a couple
  // of remaining edge cases — a shadcn toast/calendar fill, a media badge
  // ring) without breaking the build. Escalate to `error` once clean.
  // Add more globs here as additional areas are migrated.
  {
    files: [
      "src/components/ui/**/*.{ts,tsx}",
      "src/components/shell/**/*.{ts,tsx}",
      "src/components/foundation/**/*.{ts,tsx}",
      "src/components/social/**/*.{ts,tsx}",
      "src/components/theater/**/*.{ts,tsx}",
      "src/components/lobby/**/*.{ts,tsx}",
      "src/components/settings/**/*.{ts,tsx}",
      "src/components/profile/**/*.{ts,tsx}",
      "src/pages/Lobby.tsx",
      "src/pages/Library.tsx",
      "src/pages/Account.tsx",
      "src/pages/Settings.tsx",
      "src/pages/Profile.tsx",
      "src/pages/Inbox.tsx",
      "src/pages/account/**/*.{ts,tsx}",
    ],
    plugins: { "design-law": designLaw },
    rules: {
      "design-law/no-filled-button": "warn",
      "design-law/no-bordered-card": "warn",
    },
  },
);

