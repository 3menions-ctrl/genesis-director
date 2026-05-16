/**
 * EnterStudioEpic — the "Enter the Studio" landing section, scaled up.
 *
 * Composition (top → bottom):
 *   1. Minimal kicker + tight one-line headline
 *   2. Cinematic video triptych  (3 looping clips, marquee captions)
 *   3. Mascot orbital ring        (9 mascots circling a glowing core)
 *   4. Avatar parade              (two infinite marquees, opposite directions)
 *   5. Engine matrix              (Kling V3 · Seedance 2.0)
 *   6. End-to-end pipeline ribbon (10 numbered steps)
 *   7. Capability tiles           (8 product features)
 *   8. Frame-chain demo           (5 frames stitching into 1 film)
 *   9. GIANT glowing white GET STARTED button
 *
 * Everything animates on scroll with framer-motion. The mascot ring and
 * avatar marquee are pure CSS keyframes for GPU-only motion. All assets
 * come from the already-bundled /src/assets library — no fetches.
 */

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';

// ── Video assets (looping showcase clips) ────────────────────────────────
import seedanceTestAsset from '@/assets/seedance-avatar-test.mp4.asset.json';
import immersiveHeroAsset from '@/assets/landing-immersive-hero.mp4.asset.json';
import hoppyIntroAsset from '@/assets/landing-hoppy-intro.mp4.asset.json';
import seedanceClipAsset from '@/assets/test-seedance-clip.mp4.asset.json';

// Remote avatar reels — distinct cameos, no duplicate "wave hello" across the page.
const ALT_AVATAR_CAMEO   = 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/avatar-videos/a1d2febd-5d8d-42f8-82d9-66cd1669f511/avatar_a1d2febd-5d8d-42f8-82d9-66cd1669f511_clip1_lipsync_1771729924910.mp4';
const ALT_AVATAR_LIPSYNC = 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/avatar-videos/f27fc141-7f5c-48f1-ab0b-645f702df131/avatar_f27fc141-7f5c-48f1-ab0b-645f702df131_clip1_lipsync_1771731724210.mp4';

// ── Mascot ring (PNG, transparent or framed) ─────────────────────────────
import mAstroBear from '@/assets/mascots/cereal-astronaut-bear.png';
import mTiger from '@/assets/mascots/cereal-tiger.png';
import mWizRabbit from '@/assets/mascots/cereal-wizard-rabbit.png';
import mBurger from '@/assets/mascots/food-truck-burger.png';
import mIcecream from '@/assets/mascots/food-truck-icecream.png';
import mTaco from '@/assets/mascots/food-truck-taco.png';
import mFox from '@/assets/mascots/indie-fox-rogue.png';
import mKnight from '@/assets/mascots/indie-knight.png';
import mRobot from '@/assets/mascots/indie-robot.png';
import { LazyAutoVideo } from '@/components/video/LazyAutoVideo';

// ── Avatar parade (a curated 24-strong cross-section) ───────────────────
import aAaliya from '@/assets/avatars/aaliya-patel.png';
import aAelindra from '@/assets/avatars/aelindra-elf.jpg';
import aAmina from '@/assets/avatars/amina-hassan.png';
import aArctic from '@/assets/avatars/arctic-owl.jpg';
import aAtlas from '@/assets/avatars/atlas-elephant.png';
import aBella from '@/assets/avatars/bella-bunny.jpg';
import aBlitz from '@/assets/avatars/blitz-cheetah.png';
import aCaptain from '@/assets/avatars/captain-cosmos.png';
import aChibi from '@/assets/avatars/chibi-mage.png';
import aCoral from '@/assets/avatars/coral-mermaid.png';
import aCosmo from '@/assets/avatars/cosmo-space-cat.png';
import aDrake from '@/assets/avatars/drake-dragon.jpg';
import aEmber from '@/assets/avatars/ember-dragon.png';
import aFelix from '@/assets/avatars/felix-fox.jpg';
import aFrost from '@/assets/avatars/frost-prince.png';
import aGuardian from '@/assets/avatars/guardian-angel.png';
import aInk from '@/assets/avatars/ink-monk.png';
import aKing from '@/assets/avatars/king-lion.jpg';
import aLuna from '@/assets/avatars/luna-cat.jpg';
import aMerlin from '@/assets/avatars/merlin-wizard.jpg';
import aNova from '@/assets/avatars/nova-explorer.jpg';
import aOliver from '@/assets/avatars/oliver-owl.jpg';
import aPixel from '@/assets/avatars/pixel-hacker.jpg';
import aShadow from '@/assets/avatars/shadow-panther.jpg';
import aStorm from '@/assets/avatars/storm-wolf.jpg';
import aVictor from '@/assets/avatars/victor-vampire.jpg';
import aVoxelHacker from '@/assets/avatars/voxel-hacker.png';
import aVoxelViking from '@/assets/avatars/voxel-viking.png';

// ── Frame-chain demo posters (already in scenes/) ───────────────────────
import scene1 from '@/assets/scenes/cinematic-hero-preview.jpg';
import scene2 from '@/assets/scenes/4th-wall-breakthrough-preview.jpg';
import scene3 from '@/assets/scenes/minimal-embed-preview.jpg';
import feat1 from '@/assets/features/character-lock-premium.jpg';
import feat2 from '@/assets/features/text-to-video-premium.jpg';
import featMusic from '@/assets/features/music-premium.jpg';
import featVoice from '@/assets/features/voiceover-premium.jpg';
import featStyle from '@/assets/features/style-transfer-premium.jpg';
// Unique fill for the feature-grid tile — never reused elsewhere on landing.
import featImageToVideo from '@/assets/features/image-to-video-premium.jpg';

const MASCOTS = [mAstroBear, mFox, mTiger, mKnight, mWizRabbit, mRobot, mBurger, mIcecream, mTaco];
// Transparent-background 5s seedance loops, indexed to MASCOTS above.
const MASCOT_LOOPS = [
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/mascots-anim/cereal-astronaut-bear.webm',
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/mascots-anim/indie-fox-rogue.webm',
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/mascots-anim/cereal-tiger.webm',
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/mascots-anim/indie-knight.webm',
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/mascots-anim/cereal-wizard-rabbit.webm',
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/mascots-anim/indie-robot.webm',
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/mascots-anim/food-truck-burger.webm',
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/mascots-anim/food-truck-icecream.webm',
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/mascots-anim/food-truck-taco.webm',
];
const AVATARS = [
  aAaliya, aAelindra, aAmina, aArctic, aAtlas, aBella, aBlitz, aCaptain,
  aChibi, aCoral, aCosmo, aDrake, aEmber, aFelix, aFrost, aGuardian,
  aInk, aKing, aLuna, aMerlin, aNova, aOliver, aPixel, aShadow, aStorm,
  aVictor, aVoxelHacker, aVoxelViking,
];

const FRAME_CHAIN = [scene1, feat1, scene2, feat2, scene3];

const VIDEOS = [
  { src: ALT_AVATAR_CAMEO,      label: 'Avatar · Cinematic Cameo', spec: 'Kling V3 · 10s · 16:9' },
  { src: seedanceTestAsset.url, label: 'Seedance · Hyperreal', spec: 'Seedance 2.0 · 12s'    },
  { src: immersiveHeroAsset.url,label: 'Cinematic · Hero',     spec: 'Kling V3 · Native audio'},
];

const SHOWREEL = [
  { src: hoppyIntroAsset.url,   label: 'Hoppy · Mascot Reel',  spec: 'I2V · Stitched' },
  { src: seedanceClipAsset.url, label: 'Seedance · Motion Lab',spec: 'Seedance 2.0' },
  { src: ALT_AVATAR_LIPSYNC,    label: 'Lip-sync · Talkback',  spec: 'Kling V3 · Audio' },
  // Distinct gallery reel — avoids reusing the hero clip already on stage.
  { src: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_ad10b35f-1a39-47c5-8323-3b57b97c9968_1768351244978.mp4',
    label: 'Beautiful Day · Vibes',  spec: 'Kling V3 · Stitched' },
];

interface Props {
  onStart: () => void;
  onEnter: () => void;
}

export const EnterStudioEpic = memo(function EnterStudioEpic({ onStart, onEnter }: Props) {
  // Pre-compute orbital coordinates so they're deterministic per render.
  const orbit = useMemo(() => {
    const radius = 220;
    return MASCOTS.map((src, i) => {
      const angle = (i / MASCOTS.length) * Math.PI * 2 - Math.PI / 2;
      return {
        src,
        loop: MASCOT_LOOPS[i],
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        delay: i * 0.12,
      };
    });
  }, []);

  return (
    <section id="studio" className="relative z-10 py-28 md:py-40 px-4 sm:px-6 overflow-hidden">
      {/* Local keyframes — orbit rotation + reverse marquee + glow pulse */}
      <style>{`
        @keyframes ese-orbit-cw  { from { transform: rotate(0deg);   } to { transform: rotate(360deg);  } }
        @keyframes ese-orbit-ccw { from { transform: rotate(360deg); } to { transform: rotate(0deg);    } }
        @keyframes ese-marquee   { from { transform: translateX(0);  } to { transform: translateX(-50%);} }
        @keyframes ese-marquee-r { from { transform: translateX(-50%);} to { transform: translateX(0);  } }
        @keyframes ese-pulse-glow{
          0%,100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.55), 0 0 120px 20px rgba(255,255,255,0.35), 0 0 280px 60px rgba(10,132,255,0.35); }
          50%     { box-shadow: 0 0 0 28px rgba(255,255,255,0.00), 0 0 160px 40px rgba(255,255,255,0.45), 0 0 360px 90px rgba(10,132,255,0.55); }
        }
        @keyframes ese-frame-flow {
          0%,100% { transform: translateY(0)   scale(1);    filter: brightness(1); }
          50%     { transform: translateY(-6px) scale(1.03); filter: brightness(1.18); }
        }
        @keyframes ese-twinkle {
          0%,100% { opacity: 0.15; transform: scale(0.85); }
          50%     { opacity: 0.95; transform: scale(1.15); }
        }
        @keyframes ese-aurora {
          0%,100% { transform: translate3d(-4%, 0, 0) rotate(0deg); opacity: 0.55; }
          50%     { transform: translate3d(4%, -2%, 0) rotate(8deg); opacity: 0.85; }
        }
        @keyframes ese-eq {
          0%,100% { transform: scaleY(0.18); }
          50%     { transform: scaleY(1); }
        }
        @keyframes ese-ring-expand {
          0%   { transform: translate(-50%,-50%) scale(0.2); opacity: 0.9; }
          100% { transform: translate(-50%,-50%) scale(2.4); opacity: 0; }
        }
        @keyframes ese-firework {
          0%   { transform: translate(0,0) scale(1); opacity: 1; }
          100% { transform: translate(var(--fx), var(--fy)) scale(0.2); opacity: 0; }
        }
        @keyframes ese-shimmer-x {
          0%   { transform: translateX(-120%); }
          100% { transform: translateX(220%); }
        }
        @keyframes ese-bulb {
          0%,100% { opacity: 0.35; box-shadow: 0 0 6px rgba(255,220,140,0.55), 0 0 14px rgba(255,200,90,0.35); }
          50%     { opacity: 1;    box-shadow: 0 0 14px rgba(255,235,180,0.95), 0 0 32px rgba(255,200,90,0.75), 0 0 60px rgba(255,180,60,0.45); }
        }
        @keyframes ese-bulb-chase {
          0%,100% { opacity: 0.25; }
          15%     { opacity: 1; }
          40%     { opacity: 0.25; }
        }
        @keyframes ese-spot-sweep {
          0%,100% { transform: translateX(-12%) rotate(-6deg); opacity: 0.55; }
          50%     { transform: translateX(12%)  rotate( 6deg); opacity: 0.95; }
        }
        @keyframes ese-dust {
          0%   { transform: translate3d(0,0,0); opacity: 0; }
          20%  { opacity: 0.85; }
          100% { transform: translate3d(var(--dx,0px), -180px, 0); opacity: 0; }
        }
        @keyframes ese-reel-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes ese-pedestal-spin {
          0%   { transform: rotateY(0deg); }
          100% { transform: rotateY(360deg); }
        }
        @keyframes ese-curtain-breathe {
          0%,100% { transform: scaleX(1) translateY(0); }
          50%     { transform: scaleX(1.012) translateY(-2px); }
        }
        @keyframes ese-confetti-fall {
          0%   { transform: translate3d(0,-40px,0) rotate(0deg); opacity: 0; }
          10%  { opacity: 1; }
          100% { transform: translate3d(var(--cx,30px), 520px, 0) rotate(var(--cr,540deg)); opacity: 0; }
        }
        @keyframes ese-ticket-float {
          0%,100% { transform: translateY(0) rotate(var(--tr,-3deg)); }
          50%     { transform: translateY(-10px) rotate(calc(var(--tr,-3deg) + 1.2deg)); }
        }
        @keyframes ese-scan-line {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
      `}</style>

      {/* Ambient radial wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(60% 70% at 50% 35%, hsla(212,100%,52%,0.12), transparent 70%),' +
            'radial-gradient(40% 50% at 50% 100%, hsla(212,100%,40%,0.10), transparent 75%)',
        }}
      />

      {/* Aurora veils — slow drifting color washes */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute -top-40 -left-20 w-[70vw] h-[70vw] rounded-full"
          style={{
            background: 'radial-gradient(closest-side, hsla(212,100%,55%,0.22), transparent 70%)',
            filter: 'blur(60px)',
            animation: 'ese-aurora 18s ease-in-out infinite',
          }}
        />
        <div
          className="absolute top-1/3 -right-20 w-[60vw] h-[60vw] rounded-full"
          style={{
            background: 'radial-gradient(closest-side, hsla(190,90%,60%,0.18), transparent 70%)',
            filter: 'blur(70px)',
            animation: 'ese-aurora 22s ease-in-out infinite reverse',
          }}
        />
        <div
          className="absolute bottom-0 left-1/4 w-[55vw] h-[55vw] rounded-full"
          style={{
            background: 'radial-gradient(closest-side, hsla(230,100%,65%,0.18), transparent 70%)',
            filter: 'blur(70px)',
            animation: 'ese-aurora 26s ease-in-out infinite',
          }}
        />
      </div>

      {/* Twinkling starfield */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        {Array.from({ length: 48 }).map((_, i) => {
          const top = (i * 53) % 100;
          const left = (i * 37) % 100;
          const size = 1 + ((i * 7) % 3);
          const dur = 2.5 + ((i * 13) % 40) / 10;
          const delay = ((i * 11) % 30) / 10;
          return (
            <span
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                top: `${top}%`,
                left: `${left}%`,
                width: size,
                height: size,
                boxShadow: '0 0 6px rgba(255,255,255,0.85)',
                animation: `ese-twinkle ${dur}s ease-in-out ${delay}s infinite`,
              }}
            />
          );
        })}
      </div>

      <div className="max-w-7xl mx-auto">
        {/* ── 1. Minimal kicker + tight one-line headline ──────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-14 md:mb-20"
        >
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-2xl mb-7">
            <span className="w-1 h-1 rounded-full bg-[#0A84FF]" style={{ boxShadow: '0 0 8px #0A84FF' }} />
            <span className="text-[10.5px] font-medium text-white/65 tracking-[0.32em] uppercase">
              The Studio
            </span>
          </div>
          <h2
            className="font-display text-5xl md:text-7xl lg:text-8xl font-bold text-white tracking-[-0.04em] leading-[0.98]"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            Enter the{' '}
            <span
              className="italic font-light bg-gradient-to-br from-white via-[#9DCBFF] to-[#0A84FF] bg-clip-text text-transparent"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              Studio.
            </span>
          </h2>
          <p className="mt-6 text-white/55 text-[14.5px] md:text-base font-light max-w-xl mx-auto leading-[1.7]"
             style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
            Step past the curtain. The marquee is lit, the reels are spinning, the
            score is warming up. This is the room every film leaves from.
          </p>
        </motion.div>

        {/* ── 1b. THEATER MARQUEE — bulb-lit hero stage ───────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-5%' }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto mb-20 md:mb-28"
        >
          {/* Curtain top — velvet drape */}
          <div aria-hidden className="absolute -top-6 left-0 right-0 h-10 pointer-events-none"
            style={{
              background:
                'repeating-linear-gradient(90deg, #2a0810 0 22px, #4a0e1c 22px 44px, #2a0810 44px 66px)',
              clipPath: 'polygon(0 0, 100% 0, 100% 30%, 96% 80%, 92% 30%, 88% 80%, 84% 30%, 80% 80%, 76% 30%, 72% 80%, 68% 30%, 64% 80%, 60% 30%, 56% 80%, 52% 30%, 48% 80%, 44% 30%, 40% 80%, 36% 30%, 32% 80%, 28% 30%, 24% 80%, 20% 30%, 16% 80%, 12% 30%, 8% 80%, 4% 30%, 0 80%)',
              filter: 'drop-shadow(0 6px 18px rgba(0,0,0,0.7))',
              animation: 'ese-curtain-breathe 7s ease-in-out infinite',
            }}
          />

          <div className="relative rounded-[36px] overflow-hidden"
            style={{
              background:
                'radial-gradient(120% 80% at 50% 0%, hsla(212,80%,16%,0.55), transparent 60%),' +
                'linear-gradient(180deg, #050810 0%, #02040a 100%)',
              boxShadow:
                'inset 0 0 0 1px hsla(0,0%,100%,0.08), 0 60px 120px -60px rgba(10,132,255,0.55), 0 0 220px -40px rgba(255,200,90,0.18)',
            }}
          >
            {/* Marquee bulb border (running lights) */}
            <div aria-hidden className="absolute inset-0 pointer-events-none">
              {Array.from({ length: 64 }).map((_, i) => {
                const total = 64;
                const side = i < 22 ? 'top' : i < 32 ? 'right' : i < 54 ? 'bottom' : 'left';
                let top = 0, left = 0;
                if (side === 'top')    { top = 10; left = 12 + (i / 21) * 76; }
                if (side === 'right')  { left = 92; top = 10 + ((i - 22) / 9) * 80; }
                if (side === 'bottom') { top = 92; left = 88 - ((i - 32) / 21) * 76; }
                if (side === 'left')   { left = 8;  top = 92 - ((i - 54) / 9) * 80; }
                return (
                  <span key={i}
                    className="absolute rounded-full"
                    style={{
                      top: `${top}%`, left: `${left}%`,
                      width: 6, height: 6, marginLeft: -3, marginTop: -3,
                      background: 'radial-gradient(circle, #fff6d8 0%, #ffcf72 60%, transparent 75%)',
                      animation: `ese-bulb-chase 1.8s linear ${(i / total) * 1.8}s infinite`,
                    }}
                  />
                );
              })}
            </div>

            {/* Spotlight cones */}
            <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute -top-32 left-[18%] w-[36%] h-[160%] origin-top"
                style={{
                  background: 'linear-gradient(180deg, hsla(48,100%,75%,0.35), transparent 70%)',
                  filter: 'blur(28px)',
                  clipPath: 'polygon(46% 0, 54% 0, 100% 100%, 0 100%)',
                  animation: 'ese-spot-sweep 9s ease-in-out infinite',
                }} />
              <div className="absolute -top-32 right-[18%] w-[36%] h-[160%] origin-top"
                style={{
                  background: 'linear-gradient(180deg, hsla(212,100%,70%,0.30), transparent 70%)',
                  filter: 'blur(30px)',
                  clipPath: 'polygon(46% 0, 54% 0, 100% 100%, 0 100%)',
                  animation: 'ese-spot-sweep 11s ease-in-out infinite reverse',
                }} />
            </div>

            {/* NOW SHOWING plaque */}
            <div className="relative pt-12 md:pt-14 flex flex-col items-center text-center px-6">
              <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full"
                style={{
                  background: 'linear-gradient(180deg, #ffe9a8, #f3b347)',
                  color: '#2a1604',
                  boxShadow: '0 0 24px rgba(255,200,90,0.6), inset 0 0 0 1px rgba(255,255,255,0.6)',
                }}>
                <span className="w-1.5 h-1.5 rounded-full bg-[#7a2a00]" />
                <span className="text-[11px] font-mono uppercase tracking-[0.4em] font-semibold">Now showing</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#7a2a00]" />
              </div>
              <h3 className="mt-5 text-white text-3xl md:text-5xl font-light tracking-[-0.02em]"
                style={{ fontFamily: "'Fraunces', serif" }}>
                <span className="italic">The Apex Premiere</span>
                <span className="opacity-50"> · </span>
                <span className="font-mono text-base md:text-xl tracking-[0.18em] align-middle text-[#ffd98a]">Reel 01</span>
              </h3>
            </div>

            {/* Stage — mascot/avatar mosaic windows + center hero clip */}
            <div className="relative grid grid-cols-12 gap-2.5 md:gap-3 p-5 md:p-7 mt-6">
              {/* Left column — 3 cast windows (mascots stay reserved for the orbital roster). */}
              <div className="col-span-3 grid grid-rows-3 gap-2.5 md:gap-3">
                {[AVATARS[4], AVATARS[12], AVATARS[17]].map((src, i) => (
                  <div key={i} className="relative rounded-2xl overflow-hidden aspect-square border border-white/[0.08]"
                    style={{ boxShadow: 'inset 0 0 0 1px hsla(0,0%,100%,0.05), 0 20px 50px -30px rgba(255,200,90,0.4)' }}>
                    <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
                    <div aria-hidden className="absolute inset-0"
                      style={{ background: 'radial-gradient(80% 80% at 50% 0%, transparent 50%, rgba(0,0,0,0.55) 100%)' }} />
                  </div>
                ))}
              </div>

              {/* Center — hero video with film perforations */}
              <div className="col-span-6 relative">
                <div className="relative aspect-[4/5] rounded-2xl overflow-hidden border border-white/10"
                  style={{ boxShadow: '0 40px 100px -40px rgba(10,132,255,0.55), inset 0 0 0 1px hsla(0,0%,100%,0.06)' }}>
                  <video src={immersiveHeroAsset.url} autoPlay loop muted playsInline preload="metadata"
                    className="absolute inset-0 w-full h-full object-cover" />
                  {/* Scan line */}
                  <span aria-hidden className="absolute inset-x-0 h-[2px] pointer-events-none"
                    style={{ background: 'linear-gradient(90deg, transparent, hsla(212,100%,80%,0.55), transparent)',
                             animation: 'ese-scan-line 4.5s linear infinite' }} />
                  {/* Film perforation strips */}
                  <div aria-hidden className="absolute inset-y-0 left-0 w-3 flex flex-col items-center justify-around py-2"
                    style={{ background: 'rgba(0,0,0,0.55)' }}>
                    {Array.from({ length: 14 }).map((_, k) => (
                      <span key={k} className="block w-1.5 h-2 rounded-sm bg-white/85" />
                    ))}
                  </div>
                  <div aria-hidden className="absolute inset-y-0 right-0 w-3 flex flex-col items-center justify-around py-2"
                    style={{ background: 'rgba(0,0,0,0.55)' }}>
                    {Array.from({ length: 14 }).map((_, k) => (
                      <span key={k} className="block w-1.5 h-2 rounded-sm bg-white/85" />
                    ))}
                  </div>
                  {/* Stat readout */}
                  <div className="absolute top-3 left-6 right-6 flex items-center justify-between">
                    <span className="text-[9.5px] font-mono uppercase tracking-[0.24em] text-white/90 px-2 py-1 rounded-full bg-black/55 border border-white/15">● Rolling</span>
                    <span className="text-[9.5px] font-mono uppercase tracking-[0.18em] text-white/75 px-2 py-1 rounded-full bg-black/55 border border-white/10">24fps · 2.39:1</span>
                  </div>
                  <div className="absolute bottom-4 left-6 right-6">
                    <div className="text-white text-lg md:text-2xl font-light tracking-[-0.01em]" style={{ fontFamily: "'Fraunces', serif" }}>
                      Opening sequence
                    </div>
                    <div className="mt-1 h-px w-16 bg-gradient-to-r from-[#ffd98a] via-[#0A84FF] to-transparent" />
                  </div>
                </div>

                {/* Mirror floor reflection */}
                <div aria-hidden className="absolute -bottom-24 left-1 right-1 h-24 rounded-2xl overflow-hidden pointer-events-none"
                  style={{
                    transform: 'scaleY(-1)',
                    maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 90%)',
                    WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 90%)',
                    filter: 'blur(3px)',
                    opacity: 0.5,
                  }}>
                  <video src={immersiveHeroAsset.url} autoPlay loop muted playsInline preload="metadata"
                    className="w-full h-full object-cover" />
                </div>
              </div>

              {/* Right column — 3 avatar windows */}
              <div className="col-span-3 grid grid-rows-3 gap-2.5 md:gap-3">
                {[AVATARS[0], AVATARS[10], AVATARS[18]].map((src, i) => (
                  <div key={i} className="relative rounded-2xl overflow-hidden aspect-square border border-white/[0.08]"
                    style={{ boxShadow: 'inset 0 0 0 1px hsla(0,0%,100%,0.05), 0 20px 50px -30px rgba(10,132,255,0.5)' }}>
                    <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
                    <div aria-hidden className="absolute inset-0"
                      style={{ background: 'radial-gradient(80% 80% at 50% 0%, transparent 50%, rgba(0,0,0,0.55) 100%)' }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Marquee ticker (running text) */}
            <div className="relative mt-2 mb-5 mx-5 md:mx-7 rounded-full overflow-hidden border border-white/[0.08]"
              style={{ background: 'linear-gradient(180deg, hsla(48,90%,55%,0.10), hsla(212,100%,55%,0.08))' }}>
              <div className="flex whitespace-nowrap py-2"
                style={{ animation: 'ese-marquee 38s linear infinite' }}>
                {Array.from({ length: 2 }).flatMap((_, dup) => (
                  ['Kling V3','Seedance 2.0','Native lip-sync','Face-lock identity','Cinematic scoring','Multi-character dialogue','12-second clips','Continuity engine','Stitch-ready exports','Verbatim scripts','MusicGen scores','Two-engine routing']
                    .map((w, i) => (
                      <span key={`${dup}-${i}`} className="inline-flex items-center gap-3 px-5 text-[11px] font-mono uppercase tracking-[0.32em] text-white/75">
                        <span className="text-[#ffd98a]">★</span> {w}
                      </span>
                    ))
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── 2. Cinematic video triptych ──────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-5%' }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-20 md:mb-28"
        >
          {VIDEOS.map((v, i) => (
            <motion.div
              key={v.src}
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, delay: i * 0.14, ease: [0.16, 1, 0.3, 1] }}
              className="group relative aspect-[3/4] md:aspect-[4/5] rounded-3xl overflow-hidden border border-white/[0.06]"
              style={{
                boxShadow: 'inset 0 0 0 1px hsla(0,0%,100%,0.04), 0 30px 80px -40px rgba(10,132,255,0.45)',
              }}
            >
              <video
                src={v.src}
                autoPlay loop muted playsInline preload="metadata"
                className="absolute inset-0 w-full h-full object-cover"
              />
              {/* Gradient veil + crosshair frame */}
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(180deg, hsla(220,20%,2%,0.05) 0%, transparent 30%, hsla(220,20%,2%,0.85) 100%)',
                }}
              />
              {/* Top spec strip */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                <span className="text-[9.5px] font-mono uppercase tracking-[0.24em] text-white/85 px-2 py-1 rounded-full bg-black/40 border border-white/15 backdrop-blur">
                  ● Live
                </span>
                <span className="text-[9.5px] font-mono uppercase tracking-[0.18em] text-white/70 px-2 py-1 rounded-full bg-black/40 border border-white/10 backdrop-blur">
                  {v.spec}
                </span>
              </div>
              {/* Bottom caption */}
              <div className="absolute bottom-4 left-4 right-4">
                <div className="text-white text-base md:text-lg font-medium tracking-[-0.01em]" style={{ fontFamily: "'Fraunces', serif" }}>
                  {v.label}
                </div>
                <div className="mt-1 h-px w-12 bg-gradient-to-r from-[#0A84FF] to-transparent" />
              </div>
              {/* Hover glow ring */}
              <div
                aria-hidden
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                style={{ boxShadow: 'inset 0 0 0 1px hsla(212,100%,70%,0.45), inset 0 0 80px hsla(212,100%,55%,0.20)' }}
              />
              {/* Mirror reflection beneath card */}
              <div
                aria-hidden
                className="absolute -bottom-24 left-2 right-2 h-24 rounded-3xl overflow-hidden pointer-events-none"
                style={{
                  transform: 'scaleY(-1)',
                  maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 80%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 80%)',
                  filter: 'blur(2px)',
                  opacity: 0.45,
                }}
              >
                <video src={v.src} autoPlay loop muted playsInline preload="metadata" className="w-full h-full object-cover" />
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* ── 2b. Sonic Engine — animated audio visualizer ─────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-5%' }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="relative grid grid-cols-1 md:grid-cols-12 gap-4 mb-20 md:mb-28"
        >
          <div className="md:col-span-7 relative rounded-3xl overflow-hidden p-7 md:p-9 backdrop-blur-2xl"
            style={{
              background: 'linear-gradient(180deg, hsla(0,0%,100%,0.03), hsla(0,0%,100%,0.005))',
              boxShadow: 'inset 0 0 0 1px hsla(0,0%,100%,0.06), 0 40px 100px -50px rgba(10,132,255,0.55)',
            }}
          >
            <div className="absolute inset-x-0 top-0 h-px"
              style={{ background: 'linear-gradient(90deg, transparent, hsla(212,100%,75%,0.55), transparent)' }} />
            <div className="flex items-baseline justify-between mb-5">
              <p className="text-[10px] uppercase tracking-[0.36em] text-white/40 font-mono">Sonic engine</p>
              <p className="text-[10px] uppercase tracking-[0.28em] text-[#9DCBFF]/70 font-mono">MusicGen · Lip-sync</p>
            </div>
            <h3 className="text-white text-2xl md:text-3xl font-medium tracking-[-0.02em] mb-6" style={{ fontFamily: "'Fraunces', serif" }}>
              Score, voice, and duck — automatically.
            </h3>
            {/* Live waveform */}
            <div className="relative h-32 md:h-40 flex items-end gap-[3px] md:gap-[4px]">
              {Array.from({ length: 56 }).map((_, i) => {
                const h = 18 + ((i * 53) % 82);
                const dur = 0.8 + ((i * 11) % 22) / 10;
                const delay = ((i * 7) % 30) / 30;
                return (
                  <span
                    key={i}
                    className="flex-1 rounded-t-sm origin-bottom"
                    style={{
                      height: `${h}%`,
                      background: 'linear-gradient(180deg, #9DCBFF 0%, #0A84FF 60%, hsla(212,100%,40%,0.6) 100%)',
                      boxShadow: '0 0 8px hsla(212,100%,60%,0.55)',
                      animation: `ese-eq ${dur}s ease-in-out ${delay}s infinite`,
                    }}
                  />
                );
              })}
              {/* shimmer overlay */}
              <span aria-hidden className="absolute inset-y-0 w-1/3 pointer-events-none"
                style={{
                  background: 'linear-gradient(90deg, transparent, hsla(0,0%,100%,0.18), transparent)',
                  animation: 'ese-shimmer-x 4s linear infinite',
                }}
              />
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3">
              {[
                { k: 'Score', v: 'Cinematic MusicGen' },
                { k: 'Voice', v: '11 languages · clones' },
                { k: 'Mix',   v: 'Auto-duck on dialogue' },
              ].map((s) => (
                <div key={s.k} className="p-3 rounded-xl bg-white/[0.025] border border-white/[0.05]">
                  <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/45">{s.k}</p>
                  <p className="text-white/80 text-[12.5px] font-light mt-1">{s.v}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="md:col-span-5 grid grid-cols-2 gap-3">
            {[featMusic, featVoice, featStyle, featImageToVideo].map((src, i) => (
              <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border border-white/[0.06] group"
                style={{ boxShadow: '0 20px 60px -30px rgba(10,132,255,0.5)' }}
              >
                <img src={src} alt="" className="w-full h-full object-cover transition-transform duration-[1400ms] group-hover:scale-110" loading="lazy" />
                <div aria-hidden className="absolute inset-0"
                  style={{ background: 'linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.7) 100%)' }}
                />
                <div className="absolute bottom-2 left-2.5 text-[9.5px] font-mono uppercase tracking-[0.2em] text-white/85">
                  {['Music','Voice','Style','I2V'][i]}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── 2c. Showreel quartet (4 more living videos) ──────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-5%' }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-24 md:mb-32"
        >
          {SHOWREEL.map((v, i) => (
            <div key={i} className="group relative aspect-[9/12] rounded-2xl overflow-hidden border border-white/[0.06]"
              style={{ boxShadow: '0 30px 70px -40px rgba(10,132,255,0.55), inset 0 0 0 1px hsla(0,0%,100%,0.04)' }}
            >
              <video src={v.src} autoPlay loop muted playsInline preload="metadata"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1600ms] group-hover:scale-[1.06]"
              />
              <div aria-hidden className="absolute inset-0"
                style={{ background: 'linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.85))' }}
              />
              <div className="absolute bottom-3 left-3 right-3">
                <div className="text-white text-[13px] font-medium tracking-[-0.01em]" style={{ fontFamily: "'Fraunces', serif" }}>{v.label}</div>
                <div className="text-[9.5px] font-mono uppercase tracking-[0.22em] text-white/55 mt-0.5">{v.spec}</div>
              </div>
            </div>
          ))}
        </motion.div>

        {/* ── 3. Mascot orbital ring ───────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          className="relative h-[520px] md:h-[620px] mb-20 md:mb-28 flex items-center justify-center"
        >
          {/* Concentric guide rings */}
          {[180, 260, 340].map((r, i) => (
            <div
              key={r}
              className="absolute rounded-full pointer-events-none"
              style={{
                width: r * 2,
                height: r * 2,
                border: '1px dashed hsla(212,100%,70%,0.10)',
                animation: `${i % 2 ? 'ese-orbit-ccw' : 'ese-orbit-cw'} ${60 + i * 20}s linear infinite`,
              }}
            />
          ))}

          {/* Glowing core */}
          <div
            className="absolute w-40 h-40 rounded-full flex items-center justify-center"
            style={{
              background:
                'radial-gradient(circle, hsla(212,100%,80%,0.95) 0%, hsla(212,100%,55%,0.55) 35%, transparent 75%)',
              filter: 'blur(0.5px)',
            }}
          >
            <div className="text-center">
              <div className="text-[10px] font-mono uppercase tracking-[0.42em] text-white/90">Apex</div>
              <div className="text-[10px] font-mono uppercase tracking-[0.42em] text-white/70 mt-1">Engine</div>
            </div>
          </div>

          {/* Orbiting mascots — wrapper rotates, each child counter-rotates so the mascot stays upright */}
          <div
            className="absolute"
            style={{
              width: 1,
              height: 1,
              animation: 'ese-orbit-cw 38s linear infinite',
            }}
          >
            {orbit.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: m.delay, ease: [0.16, 1, 0.3, 1] }}
                className="absolute"
                style={{ left: m.x, top: m.y }}
              >
                <div
                  className="relative -translate-x-1/2 -translate-y-1/2 w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden border border-white/[0.08]"
                  style={{
                    background: 'linear-gradient(180deg, hsla(0,0%,100%,0.05), hsla(0,0%,100%,0.01))',
                    boxShadow: '0 20px 60px -20px rgba(10,132,255,0.55), inset 0 0 0 1px hsla(0,0%,100%,0.06)',
                    animation: 'ese-orbit-ccw 38s linear infinite',
                  }}
                >
                  <LazyAutoVideo
                    src={m.loop}
                    poster={m.src}
                    aria-hidden
                    className="w-full h-full object-cover"
                  />
                </div>
              </motion.div>
            ))}
          </div>

          {/* Side label */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
            <div className="text-[10px] font-mono uppercase tracking-[0.32em] text-white/45">9 mascots · 1 engine</div>
          </div>
        </motion.div>

        {/* ── 4. Avatar parade (two opposite marquees) ─────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-5%' }}
          transition={{ duration: 1 }}
          className="relative mb-24 md:mb-32 space-y-3"
          style={{
            maskImage: 'linear-gradient(90deg, transparent 0%, #000 8%, #000 92%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, #000 8%, #000 92%, transparent 100%)',
          }}
        >
          <div className="text-center mb-5">
            <div className="text-[10px] font-mono uppercase tracking-[0.32em] text-white/45">
              90+ ready-cast characters
            </div>
          </div>
          {[0, 1].map((row) => (
            <div key={row} className="flex overflow-hidden">
              <div
                className="flex gap-3 shrink-0 pr-3"
                style={{
                  animation: `${row ? 'ese-marquee-r' : 'ese-marquee'} ${row ? 55 : 45}s linear infinite`,
                }}
              >
                {/* Marquee excludes the 8 avatars used as solo spotlight tiles
                    elsewhere on the page — so no cast member appears twice. */}
                {(() => {
                  // Reserved indices: spotlight tiles + left column + casting hall.
                  const RESERVED = new Set([
                    0, 2, 4, 6, 7, 10, 12, 14, 17, 18, 20, 21, 23, 25,
                  ]);
                  const pool = AVATARS.filter((_, i) => !RESERVED.has(i));
                  return [...pool, ...pool];
                })().map((a, i) => (
                  <div
                    key={i}
                    className="w-20 h-20 md:w-24 md:h-24 shrink-0 rounded-2xl overflow-hidden border border-white/[0.06]"
                    style={{ boxShadow: 'inset 0 0 0 1px hsla(0,0%,100%,0.04)' }}
                  >
                    <img src={a} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </motion.div>

        {/* ── 5. Engine matrix ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-14">
          <div className="lg:col-span-7 relative rounded-3xl overflow-hidden p-7 md:p-9 backdrop-blur-2xl"
            style={{
              background: 'linear-gradient(180deg, hsla(0,0%,100%,0.025) 0%, hsla(0,0%,100%,0.005) 100%)',
              boxShadow: 'inset 0 0 0 1px hsla(0,0%,100%,0.06), inset 0 1px 0 hsla(0,0%,100%,0.06)',
            }}
          >
            <div className="absolute inset-x-0 top-0 h-px"
              style={{ background: 'linear-gradient(90deg, transparent, hsla(212,100%,75%,0.5), transparent)' }} />
            <div className="flex items-baseline justify-between mb-6">
              <p className="text-[10px] uppercase tracking-[0.36em] text-white/40 font-mono">Generation engines</p>
              <p className="text-[10px] uppercase tracking-[0.28em] text-[#9DCBFF]/70 font-mono">Pick per shot</p>
            </div>
            <div className="space-y-3">
              {[
                { name: 'Kling V3', tag: 'Cinematic · Native lip-sync', durations: '5 / 10s', aspects: '16:9 · 9:16 · 1:1', badges: ['T2V','I2V','Lip-sync','Native audio'] },
                { name: 'Seedance 2.0', tag: 'Hyperreal motion', durations: '5 / 10 / 12s', aspects: '16:9 · 9:16 · 1:1', badges: ['T2V','I2V','Last-frame carry'] },
              ].map((eng, i) => (
                <motion.div
                  key={eng.name}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  className="group relative flex flex-col sm:flex-row sm:items-center gap-4 p-4 sm:p-5 rounded-2xl bg-white/[0.015] hover:bg-white/[0.04] transition-all duration-500 border border-white/[0.04] hover:border-[hsla(212,100%,60%,0.25)]"
                >
                  <div className="w-10 shrink-0 text-[11px] font-mono tracking-[0.2em] text-white/30 tabular-nums">0{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0A84FF', boxShadow: '0 0 10px #0A84FF' }} />
                      <h3 className="text-white text-[17px] font-medium tracking-[-0.012em]" style={{ fontFamily: "'Fraunces', serif" }}>{eng.name}</h3>
                    </div>
                    <p className="text-white/45 text-[12.5px] font-light mt-0.5 leading-snug">{eng.tag}</p>
                  </div>
                  <div className="flex flex-col items-start sm:items-end shrink-0 gap-1">
                    <span className="text-[10.5px] font-mono tabular-nums text-white/65">{eng.durations}</span>
                    <span className="text-[10px] font-mono tracking-[0.08em] text-white/35">{eng.aspects}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 sm:max-w-[210px] sm:justify-end">
                    {eng.badges.map((b) => (
                      <span key={b} className="text-[9.5px] font-mono uppercase tracking-[0.14em] text-white/65 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06]">{b}</span>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
            <p className="mt-6 text-[11px] text-white/40 font-light leading-relaxed">
              Routing is automatic per shot. Pin a single engine for a project when you need consistency. Credits bill at $0.10 each.
            </p>
          </div>

          <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {[
              { k: 'Hollywood Pipeline',     v: 'Unified T2V + I2V engine' },
              { k: 'Multi-Character Dialogue', v: 'Two avatars, six-clip arcs' },
              { k: 'Face Lock Identity',     v: 'No drift between cuts' },
              { k: 'Continuity Engine',      v: 'Manifest-level shot memory' },
              { k: 'Cinematic Scoring',      v: 'MusicGen + dialogue duck' },
              { k: 'Verbatim Script',        v: 'Your dialogue, untouched' },
              { k: 'Photo Editor · Gemini',  v: '2-credit preservation edits' },
              { k: 'Native Video Editor',    v: 'Multi-track timeline + scopes' },
            ].map((f, i) => (
              <motion.div
                key={f.k}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                className="group relative p-4 rounded-2xl bg-white/[0.02] hover:bg-white/[0.045] border border-white/[0.05] hover:border-[hsla(212,100%,60%,0.22)] transition-all duration-500 overflow-hidden"
              >
                <span aria-hidden className="absolute -top-px left-4 right-4 h-px" style={{ background: 'linear-gradient(90deg, transparent, hsla(212,100%,75%,0.5), transparent)', opacity: 0.6 }} />
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-1 h-1 rounded-full bg-[#0A84FF]" />
                  <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-white/55">{f.k}</p>
                </div>
                <p className="text-white/82 text-[13.5px] font-light leading-snug tracking-[-0.005em]">{f.v}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── 6. End-to-end pipeline ribbon ────────────────────────────── */}
        <div className="relative mb-20 rounded-3xl p-6 md:p-7 overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, hsla(0,0%,100%,0.018) 0%, hsla(0,0%,100%,0.003) 100%)',
            boxShadow: 'inset 0 0 0 1px hsla(0,0%,100%,0.05)',
          }}
        >
          <p className="text-[10px] uppercase tracking-[0.36em] text-white/40 font-mono mb-5">End-to-end pipeline</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
            {['Prompt','Script · LLM','Scene DNA','Character Lock','Engine Route','Generate','Continuity Audit','Score + Mix','Stitch','Edit'].map((step, i, arr) => (
              <div key={step} className="flex items-center gap-2">
                <span className="text-[11px] font-mono tabular-nums text-white/35">{String(i + 1).padStart(2, '0')}</span>
                <span className="text-[12.5px] text-white/80 font-light tracking-[-0.005em]">{step}</span>
                {i < arr.length - 1 && <span aria-hidden className="text-white/20 text-[12px] mx-1.5">→</span>}
              </div>
            ))}
          </div>
        </div>

        {/* ── 7. Frame-chain demo (5 frames → 1 film) ──────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-5%' }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="mb-24 md:mb-32"
        >
          <div className="text-center mb-6">
            <div className="text-[10px] font-mono uppercase tracking-[0.32em] text-white/45">Five frames · One film</div>
          </div>
          <div className="flex items-end justify-center gap-2 md:gap-3 flex-wrap">
            {FRAME_CHAIN.map((src, i) => (
              <div key={i} className="flex items-center gap-2 md:gap-3">
                <div
                  className="relative w-28 h-20 md:w-40 md:h-28 rounded-xl overflow-hidden border border-white/[0.06]"
                  style={{
                    boxShadow: '0 18px 50px -25px rgba(10,132,255,0.55), inset 0 0 0 1px hsla(0,0%,100%,0.05)',
                    animation: `ese-frame-flow ${3 + i * 0.4}s ease-in-out ${i * 0.18}s infinite`,
                  }}
                >
                  <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
                  <div className="absolute top-1 left-1.5 text-[8.5px] font-mono tracking-[0.18em] text-white/85 px-1.5 py-0.5 rounded bg-black/45 backdrop-blur">
                    F{String(i + 1).padStart(2, '0')}
                  </div>
                </div>
                {i < FRAME_CHAIN.length - 1 && (
                  <div className="text-white/30 text-lg md:text-xl">→</div>
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── 4b. SPOTLIGHT PEDESTALS — 3 hero mascots under stage lights ─ */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-5%' }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="relative mb-24 md:mb-32 rounded-[32px] overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, #06080f 0%, #02040a 100%)',
            boxShadow: 'inset 0 0 0 1px hsla(0,0%,100%,0.06), 0 50px 120px -60px rgba(10,132,255,0.45)',
          }}
        >
          <div className="px-7 md:px-10 pt-8 md:pt-10 flex items-baseline justify-between">
            <p className="text-[10px] uppercase tracking-[0.36em] text-white/40 font-mono">Casting hall</p>
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#ffd98a]/80 font-mono">Three under the light</p>
          </div>

          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6 px-7 md:px-10 pt-6 pb-16">
            {/* Casting trio — unique avatars, never reused anywhere else on the page. */}
            {[AVATARS[6], AVATARS[21], AVATARS[23]].map((src, i) => (
              <div key={i} className="relative h-[340px] md:h-[400px] flex items-end justify-center">
                {/* Cone of light from above */}
                <div aria-hidden className="absolute inset-x-0 -top-6 h-full pointer-events-none"
                  style={{
                    background: 'linear-gradient(180deg, hsla(48,100%,80%,0.32) 0%, hsla(48,100%,70%,0.10) 35%, transparent 70%)',
                    filter: 'blur(20px)',
                    clipPath: 'polygon(42% 0, 58% 0, 90% 100%, 10% 100%)',
                    animation: `ese-spot-sweep ${8 + i * 1.6}s ease-in-out ${i * 0.6}s infinite`,
                  }} />
                {/* Dust motes */}
                <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
                  {Array.from({ length: 14 }).map((_, k) => {
                    const left = 20 + ((k * 17) % 60);
                    const dx = -20 + ((k * 13) % 40);
                    const dur = 5 + ((k * 7) % 40) / 10;
                    const delay = ((k * 11) % 50) / 10;
                    return (
                      <span key={k} className="absolute rounded-full bg-white/85"
                        style={{
                          left: `${left}%`, bottom: '0%',
                          width: 2, height: 2,
                          boxShadow: '0 0 6px rgba(255,235,180,0.85)',
                          ['--dx' as never]: `${dx}px`,
                          animation: `ese-dust ${dur}s linear ${delay}s infinite`,
                        }} />
                    );
                  })}
                </div>

                {/* Pedestal */}
                <div className="absolute bottom-3 w-44 h-3 rounded-full"
                  style={{
                    background: 'radial-gradient(closest-side, rgba(255,210,120,0.55), transparent 70%)',
                    filter: 'blur(4px)',
                  }} />
                <div className="absolute bottom-0 w-40 h-6 rounded-[14px]"
                  style={{
                    background: 'linear-gradient(180deg, #1a1d28 0%, #06070b 100%)',
                    boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.12), 0 12px 30px -10px rgba(0,0,0,0.7)',
                  }} />

                {/* The mascot — slow 3D rotation feel via subtle skew + floating */}
                <div className="relative z-10 w-44 h-44 md:w-52 md:h-52 rounded-3xl overflow-hidden"
                  style={{
                    boxShadow:
                      '0 30px 80px -20px rgba(255,200,90,0.45), 0 0 0 1px hsla(0,0%,100%,0.06), inset 0 0 60px hsla(48,100%,70%,0.18)',
                    animation: `ese-ticket-float ${4 + i * 0.4}s ease-in-out ${i * 0.3}s infinite`,
                    ['--tr' as never]: `${(i - 1) * 2.4}deg`,
                  }}>
                  <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
                  <div aria-hidden className="absolute inset-0"
                    style={{ background: 'radial-gradient(120% 60% at 50% 0%, transparent 40%, rgba(0,0,0,0.5) 100%)' }} />
                </div>

                {/* Reflection */}
                <div aria-hidden className="absolute -bottom-10 w-44 h-16 rounded-3xl overflow-hidden pointer-events-none"
                  style={{
                    transform: 'scaleY(-1)',
                    maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent 90%)',
                    WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent 90%)',
                    filter: 'blur(3px)',
                    opacity: 0.45,
                  }}>
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </div>

                {/* Label */}
                <div className="absolute -bottom-9 left-1/2 -translate-x-1/2 text-center">
                  <div className="text-[9.5px] font-mono uppercase tracking-[0.3em] text-white/55">
                    {['Hoppy','Sage','V-01'][i]}
                  </div>
                  <div className="text-[10px] text-white/35">{['Series mascot','Wizard rabbit','Hero robot'][i]}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Floor reflection wash */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-24"
            style={{
              background: 'linear-gradient(180deg, transparent, hsla(212,100%,55%,0.08))',
            }} />
        </motion.div>

        {/* ── 4c. SPINNING FILM REEL + VINYL — premium audio module ───── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-5%' }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="relative mb-24 md:mb-32 grid grid-cols-1 md:grid-cols-2 gap-5"
        >
          {/* Film reel */}
          <div className="relative rounded-3xl overflow-hidden p-8 md:p-10 backdrop-blur-xl"
            style={{
              background: 'linear-gradient(180deg, hsla(0,0%,100%,0.03), hsla(0,0%,100%,0.005))',
              boxShadow: 'inset 0 0 0 1px hsla(0,0%,100%,0.06), 0 30px 80px -40px rgba(10,132,255,0.4)',
            }}>
            <p className="text-[10px] uppercase tracking-[0.36em] text-white/40 font-mono mb-2">Reel · 01</p>
            <h3 className="text-white text-2xl md:text-3xl font-light tracking-[-0.02em] mb-6" style={{ fontFamily: "'Fraunces', serif" }}>
              Film keeps rolling.
            </h3>
            <div className="relative mx-auto" style={{ width: 220, height: 220 }}>
              <div className="absolute inset-0 rounded-full"
                style={{
                  background: 'radial-gradient(circle, #1c2030 0%, #06080f 70%)',
                  boxShadow: 'inset 0 0 0 6px #0c1019, 0 0 60px hsla(212,100%,55%,0.25)',
                  animation: 'ese-reel-spin 14s linear infinite',
                }}>
                {/* Reel holes */}
                {Array.from({ length: 6 }).map((_, k) => {
                  const a = (k / 6) * Math.PI * 2;
                  return (
                    <span key={k} className="absolute rounded-full"
                      style={{
                        left: '50%', top: '50%',
                        width: 28, height: 28,
                        marginLeft: -14, marginTop: -14,
                        transform: `translate(${Math.cos(a) * 60}px, ${Math.sin(a) * 60}px)`,
                        background: '#02040a',
                        boxShadow: 'inset 0 0 0 2px hsla(0,0%,100%,0.12)',
                      }} />
                  );
                })}
                <span className="absolute left-1/2 top-1/2 rounded-full"
                  style={{ width: 24, height: 24, marginLeft: -12, marginTop: -12,
                           background: 'radial-gradient(circle, #9DCBFF, #0A84FF 70%)',
                           boxShadow: '0 0 24px #0A84FF' }} />
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 text-[11px] font-mono uppercase tracking-[0.18em]">
              <div className="p-3 rounded-xl bg-white/[0.025] border border-white/[0.05]">
                <p className="text-white/40">Format</p>
                <p className="text-white/85 mt-1">ProRes · H.264 · MP4</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.025] border border-white/[0.05]">
                <p className="text-white/40">Aspect</p>
                <p className="text-white/85 mt-1">16:9 · 9:16 · 1:1</p>
              </div>
            </div>
          </div>

          {/* Vinyl + EQ orbit */}
          <div className="relative rounded-3xl overflow-hidden p-8 md:p-10 backdrop-blur-xl"
            style={{
              background: 'linear-gradient(180deg, hsla(0,0%,100%,0.03), hsla(0,0%,100%,0.005))',
              boxShadow: 'inset 0 0 0 1px hsla(0,0%,100%,0.06), 0 30px 80px -40px rgba(255,200,90,0.35)',
            }}>
            <p className="text-[10px] uppercase tracking-[0.36em] text-white/40 font-mono mb-2">Side A · Score</p>
            <h3 className="text-white text-2xl md:text-3xl font-light tracking-[-0.02em] mb-6" style={{ fontFamily: "'Fraunces', serif" }}>
              The score writes itself.
            </h3>
            <div className="relative mx-auto" style={{ width: 220, height: 220 }}>
              <div className="absolute inset-0 rounded-full"
                style={{
                  background:
                    'repeating-radial-gradient(circle at center, #0a0c12 0 2px, #15181f 2px 4px)',
                  boxShadow: 'inset 0 0 0 1px hsla(0,0%,100%,0.08), 0 0 60px hsla(48,100%,60%,0.22)',
                  animation: 'ese-reel-spin 9s linear infinite',
                }}>
                <span className="absolute left-1/2 top-1/2 rounded-full"
                  style={{ width: 70, height: 70, marginLeft: -35, marginTop: -35,
                           background: 'radial-gradient(circle, #ffd98a, #f3a93b 70%)',
                           boxShadow: '0 0 30px rgba(255,210,120,0.55)' }} />
                <span className="absolute left-1/2 top-1/2 rounded-full"
                  style={{ width: 10, height: 10, marginLeft: -5, marginTop: -5, background: '#02040a' }} />
              </div>
              {/* EQ ring around the vinyl */}
              {Array.from({ length: 36 }).map((_, k) => {
                const a = (k / 36) * Math.PI * 2;
                const r = 128;
                const x = 110 + Math.cos(a) * r;
                const y = 110 + Math.sin(a) * r;
                const len = 10 + ((k * 11) % 22);
                const dur = 0.9 + ((k * 7) % 22) / 10;
                return (
                  <span key={k} className="absolute origin-center rounded-sm"
                    style={{
                      left: x, top: y,
                      width: 3, height: len,
                      transform: `translate(-50%,-50%) rotate(${(a * 180) / Math.PI + 90}deg)`,
                      background: 'linear-gradient(180deg, #9DCBFF, #0A84FF)',
                      boxShadow: '0 0 6px hsla(212,100%,60%,0.6)',
                      animation: `ese-eq ${dur}s ease-in-out ${(k % 9) * 0.1}s infinite`,
                    }} />
                );
              })}
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3 text-[10.5px] font-mono uppercase tracking-[0.18em]">
              <div className="p-3 rounded-xl bg-white/[0.025] border border-white/[0.05]">
                <p className="text-white/40">Score</p>
                <p className="text-white/85 mt-1">MusicGen</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.025] border border-white/[0.05]">
                <p className="text-white/40">Voice</p>
                <p className="text-white/85 mt-1">11 langs</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.025] border border-white/[0.05]">
                <p className="text-white/40">Duck</p>
                <p className="text-white/85 mt-1">Auto</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── 7b. PREMIERE TICKETS — floating numbered passes ─────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-5%' }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="relative mb-24 md:mb-32"
        >
          <div className="text-center mb-6">
            <div className="text-[10px] font-mono uppercase tracking-[0.32em] text-white/45">Your premiere · Five seats reserved</div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-5">
            {[AVATARS[2], AVATARS[7], AVATARS[14], AVATARS[20], AVATARS[25]].map((src, i) => (
              <div key={i}
                className="relative w-[200px] h-[110px] rounded-[14px] overflow-hidden flex"
                style={{
                  background: 'linear-gradient(135deg, #fff8e0 0%, #ffd98a 60%, #f3a93b 100%)',
                  color: '#2a1604',
                  boxShadow: '0 18px 50px -20px rgba(255,200,90,0.6), inset 0 0 0 1px rgba(255,255,255,0.5)',
                  ['--tr' as never]: `${(i - 2) * 2.5}deg`,
                  animation: `ese-ticket-float ${5 + i * 0.3}s ease-in-out ${i * 0.25}s infinite`,
                }}>
                {/* Avatar stub */}
                <div className="relative w-[78px] h-full overflow-hidden"
                  style={{ borderRight: '2px dashed rgba(42,22,4,0.35)' }}>
                  <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
                </div>
                {/* Punch hole */}
                <span className="absolute left-[78px] top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#02040a]" />
                {/* Right side info */}
                <div className="flex-1 px-3 py-2 flex flex-col justify-between">
                  <div>
                    <div className="text-[8.5px] font-mono uppercase tracking-[0.28em] opacity-70">Apex Studio</div>
                    <div className="text-[14px] font-semibold tracking-[-0.01em] mt-0.5" style={{ fontFamily: "'Fraunces', serif" }}>
                      Premiere Pass
                    </div>
                  </div>
                  <div className="flex items-end justify-between">
                    <div className="text-[8.5px] font-mono uppercase tracking-[0.22em] opacity-70">Seat</div>
                    <div className="text-[22px] font-mono leading-none tabular-nums">A-{String(i + 1).padStart(2, '0')}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── 9. GIANT circular star — Get Started ─────────────────────── */}
        <div className="relative flex flex-col items-center justify-center pt-16 pb-4">
          {/* Stage glow */}
          <div
            aria-hidden
            className="absolute inset-x-0 -top-10 h-[480px] pointer-events-none -z-10"
            style={{
              background:
                'radial-gradient(60% 80% at 50% 60%, hsla(212,100%,55%,0.30), transparent 70%),' +
                'radial-gradient(35% 50% at 50% 60%, hsla(0,0%,100%,0.20), transparent 70%)',
              filter: 'blur(30px)',
            }}
          />

          {/* Confetti rain behind CTA */}
          <div aria-hidden className="absolute inset-x-0 -top-16 h-[560px] pointer-events-none -z-10 overflow-hidden">
            {Array.from({ length: 36 }).map((_, k) => {
              const left = (k * 53) % 100;
              const dx = -60 + ((k * 19) % 120);
              const rot = 240 + ((k * 41) % 600);
              const dur = 6 + ((k * 13) % 50) / 10;
              const delay = ((k * 7) % 80) / 10;
              const colors = ['#ffd98a', '#9DCBFF', '#ffffff', '#0A84FF', '#f3a93b'];
              const c = colors[k % colors.length];
              const w = 4 + (k % 4);
              const h = 8 + ((k * 5) % 10);
              return (
                <span key={k} className="absolute top-0 rounded-[2px]"
                  style={{
                    left: `${left}%`,
                    width: w, height: h,
                    background: c,
                    boxShadow: `0 0 6px ${c}`,
                    ['--cx' as never]: `${dx}px`,
                    ['--cr' as never]: `${rot}deg`,
                    animation: `ese-confetti-fall ${dur}s linear ${delay}s infinite`,
                  }} />
              );
            })}
          </div>

          {/* Expanding sonar rings */}
          <div aria-hidden className="absolute left-1/2 top-[55%] pointer-events-none -z-10" style={{ width: 1, height: 1 }}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="absolute left-0 top-0 rounded-full"
                style={{
                  width: 360,
                  height: 360,
                  marginLeft: -180,
                  marginTop: -180,
                  border: '1px solid hsla(212,100%,75%,0.45)',
                  animation: `ese-ring-expand 4.5s ease-out ${i * 1.5}s infinite`,
                }}
              />
            ))}
          </div>

          {/* Firework bursts */}
          <div aria-hidden className="absolute left-1/2 top-[55%] pointer-events-none -z-10" style={{ width: 1, height: 1 }}>
            {Array.from({ length: 18 }).map((_, i) => {
              const angle = (i / 18) * Math.PI * 2;
              const dist = 180 + ((i * 17) % 90);
              const fx = Math.cos(angle) * dist;
              const fy = Math.sin(angle) * dist;
              const dur = 2.2 + ((i * 7) % 18) / 10;
              const delay = ((i * 11) % 40) / 10;
              const hue = i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? '#9DCBFF' : '#0A84FF';
              return (
                <span
                  key={i}
                  className="absolute left-0 top-0 rounded-full"
                  style={{
                    width: 6,
                    height: 6,
                    marginLeft: -3,
                    marginTop: -3,
                    background: hue,
                    boxShadow: `0 0 14px ${hue}, 0 0 28px ${hue}`,
                    ['--fx' as never]: `${fx}px`,
                    ['--fy' as never]: `${fy}px`,
                    animation: `ese-firework ${dur}s ease-out ${delay}s infinite`,
                  }}
                />
              );
            })}
          </div>

          <motion.button
            onClick={onStart}
            initial={{ opacity: 0, y: 30, scale: 0.92 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: '-20%' }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.98 }}
            className="relative group inline-flex items-center justify-center rounded-full bg-white text-black font-medium tracking-[-0.02em] select-none aspect-square"
            style={{
              width: 'clamp(220px, 24vw, 320px)',
              height: 'clamp(220px, 24vw, 320px)',
              fontSize: 'clamp(18px, 1.9vw, 24px)',
              fontFamily: "'Fraunces', serif",
              animation: 'ese-pulse-glow 3.4s ease-in-out infinite',
            }}
            aria-label="Get started"
          >
            {/* Rotating outer ring */}
            <span
              aria-hidden
              className="absolute -inset-4 rounded-full pointer-events-none"
              style={{
                background:
                  'conic-gradient(from 0deg, rgba(255,255,255,0.55), rgba(10,132,255,0.35), rgba(255,255,255,0.55))',
                filter: 'blur(10px)',
                opacity: 0.7,
                animation: 'ese-orbit-cw 8s linear infinite',
              }}
            />
            <span
              aria-hidden
              className="absolute -inset-px rounded-full bg-white"
            />
            <span className="relative flex flex-col items-center justify-center leading-none">
              <span className="italic" style={{ fontWeight: 300 }}>Get</span>
              <span className="mt-1" style={{ fontWeight: 600 }}>started</span>
              <span aria-hidden className="mt-3 h-px w-10 bg-black/35 transition-all duration-500 group-hover:w-16" />
            </span>
          </motion.button>

          <div className="mt-5 text-[11px] font-mono uppercase tracking-[0.32em] text-white/45">
            No card · Free credits on signup
          </div>
        </div>
      </div>
    </section>
  );
});

export default EnterStudioEpic;