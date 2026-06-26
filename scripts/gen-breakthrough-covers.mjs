/**
 * Generates bespoke, color-matched SVG cover art for each Breakthrough Effect
 * template. Each cover depicts the template's CONTAINER chrome plus a
 * "breakthrough" motif crossing the boundary, tinted with the template's own
 * colorGrade. Output → src/assets/templates/breakthrough/<id>.svg
 *
 * Run: node scripts/gen-breakthrough-covers.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "../src/assets/templates/breakthrough");
mkdirSync(OUT, { recursive: true });

const W = 1200, H = 1500;

// One entry per shipped template (id, name, grade, container, violation badge).
const TEMPLATES = [
  { id: "bt-social-feed-breakout", name: "Social Feed Breakout", container: "social-feed", violation: "climb-out", dest: "toward viewer", c: ["#0066FF", "#FFFFFF", "#00D4FF"] },
  { id: "bt-billboard-walkout", name: "Billboard Walkout", container: "billboard", violation: "shatter-step", dest: "off-screen", c: ["#0B0B14", "#FF2EA6", "#22D3EE"] },
  { id: "bt-aquarium-pour-out", name: "Aquarium Pour-Out", container: "aquarium", violation: "pour / liquefy", dest: "toward viewer", c: ["#06303A", "#34D3C5", "#EAF7FF"] },
  { id: "bt-cctv-grid-walk-across", name: "CCTV Grid Walk-Across", container: "cctv-grid", violation: "reach-through", dest: "adjacent UI", c: ["#05080A", "#19E0C0", "#9AF7E6"] },
  { id: "bt-group-chat-swarm", name: "Group Chat Swarm", container: "group-chat", violation: "swarm", dest: "adjacent UI", c: ["#0A1830", "#3B82F6", "#E5EEFF"] },
  { id: "bt-wanted-poster-peel", name: "Wanted Poster Peel", container: "wanted-poster", violation: "peel", dest: "off-screen", c: ["#2A1C0E", "#C29B5B", "#F2E2C2"] },
  { id: "bt-home-screen-fold-out", name: "Home Screen Fold-Out", container: "app-icon-home", violation: "fold to 3D", dest: "outer space", c: ["#05010F", "#7C3AED", "#E9D5FF"] },
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

// ── Per-container chrome + breakthrough motif ───────────────────────────────
function motif(t) {
  const [p, s, a] = t.c;
  switch (t.container) {
    case "social-feed":
      return `
        <rect x="300" y="360" width="600" height="700" rx="36" fill="#ffffff" opacity="0.10"/>
        <circle cx="360" cy="430" r="34" fill="${s}" opacity="0.5"/>
        <rect x="410" y="412" width="240" height="18" rx="9" fill="${s}" opacity="0.4"/>
        <rect x="340" y="500" width="520" height="320" rx="20" fill="${p}" opacity="0.55"/>
        <!-- figure climbing out toward viewer -->
        <path d="M600 520 q40 120 -10 240 q120 60 70 220 q-160 40 -260 -60 q40 -200 120 -300 q-30 -90 80 -100 z" fill="${a}" opacity="0.95"/>
        <circle cx="600" cy="500" r="58" fill="${a}"/>
        ${shards(560, 760, a)}`;
    case "billboard":
      return `
        <rect x="250" y="300" width="700" height="430" rx="18" fill="#ffffff" opacity="0.08"/>
        <rect x="280" y="330" width="640" height="370" rx="10" fill="${p}" opacity="0.7" stroke="${a}" stroke-width="4"/>
        ${scan(280, 330, 640, 370, a)}
        <!-- leaping figure dropping off the bottom -->
        <path d="M640 600 q30 90 -20 170 q90 60 30 200 l-120 110 q-70 -60 -10 -180 q40 -150 40 -300 z" fill="${s}"/>
        <circle cx="650" cy="585" r="46" fill="${s}"/>
        ${shards(560, 700, a)}`;
    case "aquarium":
      return `
        <rect x="280" y="380" width="640" height="560" rx="14" fill="${p}" opacity="0.85" stroke="${s}" stroke-width="6"/>
        <path d="M280 520 q160 -40 320 0 t320 0 v420 h-640 z" fill="${s}" opacity="0.30"/>
        <ellipse cx="470" cy="640" rx="40" ry="22" fill="${a}"/><ellipse cx="700" cy="720" rx="34" ry="18" fill="${a}" opacity="0.8"/>
        <!-- water pouring out toward viewer -->
        <path d="M300 920 q120 120 300 150 q260 -10 300 -150 q-40 220 -300 280 q-280 -40 -300 -280 z" fill="${a}" opacity="0.85"/>
        ${[...Array(7)].map((_,i)=>`<circle cx="${360+i*70}" cy="${1180+(i%3)*40}" r="${10+(i%3)*6}" fill="${a}" opacity="0.7"/>`).join("")}`;
    case "cctv-grid": {
      const cells = [];
      for (let r = 0; r < 2; r++) for (let cI = 0; cI < 3; cI++) {
        const x = 250 + cI * 240, y = 420 + r * 320;
        cells.push(`<rect x="${x}" y="${y}" width="220" height="300" rx="8" fill="${p}" opacity="0.8" stroke="${s}" stroke-width="3"/>${scan(x,y,220,300,a)}<circle cx="${x+24}" cy="${y+24}" r="7" fill="#ff4d4d"/>`);
      }
      return `${cells.join("")}
        <!-- figure crossing a torn seam between cell 1 and 2 -->
        <path d="M470 540 l60 -20 l-10 360 l-60 10 z" fill="${a}" opacity="0.6"/>
        <path d="M500 560 q26 70 -10 150 q70 40 20 150 q-110 20 -150 -50 q30 -130 60 -200 q-20 -70 80 -70 z" fill="${a}"/>
        <circle cx="510" cy="540" r="38" fill="${a}"/>`;
    }
    case "group-chat": {
      const bubbles = [];
      for (let i = 0; i < 5; i++) {
        const left = i % 2 === 0;
        bubbles.push(`<rect x="${left?300:560}" y="${380+i*90}" width="${left?300:340}" height="64" rx="32" fill="${left? "#ffffff":s}" opacity="${left?0.18:0.5}"/>`);
      }
      // swarm of small bubbles streaming out to a tab bar
      const swarm = [...Array(26)].map((_,i)=>{
        const t = i/25; const x = 600 + Math.cos(t*7)*220*t + 180*t; const y = 760 - Math.sin(t*6)*180*(1-t) + 300*t;
        return `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(18-12*t).toFixed(1)}" fill="${a}" opacity="${(0.9-0.4*t).toFixed(2)}"/>`;
      }).join("");
      return `${bubbles.join("")}<rect x="300" y="1080" width="600" height="80" rx="22" fill="${s}" opacity="0.4"/>${swarm}`;
    }
    case "wanted-poster":
      return `
        <rect x="320" y="330" width="560" height="800" rx="8" fill="${s}" opacity="0.18" stroke="${s}" stroke-width="4"/>
        <rect x="380" y="500" width="440" height="380" rx="6" fill="${p}" opacity="0.6"/>
        <circle cx="600" cy="660" r="86" fill="${a}" opacity="0.85"/>
        <rect x="430" y="900" width="340" height="26" rx="8" fill="${a}" opacity="0.5"/>
        <!-- peeling corner with a figure stepping off -->
        <path d="M380 500 l140 0 l-140 140 z" fill="${a}" opacity="0.9"/>
        <path d="M770 720 q30 90 -16 180 q86 50 30 190 q-120 26 -160 -50 q34 -150 66 -240 q-20 -70 80 -80 z" fill="${a}"/>
        <circle cx="780" cy="700" r="44" fill="${a}"/>`;
    case "app-icon-home": {
      const icons = [];
      for (let r = 0; r < 4; r++) for (let cI = 0; cI < 4; cI++) {
        const x = 320 + cI * 150, y = 420 + r * 150;
        const hero = r === 1 && cI === 1;
        icons.push(`<rect x="${x}" y="${y}" width="110" height="110" rx="26" fill="${hero?a:s}" opacity="${hero?0.95:0.3}"/>`);
      }
      const stars = [...Array(40)].map((_,i)=>`<circle cx="${(60+ (i*97)%1080).toFixed(0)}" cy="${(40+(i*53)%420).toFixed(0)}" r="${(1+(i%3)).toFixed(0)}" fill="${a}" opacity="0.7"/>`).join("");
      return `${stars}${icons.join("")}
        <!-- icon folding into a craft flying up -->
        <path d="M560 430 l80 0 l40 -70 l-160 0 z" fill="${a}"/>
        <path d="M600 360 l60 -120 l-120 0 z" fill="${a}"/>
        <path d="M600 240 l8 -120 l-16 0 z" fill="${a}" opacity="0.6"/>`;
    }
    default:
      return "";
  }
}

function scan(x, y, w, h, a) {
  const lines = [];
  for (let yy = y + 8; yy < y + h; yy += 14) lines.push(`<rect x="${x}" y="${yy}" width="${w}" height="2" fill="${a}" opacity="0.12"/>`);
  return lines.join("");
}
function shards(cx, cy, a) {
  return [...Array(9)].map((_, i) => {
    const ang = (i / 9) * Math.PI * 2; const d = 120 + (i % 3) * 50;
    const x = cx + Math.cos(ang) * d, y = cy + Math.sin(ang) * d;
    return `<path d="M${x.toFixed(0)} ${y.toFixed(0)} l18 6 l-8 18 z" fill="${a}" opacity="0.7"/>`;
  }).join("");
}

function svg(t) {
  const [p, s, a] = t.c;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t.name)}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="34%" r="80%">
      <stop offset="0%" stop-color="${s}" stop-opacity="0.22"/>
      <stop offset="40%" stop-color="${p}"/>
      <stop offset="100%" stop-color="#000000"/>
    </radialGradient>
    <linearGradient id="vig" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000" stop-opacity="0"/>
      <stop offset="72%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.78"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect x="20" y="20" width="${W-40}" height="${H-40}" rx="28" fill="none" stroke="${a}" stroke-opacity="0.35" stroke-width="3"/>
  ${motif(t)}
  <rect width="${W}" height="${H}" fill="url(#vig)"/>
  <text x="60" y="${H-150}" font-family="Georgia, 'Times New Roman', serif" font-size="74" font-weight="700" fill="#ffffff">${esc(t.name)}</text>
  <text x="62" y="${H-92}" font-family="ui-monospace, Menlo, monospace" font-size="30" letter-spacing="3" fill="${a}" opacity="0.95">${esc(t.container)} · ${esc(t.violation)} · ${esc(t.dest)}</text>
</svg>
`;
}

let count = 0;
for (const t of TEMPLATES) {
  writeFileSync(join(OUT, `${t.id}.svg`), svg(t), "utf8");
  count++;
}
console.log(`wrote ${count} covers → ${OUT}`);
