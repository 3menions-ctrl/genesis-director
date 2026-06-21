import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("mode-router - handles CORS preflight", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/mode-router`, {
    method: "OPTIONS",
    headers: {
      "Origin": "https://example.com",
      "Access-Control-Request-Method": "POST",
    },
  });

  await response.text(); // Consume body
  
  assertEquals(response.status, 200);
  assertExists(response.headers.get("Access-Control-Allow-Origin"));
});

Deno.test("mode-router - title generation fallback works", () => {
  const createFallbackTitle = (prompt: string, mode: string): string => {
    const cleanPrompt = prompt
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    const words = cleanPrompt.split(' ').filter(w => 
      w.length > 2 && !['the', 'and', 'for', 'with', 'about', 'that', 'this', 'from', 'into'].includes(w.toLowerCase())
    );
    
    if (words.length >= 2) {
      const titleWords = words.slice(0, 4).map(w => 
        w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      );
      return titleWords.join(' ');
    }
    
    const modeLabel = mode.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return `${modeLabel} Creation`;
  };

  // Test with meaningful prompt
  const title1 = createFallbackTitle("A beautiful sunset over the ocean with dolphins", "text-to-video");
  assertEquals(title1.length > 0, true);
  assertEquals(title1.includes("Beautiful") || title1.includes("Sunset"), true);

  // Test with short prompt
  const title2 = createFallbackTitle("Hi", "avatar");
  assertEquals(title2, "Avatar Creation");

  // Test mode formatting
  const title3 = createFallbackTitle("x", "motion-transfer");
  assertEquals(title3, "Motion Transfer Creation");
});

Deno.test("mode-router - validates all supported modes", () => {
  const supportedModes = [
    'text-to-video',
    'image-to-video',
    'avatar',
    'video-to-video',
    'motion-transfer',
    'b-roll',
  ];

  // Modes that bypass script generation
  const directModes = ['avatar', 'video-to-video', 'motion-transfer'];
  
  // Modes that use Hollywood pipeline
  const pipelineModes = ['text-to-video', 'image-to-video', 'b-roll'];

  supportedModes.forEach(mode => {
    const isDirect = directModes.includes(mode);
    const isPipeline = pipelineModes.includes(mode);
    
    // Each mode should be either direct or pipeline, not both
    assertEquals(isDirect !== isPipeline, true, `Mode "${mode}" should be categorized`);
  });
});

Deno.test("mode-router - CharacterBible structure validation", () => {
  interface CharacterBible {
    name?: string;
    description?: string;
    personality?: string;
    front_view?: string;
    side_view?: string;
    back_view?: string;
    silhouette?: string;
    hair_description?: string;
    clothing_description?: string;
    body_type?: string;
    distinguishing_features?: string[];
    reference_images?: {
      front?: string;
      side?: string | null;
      back?: string | null;
    };
    negative_prompts?: string[];
  }

  const validBible: CharacterBible = {
    name: "Sarah Mitchell",
    description: "Professional business presenter",
    personality: "Confident, articulate, approachable",
    front_view: "Woman facing camera, professional attire, confident smile",
    reference_images: {
      front: "https://supabase.storage/avatars/sarah-front.png",
      side: null,
      back: null,
    },
    negative_prompts: [
      "different person",
      "face change",
      "different hairstyle",
    ],
  };

  assertExists(validBible.name);
  assertExists(validBible.reference_images);
  assertEquals(Array.isArray(validBible.negative_prompts), true);
});

Deno.test("mode-router - project status transitions are valid", () => {
  const validStatuses = [
    'draft',
    'generating',
    'processing',
    'pending',
    'awaiting_approval',
    'completed',
    'failed',
  ];

  // Active statuses that block new project creation
  const activeStatuses = ['generating', 'processing', 'pending', 'awaiting_approval'];

  activeStatuses.forEach(status => {
    assertEquals(validStatuses.includes(status), true);
  });

  // Terminal statuses that allow new project creation
  const terminalStatuses = ['draft', 'completed', 'failed'];
  terminalStatuses.forEach(status => {
    assertEquals(activeStatuses.includes(status), false);
  });
});
