import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

// Mock the hooks
vi.mock('@/hooks/usePublicProfile', () => ({
  useCreatorDiscovery: vi.fn(() => ({
    data: [
      {
        id: 'creator-1',
        display_name: 'Popular Creator',
        avatar_url: 'https://example.com/avatar1.jpg',
        video_count: 15,
      },
      {
        id: 'creator-2',
        display_name: 'New Creator',
        avatar_url: null,
        video_count: 3,
      },
    ],
    isLoading: false,
  })),
  useFollowingFeed: vi.fn(() => ({
    data: [
      {
        id: 'feed-video-1',
        title: 'Feed Video 1',
        thumbnail_url: 'https://example.com/thumb1.jpg',
        video_url: 'https://example.com/video1.mp4',
        created_at: '2024-01-20T12:00:00Z',
        likes_count: 50,
        user_id: 'creator-1',
        creator: {
          id: 'creator-1',
          display_name: 'Popular Creator',
          avatar_url: 'https://example.com/avatar1.jpg',
        },
      },
    ],
    isLoading: false,
  })),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'current-user-123' },
    profile: { display_name: 'Current User' },
    loading: false,
  }),
}));

// Mock framer-motion with all element types
const createMotionProxy = () => new Proxy({}, {
  get: (_target, prop) => ({ children, ...props }: any) => {
    const { initial, animate, transition, whileInView, viewport, variants, whileHover, whileTap, exit, layout, layoutId, ...rest } = props;
    const Tag = String(prop) as any;
    return <Tag {...rest}>{children}</Tag>;
  }
});
vi.mock('framer-motion', () => ({
  motion: createMotionProxy(),
  AnimatePresence: ({ children }: any) => children,
}));

// Mock CreatorsBackground
vi.mock('@/components/creators/CreatorsBackground', () => ({
  default: () => <div data-testid="creators-background" />,
}));

// Mock CreatorsHero
vi.mock('@/components/creators/CreatorsHero', () => ({
  CreatorsHero: () => <div data-testid="creators-hero" />,
}));

// Mock AppHeader
vi.mock('@/components/layout/AppHeader', () => ({
  AppHeader: () => <nav data-testid="app-header" />,
}));

// Mock LazyVideoThumbnail (replaces PausedFrameVideo in grid views)
vi.mock('@/components/ui/LazyVideoThumbnail', () => ({
  LazyVideoThumbnail: ({ src }: { src: string }) => (
    <div data-testid="lazy-video-thumbnail" data-src={src} />
  ),
}));

// Mock PausedFrameVideo
vi.mock('@/components/ui/PausedFrameVideo', () => ({
  PausedFrameVideo: ({ src }: { src: string }) => (
    <video data-testid="paused-frame-video" src={src} />
  ),
}));

// Mock UniversalVideoPlayer (uses canvas/video APIs unavailable in jsdom)
vi.mock('@/components/player', () => ({
  UniversalVideoPlayer: () => <div data-testid="universal-video-player" />,
  default: () => <div data-testid="universal-video-player" />,
}));

// Mock Skeleton (depends on Radix internals)
vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: any) => <div data-testid="skeleton" className={className} />,
}));

describe('Creators Page', () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  it('renders the Creators page without crashing', async () => {
    const Creators = (await import('@/pages/Creators')).default;
    const { container } = render(<Creators />, { wrapper });
    expect(container.firstChild).toBeTruthy();
  });

  it('Creators module exports a default component', async () => {
    const mod = await import('@/pages/Creators');
    expect(typeof mod.default).toBe('function');
  });
});

describe('Creators Page Exports', () => {
  it('exports the Creators component', async () => {
    const module = await import('@/pages/Creators');
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe('function');
  });
});
