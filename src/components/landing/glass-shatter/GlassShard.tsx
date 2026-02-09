import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ShardData } from './shardGenerator';

interface GlassShardProps {
  shard: ShardData;
  isShattered: boolean;
  isFading: boolean;
}

export function GlassShard({ shard, isShattered, isFading }: GlassShardProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const progressRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const initialRotation = useRef(new THREE.Euler(0, 0, 0));
  
  // Create irregular polygon geometry for shard
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    const vertices = shard.vertices;
    
    if (vertices.length < 3) return new THREE.BufferGeometry();
    
    shape.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < vertices.length; i++) {
      shape.lineTo(vertices[i].x, vertices[i].y);
    }
    shape.closePath();
    
    // Extrude for thickness
    const extrudeSettings = {
      depth: shard.thickness,
      bevelEnabled: true,
      bevelThickness: 0.002,
      bevelSize: 0.002,
      bevelSegments: 1
    };
    
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center();
    
    return geometry;
  }, [shard.vertices, shard.thickness]);

  // Glass material with realistic properties
  const material = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xffffff),
      metalness: 0.0,
      roughness: 0.05,
      transmission: 0.92,
      thickness: 0.5,
      ior: 1.5, // Index of refraction for glass
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      reflectivity: 1.0,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
      envMapIntensity: 2.0,
    });
  }, []);

  // Edge highlight material
  const edgeMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xffffff),
      transparent: true,
      opacity: 0.6,
    });
  }, []);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    if (!isShattered) {
      // Reset to initial position
      meshRef.current.position.set(shard.initialPosition.x, shard.initialPosition.y, shard.initialPosition.z);
      meshRef.current.rotation.set(0, 0, shard.initialRotation);
      meshRef.current.scale.setScalar(1);
      material.opacity = 1;
      progressRef.current = 0;
      startTimeRef.current = null;
      return;
    }

    // Initialize start time
    if (startTimeRef.current === null) {
      startTimeRef.current = state.clock.elapsedTime;
      initialRotation.current.copy(meshRef.current.rotation);
    }

    const elapsed = state.clock.elapsedTime - startTimeRef.current - shard.delay;
    if (elapsed < 0) return;

    // Easing function for natural motion
    const easeOutExpo = (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);
    
    // Animation progress (slower = 4 seconds total)
    const duration = 4.0;
    progressRef.current = Math.min(1, elapsed / duration);
    const easedProgress = easeOutExpo(progressRef.current);
    const rotationProgress = easeOutQuart(progressRef.current);

    // Physics-based position update
    const gravity = 0.8;
    const t = elapsed;
    
    // Initial velocity from explosion
    const velocityX = shard.velocity.x * 1.5;
    const velocityY = shard.velocity.y * 1.5 - gravity * t * 0.3; // Add gravity
    const velocityZ = shard.velocity.z * 2;
    
    // Position with deceleration
    const decel = Math.exp(-t * 0.5);
    meshRef.current.position.x = shard.initialPosition.x + velocityX * t * decel;
    meshRef.current.position.y = shard.initialPosition.y + velocityY * t * decel - 0.5 * gravity * t * t * 0.1;
    meshRef.current.position.z = shard.initialPosition.z + velocityZ * t * decel;

    // Rotation with spin
    const spinSpeed = shard.spinSpeed;
    meshRef.current.rotation.x = initialRotation.current.x + shard.rotationAxis.x * rotationProgress * spinSpeed;
    meshRef.current.rotation.y = initialRotation.current.y + shard.rotationAxis.y * rotationProgress * spinSpeed;
    meshRef.current.rotation.z = initialRotation.current.z + shard.rotationAxis.z * rotationProgress * spinSpeed;

    // Scale down slightly as shards fly away
    const scaleDown = 1 - progressRef.current * 0.2;
    meshRef.current.scale.setScalar(scaleDown);

    // Fade out in hold phase
    if (isFading && progressRef.current > 0.5) {
      const fadeProgress = (progressRef.current - 0.5) / 0.5;
      material.opacity = 1 - fadeProgress;
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
      {/* Edge highlight for glass edge effect */}
      <lineSegments
        geometry={new THREE.EdgesGeometry(geometry, 30)}
        material={edgeMaterial}
        position={[shard.initialPosition.x, shard.initialPosition.y, shard.initialPosition.z]}
        rotation={[0, 0, shard.initialRotation]}
      />
    </group>
  );
}
