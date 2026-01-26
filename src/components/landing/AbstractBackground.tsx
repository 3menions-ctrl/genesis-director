import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { CatmullRomCurve3, Vector3, TubeGeometry } from 'three';
import { cn } from '@/lib/utils';
import universeBackground from '@/assets/universe-background.jpg';

interface FlowingLineProps {
  points: Vector3[];
  color: string;
  speed: number;
  radius: number;
  delay: number;
}

function FlowingLine({ points, color, speed, radius, delay }: FlowingLineProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const timeRef = useRef(delay);

  const curve = useMemo(() => new CatmullRomCurve3(points), [points]);
  
  const geometry = useMemo(() => {
    return new TubeGeometry(curve, 120, radius, 24, false);
  }, [curve, radius]);

  useFrame((_, delta) => {
    timeRef.current += delta * speed;
    
    if (materialRef.current) {
      const pulse = Math.sin(timeRef.current) * 0.2 + 0.8;
      materialRef.current.opacity = pulse;
      materialRef.current.emissiveIntensity = pulse * 2;
    }

    if (meshRef.current) {
      meshRef.current.position.y = Math.sin(timeRef.current * 0.4) * 0.5;
      meshRef.current.position.z = Math.cos(timeRef.current * 0.25) * 1;
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial
        ref={materialRef}
        color={color}
        emissive={color}
        emissiveIntensity={1.5}
        transparent
        opacity={0.9}
        roughness={0.2}
        metalness={0.8}
      />
    </mesh>
  );
}

function GlowLine({ points, color, radius }: { points: Vector3[]; color: string; radius: number }) {
  const curve = useMemo(() => new CatmullRomCurve3(points), [points]);
  const geometry = useMemo(() => new TubeGeometry(curve, 120, radius * 4, 16, false), [curve, radius]);

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial color={color} transparent opacity={0.08} />
    </mesh>
  );
}

function CameraRig() {
  useFrame(({ camera, clock }) => {
    const t = clock.getElapsedTime() * 0.1;
    camera.position.x = Math.sin(t) * 2;
    camera.position.y = Math.cos(t * 0.5) * 1;
    camera.lookAt(0, 0, -10);
  });
  return null;
}

function Scene() {
  const lines = useMemo(() => [
    // Far background lines (z: -30 to -20)
    {
      points: [
        new Vector3(-25, 8, -30),
        new Vector3(-15, -5, -25),
        new Vector3(-5, 10, -28),
        new Vector3(8, -3, -22),
        new Vector3(18, 6, -26),
        new Vector3(28, -4, -24),
      ],
      color: '#6366F1',
      speed: 0.25,
      radius: 0.15,
      delay: 0,
    },
    {
      points: [
        new Vector3(-28, -6, -28),
        new Vector3(-12, 8, -24),
        new Vector3(2, -8, -30),
        new Vector3(14, 5, -22),
        new Vector3(24, -6, -26),
      ],
      color: '#8B5CF6',
      speed: 0.2,
      radius: 0.12,
      delay: 1,
    },
    
    // Mid-ground lines
    {
      points: [
        new Vector3(-22, 4, -15),
        new Vector3(-10, -6, -10),
        new Vector3(0, 8, -14),
        new Vector3(12, -4, -8),
        new Vector3(22, 5, -12),
      ],
      color: '#EC4899',
      speed: 0.35,
      radius: 0.1,
      delay: 2,
    },
    {
      points: [
        new Vector3(-20, -5, -12),
        new Vector3(-8, 7, -9),
        new Vector3(5, -6, -14),
        new Vector3(15, 4, -10),
        new Vector3(25, -3, -11),
      ],
      color: '#F43F5E',
      speed: 0.3,
      radius: 0.08,
      delay: 3,
    },
    
    // Foreground lines
    {
      points: [
        new Vector3(-18, 2, -5),
        new Vector3(-6, -4, 0),
        new Vector3(4, 5, -3),
        new Vector3(14, -2, 2),
        new Vector3(22, 3, -1),
      ],
      color: '#3B82F6',
      speed: 0.45,
      radius: 0.06,
      delay: 4,
    },
    {
      points: [
        new Vector3(-16, -3, -2),
        new Vector3(-4, 5, 1),
        new Vector3(8, -4, -4),
        new Vector3(18, 2, 0),
      ],
      color: '#22D3EE',
      speed: 0.5,
      radius: 0.05,
      delay: 5,
    },
  ], []);

  return (
    <>
      <CameraRig />
      
      <fog attach="fog" args={['#000000', 5, 40]} />
      
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={1} color="#8B5CF6" />
      <pointLight position={[-10, -10, -10]} intensity={0.8} color="#EC4899" />
      <pointLight position={[0, 0, 5]} intensity={0.5} color="#3B82F6" />
      
      {lines.map((line, i) => (
        <GlowLine key={`glow-${i}`} points={line.points} color={line.color} radius={line.radius} />
      ))}
      
      {lines.map((line, i) => (
        <FlowingLine key={`line-${i}`} {...line} />
      ))}
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
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{ backgroundImage: `url(${universeBackground})` }}
      />
      
      {/* Dark overlay for depth */}
      <div className="absolute inset-0 bg-black/70" />
      
      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 0, 8], fov: 75, near: 0.1, far: 100 }}
        style={{ position: 'absolute', inset: 0 }}
        dpr={[1, 2]}
      >
        <Scene />
      </Canvas>

      {/* Vignette */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.6) 100%)',
        }}
      />
    </div>
  );
}
