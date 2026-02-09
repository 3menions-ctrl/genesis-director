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
  const edgesRef = useRef<THREE.LineSegments>(null);
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
    
    // Extrude for thickness - thinner for premium feel
    const extrudeSettings = {
      depth: shard.thickness,
      bevelEnabled: true,
      bevelThickness: 0.001,
      bevelSize: 0.001,
      bevelSegments: 2
    };
    
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center();
    
    return geometry;
  }, [shard.vertices, shard.thickness]);

  // Premium glass material with color tinting
  const material = useMemo(() => {
    // Slight purple/blue tint for premium feel
    const tintStrength = shard.size === 'large' ? 0.02 : 0.01;
    const tintHue = shard.id % 2 === 0 ? 0.75 : 0.68; // Purple or blue tint
    
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color().setHSL(tintHue, 0.1, 0.98),
      metalness: 0.0,
      roughness: 0.02,
      transmission: 0.95,
      thickness: 0.3,
      ior: 1.52,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      reflectivity: 1.0,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
      envMapIntensity: 3.0,
      attenuationColor: new THREE.Color().setHSL(tintHue, 0.3, 0.9),
      attenuationDistance: 0.5,
    });
  }, [shard.id, shard.size]);

  // Edge material - glowing edges
  const edgeMaterial = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: new THREE.Color(0xffffff),
      transparent: true,
      opacity: 0.8,
      linewidth: 1,
    });
  }, []);

  const edgesGeometry = useMemo(() => {
    return new THREE.EdgesGeometry(geometry, 20);
  }, [geometry]);

  useFrame((state, delta) => {
    if (!meshRef.current || !edgesRef.current) return;
    
    if (!isShattered) {
      // Reset to initial position
      meshRef.current.position.set(shard.initialPosition.x, shard.initialPosition.y, shard.initialPosition.z);
      meshRef.current.rotation.set(0, 0, shard.initialRotation);
      meshRef.current.scale.setScalar(1);
      edgesRef.current.position.copy(meshRef.current.position);
      edgesRef.current.rotation.copy(meshRef.current.rotation);
      edgesRef.current.scale.copy(meshRef.current.scale);
      material.opacity = 1;
      edgeMaterial.opacity = 0.8;
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

    // Premium easing functions
    const easeOutExpo = (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -12 * t);
    const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5);
    
    // Animation progress (5 seconds for premium slow-mo feel)
    const duration = 5.0;
    progressRef.current = Math.min(1, elapsed / duration);
    const easedProgress = easeOutExpo(progressRef.current);
    const rotationProgress = easeOutQuint(progressRef.current);

    // Physics-based position with natural deceleration
    const t = elapsed;
    const gravity = 0.6;
    
    // Initial velocity from explosion - slower for dramatic effect
    const velocityX = shard.velocity.x * 1.2;
    const velocityY = shard.velocity.y * 1.2 - gravity * t * 0.2;
    const velocityZ = shard.velocity.z * 1.8;
    
    // Exponential deceleration for natural feel
    const decel = Math.exp(-t * 0.4);
    meshRef.current.position.x = shard.initialPosition.x + velocityX * t * decel;
    meshRef.current.position.y = shard.initialPosition.y + velocityY * t * decel - 0.5 * gravity * t * t * 0.08;
    meshRef.current.position.z = shard.initialPosition.z + velocityZ * t * decel;

    // Smooth rotation with natural spin decay
    const spinDecay = Math.exp(-t * 0.3);
    const spinSpeed = shard.spinSpeed * spinDecay;
    meshRef.current.rotation.x = initialRotation.current.x + shard.rotationAxis.x * rotationProgress * spinSpeed;
    meshRef.current.rotation.y = initialRotation.current.y + shard.rotationAxis.y * rotationProgress * spinSpeed;
    meshRef.current.rotation.z = initialRotation.current.z + shard.rotationAxis.z * rotationProgress * spinSpeed;

    // Sync edge lines
    edgesRef.current.position.copy(meshRef.current.position);
    edgesRef.current.rotation.copy(meshRef.current.rotation);
    edgesRef.current.scale.copy(meshRef.current.scale);

    // Elegant fade out
    if (isFading && progressRef.current > 0.4) {
      const fadeProgress = (progressRef.current - 0.4) / 0.6;
      const fadeEased = easeOutQuint(fadeProgress);
      material.opacity = 1 - fadeEased;
      edgeMaterial.opacity = 0.8 * (1 - fadeEased);
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
