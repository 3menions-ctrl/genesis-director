/**
 * HeroFX — a SUBTLE WebGL glass-refraction layer over the hero video. Samples
 * the <video> as a texture through a hand-written GLSL shader (gentle refraction
 * ripple + a faint chromatic edge that only blooms on fast scroll). Fades in
 * over the plain <video>, which stays as the fallback. Tuned for restraint.
 */
import { useEffect, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { useReducedMotion } from "framer-motion";

const VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uTex;
  uniform float uTime, uGlitch, uMediaAspect, uViewAspect;
  varying vec2 vUv;
  void main() {
    vec2 s = (uViewAspect > uMediaAspect) ? vec2(1.0, uMediaAspect/uViewAspect) : vec2(uViewAspect/uMediaAspect, 1.0);
    vec2 uv = (vUv - 0.5) * s + 0.5;
    // gentle glass refraction
    uv.x += sin(uv.y * 13.0 + uTime * 0.5) * 0.0011;
    uv.y += cos(uv.x * 17.0 - uTime * 0.4) * 0.0011;
    // faint chromatic edge — near-zero at rest, light on scroll
    float ca = 0.0004 + 0.008 * uGlitch;
    float r = texture2D(uTex, clamp(uv + vec2(ca, 0.0), 0.0, 1.0)).r;
    float g = texture2D(uTex, uv).g;
    float b = texture2D(uTex, clamp(uv - vec2(ca, 0.0), 0.0, 1.0)).b;
    vec3 col = vec3(r, g, b);
    col *= 1.0 - 0.10 * pow(distance(vUv, vec2(0.5)), 2.2); // soft vignette
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function HeroFX({ videoRef }: { videoRef: RefObject<HTMLVideoElement> }) {
  const reduced = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (reduced) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    } catch { return; }
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const tex = new THREE.VideoTexture(video);
    tex.minFilter = THREE.LinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    const camera = new THREE.Camera();
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uTex: { value: tex }, uTime: { value: 0 }, uGlitch: { value: 0 }, uMediaAspect: { value: 1.86 }, uViewAspect: { value: 1 } },
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    scene.add(quad);

    const resize = () => {
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(w, h, false);
      mat.uniforms.uViewAspect.value = w / h;
      if (video.videoWidth) mat.uniforms.uMediaAspect.value = video.videoWidth / video.videoHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const clock = new THREE.Clock();
    let raf = 0, glitch = 0, lastY = window.scrollY, shown = false;
    const loop = () => {
      const sy = window.scrollY;
      glitch = Math.min(1, glitch * 0.88 + Math.abs(sy - lastY) * 0.008);
      lastY = sy;
      mat.uniforms.uTime.value = clock.getElapsedTime();
      mat.uniforms.uGlitch.value = glitch;
      tex.needsUpdate = true;
      try { renderer.render(scene, camera); }
      catch { cancelAnimationFrame(raf); return; } // taint/context loss → fall back to <video>
      if (!shown && video.readyState >= 2) { shown = true; setReady(true); }
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      tex.dispose(); mat.dispose(); quad.geometry.dispose(); renderer.dispose();
    };
  }, [reduced, videoRef]);

  if (reduced) return null;
  return <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full transition-opacity duration-1000" style={{ opacity: ready ? 1 : 0 }} />;
}
