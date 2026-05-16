import { QueryClient } from "@tanstack/react-query";

/**
 * Single shared QueryClient.
 *
 * Exported from a module (not constructed inside App) so that AuthContext —
 * and any other module that needs to invalidate cached data on identity
 * transitions — can call `queryClient.clear()` / `removeQueries` without
 * smuggling the instance through React context.
 *
 * Cross-user data isolation depends on this being a single module instance:
 * on sign-out (and on a user-id change inside `onAuthStateChange`) the
 * AuthContext synchronously clears this cache before any new query runs,
 * which prevents the prior user's profile/credits/projects rows from being
 * read by the next user on the same tab.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Hard reset of every cached query + mutation. Call this on sign-out or
 * when the authenticated user id changes mid-session. Wrapped so callers
 * can swap implementations in tests without touching React Query directly.
 */
export function resetQueryCache(reason: string) {
  try {
    queryClient.cancelQueries();
    queryClient.clear();
    if (typeof console !== "undefined") {
      // Intentionally a single, low-noise log line — surfaces in forensics
      // without polluting normal navigation.
      console.info(`[queryClient] cache cleared: ${reason}`);
    }
  } catch (err) {
    console.error("[queryClient] cache reset failed:", err);
  }
}
