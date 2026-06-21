import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  const [ctaVisible, setCtaVisible] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);

  const scenes = (config.scenes || []) as WidgetScene[];
  const currentScene = scenes[currentSceneIdx] || null;

  // Staggered reveal: content fades in, then CTA pops up
  useEffect(() => {
    const t1 = setTimeout(() => setContentVisible(true), 400);
    const t2 = setTimeout(() => setCtaVisible(true), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

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
      setCurrentSceneIdx(0);
    }
  }, [currentScene, currentSceneIdx, scenes.length]);

  const toggleMute = useCallback(() => setMuted(m => !m), []);

  return (
    <div
      className="fixed inset-0 w-screen h-screen overflow-hidden"
      style={{ fontFamily: config.font_family || 'system-ui, sans-serif' }}
    >
      {/* ═══ FULL-SCREEN BACKGROUND VIDEO ═══ */}
      {currentScene && (
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
          className="absolute inset-0 w-full h-full object-cover"
          style={{ zIndex: 0 }}
        />
      )}

      {/* ═══ CINEMATIC OVERLAYS ═══ */}
      {/* Dark gradient overlay for text readability */}
      <div
        className="absolute inset-0"
        style={{
          zIndex: 1,
          background: `
            linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,0.1) 60%, rgba(0,0,0,0.4) 100%)
          `,
        }}
      />

      {/* Color tint overlay from primary_color */}
      <div
        className="absolute inset-0 mix-blend-overlay"
        style={{
          zIndex: 2,
          background: `radial-gradient(ellipse at 50% 80%, ${config.primary_color}30 0%, transparent 70%)`,
        }}
      />

      {/* Subtle vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 3,
          boxShadow: 'inset 0 0 200px 60px rgba(0,0,0,0.5)',
        }}
      />

      {/* ═══ TOP BAR — Logo + Mute ═══ */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 sm:px-10 py-6"
        style={{ zIndex: 10 }}
      >
        {config.logo_url ? (
          <img
            src={config.logo_url}
            alt=""
            className="h-8 sm:h-10 w-auto opacity-90 drop-shadow-lg"
            style={{
              opacity: contentVisible ? 0.9 : 0,
              transform: contentVisible ? 'translateY(0)' : 'translateY(-10px)',
              transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        ) : (
          <div />
        )}

        {/* Mute toggle */}
        {currentScene && (
          <button
            onClick={toggleMute}
            className="w-10 h-10 rounded-full backdrop-blur-md flex items-center justify-center transition-all duration-300 hover:scale-110"
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.15)',
              opacity: contentVisible ? 1 : 0,
              transform: contentVisible ? 'translateY(0)' : 'translateY(-10px)',
              transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.2s',
            }}
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            <span className="text-white/80 text-lg">{muted ? '🔇' : '🔊'}</span>
          </button>
        )}
      </div>

      {/* ═══ SCENE DOTS (multi-scene) ═══ */}
      {scenes.length > 1 && (
        <div
          className="absolute top-1/2 right-6 -translate-y-1/2 flex flex-col gap-2"
          style={{ zIndex: 10 }}
        >
          {scenes.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentSceneIdx(i)}
              className="transition-all duration-500"
              style={{
                width: i === currentSceneIdx ? '3px' : '3px',
                height: i === currentSceneIdx ? '28px' : '10px',
                borderRadius: '2px',
                background: i === currentSceneIdx ? 'white' : 'rgba(255,255,255,0.3)',
                opacity: contentVisible ? 1 : 0,
                transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          ))}
        </div>
      )}

      {/* ═══ MAIN CONTENT — Bottom-anchored hero copy + CTA ═══ */}
      <div
        className="absolute bottom-0 left-0 right-0 px-6 sm:px-12 lg:px-20 pb-12 sm:pb-16 lg:pb-20"
        style={{ zIndex: 10 }}
      >
        <div className="max-w-3xl">
          {/* Subtitle / Scene text */}
          {currentScene?.subtitle_text && (
            <p
              className="text-xs sm:text-sm font-medium uppercase tracking-[0.25em] mb-4"
              style={{
                color: config.primary_color || 'rgba(255,255,255,0.5)',
                opacity: contentVisible ? 1 : 0,
                transform: contentVisible ? 'translateY(0)' : 'translateY(20px)',
                transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.3s',
              }}
            >
              {currentScene.subtitle_text}
            </p>
          )}

          {/* Headline */}
          {config.headline && (
            <h1
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.05] tracking-tight mb-4"
              style={{
                opacity: contentVisible ? 1 : 0,
                transform: contentVisible ? 'translateY(0)' : 'translateY(30px)',
                transition: 'all 1s cubic-bezier(0.16, 1, 0.3, 1) 0.4s',
                textShadow: '0 4px 30px rgba(0,0,0,0.5)',
              }}
            >
              {config.headline}
            </h1>
          )}

          {/* Subheadline */}
          {config.subheadline && (
            <p
              className="text-base sm:text-lg md:text-xl text-white/60 max-w-xl leading-relaxed mb-8"
              style={{
                opacity: contentVisible ? 1 : 0,
                transform: contentVisible ? 'translateY(0)' : 'translateY(20px)',
                transition: 'all 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.6s',
              }}
            >
              {config.subheadline}
            </p>
          )}

          {/* ═══ CTA BUTTONS — Pop-up animation ═══ */}
          <div
            className="flex flex-wrap items-center gap-4"
            style={{
              opacity: ctaVisible ? 1 : 0,
              transform: ctaVisible ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
              transition: 'all 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            {config.cta_text && config.cta_url && (
              <button
                onClick={onCtaClick}
                className="group relative inline-flex items-center justify-center px-8 sm:px-10 py-4 sm:py-5 rounded-2xl text-base sm:text-lg font-bold text-white overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95"
                style={{
                  backgroundColor: config.cta_color,
                  boxShadow: `0 0 0 1px ${config.cta_color}40, 0 8px 40px ${config.cta_color}50, 0 2px 10px rgba(0,0,0,0.3)`,
                }}
              >
                {/* Shimmer effect */}
                <span
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{
                    background: `linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.15) 50%, transparent 70%)`,
                  }}
                />
                <span className="relative flex items-center gap-2">
                  {config.cta_text}
                  <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </button>
            )}

            {config.secondary_cta_text && config.secondary_cta_url && (
              <a
                href={config.secondary_cta_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-4 rounded-2xl text-sm sm:text-base font-medium text-white/70 hover:text-white backdrop-blur-md transition-all duration-300 hover:bg-white/10"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
              >
                {config.secondary_cta_text}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ═══ POWERED BY (subtle) ═══ */}
      <div
        className="absolute bottom-4 right-6 sm:right-10"
        style={{
          zIndex: 10,
          opacity: contentVisible ? 0.25 : 0,
          transition: 'opacity 1s ease 2s',
        }}
      >
        <p className="text-white text-[10px] tracking-wider font-medium">
          Powered by Genesis
        </p>
      </div>
    </div>
  );
}
