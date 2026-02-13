import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ShardData } from './shardGenerator';

interface GlassShardProps {
  shard: ShardData;
  isShattered: boolean;
  isFading: boolean;
}

// Premium glass palette — jewel-toned architectural glass
const GLASS_PALETTE = [
  { h: 0.58, s: 0.40, l: 0.78 },  // Aquamarine
  { h: 0.65, s: 0.35, l: 0.75 },  // Sapphire
  { h: 0.73, s: 0.45, l: 0.72 },  // Royal blue
  { h: 0.80, s: 0.38, l: 0.76 },  // Amethyst
  { h: 0.87, s: 0.32, l: 0.80 },  // Lavender
  { h: 0.12, s: 0.50, l: 0.82 },  // Champagne
  { h: 0.95, s: 0.28, l: 0.84 },  // Blush
  { h: 0.38, s: 0.35, l: 0.78 },  // Jade
  { h: 0.00, s: 0.00, l: 0.96 },  // Diamond clear
  { h: 0.55, s: 0.42, l: 0.76 },  // Teal
  { h: 0.18, s: 0.55, l: 0.78 },  // Topaz
  { h: 0.45, s: 0.30, l: 0.80 },  // Peridot
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
    const lv = (shard.id % 5) * 0.015;
    
    const baseColor = new THREE.Color().setHSL(c.h, Math.min(1, c.s + sv), Math.min(1, c.l + lv));
    const attenuation = new THREE.Color().setHSL(c.h, Math.min(1, c.s + 0.2), Math.max(0.35, c.l - 0.25));

    return new THREE.MeshPhysicalMaterial({
      color: baseColor,
      metalness: 0.0,
      roughness: 0.01,        // Near-perfect polish
      transmission: 0.92,     // High transparency
      thickness: 0.4,
      ior: 1.55,              // Crown glass IOR
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
      envMapIntensity: 5.0,   // Strong environment reflections
      specularIntensity: 2.0,
      specularColor: new THREE.Color().setHSL(c.h, 0.2, 1.0),
      sheen: 0.2,
      sheenRoughness: 0.2,
      sheenColor: baseColor.clone().multiplyScalar(1.3),
      attenuationColor: attenuation,
      attenuationDistance: 0.5,
      dispersion: 0.3,        // Chromatic dispersion — rainbow edge refractions
    });
  }, [shard.id]);

  const edgeMaterial = useMemo(() => {
    const c = GLASS_PALETTE[shard.id % GLASS_PALETTE.length];
    return new THREE.LineBasicMaterial({
      color: new THREE.Color().setHSL(c.h, c.s * 0.4, 0.92),
      transparent: true,
      opacity: 0.35,
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
