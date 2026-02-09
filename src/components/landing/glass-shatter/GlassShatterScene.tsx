import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
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
  
  // Generate shard data once
  const shards = useMemo(() => generateShardData(85), []);
  
  // Subtle scene rotation for depth
  useFrame((_, delta) => {
    if (groupRef.current && isShattered) {
      timeRef.current += delta;
      groupRef.current.rotation.y = Math.sin(timeRef.current * 0.1) * 0.02;
      groupRef.current.rotation.x = Math.cos(timeRef.current * 0.08) * 0.01;
    }
  });

  return (
    <>
      {/* Dramatic lighting setup */}
      <ambientLight intensity={0.15} />
      
      {/* Key light - bright white from front-top */}
      <spotLight
        position={[0, 5, 8]}
        intensity={3}
        angle={0.6}
        penumbra={0.5}
        color="#ffffff"
        castShadow
      />
      
      {/* Fill light - softer from left */}
      <pointLight position={[-8, 2, 4]} intensity={1.5} color="#e0e8ff" />
      
      {/* Rim light - dramatic backlight */}
      <pointLight position={[5, -3, -5]} intensity={2} color="#ffffff" />
      
      {/* Impact point glow */}
      <pointLight 
        position={[0, 0, 0.5]} 
        intensity={isShattered ? 8 : 0} 
        color="#ffffff" 
        distance={4}
        decay={2}
      />

      {/* Environment for realistic reflections */}
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

      {/* Crack lines at impact point */}
      {isShattered && <CrackLines />}
    </>
  );
}

// Procedural crack lines emanating from center
function CrackLines() {
  const linesRef = useRef<THREE.Group>(null);
  const progressRef = useRef(0);
  
  const lines = useMemo(() => {
    const result: { angle: number; length: number; branches: { startT: number; angle: number; length: number }[] }[] = [];
    const count = 24;
    
    for (let i = 0; i < count; i++) {
      const baseAngle = (i / count) * Math.PI * 2;
      const angleVariation = (Math.random() - 0.5) * 0.3;
      const angle = baseAngle + angleVariation;
      const length = 3 + Math.random() * 2;
      
      // Add branches
      const branches: { startT: number; angle: number; length: number }[] = [];
      const branchCount = Math.floor(Math.random() * 3) + 1;
      for (let b = 0; b < branchCount; b++) {
        branches.push({
          startT: 0.3 + Math.random() * 0.5,
          angle: angle + (Math.random() - 0.5) * 1.2,
          length: 0.5 + Math.random() * 1.5
        });
      }
      
      result.push({ angle, length, branches });
    }
    return result;
  }, []);

  useFrame((_, delta) => {
    if (progressRef.current < 1) {
      progressRef.current = Math.min(1, progressRef.current + delta * 2);
    }
  });

  return (
    <group ref={linesRef} position={[0, 0, 0.01]}>
      {lines.map((line, i) => (
        <CrackLine 
          key={i} 
          angle={line.angle} 
          length={line.length} 
          branches={line.branches}
          delay={i * 0.02}
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
  const lineRef = useRef<THREE.Line>(null!);
  const branchRefs = useRef<THREE.Line[]>([]);
  const progressRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);

  const mainGeometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const segments = 20;
    
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = Math.cos(angle) * t * length;
      const y = Math.sin(angle) * t * length;
      // Add slight waviness
      const wave = Math.sin(t * 8) * 0.02 * t;
      const perpX = -Math.sin(angle) * wave;
      const perpY = Math.cos(angle) * wave;
      points.push(new THREE.Vector3(x + perpX, y + perpY, 0));
    }
    
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [angle, length]);

  const branchGeometries = useMemo(() => {
    return branches.map(branch => {
      const points: THREE.Vector3[] = [];
      const startX = Math.cos(angle) * branch.startT * length;
      const startY = Math.sin(angle) * branch.startT * length;
      const segments = 10;
      
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const x = startX + Math.cos(branch.angle) * t * branch.length;
        const y = startY + Math.sin(branch.angle) * t * branch.length;
        points.push(new THREE.Vector3(x, y, 0));
      }
      
      return new THREE.BufferGeometry().setFromPoints(points);
    });
  }, [angle, length, branches]);

  const material = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
      linewidth: 1,
    });
  }, []);

  useFrame((state) => {
    if (startTimeRef.current === null) {
      startTimeRef.current = state.clock.elapsedTime;
    }
    
    const elapsed = state.clock.elapsedTime - startTimeRef.current - delay;
    if (elapsed < 0) return;
    
    progressRef.current = Math.min(1, elapsed * 3);
    
    // Animate main line
    if (lineRef.current) {
      const geo = lineRef.current.geometry;
      const drawRange = Math.floor(progressRef.current * 20);
      geo.setDrawRange(0, drawRange + 1);
      
      // Fade out over time
      const fadeStart = 1.5;
      if (elapsed > fadeStart) {
        const fadeProgress = Math.min(1, (elapsed - fadeStart) / 2);
        material.opacity = 0.8 * (1 - fadeProgress);
      }
    }
    
    // Animate branches with delay
    branchRefs.current.forEach((ref, i) => {
      if (ref && progressRef.current > branches[i].startT) {
        const branchProgress = (progressRef.current - branches[i].startT) / (1 - branches[i].startT);
        const drawRange = Math.floor(Math.min(1, branchProgress * 1.5) * 10);
        ref.geometry.setDrawRange(0, drawRange + 1);
      }
    });
  });

  return (
    <group>
      <primitive object={new THREE.Line(mainGeometry, material)} ref={lineRef} />
      {branchGeometries.map((geo, i) => (
        <primitive 
          key={i} 
          object={new THREE.Line(geo, material)}
          ref={(el: THREE.Line) => { if (el) branchRefs.current[i] = el; }}
        />
      ))}
    </group>
  );
}
