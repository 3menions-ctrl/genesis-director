import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Environment DNA structure matching Environments page
interface EnvironmentDNA {
  id: string;
  name: string;
  description: string;
  category: 'interior' | 'exterior';
  lighting: {
    type: string;
    direction: string;
    intensity: string;
    temperature: string;
    timeOfDay: string;
  };
  colorPalette: {
    primary: string;
    secondary: string;
    accent: string;
    shadows: string;
  };
  mood: string;
}

// Full environment presets (synced with Environments.tsx)
const ENVIRONMENT_PRESETS: EnvironmentDNA[] = [
  {
    id: 'golden_hour_studio',
    name: 'Golden Hour Studio',
    description: 'Warm natural light streaming through floor-to-ceiling windows, casting long golden shadows',
    category: 'interior',
    lighting: {
      type: 'natural',
      direction: 'side',
      intensity: 'soft',
      temperature: 'warm',
      timeOfDay: 'golden_hour',
    },
    colorPalette: {
      primary: 'hsl(35, 85%, 55%)',
      secondary: 'hsl(25, 70%, 45%)',
      accent: 'hsl(45, 90%, 65%)',
      shadows: 'hsl(20, 40%, 25%)',
    },
    mood: 'cinematic',
  },
  {
    id: 'neon_noir_city',
    name: 'Neon Noir City',
    description: 'Rain-slicked streets reflecting vibrant neon signs, moody urban atmosphere',
    category: 'exterior',
    lighting: {
      type: 'artificial',
      direction: 'multi',
      intensity: 'high_contrast',
      temperature: 'mixed',
      timeOfDay: 'night',
    },
    colorPalette: {
      primary: 'hsl(280, 80%, 50%)',
      secondary: 'hsl(190, 85%, 45%)',
      accent: 'hsl(340, 90%, 55%)',
      shadows: 'hsl(240, 30%, 10%)',
    },
    mood: 'dramatic',
  },
  {
    id: 'coastal_serenity',
    name: 'Coastal Serenity',
    description: 'Soft diffused light with ocean breeze, peaceful beach villa atmosphere',
    category: 'exterior',
    lighting: {
      type: 'natural',
      direction: 'overhead',
      intensity: 'bright',
      temperature: 'neutral',
      timeOfDay: 'midday',
    },
    colorPalette: {
      primary: 'hsl(195, 75%, 60%)',
      secondary: 'hsl(45, 80%, 70%)',
      accent: 'hsl(150, 50%, 60%)',
      shadows: 'hsl(200, 30%, 35%)',
    },
    mood: 'peaceful',
  },
  {
    id: 'forest_mystique',
    name: 'Forest Mystique',
    description: 'Dappled sunlight through dense canopy, enchanting woodland setting',
    category: 'exterior',
    lighting: {
      type: 'natural',
      direction: 'scattered',
      intensity: 'dappled',
      temperature: 'cool',
      timeOfDay: 'afternoon',
    },
    colorPalette: {
      primary: 'hsl(120, 45%, 35%)',
      secondary: 'hsl(90, 55%, 45%)',
      accent: 'hsl(45, 70%, 55%)',
      shadows: 'hsl(150, 35%, 20%)',
    },
    mood: 'mysterious',
  },
  {
    id: 'modern_minimalist',
    name: 'Modern Minimalist',
    description: 'Clean lines, neutral tones, and carefully controlled studio lighting',
    category: 'interior',
    lighting: {
      type: 'artificial',
      direction: 'diffused',
      intensity: 'even',
      temperature: 'neutral',
      timeOfDay: 'controlled',
    },
    colorPalette: {
      primary: 'hsl(0, 0%, 95%)',
      secondary: 'hsl(0, 0%, 85%)',
      accent: 'hsl(0, 0%, 15%)',
      shadows: 'hsl(0, 0%, 70%)',
    },
    mood: 'professional',
  },
  {
    id: 'alpine_dawn',
    name: 'Alpine Dawn',
    description: 'Crisp mountain air with early morning light painting snow-capped peaks',
    category: 'exterior',
    lighting: {
      type: 'natural',
      direction: 'low_angle',
      intensity: 'soft',
      temperature: 'cool',
      timeOfDay: 'dawn',
    },
    colorPalette: {
      primary: 'hsl(210, 60%, 75%)',
      secondary: 'hsl(35, 70%, 60%)',
      accent: 'hsl(350, 65%, 55%)',
      shadows: 'hsl(220, 40%, 30%)',
    },
    mood: 'inspiring',
  },
  {
    id: 'cozy_firelight',
    name: 'Cozy Firelight',
    description: 'Warm flickering glow from fireplace, intimate cabin interior',
    category: 'interior',
    lighting: {
      type: 'fire',
      direction: 'point',
      intensity: 'low',
      temperature: 'very_warm',
      timeOfDay: 'evening',
    },
    colorPalette: {
      primary: 'hsl(25, 90%, 45%)',
      secondary: 'hsl(15, 85%, 35%)',
      accent: 'hsl(40, 80%, 55%)',
      shadows: 'hsl(10, 50%, 15%)',
    },
    mood: 'intimate',
  },
  {
    id: 'overcast_drama',
    name: 'Overcast Drama',
    description: 'Soft diffused light from cloudy sky, moody and contemplative atmosphere',
    category: 'exterior',
    lighting: {
      type: 'natural',
      direction: 'overhead',
      intensity: 'soft',
      temperature: 'cool',
      timeOfDay: 'overcast',
    },
    colorPalette: {
      primary: 'hsl(210, 20%, 60%)',
      secondary: 'hsl(200, 15%, 50%)',
      accent: 'hsl(180, 25%, 45%)',
      shadows: 'hsl(220, 25%, 35%)',
    },
    mood: 'contemplative',
  },
];

// Featured templates (built-in since no DB templates exist yet)
interface BuiltInTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  genre: string;
  mood: string;
  clipCount: number;
  targetDurationMinutes: number;
  colorGrading: string;
  environmentId?: string;
  conceptPrompt: string;
}

const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [
  {
    id: 'featured-1',
    name: 'Epic Product Launch',
    description: 'Dramatic reveal sequence with cinematic transitions and impactful music cues',
    category: 'commercial',
    genre: 'ad',
    mood: 'epic',
    clipCount: 8,
    targetDurationMinutes: 2,
    colorGrading: 'cinematic',
    environmentId: 'modern_minimalist',
    conceptPrompt: 'A dramatic product reveal sequence. Start with mysterious close-ups shrouded in shadow, slowly unveiling features with spotlight reveals. Build tension with quick cuts showing premium details and craftsmanship. Climax with the full product reveal in stunning light, showcasing its elegance and innovation.',
  },
  {
    id: 'featured-2',
    name: 'Documentary Storyteller',
    description: 'Professional documentary style with interview segments and B-roll integration',
    category: 'cinematic',
    genre: 'documentary',
    mood: 'emotional',
    clipCount: 6,
    targetDurationMinutes: 5,
    colorGrading: 'documentary',
    environmentId: 'golden_hour_studio',
    conceptPrompt: 'A compelling documentary narrative exploring a meaningful journey. Open with establishing shots of the environment. Weave between interview-style moments and evocative B-roll footage. Build emotional resonance through personal stories, showing struggle and triumph. End with reflection and hope for the future.',
  },
  {
    id: 'featured-3',
    name: 'Social Media Series',
    description: 'Fast-paced, engaging content optimized for TikTok and Instagram Reels',
    category: 'entertainment',
    genre: 'vlog',
    mood: 'uplifting',
    clipCount: 5,
    targetDurationMinutes: 1,
    colorGrading: 'warm',
    conceptPrompt: 'Quick, punchy social media content with high energy. Hook viewers in the first second with something surprising. Fast cuts, dynamic movements, and vibrant visuals. Keep the pace relentless with quick transitions. End with a memorable moment that demands a share or replay.',
  },
  {
    id: 'template-edu-1',
    name: 'Educational Explainer',
    description: 'Clear, engaging educational content with visual demonstrations',
    category: 'educational',
    genre: 'educational',
    mood: 'uplifting',
    clipCount: 8,
    targetDurationMinutes: 3,
    colorGrading: 'neutral',
    environmentId: 'modern_minimalist',
    conceptPrompt: 'An educational video that breaks down a complex topic into digestible segments. Start with a hook that shows why this matters. Use visual metaphors and demonstrations to illustrate key concepts. Progress logically from basics to deeper understanding. End with a clear summary and call to action.',
  },
  {
    id: 'template-story-1',
    name: 'Short Film Drama',
    description: 'Cinematic narrative with emotional depth and character development',
    category: 'cinematic',
    genre: 'storytelling',
    mood: 'emotional',
    clipCount: 10,
    targetDurationMinutes: 4,
    colorGrading: 'cinematic',
    environmentId: 'golden_hour_studio',
    conceptPrompt: 'A short dramatic narrative with compelling characters. Establish the world and introduce the protagonist facing a challenge. Build tension through obstacles and choices. Develop emotional stakes through character moments. Reach a climactic turning point. Resolve with meaningful change and reflection.',
  },
  {
    id: 'template-noir-1',
    name: 'Noir Mystery',
    description: 'Atmospheric noir thriller with high contrast and moody lighting',
    category: 'cinematic',
    genre: 'cinematic',
    mood: 'mysterious',
    clipCount: 8,
    targetDurationMinutes: 3,
    colorGrading: 'noir',
    environmentId: 'neon_noir_city',
    conceptPrompt: 'A noir mystery unfolding in rain-soaked city streets. Open on a solitary figure in the shadows. Reveal clues through atmospheric shots and tense encounters. Build paranoia with surveillance angles and reflective surfaces. Maintain ambiguity between hunter and hunted. End on a morally complex resolution.',
  },
  {
    id: 'template-action-1',
    name: 'Action Sequence',
    description: 'High-energy action scenes with dynamic camera movements',
    category: 'cinematic',
    genre: 'cinematic',
    mood: 'action',
    clipCount: 6,
    targetDurationMinutes: 2,
    colorGrading: 'cinematic',
    environmentId: 'neon_noir_city',
    conceptPrompt: 'An adrenaline-fueled action sequence with relentless energy. Open with a moment of calm before the storm. Explode into motion with rapid cuts and dynamic camera movements. Alternate between wide establishing shots and intense close-ups. Build through escalating stakes and obstacles. Climax with a spectacular final moment of triumph or escape.',
  },
  {
    id: 'template-corp-1',
    name: 'Corporate Presentation',
    description: 'Professional business videos with clean, modern aesthetics',
    category: 'corporate',
    genre: 'ad',
    mood: 'uplifting',
    clipCount: 8,
    targetDurationMinutes: 3,
    colorGrading: 'neutral',
    environmentId: 'modern_minimalist',
    conceptPrompt: 'A polished corporate presentation showcasing innovation and professionalism. Open with establishing shots of modern architecture or technology. Introduce the company vision through clean, purposeful visuals. Highlight key achievements and capabilities with data-driven imagery. Feature team collaboration and expertise. Close with a confident look toward the future and clear call to action.',
  },
];

// Convert environment DNA to a comprehensive prompt string
function environmentToPrompt(env: EnvironmentDNA): string {
  const lightingDesc = [
    env.lighting.type === 'natural' ? 'natural lighting' : `${env.lighting.type} lighting`,
    `${env.lighting.intensity} intensity`,
    `${env.lighting.direction} direction`,
    `${env.lighting.temperature} color temperature`,
    env.lighting.timeOfDay === 'golden_hour' ? 'golden hour' : env.lighting.timeOfDay,
  ].join(', ');

  return `${env.description}. ${lightingDesc}. ${env.mood} mood and atmosphere. ${env.category} setting.`;
}

// Shot sequence item from rich templates
export interface TemplateShotSequence {
  index: number;
  title: string;
  description: string;
  durationSeconds: number;
  sceneType: string;
  cameraScale: string;
  cameraAngle: string;
  movementType: string;
  mood: string;
  dialogue?: string;
}

// Style anchor from rich templates
export interface TemplateStyleAnchor {
  visualStyle: string;
  colorGrading: string;
  lightingStyle: string;
  cameraPhilosophy: string;
  pacingNotes: string;
}

// Character template from rich templates
export interface TemplateCharacter {
  name: string;
  role: string;
  appearance: string;
  personality: string;
  voiceStyle?: string;
}

// Environment lock from rich templates
export interface TemplateEnvironmentLock {
  lighting: string;
  colorPalette: string;
  timeOfDay: string;
  weather: string;
  location: string;
  prompt: string;
}

export interface AppliedSettings {
  concept: string;
  mood: string;
  genre: string;
  clipCount: number;
  colorGrading: string;
  environmentPrompt: string;
  templateName?: string;
  environmentName?: string;
  // Rich template data
  shotSequence?: TemplateShotSequence[];
  styleAnchor?: TemplateStyleAnchor;
  characterTemplates?: TemplateCharacter[];
  environmentLock?: TemplateEnvironmentLock;
  pacingStyle?: string;
}

export function useTemplateEnvironment() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [appliedSettings, setAppliedSettings] = useState<AppliedSettings | null>(null);
  
  const templateId = searchParams.get('template');
  const environmentId = searchParams.get('environment');

  // Load template from DB or built-in templates
  const loadTemplate = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      // First check built-in templates
      const builtIn = BUILT_IN_TEMPLATES.find(t => t.id === id);
      if (builtIn) {
        let envPrompt = '';
        let envName = '';
        
        if (builtIn.environmentId) {
          const env = ENVIRONMENT_PRESETS.find(e => e.id === builtIn.environmentId);
          if (env) {
            envPrompt = environmentToPrompt(env);
            envName = env.name;
          }
        }
        
        const settings: AppliedSettings = {
          concept: builtIn.conceptPrompt,
          mood: builtIn.mood,
          genre: builtIn.genre,
          clipCount: builtIn.clipCount,
          colorGrading: builtIn.colorGrading,
          environmentPrompt: envPrompt,
          templateName: builtIn.name,
          environmentName: envName || undefined,
        };
        
        setAppliedSettings(settings);
        toast.success(`Template "${builtIn.name}" loaded`);
        return settings;
      }

      // Try database templates
      const { data, error } = await supabase
        .from('project_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        toast.error('Template not found');
        return null;
      }

      // Parse rich template data with proper type casting through unknown
      const shotSequence = Array.isArray(data.shot_sequence) 
        ? (data.shot_sequence as unknown as TemplateShotSequence[])
        : undefined;
      
      const styleAnchor = data.style_anchor && typeof data.style_anchor === 'object' && !Array.isArray(data.style_anchor)
        ? (data.style_anchor as unknown as TemplateStyleAnchor)
        : undefined;
      
      const characterTemplates = Array.isArray(data.character_templates)
        ? (data.character_templates as unknown as TemplateCharacter[])
        : undefined;
      
      let envPrompt = '';
      let environmentLock: TemplateEnvironmentLock | undefined;
      if (data.environment_lock && typeof data.environment_lock === 'object') {
        const envLock = data.environment_lock as any;
        envPrompt = envLock.prompt || '';
        environmentLock = envLock as TemplateEnvironmentLock;
      }

      // Build concept from shot sequence if available
      let conceptPrompt = data.description || '';
      if (shotSequence && shotSequence.length > 0) {
        conceptPrompt = shotSequence.map(shot => 
          `[${shot.title}] ${shot.description}`
        ).join('\n\n');
      }

      const settings: AppliedSettings = {
        concept: conceptPrompt,
        mood: data.mood || 'epic',
        genre: data.genre || 'cinematic',
        clipCount: data.clip_count || shotSequence?.length || 6,
        colorGrading: data.color_grading || styleAnchor?.colorGrading || 'cinematic',
        environmentPrompt: envPrompt,
        templateName: data.name,
        // Rich template data
        shotSequence,
        styleAnchor,
        characterTemplates,
        environmentLock,
        pacingStyle: data.pacing_style || undefined,
      };

      setAppliedSettings(settings);
      toast.success(`Template "${data.name}" loaded with ${shotSequence?.length || data.clip_count || 6} shots`);
      return settings;
    } catch (err) {
      console.error('Error loading template:', err);
      toast.error('Failed to load template');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load environment by ID
  const loadEnvironment = useCallback((id: string) => {
    const env = ENVIRONMENT_PRESETS.find(e => e.id === id);
    if (!env) {
      toast.error('Environment not found');
      return null;
    }

    const envPrompt = environmentToPrompt(env);
    
    const settings: AppliedSettings = {
      concept: '',
      mood: env.mood,
      genre: 'cinematic',
      clipCount: 6,
      colorGrading: env.mood === 'dramatic' ? 'noir' : env.mood === 'professional' ? 'neutral' : 'cinematic',
      environmentPrompt: envPrompt,
      environmentName: env.name,
    };

    setAppliedSettings(settings);
    toast.success(`Environment "${env.name}" applied`);
    return settings;
  }, []);

  // Clear query params after loading
  const clearParams = useCallback(() => {
    if (templateId || environmentId) {
      setSearchParams({}, { replace: true });
    }
  }, [templateId, environmentId, setSearchParams]);

  // Auto-load on mount if params present
  useEffect(() => {
    const loadFromParams = async () => {
      if (templateId) {
        await loadTemplate(templateId);
        clearParams();
      } else if (environmentId) {
        loadEnvironment(environmentId);
        clearParams();
      }
    };
    loadFromParams();
  }, [templateId, environmentId, loadTemplate, loadEnvironment, clearParams]);

  return {
    isLoading,
    appliedSettings,
    templateId,
    environmentId,
    loadTemplate,
    loadEnvironment,
    clearAppliedSettings: () => setAppliedSettings(null),
    getEnvironmentPresets: () => ENVIRONMENT_PRESETS,
    getBuiltInTemplates: () => BUILT_IN_TEMPLATES,
  };
}
