/**
 * ADMIN_ENABLED — whether the admin module (src/admin/AdminApp, src/refine, the
 * whole /admin/* surface) is compiled into THIS build.
 *
 * Strategy: keep the admin console OFF the public internet. The public production
 * build leaves VITE_ADMIN unset, so this is statically `false`, the lazy
 * `import('./AdminApp')` becomes dead code, and Rollup tree-shakes the entire
 * admin chunk tree out of the deployed bundle — /admin is never served publicly.
 *
 * It's `true` when:
 *   • running the dev server (`import.meta.env.DEV`), or
 *   • an internal/VPN-hosted build run with `VITE_ADMIN=true vite build`.
 *
 * Keep this a single statically-foldable expression so dead-code elimination
 * can drop the admin import in production.
 */
export const ADMIN_ENABLED: boolean =
  import.meta.env.VITE_ADMIN === 'true' || import.meta.env.DEV;
