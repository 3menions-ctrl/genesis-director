import { useMemo, useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface VisualStyle {
  id: string;
  name: string;
  category: "Cinematic" | "Animation" | "Retro" | "Editorial" | "Genre" | "Experimental";
  description: string;
  modifier: string; // appended to prompt
  swatch: [string, string, string];
}

export const VISUAL_STYLES: VisualStyle[] = [
  // Cinematic
  { id: "cinematic-35mm", name: "Cinematic 35mm",   category: "Cinematic",   description: "Hollywood feature look, anamorphic flares, shallow depth.", modifier: "shot on 35mm anamorphic, cinematic color grade, shallow depth of field, lens flare", swatch: ["#1a1a1a","#c9a84c","#e8dcb4"] },
  { id: "noir",            name: "Film Noir",        category: "Cinematic",   description: "High-contrast monochrome with venetian-blind shadows.",     modifier: "black and white film noir, chiaroscuro lighting, hard shadows, 1940s detective aesthetic", swatch: ["#000000","#3b3b3b","#f5f5f5"] },
  { id: "golden-hour",     name: "Golden Hour",      category: "Cinematic",   description: "Warm honey light and long shadows.",                       modifier: "golden hour lighting, warm sunlit haze, long shadows, lens bloom", swatch: ["#f9b56e","#e07b39","#3b1f0a"] },
  { id: "blade-runner",    name: "Neon Noir",        category: "Cinematic",   description: "Wet streets, magenta-cyan neon, atmospheric haze.",        modifier: "neon noir, magenta and cyan rim light, rain-slicked streets, volumetric fog", swatch: ["#0a0a1f","#ff2a8a","#00e5ff"] },
  { id: "wes-anderson",    name: "Symmetry Pastel",  category: "Cinematic",   description: "Symmetrical framing, pastel palette, deadpan tone.",       modifier: "symmetrical composition, pastel palette, centered framing, Wes Anderson style", swatch: ["#f4d4b8","#9bc4bc","#d97a6c"] },
  { id: "kubrick",         name: "One-Point Epic",   category: "Cinematic",   description: "One-point perspective, glacial dolly, sterile palette.",   modifier: "one-point perspective, slow dolly, Kubrick symmetry, sterile color palette", swatch: ["#bdbdbd","#1c1c1c","#9c1414"] },
  // Animation
  { id: "anime-90s",       name: "90s Anime Cel",    category: "Animation",   description: "Cel-shaded, hand-painted backgrounds.",                    modifier: "1990s anime cel animation, hand-painted backgrounds, ink outlines", swatch: ["#ffd9c0","#ff5e5e","#1f3a8a"] },
  { id: "studio-ghibli",   name: "Ghibli Painterly", category: "Animation",   description: "Soft watercolor skies, gentle pastoral magic.",            modifier: "Studio Ghibli watercolor painterly style, soft pastoral light, lush nature", swatch: ["#a8d8ea","#f7d488","#5b8a3a"] },
  { id: "pixar-3d",        name: "Pixar 3D",         category: "Animation",   description: "Plush volumetric 3D with expressive lighting.",            modifier: "Pixar quality 3D animation, soft volumetric lighting, expressive character design", swatch: ["#ff8a4c","#4cb6ff","#ffe066"] },
  { id: "claymation",      name: "Claymation",       category: "Animation",   description: "Stop-motion clay textures, fingerprints visible.",         modifier: "stop-motion claymation, visible fingerprints, tactile clay texture, slight frame stutter", swatch: ["#c97f5a","#f0d2a8","#5a3b2a"] },
  { id: "comic-ink",       name: "Comic Ink",        category: "Animation",   description: "Bold ink outlines, halftone shading.",                     modifier: "graphic novel comic style, bold black ink outlines, halftone shading, flat colors", swatch: ["#ffeb3b","#1c1c1c","#e53935"] },
  // Retro
  { id: "vhs",             name: "VHS Tape",         category: "Retro",       description: "Tracking lines, chromatic aberration, 480p mush.",         modifier: "1985 VHS tape aesthetic, tracking lines, chromatic aberration, low resolution warmth", swatch: ["#5e2ca5","#ff5e5e","#0c0c2a"] },
  { id: "polaroid",        name: "Polaroid 70s",     category: "Retro",       description: "Faded film, soft focus, milky highlights.",                modifier: "1970s Polaroid film, faded warm tones, soft focus, milky highlights", swatch: ["#dcb98c","#7a4a2c","#f4e8d0"] },
  { id: "synthwave",       name: "Synthwave",        category: "Retro",       description: "Sunset gradients, chrome grids, neon horizon.",            modifier: "1980s synthwave aesthetic, neon grid horizon, chrome reflections, sunset gradient", swatch: ["#ff2bd6","#a020f0","#0a0033"] },
  { id: "super8",          name: "Super 8mm",        category: "Retro",       description: "Grainy home-movie nostalgia, gate weave.",                 modifier: "Super 8mm film, heavy grain, gate weave, light leaks, vintage home movie", swatch: ["#d4a574","#3b2a1a","#f0d2a8"] },
  // Editorial
  { id: "vogue",           name: "Vogue Editorial",  category: "Editorial",   description: "High fashion, sculpted light, glossy retouch.",            modifier: "Vogue high fashion editorial, sculpted three-point lighting, glossy retouch, couture", swatch: ["#000000","#d4af37","#ffffff"] },
  { id: "documentary",     name: "Verité Doc",       category: "Editorial",   description: "Handheld, available light, raw authenticity.",             modifier: "verité documentary style, handheld camera, available light, authentic unposed moments", swatch: ["#5a4a3a","#a8907a","#e5d8c4"] },
  { id: "minimalist",      name: "Minimal Studio",   category: "Editorial",   description: "Clean white sweep, soft shadow, product hero.",            modifier: "minimalist white studio, soft single source lighting, clean negative space", swatch: ["#ffffff","#e0e0e0","#1a1a1a"] },
  // Genre
  { id: "horror",          name: "A24 Horror",       category: "Genre",       description: "Slow zoom, candlelit dread, muted palette.",               modifier: "A24 elevated horror, slow creeping zoom, candlelight, muted desaturated palette, dread", swatch: ["#1a0a0a","#8c2424","#3b3b3b"] },
  { id: "western",         name: "Spaghetti Western",category: "Genre",       description: "Sun-bleached desert, extreme close-ups, dust.",            modifier: "spaghetti western, sun-bleached desert, extreme close-up on eyes, dust haze, Sergio Leone", swatch: ["#c9a06c","#7a3a1a","#3b2a1a"] },
  { id: "fantasy-epic",    name: "Fantasy Epic",     category: "Genre",       description: "Sweeping vistas, mythic scale, painterly skies.",          modifier: "high fantasy epic, sweeping landscape vistas, mythic scale, painterly dramatic skies", swatch: ["#2a3b8c","#d4a574","#1a1a3b"] },
  { id: "mockumentary",    name: "Mockumentary",     category: "Genre",       description: "Talking heads, awkward zooms, fluorescent office.",        modifier: "mockumentary sitcom style, talking head interviews, awkward zoom, fluorescent office light", swatch: ["#9eb89e","#d4d4d4","#3b3b3b"] },
  // Experimental
  { id: "glitch",          name: "Datamosh",         category: "Experimental",description: "Pixel sort, datamosh artifacts, analog noise.",            modifier: "datamosh glitch art, pixel sorting, analog video noise, broken codec aesthetic", swatch: ["#00ff88","#ff00aa","#000000"] },
  { id: "tilt-shift",      name: "Tilt-Shift Mini",  category: "Experimental",description: "Miniature world effect, hyper-saturated colors.",          modifier: "tilt-shift miniature effect, selective focus, hyper-saturated toy world", swatch: ["#5ec4ff","#ffd24c","#3a8a3a"] },
  { id: "infrared",        name: "Infrared Surreal", category: "Experimental",description: "Crimson foliage, alien dreamscape.",                       modifier: "infrared photography, crimson foliage, surreal dreamlike palette, false color", swatch: ["#e53935","#ffd9c0","#1a1a1a"] },
];

const CATS = ["All","Cinematic","Animation","Retro","Editorial","Genre","Experimental"] as const;

interface Props { selectedId?: string; onSelect: (style: VisualStyle) => void; }

export function StylesDrawerContent({ selectedId, onSelect }: Props) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<typeof CATS[number]>("All");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return VISUAL_STYLES.filter(st => (cat === "All" || st.category === cat) && (!s || `${st.name} ${st.description} ${st.category}`.toLowerCase().includes(s)));
  }, [q, cat]);

  return (
    <div className="space-y-5 p-7">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search visual styles…" className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-sm outline-none focus:border-accent/50" />
        </div>
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 premium-scroll">
          {CATS.map(c => (
            <button key={c} onClick={() => setCat(c)} className={cn("h-9 whitespace-nowrap rounded-lg px-3 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors", cat === c ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}>{c}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map(style => {
          const active = selectedId === style.id;
          return (
            <button key={style.id} onClick={() => onSelect(style)} className={cn("group relative overflow-hidden rounded-xl border-2 text-left transition-all", active ? "border-accent shadow-[0_0_28px_rgba(10,132,255,0.35)]" : "border-border hover:border-accent/45")}>
              <div className="relative h-28 overflow-hidden" style={{ background: `linear-gradient(135deg, ${style.swatch[0]}, ${style.swatch[1]} 55%, ${style.swatch[2]})` }}>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_60%)]" />
                <div className="absolute right-3 top-3 flex gap-1.5">
                  {style.swatch.map((c, i) => <span key={i} className="h-3 w-3 rounded-full ring-1 ring-white/30" style={{ background: c }} />)}
                </div>
                {active && <Sparkles className="absolute left-3 top-3 h-4 w-4 text-accent-foreground drop-shadow" />}
              </div>
              <div className="space-y-1.5 p-4">
                <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-accent">{style.category}</div>
                <div className="font-display text-lg leading-tight text-foreground">{style.name}</div>
                <p className="line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">{style.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
