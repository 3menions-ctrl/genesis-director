import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import { GlassShard } from './GlassShard';
import { generateShardData, ShardData } from './shardGenerator';

interface GlassShatterSceneProps {
  isShattered: boolean;
  isFading: boolean;
}

export function GlassShatterScene({ isShattered, isFading }: GlassShatterSceneProps) {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);
  const { gl } = useThree();
  
  // Premium shard count for cinematic density
  const shards = useMemo(() => generateShardData(160), []);
  
  useEffect(() => {
    return () => {
      if (gl) gl.dispose();
    };
  }, [gl]);
  
  // Ultra-subtle scene breathing for parallax depth
  useFrame((_, delta) => {
    if (groupRef.current && isShattered) {
      timeRef.current += delta;
      groupRef.current.rotation.y = Math.sin(timeRef.current * 0.05) * 0.008;
      groupRef.current.rotation.x = Math.cos(timeRef.current * 0.04) * 0.005;
    }
  });

  return (
    <>
      {/* Cinematic lighting rig — 7-point setup */}
      <ambientLight intensity={0.03} color="#c8c0ff" />
      
      {/* Key light — strong directional for specular highlights */}
      <spotLight
        position={[3, 10, 15]}
        intensity={6}
        angle={0.35}
        penumbra={0.95}
        color="#f8f4ff"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      
      {/* Fill light — soft opposite side */}
      <spotLight
        position={[-8, 5, 10]}
        intensity={1.8}
        angle={0.5}
        penumbra={1}
        color="#e0e8ff"
      />
      
      {/* Purple accent — brand color splash */}
      <pointLight position={[-12, 4, 6]} intensity={2.5} color="#8b5cf6" />
      
      {/* Cool blue counterbalance */}
      <pointLight position={[12, -3, 5]} intensity={2} color="#3b82f6" />
      
      {/* Rim backlight — dramatic silhouette edge */}
      <pointLight position={[0, -6, -10]} intensity={5} color="#6d28d9" />
      
      {/* Hair light — top edge definition */}
      <pointLight position={[0, 12, 3]} intensity={1.5} color="#e2e8f0" />
      
      {/* Impact epicenter — white burst */}
      <pointLight 
        position={[0, 0, 2]} 
        intensity={isShattered ? 20 : 0} 
        color="#ffffff" 
        distance={10}
        decay={2}
      />
      
      {/* Impact bloom — purple halo */}
      <pointLight 
        position={[0, 0, 0.8]} 
        intensity={isShattered ? 12 : 0} 
        color="#8b5cf6" 
        distance={6}
        decay={2}
      />
      
      {/* Warm underlight — cinematic depth */}
      <pointLight 
        position={[0, -4, 4]} 
        intensity={isShattered ? 3 : 0} 
        color="#d97706" 
        distance={8}
        decay={2}
      />

      {/* Studio HDRI for photorealistic reflections */}
      <Environment preset="studio" />

      {/* Fog for atmospheric depth */}
      <fog attach="fog" args={['#050510', 8, 25]} />

      <group ref={groupRef}>
        {shards.map((shard: ShardData) => (
          <GlassShard
            key={shard.id}
            shard={shard}
            isShattered={isShattered}
            isFading={isFading}
          />
        ))}
      </group>

      {isShattered && <ImpactRing />}
      {isShattered && <VolumetricDust />}
    </>
  );
}

/** Expanding shockwave ring at impact point */
function ImpactRing() {
  const ringRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const startRef = useRef<number | null>(null);

  useFrame((state) => {
    if (!ringRef.current || !matRef.current) return;
    if (startRef.current === null) startRef.current = state.clock.elapsedTime;
    
    const t = state.clock.elapsedTime - startRef.current;
    const scale = 1 + t * 2.5;
    ringRef.current.scale.set(scale, scale, 1);
    matRef.current.opacity = Math.max(0, 0.6 * Math.exp(-t * 0.8));
  });

  return (
    <mesh ref={ringRef} position={[0, 0, 0.05]} rotation={[0, 0, 0]}>
      <ringGeometry args={[0.3, 0.35, 64]} />
      <meshBasicMaterial
        ref={matRef}
        color="#c4b5fd"
        transparent
        opacity={0.6}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

/** Volumetric dust cloud for atmosphere */
function VolumetricDust() {
  const pointsRef = useRef<THREE.Points>(null);
  const startRef = useRef<number | null>(null);
  
  const { geometry, material, velocities } = useMemo(() => {
    const count = 200;
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    
    for (let i = 0; i < count; i++) {
      // Concentrated at origin, expanding outward
      pos[i * 3] = (Math.random() - 0.5) * 0.3;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 0.3;
      pos[i * 3 + 2] = Math.random() * 0.3;
      
      vel[i * 3] = (Math.random() - 0.5) * 3;
      vel[i * 3 + 1] = (Math.random() - 0.5) * 3;
      vel[i * 3 + 2] = Math.random() * 4;
      
      sizes[i] = 0.008 + Math.random() * 0.015;
    }
    
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const mat = new THREE.PointsMaterial({
      size: 0.01,
      color: 0xe8e0ff,
      transparent: true,
      opacity: 0.4,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    
    return { geometry: geo, material: mat, velocities: vel };
  }, []);

  useFrame((state) => {
    if (!pointsRef.current) return;
    if (startRef.current === null) startRef.current = state.clock.elapsedTime;
    
    const elapsed = state.clock.elapsedTime - startRef.current;
    const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
    
    for (let i = 0; i < positions.length / 3; i++) {
      const decay = Math.exp(-elapsed * 0.08);
      positions[i * 3] += velocities[i * 3] * 0.003 * decay;
      positions[i * 3 + 1] += velocities[i * 3 + 1] * 0.003 * decay;
      positions[i * 3 + 2] += velocities[i * 3 + 2] * 0.004 * decay;
    }
    
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    
    // Graceful fade
    material.opacity = elapsed < 6
      ? 0.4 
      : Math.max(0, 0.4 * (1 - (elapsed - 6) / 5));
  });

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}
