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
);

