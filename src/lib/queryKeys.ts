/**
 * Query-key factory — central source of truth for TanStack Query keys.
 *
 * The audit found inline string keys everywhere (`['notifications', uid]`,
 * `['followers-count', user.id]`, `['gallery-showcase']`, `['gamification']`,
 * etc.) with inconsistent scoping. One hook would invalidate
 * `['followers-count']` (unscoped → matches every user's cache),
 * another would write `['followers-count', uid]` (scoped). Drift.
 *
 * This file centralises every key as a typed `as const` tuple so:
 *   - Hooks read + invalidate the same key by import, not string.
 *   - Scoping rules (uid / orgId) are enforced at type level.
 *   - `qk.workspace._all` matches every workspace-scoped key for a single
 *     `removeQueries({ queryKey: qk.workspace._all })` on workspace switch.
 *
 * Adding a key: add it here, import it where used. Never re-string a key.
 */

type UserId = string;
type OrgId = string;
type ProjectId = string;
type ReelId = string;

export const qk = {
  // Personal scope — keyed by uid
  user: {
    _all: ['user'] as const,
    profile:    (uid: UserId) => ['user', uid, 'profile'] as const,
    credits:    (uid: UserId) => ['user', uid, 'credits'] as const,
    followers:  (uid: UserId) => ['user', uid, 'followers'] as const,
    following:  (uid: UserId) => ['user', uid, 'following'] as const,
    gamification: (uid: UserId) => ['user', uid, 'gamification'] as const,
  },

  // Notifications + inbox
  notifications: {
    _all: ['notifications'] as const,
    list:  (uid: UserId, cursor?: string) =>
      cursor ? (['notifications', uid, cursor] as const) : (['notifications', uid] as const),
    unreadCount: (uid: UserId) => ['notifications', uid, 'unread-count'] as const,
  },

  // Projects (personal or workspace-scoped)
  projects: {
    _all: ['projects'] as const,
    list:   (uid: UserId, orgId?: OrgId) =>
      orgId ? (['projects', uid, 'org', orgId] as const)
            : (['projects', uid, 'personal'] as const),
    detail: (projectId: ProjectId) => ['projects', 'detail', projectId] as const,
    paginated: (uid: UserId) => ['projects', uid, 'paginated'] as const,
  },

  // Workspace / org scope — keyed by orgId so a workspace switch can
  // `removeQueries({ predicate: q => q.queryKey[0] === 'workspace' })`.
  workspace: {
    _all: ['workspace'] as const,
    members: (orgId: OrgId) => ['workspace', orgId, 'members'] as const,
    invites: (orgId: OrgId) => ['workspace', orgId, 'invites'] as const,
    brand:   (orgId: OrgId) => ['workspace', orgId, 'brand'] as const,
    credits: (orgId: OrgId) => ['workspace', orgId, 'credits'] as const,
    apiKeys: (orgId: OrgId) => ['workspace', orgId, 'api-keys'] as const,
  },

  // Social — reels, comments, likes
  reels: {
    _all: ['reels'] as const,
    feed:     (filter: string = 'all') => ['reels', 'feed', filter] as const,
    detail:   (reelId: ReelId) => ['reels', 'detail', reelId] as const,
    comments: (reelId: ReelId) => ['reels', reelId, 'comments'] as const,
    payload:  (reelId: ReelId, viewerId?: UserId) =>
      ['reels', reelId, 'payload', viewerId ?? 'anon'] as const,
  },

  // Marketplace
  market: {
    _all: ['market'] as const,
    listings: (tab: string = 'all') => ['market', 'listings', tab] as const,
    listing:  (listingId: string) => ['market', 'listing', listingId] as const,
    sellerStats: (sellerId: UserId) => ['market', 'seller', sellerId] as const,
  },

  // Help / Blog / static
  static: {
    blog: () => ['static', 'blog'] as const,
    help: () => ['static', 'help'] as const,
  },

  // Studio / production
  production: {
    _all: ['production'] as const,
    project:  (projectId: ProjectId) => ['production', projectId] as const,
    clips:    (projectId: ProjectId) => ['production', projectId, 'clips'] as const,
    avatars:  (uid: UserId) => ['avatar-templates', uid] as const,
    cinemaEntitlement: (uid: UserId) => ['cinema-entitlement', uid] as const,
  },

  // Admin / refine
  admin: {
    _all: ['admin'] as const,
    users:    ['admin', 'users'] as const,
    metrics:  ['admin', 'metrics'] as const,
    config:   ['admin', 'config'] as const,
  },
} as const;
