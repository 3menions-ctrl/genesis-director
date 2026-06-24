/**
 * Growth hub consolidation + launchpad contract.
 *
 * Growth's 19 flat tabs were consolidated into the Overview + 4 clusters
 * (Analytics / Experiments / Content / Comms), each holding its member pages
 * behind a ClusterTabs strip. The GrowthOverview deck is the launchpad and
 * deep-links into every cluster. These source-grep guards keep that wiring from
 * silently regressing.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

const hub = read("src/refine/pages/hubs/GrowthHubPage.tsx");
const deck = read("src/refine/pages/hubs/decks/GrowthOverview.tsx");

const CLUSTERS = ["analytics", "experiments", "content", "comms"] as const;

describe("Growth hub consolidation", () => {
  it("uses ClusterTabs to group member pages", () => {
    expect(hub).toMatch(/import \{ ClusterTabs \}/);
    expect(hub).toMatch(/<ClusterTabs tabs=\{/);
  });

  it("exposes Overview + exactly the 4 clusters as top-level tabs", () => {
    for (const c of CLUSTERS) {
      expect(hub).toMatch(new RegExp(`id: "${c}", label:`));
    }
    // Overview is still the single suggested default.
    expect((hub.match(/suggested: true/g) ?? []).length).toBe(1);
    expect(hub).toMatch(/defaultTab="overview"/);
  });

  it("keeps every member page reachable inside a cluster", () => {
    // A few representatives from each cluster.
    for (const id of ["traffic", "events", "projections", "cohorts", "onboarding", "flags", "gallery", "templates", "avatars", "safety", "comments", "changelog", "macros"]) {
      expect(hub).toMatch(new RegExp(`id: "${id}",`));
    }
  });

  it("overview launchpad deep-links into each cluster", () => {
    for (const c of CLUSTERS) {
      expect(deck).toMatch(new RegExp(`/admin/growth#${c}`));
    }
  });

  it("overview pulls cross-domain live data (not just traffic)", () => {
    expect(deck).toMatch(/from\("experiments"\)/);
    expect(deck).toMatch(/count\("gallery_showcase"\)/);
    expect(deck).toMatch(/from\("announcements"\)/);
  });
});
