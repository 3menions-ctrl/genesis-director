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
    name: 'Cinematic Product Reveal',
    description: 'Stunning product showcase with dramatic lighting and slow-motion reveals',
    category: 'commercial',
    genre: 'ad',
    mood: 'epic',
    clipCount: 8,
    targetDurationMinutes: 2,
    colorGrading: 'cinematic',
    environmentId: 'modern_minimalist',
    conceptPrompt: 'A stunning product reveal with dramatic cinematic flair. Open with abstract close-ups in shadow, light catching edges and textures. Slow-motion reveals showcase premium craftsmanship. Build anticipation with quick cuts of intricate details. Climax with the full product bathed in spotlight, rotating elegantly. End with the brand moment.',
  },
  {
    id: 'featured-2',
    name: 'Documentary Story',
    description: 'Authentic storytelling with intimate interviews and cinematic B-roll',
    category: 'cinematic',
    genre: 'documentary',
    mood: 'emotional',
    clipCount: 12,
    targetDurationMinutes: 5,
    colorGrading: 'documentary',
    environmentId: 'golden_hour_studio',
    conceptPrompt: 'An intimate documentary exploring a compelling human story. Open with atmospheric establishing shots. Weave between candid interview moments and evocative B-roll. Show the journey through struggle and perseverance. Capture authentic emotions and pivotal moments. End with reflection, growth, and hope.',
  },
  {
    id: 'featured-3',
    name: 'Viral Social Content',
    description: 'Hook-driven content engineered for maximum engagement on TikTok & Reels',
    category: 'entertainment',
    genre: 'vlog',
    mood: 'uplifting',
    clipCount: 5,
    targetDurationMinutes: 1,
    colorGrading: 'warm',
    conceptPrompt: 'Explosive social content designed to stop the scroll. Hook viewers instantly with something unexpected. Rapid-fire cuts with dynamic energy and bold visuals. Build momentum with escalating surprises. Deliver a satisfying payoff that demands replay and sharing.',
  },
  {
    id: 'template-edu-1',
    name: 'Educational Breakdown',
    description: 'Visual explainers that make complex topics simple and engaging',
    category: 'educational',
    genre: 'educational',
    mood: 'uplifting',
    clipCount: 8,
    targetDurationMinutes: 3,
    colorGrading: 'neutral',
    environmentId: 'modern_minimalist',
    conceptPrompt: 'An engaging educational explainer that simplifies complexity. Hook with a relatable problem or question. Break down concepts using visual metaphors and demonstrations. Progress from foundational ideas to deeper insights. Reinforce learning with clear examples. End with actionable takeaways.',
  },
  {
    id: 'template-story-1',
    name: 'Short Film',
    description: 'Narrative-driven cinema with emotional arcs and compelling characters',
    category: 'cinematic',
    genre: 'storytelling',
    mood: 'emotional',
    clipCount: 10,
    targetDurationMinutes: 4,
    colorGrading: 'cinematic',
    environmentId: 'golden_hour_studio',
    conceptPrompt: 'A cinematic short film with emotional depth. Establish the world and introduce a compelling protagonist. Present a challenge that tests their character. Build tension through obstacles and meaningful choices. Reach an emotionally charged climax. Resolve with transformation and resonance.',
  },
  {
    id: 'template-noir-1',
    name: 'Neo-Noir Thriller',
    description: 'Moody atmospherics with neon-lit shadows and tension-building sequences',
    category: 'cinematic',
    genre: 'cinematic',
    mood: 'mysterious',
    clipCount: 8,
    targetDurationMinutes: 3,
    colorGrading: 'noir',
    environmentId: 'neon_noir_city',
    conceptPrompt: 'A neo-noir thriller dripping with atmosphere. Open on a solitary figure in neon-lit shadows. Reveal mystery through cryptic encounters and surveillance angles. Build paranoia with reflections and obscured faces. Maintain tension between predator and prey. End on an ambiguous, morally complex note.',
  },
  {
    id: 'template-action-1',
    name: 'Action Montage',
    description: 'High-octane sequences with dynamic movement and adrenaline-pumping cuts',
    category: 'cinematic',
    genre: 'cinematic',
    mood: 'action',
    clipCount: 6,
    targetDurationMinutes: 2,
    colorGrading: 'cinematic',
    environmentId: 'neon_noir_city',
    conceptPrompt: 'An adrenaline-fueled action montage with relentless energy. Start with tension before eruption. Explode into motion with rapid cuts and dynamic camera work. Alternate between wide action shots and intense close-ups. Escalate through obstacles and confrontations. Climax with a spectacular finale.',
  },
  {
    id: 'template-corp-1',
    name: 'Brand Story',
    description: 'Premium corporate narratives that humanize your brand identity',
    category: 'corporate',
    genre: 'ad',
    mood: 'uplifting',
    clipCount: 8,
    targetDurationMinutes: 3,
    colorGrading: 'neutral',
    environmentId: 'modern_minimalist',
    conceptPrompt: 'A premium brand story that connects on a human level. Open with aspirational imagery of innovation and excellence. Introduce the brand mission through purposeful visuals. Showcase team collaboration and real impact. Highlight achievements with authentic moments. Close with a confident vision for the future.',
  },
  {
    id: 'template-travel-1',
    name: 'Travel Vlog',
    description: 'Wanderlust-inducing journeys with stunning landscapes and authentic moments',
    category: 'entertainment',
    genre: 'vlog',
    mood: 'uplifting',
    clipCount: 8,
    targetDurationMinutes: 3,
    colorGrading: 'warm',
    environmentId: 'alpine_dawn',
    conceptPrompt: 'An immersive travel experience that ignites wanderlust. Open with breathtaking aerial landscapes. Journey through iconic locations and hidden gems. Capture authentic local encounters and cultural moments. Balance sweeping vistas with intimate details. End with a sunset reflection on the adventure.',
  },
  {
    id: 'template-music-1',
    name: 'Music Video',
    description: 'Rhythm-synced visuals with artistic flair and bold creative direction',
    category: 'entertainment',
    genre: 'cinematic',
    mood: 'epic',
    clipCount: 10,
    targetDurationMinutes: 4,
    colorGrading: 'cinematic',
    environmentId: 'neon_noir_city',
    conceptPrompt: 'A visually stunning music video with bold artistic direction. Open with an arresting visual hook. Sync movements and cuts to the rhythm. Build through escalating visual intensity. Feature striking compositions and lighting contrasts. Climax with the most powerful visual moment. End with a memorable final frame.',
  },
  {
    id: 'template-food-1',
    name: 'Food & Lifestyle',
    description: 'Appetizing food cinematography with warm, inviting aesthetics',
    category: 'commercial',
    genre: 'ad',
    mood: 'uplifting',
    clipCount: 6,
    targetDurationMinutes: 2,
    colorGrading: 'warm',
    environmentId: 'golden_hour_studio',
    conceptPrompt: 'Mouthwatering food cinematography that awakens the senses. Open with steam rising in warm light. Showcase ingredients in their natural beauty. Capture the artistry of preparation with close-ups. Build anticipation with sizzling textures and vibrant colors. Climax with the final plated masterpiece. End with the first satisfying bite.',
  },
  {
    id: 'template-tech-1',
    name: 'Tech Showcase',
    description: 'Sleek product demos with futuristic visuals and clean transitions',
    category: 'commercial',
    genre: 'ad',
    mood: 'epic',
    clipCount: 6,
    targetDurationMinutes: 2,
    colorGrading: 'cool',
    environmentId: 'modern_minimalist',
    conceptPrompt: 'A sleek tech showcase with futuristic aesthetics. Open with the device emerging from darkness. Highlight innovation through abstract light trails and reflections. Demonstrate features with clean, purposeful motion graphics. Show the product in lifestyle contexts. Build to a reveal of the complete ecosystem. End with the brand signature.',
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
