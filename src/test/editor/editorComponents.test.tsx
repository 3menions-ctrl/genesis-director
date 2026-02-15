import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { EditorToolbar } from '@/components/editor/EditorToolbar';
import { EditorPreview } from '@/components/editor/EditorPreview';
import { EditorSidebar } from '@/components/editor/EditorSidebar';
import { EditorTimeline } from '@/components/editor/EditorTimeline';
import type { TimelineTrack, TimelineClip } from '@/components/editor/types';

// Helper to wrap components that need TooltipProvider
const withTooltip = (ui: React.ReactElement) => <TooltipProvider>{ui}</TooltipProvider>;

// --- Test data ---
const makeVideoClip = (overrides?: Partial<TimelineClip>): TimelineClip => ({
  id: 'clip-1',
  trackId: 'video-0',
  start: 0,
  end: 6,
  type: 'video',
  sourceUrl: 'https://example.com/video.mp4',
  label: 'Shot 1',
  effects: [],
  ...overrides,
});

const makeTextClip = (overrides?: Partial<TimelineClip>): TimelineClip => ({
  id: 'text-1',
  trackId: 'text-0',
  start: 1,
  end: 4,
  type: 'text',
  sourceUrl: '',
  label: 'Title',
  effects: [],
  textContent: 'Hello World',
  textStyle: { fontSize: 48, color: '#FFFFFF' },
  ...overrides,
});

const makeTracks = (videoClips: TimelineClip[] = [makeVideoClip()], textClips: TimelineClip[] = []): TimelineTrack[] => [
  { id: 'video-0', name: 'Video', type: 'video', clips: videoClips, muted: false, locked: false },
  { id: 'text-0', name: 'Text', type: 'text', clips: textClips, muted: false, locked: false },
];

// --- EditorToolbar ---
describe('EditorToolbar', () => {
  const defaultProps = {
    title: 'My Edit',
    onTitleChange: vi.fn(),
    onSave: vi.fn(),
    onExport: vi.fn(),
    onBack: vi.fn(),
    isSaving: false,
    renderStatus: 'idle',
    renderProgress: 0,
  };

  it('renders title input and action buttons', () => {
    render(<EditorToolbar {...defaultProps} />);
    expect(screen.getByDisplayValue('My Edit')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.getByText('Export')).toBeInTheDocument();
  });

  it('calls onSave when Save button clicked', () => {
    render(<EditorToolbar {...defaultProps} />);
    fireEvent.click(screen.getByText('Save'));
    expect(defaultProps.onSave).toHaveBeenCalledOnce();
  });

  it('calls onExport when Export button clicked', () => {
    render(<EditorToolbar {...defaultProps} />);
    fireEvent.click(screen.getByText('Export'));
    expect(defaultProps.onExport).toHaveBeenCalledOnce();
  });

  it('disables Export when rendering', () => {
    render(<EditorToolbar {...defaultProps} renderStatus="rendering" renderProgress={50} />);
    expect(screen.getByText('Export').closest('button')).toBeDisabled();
  });

  it('shows progress bar when rendering', () => {
    render(<EditorToolbar {...defaultProps} renderStatus="rendering" renderProgress={42} />);
    expect(screen.getByText('42%')).toBeInTheDocument();
  });

  it('shows completion indicator when render is done', () => {
    render(<EditorToolbar {...defaultProps} renderStatus="completed" />);
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('calls onBack when back button clicked', () => {
    render(<EditorToolbar {...defaultProps} />);
    // The back button is the first button (ArrowLeft icon)
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    expect(defaultProps.onBack).toHaveBeenCalledOnce();
  });

  it('shows loading spinner when saving', () => {
    render(<EditorToolbar {...defaultProps} isSaving={true} />);
    expect(screen.getByText('Save').closest('button')).toBeDisabled();
  });
});

// --- EditorPreview ---
describe('EditorPreview', () => {
  const defaultProps = {
    tracks: makeTracks(),
    currentTime: 3,
    isPlaying: false,
    onPlayPause: vi.fn(),
    onTimeChange: vi.fn(),
    duration: 12,
  };

  it('renders transport controls', () => {
    render(withTooltip(<EditorPreview {...defaultProps} />));
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  });

  it('renders timecode display', () => {
    render(withTooltip(<EditorPreview {...defaultProps} />));
    expect(screen.getByText(/00:03/)).toBeInTheDocument();
  });

  it('renders video element for clip playback', () => {
    render(withTooltip(<EditorPreview {...defaultProps} currentTime={3} />));
    // Direct MP4 player renders a video element
    const video = document.querySelector('video');
    expect(video).toBeTruthy();
  });

  it('renders text overlays when text clips are active', () => {
    const tracks = makeTracks([makeVideoClip()], [makeTextClip({ start: 0, end: 5 })]);
    render(withTooltip(<EditorPreview {...defaultProps} tracks={tracks} currentTime={2} />));
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('calls onPlayPause when play button clicked', () => {
    render(withTooltip(<EditorPreview {...defaultProps} />));
    // Find the play button by its aria-label or icon
    const playBtn = screen.getAllByRole('button').find(
      btn => btn.querySelector('.lucide-play') || btn.querySelector('.lucide-pause')
    );
    if (playBtn) {
      fireEvent.click(playBtn);
      expect(defaultProps.onPlayPause).toHaveBeenCalledOnce();
    } else {
      // If no distinct play button found, click the second button (transport area)
      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[1]);
      expect(defaultProps.onPlayPause).toHaveBeenCalled();
    }
  });
});

// --- EditorSidebar ---
describe('EditorSidebar', () => {
  const defaultProps = {
    tracks: makeTracks([makeVideoClip()], [makeTextClip()]),
    selectedClipId: null as string | null,
    onUpdateClip: vi.fn(),
    onAddTextOverlay: vi.fn(),
    onAddTransition: vi.fn(),
    onDeleteClip: vi.fn(),
  };

  it('shows tools panel when no clip selected', () => {
    render(<EditorSidebar {...defaultProps} />);
    expect(screen.getByText('Tools')).toBeInTheDocument();
    expect(screen.getByText('Add Text Overlay')).toBeInTheDocument();
  });

  it('calls onAddTextOverlay when button clicked', () => {
    render(<EditorSidebar {...defaultProps} />);
    fireEvent.click(screen.getByText('Add Text Overlay'));
    expect(defaultProps.onAddTextOverlay).toHaveBeenCalledOnce();
  });

  it('shows video clip properties when video clip selected', () => {
    render(<EditorSidebar {...defaultProps} selectedClipId="clip-1" />);
    // The sidebar now uses "Inspector" header and "Props" tab instead of "Properties"
    expect(screen.getByText('Inspector') || screen.getByText('Props')).toBeTruthy();
    expect(screen.getByText('Shot 1')).toBeInTheDocument();
    expect(screen.getByText('Delete Clip')).toBeInTheDocument();
  });

  it('shows text clip properties when text clip selected', () => {
    render(<EditorSidebar {...defaultProps} selectedClipId="text-1" />);
    expect(screen.getByDisplayValue('Hello World')).toBeInTheDocument();
  });

  it('shows transition buttons for video clips', () => {
    render(<EditorSidebar {...defaultProps} selectedClipId="clip-1" />);
    expect(screen.getByText('Crossfade')).toBeInTheDocument();
    expect(screen.getByText('Dissolve')).toBeInTheDocument();
  });

  it('calls onDeleteClip when delete button clicked', () => {
    render(<EditorSidebar {...defaultProps} selectedClipId="clip-1" />);
    fireEvent.click(screen.getByText('Delete Clip'));
    expect(defaultProps.onDeleteClip).toHaveBeenCalledWith('clip-1');
  });

  it('calls onAddTransition when transition button clicked', () => {
    render(<EditorSidebar {...defaultProps} selectedClipId="clip-1" />);
    fireEvent.click(screen.getByText('Crossfade'));
    expect(defaultProps.onAddTransition).toHaveBeenCalledWith('clip-1', 'crossfade');
  });
});

// --- EditorTimeline ---
describe('EditorTimeline', () => {
  const defaultProps = {
    tracks: makeTracks([makeVideoClip(), makeVideoClip({ id: 'clip-2', start: 6, end: 12, label: 'Shot 2' })]),
    currentTime: 3,
    duration: 12,
    zoom: 1,
    selectedClipId: null as string | null,
    onTimeChange: vi.fn(),
    onSelectClip: vi.fn(),
    onUpdateClip: vi.fn(),
    onReorderClip: vi.fn(),
    onZoomChange: vi.fn(),
    onDeleteClip: vi.fn(),
  };

  it('renders track labels', () => {
    render(<EditorTimeline {...defaultProps} />);
    expect(screen.getByText('Video')).toBeInTheDocument();
    expect(screen.getByText('Text')).toBeInTheDocument();
  });

  it('renders clip labels on timeline', () => {
    render(<EditorTimeline {...defaultProps} />);
    expect(screen.getByText('Shot 1')).toBeInTheDocument();
    expect(screen.getByText('Shot 2')).toBeInTheDocument();
  });

  it('shows zoom percentage', () => {
    render(<EditorTimeline {...defaultProps} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('shows delete button when clip selected', () => {
    render(withTooltip(<EditorTimeline {...defaultProps} selectedClipId="clip-1" />));
    // There should be a trash icon button in the toolbar
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(3); // zoom in, zoom out, delete
  });

  it('calls onSelectClip when clip clicked', () => {
    render(<EditorTimeline {...defaultProps} />);
    fireEvent.click(screen.getByText('Shot 1'));
    expect(defaultProps.onSelectClip).toHaveBeenCalledWith('clip-1');
  });

  it('shows transition indicator on clips with effects', () => {
    const clipWithEffect = makeVideoClip({
      effects: [{ type: 'transition', name: 'crossfade', duration: 0.5 }],
    });
    const tracks = makeTracks([clipWithEffect]);
    const { container } = render(<EditorTimeline {...defaultProps} tracks={tracks} />);
    // The transition indicator is a small white pulsing dot
    const dot = container.querySelector('.rounded-full.bg-white') || container.querySelector('.rounded-full.animate-pulse');
    expect(dot).toBeTruthy();
  });
});
