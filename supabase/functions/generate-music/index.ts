import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * WORLD-CLASS MUSIC GENERATION ENGINE
 * 
 * Hans Zimmer-level cinematic scoring using Replicate's MusicGen Stereo Large.
 * Features:
 * - AI scene analysis for perfect music-to-visual matching
 * - Emotion-driven orchestration selection
 * - Multi-layer composition with primary + accent instruments
 * - Dynamic intensity curves matching scene arcs
 */

interface MusicRequest {
  prompt: string;
  duration?: number;
  mood?: string;
  genre?: string;
  projectId?: string;
  sceneType?: string;
  emotionalArc?: string;
  intensity?: 'subtle' | 'moderate' | 'intense' | 'explosive';
  tempo?: 'slow' | 'moderate' | 'fast' | 'variable';
  // New: Advanced scoring options
  filmStyle?: string;
  instrumentFocus?: string[];
  referenceComposer?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// HANS ZIMMER-LEVEL SCORING PROFILES
// ═══════════════════════════════════════════════════════════════════════════

const COMPOSER_STYLES: Record<string, string> = {
  'hans-zimmer': 'massive orchestral layers, pulsing synthesizer bass, BRAAAM horn hits, driving ostinato patterns, emotional string swells building to crescendo, Inception-style time-stretched brass, Interstellar organ textures, Dark Knight percussion hits',
  'john-williams': 'sweeping melodic themes, lush romantic strings, heroic brass fanfares, playful woodwinds, classical Hollywood golden age orchestration, soaring violin melodies, triumphant French horn, adventure leitmotifs',
  'ennio-morricone': 'haunting whistled melodies, twangy electric guitar, dramatic choral vocals, sparse atmospheric tension, Spaghetti Western textures, ethereal soprano voices, harmonica accents, sweeping desert landscapes',
  'howard-shore': 'dark medieval orchestration, Celtic folk elements, massive choir, deep bass drones, epic battle percussion, Lord of the Rings style themes, ancient instrument textures, mythic grandeur',
  'thomas-newman': 'minimalist piano motifs, quirky percussion, warm acoustic textures, gentle plucked strings, American Beauty style introspection, subtle electronic elements, delicate emotional underscoring',
  'alexandre-desplat': 'elegant French sophistication, chamber orchestra intimacy, playful yet emotional, delicate woodwind conversations, refined European sensibility, subtle orchestration, whimsical charm',
  'ludwig-goransson': 'modern hybrid scoring, tribal percussion, Black Panther Afrofuturist textures, Mandalorian Western-electronic fusion, innovative sound design, contemporary orchestral-electronic hybrid',
  'ramin-djawadi': 'Game of Thrones medieval grandeur, cello-driven themes, building tension, epic battle sequences, Westworld player piano deconstruction, dramatic string arrangements',
};

const SCENE_MUSIC_PROFILES: Record<string, {
  tempo: string;
  key: string;
  instruments: string;
  dynamics: string;
  texture: string;
}> = {
  'epic-battle': {
    tempo: '140-160 BPM driving rhythm',
    key: 'D minor or E minor for power',
    instruments: 'massive brass section, thundering taiko drums, aggressive string ostinatos, choir shouting',
    dynamics: 'constant intensity with crescendo peaks at impact moments',
    texture: 'thick layered orchestration, wall of sound'
  },
  'emotional-revelation': {
    tempo: '60-80 BPM slow breathing pace',
    key: 'A minor or F major for vulnerability',
    instruments: 'solo piano, intimate strings, gentle woodwind colors, subtle choir',
    dynamics: 'soft beginning building to cathartic climax',
    texture: 'sparse then gradually layering, space between notes'
  },
  'tension-suspense': {
    tempo: '90-110 BPM unsettling pulse',
    key: 'diminished chords, tritones, unresolved harmony',
    instruments: 'col legno strings, prepared piano, low brass drones, heartbeat percussion',
    dynamics: 'quiet with sudden stingers, gradual build',
    texture: 'thin and exposed, uncomfortable silences'
  },
  'romantic-love': {
    tempo: '70-90 BPM flowing waltz-like',
    key: 'D major or G major for warmth',
    instruments: 'lush strings, romantic piano, harp glissandos, French horn',
    dynamics: 'gentle swells, tender crescendos',
    texture: 'rich harmonies, enveloping warmth'
  },
  'adventure-journey': {
    tempo: '120-140 BPM energetic forward motion',
    key: 'C major or B-flat major for heroism',
    instruments: 'heroic brass fanfares, driving strings, snare rhythms, soaring melodies',
    dynamics: 'exciting peaks and valleys, triumphant moments',
    texture: 'clear themes, memorable motifs'
  },
  'horror-dread': {
    tempo: '50-70 BPM crawling unease',
    key: 'atonal clusters, microtonal bends',
    instruments: 'screeching violins, prepared piano, reversed sounds, sub-bass rumbles',
    dynamics: 'whisper quiet with shock crescendos',
    texture: 'abstract textures, sound design elements'
  },
  'sci-fi-wonder': {
    tempo: '80-100 BPM floating ethereal',
    key: 'lydian mode for otherworldly feel',
    instruments: 'synthesizers, processed orchestra, glass harmonica textures, cosmic pads',
    dynamics: 'expansive swells, infinite space',
    texture: 'layered synths with orchestral accents'
  },
  'action-chase': {
    tempo: '150-180 BPM relentless drive',
    key: 'E minor for urgency',
    instruments: 'pounding drums, staccato brass, racing strings, electronic pulses',
    dynamics: 'constant high energy with brief drops for tension',
    texture: 'driving rhythmic patterns, relentless momentum'
  },
  'mystery-intrigue': {
    tempo: '70-90 BPM contemplative',
    key: 'Dorian mode for ambiguity',
    instruments: 'muted brass, pizzicato strings, vibraphone, solo clarinet',
    dynamics: 'understated with curious melodic fragments',
    texture: 'noir jazz influences, smoky atmosphere'
  },
  'triumph-victory': {
    tempo: '100-120 BPM majestic march',
    key: 'D major or E-flat major for grandeur',
    instruments: 'full brass choir, timpani, cymbal crashes, triumphant strings, choir',
    dynamics: 'building to massive climax, sustained glory',
    texture: 'rich full orchestration, anthem-like'
  },
  'melancholy-loss': {
    tempo: '50-70 BPM heavy slow',
    key: 'B-flat minor or E minor for sadness',
    instruments: 'solo cello, weeping strings, solo piano, gentle choir',
    dynamics: 'soft throughout with emotional swells',
    texture: 'minimal arrangement, emotional space'
  },
  'comedy-playful': {
    tempo: '120-140 BPM bouncy light',
    key: 'F major or C major for brightness',
    instruments: 'playful woodwinds, pizzicato strings, xylophone, quirky percussion',
    dynamics: 'light and airy with comic timing',
    texture: 'thin textures, staccato articulations'
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// MOOD PROMPTS - ENHANCED HANS ZIMMER QUALITY
// ═══════════════════════════════════════════════════════════════════════════

const MOOD_PROMPTS: Record<string, string> = {
  epic: `HANS ZIMMER STYLE epic orchestral masterpiece: Massive brass section with BRAAAM horn impacts, 
    thundering 200-piece orchestra, driving 8-note ostinato pattern like Inception, 
    emotional string swells building through three crescendos, tribal taiko drums, 
    synthesizer bass pulses at 28Hz for physical impact, choir singing in Latin, 
    final triumphant resolution with full orchestra fff fortissimo, 
    professional Hollywood blockbuster production quality, 
    recorded at Abbey Road Studios sound`,
    
  tension: `Psychological thriller underscore: Low frequency drones at 40Hz creating unease, 
    col legno strings scratching like insects, prepared piano with muted strings, 
    heartbeat-like bass drum at 72 BPM, tritone intervals for dissonance, 
    sudden silence followed by stinger hits, building anxiety through 
    layered dissonant clusters, Sicario-style bass drops, 
    Hans Zimmer Dunkirk ticking clock urgency, 
    professional film scoring production`,
    
  emotional: `Oscar-winning emotional score: Solo piano introducing vulnerable theme in A minor, 
    gradually joined by intimate string quartet, building to full string orchestra, 
    melody that breaks into major key for hope, cello solo carrying the emotional weight, 
    gentle woodwind colors, subtle choir humming, 
    Thomas Newman-style delicate beauty, 
    Alexandre Desplat elegance, 
    tearjerker crescendo to cathartic release, 
    professional dramatic film production`,
    
  action: `Explosive action movie score: 160 BPM relentless driving rhythm, 
    aggressive brass stabs, racing string ostinatos, 
    massive percussion battery including taiko and industrial elements, 
    Hans Zimmer Dark Knight intensity, electronic bass pulses, 
    Ludwig Goransson Black Panther energy, 
    constant forward momentum with brief tension drops, 
    professional blockbuster action production`,
    
  mysterious: `Enigmatic mystery score: Suspended harmonies in Dorian mode, 
    solo clarinet weaving through muted brass, 
    pizzicato bass creating noir atmosphere, 
    vibraphone shimmers, processed piano textures, 
    Trent Reznor atmospheric darkness, 
    unsettling beauty, questions without answers, 
    film noir sophistication, 
    professional mystery film production`,
    
  uplifting: `Inspirational triumph score: Beginning with solo piano hope motif, 
    building through string layers to full orchestra, 
    heroic French horn stating main theme, 
    triumphant brass fanfare at climax, 
    John Williams soaring melody style, 
    emotional catharsis, tears of joy, 
    snare drum march building momentum, 
    professional inspirational film production`,
    
  dark: `Ominous dark score: Sub-bass drones creating physical dread, 
    detuned strings sliding through dissonance, 
    industrial percussion like machinery, 
    Hans Zimmer Blade Runner 2049 textures, 
    choir singing in minor with descending lines, 
    brass swells like approaching doom, 
    horror-adjacent tension, 
    professional dark film production`,
    
  romantic: `Sweeping romantic score: Lush string arrangement in D major, 
    passionate violin solo with vibrato, 
    romantic piano arpeggios, 
    French horn warm counter-melody, 
    harp glissandos like falling in love, 
    building to passionate climax, 
    John Barry elegance, 
    professional romantic drama production`,
    
  adventure: `Epic adventure score: Heroic main theme stated by French horn, 
    driving string rhythm propelling forward, 
    brass fanfares announcing triumph, 
    John Williams Raiders of the Lost Ark energy, 
    memorable melodic hook, 
    building excitement through key changes, 
    snare drum march, 
    professional adventure film production`,
    
  scifi: `Futuristic sci-fi score: Synthesizer pads creating vast space, 
    processed orchestra with electronic treatments, 
    Hans Zimmer Interstellar organ grandeur, 
    Vangelis Blade Runner textures, 
    cosmic wonder and scale, 
    electronic pulses representing technology, 
    otherworldly lydian mode harmonies, 
    professional science fiction production`,
    
  calm: `Serene ambient score: Gentle piano with sustain pedal bloom, 
    warm pad synths, 
    soft string harmonics, 
    breathing space between notes, 
    Thomas Newman American Beauty contemplation, 
    peaceful resolution, 
    professional ambient film production`,
    
  happy: `Joyful upbeat score: Major key brightness, 
    playful woodwind melodies, 
    bouncy pizzicato strings, 
    light percussion with tambourine, 
    Alexandre Desplat whimsy, 
    infectious optimism, 
    professional comedy production`,
    
  cinematic: `Premium cinematic score: Full Hollywood orchestra, 
    emotional depth and range, 
    professional arranging with thematic development, 
    dynamic range from whisper to thunder, 
    Hans Zimmer production values, 
    John Williams melodic sensibility, 
    recorded with world-class musicians, 
    blockbuster film quality`,
    
  horror: `Terrifying horror score: Atonal string clusters, 
    sudden loud stingers after silence, 
    reversed and processed sounds, 
    Penderecki-style extended techniques, 
    sub-bass rumbles creating physical dread, 
    whispered vocals, 
    music box detuned and slowed, 
    professional horror film production`,
    
  comedy: `Comedic score with perfect timing: Light orchestration with playful woodwinds, 
    pizzicato strings for comedic walks, 
    xylophone and glockenspiel accents, 
    trombone slides for pratfalls, 
    quirky rhythmic surprises, 
    Alexandre Desplat Grand Budapest Hotel charm, 
    professional comedy film production`,

  // NEW ENHANCED MOODS
  'war-documentary': `Somber war documentary score: Solo trumpet playing taps-like melody,
    mournful strings, military snare drum, 
    emotional weight of sacrifice, 
    Hans Zimmer Thin Red Line contemplation,
    building to brass choir memorial,
    professional documentary production`,

  'nature-documentary': `Majestic nature score: Sweeping strings painting landscapes,
    ethnic instruments for cultural flavor,
    Hans Zimmer Planet Earth grandeur,
    building wonder at natural beauty,
    professional nature documentary production`,

  'sports-triumph': `Inspirational sports score: Building from underdog theme,
    driving percussion representing training,
    electronic elements for modernity,
    triumphant brass at victory moment,
    Hans Zimmer/Junkie XL collaboration energy,
    professional sports film production`,

  'heist-cool': `Sophisticated heist score: Jazz-influenced cool,
    walking bass line, brushed drums,
    Lalo Schifrin Mission Impossible energy,
    building tension for the job,
    professional heist thriller production`,

  'psychological-drama': `Intimate psychological score: Minimal piano phrases,
    unsettling silence between notes,
    subtle electronic processing,
    Jonny Greenwood There Will Be Blood intensity,
    professional psychological drama production`,
};

const GENRE_MODIFIERS: Record<string, string> = {
  orchestral: 'full 100-piece symphony orchestra recorded at Abbey Road Studios, professional Hollywood sound',
  electronic: 'cutting-edge synthesizers, modular textures, Hans Zimmer hybrid scoring, Blade Runner 2049 production',
  hybrid: 'seamless orchestral-electronic fusion, Junkie XL production style, massive layered sound design',
  minimal: 'Thomas Newman minimalism, sparse elegance, emotional space, delicate beauty',
  piano: 'solo Steinway concert grand, intimate emotional performance, Oscar-worthy drama',
  acoustic: 'organic natural instruments, warm recorded sound, folk authenticity',
  synthwave: 'retro 80s synthesizers, neon-lit atmosphere, Stranger Things nostalgia, analog warmth',
  ambient: 'Brian Eno atmospheric textures, evolving soundscapes, meditative depth',
  choral: 'massive choir, Latin text, cathedral reverb, Hans Zimmer Gladiator grandeur',
  percussive: 'world percussion orchestra, taiko drums, African rhythms, tribal energy',
  jazz: 'sophisticated jazz orchestra, film noir saxophone, Lalo Schifrin cool',
  world: 'ethnic instruments from around the globe, cultural authenticity, Ludwig Goransson innovation',
};

// ═══════════════════════════════════════════════════════════════════════════
// REPLICATE MUSICGEN STEREO LARGE - WORLD CLASS GENERATION
// ═══════════════════════════════════════════════════════════════════════════

async function generateWorldClassMusic(
  prompt: string,
  duration: number,
  options: {
    temperature?: number;
    guidance?: number;
    topK?: number;
    topP?: number;
  } = {}
): Promise<string | null> {
  const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
  
  if (!REPLICATE_API_KEY) {
    console.error("[Music-WorldClass] No REPLICATE_API_KEY configured");
    return null;
  }
  
  try {
    console.log(`[Music-WorldClass] Generating ${duration}s Hans Zimmer-level score`);
    console.log(`[Music-WorldClass] Prompt: ${prompt.substring(0, 200)}...`);
    
    // MusicGen Stereo Large - best quality model for cinematic music
    const createResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "b05b1dff1d8c6dc63d14b0cdb42135378dcb87f6373b0d3d341ede46e59e2b38", // MusicGen Stereo Large
        input: {
          prompt: prompt,
          duration: Math.min(30, Math.max(5, duration)),
          output_format: "mp3",
          normalization_strategy: "loudness",
          // World-class generation settings
          top_k: options.topK || 250,
          top_p: options.topP || 0.95,
          temperature: options.temperature || 1.0,
          classifier_free_guidance: options.guidance || 4, // Higher for more prompt adherence
        },
      }),
    });
    
    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error("[Music-WorldClass] Create failed:", errorText);
      return await generateWithMusicGenMelody(prompt, duration);
    }
    
    const prediction = await createResponse.json();
    console.log("[Music-WorldClass] Prediction started:", prediction.id);
    
    // Poll for completion (max 5 minutes for world-class generation)
    const maxAttempts = 60;
    const pollInterval = 5000;
    
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { "Authorization": `Bearer ${REPLICATE_API_KEY}` },
      });
      
      if (!statusResponse.ok) continue;
      
      const status = await statusResponse.json();
      console.log(`[Music-WorldClass] Status: ${status.status} (attempt ${i + 1}/${maxAttempts})`);
      
      if (status.status === "succeeded" && status.output) {
        console.log("[Music-WorldClass] ✅ World-class music generated!");
        return status.output;
      }
      
      if (status.status === "failed" || status.status === "canceled") {
        console.error("[Music-WorldClass] Failed:", status.error);
        return await generateWithMusicGenMelody(prompt, duration);
      }
    }
    
    console.warn("[Music-WorldClass] Polling timed out");
    return null;
    
  } catch (error) {
    console.error("[Music-WorldClass] Error:", error);
    return null;
  }
}

// Fallback: MusicGen Melody for melody-guided generation
async function generateWithMusicGenMelody(
  prompt: string,
  duration: number
): Promise<string | null> {
  const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
  if (!REPLICATE_API_KEY) return null;
  
  try {
    console.log("[Music-Melody] Attempting MusicGen Melody fallback...");
    
    const createResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "671ac645ce5e552cc63a54a2bbff63fcf798043ac92924f3aa87f5ae093e64c6", // musicgen-melody
        input: {
          prompt: prompt,
          duration: Math.min(30, Math.max(5, duration)),
          output_format: "mp3",
          top_k: 250,
          top_p: 0.95,
          temperature: 1.0,
          classifier_free_guidance: 3,
        },
      }),
    });
    
    if (!createResponse.ok) return null;
    
    const prediction = await createResponse.json();
    
    // Poll for completion
    for (let i = 0; i < 36; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { "Authorization": `Bearer ${REPLICATE_API_KEY}` },
      });
      
      const status = await statusResponse.json();
      
      if (status.status === "succeeded" && status.output) {
        console.log("[Music-Melody] ✅ Melody generation succeeded!");
        return status.output;
      }
      
      if (status.status === "failed") {
        console.error("[Music-Melody] Failed:", status.error);
        return null;
      }
    }
    
    return null;
  } catch (error) {
    console.error("[Music-Melody] Error:", error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// INTELLIGENT SCENE ANALYSIS FOR MUSIC
// ═══════════════════════════════════════════════════════════════════════════

function analyzeSceneForMusic(request: MusicRequest): string {
  const parts: string[] = [];
  
  // Start with reference composer style if specified
  if (request.referenceComposer && COMPOSER_STYLES[request.referenceComposer]) {
    parts.push(COMPOSER_STYLES[request.referenceComposer]);
  }
  
  // Add scene-specific profile if available
  if (request.sceneType && SCENE_MUSIC_PROFILES[request.sceneType]) {
    const profile = SCENE_MUSIC_PROFILES[request.sceneType];
    parts.push(`${profile.tempo}, ${profile.key}, featuring ${profile.instruments}, ${profile.dynamics}, ${profile.texture}`);
  }
  
  // Add mood prompt
  if (request.mood && MOOD_PROMPTS[request.mood]) {
    parts.push(MOOD_PROMPTS[request.mood]);
  }
  
  // Add genre modifier
  if (request.genre && GENRE_MODIFIERS[request.genre]) {
    parts.push(GENRE_MODIFIERS[request.genre]);
  }
  
  // Add intensity layer
  if (request.intensity) {
    const intensityMap: Record<string, string> = {
      subtle: 'understated and delicate, soft dynamics, intimate feeling',
      moderate: 'balanced dynamics, clear emotional presence without overwhelming',
      intense: 'powerful emotional impact, strong dynamics, memorable themes',
      explosive: 'maximum impact, fortissimo climaxes, wall of sound, theatrical grandeur'
    };
    parts.push(intensityMap[request.intensity]);
  }
  
  // Add tempo guidance
  if (request.tempo) {
    const tempoMap: Record<string, string> = {
      slow: 'slow tempo around 60-80 BPM, breathing space, contemplative',
      moderate: 'moderate tempo around 90-110 BPM, steady pulse',
      fast: 'fast driving tempo 130-160 BPM, energetic momentum',
      variable: 'tempo changes following emotional arc, rubato moments'
    };
    parts.push(tempoMap[request.tempo]);
  }
  
  // Add emotional arc
  if (request.emotionalArc) {
    parts.push(`emotional arc: ${request.emotionalArc}`);
  }
  
  // Add instrument focus
  if (request.instrumentFocus && request.instrumentFocus.length > 0) {
    parts.push(`featuring prominent ${request.instrumentFocus.join(', ')}`);
  }
  
  // Add user's custom prompt
  if (request.prompt && request.prompt.trim()) {
    parts.push(request.prompt);
  }
  
  // If nothing specified, use epic cinematic default
  if (parts.length === 0) {
    parts.push(MOOD_PROMPTS['cinematic']);
  }
  
  // Add quality suffix
  parts.push('professional film score quality, studio recorded, world-class production');
  
  return parts.join('. ');
}

// Upload to storage
async function uploadToStorage(
  audioUrl: string,
  projectId: string,
  supabase: any
): Promise<string | null> {
  try {
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) return null;
    
    const audioBuffer = await audioResponse.arrayBuffer();
    const fileName = `${projectId}/world-class-music-${Date.now()}.mp3`;
    
    const { error: uploadError } = await supabase.storage
      .from("voice-tracks")
      .upload(fileName, audioBuffer, {
        contentType: "audio/mpeg",
        upsert: true,
      });
    
    if (uploadError) {
      console.error("[Music] Upload error:", uploadError);
      return null;
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from("voice-tracks")
      .getPublicUrl(fileName);
    
    console.log("[Music] ✅ Uploaded world-class track:", publicUrl);
    return publicUrl;
    
  } catch (error) {
    console.error("[Music] Upload failed:", error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ═══ AUTH GUARD: Prevent unauthorized API credit consumption ═══
    const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
    if (!auth.authenticated) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    const request: MusicRequest = await req.json();
    const { 
      duration = 30, 
      projectId,
      mood,
      genre,
      sceneType,
      emotionalArc,
      intensity,
      tempo,
      filmStyle,
      instrumentFocus,
      referenceComposer
    } = request;

    console.log(`[Music-WorldClass] 🎬 Generating Hans Zimmer-level score`);
    console.log(`[Music-WorldClass] Scene: ${sceneType || 'cinematic'}, Mood: ${mood || 'epic'}`);
    console.log(`[Music-WorldClass] Reference: ${referenceComposer || 'hans-zimmer'}`);

    // Build world-class prompt using scene analysis
    const finalPrompt = analyzeSceneForMusic({
      ...request,
      referenceComposer: referenceComposer || (mood === 'epic' ? 'hans-zimmer' : undefined)
    });

    console.log(`[Music-WorldClass] Final prompt length: ${finalPrompt.length} chars`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

    // Generate world-class music with optimized settings based on mood
    const generationSettings = {
      temperature: intensity === 'explosive' ? 1.1 : 1.0,
      guidance: mood === 'epic' || mood === 'action' ? 5 : 4,
      topK: 250,
      topP: 0.95
    };

    const musicUrl = await generateWorldClassMusic(finalPrompt, duration, generationSettings);
    
    if (musicUrl && supabase && projectId) {
      const storedUrl = await uploadToStorage(musicUrl, projectId, supabase);
      const finalUrl = storedUrl || musicUrl;
      
      if (storedUrl) {
        await supabase
          .from('movie_projects')
          .update({ music_url: storedUrl })
          .eq('id', projectId);
      }
      
      // Log cost
      try {
        await supabase.rpc('log_api_cost', {
          p_project_id: projectId,
          p_shot_id: 'world_class_music',
          p_service: 'replicate-musicgen-stereo',
          p_operation: 'generate_world_class_music',
          p_credits_charged: 0,
          p_real_cost_cents: 8, // Premium quality
          p_duration_seconds: duration,
          p_status: 'completed',
          p_metadata: JSON.stringify({
            mood,
            genre,
            sceneType,
            intensity,
            referenceComposer,
            provider: 'replicate-musicgen-stereo-large',
            quality: 'world-class',
          }),
        });
      } catch (e) {
        console.warn("[Music] Cost log failed:", e);
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          musicUrl: finalUrl,
          durationSeconds: duration,
          prompt: finalPrompt.substring(0, 500),
          source: "replicate-musicgen-stereo-large",
          quality: "world-class",
          hasMusic: true,
          metadata: {
            mood,
            genre,
            sceneType,
            intensity,
            referenceComposer: referenceComposer || 'hans-zimmer',
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[Music] ⚠️ No music generated");
    
    return new Response(
      JSON.stringify({
        success: true,
        musicUrl: null,
        durationSeconds: duration,
        prompt: finalPrompt.substring(0, 500),
        message: "Music generation unavailable. Video will proceed without background music.",
        source: "none",
        hasMusic: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Music-WorldClass] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Music generation failed",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
