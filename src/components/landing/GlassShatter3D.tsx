import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, MeshTransmissionMaterial } from '@react-three/drei';
import * as THREE from 'three';

interface GlassShatter3DProps {
  isShattered: boolean;
  intensity: number; // 0 = intact, 1 = fully shattered
}

// Generate Voronoi-like shard geometry for realistic glass fracture
function generateShardGeometries(count: number = 25) {
  const shards: {
    geometry: THREE.BufferGeometry;
    position: THREE.Vector3;
    rotation: THREE.Euler;
    velocity: THREE.Vector3;
    angularVelocity: THREE.Vector3;
  }[] = [];

  // Create center point and generate Voronoi-like cells
  const points: THREE.Vector2[] = [];
  
  // Add points in a circular pattern with some randomness
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
    const radius = 0.3 + Math.random() * 1.7;
    points.push(new THREE.Vector2(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius
    ));
  }

  // Create shard geometries
  for (let i = 0; i < count; i++) {
    const center = points[i];
    
    // Create irregular polygon for each shard
    const shape = new THREE.Shape();
    const numVertices = 4 + Math.floor(Math.random() * 3);
    const shardSize = 0.15 + Math.random() * 0.25;
    
    for (let j = 0; j < numVertices; j++) {
      const angle = (j / numVertices) * Math.PI * 2;
      const r = shardSize * (0.7 + Math.random() * 0.6);
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      
      if (j === 0) {
        shape.moveTo(x, y);
      } else {
        shape.lineTo(x, y);
      }
    }
    shape.closePath();

    const extrudeSettings = {
      depth: 0.02 + Math.random() * 0.02,
      bevelEnabled: true,
      bevelThickness: 0.005,
      bevelSize: 0.005,
      bevelSegments: 1,
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center();

    // Calculate explosion direction (away from center)
    const dir = new THREE.Vector3(center.x, center.y, 0).normalize();
    const explosionForce = 2 + Math.random() * 3;
    
    shards.push({
      geometry,
      position: new THREE.Vector3(center.x, center.y, 0),
      rotation: new THREE.Euler(
        (Math.random() - 0.5) * 0.1,
        (Math.random() - 0.5) * 0.1,
        Math.random() * Math.PI * 2
      ),
      velocity: new THREE.Vector3(
        dir.x * explosionForce + (Math.random() - 0.5) * 0.5,
        dir.y * explosionForce + (Math.random() - 0.5) * 0.5,
        (0.5 + Math.random()) * 2 // Forward explosion
      ),
      angularVelocity: new THREE.Vector3(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10
      ),
    });
  }

  return shards;
}

// Individual glass shard component
function GlassShard({ 
  geometry, 
  initialPosition, 
  initialRotation,
  velocity,
  angularVelocity,
  isShattered,
  delay 
}: {
  geometry: THREE.BufferGeometry;
  initialPosition: THREE.Vector3;
  initialRotation: THREE.Euler;
  velocity: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  isShattered: boolean;
  delay: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);
  const startedRef = useRef(false);

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    if (isShattered) {
      if (!startedRef.current) {
        timeRef.current += delta;
        if (timeRef.current > delay) {
          startedRef.current = true;
          timeRef.current = 0;
        }
        return;
      }

      timeRef.current += delta;
      const t = timeRef.current;
      const gravity = -9.8;
      
      // Physics simulation
      meshRef.current.position.x = initialPosition.x + velocity.x * t;
      meshRef.current.position.y = initialPosition.y + velocity.y * t + 0.5 * gravity * t * t * 0.3;
      meshRef.current.position.z = initialPosition.z + velocity.z * t;

      meshRef.current.rotation.x = initialRotation.x + angularVelocity.x * t;
      meshRef.current.rotation.y = initialRotation.y + angularVelocity.y * t;
      meshRef.current.rotation.z = initialRotation.z + angularVelocity.z * t;

      // Fade out over time
      const material = meshRef.current.material as THREE.MeshPhysicalMaterial;
      if (material.opacity !== undefined) {
        material.opacity = Math.max(0, 1 - t * 0.3);
      }
    } else {
      // Reset to initial state
      meshRef.current.position.copy(initialPosition);
      meshRef.current.rotation.copy(initialRotation);
      timeRef.current = 0;
      startedRef.current = false;
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry} position={initialPosition} rotation={initialRotation}>
      <MeshTransmissionMaterial
        backside
        samples={4}
        thickness={0.02}
        chromaticAberration={0.02}
        anisotropicBlur={0.1}
        distortion={0.1}
        distortionScale={0.2}
        temporalDistortion={0}
        iridescence={0.3}
        iridescenceIOR={1.5}
        transparent
        opacity={1}
        color="#ffffff"
        transmission={0.95}
        roughness={0.05}
        ior={1.5}
      />
    </mesh>
  );
}

// Impact point with cracks emanating
function ImpactCracks({ isShattered }: { isShattered: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const crackLines = useMemo(() => {
    const lines: { start: THREE.Vector3; end: THREE.Vector3; width: number }[] = [];
    const numCracks = 16;
    
    for (let i = 0; i < numCracks; i++) {
      const angle = (i / numCracks) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
      const length = 0.8 + Math.random() * 1.5;
      lines.push({
        start: new THREE.Vector3(0, 0, 0.01),
        end: new THREE.Vector3(
          Math.cos(angle) * length,
          Math.sin(angle) * length,
          0.01
        ),
        width: 0.005 + Math.random() * 0.01,
      });
    }
    return lines;
  }, []);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.visible = isShattered;
    }
  });

  return (
    <group ref={groupRef}>
      {crackLines.map((crack, i) => {
        const points = [crack.start, crack.end];
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const lineMaterial = new THREE.LineBasicMaterial({ 
          color: '#ffffff', 
          transparent: true, 
          opacity: 0.6 
        });
        
        return (
          <primitive key={i} object={new THREE.Line(lineGeometry, lineMaterial)} />
        );
      })}
      
      {/* Impact point glow */}
      <mesh position={[0, 0, 0.02]}>
        <circleGeometry args={[0.1, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

// Main glass pane that shatters
function GlassPane({ isShattered, intensity }: GlassShatter3DProps) {
  const shards = useMemo(() => generateShardGeometries(30), []);
  const intactGlassRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (intactGlassRef.current) {
      intactGlassRef.current.visible = !isShattered;
    }
  });

  return (
    <group>
      {/* Intact glass pane - visible before shatter */}
      <mesh ref={intactGlassRef} position={[0, 0, 0]}>
        <planeGeometry args={[4, 4]} />
        <MeshTransmissionMaterial
          backside
          samples={8}
          thickness={0.05}
          chromaticAberration={0.03}
          anisotropicBlur={0.1}
          distortion={0.05}
          distortionScale={0.1}
          temporalDistortion={0}
          transparent
          opacity={0.3}
          color="#a0a0ff"
          transmission={0.98}
          roughness={0.02}
          ior={1.5}
        />
      </mesh>

      {/* Shattered pieces */}
      {shards.map((shard, i) => (
        <GlassShard
          key={i}
          geometry={shard.geometry}
          initialPosition={shard.position}
          initialRotation={shard.rotation}
          velocity={shard.velocity}
          angularVelocity={shard.angularVelocity}
          isShattered={isShattered}
          delay={i * 0.01}
        />
      ))}

      {/* Impact cracks overlay */}
      <ImpactCracks isShattered={isShattered} />
    </group>
  );
}

// Scene with lighting and environment
function Scene({ isShattered, intensity }: GlassShatter3DProps) {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
      <directionalLight position={[-5, -5, 5]} intensity={0.5} color="#a0a0ff" />
      <pointLight position={[0, 0, 3]} intensity={0.5} color="#ffffff" />
      
      {/* Environment for reflections */}
      <Environment preset="night" />
      
      {/* Glass pane */}
      <GlassPane isShattered={isShattered} intensity={intensity} />
    </>
  );
}

// Main exported component
export function GlassShatter3D({ isShattered, intensity }: GlassShatter3DProps) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <Canvas
        camera={{ position: [0, 0, 4], fov: 50 }}
        gl={{ 
          antialias: true, 
          alpha: true,
          powerPreference: "high-performance"
        }}
        style={{ background: 'transparent' }}
      >
        <Scene isShattered={isShattered} intensity={intensity} />
      </Canvas>
    </div>
  );
}

export default GlassShatter3D;
