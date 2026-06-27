/**
 * breakthrough-3d/scene.ts — a real 3D breakthrough scene (Three.js).
 *
 * Not a 2D canvas: a container surface in real 3D space, PBR-lit by an
 * environment, that SHATTERS into real 3D fragments (instanced meshes with
 * depth, lighting, reflections) as the camera pushes through the boundary,
 * while an emergent emissive subject crosses per the template's destination.
 *
 * Shard + camera motion are CLOSED-FORM functions of the break progress — so
 * the whole thing is deterministic and scrubbable (no integration state).
 *
 * Renderer note: built on WebGLRenderer for universal support + headless
 * verifiability. Swapping to `three/webgpu` WebGPURenderer is a drop-in for
 * GPU-compute sims; the scene graph here is renderer-agnostic. Environment
 * (3DGS splat) and matted-subject video plug into the same scene next.
 */
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { makeRng } from "@/lib/breakthrough-fx";
import { ASPECT_RATIOS } from "@/lib/editor/types";
import type { TemplateDefinition } from "@/lib/templates/breakthrough";

export interface BuiltScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  durationSec: number;
  breakSec: number;
  update(timeSec: number, intensity: number): void;
  resize(w: number, h: number): void;
  dispose(): void;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const easeInOut = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

function destDir(destination: string): THREE.Vector3 {
  switch (destination) {
    case "toward-viewer":    return new THREE.Vector3(0, -0.2, 1.6);
    case "into-adjacent-ui": return new THREE.Vector3(1.4, 0, 0.4);
    case "off-screen":       return new THREE.Vector3(2.2, -0.3, 0.6);
    case "into-outer-space": return new THREE.Vector3(0, 1.6, -2.2);
    default:                 return new THREE.Vector3(0, 0, 1.4);
  }
}

export function buildBreakthroughScene(
  def: TemplateDefinition,
  renderer: THREE.WebGLRenderer,
  opts: { seed?: number } = {},
): BuiltScene {
  const rng = makeRng(opts.seed ?? 1337);
  const grade = def.colorGrade;
  const cPrimary = new THREE.Color(grade.primary);
  const cSecondary = new THREE.Color(grade.secondary);
  const cAccent = new THREE.Color(grade.accent);

  const duration = def.timeline.durationSec;
  const breakSec = def.timeline.beats.find((b) => b.role === "break")?.atSec ?? duration * 0.5;
  const destination = def.destination;
  const dir = destDir(destination);

  // ── scene + environment lighting (PBR) ───────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060b).lerp(cPrimary, 0.25);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;

  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(cAccent.getHex(), 2.0);
  rim.position.set(4, 1, 2);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x080a12, 0.5));

  // ── the surrounding 3D space (revealed as the camera pushes through) ──────
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({ color: 0x0a0c14, roughness: 0.85, metalness: 0.1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.4;
  scene.add(floor);
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 24),
    new THREE.MeshStandardMaterial({ color: cPrimary.clone().multiplyScalar(0.4), roughness: 0.9 }),
  );
  back.position.z = -7;
  scene.add(back);

  // ── container geometry: aspect-correct screen + bezel ─────────────────────
  const ar = ASPECT_RATIOS[def.aspectRatio] ?? { w: 9, h: 16 };
  const SW = 2.4, SH = SW * (ar.h / ar.w);
  const cols = 9, rows = Math.max(6, Math.round(cols * (SH / SW)));
  const cellW = SW / cols, cellH = SH / rows, depth = 0.06;

  const bezel = new THREE.Mesh(
    new THREE.BoxGeometry(SW + 0.18, SH + 0.18, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x101218, roughness: 0.4, metalness: 0.6 }),
  );
  bezel.position.z = -0.08;
  scene.add(bezel);

  // inner "media window" — emissive, pulses pre-break then goes dark
  const screenMat = new THREE.MeshStandardMaterial({
    color: cSecondary, emissive: cSecondary, emissiveIntensity: 0.45,
    roughness: 0.3, metalness: 0.0,
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), screenMat);
  scene.add(screen);

  // ── shards: instanced 3D fragments that form the screen, then explode ─────
  const N = cols * rows;
  const shardGeo = new THREE.BoxGeometry(cellW * 0.96, cellH * 0.96, depth);
  const shardMat = new THREE.MeshStandardMaterial({
    color: cSecondary, emissive: cAccent, emissiveIntensity: 0.25,
    roughness: 0.25, metalness: 0.3,
  });
  const shards = new THREE.InstancedMesh(shardGeo, shardMat, N);
  shards.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(shards);

  interface Sh { home: THREE.Vector3; vel: THREE.Vector3; axis: THREE.Vector3; spin: number; }
  const sh: Sh[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const home = new THREE.Vector3(
        -SW / 2 + (c + 0.5) * cellW,
        -SH / 2 + (r + 0.5) * cellH,
        0,
      );
      const out = home.clone().normalize().multiplyScalar(rng.range(0.6, 1.6));
      const vel = out.add(dir.clone().multiplyScalar(rng.range(0.5, 1.1)));
      vel.z += rng.range(0.2, 1.0);
      sh.push({
        home,
        vel,
        axis: new THREE.Vector3(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1)).normalize(),
        spin: rng.range(2, 7),
      });
    }
  }

  // ── emergent subject (glows via bloom) ────────────────────────────────────
  const subjMat = new THREE.MeshStandardMaterial({
    color: cAccent, emissive: cAccent, emissiveIntensity: 0.85, roughness: 0.2, metalness: 0.1,
  });
  const subject = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 2), subjMat);
  subject.visible = false;
  scene.add(subject);

  // ── camera ────────────────────────────────────────────────────────────────
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
  camera.position.set(0, 0, 6);

  // scratch
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s1 = new THREE.Vector3(1, 1, 1);
  const pos = new THREE.Vector3();

  function update(timeSec: number, intensity: number) {
    const approach = clamp01(timeSec / breakSec);
    const bp = clamp01((timeSec - breakSec) / Math.max(0.001, duration - breakSec));

    // camera: dolly in to the screen, then keep pushing in (stays in FRONT so
    // the shards + subject explode toward the lens and stream past it)
    const zApproach = THREE.MathUtils.lerp(6.5, 3.2, easeInOut(approach));
    const zBreak = THREE.MathUtils.lerp(3.2, 1.5, easeOut(bp));
    camera.position.z = bp <= 0 ? zApproach : zBreak;
    camera.position.x = Math.sin(timeSec * 0.7) * 0.1;
    camera.position.y = Math.sin(timeSec * 0.5) * 0.06;
    camera.lookAt(0, 0, 0);

    // screen: tension pulse pre-break, dark after
    screenMat.emissiveIntensity = bp <= 0
      ? 0.35 + 0.3 * Math.sin(timeSec * 8) * approach
      : 0.0;
    screen.visible = bp <= 0.02;

    // shards: closed-form explosion driven by break progress + intensity
    const k = 3.2 * intensity;
    const g = 2.0; // gravity
    for (let i = 0; i < N; i++) {
      const d = sh[i];
      if (bp <= 0) {
        pos.copy(d.home);
        q.identity();
      } else {
        pos.set(
          d.home.x + d.vel.x * bp * k,
          d.home.y + d.vel.y * bp * k - 0.5 * g * bp * bp,
          d.home.z + d.vel.z * bp * k,
        );
        q.setFromAxisAngle(d.axis, d.spin * bp);
      }
      m.compose(pos, q, s1);
      shards.setMatrixAt(i, m);
    }
    shards.instanceMatrix.needsUpdate = true;
    (shards.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.12 + 0.3 * (1 - bp);

    // subject: emerges + crosses per destination
    const reveal = easeOut(clamp01((bp - 0.05) / 0.45));
    subject.visible = reveal > 0.01;
    if (subject.visible) {
      const grow = 0.6 + 1.4 * reveal * intensity;
      subject.scale.setScalar(grow);
      // keep the subject in FRONT of the advancing camera so it stays framed
      subject.position.set(dir.x * bp * 0.9, dir.y * bp * 0.9, dir.z * bp * 0.55);
      subject.rotation.y += 0.02;
      subject.rotation.x = bp * 1.5;
    }
  }

  function resize(w: number, h: number) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function dispose() {
    envRT.dispose();
    pmrem.dispose();
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[];
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) mat.dispose();
    });
  }

  return { scene, camera, durationSec: duration, breakSec, update, resize, dispose };
}
