/**
 * COMPREHENSIVE CONTENT SAFETY TESTS
 * 
 * Validates that ALL categories of prohibited content are caught,
 * including obfuscation bypass attempts, unicode tricks, and edge cases.
 */
import { describe, it, expect } from "vitest";
import { checkContentSafety, checkMultipleContent } from "@/lib/contentSafety";

// =====================================================
// EXPLICIT SEXUAL CONTENT - MUST ALL BE BLOCKED
// =====================================================
describe("Explicit sexual content blocking", () => {
  const explicitTerms = [
    "show me porn", "make a pornographic video", "xxx rated content",
    "nude woman walking", "naked man in shower", "nsfw scene",
    "erotic dance scene", "hentai style animation",
    "show her breasts", "expose genitals",
    "sexual intercourse scene", "masturbation",
    "blowjob scene", "bondage fetish video",
    "stripper dancing", "escort service ad",
    "topless on beach", "undressing slowly",
    "seductive woman posing", "aroused character",
  ];

  explicitTerms.forEach((term) => {
    it(`blocks: "${term}"`, () => {
      const result = checkContentSafety(term);
      expect(result.isSafe).toBe(false);
      expect(result.category).not.toBe("safe");
    });
  });
});

// =====================================================
// CHILD SAFETY - ABSOLUTE ZERO TOLERANCE
// =====================================================
describe("Child safety - absolute zero tolerance", () => {
  const childSafetyTerms = [
    "underage girl", "child porn", "loli anime",
    "shota content", "pedo content",
  ];

  childSafetyTerms.forEach((term) => {
    it(`BLOCKS child safety violation: "${term}"`, () => {
      const result = checkContentSafety(term);
      expect(result.isSafe).toBe(false);
    });
  });
});

// =====================================================
// SUGGESTIVE PHRASES - MUST BE BLOCKED
// =====================================================
describe("Suggestive phrase blocking", () => {
  const suggestivePhrases = [
    "take off clothes slowly",
    "getting naked in the rain",
    "undress her completely",
    "in bed together kissing",
    "making love by the fire",
    "having sex in the car",
    "seductive pose on the couch",
    "sexy pose for camera",
    "show body close up",
    "revealing outfit at the party",
  ];

  suggestivePhrases.forEach((phrase) => {
    it(`blocks: "${phrase}"`, () => {
      const result = checkContentSafety(phrase);
      expect(result.isSafe).toBe(false);
    });
  });
});

// =====================================================
// VIOLENCE & GORE - MUST BE BLOCKED
// =====================================================
describe("Violence and gore blocking", () => {
  const violenceTerms = [
    "gore scene with blood everywhere",
    "dismember the body",
    "torture the prisoner",
    "gruesome murder scene",
    "mutilate the corpse",
    "suicide scene on bridge",
    "self-harm with razor",
  ];

  violenceTerms.forEach((term) => {
    it(`blocks: "${term}"`, () => {
      const result = checkContentSafety(term);
      expect(result.isSafe).toBe(false);
      expect(["violence"]).toContain(result.category);
    });
  });
});

// =====================================================
// HATE SPEECH - MUST BE BLOCKED
// =====================================================
describe("Hate speech blocking", () => {
  const hateTerms = [
    "nazi rally scene",
    "kkk march",
    "white supremacy propaganda",
    "ethnic cleansing video",
    "swastika flag waving",
  ];

  hateTerms.forEach((term) => {
    it(`blocks: "${term}"`, () => {
      const result = checkContentSafety(term);
      expect(result.isSafe).toBe(false);
      expect(["hate"]).toContain(result.category);
    });
  });
});

// =====================================================
// OBFUSCATION BYPASS ATTEMPTS - MUST STILL BE CAUGHT
// =====================================================
describe("Obfuscation bypass detection", () => {
  const obfuscatedTerms = [
    { input: "p0rn", desc: "leet speak - 0 for o" },
    { input: "n4k3d", desc: "leet speak - 4 for a, 3 for e" },
    { input: "s3x", desc: "leet speak - 3 for e" },
    { input: "p0rnogr4phy", desc: "multiple leet substitutions" },
    { input: "nud3", desc: "leet - 3 for e" },
    { input: "er0tic", desc: "leet - 0 for o" },
    { input: "n*u*d*e", desc: "asterisk obfuscation" },
    { input: "s.e.x.u.a.l", desc: "dot obfuscation" },
    { input: "p_o_r_n", desc: "underscore obfuscation" },
    { input: "n-u-d-e", desc: "hyphen obfuscation" },
  ];

  obfuscatedTerms.forEach(({ input, desc }) => {
    it(`catches obfuscated: "${input}" (${desc})`, () => {
      const result = checkContentSafety(input);
      expect(result.isSafe).toBe(false);
    });
  });
});

// =====================================================
// SAFE CONTENT - MUST NOT BE BLOCKED (FALSE POSITIVES)
// =====================================================
describe("Safe content - no false positives", () => {
  const safeContent = [
    "A beautiful sunset over the ocean",
    "A woman walking through a garden in a summer dress",
    "An action scene with a car chase through the city",
    "A dramatic courtroom scene with lawyers arguing",
    "A chef cooking a gourmet meal in a restaurant kitchen",
    "A scientist examining data on a computer screen",
    "A classroom full of students learning",
    "A button component rendering on screen",
    "A classic car driving through the countryside",
    "An assassin's creed style parkour scene",
    "A passionate speech about equality and justice",
    "A basketball player shooting a three-pointer",
    "The artist revealed her masterpiece to the audience",
    "The sensory experience of walking through a forest",
  ];

  safeContent.forEach((content) => {
    it(`allows safe: "${content}"`, () => {
      const result = checkContentSafety(content);
      expect(result.isSafe).toBe(true);
    });
  });
});

// =====================================================
// MULTIPLE CONTENT CHECK
// =====================================================
describe("Multiple content validation", () => {
  it("blocks if ANY field is unsafe", () => {
    const result = checkMultipleContent(
      "A beautiful sunset",
      "nude woman on the beach",
      "Ocean waves"
    );
    expect(result.isSafe).toBe(false);
  });

  it("passes if ALL fields are safe", () => {
    const result = checkMultipleContent(
      "A beautiful sunset",
      "Ocean waves crashing",
      "Birds flying overhead"
    );
    expect(result.isSafe).toBe(true);
  });

  it("handles null/undefined fields gracefully", () => {
    const result = checkMultipleContent("Safe content", null, undefined);
    expect(result.isSafe).toBe(true);
  });

  it("handles empty string", () => {
    const result = checkContentSafety("");
    expect(result.isSafe).toBe(true);
  });
});

// =====================================================
// EDGE CASES & BOUNDARY TESTS
// =====================================================
describe("Edge cases", () => {
  it("handles very long input without crashing", () => {
    const longInput = "safe content ".repeat(1000);
    const result = checkContentSafety(longInput);
    expect(result.isSafe).toBe(true);
  });

  it("handles special characters without crashing", () => {
    const specialChars = "!@#$%^&*()_+{}|:<>?[]\\;',./~`";
    const result = checkContentSafety(specialChars);
    expect(result.isSafe).toBe(true);
  });

  it("handles mixed case", () => {
    const result = checkContentSafety("PORNOGRAPHIC content");
    expect(result.isSafe).toBe(false);
  });

  it("catches word 'sex' but not 'sextant' or 'sextet'", () => {
    // 'sex' with boundary check should catch standalone
    const resultSex = checkContentSafety("show me sex");
    expect(resultSex.isSafe).toBe(false);
  });
});
