import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({
            data: {
              id: 'user-123',
              display_name: 'Test Creator',
              avatar_url: 'https://example.com/avatar.jpg',
            },
            error: null,
          })),
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({
              data: [
                { id: 'video-1', title: 'Test Video 1', likes_count: 10 },
                { id: 'video-2', title: 'Test Video 2', likes_count: 5 },
              ],
              error: null,
            })),
          })),
        })),
      })),
    })),
  },
}));

// Mock AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'current-user-123' },
    profile: { display_name: 'Current User' },
    loading: false,
  }),
}));

describe('usePublicProfile Hook', () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });
    vi.clearAllMocks();
  });

  it('should return null profile when userId is undefined', async () => {
    const { usePublicProfile } = await import('@/hooks/usePublicProfile');
    
    const { result } = renderHook(() => usePublicProfile(undefined), { wrapper });

    expect(result.current.profile).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });

  it('should export useCreatorDiscovery hook', async () => {
    const { useCreatorDiscovery } = await import('@/hooks/usePublicProfile');
    
    expect(typeof useCreatorDiscovery).toBe('function');
  });

  it('should export useFollowingFeed hook', async () => {
    const { useFollowingFeed } = await import('@/hooks/usePublicProfile');
    
    expect(typeof useFollowingFeed).toBe('function');
  });

  it('should provide followUser and unfollowUser mutations', async () => {
    const { usePublicProfile } = await import('@/hooks/usePublicProfile');
    
    const { result } = renderHook(() => usePublicProfile('user-123'), { wrapper });

    expect(result.current.followUser).toBeDefined();
    expect(result.current.unfollowUser).toBeDefined();
    expect(typeof result.current.followUser.mutateAsync).toBe('function');
    expect(typeof result.current.unfollowUser.mutateAsync).toBe('function');
  });
});

describe('PublicProfile Types', () => {
  it('should have correct type exports', async () => {
    const module = await import('@/hooks/usePublicProfile');
    
    // Check that the module exports the expected types (via functions that use them)
    expect(module.usePublicProfile).toBeDefined();
    expect(module.useCreatorDiscovery).toBeDefined();
    expect(module.useFollowingFeed).toBeDefined();
  });
});

describe('useCreatorDiscovery Hook', () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });
    vi.clearAllMocks();
  });

  it('should accept optional search query parameter', async () => {
    const { useCreatorDiscovery } = await import('@/hooks/usePublicProfile');
    
    const { result } = renderHook(() => useCreatorDiscovery('test query'), { wrapper });

    // Should not throw and should have loading state
    expect(result.current.isLoading).toBeDefined();
  });

  it('should work without search query', async () => {
    const { useCreatorDiscovery } = await import('@/hooks/usePublicProfile');
    
    const { result } = renderHook(() => useCreatorDiscovery(), { wrapper });

    expect(result.current.isLoading).toBeDefined();
  });
});

describe('useFollowingFeed Hook', () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });
    vi.clearAllMocks();
  });

  it('should be enabled when user is authenticated', async () => {
    const { useFollowingFeed } = await import('@/hooks/usePublicProfile');
    
    const { result } = renderHook(() => useFollowingFeed(), { wrapper });

    // Query should be enabled since we mocked a user
    expect(result.current.isLoading).toBe(true);
  });
});
