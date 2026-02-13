import * as THREE from 'three';

export interface ShardData {
  id: number;
  vertices: { x: number; y: number }[];
  thickness: number;
  initialPosition: THREE.Vector3;
  initialRotation: number;
  velocity: THREE.Vector3;
  rotationAxis: THREE.Vector3;
  spinSpeed: number;
  delay: number;
  size: 'large' | 'medium' | 'small' | 'tiny';
}

// Seeded random for deterministic generation
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Generate irregular polygon vertices - more organic shapes
function generatePolygonVertices(
  seed: number, 
  baseSize: number, 
  irregularity: number = 0.5
): { x: number; y: number }[] {
  const sides = Math.floor(seededRandom(seed * 1.1) * 4) + 3; // 3-6 sides
  const vertices: { x: number; y: number }[] = [];
  
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2;
    const radiusVariation = 1 - irregularity + seededRandom(seed * (i + 2)) * irregularity * 2;
    const radius = baseSize * radiusVariation;
    
    // Organic angle variation
    const angleVariation = (seededRandom(seed * (i + 10)) - 0.5) * 0.5;
    const finalAngle = angle + angleVariation;
    
    vertices.push({
      x: Math.cos(finalAngle) * radius,
      y: Math.sin(finalAngle) * radius
    });
  }
  
  return vertices;
}

// Calculate velocity based on position - more dramatic explosion
function calculateVelocity(
  position: THREE.Vector3, 
  seed: number,
  zone: string
): THREE.Vector3 {
  const distFromCenter = Math.sqrt(position.x * position.x + position.y * position.y);
  
  // Direction away from center with slight randomness
  const dirX = position.x === 0 ? (seededRandom(seed * 5) - 0.5) : position.x / (distFromCenter || 1);
  const dirY = position.y === 0 ? (seededRandom(seed * 6) - 0.5) : position.y / (distFromCenter || 1);
  
  // Speed based on zone - slower for cinematic slow-motion
  const zoneMultiplier = {
    'center': 1.8,
    'inner': 1.3,
    'mid': 1.0,
    'outer': 0.7,
    'edge': 0.5
  }[zone] || 0.9;
  
  const speedVariation = seededRandom(seed * 7) * 0.5 + 0.7;
  const speed = zoneMultiplier * speedVariation;
  
  // Z velocity - gentler forward explosion for slow-motion
  const zBase = zone === 'center' ? 1.2 : zone === 'inner' ? 0.9 : 0.6;
  const zSpeed = zBase + seededRandom(seed * 8) * 0.7;
  
  return new THREE.Vector3(
    dirX * speed + (seededRandom(seed * 9) - 0.5) * 0.3,
    dirY * speed + (seededRandom(seed * 10) - 0.5) * 0.3,
    zSpeed
  );
}

export function generateShardData(count: number): ShardData[] {
  const shards: ShardData[] = [];
  
  // Define zones with more refined distribution
  const zones = [
    { name: 'center', count: Math.floor(count * 0.12), radiusMin: 0, radiusMax: 0.25, size: 'medium' as const },
    { name: 'inner', count: Math.floor(count * 0.20), radiusMin: 0.2, radiusMax: 0.6, size: 'large' as const },
    { name: 'mid', count: Math.floor(count * 0.28), radiusMin: 0.5, radiusMax: 1.2, size: 'medium' as const },
    { name: 'outer', count: Math.floor(count * 0.25), radiusMin: 1.0, radiusMax: 2.0, size: 'large' as const },
    { name: 'edge', count: Math.floor(count * 0.15), radiusMin: 1.8, radiusMax: 3.0, size: 'medium' as const },
  ];
  
  let id = 0;
  
  for (const zone of zones) {
    for (let i = 0; i < zone.count; i++) {
      const seed = id * 137.5 + 42;
      
      // Position within zone - golden ratio spiral for natural distribution
      const goldenAngle = Math.PI * (3 - Math.sqrt(5));
      const angle = id * goldenAngle + seededRandom(seed) * 0.3;
      const radius = zone.radiusMin + seededRandom(seed * 2) * (zone.radiusMax - zone.radiusMin);
      
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      
      // Size variation
      const sizeMultiplier = {
        'large': 0.22 + seededRandom(seed * 3) * 0.12,
        'medium': 0.12 + seededRandom(seed * 3) * 0.08,
        'small': 0.06 + seededRandom(seed * 3) * 0.04,
        'tiny': 0.025 + seededRandom(seed * 3) * 0.025
      };
      
      const baseSize = sizeMultiplier[zone.size];
      
      // Slower delay ripple for gradual slow-motion propagation
      const distanceDelay = Math.sqrt(x * x + y * y) * 0.15;
      
      const shard: ShardData = {
        id,
        vertices: generatePolygonVertices(seed, baseSize, 0.5),
        thickness: 0.006 + seededRandom(seed * 4) * 0.01,
        initialPosition: new THREE.Vector3(x, y, 0),
        initialRotation: seededRandom(seed * 5) * Math.PI * 2,
        velocity: calculateVelocity(new THREE.Vector3(x, y, 0), seed, zone.name),
        rotationAxis: new THREE.Vector3(
          seededRandom(seed * 11) - 0.5,
          seededRandom(seed * 12) - 0.5,
          seededRandom(seed * 13) - 0.5
        ).normalize(),
        spinSpeed: 1.5 + seededRandom(seed * 14) * 3,
        delay: distanceDelay + seededRandom(seed * 15) * 0.1,
        size: zone.size
      };
      
      shards.push(shard);
      id++;
    }
  }
  
  // Add micro debris - more particles for premium feel
  const debrisCount = Math.floor(count * 0.4);
  for (let i = 0; i < debrisCount; i++) {
    const seed = (id + i) * 137.5 + 999;
    
    const angle = seededRandom(seed) * Math.PI * 2;
    const radius = seededRandom(seed * 2) * 1.2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    
    const debris: ShardData = {
      id: id + i,
      vertices: generatePolygonVertices(seed, 0.015 + seededRandom(seed * 3) * 0.015, 0.6),
      thickness: 0.002 + seededRandom(seed * 4) * 0.004,
      initialPosition: new THREE.Vector3(x, y, 0),
      initialRotation: seededRandom(seed * 5) * Math.PI * 2,
      velocity: new THREE.Vector3(
        (seededRandom(seed * 6) - 0.5) * 1.8,
        (seededRandom(seed * 7) - 0.5) * 1.8,
        0.8 + seededRandom(seed * 8) * 1.2
      ),
      rotationAxis: new THREE.Vector3(
        seededRandom(seed * 11) - 0.5,
        seededRandom(seed * 12) - 0.5,
        seededRandom(seed * 13) - 0.5
      ).normalize(),
      spinSpeed: 3 + seededRandom(seed * 14) * 5,
      delay: seededRandom(seed * 15) * 0.15,
      size: 'tiny'
    };
    
    shards.push(debris);
  }
  
  return shards;
}
