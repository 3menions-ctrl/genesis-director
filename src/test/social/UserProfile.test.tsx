import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

// Mock react-router-dom's useParams
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ userId: 'test-user-123' }),
  };
});

// Mock the hooks
vi.mock('@/hooks/usePublicProfile', () => ({
  usePublicProfile: vi.fn(() => ({
    profile: {
      id: 'test-user-123',
      display_name: 'Test Creator',
      avatar_url: null,
      followers_count: 42,
      following_count: 10,
      videos_count: 5,
      is_following: false,
    },
    isLoading: false,
    videos: [
      {
        id: 'video-1',
        title: 'Amazing Video',
        thumbnail_url: 'https://example.com/thumb.jpg',
        video_url: 'https://example.com/video.mp4',
        created_at: '2024-01-15T10:00:00Z',
        likes_count: 25,
      },
    ],
    videosLoading: false,
    followUser: { mutateAsync: vi.fn(), isPending: false },
    unfollowUser: { mutateAsync: vi.fn(), isPending: false },
  })),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'current-user-456' },
    profile: { display_name: 'Current User' },
    loading: false,
  }),
}));

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    section: ({ children, ...props }: any) => <section {...props}>{children}</section>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

// Mock ProfileBackground
vi.mock('@/components/profile/ProfileBackground', () => ({
  default: () => <div data-testid="profile-background" />,
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

describe('UserProfile Page', () => {
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

  it('renders the creator profile with display name', async () => {
    const UserProfile = (await import('@/pages/UserProfile')).default;
    
    const { getByText } = render(<UserProfile />, { wrapper });

    expect(getByText('Test Creator')).toBeInTheDocument();
  });

  it('displays follower and video counts', async () => {
    const UserProfile = (await import('@/pages/UserProfile')).default;
    
    const { getByText } = render(<UserProfile />, { wrapper });

    expect(getByText('42')).toBeInTheDocument(); // followers
    expect(getByText('5')).toBeInTheDocument(); // videos
  });

  it('shows Follow button when not following and not own profile', async () => {
    const UserProfile = (await import('@/pages/UserProfile')).default;
    
    const { getByRole } = render(<UserProfile />, { wrapper });

    expect(getByRole('button', { name: /follow/i })).toBeInTheDocument();
  });

  it('renders the public videos section', async () => {
    const UserProfile = (await import('@/pages/UserProfile')).default;
    
    const { getByText } = render(<UserProfile />, { wrapper });

    expect(getByText('Public Videos')).toBeInTheDocument();
  });

  it('displays video titles in the grid', async () => {
    const UserProfile = (await import('@/pages/UserProfile')).default;
    
    const { getByText } = render(<UserProfile />, { wrapper });

    expect(getByText('Amazing Video')).toBeInTheDocument();
  });

  it('includes AppHeader component', async () => {
    const UserProfile = (await import('@/pages/UserProfile')).default;
    
    const { getByTestId } = render(<UserProfile />, { wrapper });

    expect(getByTestId('app-header')).toBeInTheDocument();
  });
});

describe('UserProfile Page Edge Cases', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  it('exports the UserProfile component', async () => {
    const module = await import('@/pages/UserProfile');
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe('function');
  });
});
