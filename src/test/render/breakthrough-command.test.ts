import { describe, it, expect } from "vitest";
import {
  buildBreakthroughCommand,
  type BreakthroughCommandOpts,
} from "../../../supabase/functions/_shared/breakthrough-command.ts";

function opts(over: Partial<BreakthroughCommandOpts> = {}): BreakthroughCommandOpts {
  return {
    aspectRatio: "9:16",
    resolution: "1080p",
    format: "mp4",
    durationSec: 12,
    chromeUrl: "https://x/chrome.png",
    innerUrl: "https://x/inner.mp4",
    subjectUrl: "https://x/subject.mp4",
    aftermathUrl: "https://x/aftermath.mp4",
    mediaWindow: { x: 0.1, y: 0.2, width: 0.8, height: 0.46 },
    mask: {
      shape: "shatter",
      region: { x: 0.1, y: 0.2, width: 0.8, height: 0.46 },
      featherPx: 10,
      openStartSec: 5.5,
      openEndSec: 6.5,
    },
    motion: [
      { property: "scale", at: 0, value: 1 },
      { property: "scale", at: 1, value: 1.6 },
    ],
    subjectActiveFromSec: 6,
    subjectActiveToSec: 11,
    aftermathFromSec: 9,
    chromakey: { color: "#00B140" },
    ...over,
  };
}

describe("buildBreakthroughCommand", () => {
  it("loops the chrome still and wires 4 video inputs in order", () => {
    const { command, inputs } = buildBreakthroughCommand(opts());
    expect(command).toContain("-loop 1 -t 12 -i file1"); // chrome still looped
    expect(command).toContain("-i file2"); // inner
    expect(command).toContain("-i file3"); // subject
    expect(command).toContain("-i file4"); // aftermath
    expect(inputs.file1).toBe("https://x/chrome.png");
    expect(inputs.file2).toBe("https://x/inner.mp4");
    expect(inputs.file3).toBe("https://x/subject.mp4");
    expect(inputs.file4).toBe("https://x/aftermath.mp4");
  });

  it("chroma-keys + despills the subject before compositing it", () => {
    const { command } = buildBreakthroughCommand(opts());
    expect(command).toMatch(/\[2:v\]chromakey=0x00B140:0\.3:0\.1,despill/);
    // the keyed label feeds the overlay stack
    expect(command).toContain("bt_subj_keyed");
  });

  it("produces a single composited video map and a final output", () => {
    const { command, outputName } = buildBreakthroughCommand(opts());
    expect(command).toMatch(/-map "\[bt_out\]"/);
    expect(command).toContain("output1");
    expect(command).toContain("-filter_complex");
    expect(outputName).toBe("breakthrough.mp4");
  });

  it("mixes music + a break-beat SFX delayed to the hit", () => {
    const { command, inputs } = buildBreakthroughCommand(
      opts({ musicUrl: "https://x/music.mp3", sfx: { url: "https://x/hit.wav", atSec: 6 } }),
    );
    // both audio inputs added
    expect(Object.values(inputs)).toContain("https://x/music.mp3");
    expect(Object.values(inputs)).toContain("https://x/hit.wav");
    // sfx delayed to 6000ms, then amixed with the music bed
    expect(command).toContain("adelay=6000|6000");
    expect(command).toMatch(/amix=inputs=2/);
    expect(command).toMatch(/-map "\[bt_aout\]"/);
  });

  it("is silent (-an) when no audio sources are given", () => {
    const { command } = buildBreakthroughCommand(opts());
    expect(command).toContain("-an");
    expect(command).not.toContain("bt_aout");
  });

  it("omits the aftermath input when none is supplied", () => {
    const { command, inputs } = buildBreakthroughCommand(opts({ aftermathUrl: undefined }));
    expect(inputs.file4).toBeUndefined();
    expect(command).not.toContain("-i file4");
  });

  it("honours a CRF override on the video codec", () => {
    const { command } = buildBreakthroughCommand(opts({ crf: 20 }));
    expect(command).toMatch(/-crf 20/);
  });
});
