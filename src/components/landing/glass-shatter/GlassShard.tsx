import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ShardData } from './shardGenerator';

interface GlassShardProps {
  shard: ShardData;
  isShattered: boolean;
  isFading: boolean;
}

// Premium glass palette — rich dark cinematic tones matching app design system
const GLASS_PALETTE = [
  { h: 0.73, s: 0.65, l: 0.30 },  // Deep indigo
  { h: 0.76, s: 0.70, l: 0.25 },  // Midnight violet
  { h: 0.80, s: 0.60, l: 0.35 },  // Dark amethyst
  { h: 0.70, s: 0.55, l: 0.28 },  // Navy sapphire
  { h: 0.83, s: 0.75, l: 0.32 },  // Royal purple
  { h: 0.68, s: 0.50, l: 0.22 },  // Deep ocean
  { h: 0.75, s: 0.80, l: 0.38 },  // Electric violet
  { h: 0.72, s: 0.45, l: 0.18 },  // Obsidian blue
  { h: 0.78, s: 0.55, l: 0.42 },  // Bright amethyst accent
  { h: 0.66, s: 0.60, l: 0.20 },  // Abyss blue
  { h: 0.85, s: 0.50, l: 0.28 },  // Dark plum
  { h: 0.71, s: 0.40, l: 0.15 },  // Near-black indigo
];

export function GlassShard({ shard, isShattered, isFading }: GlassShardProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const edgesRef = useRef<THREE.LineSegments>(null);
  const progressRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const initialRotation = useRef(new THREE.Euler(0, 0, 0));
  
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    const v = shard.vertices;
    if (v.length < 3) return new THREE.BufferGeometry();
    
    shape.moveTo(v[0].x, v[0].y);
    for (let i = 1; i < v.length; i++) shape.lineTo(v[i].x, v[i].y);
    shape.closePath();
    
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: shard.thickness,
      bevelEnabled: true,
      bevelThickness: 0.001,
      bevelSize: 0.001,
      bevelSegments: 1,
    });
    geo.center();
    return geo;
  }, [shard.vertices, shard.thickness]);

  // Photorealistic glass material
  const material = useMemo(() => {
    const c = GLASS_PALETTE[shard.id % GLASS_PALETTE.length];
    const sv = (shard.id % 7) * 0.02;
    const lv = (shard.id % 5) * 0.01;
    
    const baseColor = new THREE.Color().setHSL(c.h, Math.min(1, c.s + sv), Math.min(1, c.l + lv));
    const attenuation = new THREE.Color().setHSL(c.h, Math.min(1, c.s + 0.15), Math.max(0.1, c.l - 0.1));

    return new THREE.MeshPhysicalMaterial({
      color: baseColor,
      metalness: 0.05,
      roughness: 0.02,
      transmission: 0.85,      // Slightly less transparent for richer color
      thickness: 0.6,
      ior: 1.55,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
      envMapIntensity: 6.0,    // Strong reflections for drama
      specularIntensity: 2.5,
      specularColor: new THREE.Color().setHSL(c.h, 0.3, 0.8),
      sheen: 0.3,
      sheenRoughness: 0.15,
      sheenColor: baseColor.clone().multiplyScalar(1.5),
      attenuationColor: attenuation,
      attenuationDistance: 0.3,
      dispersion: 0.4,         // Stronger chromatic dispersion
    });
  }, [shard.id]);

  const edgeMaterial = useMemo(() => {
    const c = GLASS_PALETTE[shard.id % GLASS_PALETTE.length];
    return new THREE.LineBasicMaterial({
      color: new THREE.Color().setHSL(c.h, c.s * 0.6, 0.6),
      transparent: true,
      opacity: 0.45,
    });
  }, [shard.id]);

  const edgesGeometry = useMemo(() => new THREE.EdgesGeometry(geometry, 15), [geometry]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
      edgeMaterial.dispose();
      edgesGeometry.dispose();
    };
  }, [geometry, material, edgeMaterial, edgesGeometry]);

  useFrame((state) => {
    if (!meshRef.current || !edgesRef.current) return;
    
    if (!isShattered) {
      meshRef.current.position.set(shard.initialPosition.x, shard.initialPosition.y, shard.initialPosition.z);
      meshRef.current.rotation.set(0, 0, shard.initialRotation);
      meshRef.current.scale.setScalar(1);
      edgesRef.current.position.copy(meshRef.current.position);
      edgesRef.current.rotation.copy(meshRef.current.rotation);
      edgesRef.current.scale.copy(meshRef.current.scale);
      material.opacity = 1;
      edgeMaterial.opacity = 0.35;
      progressRef.current = 0;
      startTimeRef.current = null;
      return;
    }

    if (startTimeRef.current === null) {
      startTimeRef.current = state.clock.elapsedTime;
      initialRotation.current.copy(meshRef.current.rotation);
    }

    const elapsed = state.clock.elapsedTime - startTimeRef.current - shard.delay;
    if (elapsed < 0) return;

    // Ultra-smooth easing curves
    const easeOutExpo = (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5);
    
    const duration = 14.0; // Extended for maximum elegance
    progressRef.current = Math.min(1, elapsed / duration);
    const moveProgress = easeOutExpo(progressRef.current);
    const rotProgress = easeOutQuint(progressRef.current);

    const t = elapsed;
    const gravity = 0.3;
    
    // Graceful, floating trajectories
    const vx = shard.velocity.x * 0.5;
    const vy = shard.velocity.y * 0.5 - gravity * t * 0.12;
    const vz = shard.velocity.z * 0.7;
    
    const decel = Math.exp(-t * 0.14);
    meshRef.current.position.x = shard.initialPosition.x + vx * t * decel;
    meshRef.current.position.y = shard.initialPosition.y + vy * t * decel - 0.5 * gravity * t * t * 0.03;
    meshRef.current.position.z = shard.initialPosition.z + vz * t * decel;

    // Elegant tumble with diminishing spin
    const spinDecay = Math.exp(-t * 0.1);
    const spin = shard.spinSpeed * 0.35 * spinDecay;
    meshRef.current.rotation.x = initialRotation.current.x + shard.rotationAxis.x * rotProgress * spin;
    meshRef.current.rotation.y = initialRotation.current.y + shard.rotationAxis.y * rotProgress * spin;
    meshRef.current.rotation.z = initialRotation.current.z + shard.rotationAxis.z * rotProgress * spin;

    // Sync edge wireframe
    edgesRef.current.position.copy(meshRef.current.position);
    edgesRef.current.rotation.copy(meshRef.current.rotation);
    edgesRef.current.scale.copy(meshRef.current.scale);

    // Graceful fade
    if (isFading && progressRef.current > 0.5) {
      const fp = (progressRef.current - 0.5) / 0.5;
      const fe = easeOutQuint(fp);
      material.opacity = 1 - fe;
      edgeMaterial.opacity = 0.35 * (1 - fe);
    }
  });

  return (
    <group>
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={material}
        position={[shard.initialPosition.x, shard.initialPosition.y, shard.initialPosition.z]}
        rotation={[0, 0, shard.initialRotation]}
      />
      <lineSegments
        ref={edgesRef}
        geometry={edgesGeometry}
        material={edgeMaterial}
        position={[shard.initialPosition.x, shard.initialPosition.y, shard.initialPosition.z]}
        rotation={[0, 0, shard.initialRotation]}
      />
    </group>
  );
}
