import { describe, it, expect } from 'vitest';
import { TRANSITION_TYPES } from '@/components/editor/types';
import type { TimelineClip, TimelineTrack, EditorState, ClipEffect, TextStyle } from '@/components/editor/types';

describe('Editor Types', () => {
  describe('TRANSITION_TYPES', () => {
    it('should define all 6 transition types', () => {
      expect(TRANSITION_TYPES).toHaveLength(6);
    });

    it('each transition should have id, name, and icon', () => {
      for (const t of TRANSITION_TYPES) {
        expect(t.id).toBeTruthy();
        expect(t.name).toBeTruthy();
        expect(t.icon).toBeTruthy();
      }
    });

    it('should include crossfade and dissolve', () => {
      const ids = TRANSITION_TYPES.map(t => t.id);
      expect(ids).toContain('crossfade');
      expect(ids).toContain('dissolve');
      expect(ids).toContain('wipe-left');
      expect(ids).toContain('fade-black');
    });
  });

  describe('Type structures', () => {
    it('should allow creating a valid TimelineClip', () => {
      const clip: TimelineClip = {
        id: 'clip-1',
        trackId: 'video-0',
        start: 0,
        end: 5,
        type: 'video',
        sourceUrl: 'https://example.com/video.mp4',
        label: 'Test clip',
        effects: [],
      };
      expect(clip.id).toBe('clip-1');
      expect(clip.end - clip.start).toBe(5);
    });

    it('should allow text clip with style', () => {
      const style: TextStyle = {
        fontSize: 48,
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontFamily: 'Arial',
        textAlign: 'center',
      };
      const clip: TimelineClip = {
        id: 'text-1',
        trackId: 'text-0',
        start: 2,
        end: 5,
        type: 'text',
        sourceUrl: '',
        label: 'Title',
        effects: [],
        textContent: 'Hello World',
        textStyle: style,
      };
      expect(clip.textContent).toBe('Hello World');
      expect(clip.textStyle?.fontSize).toBe(48);
    });

    it('should allow clip with effects', () => {
      const effect: ClipEffect = {
        type: 'transition',
        name: 'crossfade',
        duration: 0.5,
        params: { easing: 'ease-in-out' },
      };
      const clip: TimelineClip = {
        id: 'clip-2',
        trackId: 'video-0',
        start: 0,
        end: 6,
        type: 'video',
        sourceUrl: '',
        label: 'With transition',
        effects: [effect],
      };
      expect(clip.effects).toHaveLength(1);
      expect(clip.effects[0].name).toBe('crossfade');
    });

    it('should allow creating valid TimelineTrack', () => {
      const track: TimelineTrack = {
        id: 'video-0',
        name: 'Video',
        type: 'video',
        clips: [],
        muted: false,
        locked: false,
      };
      expect(track.type).toBe('video');
      expect(track.clips).toEqual([]);
    });

    it('should allow creating valid EditorState', () => {
      const state: EditorState = {
        sessionId: null,
        projectId: 'proj-1',
        title: 'My Edit',
        tracks: [],
        currentTime: 0,
        duration: 30,
        isPlaying: false,
        selectedClipId: null,
        zoom: 1,
        renderStatus: 'idle',
        renderProgress: 0,
      };
      expect(state.renderStatus).toBe('idle');
      expect(state.duration).toBe(30);
    });

    it('should support trim in/out points', () => {
      const clip: TimelineClip = {
        id: 'clip-3',
        trackId: 'video-0',
        start: 0,
        end: 10,
        type: 'video',
        sourceUrl: '',
        label: 'Trimmed',
        effects: [],
        trimStart: 2,
        trimEnd: 8,
      };
      expect(clip.trimEnd! - clip.trimStart!).toBe(6);
    });
  });
});
