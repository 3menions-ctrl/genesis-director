import concept1 from '@/assets/editor-concepts/concept-1-holographic.jpg';
import concept2 from '@/assets/editor-concepts/concept-2-brutalist.jpg';
import concept3 from '@/assets/editor-concepts/concept-3-command-center.jpg';
import concept4 from '@/assets/editor-concepts/concept-4-art-deco.jpg';
import concept5 from '@/assets/editor-concepts/concept-5-organic.jpg';
import concept6 from '@/assets/editor-concepts/concept-6-spatial.jpg';
import concept7 from '@/assets/editor-concepts/concept-7-retro-future.jpg';
import concept8 from '@/assets/editor-concepts/concept-8-chromatic.jpg';
import concept9 from '@/assets/editor-concepts/concept-9-neomorphic.jpg';
import concept10 from '@/assets/editor-concepts/concept-10-cinematic.jpg';

const concepts = [
  { img: concept1, title: '1. Holographic Nexus', desc: 'Floating 3D clip previews, neon purple/cyan glass-morphic panels, timeline as orchestra of light.' },
  { img: concept2, title: '2. Brutalist Mono', desc: 'Raw monospace typography, concrete textures, single red playhead accent. Zero decoration.' },
  { img: concept3, title: '3. Command Center', desc: 'NASA mission control meets editing. Hexagonal modules, floating screens, real-time data viz.' },
  { img: concept4, title: '4. Art Deco Luxe', desc: 'Matte black + gold foil geometric borders. Serif typography. Cartier meets Final Cut.' },
  { img: concept5, title: '5. Organic Fluid', desc: 'Bioluminescent UI, aurora gradients, curved organic shapes, living waveform timeline.' },
  { img: concept6, title: '6. Spatial Glass', desc: 'Vision Pro-inspired depth layers, transparent panels at different Z-depths, volumetric fog.' },
  { img: concept7, title: '7. Retro Terminal', desc: 'Phosphor green CRT, analog oscilloscope waveforms, VU meters, scan lines, glitch art.' },
  { img: concept8, title: '8. Chromatic Prism', desc: 'Prismatic rainbow refractions on edges, spectral color shifts with playhead, crystalline borders.' },
  { img: concept9, title: '9. Neomorphic Shadow', desc: 'Ultra-minimal soft-embossed panels, whisper-quiet aesthetic, muted lavender, zen-like calm.' },
  { img: concept10, title: '10. Cinematic Suite', desc: 'DaVinci Resolve meets sci-fi. Film grain, dramatic spotlight, clapperboard metadata, lens flares.' },
];

export default function EditorConcepts() {
  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-4xl font-bold mb-2">Editor Design Concepts</h1>
      <p className="text-white/50 mb-10">10 next-century directions for the Genesis Editor</p>
      <div className="space-y-16 max-w-6xl mx-auto">
        {concepts.map((c, i) => (
          <div key={i} className="space-y-3">
            <h2 className="text-2xl font-semibold">{c.title}</h2>
            <p className="text-white/60 text-sm max-w-2xl">{c.desc}</p>
            <img src={c.img} alt={c.title} className="w-full rounded-xl border border-white/10 shadow-2xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
