import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { UniversalVideoPlayer } from './UniversalVideoPlayer';

// Mock supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            not: () => ({
              order: () => Promise.resolve({ data: [], error: null })
            })
          })
        })
      })
    })
  }
}));

// Mock navigation
vi.mock('@/lib/navigation', () => ({
  navigationCoordinator: { registerGlobalCleanup: vi.fn(() => vi.fn()) },
  useMediaCleanup: vi.fn(),
  useRouteCleanup: vi.fn(),
}));

// Mock hls.js
vi.mock('hls.js', () => ({
  default: {
    isSupported: () => false,
    Events: { MANIFEST_PARSED: 'hlsManifestParsed', ERROR: 'hlsError', FRAG_LOADED: 'hlsFragLoaded' },
    ErrorTypes: { NETWORK_ERROR: 'networkError', MEDIA_ERROR: 'mediaError' },
  },
}));

// Mock video platform detection
vi.mock('@/lib/video/platformDetection', () => ({
  logPlaybackPath: vi.fn(),
  getPlatformCapabilities: () => ({ preferredPlaybackMode: 'hls_universal', supportsMSE: true }),
  requiresHLSPlayback: () => true,
}));

describe('UniversalVideoPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders placeholder when no valid source provided', () => {
    const { container } = render(<UniversalVideoPlayer source={{}} />);
    // Should render the placeholder with Film icon (no video element)
    expect(container.querySelector('video')).toBeNull();
  });

  it('renders in thumbnail mode with valid source', () => {
    const { container } = render(
      <UniversalVideoPlayer 
        source={{ urls: ['https://example.com/video.mp4'] }}
        mode="thumbnail"
      />
    );
    
    // Should render a video element
    const video = container.querySelector('video');
    expect(video).toBeTruthy();
    expect(video?.muted).toBe(true);
  });

  it('calls onClick in thumbnail mode', async () => {
    const onClick = vi.fn();
    const { container } = render(
      <UniversalVideoPlayer 
        source={{ urls: ['https://example.com/video.mp4'] }}
        mode="thumbnail"
        onClick={onClick}
      />
    );
    
    const wrapper = container.firstChild as HTMLElement;
    wrapper?.click();
    expect(onClick).toHaveBeenCalled();
  });

  it('renders fullscreen mode with close button', () => {
    const onClose = vi.fn();
    const { container } = render(
      <UniversalVideoPlayer 
        source={{ urls: ['https://example.com/video.mp4'] }}
        mode="fullscreen"
        onClose={onClose}
      />
    );
    
    // Fullscreen mode should have fixed positioning
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper?.className).toContain('fixed');
    expect(wrapper?.className).toContain('inset-0');
  });

  it('applies custom className', () => {
    const { container } = render(
      <UniversalVideoPlayer 
        source={{ urls: ['https://example.com/video.mp4'] }}
        mode="inline"
        className="custom-class"
      />
    );
    
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper?.className).toContain('custom-class');
  });

  it('renders inline mode with HLS player', () => {
    const { container } = render(
      <UniversalVideoPlayer 
        source={{ urls: ['https://example.com/video.mp4'] }}
        mode="inline"
      />
    );
    
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toBeTruthy();
  });

  it('starts muted when muted prop is true', () => {
    const { container } = render(
      <UniversalVideoPlayer 
        source={{ urls: ['https://example.com/video.mp4'] }}
        mode="thumbnail"
        muted
      />
    );
    
    const video = container.querySelector('video');
    expect(video?.muted).toBe(true);
  });

  it('renders export mode with success styling', () => {
    const { container } = render(
      <UniversalVideoPlayer 
        source={{ urls: ['https://example.com/video.mp4'] }}
        mode="export"
      />
    );
    
    // Export mode has emerald success styling
    expect(container.innerHTML).toContain('emerald');
  });
});
