import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { WidgetConfig, WidgetScene } from '@/types/widget';

interface LandingPageRendererProps {
  config: WidgetConfig;
  onCtaClick: () => void;
  onScenePlay: (scene: WidgetScene) => void;
}

export function LandingPageRenderer({ config, onCtaClick, onScenePlay }: LandingPageRendererProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentSceneIdx, setCurrentSceneIdx] = useState(0);
  const [muted, setMuted] = useState(true);
  const [videoReady, setVideoReady] = useState(false);
  
  const scenes = (config.scenes || []) as WidgetScene[];
  const currentScene = scenes[currentSceneIdx] || null;

  useEffect(() => {
    if (currentScene) onScenePlay(currentScene);
  }, [currentScene, onScenePlay]);

  // Auto-advance scenes
  const handleVideoEnd = useCallback(() => {
    if (currentScene?.loop) {
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {});
      }
    } else if (currentSceneIdx < scenes.length - 1) {
      setCurrentSceneIdx(prev => prev + 1);
    } else {
      // Loop back to first scene
      setCurrentSceneIdx(0);
    }
  }, [currentScene, currentSceneIdx, scenes.length]);

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ 
        backgroundColor: config.background_color,
        fontFamily: config.font_family,
      }}
    >
      {/* Background gradient */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          background: `radial-gradient(ellipse at center, ${config.primary_color}40 0%, transparent 70%)`,
        }}
      />
      
      <div className="relative z-10 w-full max-w-2xl mx-auto px-6 py-12 text-center">
        {/* Logo */}
        {config.logo_url && (
          <img 
            src={config.logo_url} 
            alt="" 
            className="h-10 w-auto mx-auto mb-8 opacity-80" 
          />
        )}

        {/* Headline */}
        {config.headline && (
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 leading-tight tracking-tight">
            {config.headline}
          </h1>
        )}

        {/* Subheadline */}
        {config.subheadline && (
          <p className="text-lg sm:text-xl text-white/60 mb-8 max-w-lg mx-auto leading-relaxed">
            {config.subheadline}
          </p>
        )}

        {/* Video Player */}
        {currentScene && (
          <div className="relative rounded-2xl overflow-hidden shadow-2xl mb-8 mx-auto max-w-lg aspect-video bg-black/50">
            <video
              ref={videoRef}
              src={currentScene.src_mp4}
              poster={currentScene.poster_url}
              muted={muted}
              autoPlay
              playsInline
              preload="auto"
              onEnded={handleVideoEnd}
              onCanPlay={() => setVideoReady(true)}
              className="w-full h-full object-cover"
            />
            
            {/* Scene indicator dots */}
            {scenes.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {scenes.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentSceneIdx(i)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      i === currentSceneIdx 
                        ? 'bg-white w-6' 
                        : 'bg-white/40 hover:bg-white/60'
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Subtitle */}
            {currentScene.subtitle_text && (
              <div className="absolute bottom-10 left-4 right-4 text-center">
                <p className="text-white text-sm font-medium bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2 inline-block">
                  {currentScene.subtitle_text}
                </p>
              </div>
            )}

            {/* Mute toggle */}
            <button
              onClick={() => setMuted(!muted)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white transition-colors"
            >
              {muted ? '🔇' : '🔊'}
            </button>
          </div>
        )}

        {/* CTA Buttons */}
        <div className="space-y-3">
          {config.cta_text && config.cta_url && (
            <button
              onClick={onCtaClick}
              className="inline-flex items-center justify-center px-8 py-4 rounded-2xl text-lg font-bold text-white transition-all duration-300 hover:scale-105 active:scale-95 shadow-xl"
              style={{ 
                backgroundColor: config.cta_color,
                boxShadow: `0 8px 32px ${config.cta_color}50`,
              }}
            >
              {config.cta_text}
            </button>
          )}

          {config.secondary_cta_text && config.secondary_cta_url && (
            <div>
              <a
                href={config.secondary_cta_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/40 hover:text-white/60 text-sm transition-colors underline underline-offset-4"
              >
                {config.secondary_cta_text}
              </a>
            </div>
          )}
        </div>

        {/* Powered by */}
        <p className="mt-12 text-white/20 text-xs">
          Powered by Genesis Scenes
        </p>
      </div>
    </div>
  );
}
