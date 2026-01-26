import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { cn } from '@/lib/utils';
import universeBackground from '@/assets/universe-background.jpg';
import * as THREE from 'three';


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
