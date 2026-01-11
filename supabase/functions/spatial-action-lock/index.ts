import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * SPATIAL-ACTION LOCK ENGINE
 * 
 * Solves the "lion passing gazelle" problem by:
 * 1. Detecting continuous action relationships (chase, pursuit, follow)
 * 2. Locking relative spatial positions between characters
 * 3. Generating explicit enforcement prompts and negatives
 * 4. Maintaining consistency across multi-clip sequences
 */

type ActionState = 
  | 'pursuing' | 'fleeing' | 'following' | 'leading'
  | 'chasing' | 'escaping' | 'stalking' | 'hiding'
  | 'approaching' | 'retreating' | 'circling' | 'flanking'
  | 'standing' | 'sitting' | 'walking' | 'running'
  | 'fighting' | 'embracing' | 'conversing' | 'observing';

interface CharacterAction {
  name: string;
  action: ActionState;
  role: 'pursuer' | 'target' | 'leader' | 'follower' | 'participant' | 'observer';
  relativePosition: 'ahead' | 'behind' | 'left' | 'right' | 'center';
}

interface ActionRelationship {
  type: 'chase' | 'pursuit' | 'follow' | 'lead' | 'approach' | 'retreat' | 'parallel';
  actor1: CharacterAction;
  actor2: CharacterAction;
  distanceState: 'closing' | 'maintaining' | 'widening';
}

interface SpatialLockResult {
  detected: boolean;
  actionType: string;
  characters: CharacterAction[];
  relationships: ActionRelationship[];
  enhancedPrompt: string;
  spatialLockPrompt: string;
  negativePrompts: string[];
}

// Detect characters and their actions from prompt
function analyzePrompt(prompt: string): { characters: string[], actionPatterns: any[] } {
  const characters: string[] = [];
  const actionPatterns: any[] = [];
  
  // Common animal/character patterns in chase scenarios
  const chasePatterns = [
    { regex: /(\w+)\s+(?:is\s+)?chasing\s+(?:a\s+|the\s+)?(\w+)/gi, type: 'chase' },
    { regex: /(\w+)\s+(?:is\s+)?pursuing\s+(?:a\s+|the\s+)?(\w+)/gi, type: 'pursuit' },
    { regex: /(\w+)\s+(?:is\s+)?following\s+(?:a\s+|the\s+)?(\w+)/gi, type: 'follow' },
    { regex: /(\w+)\s+(?:is\s+)?hunting\s+(?:a\s+|the\s+)?(\w+)/gi, type: 'hunt' },
    { regex: /(\w+)\s+(?:is\s+)?stalking\s+(?:a\s+|the\s+)?(\w+)/gi, type: 'stalk' },
    { regex: /(\w+)\s+(?:is\s+)?fleeing\s+from\s+(?:a\s+|the\s+)?(\w+)/gi, type: 'flee' },
    { regex: /(\w+)\s+(?:is\s+)?escaping\s+(?:a\s+|the\s+)?(\w+)/gi, type: 'escape' },
    { regex: /(\w+)\s+(?:is\s+)?running\s+from\s+(?:a\s+|the\s+)?(\w+)/gi, type: 'flee' },
    { regex: /(\w+)\s+(?:is\s+)?leading\s+(?:a\s+|the\s+)?(\w+)/gi, type: 'lead' },
    { regex: /(\w+)\s+(?:is\s+)?after\s+(?:a\s+|the\s+)?(\w+)/gi, type: 'chase' },
  ];
  
  for (const { regex, type } of chasePatterns) {
    let match;
    while ((match = regex.exec(prompt)) !== null) {
      const actor1 = match[1].toLowerCase();
      const actor2 = match[2].toLowerCase();
      
      if (!characters.includes(actor1)) characters.push(actor1);
      if (!characters.includes(actor2)) characters.push(actor2);
      
      actionPatterns.push({
        type,
        actor1,
        actor2,
        originalText: match[0],
      });
    }
  }
  
  return { characters, actionPatterns };
}

// Build spatial lock enforcement for a chase/pursuit scenario
function buildChaseEnforcement(pursuer: string, target: string, actionType: string): SpatialLockResult {
  const pursuerCap = pursuer.charAt(0).toUpperCase() + pursuer.slice(1);
  const targetCap = target.charAt(0).toUpperCase() + target.slice(1);
  
  // Action-specific language
  const actionDescriptions: Record<string, { pursuerAction: string, targetAction: string }> = {
    'chase': { pursuerAction: 'chasing', targetAction: 'fleeing ahead' },
    'pursuit': { pursuerAction: 'in pursuit', targetAction: 'fleeing ahead' },
    'hunt': { pursuerAction: 'hunting', targetAction: 'fleeing in fear' },
    'stalk': { pursuerAction: 'stalking from behind', targetAction: 'unaware, ahead' },
    'follow': { pursuerAction: 'following closely', targetAction: 'moving ahead' },
    'flee': { pursuerAction: 'chasing', targetAction: 'fleeing desperately' },
    'escape': { pursuerAction: 'pursuing', targetAction: 'escaping ahead' },
    'lead': { pursuerAction: 'following', targetAction: 'leading the way' },
  };
  
  const desc = actionDescriptions[actionType] || actionDescriptions['chase'];
  const isLeadFollow = actionType === 'lead' || actionType === 'follow';
  
  const spatialLockPrompt = isLeadFollow
    ? `[SPATIAL LOCK - MANDATORY POSITIONS]
${targetCap} is AHEAD, leading the movement, positioned in the FRONT HALF of the frame.
${pursuerCap} is BEHIND, following, positioned in the BACK HALF of the frame.
DISTANCE: ${pursuerCap} maintains consistent following distance behind ${targetCap}.
DIRECTION: Both moving in the SAME direction.
FRAME RULE: ${targetCap} must ALWAYS be closer to the destination/screen edge they're moving toward.`
    : `[SPATIAL LOCK - MANDATORY CHASE POSITIONS]
${targetCap} is AHEAD, ${desc.targetAction}, positioned in the FRONT/LEADING portion of the frame.
${pursuerCap} is BEHIND, ${desc.pursuerAction}, positioned in the BACK/TRAILING portion of the frame.
DISTANCE: ${pursuerCap} is pursuing but has NOT caught ${targetCap}. Gap remains between them.
DIRECTION: Both moving in the SAME direction - ${targetCap} fleeing, ${pursuerCap} chasing.
CRITICAL: ${pursuerCap} must NEVER be ahead of, beside, or passing ${targetCap}.
FRAME RULE: ${targetCap} is always closer to the escape direction (screen edge they're fleeing toward).`;
  
  const negativePrompts = isLeadFollow
    ? [
        `${pursuer} ahead of ${target}`,
        `${pursuer} leading ${target}`,
        `${target} behind ${pursuer}`,
        `${target} following ${pursuer}`,
        `${pursuer} in front`,
        'wrong character order',
        'reversed positions',
      ]
    : [
        `${pursuer} ahead of ${target}`,
        `${pursuer} in front of ${target}`,
        `${pursuer} passing ${target}`,
        `${pursuer} beside ${target}`,
        `${pursuer} catching ${target}`,
        `${pursuer} overtaking ${target}`,
        `${target} behind ${pursuer}`,
        `${target} trailing ${pursuer}`,
        `${pursuer} caught ${target}`,
        `chase over`,
        `pursuit ended`,
        `${pursuer} and ${target} side by side`,
        'wrong character order',
        'reversed chase positions',
        'spatial reversal',
      ];
  
  return {
    detected: true,
    actionType,
    characters: [
      {
        name: pursuer,
        action: isLeadFollow ? 'following' : 'pursuing',
        role: isLeadFollow ? 'follower' : 'pursuer',
        relativePosition: 'behind',
      },
      {
        name: target,
        action: isLeadFollow ? 'leading' : 'fleeing',
        role: isLeadFollow ? 'leader' : 'target',
        relativePosition: 'ahead',
      },
    ],
    relationships: [{
      type: isLeadFollow ? 'follow' : 'chase',
      actor1: {
        name: pursuer,
        action: isLeadFollow ? 'following' : 'pursuing',
        role: isLeadFollow ? 'follower' : 'pursuer',
        relativePosition: 'behind',
      },
      actor2: {
        name: target,
        action: isLeadFollow ? 'leading' : 'fleeing',
        role: isLeadFollow ? 'leader' : 'target',
        relativePosition: 'ahead',
      },
      distanceState: 'maintaining',
    }],
    enhancedPrompt: '',
    spatialLockPrompt,
    negativePrompts,
  };
}

// Process a prompt and return enhanced version with spatial locks
function processPromptForSpatialLocks(originalPrompt: string): SpatialLockResult {
  const { characters, actionPatterns } = analyzePrompt(originalPrompt);
  
  if (actionPatterns.length === 0) {
    return {
      detected: false,
      actionType: 'none',
      characters: [],
      relationships: [],
      enhancedPrompt: originalPrompt,
      spatialLockPrompt: '',
      negativePrompts: [],
    };
  }
  
  // Process the primary action pattern
  const primaryAction = actionPatterns[0];
  let result: SpatialLockResult;
  
  // Determine who is pursuer and who is target based on action type
  if (['flee', 'escape'].includes(primaryAction.type)) {
    // actor1 is fleeing FROM actor2, so actor2 is pursuer
    result = buildChaseEnforcement(primaryAction.actor2, primaryAction.actor1, primaryAction.type);
  } else if (primaryAction.type === 'lead') {
    // actor1 is leading actor2
    result = buildChaseEnforcement(primaryAction.actor2, primaryAction.actor1, primaryAction.type);
  } else {
    // actor1 is chasing/pursuing actor2
    result = buildChaseEnforcement(primaryAction.actor1, primaryAction.actor2, primaryAction.type);
  }
  
  // Build enhanced prompt
  result.enhancedPrompt = `${result.spatialLockPrompt}\n\n[SCENE DESCRIPTION]\n${originalPrompt}\n\n[AVOID: ${result.negativePrompts.slice(0, 5).join(', ')}]`;
  
  return result;
}

// Multi-shot continuity enforcement
function buildContinuityEnforcement(
  previousShotResult: SpatialLockResult | null,
  currentPrompt: string
): { continuityPrompt: string; continuityNegatives: string[] } {
  if (!previousShotResult || !previousShotResult.detected) {
    return { continuityPrompt: '', continuityNegatives: [] };
  }
  
  const continuityPrompt = `[CONTINUITY FROM PREVIOUS SHOT]
The following spatial relationships MUST be maintained:
${previousShotResult.relationships.map(r => 
  `- ${r.actor1.name} remains ${r.actor1.relativePosition} (${r.actor1.action})`
).join('\n')}
${previousShotResult.relationships.map(r =>
  `- ${r.actor2.name} remains ${r.actor2.relativePosition} (${r.actor2.action})`
).join('\n')}
No position swaps or role reversals allowed.`;
  
  const continuityNegatives = [
    'characters swapped positions',
    'roles reversed',
    'spatial discontinuity',
    ...previousShotResult.negativePrompts,
  ];
  
  return { continuityPrompt, continuityNegatives };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { 
      prompt, 
      prompts, // Array for multi-shot processing
      previousShotContext,
      mode = 'single' // 'single' or 'multi'
    } = await req.json();
    
    console.log(`[Spatial-Action Lock] Processing in ${mode} mode`);
    
    if (mode === 'multi' && Array.isArray(prompts)) {
      // Process multiple prompts with continuity
      const results: any[] = [];
      let previousResult: SpatialLockResult | null = null;
      
      for (let i = 0; i < prompts.length; i++) {
        const shotPrompt = prompts[i];
        const result = processPromptForSpatialLocks(shotPrompt.prompt || shotPrompt);
        
        // Add continuity from previous shot
        if (previousResult && previousResult.detected) {
          const { continuityPrompt, continuityNegatives } = buildContinuityEnforcement(previousResult, shotPrompt.prompt || shotPrompt);
          result.enhancedPrompt = `${continuityPrompt}\n\n${result.enhancedPrompt}`;
          result.negativePrompts = [...new Set([...result.negativePrompts, ...continuityNegatives])];
        }
        
        results.push({
          shotIndex: i,
          originalPrompt: shotPrompt.prompt || shotPrompt,
          ...result,
        });
        
        // Carry forward context
        if (result.detected) {
          previousResult = result;
        }
      }
      
      console.log(`[Spatial-Action Lock] Processed ${results.length} shots, ${results.filter(r => r.detected).length} with spatial locks`);
      
      return new Response(
        JSON.stringify({
          success: true,
          mode: 'multi',
          results,
          summary: {
            totalShots: results.length,
            shotsWithSpatialLocks: results.filter(r => r.detected).length,
            detectedActionTypes: [...new Set(results.filter(r => r.detected).map(r => r.actionType))],
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Single prompt mode
    const result = processPromptForSpatialLocks(prompt);
    
    // Add continuity from previous shot if provided
    if (previousShotContext) {
      const prevResult = processPromptForSpatialLocks(previousShotContext);
      if (prevResult.detected) {
        const { continuityPrompt, continuityNegatives } = buildContinuityEnforcement(prevResult, prompt);
        result.enhancedPrompt = `${continuityPrompt}\n\n${result.enhancedPrompt}`;
        result.negativePrompts = [...new Set([...result.negativePrompts, ...continuityNegatives])];
      }
    }
    
    console.log(`[Spatial-Action Lock] Detected: ${result.detected}, Type: ${result.actionType}`);
    if (result.detected) {
      console.log(`[Spatial-Action Lock] Characters: ${result.characters.map(c => `${c.name} (${c.role})`).join(', ')}`);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        mode: 'single',
        ...result,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("[Spatial-Action Lock] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
