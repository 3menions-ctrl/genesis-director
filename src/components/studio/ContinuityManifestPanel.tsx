import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Eye, 
  Lightbulb, 
  Package, 
  Heart, 
  Zap, 
  Sparkles, 
  ChevronDown, 
  ChevronRight,
  MapPin,
  Palette,
  Shirt,
  Scissors,
  Droplets,
  Wind,
  AlertTriangle,
  Check
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ShotContinuityManifest } from '@/types/continuity-manifest';

interface ContinuityManifestPanelProps {
  manifest: ShotContinuityManifest | null;
  shotIndex: number;
  isLoading?: boolean;
  className?: string;
}

// Demo manifest data to show when no real data is available
const DEMO_MANIFEST: ShotContinuityManifest = {
  shotIndex: 0,
  projectId: 'demo',
  extractedAt: Date.now(),
  spatial: {
    primaryCharacter: {
      screenPosition: 'center',
      depth: 'midground',
      verticalPosition: 'middle',
      facingDirection: 'camera',
      bodyAngle: 15
    },
    cameraDistance: 'medium',
    eyeLineDirection: 'toward camera'
  },
  lighting: {
    primarySource: {
      type: 'natural',
      direction: 'front',
      quality: 'soft',
      intensity: 'medium'
    },
    colorTemperature: 'warm',
    colorTint: 'golden hour amber',
    shadowDirection: 'bottom-right',
    ambientLevel: 'normal',
    specialLighting: ['rim light', 'subtle fill']
  },
  props: {
    characterProps: [{
      characterName: 'Main Character',
      props: [
        { propId: 'watch-1', name: 'Watch', state: 'on wrist' },
        { propId: 'bag-1', name: 'Bag', state: 'over shoulder' }
      ]
    }],
    environmentProps: [
      { name: 'Coffee cup', position: 'table left', state: 'half-full' },
      { name: 'Laptop', position: 'table center', state: 'open' }
    ]
  },
  emotional: {
    primaryEmotion: 'contemplative',
    intensity: 'moderate',
    facialExpression: 'slight frown, eyes focused',
    bodyLanguage: 'leaning forward, attentive posture',
    physicalIndicators: ['furrowed brow', 'clasped hands']
  },
  action: {
    movementType: 'still',
    movementDirection: 'stationary',
    poseAtCut: 'seated, engaged',
    gestureInProgress: 'hand reaching for cup',
    expectedContinuation: 'lifting cup to drink'
  },
  microDetails: {
    hair: {
      style: 'swept back',
      condition: 'neat',
      windEffect: undefined
    },
    clothing: {
      dustLevel: 'clean',
      stains: [],
      tears: []
    },
    skin: {
      scars: [],
      wounds: [],
      dirt: [],
      sweat: false
    },
    persistentMarkers: ['silver ring on right hand', 'small tattoo on wrist']
  },
  environment: {
    weatherVisible: 'clear sky visible through window',
    timeOfDay: 'late afternoon',
    atmospherics: ['warm dust particles in light'],
    backgroundElements: ['bookshelf', 'window with city view']
  },
  criticalAnchors: ['Watch position', 'Hair style', 'Warm lighting', 'Seated posture'],
  negativePrompt: 'character morphing, identity change, lighting reversal',
  injectionPrompt: 'Continue with character seated, warm lighting from front, contemplative expression, hand motion toward coffee cup.'
};

export function ContinuityManifestPanel({ 
  manifest, 
  shotIndex, 
  isLoading,
  className 
}: ContinuityManifestPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['spatial', 'micro']));

  // Use demo data if no real data is available
  const activeManifest = manifest || DEMO_MANIFEST;
  const isDemo = !manifest;
  const displayIndex = manifest ? shotIndex : 0;

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <Card className={`bg-background/50 backdrop-blur border-border/50 ${className}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 animate-pulse text-primary" />
            Extracting Continuity Data...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {['Spatial', 'Lighting', 'Props', 'Emotional', 'Micro-Details'].map((item, i) => (
              <div key={item} className="flex items-center gap-2">
                <div 
                  className="h-2 bg-muted rounded animate-pulse" 
                  style={{ width: `${60 + i * 8}%`, animationDelay: `${i * 100}ms` }} 
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const sections = [
    {
      id: 'spatial',
      title: 'Spatial Position',
      icon: MapPin,
      color: 'text-blue-400',
      content: manifest.spatial && (
        <div className="space-y-2 text-xs">
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline" className="text-[10px]">
              {manifest.spatial.primaryCharacter?.screenPosition || 'center'}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {manifest.spatial.primaryCharacter?.depth || 'midground'}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              facing {manifest.spatial.primaryCharacter?.facingDirection || 'camera'}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {manifest.spatial.cameraDistance || 'medium'}
            </Badge>
          </div>
          {manifest.spatial.eyeLineDirection && (
            <p className="text-muted-foreground">
              Eye line: {manifest.spatial.eyeLineDirection}
            </p>
          )}
        </div>
      ),
    },
    {
      id: 'lighting',
      title: 'Lighting State',
      icon: Lightbulb,
      color: 'text-yellow-400',
      content: manifest.lighting && (
        <div className="space-y-2 text-xs">
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline" className="text-[10px]">
              {manifest.lighting.primarySource?.type || 'natural'}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {manifest.lighting.primarySource?.direction || 'front'} light
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {manifest.lighting.colorTemperature || 'neutral'}
            </Badge>
          </div>
          {manifest.lighting.shadowDirection && (
            <p className="text-muted-foreground">
              Shadows: {manifest.lighting.shadowDirection}
            </p>
          )}
          {manifest.lighting.specialLighting?.length > 0 && (
            <p className="text-muted-foreground">
              Special: {manifest.lighting.specialLighting.join(', ')}
            </p>
          )}
        </div>
      ),
    },
    {
      id: 'props',
      title: 'Props & Objects',
      icon: Package,
      color: 'text-green-400',
      content: manifest.props && (
        <div className="space-y-2 text-xs">
          {manifest.props.characterProps?.map((cp, i) => (
            <div key={i}>
              <span className="font-medium">{cp.characterName}:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {cp.props?.map((p, j) => (
                  <Badge key={j} variant="outline" className="text-[10px]">
                    {p.name} ({p.state})
                  </Badge>
                ))}
              </div>
            </div>
          ))}
          {manifest.props.environmentProps?.length > 0 && (
            <div>
              <span className="font-medium text-muted-foreground">Environment:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {manifest.props.environmentProps.slice(0, 5).map((p, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px]">
                    {p.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'emotional',
      title: 'Emotional State',
      icon: Heart,
      color: 'text-pink-400',
      content: manifest.emotional && (
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={`text-[10px] ${
                manifest.emotional.intensity === 'intense' || manifest.emotional.intensity === 'extreme'
                  ? 'border-red-500/50 text-red-400'
                  : ''
              }`}
            >
              {manifest.emotional.intensity} {manifest.emotional.primaryEmotion}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {manifest.emotional.facialExpression}
          </p>
          <p className="text-muted-foreground">
            {manifest.emotional.bodyLanguage}
          </p>
          {manifest.emotional.physicalIndicators?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {manifest.emotional.physicalIndicators.map((ind, i) => (
                <Badge key={i} variant="secondary" className="text-[10px]">
                  {ind}
                </Badge>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'action',
      title: 'Action & Movement',
      icon: Zap,
      color: 'text-orange-400',
      content: manifest.action && (
        <div className="space-y-2 text-xs">
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline" className="text-[10px]">
              {manifest.action.movementType || 'still'}
            </Badge>
            {manifest.action.movementDirection !== 'stationary' && (
              <Badge variant="outline" className="text-[10px]">
                → {manifest.action.movementDirection}
              </Badge>
            )}
          </div>
          {manifest.action.poseAtCut && (
            <p className="text-muted-foreground">
              Pose: {manifest.action.poseAtCut}
            </p>
          )}
          {manifest.action.gestureInProgress && (
            <p className="text-muted-foreground">
              Gesture: {manifest.action.gestureInProgress}
            </p>
          )}
          {manifest.action.expectedContinuation && (
            <p className="text-primary/80 italic">
              Next: {manifest.action.expectedContinuation}
            </p>
          )}
        </div>
      ),
    },
    {
      id: 'micro',
      title: 'Micro-Details',
      icon: Sparkles,
      color: 'text-purple-400',
      content: manifest.microDetails && (
        <div className="space-y-3 text-xs">
          {/* Skin Details */}
          {(manifest.microDetails.skin?.scars?.length > 0 || 
            manifest.microDetails.skin?.wounds?.length > 0 ||
            manifest.microDetails.skin?.dirt?.length > 0) && (
            <div>
              <div className="flex items-center gap-1 text-muted-foreground mb-1">
                <Scissors className="w-3 h-3" />
                <span>Skin</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {manifest.microDetails.skin.scars?.map((s, i) => (
                  <Badge key={`scar-${i}`} variant="destructive" className="text-[10px]">
                    scar: {s.location}
                  </Badge>
                ))}
                {manifest.microDetails.skin.wounds?.map((w, i) => (
                  <Badge key={`wound-${i}`} variant="destructive" className="text-[10px]">
                    {w.freshness} wound: {w.location}
                  </Badge>
                ))}
                {manifest.microDetails.skin.dirt?.map((d, i) => (
                  <Badge key={`dirt-${i}`} variant="secondary" className="text-[10px]">
                    {d.intensity} dirt: {d.areas?.join(', ')}
                  </Badge>
                ))}
                {manifest.microDetails.skin.sweat && (
                  <Badge variant="secondary" className="text-[10px]">
                    <Droplets className="w-2 h-2 mr-1" /> sweating
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Clothing Wear */}
          {(manifest.microDetails.clothing?.stains?.length > 0 ||
            manifest.microDetails.clothing?.tears?.length > 0 ||
            manifest.microDetails.clothing?.dustLevel !== 'clean') && (
            <div>
              <div className="flex items-center gap-1 text-muted-foreground mb-1">
                <Shirt className="w-3 h-3" />
                <span>Clothing</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {manifest.microDetails.clothing.stains?.map((s, i) => (
                  <Badge key={`stain-${i}`} variant="outline" className="text-[10px]">
                    {s.type} stain: {s.location}
                  </Badge>
                ))}
                {manifest.microDetails.clothing.tears?.map((t, i) => (
                  <Badge key={`tear-${i}`} variant="outline" className="text-[10px]">
                    {t.size} tear: {t.location}
                  </Badge>
                ))}
                {manifest.microDetails.clothing.dustLevel !== 'clean' && (
                  <Badge variant="secondary" className="text-[10px]">
                    {manifest.microDetails.clothing.dustLevel}
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Hair State */}
          {manifest.microDetails.hair && (
            <div>
              <div className="flex items-center gap-1 text-muted-foreground mb-1">
                <Wind className="w-3 h-3" />
                <span>Hair</span>
              </div>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-[10px]">
                  {manifest.microDetails.hair.style}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {manifest.microDetails.hair.condition}
                </Badge>
                {manifest.microDetails.hair.windEffect && (
                  <Badge variant="secondary" className="text-[10px]">
                    wind: {manifest.microDetails.hair.windEffect}
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Persistent Markers */}
          {manifest.microDetails.persistentMarkers?.length > 0 && (
            <div>
              <div className="flex items-center gap-1 text-primary/80 mb-1">
                <AlertTriangle className="w-3 h-3" />
                <span className="font-medium">Must Maintain</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {manifest.microDetails.persistentMarkers.map((m, i) => (
                  <Badge key={i} className="text-[10px] bg-primary/20 text-primary border-primary/30">
                    {m}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <Card className={`bg-background/50 backdrop-blur border-border/50 ${className}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-primary" />
            Shot {shotIndex + 1} Continuity
          </div>
          {manifest.criticalAnchors && (
            <Badge variant="outline" className="text-[10px]">
              {manifest.criticalAnchors.length} anchors
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-[400px] pr-2">
          <div className="space-y-2">
            {sections.map(section => (
              <Collapsible
                key={section.id}
                open={expandedSections.has(section.id)}
                onOpenChange={() => toggleSection(section.id)}
              >
                <CollapsibleTrigger className="flex items-center gap-2 w-full py-1 hover:bg-muted/50 rounded px-1 transition-colors">
                  {expandedSections.has(section.id) ? (
                    <ChevronDown className="w-3 h-3 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-muted-foreground" />
                  )}
                  <section.icon className={`w-3 h-3 ${section.color}`} />
                  <span className="text-xs font-medium">{section.title}</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="pl-6 py-2">
                    {section.content || (
                      <p className="text-xs text-muted-foreground italic">No data</p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}

            {/* Critical Anchors Summary */}
            {manifest.criticalAnchors?.length > 0 && (
              <div className="mt-4 pt-3 border-t border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="w-3 h-3 text-green-400" />
                  <span className="text-xs font-medium">Critical Anchors</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {manifest.criticalAnchors.map((anchor, i) => (
                    <Badge 
                      key={i} 
                      variant="outline" 
                      className="text-[10px] bg-green-500/10 border-green-500/30 text-green-400"
                    >
                      {anchor}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Injection Prompt Preview */}
            {manifest.injectionPrompt && (
              <div className="mt-4 pt-3 border-t border-border/50">
                <p className="text-xs font-medium mb-1 text-muted-foreground">Injection Prompt</p>
                <p className="text-[10px] text-muted-foreground bg-muted/30 p-2 rounded">
                  {manifest.injectionPrompt}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
