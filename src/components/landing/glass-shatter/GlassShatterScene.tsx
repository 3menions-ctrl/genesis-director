import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment, Float } from '@react-three/drei';
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
  
  // Generate shard data once - more shards for premium feel
  const shards = useMemo(() => generateShardData(120), []);
  
  // Subtle scene rotation for depth
  useFrame((_, delta) => {
    if (groupRef.current && isShattered) {
      timeRef.current += delta;
      groupRef.current.rotation.y = Math.sin(timeRef.current * 0.08) * 0.015;
      groupRef.current.rotation.x = Math.cos(timeRef.current * 0.06) * 0.008;
    }
  });

  return (
    <>
      {/* Premium lighting setup */}
      <ambientLight intensity={0.1} color="#e8e0ff" />
      
      {/* Key light - bright white with slight purple tint */}
      <spotLight
        position={[0, 8, 10]}
        intensity={4}
        angle={0.5}
        penumbra={0.8}
        color="#ffffff"
        castShadow
      />
      
      {/* Accent light - purple from left */}
      <pointLight position={[-10, 3, 5]} intensity={2.5} color="#a855f7" />
      
      {/* Secondary accent - blue from right */}
      <pointLight position={[10, -2, 4]} intensity={2} color="#3b82f6" />
      
      {/* Rim light - dramatic backlight */}
      <pointLight position={[0, -5, -8]} intensity={3} color="#8b5cf6" />
      
      {/* Impact point glow - animated */}
      <pointLight 
        position={[0, 0, 1]} 
        intensity={isShattered ? 12 : 0} 
        color="#ffffff" 
        distance={6}
        decay={2}
      />
      
      {/* Secondary impact glow - purple */}
      <pointLight 
        position={[0, 0, 0.5]} 
        intensity={isShattered ? 8 : 0} 
        color="#a855f7" 
        distance={4}
        decay={2}
      />

      {/* Premium environment for reflections */}
      <Environment preset="night" />

      {/* Shards group */}
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

      {/* Premium crack lines at impact point */}
      {isShattered && <CrackLines />}
      
      {/* Floating dust particles */}
      {isShattered && <DustParticles />}
    </>
  );
}

// Floating dust particles for atmosphere
function DustParticles() {
  const particlesRef = useRef<THREE.Points>(null);
  const startTimeRef = useRef<number | null>(null);
  
  const { geometry, material } = useMemo(() => {
    const count = 200;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    
    for (let i = 0; i < count; i++) {
      // Start from center
      positions[i * 3] = (Math.random() - 0.5) * 0.5;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
      positions[i * 3 + 2] = Math.random() * 0.5;
      
      // Random velocities
      velocities[i * 3] = (Math.random() - 0.5) * 2;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 2;
      velocities[i * 3 + 2] = Math.random() * 3;
      
      sizes[i] = 0.01 + Math.random() * 0.02;
    }
    
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const mat = new THREE.PointsMaterial({
      size: 0.015,
      color: 0xffffff,
      transparent: true,
      opacity: 0.6,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
    });
    
    return { geometry: geo, material: mat };
  }, []);

  useFrame((state) => {
    if (!particlesRef.current) return;
    
    if (startTimeRef.current === null) {
      startTimeRef.current = state.clock.elapsedTime;
    }
    
    const elapsed = state.clock.elapsedTime - startTimeRef.current;
    const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
    const velocities = particlesRef.current.geometry.attributes.velocity.array as Float32Array;
    
    for (let i = 0; i < positions.length / 3; i++) {
      const decay = Math.exp(-elapsed * 0.3);
      positions[i * 3] += velocities[i * 3] * 0.01 * decay;
      positions[i * 3 + 1] += velocities[i * 3 + 1] * 0.01 * decay;
      positions[i * 3 + 2] += velocities[i * 3 + 2] * 0.015 * decay;
    }
    
    particlesRef.current.geometry.attributes.position.needsUpdate = true;
    
    // Fade out
    if (elapsed > 2) {
      material.opacity = Math.max(0, 0.6 * (1 - (elapsed - 2) / 2));
    }
  });

  return <points ref={particlesRef} geometry={geometry} material={material} />;
}

// Procedural crack lines emanating from center
function CrackLines() {
  const linesRef = useRef<THREE.Group>(null);
  
  const lines = useMemo(() => {
    const result: { angle: number; length: number; branches: { startT: number; angle: number; length: number }[] }[] = [];
    const count = 32;
    
    for (let i = 0; i < count; i++) {
      const baseAngle = (i / count) * Math.PI * 2;
      const angleVariation = (Math.random() - 0.5) * 0.25;
      const angle = baseAngle + angleVariation;
      const length = 4 + Math.random() * 3;
      
      const branches: { startT: number; angle: number; length: number }[] = [];
      const branchCount = Math.floor(Math.random() * 4) + 2;
      for (let b = 0; b < branchCount; b++) {
        branches.push({
          startT: 0.2 + Math.random() * 0.6,
          angle: angle + (Math.random() - 0.5) * 1.4,
          length: 0.3 + Math.random() * 1.8
        });
      }
      
      result.push({ angle, length, branches });
    }
    return result;
  }, []);

  return (
    <group ref={linesRef} position={[0, 0, 0.02]}>
      {lines.map((line, i) => (
        <CrackLine 
          key={i} 
          angle={line.angle} 
          length={line.length} 
          branches={line.branches}
          delay={i * 0.015}
        />
      ))}
    </group>
  );
}

interface CrackLineProps {
  angle: number;
  length: number;
  branches: { startT: number; angle: number; length: number }[];
  delay: number;
}

function CrackLine({ angle, length, branches, delay }: CrackLineProps) {
  const groupRef = useRef<THREE.Group>(null);
  const progressRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const opacityRef = useRef(1);

  const { mainLine, branchLines, material } = useMemo(() => {
    // Main crack line
    const mainPoints: THREE.Vector3[] = [];
    const segments = 25;
    
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = Math.cos(angle) * t * length;
      const y = Math.sin(angle) * t * length;
      const wave = Math.sin(t * 10) * 0.03 * t;
      const perpX = -Math.sin(angle) * wave;
      const perpY = Math.cos(angle) * wave;
      mainPoints.push(new THREE.Vector3(x + perpX, y + perpY, 0));
    }
    
    const mainGeo = new THREE.BufferGeometry().setFromPoints(mainPoints);
    const mainLineObj = new THREE.Line(mainGeo, undefined);
    
    // Branch lines
    const branchLinesArr = branches.map(branch => {
      const branchPoints: THREE.Vector3[] = [];
      const startX = Math.cos(angle) * branch.startT * length;
      const startY = Math.sin(angle) * branch.startT * length;
      const branchSegments = 12;
      
      for (let i = 0; i <= branchSegments; i++) {
        const t = i / branchSegments;
        const x = startX + Math.cos(branch.angle) * t * branch.length;
        const y = startY + Math.sin(branch.angle) * t * branch.length;
        branchPoints.push(new THREE.Vector3(x, y, 0));
      }
      
      const branchGeo = new THREE.BufferGeometry().setFromPoints(branchPoints);
      return new THREE.Line(branchGeo, undefined);
    });

    const mat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      linewidth: 1,
    });

    return { mainLine: mainLineObj, branchLines: branchLinesArr, material: mat };
  }, [angle, length, branches]);

  useFrame((state) => {
    if (startTimeRef.current === null) {
      startTimeRef.current = state.clock.elapsedTime;
    }
    
    const elapsed = state.clock.elapsedTime - startTimeRef.current - delay;
    if (elapsed < 0) return;
    
    progressRef.current = Math.min(1, elapsed * 2.5);
    
    // Animate main line
    const mainDrawRange = Math.floor(progressRef.current * 25);
    mainLine.geometry.setDrawRange(0, mainDrawRange + 1);
    
    // Animate branches
    branchLines.forEach((line, i) => {
      if (progressRef.current > branches[i].startT) {
        const branchProgress = (progressRef.current - branches[i].startT) / (1 - branches[i].startT);
        const drawRange = Math.floor(Math.min(1, branchProgress * 1.5) * 12);
        line.geometry.setDrawRange(0, drawRange + 1);
      }
    });
    
    // Fade out
    const fadeStart = 2;
    if (elapsed > fadeStart) {
      opacityRef.current = Math.max(0, 0.9 * (1 - (elapsed - fadeStart) / 2.5));
      material.opacity = opacityRef.current;
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={mainLine} material={material} />
      {branchLines.map((line, i) => (
        <primitive key={i} object={line} material={material} />
      ))}
    </group>
  );
}
