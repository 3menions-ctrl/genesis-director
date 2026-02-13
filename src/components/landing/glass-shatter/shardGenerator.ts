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

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/** Generate organic irregular polygon — more varied vertex count for realism */
function generatePolygonVertices(
  seed: number, 
  baseSize: number, 
  irregularity: number = 0.55
): { x: number; y: number }[] {
  const sides = Math.floor(seededRandom(seed * 1.1) * 5) + 3; // 3-7 sides
  const vertices: { x: number; y: number }[] = [];
  
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2;
    const radiusVar = 1 - irregularity + seededRandom(seed * (i + 2)) * irregularity * 2;
    const radius = baseSize * radiusVar;
    const angleVar = (seededRandom(seed * (i + 10)) - 0.5) * 0.6;
    
    vertices.push({
      x: Math.cos(angle + angleVar) * radius,
      y: Math.sin(angle + angleVar) * radius,
    });
  }
  
  return vertices;
}

/** Physically-motivated explosion velocity */
function calculateVelocity(
  position: THREE.Vector3, 
  seed: number,
  zone: string
): THREE.Vector3 {
  const dist = Math.sqrt(position.x ** 2 + position.y ** 2);
  
  const dirX = position.x === 0 ? (seededRandom(seed * 5) - 0.5) : position.x / (dist || 1);
  const dirY = position.y === 0 ? (seededRandom(seed * 6) - 0.5) : position.y / (dist || 1);
  
  const zoneSpeed: Record<string, number> = {
    center: 2.0, inner: 1.5, mid: 1.1, outer: 0.8, edge: 0.5,
  };
  
  const speed = (zoneSpeed[zone] ?? 0.9) * (seededRandom(seed * 7) * 0.5 + 0.75);
  
  const zBase = zone === 'center' ? 1.4 : zone === 'inner' ? 1.0 : 0.6;
  const zSpeed = zBase + seededRandom(seed * 8) * 0.8;
  
  return new THREE.Vector3(
    dirX * speed + (seededRandom(seed * 9) - 0.5) * 0.25,
    dirY * speed + (seededRandom(seed * 10) - 0.5) * 0.25,
    zSpeed
  );
}

export function generateShardData(count: number): ShardData[] {
  const shards: ShardData[] = [];
  
  // 5-zone radial distribution for natural fracture patterns
  const zones = [
    { name: 'center', count: Math.floor(count * 0.10), rMin: 0, rMax: 0.2, size: 'small' as const },
    { name: 'inner', count: Math.floor(count * 0.18), rMin: 0.15, rMax: 0.5, size: 'medium' as const },
    { name: 'mid', count: Math.floor(count * 0.28), rMin: 0.4, rMax: 1.1, size: 'large' as const },
    { name: 'outer', count: Math.floor(count * 0.26), rMin: 0.9, rMax: 2.0, size: 'large' as const },
    { name: 'edge', count: Math.floor(count * 0.18), rMin: 1.7, rMax: 3.2, size: 'medium' as const },
  ];
  
  let id = 0;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  
  for (const zone of zones) {
    for (let i = 0; i < zone.count; i++) {
      const seed = id * 137.5 + 42;
      const angle = id * goldenAngle + seededRandom(seed) * 0.3;
      const radius = zone.rMin + seededRandom(seed * 2) * (zone.rMax - zone.rMin);
      
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      
      const sizeMap: Record<string, (s: number) => number> = {
        large: (s) => 0.20 + seededRandom(s) * 0.14,
        medium: (s) => 0.10 + seededRandom(s) * 0.08,
        small: (s) => 0.05 + seededRandom(s) * 0.04,
        tiny: (s) => 0.02 + seededRandom(s) * 0.02,
      };
      
      const baseSize = (sizeMap[zone.size] ?? sizeMap.medium)(seed * 3);
      const distDelay = Math.sqrt(x * x + y * y) * 0.12;
      
      shards.push({
        id,
        vertices: generatePolygonVertices(seed, baseSize, 0.55),
        thickness: 0.005 + seededRandom(seed * 4) * 0.012,
        initialPosition: new THREE.Vector3(x, y, 0),
        initialRotation: seededRandom(seed * 5) * Math.PI * 2,
        velocity: calculateVelocity(new THREE.Vector3(x, y, 0), seed, zone.name),
        rotationAxis: new THREE.Vector3(
          seededRandom(seed * 11) - 0.5,
          seededRandom(seed * 12) - 0.5,
          seededRandom(seed * 13) - 0.5
        ).normalize(),
        spinSpeed: 1.2 + seededRandom(seed * 14) * 2.5,
        delay: distDelay + seededRandom(seed * 15) * 0.08,
        size: zone.size,
      });
      id++;
    }
  }
  
  // Micro debris — fine particles for premium density
  const debrisCount = Math.floor(count * 0.45);
  for (let i = 0; i < debrisCount; i++) {
    const seed = (id + i) * 137.5 + 999;
    const angle = seededRandom(seed) * Math.PI * 2;
    const radius = seededRandom(seed * 2) * 1.5;
    
    shards.push({
      id: id + i,
      vertices: generatePolygonVertices(seed, 0.012 + seededRandom(seed * 3) * 0.012, 0.65),
      thickness: 0.002 + seededRandom(seed * 4) * 0.003,
      initialPosition: new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0),
      initialRotation: seededRandom(seed * 5) * Math.PI * 2,
      velocity: new THREE.Vector3(
        (seededRandom(seed * 6) - 0.5) * 2,
        (seededRandom(seed * 7) - 0.5) * 2,
        0.6 + seededRandom(seed * 8) * 1.4
      ),
      rotationAxis: new THREE.Vector3(
        seededRandom(seed * 11) - 0.5,
        seededRandom(seed * 12) - 0.5,
        seededRandom(seed * 13) - 0.5
      ).normalize(),
      spinSpeed: 2.5 + seededRandom(seed * 14) * 4,
      delay: seededRandom(seed * 15) * 0.12,
      size: 'tiny',
    });
  }
  
  return shards;
}
