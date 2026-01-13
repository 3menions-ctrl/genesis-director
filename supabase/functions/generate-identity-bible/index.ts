import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * HYPER-DETAILED Identity Bible Generator (v4.0)
 * 
 * Uses Gemini 2.5 Pro for exhaustive character analysis:
 * 1. Multi-pass extraction (face, body, clothing, accessories)
 * 2. Micro-detail capture (exact colors, textures, patterns)
 * 3. Pose-invariant anchors for consistency across angles
 * 4. Anti-morphing specifications
 * 
 * This ensures the character looks IDENTICAL in every frame.
 */

interface FacialFeatures {
  faceShape: string;
  skinTone: string;
  skinTexture: string;
  eyeShape: string;
  eyeColor: string;
  eyebrowShape: string;
  eyebrowThickness: string;
  noseShape: string;
  noseSize: string;
  lipShape: string;
  lipColor: string;
  chinShape: string;
  cheekboneProminence: string;
  foreheadSize: string;
  jawline: string;
  facialHair: string;
  wrinkles: string;
  freckles: string;
  moles: string;
  scars: string;
  expression: string;
  age: string;
}

interface HairDetails {
  color: string;
  colorHighlights: string;
  length: string;
  texture: string;
  style: string;
  parting: string;
  volume: string;
  hairline: string;
  frontView: string;
  sideView: string;
  backView: string;
  movement: string;
  accessories: string[];
}

interface BodyDetails {
  height: string;
  build: string;
  shoulderWidth: string;
  torsoLength: string;
  armLength: string;
  legLength: string;
  handSize: string;
  posture: string;
  gait: string;
  skinTone: string;
  muscleDefinition: string;
  proportions: string;
  silhouette: string;
}

interface ClothingItem {
  type: string;
  color: string;
  exactColorHex: string;
  pattern: string;
  texture: string;
  material: string;
  fit: string;
  condition: string;
  distinctiveFeatures: string;
  brandOrStyle: string;
}

interface ClothingDetails {
  topLayer: ClothingItem;
  bottomLayer: ClothingItem;
  footwear: ClothingItem;
  outerwear?: ClothingItem;
  overallStyle: string;
  colorPalette: string[];
  outfit_signature: string;
}

interface AccessoryDetails {
  items: Array<{
    type: string;
    description: string;
    position: string;
    color: string;
    material: string;
    size: string;
  }>;
  signature_accessory: string;
}

interface NonFacialAnchors {
  bodyType: string;
  bodyProportions: string;
  posture: string;
  gait: string;
  height: string;
  clothingDescription: string;
  clothingColors: string[];
  clothingPatterns: string[];
  clothingTextures: string[];
  clothingDistinctive: string;
  hairColor: string;
  hairLength: string;
  hairStyle: string;
  hairFromBehind: string;
  hairSilhouette: string;
  accessories: string[];
  accessoryPositions: string;
  backViewMarkers: string;
  overallSilhouette: string;
}

interface IdentityBibleResult {
  success: boolean;
  version: '4.0';
  originalImageUrl: string;
  
  // HYPER-DETAILED Character Analysis
  facialFeatures: FacialFeatures;
  hairDetails: HairDetails;
  bodyDetails: BodyDetails;
  clothingDetails: ClothingDetails;
  accessoryDetails: AccessoryDetails;
  
  // Character description (combined)
  characterDescription: string;
  
  // Non-facial anchors (for occlusion handling)
  nonFacialAnchors: NonFacialAnchors;
  
  // Consistency anchors
  consistencyAnchors: string[];
  
  // Enhanced prompts
  enhancedConsistencyPrompt: string;
  antiMorphingPrompts: string[];
  occlusionNegatives: string[];
  
  // Exact matching requirements
  colorLockPrompt: string;
  silhouetteLockPrompt: string;
  
  // Processing info
  analysisTimeMs: number;
}

// STEP 1: Analyze FACE in extreme detail
async function analyzeFace(imageUrl: string): Promise<FacialFeatures> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-pro',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageUrl } },
          {
            type: 'text',
            text: `You are an expert forensic artist. Analyze this character's FACE with EXTREME precision.
Every detail matters - this will be used to recreate this EXACT person in AI video generation.

Return ONLY valid JSON with this EXACT structure (be extremely specific with colors and measurements):
{
  "faceShape": "oval/round/square/heart/oblong/diamond - with specific proportions",
  "skinTone": "exact shade - e.g. 'warm olive with golden undertones' or 'fair porcelain with pink undertones'",
  "skinTexture": "smooth/textured/dewy/matte - any visible features",
  "eyeShape": "almond/round/hooded/monolid/upturned/downturned - with specific details",
  "eyeColor": "exact color with depth - e.g. 'deep brown with amber flecks' or 'steel blue-grey'",
  "eyebrowShape": "arched/straight/curved/rounded - specific shape",
  "eyebrowThickness": "thin/medium/thick/bushy - with details",
  "noseShape": "button/aquiline/roman/snub/straight - with proportions",
  "noseSize": "small/medium/large - relative to face",
  "lipShape": "full/thin/bow-shaped/wide - with details",
  "lipColor": "natural shade - e.g. 'dusty rose' or 'deep coral'",
  "chinShape": "pointed/rounded/square/cleft",
  "cheekboneProminence": "high/medium/low - how defined",
  "foreheadSize": "small/medium/large/high - with hairline",
  "jawline": "sharp/soft/angular/rounded - definition level",
  "facialHair": "none/stubble/beard/mustache - with details if present",
  "wrinkles": "none/fine lines/moderate/deep - location and type",
  "freckles": "none/light/moderate/heavy - pattern and location",
  "moles": "describe any visible moles with exact location",
  "scars": "describe any visible scars with exact location",
  "expression": "current expression - e.g. 'gentle smile with slight eye crinkle'",
  "age": "estimated age range with reasoning"
}`
          }
        ]
      }],
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    console.error("[IdentityBible] Face analysis failed:", await response.text());
    return getDefaultFacialFeatures();
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.warn("[IdentityBible] Face parse error:", e);
  }
  
  return getDefaultFacialFeatures();
}

// STEP 2: Analyze HAIR in extreme detail
async function analyzeHair(imageUrl: string): Promise<HairDetails> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-pro',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageUrl } },
          {
            type: 'text',
            text: `You are an expert hair stylist analyst. Analyze this character's HAIR with EXTREME precision.
This will be used to maintain EXACT hair consistency across different camera angles in AI video.

Return ONLY valid JSON:
{
  "color": "exact primary hair color - e.g. 'deep chestnut brown' or 'platinum blonde with ashy tones'",
  "colorHighlights": "any highlights, lowlights, or color variations",
  "length": "exact length description - e.g. 'mid-back length' or 'chin-length bob'",
  "texture": "straight/wavy/curly/coily/kinky - with specific wave pattern if applicable",
  "style": "detailed style description - how it's styled, any layering",
  "parting": "middle/left/right/none - exact parting position",
  "volume": "flat/normal/voluminous - overall volume description",
  "hairline": "shape and position of hairline",
  "frontView": "how hair frames face from front - bangs, layers, etc.",
  "sideView": "hair profile from side - how it falls",
  "backView": "CRITICAL - exactly how hair looks from behind - length, shape, how it falls",
  "movement": "how hair would move - stiff/flowing/bouncy",
  "accessories": ["any hair accessories - clips, ties, headbands, etc."]
}`
          }
        ]
      }],
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    console.error("[IdentityBible] Hair analysis failed:", await response.text());
    return getDefaultHairDetails();
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.warn("[IdentityBible] Hair parse error:", e);
  }
  
  return getDefaultHairDetails();
}

// STEP 3: Analyze BODY in extreme detail
async function analyzeBody(imageUrl: string): Promise<BodyDetails> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-pro',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageUrl } },
          {
            type: 'text',
            text: `You are an expert character designer. Analyze this character's BODY with EXTREME precision.
This ensures the body type stays EXACTLY consistent across all video frames and angles.

Return ONLY valid JSON:
{
  "height": "estimated height category and relative proportions",
  "build": "exact build - e.g. 'slender athletic' or 'curvy hourglass' or 'broad muscular'",
  "shoulderWidth": "narrow/medium/broad - relative to body",
  "torsoLength": "short/average/long - proportion to legs",
  "armLength": "relative arm length and build",
  "legLength": "relative leg length and shape",
  "handSize": "small/medium/large - visible hand characteristics",
  "posture": "detailed posture description - how they hold themselves",
  "gait": "inferred walking style from posture",
  "skinTone": "visible skin tone on body (may match or differ from face)",
  "muscleDefinition": "none visible/toned/athletic/muscular - muscle visibility",
  "proportions": "overall body proportions summary - what stands out",
  "silhouette": "CRITICAL - exact body silhouette outline for matching"
}`
          }
        ]
      }],
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    console.error("[IdentityBible] Body analysis failed:", await response.text());
    return getDefaultBodyDetails();
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.warn("[IdentityBible] Body parse error:", e);
  }
  
  return getDefaultBodyDetails();
}

// STEP 4: Analyze CLOTHING in extreme detail
async function analyzeClothing(imageUrl: string): Promise<ClothingDetails> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-pro',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageUrl } },
          {
            type: 'text',
            text: `You are a fashion expert. Analyze this character's CLOTHING with EXTREME precision.
Every color, texture, and detail must be captured for perfect consistency in AI video.

Return ONLY valid JSON:
{
  "topLayer": {
    "type": "shirt/blouse/t-shirt/sweater/etc",
    "color": "exact color name - e.g. 'dusty mauve' or 'forest green'",
    "exactColorHex": "approximate hex color code",
    "pattern": "solid/striped/floral/plaid/etc",
    "texture": "cotton/silk/denim/leather/knit/etc",
    "material": "material type and weight",
    "fit": "tight/fitted/relaxed/oversized",
    "condition": "new/worn/distressed",
    "distinctiveFeatures": "buttons, collar type, sleeves, etc",
    "brandOrStyle": "style category or visible branding"
  },
  "bottomLayer": {
    "type": "jeans/skirt/pants/shorts/etc",
    "color": "exact color",
    "exactColorHex": "approximate hex",
    "pattern": "pattern if any",
    "texture": "material texture",
    "material": "material type",
    "fit": "fit description",
    "condition": "condition",
    "distinctiveFeatures": "pockets, tears, embellishments",
    "brandOrStyle": "style"
  },
  "footwear": {
    "type": "sneakers/heels/boots/sandals/etc",
    "color": "color",
    "exactColorHex": "hex",
    "pattern": "pattern",
    "texture": "texture",
    "material": "material",
    "fit": "fit on foot",
    "condition": "condition",
    "distinctiveFeatures": "distinctive features",
    "brandOrStyle": "style"
  },
  "outerwear": null,
  "overallStyle": "overall fashion style - e.g. 'casual bohemian' or 'business casual'",
  "colorPalette": ["list", "of", "main", "colors"],
  "outfit_signature": "THE most distinctive/memorable element of this outfit"
}`
          }
        ]
      }],
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    console.error("[IdentityBible] Clothing analysis failed:", await response.text());
    return getDefaultClothingDetails();
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.warn("[IdentityBible] Clothing parse error:", e);
  }
  
  return getDefaultClothingDetails();
}

// STEP 5: Analyze ACCESSORIES in detail
async function analyzeAccessories(imageUrl: string): Promise<AccessoryDetails> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-pro',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageUrl } },
          {
            type: 'text',
            text: `Analyze ALL accessories worn by this character. Be exhaustive.

Return ONLY valid JSON:
{
  "items": [
    {
      "type": "necklace/bracelet/watch/ring/earrings/glasses/hat/bag/etc",
      "description": "detailed description",
      "position": "where on body - e.g. 'left wrist' or 'around neck'",
      "color": "exact color",
      "material": "gold/silver/leather/fabric/etc",
      "size": "small/medium/large"
    }
  ],
  "signature_accessory": "THE most noticeable accessory that helps identify this character"
}

If no accessories are visible, return {"items": [], "signature_accessory": "none"}`
          }
        ]
      }],
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    console.error("[IdentityBible] Accessory analysis failed:", await response.text());
    return { items: [], signature_accessory: "none" };
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.warn("[IdentityBible] Accessory parse error:", e);
  }
  
  return { items: [], signature_accessory: "none" };
}

// Build comprehensive consistency prompt from all analyses
function buildEnhancedConsistencyPrompt(
  face: FacialFeatures,
  hair: HairDetails,
  body: BodyDetails,
  clothing: ClothingDetails,
  accessories: AccessoryDetails
): string {
  const parts: string[] = [];
  
  // Face identity lock
  parts.push(`FACE: ${face.faceShape} face with ${face.skinTone} skin. ${face.eyeShape} ${face.eyeColor} eyes, ${face.eyebrowShape} ${face.eyebrowThickness} eyebrows. ${face.noseShape} ${face.noseSize} nose, ${face.lipShape} ${face.lipColor} lips. ${face.jawline} jawline, ${face.cheekboneProminence} cheekbones. ${face.expression}. Age approximately ${face.age}.`);
  
  // Hair identity lock
  parts.push(`HAIR: ${hair.color} ${hair.length} ${hair.texture} hair styled in ${hair.style}. ${hair.parting} parting with ${hair.volume} volume. Front: ${hair.frontView}. Back: ${hair.backView}. Movement: ${hair.movement}.`);
  
  // Body identity lock
  parts.push(`BODY: ${body.height} with ${body.build} build. ${body.shoulderWidth} shoulders, ${body.posture}. ${body.muscleDefinition}. Silhouette: ${body.silhouette}.`);
  
  // Clothing identity lock
  parts.push(`OUTFIT: ${clothing.topLayer.color} ${clothing.topLayer.texture} ${clothing.topLayer.type} (${clothing.topLayer.fit} fit, ${clothing.topLayer.distinctiveFeatures}). ${clothing.bottomLayer.color} ${clothing.bottomLayer.type}. ${clothing.footwear.color} ${clothing.footwear.type}. Overall: ${clothing.overallStyle}. SIGNATURE: ${clothing.outfit_signature}.`);
  
  // Accessories identity lock
  if (accessories.items.length > 0) {
    const accessoryList = accessories.items.map(a => `${a.color} ${a.material} ${a.type} on ${a.position}`).join(', ');
    parts.push(`ACCESSORIES: ${accessoryList}. Signature: ${accessories.signature_accessory}.`);
  }
  
  return parts.join('\n');
}

// Build color lock prompt for exact color matching
function buildColorLockPrompt(clothing: ClothingDetails, hair: HairDetails, face: FacialFeatures): string {
  const colors = [
    `Skin: ${face.skinTone}`,
    `Hair: ${hair.color}`,
    `Top: ${clothing.topLayer.color} (${clothing.topLayer.exactColorHex})`,
    `Bottom: ${clothing.bottomLayer.color} (${clothing.bottomLayer.exactColorHex})`,
    `Shoes: ${clothing.footwear.color}`,
  ];
  
  return `COLOR LOCK - MUST MATCH EXACTLY:\n${colors.join('\n')}`;
}

// Build silhouette lock prompt
function buildSilhouetteLockPrompt(body: BodyDetails, hair: HairDetails): string {
  return `SILHOUETTE LOCK: ${body.silhouette}. Hair silhouette: ${hair.backView}. This exact outline must be maintained from all angles.`;
}

// Build non-facial anchors from analyses
function buildNonFacialAnchors(
  body: BodyDetails,
  hair: HairDetails,
  clothing: ClothingDetails,
  accessories: AccessoryDetails
): NonFacialAnchors {
  return {
    bodyType: body.build,
    bodyProportions: body.proportions,
    posture: body.posture,
    gait: body.gait,
    height: body.height,
    clothingDescription: `${clothing.topLayer.color} ${clothing.topLayer.type}, ${clothing.bottomLayer.color} ${clothing.bottomLayer.type}, ${clothing.footwear.color} ${clothing.footwear.type}`,
    clothingColors: clothing.colorPalette,
    clothingPatterns: [clothing.topLayer.pattern, clothing.bottomLayer.pattern].filter(p => p && p !== 'solid'),
    clothingTextures: [clothing.topLayer.texture, clothing.bottomLayer.texture],
    clothingDistinctive: clothing.outfit_signature,
    hairColor: hair.color,
    hairLength: hair.length,
    hairStyle: hair.style,
    hairFromBehind: hair.backView,
    hairSilhouette: `${hair.length} ${hair.texture} hair with ${hair.volume} volume`,
    accessories: accessories.items.map(a => `${a.color} ${a.type}`),
    accessoryPositions: accessories.items.map(a => `${a.type} on ${a.position}`).join(', '),
    backViewMarkers: `${hair.backView}, ${body.silhouette}`,
    overallSilhouette: body.silhouette,
  };
}

// Build combined character description
function buildCharacterDescription(
  face: FacialFeatures,
  hair: HairDetails,
  body: BodyDetails,
  clothing: ClothingDetails
): string {
  return `A ${face.age} individual with a ${face.faceShape} face and ${face.skinTone} skin. They have ${face.eyeShape} ${face.eyeColor} eyes, ${face.eyebrowShape} eyebrows, a ${face.noseShape} nose, and ${face.lipShape} ${face.lipColor} lips. Their expression is ${face.expression}. Their hair is ${hair.color}, ${hair.length}, and ${hair.texture}, styled in ${hair.style} with ${hair.parting} parting. They have a ${body.build} build with ${body.shoulderWidth} shoulders and ${body.posture}. They are wearing a ${clothing.topLayer.color} ${clothing.topLayer.texture} ${clothing.topLayer.type} with ${clothing.topLayer.distinctiveFeatures}, ${clothing.bottomLayer.color} ${clothing.bottomLayer.type}, and ${clothing.footwear.color} ${clothing.footwear.type}. Their overall style is ${clothing.overallStyle}.`;
}

// Get anti-morphing prompts
function getAntiMorphingPrompts(): string[] {
  return [
    'different person',
    'face change',
    'face morph',
    'identity shift',
    'character swap',
    'body transformation',
    'clothing change',
    'outfit change',
    'hair color change',
    'hair length change',
    'skin tone change',
    'eye color change',
    'age change',
    'gender change',
    'height change',
    'build change',
    'extra limbs',
    'missing limbs',
    'deformed hands',
    'wrong number of fingers',
    'anatomical errors',
    'floating limbs',
    'disconnected body parts',
  ];
}

// Get occlusion-specific negatives
function getOcclusionNegatives(): string[] {
  return [
    'different person when turning around',
    'changed appearance after face hidden',
    'different clothes after camera angle change',
    'hair color change between shots',
    'different body type between angles',
    'clothing transformation',
    'character swap mid-scene',
    'costume change',
    'different hairstyle when turning back',
    'altered physique',
    'different accessories between shots',
    'changed outfit colors',
    'body proportions changing',
    'height change between frames',
  ];
}

// Default values
function getDefaultFacialFeatures(): FacialFeatures {
  return {
    faceShape: 'oval', skinTone: 'medium', skinTexture: 'smooth',
    eyeShape: 'almond', eyeColor: 'brown', eyebrowShape: 'natural', eyebrowThickness: 'medium',
    noseShape: 'straight', noseSize: 'medium', lipShape: 'natural', lipColor: 'natural pink',
    chinShape: 'rounded', cheekboneProminence: 'medium', foreheadSize: 'medium', jawline: 'soft',
    facialHair: 'none', wrinkles: 'none', freckles: 'none', moles: 'none', scars: 'none',
    expression: 'neutral', age: 'adult'
  };
}

function getDefaultHairDetails(): HairDetails {
  return {
    color: 'dark brown', colorHighlights: 'none', length: 'medium', texture: 'straight',
    style: 'natural', parting: 'middle', volume: 'normal', hairline: 'normal',
    frontView: 'frames face naturally', sideView: 'falls straight', backView: 'straight to shoulders',
    movement: 'natural', accessories: []
  };
}

function getDefaultBodyDetails(): BodyDetails {
  return {
    height: 'average', build: 'average', shoulderWidth: 'medium', torsoLength: 'proportional',
    armLength: 'proportional', legLength: 'proportional', handSize: 'medium',
    posture: 'upright', gait: 'natural', skinTone: 'medium', muscleDefinition: 'normal',
    proportions: 'balanced', silhouette: 'average human silhouette'
  };
}

function getDefaultClothingDetails(): ClothingDetails {
  const defaultItem: ClothingItem = {
    type: 'casual', color: 'neutral', exactColorHex: '#808080', pattern: 'solid',
    texture: 'cotton', material: 'cotton', fit: 'regular', condition: 'good',
    distinctiveFeatures: 'none', brandOrStyle: 'casual'
  };
  return {
    topLayer: { ...defaultItem, type: 'shirt' },
    bottomLayer: { ...defaultItem, type: 'pants' },
    footwear: { ...defaultItem, type: 'shoes' },
    overallStyle: 'casual',
    colorPalette: ['neutral'],
    outfit_signature: 'casual attire'
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { imageUrl, imageBase64 } = await req.json();

    if (!imageUrl && !imageBase64) {
      throw new Error("No image provided");
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Upload base64 if provided
    let originalImageUrl = imageUrl;
    if (imageBase64 && !imageUrl) {
      const fileName = `original_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
      const bytes = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));
      
      await supabase.storage
        .from('character-references')
        .upload(fileName, bytes, {
          contentType: 'image/jpeg',
          upsert: true
        });
      
      originalImageUrl = `${supabaseUrl}/storage/v1/object/public/character-references/${fileName}`;
    }

    console.log("[Identity Bible v4.0] Starting HYPER-DETAILED multi-pass analysis...");

    // Run all analyses in parallel for speed
    const [facialFeatures, hairDetails, bodyDetails, clothingDetails, accessoryDetails] = await Promise.all([
      analyzeFace(originalImageUrl),
      analyzeHair(originalImageUrl),
      analyzeBody(originalImageUrl),
      analyzeClothing(originalImageUrl),
      analyzeAccessories(originalImageUrl),
    ]);

    console.log("[Identity Bible v4.0] All analyses complete:", {
      face: facialFeatures.skinTone,
      hair: hairDetails.color,
      body: bodyDetails.build,
      clothing: clothingDetails.outfit_signature,
      accessories: accessoryDetails.items.length,
    });

    // Build non-facial anchors
    const nonFacialAnchors = buildNonFacialAnchors(bodyDetails, hairDetails, clothingDetails, accessoryDetails);
    
    // Build character description
    const characterDescription = buildCharacterDescription(facialFeatures, hairDetails, bodyDetails, clothingDetails);
    
    // Build consistency anchors
    const consistencyAnchors = [
      `${facialFeatures.skinTone} skin`,
      `${facialFeatures.eyeColor} eyes`,
      `${facialFeatures.faceShape} face`,
      `${hairDetails.color} ${hairDetails.length} ${hairDetails.texture} hair`,
      `${bodyDetails.build} build`,
      `${clothingDetails.topLayer.color} ${clothingDetails.topLayer.type}`,
      `${clothingDetails.bottomLayer.color} ${clothingDetails.bottomLayer.type}`,
      clothingDetails.outfit_signature,
      accessoryDetails.signature_accessory !== 'none' ? accessoryDetails.signature_accessory : '',
    ].filter(Boolean);

    // Build enhanced prompts
    const enhancedConsistencyPrompt = buildEnhancedConsistencyPrompt(facialFeatures, hairDetails, bodyDetails, clothingDetails, accessoryDetails);
    const colorLockPrompt = buildColorLockPrompt(clothingDetails, hairDetails, facialFeatures);
    const silhouetteLockPrompt = buildSilhouetteLockPrompt(bodyDetails, hairDetails);

    const analysisTimeMs = Date.now() - startTime;

    const result: IdentityBibleResult = {
      success: true,
      version: '4.0',
      originalImageUrl,
      
      // HYPER-DETAILED analyses
      facialFeatures,
      hairDetails,
      bodyDetails,
      clothingDetails,
      accessoryDetails,
      
      // Character description
      characterDescription,
      
      // Non-facial anchors
      nonFacialAnchors,
      
      // Consistency anchors
      consistencyAnchors,
      
      // Enhanced prompts
      enhancedConsistencyPrompt,
      antiMorphingPrompts: getAntiMorphingPrompts(),
      occlusionNegatives: getOcclusionNegatives(),
      
      // Lock prompts
      colorLockPrompt,
      silhouetteLockPrompt,
      
      // Processing info
      analysisTimeMs,
    };

    console.log(`[Identity Bible v4.0] Complete in ${analysisTimeMs}ms with HYPER-DETAILED analysis`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[Identity Bible v4.0] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
