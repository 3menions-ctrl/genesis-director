import React, { useRef, useState, Suspense, useEffect } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Html } from '@react-three/drei';
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
  const [textureLoaded, setTextureLoaded] = useState(false);
  
  // Load texture using THREE.TextureLoader
  const frontTexture = useLoader(THREE.TextureLoader, frontImage);
  const sideTexture = useLoader(THREE.TextureLoader, sideImage || frontImage);
  const backTexture = useLoader(THREE.TextureLoader, backImage || frontImage);
  
  useEffect(() => {
    if (frontTexture) {
      frontTexture.colorSpace = THREE.SRGBColorSpace;
      frontTexture.minFilter = THREE.LinearFilter;
      frontTexture.magFilter = THREE.LinearFilter;
      setTextureLoaded(true);
    }
  }, [frontTexture]);

  // Auto-rotation effect
  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.5;
    }
  });

  if (!textureLoaded) {
    return null;
  }

  return (
    <group>
      {/* Main avatar display - using a curved plane */}
      <mesh ref={meshRef}>
        <cylinderGeometry args={[1.5, 1.5, 2.8, 64, 1, true]} />
        <meshStandardMaterial 
          map={frontTexture}
          side={THREE.DoubleSide}
          transparent
          opacity={1}
        />
      </mesh>
      
      {/* Pedestal base */}
      <mesh position={[0, -1.6, 0]}>
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
    <div className="relative w-full h-full flex flex-col items-center justify-center p-4">
      <div className="relative w-full aspect-[3/4] max-w-[280px] mx-auto">
        <div
          className={`w-full h-full rounded-2xl overflow-hidden transition-all duration-300 ${
            isRotating ? 'scale-95 opacity-50 rotate-y-12' : 'scale-100 opacity-100'
          }`}
          style={{ 
            perspective: '1000px',
            transformStyle: 'preserve-3d'
          }}
        >
          <img
            src={images[currentView]}
            alt={`${name} - ${currentView} view`}
            className="w-full h-full object-cover rounded-2xl shadow-2xl"
          />
        </div>
        
        {/* View indicator dots */}
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex gap-3">
          {(['front', 'side', 'back'] as const).map((view) => (
            <button
              key={view}
              onClick={() => setCurrentView(view)}
              className={`w-3 h-3 rounded-full transition-all duration-200 ${
                currentView === view 
                  ? 'bg-violet-500 scale-125 shadow-lg shadow-violet-500/50' 
                  : 'bg-white/30 hover:bg-white/50'
              }`}
              title={`${view.charAt(0).toUpperCase() + view.slice(1)} view`}
            />
          ))}
        </div>
      </div>
      
      {hasMultipleViews ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={rotate}
          className="mt-12 text-white/50 hover:text-white"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Rotate View
        </Button>
      ) : (
        <p className="mt-12 text-xs text-white/30 flex items-center gap-1">
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

// Error boundary for 3D canvas
function ErrorFallback({ 
  frontImage, 
  sideImage, 
  backImage, 
  name 
}: Avatar3DViewerProps) {
  return (
    <ImageRotator
      frontImage={frontImage}
      sideImage={sideImage}
      backImage={backImage}
      name={name}
    />
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
  const [hasError, setHasError] = useState(false);
  
  // Fallback to image rotation if 3D fails or isn't supported
  if (!use3D || hasError) {
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
        dpr={[1, 2]}
        gl={{ 
          antialias: true, 
          alpha: true,
          failIfMajorPerformanceCaveat: false 
        }}
        onError={() => setHasError(true)}
        className="!bg-transparent"
        style={{ background: 'transparent' }}
      >
        <Suspense fallback={<LoadingFallback />}>
          <PerspectiveCamera makeDefault position={[0, 0, 4.5]} />
          <ambientLight intensity={0.7} />
          <spotLight
            position={[5, 5, 5]}
            angle={0.3}
            penumbra={0.5}
            intensity={1.2}
            castShadow
          />
          <spotLight
            position={[-5, 3, 5]}
            angle={0.3}
            penumbra={0.5}
            intensity={0.6}
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
            autoRotate={false}
          />
        </Suspense>
      </Canvas>
      
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/40 flex items-center gap-2 bg-black/30 px-3 py-1.5 rounded-full backdrop-blur-sm">
        <Hand className="w-3 h-3" />
        Drag to rotate
      </div>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setUse3D(false)}
        className="absolute top-2 right-2 text-white/30 hover:text-white/60 text-xs h-7 px-2"
      >
        Switch to 2D
      </Button>
    </div>
  );
}

export default Avatar3DViewer;
