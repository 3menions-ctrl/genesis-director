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

// Generate irregular polygon vertices
function generatePolygonVertices(
  seed: number, 
  baseSize: number, 
  irregularity: number = 0.4
): { x: number; y: number }[] {
  const sides = Math.floor(seededRandom(seed * 1.1) * 3) + 3; // 3-5 sides
  const vertices: { x: number; y: number }[] = [];
  
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2;
    const radiusVariation = 1 - irregularity + seededRandom(seed * (i + 2)) * irregularity * 2;
    const radius = baseSize * radiusVariation;
    
    // Add slight angle variation for more organic shape
    const angleVariation = (seededRandom(seed * (i + 10)) - 0.5) * 0.4;
    const finalAngle = angle + angleVariation;
    
    vertices.push({
      x: Math.cos(finalAngle) * radius,
      y: Math.sin(finalAngle) * radius
    });
  }
  
  return vertices;
}

// Calculate velocity based on position from center
function calculateVelocity(
  position: THREE.Vector3, 
  seed: number,
  isCenter: boolean
): THREE.Vector3 {
  const distFromCenter = Math.sqrt(position.x * position.x + position.y * position.y);
  
  // Direction away from center
  const dirX = position.x === 0 ? (seededRandom(seed * 5) - 0.5) : position.x / (distFromCenter || 1);
  const dirY = position.y === 0 ? (seededRandom(seed * 6) - 0.5) : position.y / (distFromCenter || 1);
  
  // Speed based on distance (closer = faster explosion)
  const baseSpeed = isCenter ? 2.5 : 1.5;
  const speedVariation = seededRandom(seed * 7) * 0.8 + 0.6;
  const speed = baseSpeed * speedVariation * (1 + (1 - distFromCenter) * 0.5);
  
  // Z velocity (toward camera) - center pieces fly more toward camera
  const zSpeed = isCenter ? (1.5 + seededRandom(seed * 8) * 1.5) : (0.8 + seededRandom(seed * 8) * 0.8);
  
  return new THREE.Vector3(
    dirX * speed + (seededRandom(seed * 9) - 0.5) * 0.5,
    dirY * speed + (seededRandom(seed * 10) - 0.5) * 0.5,
    zSpeed
  );
}

export function generateShardData(count: number): ShardData[] {
  const shards: ShardData[] = [];
  
  // Define zones: center (explosive), inner ring, outer ring, edges
  const zones = [
    { name: 'center', count: Math.floor(count * 0.15), radius: 0.3, size: 'medium' as const },
    { name: 'inner', count: Math.floor(count * 0.25), radius: 0.8, size: 'large' as const },
    { name: 'mid', count: Math.floor(count * 0.3), radius: 1.5, size: 'medium' as const },
    { name: 'outer', count: Math.floor(count * 0.2), radius: 2.5, size: 'large' as const },
    { name: 'edge', count: Math.floor(count * 0.1), radius: 3.5, size: 'small' as const },
  ];
  
  let id = 0;
  
  for (const zone of zones) {
    for (let i = 0; i < zone.count; i++) {
      const seed = id * 137.5 + 42;
      
      // Position within zone
      const angle = seededRandom(seed) * Math.PI * 2;
      const radiusMin = zone.name === 'center' ? 0 : zone.radius * 0.6;
      const radiusMax = zone.radius;
      const radius = radiusMin + seededRandom(seed * 2) * (radiusMax - radiusMin);
      
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      
      // Size based on zone with variation
      const sizeMultiplier = {
        'large': 0.25 + seededRandom(seed * 3) * 0.15,
        'medium': 0.15 + seededRandom(seed * 3) * 0.1,
        'small': 0.08 + seededRandom(seed * 3) * 0.06,
        'tiny': 0.03 + seededRandom(seed * 3) * 0.03
      };
      
      const baseSize = sizeMultiplier[zone.size];
      
      // Generate shard
      const shard: ShardData = {
        id,
        vertices: generatePolygonVertices(seed, baseSize),
        thickness: 0.008 + seededRandom(seed * 4) * 0.012,
        initialPosition: new THREE.Vector3(x, y, 0),
        initialRotation: seededRandom(seed * 5) * Math.PI * 2,
        velocity: calculateVelocity(new THREE.Vector3(x, y, 0), seed, zone.name === 'center'),
        rotationAxis: new THREE.Vector3(
          seededRandom(seed * 11) - 0.5,
          seededRandom(seed * 12) - 0.5,
          seededRandom(seed * 13) - 0.5
        ).normalize(),
        spinSpeed: 3 + seededRandom(seed * 14) * 8,
        delay: zone.name === 'center' ? seededRandom(seed * 15) * 0.05 : 
               0.05 + seededRandom(seed * 15) * 0.15 * (zones.indexOf(zone) + 1),
        size: zone.size
      };
      
      shards.push(shard);
      id++;
    }
  }
  
  // Add extra tiny debris particles
  const debrisCount = Math.floor(count * 0.3);
  for (let i = 0; i < debrisCount; i++) {
    const seed = (id + i) * 137.5 + 999;
    
    const angle = seededRandom(seed) * Math.PI * 2;
    const radius = seededRandom(seed * 2) * 1.5;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    
    const debris: ShardData = {
      id: id + i,
      vertices: generatePolygonVertices(seed, 0.02 + seededRandom(seed * 3) * 0.02),
      thickness: 0.003 + seededRandom(seed * 4) * 0.005,
      initialPosition: new THREE.Vector3(x, y, 0),
      initialRotation: seededRandom(seed * 5) * Math.PI * 2,
      velocity: new THREE.Vector3(
        (seededRandom(seed * 6) - 0.5) * 4,
        (seededRandom(seed * 7) - 0.5) * 4,
        2 + seededRandom(seed * 8) * 3
      ),
      rotationAxis: new THREE.Vector3(
        seededRandom(seed * 11) - 0.5,
        seededRandom(seed * 12) - 0.5,
        seededRandom(seed * 13) - 0.5
      ).normalize(),
      spinSpeed: 10 + seededRandom(seed * 14) * 15,
      delay: seededRandom(seed * 15) * 0.1,
      size: 'tiny'
    };
    
    shards.push(debris);
  }
  
  return shards;
}
