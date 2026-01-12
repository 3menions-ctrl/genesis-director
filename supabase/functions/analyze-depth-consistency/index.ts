import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getAccessToken } from "../_shared/gcp-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Depth Consistency Analyzer
 * 
 * Analyzes shots for:
 * - Spatial relationship consistency
 * - Object permanence tracking
 * - Perspective consistency
 * - Depth layer analysis
 * 
 * Returns violations and corrective prompts.
 */

interface SpatialPosition {
  x: number;
  y: number;
  z: number;
}

interface SpatialObject {
  id: string;
  name: string;
  type: string;
  position: SpatialPosition;
  relativeSize: string;
  facingDirection: string;
  isPersistent: boolean;
}

interface PerspectiveConfig {
  type: string;
  cameraHeight: string;
  cameraAngle: number;
  horizonY: number;
  focalLength: string;
  depthOfField: string;
}

interface DepthLayer {
  name: string;
  zRange: { min: number; max: number };
  objects: string[];
  blur: number;
}

interface ObjectContinuityViolation {
  objectId: string;
  objectName: string;
  violationType: string;
  severity: string;
  fromShot: string;
  toShot: string;
  description: string;
  suggestedFix: string;
}

// Fetch image and convert to base64
async function imageToBase64(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl);
  const buffer = await response.arrayBuffer();
  const uint8Array = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 32768;
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

// Analyze a single shot for depth and spatial information
async function analyzeShotDepth(
  frameUrl: string,
  shotId: string,
  description: string,
  knownObjects: string[],
  accessToken: string,
  gcpProjectId: string
): Promise<{
  perspective: PerspectiveConfig;
  objects: SpatialObject[];
  depthLayers: DepthLayer[];
  relationships: any[];
}> {
  const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${gcpProjectId}/locations/us-central1/publishers/google/models/gemini-2.0-flash:generateContent`;
  
  const imageBase64 = await imageToBase64(frameUrl);
  
  const prompt = `Analyze this frame for spatial depth, object positions, and perspective. 
Known objects to track: ${knownObjects.join(', ') || 'detect automatically'}
Scene description: ${description}

Return a JSON object with this EXACT structure (no markdown, just JSON):
{
  "perspective": {
    "type": "one-point" | "two-point" | "three-point" | "isometric" | "aerial",
    "cameraHeight": "ground-level" | "eye-level" | "elevated" | "birds-eye" | "worms-eye",
    "cameraAngle": 0-90 (degrees from horizontal),
    "horizonY": 0.0-1.0 (vertical position of horizon, 0=top, 1=bottom),
    "focalLength": "wide" | "normal" | "telephoto",
    "depthOfField": "shallow" | "medium" | "deep"
  },
  "objects": [
    {
      "id": "unique_id",
      "name": "object name",
      "type": "character" | "prop" | "vehicle" | "structure" | "environmental",
      "position": {
        "x": -1 to 1 (left to right),
        "y": -1 to 1 (bottom to top),
        "z": 0 to 1 (foreground to background)
      },
      "relativeSize": "tiny" | "small" | "medium" | "large" | "massive",
      "screenCoverage": 0-100,
      "facingDirection": "camera" | "left" | "right" | "away",
      "isPersistent": true/false (should appear in multiple shots)
    }
  ],
  "depthLayers": [
    {
      "name": "foreground" | "midground" | "background" | "far-background",
      "zRange": {"min": 0.0, "max": 0.3},
      "objects": ["list of object names in this layer"],
      "blur": 0.0-1.0,
      "atmosphericHaze": 0.0-1.0
    }
  ],
  "relationships": [
    {
      "object1": "object name",
      "object2": "object name",
      "relationship": "left-of" | "right-of" | "above" | "below" | "in-front-of" | "behind" | "next-to",
      "distance": "touching" | "close" | "medium" | "far",
      "isFixed": true/false
    }
  ]
}

Be precise about object positions and depth relationships.`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: imageBase64
            }
          },
          { text: prompt }
        ]
      }],
      generationConfig: {
        maxOutputTokens: 3000,
        temperature: 0.1
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Depth] Analysis error for ${shotId}:`, errorText);
    throw new Error(`Depth analysis failed: ${errorText}`);
  }

  const data = await response.json();
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  
  let jsonStr = textContent;
  const jsonMatch = textContent.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  }
  
  return JSON.parse(jsonStr);
}

// Compare consecutive shots for violations
function findViolations(
  prevAnalysis: any,
  currAnalysis: any,
  prevShotId: string,
  currShotId: string,
  strictness: string
): ObjectContinuityViolation[] {
  const violations: ObjectContinuityViolation[] = [];
  const thresholds = {
    lenient: { positionJump: 0.7, sizeChange: 2 },
    normal: { positionJump: 0.5, sizeChange: 1 },
    strict: { positionJump: 0.3, sizeChange: 1 }
  };
  const threshold = thresholds[strictness as keyof typeof thresholds] || thresholds.normal;

  const prevObjects = prevAnalysis.objects || [];
  const currObjects = currAnalysis.objects || [];

  // Check for position jumps and size changes
  for (const currObj of currObjects) {
    const prevObj = prevObjects.find((o: any) => 
      o.name?.toLowerCase() === currObj.name?.toLowerCase() ||
      o.id === currObj.id
    );

    if (prevObj && prevObj.isPersistent) {
      // Position jump check
      const distance = Math.sqrt(
        Math.pow((currObj.position?.x || 0) - (prevObj.position?.x || 0), 2) +
        Math.pow((currObj.position?.y || 0) - (prevObj.position?.y || 0), 2)
      );

      if (distance > threshold.positionJump) {
        violations.push({
          objectId: currObj.id,
          objectName: currObj.name,
          violationType: 'position-jump',
          severity: distance > 0.8 ? 'critical' : 'major',
          fromShot: prevShotId,
          toShot: currShotId,
          description: `${currObj.name} moved too far between shots (${Math.round(distance * 100)}% of screen)`,
          suggestedFix: `Add transitional motion or keep ${currObj.name} in similar position`
        });
      }

      // Size consistency check
      const sizes = ['tiny', 'small', 'medium', 'large', 'massive'];
      const prevSizeIdx = sizes.indexOf(prevObj.relativeSize);
      const currSizeIdx = sizes.indexOf(currObj.relativeSize);
      const sizeDiff = Math.abs(prevSizeIdx - currSizeIdx);

      if (sizeDiff > threshold.sizeChange) {
        const zChanged = Math.abs((currObj.position?.z || 0) - (prevObj.position?.z || 0)) > 0.3;
        if (!zChanged) {
          violations.push({
            objectId: currObj.id,
            objectName: currObj.name,
            violationType: 'size-inconsistency',
            severity: 'major',
            fromShot: prevShotId,
            toShot: currShotId,
            description: `${currObj.name} changed from ${prevObj.relativeSize} to ${currObj.relativeSize} without depth change`,
            suggestedFix: `Maintain ${prevObj.relativeSize} size or adjust camera distance`
          });
        }
      }
    }
  }

  // Check for missing persistent objects
  for (const prevObj of prevObjects) {
    if (prevObj.isPersistent) {
      const stillPresent = currObjects.some((o: any) =>
        o.name?.toLowerCase() === prevObj.name?.toLowerCase()
      );
      
      if (!stillPresent) {
        violations.push({
          objectId: prevObj.id,
          objectName: prevObj.name,
          violationType: 'missing-object',
          severity: 'major',
          fromShot: prevShotId,
          toShot: currShotId,
          description: `${prevObj.name} was visible but disappeared without exit`,
          suggestedFix: `Show ${prevObj.name} exiting frame or maintain visibility`
        });
      }
    }
  }

  // Check perspective consistency
  const prevPerspective = prevAnalysis.perspective;
  const currPerspective = currAnalysis.perspective;
  
  if (prevPerspective && currPerspective) {
    const horizonDiff = Math.abs((prevPerspective.horizonY || 0.5) - (currPerspective.horizonY || 0.5));
    
    if (horizonDiff > 0.3 && prevPerspective.type === currPerspective.type) {
      violations.push({
        objectId: 'scene',
        objectName: 'Scene Perspective',
        violationType: 'wrong-perspective',
        severity: 'minor',
        fromShot: prevShotId,
        toShot: currShotId,
        description: `Horizon line shifted significantly (${Math.round(horizonDiff * 100)}%)`,
        suggestedFix: `Maintain consistent horizon at ${prevPerspective.horizonY} position`
      });
    }
  }

  return violations;
}

// Build corrective prompt for a shot
function buildCorrectivePrompt(
  originalDescription: string,
  analysis: any,
  violations: ObjectContinuityViolation[],
  prevAnalysis?: any
): { correctedPrompt: string; fixes: string[] } {
  const fixes: string[] = [];
  let correctedPrompt = originalDescription;

  // Add perspective consistency
  if (analysis.perspective) {
    correctedPrompt += `. ${analysis.perspective.type} perspective, ${analysis.perspective.cameraHeight} camera`;
    if (analysis.perspective.horizonY < 0.4) {
      correctedPrompt += ', looking upward';
    } else if (analysis.perspective.horizonY > 0.6) {
      correctedPrompt += ', looking downward';
    }
  }

  // Add depth layer information
  if (analysis.depthLayers?.length > 0) {
    const layerDesc = analysis.depthLayers
      .map((l: any) => `${l.name}: ${l.objects.join(', ')}`)
      .join('; ');
    correctedPrompt += `. Depth layers: ${layerDesc}`;
    fixes.push('Added explicit depth layer descriptions');
  }

  // Add object position constraints
  const persistentObjects = (analysis.objects || []).filter((o: any) => o.isPersistent);
  if (persistentObjects.length > 0) {
    const objPositions = persistentObjects.map((o: any) => {
      const x = o.position?.x < -0.3 ? 'left' : o.position?.x > 0.3 ? 'right' : 'center';
      const z = o.position?.z < 0.3 ? 'foreground' : o.position?.z > 0.7 ? 'background' : 'midground';
      return `${o.name} (${x}, ${z})`;
    }).join(', ');
    correctedPrompt += `. Object positions: ${objPositions}`;
    fixes.push('Added object position constraints');
  }

  // Address specific violations
  for (const v of violations.filter(v => v.severity === 'critical' || v.severity === 'major')) {
    if (v.violationType === 'position-jump' && prevAnalysis) {
      const prevObj = prevAnalysis.objects?.find((o: any) => o.name === v.objectName);
      if (prevObj) {
        const x = prevObj.position?.x < -0.3 ? 'left' : prevObj.position?.x > 0.3 ? 'right' : 'center';
        correctedPrompt += `. IMPORTANT: ${v.objectName} must be on the ${x} side`;
        fixes.push(`Enforced ${v.objectName} position consistency`);
      }
    }
    if (v.violationType === 'missing-object') {
      correctedPrompt += `. MUST INCLUDE: ${v.objectName}`;
      fixes.push(`Added missing object: ${v.objectName}`);
    }
  }

  // Add negative constraints
  const negatives = [
    'inconsistent object sizes',
    'teleporting objects',
    'broken spatial relationships',
    'objects clipping through each other'
  ];
  correctedPrompt += `. AVOID: ${negatives.join(', ')}`;

  return { correctedPrompt, fixes };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const {
      projectId,
      shots,
      knownObjects = [],
      strictness = 'normal'
    } = await req.json();

    if (!projectId || !shots || shots.length === 0) {
      throw new Error("projectId and shots array are required");
    }

    console.log(`[Depth] Analyzing ${shots.length} shots for project ${projectId}`);

    // Get service account
    const serviceAccountJson = Deno.env.get("GOOGLE_VERTEX_SERVICE_ACCOUNT");
    if (!serviceAccountJson) {
      throw new Error("GOOGLE_VERTEX_SERVICE_ACCOUNT is not configured");
    }

    const serviceAccount = JSON.parse(serviceAccountJson);
    const gcpProjectId = serviceAccount.project_id;
    const accessToken = await getAccessToken(serviceAccount);

    const knownObjectNames = knownObjects.map((o: any) => o.name);
    const shotAnalysis: any[] = [];
    const allViolations: ObjectContinuityViolation[] = [];
    const correctivePrompts: any[] = [];
    let prevAnalysis: any = null;

    // Analyze each shot
    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i];
      console.log(`[Depth] Analyzing shot ${i + 1}/${shots.length}: ${shot.id}`);

      try {
        const analysis = await analyzeShotDepth(
          shot.frameUrl,
          shot.id,
          shot.description,
          knownObjectNames,
          accessToken,
          gcpProjectId
        );

        shotAnalysis.push({
          shotId: shot.id,
          perspectiveConfig: analysis.perspective,
          depthLayers: analysis.depthLayers,
          objectsDetected: (analysis.objects || []).map((o: any) => o.name),
          issuesFound: 0,
          rawAnalysis: analysis
        });

        // Check for violations against previous shot
        if (prevAnalysis) {
          const violations = findViolations(
            prevAnalysis,
            analysis,
            shots[i - 1].id,
            shot.id,
            strictness
          );
          
          allViolations.push(...violations);
          shotAnalysis[shotAnalysis.length - 1].issuesFound = violations.length;

          // Build corrective prompt
          const shotViolations = violations.filter(v => v.toShot === shot.id);
          const { correctedPrompt, fixes } = buildCorrectivePrompt(
            shot.description,
            analysis,
            shotViolations,
            prevAnalysis
          );

          if (fixes.length > 0) {
            correctivePrompts.push({
              shotId: shot.id,
              originalPrompt: shot.description,
              correctedPrompt,
              fixes
            });
          }
        }

        prevAnalysis = analysis;

      } catch (error) {
        console.error(`[Depth] Error analyzing shot ${shot.id}:`, error);
        shotAnalysis.push({
          shotId: shot.id,
          perspectiveConfig: null,
          depthLayers: [],
          objectsDetected: [],
          issuesFound: 0,
          error: String(error)
        });
      }
    }

    // Calculate scores
    const totalPossibleViolations = (shots.length - 1) * 5; // Rough estimate
    const spatialConsistencyScore = Math.max(0, 100 - (allViolations.filter(v => 
      v.violationType === 'position-jump').length / Math.max(1, shots.length - 1) * 100));
    const objectPermanenceScore = Math.max(0, 100 - (allViolations.filter(v => 
      v.violationType === 'missing-object').length / Math.max(1, shots.length - 1) * 100));
    const perspectiveConsistencyScore = Math.max(0, 100 - (allViolations.filter(v => 
      v.violationType === 'wrong-perspective').length / Math.max(1, shots.length - 1) * 100));
    const overallScore = Math.round((spatialConsistencyScore + objectPermanenceScore + perspectiveConsistencyScore) / 3);

    const processingTimeMs = Date.now() - startTime;
    
    console.log(`[Depth] Analysis complete in ${processingTimeMs}ms`);
    console.log(`[Depth] Found ${allViolations.length} violations, overall score: ${overallScore}`);

    return new Response(
      JSON.stringify({
        success: true,
        state: {
          projectId,
          spatialConsistencyScore,
          objectPermanenceScore,
          perspectiveConsistencyScore,
          overallScore,
          analyzedAt: Date.now()
        },
        violations: allViolations,
        shotAnalysis,
        correctivePrompts,
        processingTimeMs
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Depth] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        processingTimeMs: Date.now() - startTime
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
