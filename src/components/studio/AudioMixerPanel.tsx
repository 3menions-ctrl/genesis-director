/**
 * AudioMixerPanel - Multi-Track Audio Mixer UI
 * 
 * Professional audio mixing interface with:
 * - Voice, Music, and SFX track controls
 * - Per-track volume sliders with visual feedback
 * - Mute and Solo buttons
 * - Waveform visualization
 * - Master volume control
 */

import { memo, useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Volume2, 
  VolumeX, 
  Headphones, 
  Mic, 
  Music, 
  Sparkles,
  Play,
  Pause,
  Square,
  SkipBack,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useMultiTrackAudio } from '@/hooks/useMultiTrackAudio';
import { AudioTrackType, AudioTrackState } from '@/lib/audioEngine/MultiTrackAudioEngine';

interface AudioMixerPanelProps {
  voiceUrl?: string;
  musicUrl?: string;
  sfxUrl?: string;
  className?: string;
  /** Collapsed by default for Quick Create mode */
  defaultCollapsed?: boolean;
}

// Track configuration
const TRACK_CONFIG: Record<AudioTrackType, {
  label: string;
  icon: typeof Mic;
  color: string;
  bgColor: string;
}> = {
  voice: {
    label: 'Voice',
    icon: Mic,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
  },
  music: {
    label: 'Music',
    icon: Music,
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/20',
  },
  sfx: {
    label: 'SFX',
    icon: Sparkles,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
  },
};

// Format time for display
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Waveform visualization component
const WaveformDisplay = memo(function WaveformDisplay({
  data,
  currentTime,
  duration,
  color,
}: {
  data?: Float32Array;
  currentTime: number;
  duration: number;
  color: string;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="h-8 w-full bg-white/[0.02] rounded flex items-center justify-center">
        <span className="text-[10px] text-white/20">No waveform</span>
      </div>
    );
  }
  
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  
  return (
    <div className="relative h-8 w-full bg-white/[0.02] rounded overflow-hidden">
      {/* Waveform bars */}
      <div className="absolute inset-0 flex items-center gap-px px-1">
        {Array.from({ length: 50 }).map((_, i) => {
          const dataIndex = Math.floor((i / 50) * data.length);
          const value = data[dataIndex] || 0;
          const height = Math.max(4, value * 28);
          const isPlayed = (i / 50) * 100 < progress;
          
          return (
            <div
              key={i}
              className={cn(
                "flex-1 rounded-full transition-colors",
                isPlayed ? color.replace('text-', 'bg-') : 'bg-white/10'
              )}
              style={{ height }}
            />
          );
        })}
      </div>
      
      {/* Playhead */}
      <div
        className="absolute top-0 bottom-0 w-px bg-white shadow-glow"
        style={{ left: `${progress}%` }}
      />
    </div>
  );
});

// Individual track control
const TrackControl = memo(function TrackControl({
  type,
  state,
  onVolumeChange,
  onMuteToggle,
  onSoloToggle,
}: {
  type: AudioTrackType;
  state: AudioTrackState;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  onSoloToggle: () => void;
}) {
  const config = TRACK_CONFIG[type];
  const Icon = config.icon;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex flex-col gap-2 p-3 rounded-xl border transition-colors",
        state.isLoading
          ? "bg-white/[0.02] border-white/[0.05]"
          : state.error
          ? "bg-red-500/5 border-red-500/20"
          : "bg-white/[0.02] border-white/[0.08] hover:border-white/[0.12]"
      )}
    >
      {/* Track header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("p-1.5 rounded-lg", config.bgColor)}>
            <Icon className={cn("w-4 h-4", config.color)} />
          </div>
          <span className="text-sm font-medium text-white">{config.label}</span>
          
          {state.isLoading && (
            <Loader2 className="w-3 h-3 text-white/40 animate-spin" />
          )}
        </div>
        
        {/* Mute / Solo buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onMuteToggle}
            className={cn(
              "h-7 w-7 p-0",
              state.muted 
                ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" 
                : "text-white/40 hover:text-white hover:bg-white/10"
            )}
            title={state.muted ? 'Unmute' : 'Mute'}
          >
            {state.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onSoloToggle}
            className={cn(
              "h-7 w-7 p-0",
              state.solo 
                ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30" 
                : "text-white/40 hover:text-white hover:bg-white/10"
            )}
            title={state.solo ? 'Unsolo' : 'Solo'}
          >
            <Headphones className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      {/* Waveform */}
      <WaveformDisplay
        data={state.waveformData}
        currentTime={state.currentTime}
        duration={state.duration}
        color={config.color}
      />
      
      {/* Volume slider */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-white/40 w-8">VOL</span>
        <Slider
          value={[state.volume * 100]}
          onValueChange={([v]) => onVolumeChange(v / 100)}
          max={100}
          step={1}
          className="flex-1"
          disabled={state.muted}
        />
        <span className="text-xs text-white/60 w-8 text-right">
          {Math.round(state.volume * 100)}%
        </span>
      </div>
      
      {/* Duration */}
      {state.duration > 0 && (
        <div className="flex justify-between text-[10px] text-white/30">
          <span>{formatTime(state.currentTime)}</span>
          <span>{formatTime(state.duration)}</span>
        </div>
      )}
      
      {/* Error state */}
      {state.error && (
        <div className="text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded">
          {state.error}
        </div>
      )}
    </motion.div>
  );
});

export const AudioMixerPanel = memo(function AudioMixerPanel({
  voiceUrl,
  musicUrl,
  sfxUrl,
  className,
  defaultCollapsed = true,
}: AudioMixerPanelProps) {
  const [isExpanded, setIsExpanded] = useState(!defaultCollapsed);
  const {
    state,
    isInitialized,
    play,
    pause,
    stop,
    seek,
    loadTrack,
    setTrackVolume,
    setTrackMuted,
    setTrackSolo,
    setMasterVolume,
    initialize,
  } = useMultiTrackAudio();
  
  // Load tracks when URLs change
  useEffect(() => {
    const loadTracks = async () => {
      if (!isInitialized) {
        await initialize();
      }
      
      if (voiceUrl && voiceUrl !== state.voice.url) {
        await loadTrack('voice', voiceUrl);
      }
      if (musicUrl && musicUrl !== state.music.url) {
        await loadTrack('music', musicUrl);
      }
      if (sfxUrl && sfxUrl !== state.sfx.url) {
        await loadTrack('sfx', sfxUrl);
      }
    };
    
    loadTracks();
  }, [voiceUrl, musicUrl, sfxUrl, isInitialized, initialize, loadTrack, state.voice.url, state.music.url, state.sfx.url]);
  
  // Playback handlers
  const handlePlayPause = useCallback(() => {
    if (state.isPlaying) {
      pause();
    } else {
      play();
    }
  }, [state.isPlaying, play, pause]);
  
  const handleStop = useCallback(() => {
    stop();
  }, [stop]);
  
  const handleRestart = useCallback(() => {
    seek(0);
    play(0);
  }, [seek, play]);
  
  const hasAnyTrack = state.voice.url || state.music.url || state.sfx.url;
  
  if (!hasAnyTrack) {
    return null;
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-zinc-900/90 backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden",
        className
      )}
    >
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/20 to-cyan-500/20">
            <Volume2 className="w-5 h-5 text-violet-400" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-white">Audio Mixer</h3>
            <p className="text-xs text-white/40">
              {state.voice.url ? 'Voice' : ''} 
              {state.music.url ? ' • Music' : ''} 
              {state.sfx.url ? ' • SFX' : ''}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Quick play/pause in collapsed mode */}
          {!isExpanded && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handlePlayPause();
              }}
              className="h-8 w-8 p-0 text-white/60 hover:text-white"
            >
              {state.isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </Button>
          )}
          
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-white/40" />
          ) : (
            <ChevronDown className="w-5 h-5 text-white/40" />
          )}
        </div>
      </button>
      
      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4">
              {/* Transport controls */}
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRestart}
                  className="h-9 w-9 p-0 text-white/60 hover:text-white hover:bg-white/10"
                >
                  <SkipBack className="w-5 h-5" />
                </Button>
                
                <Button
                  onClick={handlePlayPause}
                  className={cn(
                    "h-12 w-12 p-0 rounded-full shadow-lg",
                    state.isPlaying
                      ? "bg-gradient-to-br from-orange-500 to-rose-500 hover:from-orange-400 hover:to-rose-400"
                      : "bg-gradient-to-br from-violet-500 to-cyan-500 hover:from-violet-400 hover:to-cyan-400"
                  )}
                >
                  {state.isPlaying ? (
                    <Pause className="w-6 h-6 text-white" />
                  ) : (
                    <Play className="w-6 h-6 text-white ml-0.5" />
                  )}
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleStop}
                  className="h-9 w-9 p-0 text-white/60 hover:text-white hover:bg-white/10"
                >
                  <Square className="w-5 h-5" />
                </Button>
              </div>
              
              {/* Global timeline */}
              <div className="space-y-1">
                <Slider
                  value={[state.currentTime]}
                  onValueChange={([v]) => seek(v)}
                  max={state.duration || 100}
                  step={0.1}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-white/40">
                  <span>{formatTime(state.currentTime)}</span>
                  <span>{formatTime(state.duration)}</span>
                </div>
              </div>
              
              {/* Track controls */}
              <div className="grid gap-3">
                {state.voice.url && (
                  <TrackControl
                    type="voice"
                    state={state.voice}
                    onVolumeChange={(v) => setTrackVolume('voice', v)}
                    onMuteToggle={() => setTrackMuted('voice', !state.voice.muted)}
                    onSoloToggle={() => setTrackSolo('voice', !state.voice.solo)}
                  />
                )}
                
                {state.music.url && (
                  <TrackControl
                    type="music"
                    state={state.music}
                    onVolumeChange={(v) => setTrackVolume('music', v)}
                    onMuteToggle={() => setTrackMuted('music', !state.music.muted)}
                    onSoloToggle={() => setTrackSolo('music', !state.music.solo)}
                  />
                )}
                
                {state.sfx.url && (
                  <TrackControl
                    type="sfx"
                    state={state.sfx}
                    onVolumeChange={(v) => setTrackVolume('sfx', v)}
                    onMuteToggle={() => setTrackMuted('sfx', !state.sfx.muted)}
                    onSoloToggle={() => setTrackSolo('sfx', !state.sfx.solo)}
                  />
                )}
              </div>
              
              {/* Master volume */}
              <div className="flex items-center gap-3 pt-2 border-t border-white/[0.06]">
                <span className="text-xs text-white/50 font-medium">MASTER</span>
                <Slider
                  value={[state.masterVolume * 100]}
                  onValueChange={([v]) => setMasterVolume(v / 100)}
                  max={100}
                  step={1}
                  className="flex-1"
                />
                <span className="text-sm text-white font-mono w-10 text-right">
                  {Math.round(state.masterVolume * 100)}%
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

export default AudioMixerPanel;
