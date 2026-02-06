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

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
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

// Mock PausedFrameVideo
vi.mock('@/components/ui/PausedFrameVideo', () => ({
  PausedFrameVideo: ({ src }: { src: string }) => (
    <video data-testid="paused-frame-video" src={src} />
  ),
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

  it('renders the page header', async () => {
    const Creators = (await import('@/pages/Creators')).default;
    
    const { getByText } = render(<Creators />, { wrapper });

    expect(getByText('Discover Creators')).toBeInTheDocument();
  });

  it('displays the search input', async () => {
    const Creators = (await import('@/pages/Creators')).default;
    
    const { getByPlaceholderText } = render(<Creators />, { wrapper });

    expect(getByPlaceholderText('Search creators...')).toBeInTheDocument();
  });

  it('shows tab navigation for authenticated users', async () => {
    const Creators = (await import('@/pages/Creators')).default;
    
    const { getByText } = render(<Creators />, { wrapper });

    expect(getByText('Your Feed')).toBeInTheDocument();
    expect(getByText('Discover')).toBeInTheDocument();
  });

  it('renders creator cards in discover tab', async () => {
    const Creators = (await import('@/pages/Creators')).default;
    const user = userEvent.setup();
    
    const { getByText } = render(<Creators />, { wrapper });

    // Click Discover tab to see creators
    const discoverTab = getByText('Discover');
    await user.click(discoverTab);

    expect(getByText('Popular Creator')).toBeInTheDocument();
    expect(getByText('New Creator')).toBeInTheDocument();
  });

  it('displays video count for each creator', async () => {
    const Creators = (await import('@/pages/Creators')).default;
    const user = userEvent.setup();
    
    const { getByText } = render(<Creators />, { wrapper });

    // Click Discover tab
    const discoverTab = getByText('Discover');
    await user.click(discoverTab);

    expect(getByText('15 videos')).toBeInTheDocument();
    expect(getByText('3 videos')).toBeInTheDocument();
  });

  it('includes the search functionality', async () => {
    const Creators = (await import('@/pages/Creators')).default;
    const user = userEvent.setup();
    
    const { getByPlaceholderText } = render(<Creators />, { wrapper });

    const searchInput = getByPlaceholderText('Search creators...');
    await user.type(searchInput, 'test query');

    expect(searchInput).toHaveValue('test query');
  });

  it('includes AppHeader component', async () => {
    const Creators = (await import('@/pages/Creators')).default;
    
    const { getByTestId } = render(<Creators />, { wrapper });

    expect(getByTestId('app-header')).toBeInTheDocument();
  });
});

describe('Creators Page Feed Tab', () => {
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

  it('shows feed videos from followed creators', async () => {
    const Creators = (await import('@/pages/Creators')).default;
    
    const { getByText } = render(<Creators />, { wrapper });

    // Default tab for authenticated users is "feed"
    expect(getByText('Feed Video 1')).toBeInTheDocument();
  });

  it('displays creator info on feed videos', async () => {
    const Creators = (await import('@/pages/Creators')).default;
    
    const { getAllByText } = render(<Creators />, { wrapper });

    // Should show the creator name on feed items
    expect(getAllByText('Popular Creator').length).toBeGreaterThan(0);
  });
});

describe('Creators Page Exports', () => {
  it('exports the Creators component', async () => {
    const module = await import('@/pages/Creators');
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe('function');
  });
});
