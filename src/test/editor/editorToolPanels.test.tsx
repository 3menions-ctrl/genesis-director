import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MusicLibraryPanel } from '@/components/editor/MusicLibraryPanel';
import { TrendingEffectsPanel } from '@/components/editor/TrendingEffectsPanel';
import { StickersPanel } from '@/components/editor/StickersPanel';
import { MUSIC_LIBRARY, EFFECT_PRESETS, STICKER_PRESETS } from '@/components/editor/types';

// --- MusicLibraryPanel ---
describe('MusicLibraryPanel', () => {
  const onAddMusic = vi.fn();

  it('renders header and track count', () => {
    render(<MusicLibraryPanel onAddMusic={onAddMusic} />);
    expect(screen.getByText('Music Library')).toBeInTheDocument();
    expect(screen.getByText(`${MUSIC_LIBRARY.length} tracks`)).toBeInTheDocument();
  });

  it('renders all category filter buttons', () => {
    render(<MusicLibraryPanel onAddMusic={onAddMusic} />);
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Cinematic')).toBeInTheDocument();
    expect(screen.getByText('Electronic')).toBeInTheDocument();
    expect(screen.getByText('Lo-Fi')).toBeInTheDocument();
  });

  it('renders music tracks with titles', () => {
    render(<MusicLibraryPanel onAddMusic={onAddMusic} />);
    // At least the first track should be visible
    const firstTrack = MUSIC_LIBRARY[0];
    expect(screen.getByText(firstTrack.title)).toBeInTheDocument();
  });

  it('calls onAddMusic when a track is clicked', () => {
    render(<MusicLibraryPanel onAddMusic={onAddMusic} />);
    const firstTrack = MUSIC_LIBRARY[0];
    fireEvent.click(screen.getByText(firstTrack.title));
    expect(onAddMusic).toHaveBeenCalledWith(firstTrack);
  });

  it('filters tracks by category', () => {
    render(<MusicLibraryPanel onAddMusic={onAddMusic} />);
    fireEvent.click(screen.getByText('Cinematic'));
    const cinematicTracks = MUSIC_LIBRARY.filter(t => t.category === 'cinematic');
    cinematicTracks.forEach(t => {
      expect(screen.getByText(t.title)).toBeInTheDocument();
    });
  });

  it('filters tracks by search query', () => {
    render(<MusicLibraryPanel onAddMusic={onAddMusic} />);
    const searchInput = screen.getByPlaceholderText('Search by title, mood...');
    fireEvent.change(searchInput, { target: { value: MUSIC_LIBRARY[0].title } });
    expect(screen.getByText(MUSIC_LIBRARY[0].title)).toBeInTheDocument();
  });

  it('shows empty state when no tracks match search', () => {
    render(<MusicLibraryPanel onAddMusic={onAddMusic} />);
    const searchInput = screen.getByPlaceholderText('Search by title, mood...');
    fireEvent.change(searchInput, { target: { value: 'xyznonexistent' } });
    expect(screen.getByText('No tracks match your search')).toBeInTheDocument();
  });

  it('renders favorite heart icons for tracks', () => {
    const { container } = render(<MusicLibraryPanel onAddMusic={onAddMusic} />);
    const hearts = container.querySelectorAll('.lucide-heart');
    expect(hearts.length).toBeGreaterThan(0);
  });
});

// --- TrendingEffectsPanel ---
describe('TrendingEffectsPanel', () => {
  const onApplyEffect = vi.fn();

  it('renders header', () => {
    render(<TrendingEffectsPanel onApplyEffect={onApplyEffect} />);
    expect(screen.getByText('Effects')).toBeInTheDocument();
  });

  it('renders category tabs', () => {
    render(<TrendingEffectsPanel onApplyEffect={onApplyEffect} />);
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Trending')).toBeInTheDocument();
    expect(screen.getByText('Cinematic')).toBeInTheDocument();
    expect(screen.getByText('Creative')).toBeInTheDocument();
  });

  it('renders all effect presets', () => {
    render(<TrendingEffectsPanel onApplyEffect={onApplyEffect} />);
    EFFECT_PRESETS.forEach(effect => {
      expect(screen.getByText(effect.name)).toBeInTheDocument();
    });
  });

  it('calls onApplyEffect when effect clicked', () => {
    render(<TrendingEffectsPanel onApplyEffect={onApplyEffect} />);
    const firstEffect = EFFECT_PRESETS[0];
    fireEvent.click(screen.getByText(firstEffect.name));
    expect(onApplyEffect).toHaveBeenCalledWith(firstEffect.id);
  });

  it('filters by category', () => {
    render(<TrendingEffectsPanel onApplyEffect={onApplyEffect} />);
    fireEvent.click(screen.getByText('Trending'));
    const trendingEffects = EFFECT_PRESETS.filter(e => e.category === 'trending');
    trendingEffects.forEach(e => {
      expect(screen.getByText(e.name)).toBeInTheDocument();
    });
  });

  it('highlights active effects', () => {
    const activeId = EFFECT_PRESETS[0].id;
    const { container } = render(
      <TrendingEffectsPanel onApplyEffect={onApplyEffect} activeEffects={[activeId]} />
    );
    // Active effect should have the highlighted border class
    const activeCard = container.querySelector('.bg-white\\/\\[0\\.08\\]');
    expect(activeCard).toBeTruthy();
  });
});

// --- StickersPanel ---
describe('StickersPanel', () => {
  const onAddSticker = vi.fn();

  it('renders header', () => {
    render(<StickersPanel onAddSticker={onAddSticker} />);
    expect(screen.getByText('Stickers')).toBeInTheDocument();
  });

  it('renders category tabs', () => {
    render(<StickersPanel onAddSticker={onAddSticker} />);
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Emoji')).toBeInTheDocument();
    expect(screen.getByText('Shapes')).toBeInTheDocument();
    expect(screen.getByText('CTA')).toBeInTheDocument();
  });

  it('renders sticker items', () => {
    render(<StickersPanel onAddSticker={onAddSticker} />);
    // All stickers should be rendered (emoji content visible)
    const buttons = screen.getAllByRole('button');
    // 4 category tabs + sticker buttons
    expect(buttons.length).toBeGreaterThan(4);
  });

  it('calls onAddSticker when sticker clicked', () => {
    render(<StickersPanel onAddSticker={onAddSticker} />);
    const firstSticker = STICKER_PRESETS[0];
    fireEvent.click(screen.getByText(firstSticker.name));
    expect(onAddSticker).toHaveBeenCalledWith(firstSticker.id, firstSticker.name, firstSticker.category);
  });

  it('filters by emoji category', () => {
    render(<StickersPanel onAddSticker={onAddSticker} />);
    fireEvent.click(screen.getByText('Emoji'));
    const emojiStickers = STICKER_PRESETS.filter(s => s.category === 'emoji');
    emojiStickers.forEach(s => {
      expect(screen.getByText(s.name)).toBeInTheDocument();
    });
  });

  it('filters by CTA category', () => {
    render(<StickersPanel onAddSticker={onAddSticker} />);
    fireEvent.click(screen.getByText('CTA'));
    const ctaStickers = STICKER_PRESETS.filter(s => s.category === 'cta');
    ctaStickers.forEach(s => {
      expect(screen.getByText(s.name)).toBeInTheDocument();
    });
  });
});
