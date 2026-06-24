/**
 * Admin hub → Overview deck wiring contract.
 *
 * Each consolidated admin hub (/admin/people, /growth, /money, /production-hub,
 * /system) opens on a bespoke "Overview" landing deck rather than dumping the
 * operator straight into the first embedded tool. These source-grep checks pin
 * that wiring so a refactor can't silently drop a hub back to a raw tool tab:
 *
 *   - the hub lazy-imports its ./decks/<Hub>Overview
 *   - "overview" is the first tab AND the only `suggested` one
 *   - defaultTab is "overview"
 *   - the deck file exists and has a default export
 *
 * Grep over source is blunt but exactly right: it fails the moment a hub loses
 * its overview wiring.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "../../..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf-8");

const HUBS = ["People", "Growth", "Money", "Production", "System"] as const;

describe("admin hub → Overview deck wiring", () => {
  for (const hub of HUBS) {
    describe(`${hub} hub`, () => {
      const hubSrc = read(`src/refine/pages/hubs/${hub}HubPage.tsx`);

      it("lazy-imports its Overview deck", () => {
        expect(hubSrc).toMatch(
          new RegExp(`lazy\\(\\(\\) => import\\("\\./decks/${hub}Overview"\\)\\)`),
        );
      });

      it("exposes an 'overview' tab marked suggested", () => {
        expect(hubSrc).toMatch(/id:\s*"overview"[^}]*suggested:\s*true/);
      });

      it("defaults to the overview tab", () => {
        expect(hubSrc).toMatch(/defaultTab="overview"/);
      });

      it("has exactly one suggested tab (overview)", () => {
        const suggested = hubSrc.match(/suggested:\s*true/g) ?? [];
        expect(suggested.length).toBe(1);
      });

      it("ships the deck with a default export", () => {
        const deckPath = `src/refine/pages/hubs/decks/${hub}Overview.tsx`;
        expect(existsSync(resolve(ROOT, deckPath))).toBe(true);
        expect(read(deckPath)).toMatch(/export default function/);
      });
    });
  }
});
