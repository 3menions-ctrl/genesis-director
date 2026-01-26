import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { cn } from '@/lib/utils';
import universeBackground from '@/assets/universe-background.jpg';
import * as THREE from 'three';

function BlackHole() {
  const groupRef = useRef<THREE.Group>(null);
  const diskRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.z += delta * 0.05;
    }
    if (diskRef.current) {
      diskRef.current.rotation.z -= delta * 0.15;
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, -50]}>
      {/* Event horizon - the black center */}
      <mesh>
        <sphereGeometry args={[3, 64, 64]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* Inner glow ring */}
      <mesh ref={glowRef} rotation={[Math.PI / 2.5, 0, 0]}>
        <torusGeometry args={[4, 0.3, 32, 100]} />
        <meshBasicMaterial 
          color="#ff6b35" 
          transparent 
          opacity={0.8}
        />
      </mesh>

      {/* Accretion disk - outer */}
      <mesh ref={diskRef} rotation={[Math.PI / 2.5, 0, 0]}>
        <ringGeometry args={[3.5, 12, 128]} />
        <meshBasicMaterial 
          color="#ff4500" 
          transparent 
          opacity={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Secondary accretion ring */}
      <mesh rotation={[Math.PI / 2.3, 0.1, 0]}>
        <ringGeometry args={[4, 8, 128]} />
        <meshBasicMaterial 
          color="#ff8c00" 
          transparent 
          opacity={0.25}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Outer glow */}
      <mesh rotation={[Math.PI / 2.5, 0, 0]}>
        <ringGeometry args={[3.2, 18, 128]} />
        <meshBasicMaterial 
          color="#8B5CF6" 
          transparent 
          opacity={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Gravitational lensing effect - distortion ring */}
      <mesh>
        <torusGeometry args={[5, 0.1, 16, 100]} />
        <meshBasicMaterial 
          color="#ffffff" 
          transparent 
          opacity={0.1}
        />
      </mesh>
    </group>
  );
}

function StarField() {
  const starsRef = useRef<THREE.Points>(null);
  
  const starPositions = new Float32Array(3000);
  for (let i = 0; i < 3000; i += 3) {
    starPositions[i] = (Math.random() - 0.5) * 200;
    starPositions[i + 1] = (Math.random() - 0.5) * 200;
    starPositions[i + 2] = (Math.random() - 0.5) * 100 - 30;
  }

  useFrame((_, delta) => {
    if (starsRef.current) {
      starsRef.current.rotation.z += delta * 0.002;
    }
  });

  return (
    <points ref={starsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={1000}
          array={starPositions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial 
        size={0.15} 
        color="#ffffff" 
        transparent 
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.1} />
      <StarField />
      <BlackHole />
    </>
  );
}

interface AbstractBackgroundProps {
  className?: string;
}

export default function AbstractBackground({ className }: AbstractBackgroundProps) {
  return (
    <div className={cn("absolute inset-0", className)}>
      {/* Deep space background image */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-15"
        style={{ backgroundImage: `url(${universeBackground})` }}
      />
      
      {/* Dark overlay for depth */}
      <div className="absolute inset-0 bg-black/80" />
      
      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 0, 20], fov: 60, near: 0.1, far: 200 }}
        style={{ position: 'absolute', inset: 0 }}
        dpr={[1, 2]}
      >
        <Scene />
      </Canvas>

      {/* Vignette */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.7) 100%)',
        }}
      />
    </div>
  );
}
