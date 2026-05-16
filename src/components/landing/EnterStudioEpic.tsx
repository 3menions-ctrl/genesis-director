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
import waveHelloAsset from '@/assets/landing-avatar-wave-hello.mp4.asset.json';
import seedanceTestAsset from '@/assets/seedance-avatar-test.mp4.asset.json';
import immersiveHeroAsset from '@/assets/landing-immersive-hero.mp4.asset.json';
import hoppyIntroAsset from '@/assets/landing-hoppy-intro.mp4.asset.json';
import seedanceClipAsset from '@/assets/test-seedance-clip.mp4.asset.json';

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

const MASCOTS = [mAstroBear, mFox, mTiger, mKnight, mWizRabbit, mRobot, mBurger, mIcecream, mTaco];
const AVATARS = [
  aAaliya, aAelindra, aAmina, aArctic, aAtlas, aBella, aBlitz, aCaptain,
  aChibi, aCoral, aCosmo, aDrake, aEmber, aFelix, aFrost, aGuardian,
  aInk, aKing, aLuna, aMerlin, aNova, aOliver, aPixel, aShadow, aStorm,
  aVictor, aVoxelHacker, aVoxelViking,
];

const FRAME_CHAIN = [scene1, feat1, scene2, feat2, scene3];

const VIDEOS = [
  { src: waveHelloAsset.url,    label: 'Avatar · Wave Hello',  spec: 'Kling V3 · 10s · 16:9' },
  { src: seedanceTestAsset.url, label: 'Seedance · Hyperreal', spec: 'Seedance 2.0 · 12s'    },
  { src: immersiveHeroAsset.url,label: 'Cinematic · Hero',     spec: 'Kling V3 · Native audio'},
];

const SHOWREEL = [
  { src: hoppyIntroAsset.url,   label: 'Hoppy · Mascot Reel',  spec: 'I2V · Stitched' },
  { src: seedanceClipAsset.url, label: 'Seedance · Motion Lab',spec: 'Seedance 2.0' },
  { src: waveHelloAsset.url,    label: 'Lip-sync · Talkback',  spec: 'Kling V3 · Audio' },
  { src: immersiveHeroAsset.url,label: 'Hero · Wide Cinematic',spec: 'Kling V3 · 16:9' },
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
            </motion.div>
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
                  <img src={m.src} alt="" className="w-full h-full object-cover" loading="lazy" />
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
                {[...AVATARS, ...AVATARS].map((a, i) => (
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

        {/* ── 8. Secondary CTA row (kept from the original) ────────────── */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <button
            onClick={onEnter}
            className="h-12 px-7 text-[13px] font-medium rounded-full text-white/85 hover:text-white border border-white/15 hover:border-white/30 bg-white/[0.03] hover:bg-white/[0.07] transition-all"
          >
            Take the studio tour
          </button>
          <button
            onClick={onStart}
            className="h-12 px-7 text-[13px] font-medium rounded-full text-white/55 hover:text-white/85 transition-all"
          >
            Skip the tour
          </button>
        </div>

        {/* ── 9. GIANT glowing white GET STARTED button ────────────────── */}
        <div className="relative flex flex-col items-center justify-center pt-10 pb-4">
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

          <motion.button
            onClick={onStart}
            initial={{ opacity: 0, y: 30, scale: 0.92 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: '-20%' }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.98 }}
            className="relative group inline-flex items-center justify-center rounded-full bg-white text-black font-medium tracking-[-0.01em] select-none"
            style={{
              padding: '34px 84px',
              fontSize: 'clamp(22px, 2.6vw, 32px)',
              fontFamily: "'Fraunces', serif",
              animation: 'ese-pulse-glow 3.4s ease-in-out infinite',
            }}
            aria-label="Get started"
          >
            {/* Rotating outer ring */}
            <span
              aria-hidden
              className="absolute -inset-3 rounded-full pointer-events-none"
              style={{
                background:
                  'conic-gradient(from 0deg, rgba(255,255,255,0.55), rgba(10,132,255,0.35), rgba(255,255,255,0.55))',
                filter: 'blur(8px)',
                opacity: 0.55,
                animation: 'ese-orbit-cw 8s linear infinite',
              }}
            />
            <span
              aria-hidden
              className="absolute -inset-px rounded-full bg-white"
            />
            <span className="relative flex items-center gap-3">
              Get started
              <span
                aria-hidden
                className="inline-block translate-y-[1px] transition-transform duration-500 group-hover:translate-x-1"
                style={{ fontSize: '0.8em' }}
              >
                →
              </span>
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