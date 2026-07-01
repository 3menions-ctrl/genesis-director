# Migration reconciliation — repo ↔ prod (2026-07-01)

Read-only assessment against prod (`ywcwaumozoejierlfkgj`) via the Management API.
**No prod writes were made.** This PR is a repo-side fix only.

## What was actually wrong

The scary-looking drift ("duplicate `20260706005000`", "prod-only `008000`/`009000`")
came from a **stale local worktree** (`genesis-director-admin`), not from `main`.
Current `origin/main` is already mostly reconciled: `production_finishing` sits at
`008000` and `shot_routing_map` at `009000`, matching prod, with no dup-`005000`.

Prod's applied migration history (`supabase_migrations.schema_migrations`):

| version | prod name | repo file (before this PR) |
|---|---|---|
| 004000 | world_chat | world_chat ✅ |
| 005000 | world_chat_images | world_chat_images ✅ |
| 006000 | **shot_routing_map** | **world_chat_delete** ⚠️ |
| 007000 | clip_lipsync | clip_lipsync ✅ |
| 008000 | production_finishing | production_finishing ✅ |
| 009000 | shot_routing_map | shot_routing_map ✅ |

Two real facts surfaced:

1. **`world_chat_delete` was NEVER applied to prod** — no history row, and its RPC/policy
   is absent (`pg_policies`/`pg_proc` confirm). But the repo numbered it `006000`, and prod
   has **already** recorded `006000` = `shot_routing_map`. Supabase keys on *version*, so a
   naive `supabase db push` sees `006000` as "already applied" and **silently skips
   `world_chat_delete` forever.** That's the bug this PR fixes.

2. **`shot_routing_map` was applied twice in prod** (`006000` and `009000`) — a harmless
   out-of-band double-apply (the migration is idempotent: `add column if not exists`). Repo
   carries it once (`009000`). This leaves a cosmetic `migration list` drift at `006000`
   (remote-only); no schema impact.

## This PR (repo-only, safe)

- Renumber `20260706006000_world_chat_delete.sql` → **`20260706010000_world_chat_delete.sql`**,
  past prod's latest version so it no longer collides and will apply cleanly. The migration
  is idempotent and low-risk (a DELETE RLS policy scoped to `user_id = auth.uid()` +
  `REPLICA IDENTITY FULL` for realtime delete payloads — security-positive, not finance).

Nothing else in the repo needs to change. No `db push` was run.

## Deferred — needs an explicit go (prod writes)

1. **Apply `world_chat_delete`** so authors can delete their own World Chat messages in prod:
   `supabase db push` (direct connection, no Docker) — or apply the two statements via the
   Management API. Idempotent; safe to run. Until then the "delete my message" path is
   inert in prod.
2. **(Optional, cosmetic) clear the `006000` remote-only drift** from the redundant
   `shot_routing_map` double-apply: `supabase migration repair --status reverted 20260706006000`
   (a history-table write, no schema change). Purely to make `migration list` pristine.

## Verified NOT a problem
- All schema from `world_chat_images`, `production_finishing`, `shot_routing_map`,
  `clip_lipsync`, `world_chat` is present in prod (`information_schema` checks passed).
- No finance/credit migrations are pending. The gated finance backlog is unrelated and
  untouched here.
