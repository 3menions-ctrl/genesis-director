import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { CatmullRomCurve3, Vector3, TubeGeometry, MeshBasicMaterial } from 'three';
import { cn } from '@/lib/utils';

interface FlowingLineProps {
  points: Vector3[];
  color: string;
  speed: number;
  radius: number;
  delay: number;
}

function FlowingLine({ points, color, speed, radius, delay }: FlowingLineProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const timeRef = useRef(delay);

  const curve = useMemo(() => new CatmullRomCurve3(points), [points]);
  
  const geometry = useMemo(() => {
    return new TubeGeometry(curve, 100, radius, 16, false);
  }, [curve, radius]);

  useFrame((_, delta) => {
    timeRef.current += delta * speed;
    
    if (materialRef.current) {
      // Pulsing opacity effect
      const pulse = Math.sin(timeRef.current) * 0.3 + 0.7;
      materialRef.current.opacity = pulse;
    }

    if (meshRef.current) {
      // Subtle floating motion
      meshRef.current.position.y = Math.sin(timeRef.current * 0.5) * 0.3;
      meshRef.current.position.z = Math.cos(timeRef.current * 0.3) * 0.2;
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshBasicMaterial
        ref={materialRef}
        color={color}
        transparent
        opacity={0.8}
      />
    </mesh>
  );
}

function GlowLine({ points, color, speed, radius, delay }: FlowingLineProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(delay);

  const curve = useMemo(() => new CatmullRomCurve3(points), [points]);
  
  const geometry = useMemo(() => {
    return new TubeGeometry(curve, 100, radius * 2.5, 16, false);
  }, [curve, radius]);

  useFrame((_, delta) => {
    timeRef.current += delta * speed;
    
    if (meshRef.current) {
      meshRef.current.position.y = Math.sin(timeRef.current * 0.5) * 0.3;
      meshRef.current.position.z = Math.cos(timeRef.current * 0.3) * 0.2;
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.15}
      />
    </mesh>
  );
}

function Scene() {
  // Define 3D curved paths - roller coaster style with depth
  const lines = useMemo(() => [
    {
      points: [
        new Vector3(-15, 3, -5),
        new Vector3(-8, -2, 2),
        new Vector3(-2, 4, -3),
        new Vector3(5, -1, 4),
        new Vector3(10, 3, -2),
        new Vector3(15, -2, 1),
      ],
      color: '#8B5CF6', // Purple
      speed: 0.4,
      radius: 0.08,
      delay: 0,
    },
    {
      points: [
        new Vector3(-15, -1, 3),
        new Vector3(-7, 3, -4),
        new Vector3(0, -3, 5),
        new Vector3(7, 2, -2),
        new Vector3(12, -2, 3),
        new Vector3(18, 1, -1),
      ],
      color: '#EC4899', // Pink
      speed: 0.35,
      radius: 0.06,
      delay: 2,
    },
    {
      points: [
        new Vector3(-18, 0, -2),
        new Vector3(-10, -3, 4),
        new Vector3(-3, 2, -5),
        new Vector3(4, -2, 3),
        new Vector3(11, 1, -4),
        new Vector3(16, -1, 2),
      ],
      color: '#3B82F6', // Blue
      speed: 0.45,
      radius: 0.07,
      delay: 4,
    },
  ], []);

  return (
    <>
      {/* Ambient lighting */}
      <ambientLight intensity={0.5} />
      
      {/* Camera positioned for depth perspective */}
      
      {/* Render glow layers first (behind) */}
      {lines.map((line, i) => (
        <GlowLine key={`glow-${i}`} {...line} />
      ))}
      
      {/* Render main lines */}
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
      {/* Deep black base */}
      <div className="absolute inset-0 bg-black" />
      
      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 0, 10], fov: 60 }}
        style={{ position: 'absolute', inset: 0 }}
        dpr={[1, 2]}
      >
        <Scene />
      </Canvas>

      {/* Vignette overlay */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.6) 100%)',
        }}
      />
    </div>
  );
}
