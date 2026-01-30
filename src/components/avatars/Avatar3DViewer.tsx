import { useRef, useState, Suspense, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, useTexture, Html } from '@react-three/drei';
import { Loader2, RotateCcw, Hand } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as THREE from 'three';

interface Avatar3DViewerProps {
  frontImage: string;
  sideImage?: string | null;
  backImage?: string | null;
  name: string;
  className?: string;
}

// Cylindrical avatar mesh that displays images on different sides
function AvatarCylinder({ 
  frontImage, 
  sideImage, 
  backImage 
}: { 
  frontImage: string; 
  sideImage?: string | null; 
  backImage?: string | null;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  
  // Load textures
  const textures = useTexture({
    front: frontImage,
    side: sideImage || frontImage,
    back: backImage || frontImage,
  });
  
  // Auto-rotation effect
  useFrame((_, delta) => {
    if (meshRef.current && autoRotate) {
      meshRef.current.rotation.y += delta * 0.3;
    }
  });

  // Create materials for the cylinder
  const materials = useMemo(() => {
    // Configure textures
    Object.values(textures).forEach(tex => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
    });

    // Create a panoramic material from the three images
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    
    // Create a combined material
    return new THREE.MeshStandardMaterial({
      map: textures.front,
      side: THREE.DoubleSide,
    });
  }, [textures]);

  return (
    <group>
      {/* Main avatar display - using a curved plane */}
      <mesh 
        ref={meshRef}
        onPointerDown={() => setAutoRotate(false)}
        onPointerUp={() => setAutoRotate(true)}
      >
        <cylinderGeometry args={[1.5, 1.5, 2.5, 32, 1, true]} />
        <meshStandardMaterial 
          map={textures.front}
          side={THREE.DoubleSide}
          transparent
        />
      </mesh>
      
      {/* Pedestal base */}
      <mesh position={[0, -1.4, 0]}>
        <cylinderGeometry args={[0.8, 1, 0.15, 32]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.3} />
      </mesh>
    </group>
  );
}

// Simple image rotation when 3D isn't available
function ImageRotator({ 
  frontImage, 
  sideImage, 
  backImage,
  name
}: { 
  frontImage: string; 
  sideImage?: string | null; 
  backImage?: string | null;
  name: string;
}) {
  const [currentView, setCurrentView] = useState<'front' | 'side' | 'back'>('front');
  const [isRotating, setIsRotating] = useState(false);
  
  const images = {
    front: frontImage,
    side: sideImage || frontImage,
    back: backImage || frontImage,
  };
  
  const rotate = () => {
    setIsRotating(true);
    setTimeout(() => {
      setCurrentView(prev => {
        if (prev === 'front') return 'side';
        if (prev === 'side') return 'back';
        return 'front';
      });
      setIsRotating(false);
    }, 300);
  };
  
  const hasMultipleViews = sideImage || backImage;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center">
      <div className="relative w-full aspect-[3/4] max-w-[280px]">
        <div
          className={`w-full h-full rounded-2xl overflow-hidden transition-transform duration-300 ${
            isRotating ? 'scale-95 opacity-50' : 'scale-100 opacity-100'
          }`}
          style={{ 
            perspective: '1000px',
            transformStyle: 'preserve-3d'
          }}
        >
          <img
            src={images[currentView]}
            alt={`${name} - ${currentView} view`}
            className="w-full h-full object-cover"
          />
        </div>
        
        {/* View indicator */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {['front', 'side', 'back'].map((view) => (
            <button
              key={view}
              onClick={() => setCurrentView(view as 'front' | 'side' | 'back')}
              className={`w-2 h-2 rounded-full transition-all ${
                currentView === view 
                  ? 'bg-violet-500 scale-125' 
                  : 'bg-white/30 hover:bg-white/50'
              }`}
            />
          ))}
        </div>
      </div>
      
      {hasMultipleViews && (
        <Button
          variant="ghost"
          size="sm"
          onClick={rotate}
          className="mt-4 text-white/50 hover:text-white"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Rotate View
        </Button>
      )}
      
      {!hasMultipleViews && (
        <p className="mt-4 text-xs text-white/30 flex items-center gap-1">
          <Hand className="w-3 h-3" />
          Single view available
        </p>
      )}
    </div>
  );
}

// Loading fallback
function LoadingFallback() {
  return (
    <Html center>
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
        <p className="text-xs text-white/50">Loading 3D view...</p>
      </div>
    </Html>
  );
}

export function Avatar3DViewer({ 
  frontImage, 
  sideImage, 
  backImage, 
  name,
  className = ''
}: Avatar3DViewerProps) {
  const [use3D, setUse3D] = useState(true);
  const [error, setError] = useState(false);
  
  // Fallback to image rotation if 3D fails or isn't supported
  if (!use3D || error) {
    return (
      <div className={`relative ${className}`}>
        <ImageRotator
          frontImage={frontImage}
          sideImage={sideImage}
          backImage={backImage}
          name={name}
        />
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <Canvas
        onError={() => setError(true)}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        className="!bg-transparent"
      >
        <Suspense fallback={<LoadingFallback />}>
          <PerspectiveCamera makeDefault position={[0, 0, 4]} />
          <ambientLight intensity={0.6} />
          <spotLight
            position={[5, 5, 5]}
            angle={0.3}
            penumbra={0.5}
            intensity={1}
            castShadow
          />
          <spotLight
            position={[-5, 3, 5]}
            angle={0.3}
            penumbra={0.5}
            intensity={0.5}
          />
          
          <AvatarCylinder
            frontImage={frontImage}
            sideImage={sideImage}
            backImage={backImage}
          />
          
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            minPolarAngle={Math.PI / 3}
            maxPolarAngle={Math.PI / 1.8}
            autoRotate
            autoRotateSpeed={1}
          />
        </Suspense>
      </Canvas>
      
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-white/30 flex items-center gap-1">
        <Hand className="w-3 h-3" />
        Drag to rotate
      </div>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setUse3D(false)}
        className="absolute top-2 right-2 text-white/30 hover:text-white/60 text-xs"
      >
        2D View
      </Button>
    </div>
  );
}

export default Avatar3DViewer;
