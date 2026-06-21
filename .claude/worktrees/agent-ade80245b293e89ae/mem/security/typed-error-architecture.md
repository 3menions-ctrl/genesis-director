---
name: Typed Error Architecture
description: AppError taxonomy + reporter sink + error_reports table; replaces silent catch blocks
type: feature
---
- `src/lib/errors/AppError.ts` defines the discriminated AppError type (categories: auth, validation, network, pipeline, billing, permission, unknown) and `toAppError(unknown, opts)`.
- `src/lib/errors/reporter.ts` is the SINGLE sink: console + dedup (5s window) + toast (severity≥error) + best-effort persist to `public.error_reports`.
- `public.error_reports` is append-only (REVOKE UPDATE/DELETE), RLS: users insert own (or anon), admins read.
- Use `reportUnknown(err, 'source.action', { ...ctx })` in catch blocks. NEVER include PII/secrets in context.
- Edge functions should follow the same pattern via a future `_shared/errors.ts` (not yet wired).
