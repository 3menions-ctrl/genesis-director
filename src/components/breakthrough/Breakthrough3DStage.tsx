/**
 * Breakthrough3DStage — mounts a Three.js WebGL renderer + bloom post stack and
 * plays a real 3D breakthrough scene from a TemplateDefinition. Same prop shape
 * as the 2D BreakthroughStage so the Lab can swap between them.
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { buildBreakthroughScene, type BuiltScene } from "@/lib/breakthrough-3d/scene";
import type { TemplateDefinition } from "@/lib/templates/breakthrough";

interface Props {
  def: TemplateDefinition;
  playing: boolean;
  loop?: boolean;
  intensity: number;
  seed?: number;
  scrubTime?: number | null;
  onTime?: (t: number) => void;
  onDuration?: (d: number) => void;
  className?: string;
}

export function Breakthrough3DStage({
  def, playing, loop = true, intensity, seed = 1337,
  scrubTime, onTime, onDuration, className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef(0);
  const playingRef = useRef(playing);
  const loopRef = useRef(loop);
  const intensityRef = useRef(intensity);
  const builtRef = useRef<BuiltScene | null>(null);
  const lastEmit = useRef(0);

  playingRef.current = playing;
  loopRef.current = loop;
  intensityRef.current = intensity;

  useEffect(() => { if (scrubTime != null) timeRef.current = scrubTime; }, [scrubTime]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const built = buildBreakthroughScene(def, renderer, { seed });
    builtRef.current = built;
    onDuration?.(built.durationSec);
    timeRef.current = 0;

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(built.scene, built.camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.42, 0.5, 0.92);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    const size = () => {
      const r = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width));
      const h = Math.max(1, Math.round(r.height));
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      bloom.setSize(w, h);
      built.resize(w, h);
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(canvas);

    let raf = 0;
    let prev = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      if (playingRef.current) {
        timeRef.current += dt;
        if (timeRef.current >= built.durationSec) {
          timeRef.current = loopRef.current ? 0 : built.durationSec;
        }
      }
      built.update(timeRef.current, intensityRef.current);
      composer.render();
      if (now - lastEmit.current > 66) { lastEmit.current = now; onTime?.(timeRef.current); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      built.dispose();
      composer.dispose();
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def, seed]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height: "100%", display: "block", borderRadius: 18 }}
    />
  );
}
