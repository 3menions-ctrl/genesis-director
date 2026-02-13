import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ShardData } from './shardGenerator';

interface GlassShardProps {
  shard: ShardData;
  isShattered: boolean;
  isFading: boolean;
}

// Realistic colored glass palette - each shard gets a unique tint
const GLASS_COLORS = [
  { hue: 0.55, sat: 0.35, light: 0.75, name: 'teal' },      // Teal glass
  { hue: 0.60, sat: 0.30, light: 0.80, name: 'cyan' },       // Cyan glass
  { hue: 0.72, sat: 0.40, light: 0.70, name: 'blue' },       // Deep blue glass
  { hue: 0.78, sat: 0.35, light: 0.75, name: 'indigo' },     // Indigo glass
  { hue: 0.85, sat: 0.30, light: 0.80, name: 'violet' },     // Violet glass
  { hue: 0.10, sat: 0.45, light: 0.85, name: 'amber' },      // Amber glass
  { hue: 0.95, sat: 0.25, light: 0.85, name: 'rose' },       // Rose glass
  { hue: 0.35, sat: 0.30, light: 0.80, name: 'emerald' },    // Emerald glass
  { hue: 0.00, sat: 0.00, light: 0.95, name: 'clear' },      // Clear glass (slight white)
  { hue: 0.15, sat: 0.50, light: 0.80, name: 'gold' },       // Gold glass
];

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
    
    const extrudeSettings = {
      depth: shard.thickness,
      bevelEnabled: false,
    };
    
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.center();
    
    return geo;
  }, [shard.vertices, shard.thickness]);

  // Realistic colored glass material
  const material = useMemo(() => {
    const colorData = GLASS_COLORS[shard.id % GLASS_COLORS.length];
    
    // Vary saturation and lightness slightly per shard for organic feel
    const satVariation = (shard.id % 7) * 0.03;
    const lightVariation = (shard.id % 5) * 0.02;
    
    const baseColor = new THREE.Color().setHSL(
      colorData.hue,
      Math.min(1, colorData.sat + satVariation),
      Math.min(1, colorData.light + lightVariation)
    );
    
    const attenuationColor = new THREE.Color().setHSL(
      colorData.hue,
      Math.min(1, colorData.sat + 0.15),
      Math.max(0.4, colorData.light - 0.2)
    );

    return new THREE.MeshPhysicalMaterial({
      color: baseColor,
      metalness: 0.0,
      roughness: 0.02,
      transmission: 0.88,
      thickness: 0.5,
      ior: 1.52,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
      envMapIntensity: 4.0,
      specularIntensity: 1.5,
      specularColor: new THREE.Color().setHSL(colorData.hue, 0.3, 1.0),
      sheen: 0.15,
      sheenRoughness: 0.25,
      sheenColor: baseColor.clone().multiplyScalar(1.2),
      attenuationColor: attenuationColor,
      attenuationDistance: 0.6,
    });
  }, [shard.id]);

  // Edge material with subtle color tint
  const edgeMaterial = useMemo(() => {
    const colorData = GLASS_COLORS[shard.id % GLASS_COLORS.length];
    const edgeColor = new THREE.Color().setHSL(colorData.hue, colorData.sat * 0.5, 0.9);
    
    return new THREE.LineBasicMaterial({
      color: edgeColor,
      transparent: true,
      opacity: 0.5,
    });
  }, [shard.id]);

  const edgesGeometry = useMemo(() => {
    return new THREE.EdgesGeometry(geometry, 20);
  }, [geometry]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
      edgeMaterial.dispose();
      edgesGeometry.dispose();
    };
  }, [geometry, material, edgeMaterial, edgesGeometry]);

  useFrame((state) => {
    if (!meshRef.current || !edgesRef.current) return;
    
    if (!isShattered) {
      meshRef.current.position.set(shard.initialPosition.x, shard.initialPosition.y, shard.initialPosition.z);
      meshRef.current.rotation.set(0, 0, shard.initialRotation);
      meshRef.current.scale.setScalar(1);
      edgesRef.current.position.copy(meshRef.current.position);
      edgesRef.current.rotation.copy(meshRef.current.rotation);
      edgesRef.current.scale.copy(meshRef.current.scale);
      material.opacity = 1;
      edgeMaterial.opacity = 0.5;
      progressRef.current = 0;
      startTimeRef.current = null;
      return;
    }

    if (startTimeRef.current === null) {
      startTimeRef.current = state.clock.elapsedTime;
      initialRotation.current.copy(meshRef.current.rotation);
    }

    const elapsed = state.clock.elapsedTime - startTimeRef.current - shard.delay;
    if (elapsed < 0) return;

    // Much slower, more cinematic easing
    const easeOutExpo = (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -8 * t);
    const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);
    
    // Significantly longer duration for slow-motion feel
    const duration = 12.0;
    progressRef.current = Math.min(1, elapsed / duration);
    const rotationProgress = easeOutQuart(progressRef.current);

    const t = elapsed;
    const gravity = 0.4; // Much lighter gravity for floaty slow-motion
    
    // Slower, more graceful movement
    const velocityX = shard.velocity.x * 0.6;
    const velocityY = shard.velocity.y * 0.6 - gravity * t * 0.15;
    const velocityZ = shard.velocity.z * 0.8;
    
    // Gentler deceleration for longer, more visible trajectories
    const decel = Math.exp(-t * 0.18);
    meshRef.current.position.x = shard.initialPosition.x + velocityX * t * decel;
    meshRef.current.position.y = shard.initialPosition.y + velocityY * t * decel - 0.5 * gravity * t * t * 0.04;
    meshRef.current.position.z = shard.initialPosition.z + velocityZ * t * decel;

    // Slower, more elegant rotation
    const spinDecay = Math.exp(-t * 0.12);
    const spinSpeed = shard.spinSpeed * 0.4 * spinDecay;
    meshRef.current.rotation.x = initialRotation.current.x + shard.rotationAxis.x * rotationProgress * spinSpeed;
    meshRef.current.rotation.y = initialRotation.current.y + shard.rotationAxis.y * rotationProgress * spinSpeed;
    meshRef.current.rotation.z = initialRotation.current.z + shard.rotationAxis.z * rotationProgress * spinSpeed;

    edgesRef.current.position.copy(meshRef.current.position);
    edgesRef.current.rotation.copy(meshRef.current.rotation);
    edgesRef.current.scale.copy(meshRef.current.scale);

    // Slower fade out
    if (isFading && progressRef.current > 0.5) {
      const fadeProgress = (progressRef.current - 0.5) / 0.5;
      const fadeEased = easeOutQuart(fadeProgress);
      material.opacity = 1 - fadeEased;
      edgeMaterial.opacity = 0.5 * (1 - fadeEased);
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