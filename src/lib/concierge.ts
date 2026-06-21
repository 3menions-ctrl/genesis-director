/**
 * Concierge — anticipatory navigation aids.
 *
 * Two complementary helpers:
 *
 * 1. recordVisit(path) / nextLikelyRoutes(path):
 *    A markov-chain-light model of route transitions. Each time the user
 *    navigates from A → B, we bump a counter on the edge. At any path
 *    we can predict the next 3 most-likely targets. Persisted to
 *    localStorage so it survives refresh.
 *
 * 2. warmCandidates(): given the current path, calls the existing
 *    routePreload registerPrefetch system to start downloading the
 *    next-likely chunks during browser idle time. By the time the user
 *    actually clicks, the chunk is in memory.
 *
 * The model is intentionally tiny — no Linear-style cmd-K recents, no
 * ML — just a "users who went here next went here" lookup. Good enough
 * to make the next click feel instant.
 */

const STORAGE_KEY = "sb.concierge.chain.v1";
const MAX_EDGES_PER_NODE = 10;

interface Chain {
  // path → { nextPath → count }
  edges: Record<string, Record<string, number>>;
}

function load(): Chain {
  if (typeof window === "undefined") return { edges: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Chain) : { edges: {} };
  } catch { return { edges: {} }; }
}

// Debounced save — previously fired synchronously on every navigation,
// running JSON.stringify of the full edge chain on the main thread.
// At ~50 routes × 25 edges = 1250 entries, the stringify started
// blocking renders. Buffer writes and flush every 5s.
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function save(chain: Chain) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(chain)); }
    catch { /* localStorage full or blocked */ }
  }, 5000);
}
// Best-effort flush on tab close so we don't lose recent edges.
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    if (saveTimer) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(chain)); } catch { /* ignored */ }
    }
  });
}

let chain: Chain = load();
let lastPath: string | null = null;

/** Strip dynamic ids from a pathname for stable bucketing. */
export function bucket(pathname: string): string {
  return pathname
    .replace(/\/[0-9a-f-]{20,}/g, "/:id")    // uuid-ish
    .replace(/\/\d+/g, "/:id");              // numeric
}

export function recordVisit(pathname: string): void {
  const cur = bucket(pathname);
  if (lastPath && lastPath !== cur) {
    if (!chain.edges[lastPath]) chain.edges[lastPath] = {};
    chain.edges[lastPath][cur] = (chain.edges[lastPath][cur] ?? 0) + 1;

    // Trim if we've grown past the cap on this node.
    const entries = Object.entries(chain.edges[lastPath]);
    if (entries.length > MAX_EDGES_PER_NODE) {
      const sorted = entries.sort((a, b) => b[1] - a[1]);
      chain.edges[lastPath] = Object.fromEntries(sorted.slice(0, MAX_EDGES_PER_NODE));
    }

    save(chain);
  }
  lastPath = cur;
}

export function nextLikelyRoutes(pathname: string, limit = 3): string[] {
  const cur = bucket(pathname);
  const edges = chain.edges[cur];
  if (!edges) return [];
  return Object.entries(edges)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([target]) => target);
}

export function clearChain(): void {
  chain = { edges: {} };
  save(chain);
}
