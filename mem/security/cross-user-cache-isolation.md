---
name: Cross-user React Query cache isolation
description: Why AuthContext must clear the shared QueryClient on signOut and on any auth user-id transition — required reading before touching auth or query setup
type: constraint
---

## Rule

The React Query cache lives in `src/lib/queryClient.ts` as a single module-scoped instance. It MUST be hard-reset (`queryClient.clear()`) on:

1. Explicit `signOut()` in `AuthContext`.
2. Any `onAuthStateChange` event where the incoming user id differs from the previously observed user id (login, logout, or another tab broadcasting a different account via the storage event).
3. The `security_version` invalidation path that calls `supabase.auth.signOut` directly inside `completeAuthInit`.

`AuthContext` uses `lastUserIdRef` to detect the transition and calls `resetQueryCache(reason)` from `src/lib/queryClient.ts`.

## Why

Without this, the previous user's profile / credits / projects / billing rows remain in cache and can be returned to the next user on the same tab (shared-device data leak). React Query also keys queries by their `queryKey`, so any query whose key omits the user id will collide across users.

## Rules for new code

- Do NOT construct a second `QueryClient` anywhere. Always import from `@/lib/queryClient`.
- Do NOT call `supabase.auth.signOut` directly from feature code without also calling `resetQueryCache('<reason>')`; prefer going through `AuthContext.signOut()` which handles it.
- Every `useQuery` whose data is user-scoped MUST include the user id in `queryKey`. The cache clear is a safety net, not a substitute.
