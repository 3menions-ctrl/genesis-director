import React, { useRef, useEffect, useState, useCallback } from 'react';
import { X, Minimize2, Volume2, VolumeX, ChevronUp } from 'lucide-react';
import type { WidgetConfig, WidgetScene, EngineState, WidgetPosition } from '@/types/widget';

interface WidgetOverlayProps {
  config: WidgetConfig;
  currentScene: WidgetScene | null;
  engineState: EngineState;
  onDismiss: () => void;
  onMinimize: () => void;
  onReopen: () => void;
  onCtaClick: () => void;
  onSceneEnd: () => void;
  prefersReducedMotion: boolean;
}

const POSITION_CLASSES: Record<WidgetPosition, string> = {
  'bottom-right': 'bottom-5 right-5',
  'bottom-left': 'bottom-5 left-5',
  'top-right': 'top-5 right-5',
  'top-left': 'top-5 left-5',
  'center': 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
};

export function WidgetOverlay({
  config,
  currentScene,
  engineState,
  onDismiss,
  onMinimize,
  onReopen,
  onCtaClick,
  onSceneEnd,
  prefersReducedMotion,
}: WidgetOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);

  // Animate in
  useEffect(() => {
    if (engineState !== 'DISMISSED' && engineState !== 'BOOTING') {
      const timer = setTimeout(() => setShowOverlay(true), 100);
      return () => clearTimeout(timer);
    }
    setShowOverlay(false);
  }, [engineState]);

  // Handle scene changes with transition
  useEffect(() => {
    if (!currentScene || !videoRef.current) return;
    
    setIsTransitioning(true);
    setVideoError(false);
    
    const timer = setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.src = currentScene.src_mp4;
        videoRef.current.load();
        videoRef.current.play().catch(() => setVideoError(true));
      }
      setIsTransitioning(false);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [currentScene]);

  const handleVideoEnd = useCallback(() => {
    if (currentScene?.loop && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    } else {
      onSceneEnd();
    }
  }, [currentScene, onSceneEnd]);

  // Minimized state - pulsing dot
  if (engineState === 'MINIMIZED') {
    return (
      <button
        onClick={onReopen}
        className={`fixed ${POSITION_CLASSES[config.position]} z-[${config.z_index}] group`}
        style={{ zIndex: config.z_index }}
        aria-label="Reopen widget"
      >
        <div 
          className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg cursor-pointer transition-transform hover:scale-110"
          style={{ backgroundColor: config.primary_color }}
        >
          <ChevronUp className="w-5 h-5 text-white" />
        </div>
        {!prefersReducedMotion && (
          <div 
            className="absolute inset-0 rounded-full animate-ping opacity-30"
            style={{ backgroundColor: config.primary_color }}
          />
        )}
      </button>
    );
  }

  // Dismissed or booting - hide
  if (engineState === 'DISMISSED' || engineState === 'BOOTING') {
    return null;
  }

  return (
    <div
      className={`fixed ${POSITION_CLASSES[config.position]} transition-all duration-500 ${
        showOverlay ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
      style={{ 
        zIndex: config.z_index,
        width: config.widget_width,
        fontFamily: config.font_family,
      }}
    >
      <div
        className="rounded-2xl overflow-hidden shadow-2xl border border-white/10"
        style={{ backgroundColor: config.background_color }}
      >
        {/* Header Controls */}
        <div className="flex items-center justify-between px-3 py-2 bg-black/30 backdrop-blur-sm">
          {config.logo_url ? (
            <img src={config.logo_url} alt="" className="h-5 w-auto" />
          ) : (
            <span className="text-xs font-medium text-white/70 truncate max-w-[120px]">
              {config.name}
            </span>
          )}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMuted(!muted)}
              className="p-1.5 rounded-full hover:bg-white/10 transition-colors text-white/70 hover:text-white"
              aria-label={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={onMinimize}
              className="p-1.5 rounded-full hover:bg-white/10 transition-colors text-white/70 hover:text-white"
              aria-label="Minimize"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onDismiss}
              className="p-1.5 rounded-full hover:bg-white/10 transition-colors text-white/70 hover:text-white"
              aria-label="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Video Area */}
        <div className="relative aspect-[9/16] max-h-[280px] bg-black">
          {currentScene && !videoError ? (
            <>
              <video
                ref={videoRef}
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  isTransitioning ? 'opacity-0' : 'opacity-100'
                }`}
                muted={muted}
                playsInline
                preload="auto"
                poster={currentScene.poster_url}
                onEnded={handleVideoEnd}
                onError={() => setVideoError(true)}
              />
              {/* Subtitle overlay */}
              {currentScene.subtitle_text && (
                <div className="absolute bottom-3 left-3 right-3 text-center">
                  <p className="text-white text-xs font-medium bg-black/60 backdrop-blur-sm rounded-lg px-3 py-1.5">
                    {currentScene.subtitle_text}
                  </p>
                </div>
              )}
            </>
          ) : (
            /* Fallback when no scene or video error */
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
              <div className="text-center px-4">
                <div 
                  className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
                  style={{ backgroundColor: config.primary_color + '20' }}
                >
                  <div 
                    className="w-6 h-6 rounded-full"
                    style={{ backgroundColor: config.primary_color }}
                  />
                </div>
                <p className="text-white/80 text-sm font-medium">
                  {config.headline || config.name}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* CTA Area */}
        <div className="p-4 space-y-3">
          {config.subheadline && (
            <p className="text-white/70 text-xs text-center leading-relaxed">
              {config.subheadline}
            </p>
          )}
          
          {config.cta_text && config.cta_url && (
            <button
              onClick={onCtaClick}
              className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg"
              style={{ 
                backgroundColor: config.cta_color,
                boxShadow: `0 4px 14px ${config.cta_color}40`,
              }}
            >
              {config.cta_text}
            </button>
          )}

          {config.secondary_cta_text && config.secondary_cta_url && (
            <a
              href={config.secondary_cta_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-xs text-white/50 hover:text-white/70 transition-colors"
            >
              {config.secondary_cta_text}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
