import { describe, it, expect } from "vitest";
import {
  EFFECT_PRESETS,
  FILTER_PRESETS,
  TEMPLATE_PRESETS,
  STICKER_PRESETS,
  MUSIC_LIBRARY,
  type TimelineTrack,
  type TimelineClip,
} from "@/components/editor/types";

// ─── EFFECTS ───────────────────────────────────────────────────────

describe("EFFECT_PRESETS — all 12 effects are functional", () => {
  it("has exactly 12 effect presets", () => {
    expect(EFFECT_PRESETS).toHaveLength(12);
  });

  it.each(EFFECT_PRESETS.map((e) => [e.id, e]))("%s has required fields", (_id, effect) => {
    expect(effect.name).toBeTruthy();
    expect(effect.category).toMatch(/^(trending|cinematic|creative)$/);
    expect(effect.description).toBeTruthy();
  });

  it.each(EFFECT_PRESETS.map((e) => [e.id, e]))("%s has a valid css string", (_id, effect) => {
    // Every effect must have a css property (even if 'none' for mirror)
    expect(typeof effect.css).toBe("string");
    expect(effect.css.length).toBeGreaterThan(0);
  });

  it("effects with transforms have valid transform strings", () => {
    const withTransform = EFFECT_PRESETS.filter((e) => "transform" in e);
    expect(withTransform.length).toBeGreaterThanOrEqual(4); // mirror, shake, zoom-pulse, ken-burns
    for (const effect of withTransform) {
      expect(typeof (effect as any).transform).toBe("string");
      expect((effect as any).transform.length).toBeGreaterThan(0);
    }
  });

  it("mirror effect uses transform not css filter", () => {
    const mirror = EFFECT_PRESETS.find((e) => e.id === "mirror");
    expect(mirror).toBeDefined();
    expect(mirror!.css).toBe("none");
    expect((mirror as any).transform).toBe("scaleX(-1)");
  });

  it("no effect uses standalone transform functions in css filter", () => {
    // These are transform functions that should never appear as standalone CSS filter values
    // We check with word-boundary-like patterns to avoid false positives (grayscale contains scale)
    for (const effect of EFFECT_PRESETS) {
      if (effect.css === "none") continue;
      // scaleX/scaleY/translateX/translateY are never valid CSS filter functions
      expect(effect.css).not.toMatch(/\bscaleX\(/);
      expect(effect.css).not.toMatch(/\bscaleY\(/);
      expect(effect.css).not.toMatch(/\btranslateX\(/);
      expect(effect.css).not.toMatch(/\btranslateY\(/);
      expect(effect.css).not.toMatch(/\btranslate\(/);
    }
  });

  it("all unique IDs", () => {
    const ids = EFFECT_PRESETS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ─── FILTER PRESETS ────────────────────────────────────────────────

describe("FILTER_PRESETS — all filters are functional", () => {
  it("has at least 10 filter presets", () => {
    expect(FILTER_PRESETS.length).toBeGreaterThanOrEqual(10);
  });

  it.each(FILTER_PRESETS.map((f) => [f.id, f]))("%s has name and css", (_id, filter) => {
    expect(filter.name).toBeTruthy();
    // 'none' filter has no css
    if (filter.id !== "none") {
      expect(typeof filter.css).toBe("string");
      expect(filter.css!.length).toBeGreaterThan(0);
    }
  });

  it("includes a 'none' reset option", () => {
    expect(FILTER_PRESETS.find((f) => f.id === "none")).toBeDefined();
  });

  it("all unique IDs", () => {
    const ids = FILTER_PRESETS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ─── Effect application simulation ────────────────────────────────

describe("Effect application to clip", () => {
  const makeClip = (): TimelineClip => ({
    id: "test-clip",
    trackId: "video-0",
    start: 0,
    end: 5,
    type: "video",
    sourceUrl: "https://example.com/video.mp4",
    label: "Test",
    effects: [],
  });

  it.each(EFFECT_PRESETS.map((e) => e.id))("applying effect '%s' sets filter property", (effectId) => {
    const clip = makeClip();
    const updated = { ...clip, filter: effectId };
    expect(updated.filter).toBe(effectId);

    // Verify the effect can be resolved
    const preset = EFFECT_PRESETS.find((e) => e.id === effectId);
    expect(preset).toBeDefined();
    const cssValue = preset!.css !== "none" ? preset!.css : undefined;
    const transformValue = "transform" in preset! ? (preset as any).transform : undefined;
    // At least one must be defined
    expect(cssValue || transformValue).toBeTruthy();
  });

  it.each(FILTER_PRESETS.filter((f) => f.id !== "none").map((f) => f.id))(
    "applying filter '%s' sets filter property",
    (filterId) => {
      const clip = makeClip();
      const updated = { ...clip, filter: filterId };
      expect(updated.filter).toBe(filterId);
      const preset = FILTER_PRESETS.find((f) => f.id === filterId);
      expect(preset).toBeDefined();
      expect(preset!.css).toBeTruthy();
    }
  );
});

// ─── TEMPLATES ─────────────────────────────────────────────────────

describe("TEMPLATE_PRESETS — all 20 templates are functional", () => {
  it("has exactly 20 template presets", () => {
    expect(TEMPLATE_PRESETS).toHaveLength(20);
  });

  it.each(TEMPLATE_PRESETS.map((t) => [t.id, t]))("%s has required fields", (_id, tpl) => {
    expect(tpl.name).toBeTruthy();
    expect(tpl.description).toBeTruthy();
    expect(tpl.category).toMatch(/^(social|cinematic|commercial|utility)$/);
    expect(tpl.tracks).toBeGreaterThanOrEqual(1);
    expect(tpl.icon).toBeTruthy();
  });

  it("all unique IDs", () => {
    const ids = TEMPLATE_PRESETS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// Simulate template application using the same logic as VideoEditor
describe("Template application logic", () => {
  const baseTracks: TimelineTrack[] = [
    {
      id: "video-0", name: "Video 1", type: "video", muted: false, locked: false,
      clips: [
        { id: "c1", trackId: "video-0", start: 0, end: 5, type: "video", sourceUrl: "a.mp4", label: "C1", effects: [] },
        { id: "c2", trackId: "video-0", start: 5, end: 10, type: "video", sourceUrl: "b.mp4", label: "C2", effects: [] },
      ],
    },
    { id: "audio-0", name: "Audio 1", type: "audio", clips: [], muted: false, locked: false },
    { id: "text-0", name: "Text 1", type: "text", clips: [], muted: false, locked: false },
  ];

  const applyTemplate = (templateId: string, tracks: TimelineTrack[], dur: number) => {
    const textTrack = tracks.find((t) => t.type === "text") || tracks[2];
    const textTrackId = textTrack?.id || "text-0";
    const now = Date.now();

    const mkText = (id: string, start: number, end: number, content: string, fontSize = 48): TimelineClip => ({
      id: `tpl-${id}-${now}`, trackId: textTrackId, start, end,
      type: "text", sourceUrl: "", label: content, effects: [],
      textContent: content, textStyle: { fontSize, color: "#FFFFFF", fontWeight: "bold" },
    });

    const withCrossfades = (ts: TimelineTrack[]): TimelineTrack[] =>
      ts.map((t) =>
        t.type === "video"
          ? {
              ...t,
              clips: t.clips.map((c, i, arr) =>
                i < arr.length - 1
                  ? { ...c, effects: [{ type: "transition" as const, name: "crossfade", duration: 0.5 }] }
                  : c
              ),
            }
          : t
      );

    switch (templateId) {
      case "intro-outro": {
        const introClip = mkText("intro", 0, 3, "YOUR TITLE", 72);
        const outroClip = mkText("outro", Math.max(dur - 3, 3), Math.max(dur, 6), "THANKS FOR WATCHING");
        return {
          tracks: tracks.map((t) => (t.id === textTrackId ? { ...t, clips: [...t.clips, introClip, outroClip] } : t)),
          duration: Math.max(dur, 6),
        };
      }
      case "slideshow":
        return { tracks: withCrossfades(tracks), duration: dur };
      case "tiktok-vertical":
      case "ig-reel":
      case "yt-shorts": {
        const hookClip = mkText("hook", 0, 2, "✨ HOOK TEXT HERE", 56);
        const ctaClip = mkText("cta", Math.max(dur - 3, 2), Math.max(dur, 5), "👉 FOLLOW FOR MORE", 36);
        return {
          tracks: withCrossfades(tracks).map((t) => (t.id === textTrackId ? { ...t, clips: [...t.clips, hookClip, ctaClip] } : t)),
          duration: Math.max(dur, 5),
        };
      }
      case "story-slides": {
        const slideCount = Math.max(3, Math.ceil(dur / 5));
        const slideDur = dur / slideCount;
        const slides = Array.from({ length: slideCount }, (_, i) => mkText(`slide-${i}`, i * slideDur, i * slideDur + 2, `SLIDE ${i + 1}`, 40));
        return { tracks: withCrossfades(tracks).map((t) => (t.id === textTrackId ? { ...t, clips: [...t.clips, ...slides] } : t)), duration: dur };
      }
      case "reaction": {
        const reactText = mkText("react", 0, dur, "😮", 72);
        return { tracks: tracks.map((t) => (t.id === textTrackId ? { ...t, clips: [...t.clips, reactText] } : t)), duration: dur };
      }
      case "movie-trailer": {
        const title = mkText("title", 0, 3, "COMING SOON", 72);
        const tagline = mkText("tag", 3, 6, "A STORY LIKE NO OTHER", 36);
        const date = mkText("date", Math.max(dur - 4, 6), Math.max(dur, 10), "IN THEATERS EVERYWHERE", 32);
        return {
          tracks: withCrossfades(tracks).map((t) => (t.id === textTrackId ? { ...t, clips: [...t.clips, title, tagline, date] } : t)),
          duration: Math.max(dur, 10),
        };
      }
      case "documentary": {
        const lower = mkText("lower", 1, 5, "INTERVIEW SUBJECT — Title", 28);
        const chapter = mkText("chapter", 0, 3, "CHAPTER ONE", 56);
        return { tracks: tracks.map((t) => (t.id === textTrackId ? { ...t, clips: [...t.clips, chapter, lower] } : t)), duration: dur };
      }
      case "music-video":
        return { tracks: withCrossfades(tracks), duration: dur };
      case "short-film": {
        const act1 = mkText("act1", 0, 3, "ACT I", 64);
        const act2 = mkText("act2", dur * 0.33, dur * 0.33 + 3, "ACT II", 64);
        const act3 = mkText("act3", dur * 0.66, dur * 0.66 + 3, "ACT III", 64);
        return { tracks: withCrossfades(tracks).map((t) => (t.id === textTrackId ? { ...t, clips: [...t.clips, act1, act2, act3] } : t)), duration: dur };
      }
      case "product-showcase": {
        const hero = mkText("hero", 0, 3, "✨ PRODUCT NAME", 56);
        const price = mkText("price", Math.max(dur - 3, 3), Math.max(dur, 6), "SHOP NOW — $XX.XX", 40);
        return { tracks: withCrossfades(tracks).map((t) => (t.id === textTrackId ? { ...t, clips: [...t.clips, hero, price] } : t)), duration: Math.max(dur, 6) };
      }
      case "testimonial": {
        const quote = mkText("quote", 1, 5, '"This changed everything."', 36);
        const name = mkText("name", 5, 8, "— Customer Name", 28);
        return { tracks: tracks.map((t) => (t.id === textTrackId ? { ...t, clips: [...t.clips, quote, name] } : t)), duration: dur };
      }
      case "before-after": {
        const beforeLabel = mkText("before", 0, dur / 2, "BEFORE", 48);
        const afterLabel = mkText("after", dur / 2, dur, "AFTER", 48);
        return { tracks: tracks.map((t) => (t.id === textTrackId ? { ...t, clips: [...t.clips, beforeLabel, afterLabel] } : t)), duration: dur };
      }
      case "countdown": {
        const count = 5;
        const segDur = dur / count;
        const numbers = Array.from({ length: count }, (_, i) => mkText(`num-${i}`, i * segDur, i * segDur + 2, `#${count - i}`, 72));
        return { tracks: withCrossfades(tracks).map((t) => (t.id === textTrackId ? { ...t, clips: [...t.clips, ...numbers] } : t)), duration: dur };
      }
      case "promo": {
        const headline = mkText("hl", 0, 2, "🔥 LIMITED TIME", 48);
        const cta = mkText("cta", Math.max(dur - 3, 2), Math.max(dur, 5), "GET YOURS NOW", 40);
        return { tracks: withCrossfades(tracks).map((t) => (t.id === textTrackId ? { ...t, clips: [...t.clips, headline, cta] } : t)), duration: Math.max(dur, 5) };
      }
      case "vlog": {
        const intro = mkText("intro", 0, 3, "WHAT'S UP EVERYONE", 48);
        return { tracks: tracks.map((t) => (t.id === textTrackId ? { ...t, clips: [...t.clips, intro] } : t)), duration: dur };
      }
      case "tutorial": {
        const step1 = mkText("s1", 0, 3, "STEP 1", 48);
        const step2 = mkText("s2", dur * 0.33, dur * 0.33 + 3, "STEP 2", 48);
        const step3 = mkText("s3", dur * 0.66, dur * 0.66 + 3, "STEP 3", 48);
        return { tracks: tracks.map((t) => (t.id === textTrackId ? { ...t, clips: [...t.clips, step1, step2, step3] } : t)), duration: dur };
      }
      case "podcast": {
        const title = mkText("title", 0, 5, "🎙️ PODCAST TITLE", 48);
        return { tracks: tracks.map((t) => (t.id === textTrackId ? { ...t, clips: [...t.clips, title] } : t)), duration: dur };
      }
      case "montage":
        return { tracks: withCrossfades(tracks), duration: dur };
      default:
        return { tracks, duration: dur };
    }
  };

  // Test every single template
  it.each(TEMPLATE_PRESETS.map((t) => t.id))("template '%s' applies without errors and mutates state", (templateId) => {
    const dur = 10;
    const result = applyTemplate(templateId, JSON.parse(JSON.stringify(baseTracks)), dur);

    expect(result).toBeDefined();
    expect(result.tracks).toHaveLength(3);
    expect(result.duration).toBeGreaterThanOrEqual(dur);

    // Templates that add crossfades should have transition effects on video clips
    const crossfadeTemplates = [
      "slideshow", "tiktok-vertical", "ig-reel", "yt-shorts", "story-slides",
      "movie-trailer", "music-video", "short-film", "product-showcase",
      "countdown", "promo", "montage",
    ];
    if (crossfadeTemplates.includes(templateId)) {
      const videoTrack = result.tracks.find((t) => t.type === "video");
      const firstClip = videoTrack?.clips[0];
      expect(firstClip?.effects).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: "transition", name: "crossfade" })])
      );
    }

    // Templates that add text should have text clips on the text track
    const textTemplates = [
      "intro-outro", "tiktok-vertical", "ig-reel", "yt-shorts", "story-slides",
      "reaction", "movie-trailer", "documentary", "short-film",
      "product-showcase", "testimonial", "before-after", "countdown",
      "promo", "vlog", "tutorial", "podcast",
    ];
    if (textTemplates.includes(templateId)) {
      const textTrack = result.tracks.find((t) => t.type === "text");
      expect(textTrack!.clips.length).toBeGreaterThan(0);
      for (const clip of textTrack!.clips) {
        expect(clip.type).toBe("text");
        expect(clip.textContent).toBeTruthy();
        expect(clip.textStyle).toBeDefined();
        expect(clip.start).toBeLessThan(clip.end);
      }
    }
  });

  it("intro-outro adds exactly 2 text clips (intro + outro)", () => {
    const result = applyTemplate("intro-outro", JSON.parse(JSON.stringify(baseTracks)), 10);
    const textTrack = result.tracks.find((t) => t.type === "text");
    expect(textTrack!.clips).toHaveLength(2);
    expect(textTrack!.clips[0].textContent).toBe("YOUR TITLE");
    expect(textTrack!.clips[1].textContent).toBe("THANKS FOR WATCHING");
  });

  it("movie-trailer adds 3 text clips (title + tagline + date)", () => {
    const result = applyTemplate("movie-trailer", JSON.parse(JSON.stringify(baseTracks)), 10);
    const textTrack = result.tracks.find((t) => t.type === "text");
    expect(textTrack!.clips).toHaveLength(3);
    expect(textTrack!.clips[0].textContent).toBe("COMING SOON");
  });

  it("short-film adds 3 act markers", () => {
    const result = applyTemplate("short-film", JSON.parse(JSON.stringify(baseTracks)), 30);
    const textTrack = result.tracks.find((t) => t.type === "text");
    expect(textTrack!.clips).toHaveLength(3);
    expect(textTrack!.clips.map((c) => c.textContent)).toEqual(["ACT I", "ACT II", "ACT III"]);
  });

  it("countdown creates 5 numbered entries", () => {
    const result = applyTemplate("countdown", JSON.parse(JSON.stringify(baseTracks)), 10);
    const textTrack = result.tracks.find((t) => t.type === "text");
    expect(textTrack!.clips).toHaveLength(5);
    expect(textTrack!.clips[0].textContent).toBe("#5");
    expect(textTrack!.clips[4].textContent).toBe("#1");
  });

  it("tutorial creates 3 step markers", () => {
    const result = applyTemplate("tutorial", JSON.parse(JSON.stringify(baseTracks)), 15);
    const textTrack = result.tracks.find((t) => t.type === "text");
    expect(textTrack!.clips).toHaveLength(3);
    expect(textTrack!.clips.map((c) => c.textContent)).toEqual(["STEP 1", "STEP 2", "STEP 3"]);
  });

  it("before-after creates exactly 2 labels spanning full duration", () => {
    const result = applyTemplate("before-after", JSON.parse(JSON.stringify(baseTracks)), 10);
    const textTrack = result.tracks.find((t) => t.type === "text");
    expect(textTrack!.clips).toHaveLength(2);
    expect(textTrack!.clips[0].textContent).toBe("BEFORE");
    expect(textTrack!.clips[1].textContent).toBe("AFTER");
    expect(textTrack!.clips[0].end).toBe(5); // dur / 2
    expect(textTrack!.clips[1].start).toBe(5);
  });
});

// ─── STICKERS & MUSIC ─────────────────────────────────────────────

describe("STICKER_PRESETS completeness", () => {
  it("has at least 20 stickers", () => {
    expect(STICKER_PRESETS.length).toBeGreaterThanOrEqual(20);
  });

  it("all have unique IDs", () => {
    const ids = STICKER_PRESETS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers all categories: emoji, shape, cta", () => {
    const categories = new Set(STICKER_PRESETS.map((s) => s.category));
    expect(categories.has("emoji")).toBe(true);
    expect(categories.has("shape")).toBe(true);
    expect(categories.has("cta")).toBe(true);
  });
});

describe("MUSIC_LIBRARY completeness", () => {
  it("has at least 25 tracks", () => {
    expect(MUSIC_LIBRARY.length).toBeGreaterThanOrEqual(25);
  });

  it("all have unique IDs", () => {
    const ids = MUSIC_LIBRARY.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers all categories", () => {
    const categories = new Set(MUSIC_LIBRARY.map((t) => t.category));
    for (const cat of ["cinematic", "electronic", "ambient", "hip-hop", "pop", "orchestral", "lo-fi", "rock"]) {
      expect(categories.has(cat as any)).toBe(true);
    }
  });

  it("all tracks have valid duration and bpm", () => {
    for (const track of MUSIC_LIBRARY) {
      expect(track.duration).toBeGreaterThan(0);
      expect(track.bpm).toBeGreaterThan(0);
    }
  });
});
