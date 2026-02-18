/**
 * DesignPicker — live interactive gallery of pipeline progress UI concepts
 * Visit /design-picker to browse and pick a design.
 */

import { useState, useEffect, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Play, ExternalLink, Clock, Loader2, ChevronRight } from 'lucide-react';

// ─── shared mock data ───────────────────────────────────────────────────────
const MOCK_STAGES = [
  { name: 'Script', shortName: 'Script',   status: 'complete' as const },
  { name: 'Identity', shortName: 'Identity', status: 'complete' as const },
  { name: 'Assets',   shortName: 'Assets',   status: 'active'  as const },
  { name: 'Render',   shortName: 'Render',   status: 'pending' as const },
  { name: 'Stitch',   shortName: 'Stitch',   status: 'pending' as const },
];

const MOCK_CLIPS = [
  { index: 0, status: 'completed' as const, videoUrl: '#' },
  { index: 1, status: 'completed' as const, videoUrl: '#' },
  { index: 2, status: 'generating' as const },
  { index: 3, status: 'pending' as const },
];

const MOCK_PROGRESS = 58;
const MOCK_STATUS   = 'Generating cinematic assets — scene 3 of 8';

// ─── canvas waveform hook ───────────────────────────────────────────────────
function useWaveform(
  ref: React.RefObject<HTMLCanvasElement>,
  active: boolean,
  progress: number,
  palette: { lit: string; dim: string; glow: string }
) {
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr  = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width  = rect.width  * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;

    const BARS = 44, BW = 3, GAP = 2.4;
    const totalW = BARS * (BW + GAP);
    let t = 0, raf = 0;

    const draw = () => {
      t += 0.016;
      ctx.clearRect(0, 0, W, H);
      const sx = (W - totalW) / 2;
      const cy = H * 0.55;
      const filled = progress / 100;

      for (let i = 0; i < BARS; i++) {
        const norm = i / BARS;
        const lit  = norm <= filled;
        const bh   = Math.max(2,
          Math.abs(3 + Math.sin(i * 0.3) * 3 +
            Math.sin(t * 1.9 + i * 0.18) * 10 +
            Math.sin(t * 1.1 + i * 0.3 + 1.2) * 5));
        const x = sx + i * (BW + GAP);

        if (lit) {
          ctx.save();
          ctx.filter = 'blur(3px)';
          ctx.globalAlpha = 0.2;
          ctx.fillStyle = palette.glow;
          ctx.beginPath();
          ctx.roundRect(x - 1, cy - bh - 1, BW + 2, bh * 2 + 2, 2);
          ctx.fill();
          ctx.restore();
          ctx.fillStyle = palette.lit;
        } else {
          ctx.fillStyle = palette.dim;
        }
        ctx.beginPath();
        ctx.roundRect(x, cy - bh, BW, bh, 1.5);
        ctx.fill();
        if (lit) {
          ctx.globalAlpha = 0.15;
          ctx.beginPath();
          ctx.roundRect(x, cy + 2, BW, bh * 0.3, 1);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      if (active) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [active, progress, palette, ref]);
}

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN 1 — Apex Dark (monochrome violet, brand-true)
// ─────────────────────────────────────────────────────────────────────────────
const Design1 = memo(function Design1() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useWaveform(canvasRef, true, MOCK_PROGRESS, {
    lit:  'hsl(263,70%,65%)',
    dim:  'hsla(263,20%,25%,0.12)',
    glow: 'hsl(263,70%,58%)',
  });
  return (
    <div style={{ background:'hsl(250,15%,4%)', border:'1px solid hsl(250,10%,12%)', borderRadius:20, padding:'28px 24px', display:'flex', flexDirection:'column', gap:20 }}>
      <div style={{ position:'absolute', top:0, left:'10%', right:'10%', height:1, background:'linear-gradient(90deg,transparent,hsl(263,70%,58%,0.35),transparent)' }} />
      {/* pct */}
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:96, fontWeight:900, letterSpacing:'-0.05em', lineHeight:1, background:'linear-gradient(160deg,hsl(263,70%,82%),hsl(263,70%,58%))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', filter:'drop-shadow(0 0 40px hsl(263,70%,58%,0.3))' }}>
          {MOCK_PROGRESS}<span style={{fontSize:'0.35em',opacity:.5}}>%</span>
        </div>
        <p style={{ fontSize:13, color:'hsl(263,30%,60%)', marginTop:6 }}>{MOCK_STATUS}</p>
      </div>
      {/* waveform */}
      <div style={{ height:80, borderRadius:14, overflow:'hidden', background:'hsl(250,18%,6%)', border:'1px solid hsl(263,20%,12%)' }}>
        <canvas ref={canvasRef} style={{ width:'100%', height:'100%', display:'block' }} />
      </div>
      {/* stages */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'center' }}>
        {MOCK_STAGES.map(s => (
          <span key={s.shortName} style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20,
            background: s.status==='active' ? 'hsl(263,70%,58%,0.12)' : s.status==='complete' ? 'hsl(160,80%,45%,0.08)' : 'hsl(250,10%,8%)',
            border: `1px solid ${s.status==='active'?'hsl(263,70%,58%,0.3)':s.status==='complete'?'hsl(160,80%,45%,0.2)':'hsl(250,10%,14%)'}`,
            color: s.status==='active' ? 'hsl(263,70%,75%)' : s.status==='complete' ? 'hsl(160,80%,55%)' : 'hsl(240,5%,35%)' }}>
            {s.shortName}
          </span>
        ))}
      </div>
      {/* bar */}
      <div style={{ height:3, borderRadius:99, background:'hsl(250,10%,10%)', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${MOCK_PROGRESS}%`, borderRadius:99, background:'hsl(263,70%,58%)', boxShadow:'0 0 10px hsl(263,70%,58%,0.6)', transition:'width 0.8s ease' }} />
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN 2 — Ghost White (near-white on black, editorial)
// ─────────────────────────────────────────────────────────────────────────────
const Design2 = memo(function Design2() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useWaveform(canvasRef, true, MOCK_PROGRESS, {
    lit:  'rgba(255,255,255,0.9)',
    dim:  'rgba(255,255,255,0.06)',
    glow: 'rgba(255,255,255,0.6)',
  });
  return (
    <div style={{ background:'#050505', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, padding:'28px 24px', display:'flex', flexDirection:'column', gap:20 }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:96, fontWeight:900, letterSpacing:'-0.06em', lineHeight:1, color:'rgba(255,255,255,0.95)', textShadow:'0 0 60px rgba(255,255,255,0.1)' }}>
          {MOCK_PROGRESS}<span style={{fontSize:'0.32em',opacity:.3,fontWeight:300}}>%</span>
        </div>
        <p style={{ fontSize:12, color:'rgba(255,255,255,0.3)', marginTop:8, letterSpacing:'0.08em', textTransform:'uppercase' }}>{MOCK_STATUS}</p>
      </div>
      <div style={{ height:80, borderRadius:12, overflow:'hidden', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)' }}>
        <canvas ref={canvasRef} style={{ width:'100%', height:'100%', display:'block' }} />
      </div>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'center' }}>
        {MOCK_STAGES.map(s => (
          <span key={s.shortName} style={{ fontSize:10, fontWeight:500, padding:'3px 10px', borderRadius:4, letterSpacing:'0.05em',
            background: 'transparent',
            border: `1px solid ${s.status==='active'?'rgba(255,255,255,0.5)':s.status==='complete'?'rgba(255,255,255,0.2)':'rgba(255,255,255,0.06)'}`,
            color: s.status==='active' ? 'rgba(255,255,255,0.9)' : s.status==='complete' ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.18)' }}>
            {s.shortName}
          </span>
        ))}
      </div>
      <div style={{ height:1, borderRadius:99, background:'rgba(255,255,255,0.06)', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${MOCK_PROGRESS}%`, background:'rgba(255,255,255,0.85)', transition:'width 0.8s ease' }} />
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN 3 — Amber Ember (warm orange on black, cinematic heat)
// ─────────────────────────────────────────────────────────────────────────────
const Design3 = memo(function Design3() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useWaveform(canvasRef, true, MOCK_PROGRESS, {
    lit:  'hsl(30,95%,62%)',
    dim:  'hsla(30,30%,20%,0.12)',
    glow: 'hsl(30,95%,55%)',
  });
  return (
    <div style={{ background:'hsl(25,15%,4%)', border:'1px solid hsl(25,15%,10%)', borderRadius:20, padding:'28px 24px', display:'flex', flexDirection:'column', gap:20 }}>
      <div style={{ position:'absolute', top:0, left:'10%', right:'10%', height:1, background:'linear-gradient(90deg,transparent,hsl(30,95%,55%,0.4),transparent)' }} />
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:96, fontWeight:900, letterSpacing:'-0.05em', lineHeight:1, background:'linear-gradient(160deg,hsl(42,100%,75%),hsl(25,95%,55%))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', filter:'drop-shadow(0 0 40px hsl(30,95%,55%,0.3))' }}>
          {MOCK_PROGRESS}<span style={{fontSize:'0.35em',opacity:.5}}>%</span>
        </div>
        <p style={{ fontSize:13, color:'hsl(30,50%,55%)', marginTop:6 }}>{MOCK_STATUS}</p>
      </div>
      <div style={{ height:80, borderRadius:14, overflow:'hidden', background:'hsl(25,18%,6%)', border:'1px solid hsl(30,20%,12%)' }}>
        <canvas ref={canvasRef} style={{ width:'100%', height:'100%', display:'block' }} />
      </div>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'center' }}>
        {MOCK_STAGES.map(s => (
          <span key={s.shortName} style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20,
            background: s.status==='active'?'hsl(30,95%,55%,0.12)':s.status==='complete'?'hsl(42,100%,55%,0.08)':'hsl(25,10%,8%)',
            border: `1px solid ${s.status==='active'?'hsl(30,95%,55%,0.3)':s.status==='complete'?'hsl(42,100%,55%,0.2)':'hsl(25,10%,14%)'}`,
            color: s.status==='active'?'hsl(30,95%,70%)':s.status==='complete'?'hsl(42,100%,62%)':'hsl(25,5%,35%)' }}>
            {s.shortName}
          </span>
        ))}
      </div>
      <div style={{ height:3, borderRadius:99, background:'hsl(25,10%,10%)', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${MOCK_PROGRESS}%`, borderRadius:99, background:'linear-gradient(90deg,hsl(42,100%,55%),hsl(25,95%,55%))', boxShadow:'0 0 12px hsl(30,95%,55%,0.6)' }} />
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN 4 — Emerald Terminal (green on deep black, hacker chic)
// ─────────────────────────────────────────────────────────────────────────────
const Design4 = memo(function Design4() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useWaveform(canvasRef, true, MOCK_PROGRESS, {
    lit:  'hsl(160,80%,45%)',
    dim:  'hsla(160,30%,15%,0.1)',
    glow: 'hsl(160,80%,40%)',
  });
  return (
    <div style={{ background:'#020a05', border:'1px solid hsl(160,40%,8%)', borderRadius:20, padding:'28px 24px', display:'flex', flexDirection:'column', gap:20 }}>
      <div style={{ position:'absolute', top:0, left:'10%', right:'10%', height:1, background:'linear-gradient(90deg,transparent,hsl(160,80%,40%,0.4),transparent)' }} />
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:96, fontWeight:900, letterSpacing:'-0.05em', lineHeight:1, background:'linear-gradient(160deg,hsl(160,80%,70%),hsl(160,80%,42%))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', filter:'drop-shadow(0 0 40px hsl(160,80%,40%,0.35))' }}>
          {MOCK_PROGRESS}<span style={{fontSize:'0.35em',opacity:.5}}>%</span>
        </div>
        <p style={{ fontSize:12, color:'hsl(160,50%,40%)', marginTop:6, fontFamily:'monospace', letterSpacing:'0.04em' }}>&gt; {MOCK_STATUS}</p>
      </div>
      <div style={{ height:80, borderRadius:10, overflow:'hidden', background:'#010803', border:'1px solid hsl(160,30%,8%)' }}>
        <canvas ref={canvasRef} style={{ width:'100%', height:'100%', display:'block' }} />
      </div>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'center' }}>
        {MOCK_STAGES.map(s => (
          <span key={s.shortName} style={{ fontSize:10, fontWeight:600, padding:'3px 10px', borderRadius:4, fontFamily:'monospace',
            background:'transparent',
            border:`1px solid ${s.status==='active'?'hsl(160,80%,40%,0.5)':s.status==='complete'?'hsl(160,80%,40%,0.2)':'hsl(160,20%,10%)'}`,
            color:s.status==='active'?'hsl(160,80%,55%)':s.status==='complete'?'hsl(160,80%,38%)':'hsl(160,15%,25%)' }}>
            {s.status==='complete'?'✓ ':s.status==='active'?'▶ ':''}{s.shortName}
          </span>
        ))}
      </div>
      <div style={{ height:2, borderRadius:99, background:'hsl(160,20%,7%)', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${MOCK_PROGRESS}%`, background:'hsl(160,80%,42%)', boxShadow:'0 0 8px hsl(160,80%,40%,0.7)', transition:'width 0.8s ease' }} />
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN 5 — Glacier (ice blue/cyan, cold premium)
// ─────────────────────────────────────────────────────────────────────────────
const Design5 = memo(function Design5() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useWaveform(canvasRef, true, MOCK_PROGRESS, {
    lit:  'hsl(195,90%,58%)',
    dim:  'hsla(195,40%,15%,0.1)',
    glow: 'hsl(195,90%,50%)',
  });
  return (
    <div style={{ background:'hsl(210,25%,4%)', border:'1px solid hsl(195,30%,12%)', borderRadius:20, padding:'28px 24px', display:'flex', flexDirection:'column', gap:20 }}>
      <div style={{ position:'absolute', top:0, left:'10%', right:'10%', height:1, background:'linear-gradient(90deg,transparent,hsl(195,90%,50%,0.4),transparent)' }} />
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:96, fontWeight:900, letterSpacing:'-0.05em', lineHeight:1, background:'linear-gradient(160deg,hsl(195,90%,80%),hsl(195,90%,50%))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', filter:'drop-shadow(0 0 40px hsl(195,90%,50%,0.3))' }}>
          {MOCK_PROGRESS}<span style={{fontSize:'0.35em',opacity:.5}}>%</span>
        </div>
        <p style={{ fontSize:13, color:'hsl(195,50%,50%)', marginTop:6 }}>{MOCK_STATUS}</p>
      </div>
      <div style={{ height:80, borderRadius:14, overflow:'hidden', background:'hsl(210,25%,5%)', border:'1px solid hsl(195,30%,10%)' }}>
        <canvas ref={canvasRef} style={{ width:'100%', height:'100%', display:'block' }} />
      </div>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'center' }}>
        {MOCK_STAGES.map(s => (
          <span key={s.shortName} style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20,
            background:s.status==='active'?'hsl(195,90%,50%,0.1)':s.status==='complete'?'hsl(195,90%,50%,0.06)':'transparent',
            border:`1px solid ${s.status==='active'?'hsl(195,90%,50%,0.35)':s.status==='complete'?'hsl(195,90%,50%,0.18)':'hsl(210,15%,14%)'}`,
            color:s.status==='active'?'hsl(195,90%,68%)':s.status==='complete'?'hsl(195,90%,48%)':'hsl(210,5%,32%)' }}>
            {s.shortName}
          </span>
        ))}
      </div>
      <div style={{ height:3, borderRadius:99, background:'hsl(210,20%,8%)', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${MOCK_PROGRESS}%`, borderRadius:99, background:'linear-gradient(90deg,hsl(195,90%,40%),hsl(195,90%,62%))', boxShadow:'0 0 12px hsl(195,90%,50%,0.5)' }} />
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN 6 — Rose (pink/magenta, bold creative)
// ─────────────────────────────────────────────────────────────────────────────
const Design6 = memo(function Design6() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useWaveform(canvasRef, true, MOCK_PROGRESS, {
    lit:  'hsl(330,85%,62%)',
    dim:  'hsla(330,30%,15%,0.1)',
    glow: 'hsl(330,85%,55%)',
  });
  return (
    <div style={{ background:'hsl(330,15%,4%)', border:'1px solid hsl(330,20%,10%)', borderRadius:20, padding:'28px 24px', display:'flex', flexDirection:'column', gap:20 }}>
      <div style={{ position:'absolute', top:0, left:'10%', right:'10%', height:1, background:'linear-gradient(90deg,transparent,hsl(330,85%,55%,0.4),transparent)' }} />
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:96, fontWeight:900, letterSpacing:'-0.05em', lineHeight:1, background:'linear-gradient(160deg,hsl(330,85%,80%),hsl(330,85%,55%))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', filter:'drop-shadow(0 0 40px hsl(330,85%,55%,0.3))' }}>
          {MOCK_PROGRESS}<span style={{fontSize:'0.35em',opacity:.5}}>%</span>
        </div>
        <p style={{ fontSize:13, color:'hsl(330,40%,55%)', marginTop:6 }}>{MOCK_STATUS}</p>
      </div>
      <div style={{ height:80, borderRadius:14, overflow:'hidden', background:'hsl(330,15%,5%)', border:'1px solid hsl(330,20%,9%)' }}>
        <canvas ref={canvasRef} style={{ width:'100%', height:'100%', display:'block' }} />
      </div>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'center' }}>
        {MOCK_STAGES.map(s => (
          <span key={s.shortName} style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20,
            background:s.status==='active'?'hsl(330,85%,55%,0.1)':s.status==='complete'?'hsl(330,85%,55%,0.06)':'transparent',
            border:`1px solid ${s.status==='active'?'hsl(330,85%,55%,0.3)':s.status==='complete'?'hsl(330,85%,55%,0.15)':'hsl(330,10%,14%)'}`,
            color:s.status==='active'?'hsl(330,85%,72%)':s.status==='complete'?'hsl(330,85%,50%)':'hsl(330,5%,30%)' }}>
            {s.shortName}
          </span>
        ))}
      </div>
      <div style={{ height:3, borderRadius:99, background:'hsl(330,15%,8%)', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${MOCK_PROGRESS}%`, borderRadius:99, background:'hsl(330,85%,58%)', boxShadow:'0 0 12px hsl(330,85%,55%,0.55)' }} />
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN 7 — Titanium (pure greyscale, hyper-minimal luxury)
// ─────────────────────────────────────────────────────────────────────────────
const Design7 = memo(function Design7() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useWaveform(canvasRef, true, MOCK_PROGRESS, {
    lit:  'rgba(220,220,220,0.85)',
    dim:  'rgba(255,255,255,0.04)',
    glow: 'rgba(200,200,200,0.5)',
  });
  return (
    <div style={{ background:'#080808', border:'1px solid rgba(255,255,255,0.06)', borderRadius:20, padding:'28px 24px', display:'flex', flexDirection:'column', gap:20 }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:96, fontWeight:900, letterSpacing:'-0.06em', lineHeight:1, color:'rgba(255,255,255,0.88)' }}>
          {MOCK_PROGRESS}<span style={{fontSize:'0.32em',opacity:.28,fontWeight:200}}>%</span>
        </div>
        <p style={{ fontSize:11, color:'rgba(255,255,255,0.22)', marginTop:10, letterSpacing:'0.15em', textTransform:'uppercase' }}>{MOCK_STATUS}</p>
      </div>
      <div style={{ height:72, borderRadius:10, overflow:'hidden', background:'rgba(255,255,255,0.015)', border:'1px solid rgba(255,255,255,0.04)' }}>
        <canvas ref={canvasRef} style={{ width:'100%', height:'100%', display:'block' }} />
      </div>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center' }}>
        {MOCK_STAGES.map(s => (
          <span key={s.shortName} style={{ fontSize:10, fontWeight:500, padding:'2px 8px', borderRadius:3, letterSpacing:'0.08em', textTransform:'uppercase',
            border:`1px solid ${s.status==='active'?'rgba(255,255,255,0.35)':s.status==='complete'?'rgba(255,255,255,0.12)':'rgba(255,255,255,0.04)'}`,
            color:s.status==='active'?'rgba(255,255,255,0.85)':s.status==='complete'?'rgba(255,255,255,0.3)':'rgba(255,255,255,0.1)' }}>
            {s.shortName}
          </span>
        ))}
      </div>
      <div style={{ height:1, background:'rgba(255,255,255,0.06)', overflow:'hidden', borderRadius:99 }}>
        <div style={{ height:'100%', width:`${MOCK_PROGRESS}%`, background:'rgba(255,255,255,0.7)' }} />
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN 8 — Indigo Dusk (deep indigo + soft lavender, cinematic depth)
// ─────────────────────────────────────────────────────────────────────────────
const Design8 = memo(function Design8() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useWaveform(canvasRef, true, MOCK_PROGRESS, {
    lit:  'hsl(240,70%,70%)',
    dim:  'hsla(240,30%,20%,0.12)',
    glow: 'hsl(240,70%,60%)',
  });
  return (
    <div style={{ background:'hsl(240,25%,4%)', border:'1px solid hsl(240,20%,10%)', borderRadius:20, padding:'28px 24px', display:'flex', flexDirection:'column', gap:20 }}>
      <div style={{ position:'absolute', top:0, left:'10%', right:'10%', height:1, background:'linear-gradient(90deg,transparent,hsl(240,70%,60%,0.4),transparent)' }} />
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:96, fontWeight:900, letterSpacing:'-0.05em', lineHeight:1, background:'linear-gradient(160deg,hsl(240,70%,85%),hsl(240,70%,55%))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', filter:'drop-shadow(0 0 40px hsl(240,70%,55%,0.3))' }}>
          {MOCK_PROGRESS}<span style={{fontSize:'0.35em',opacity:.5}}>%</span>
        </div>
        <p style={{ fontSize:13, color:'hsl(240,30%,55%)', marginTop:6 }}>{MOCK_STATUS}</p>
      </div>
      <div style={{ height:80, borderRadius:14, overflow:'hidden', background:'hsl(240,25%,5%)', border:'1px solid hsl(240,20%,9%)' }}>
        <canvas ref={canvasRef} style={{ width:'100%', height:'100%', display:'block' }} />
      </div>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'center' }}>
        {MOCK_STAGES.map(s => (
          <span key={s.shortName} style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20,
            background:s.status==='active'?'hsl(240,70%,58%,0.1)':s.status==='complete'?'hsl(240,70%,58%,0.06)':'transparent',
            border:`1px solid ${s.status==='active'?'hsl(240,70%,58%,0.3)':s.status==='complete'?'hsl(240,70%,58%,0.15)':'hsl(240,10%,14%)'}`,
            color:s.status==='active'?'hsl(240,70%,75%)':s.status==='complete'?'hsl(240,70%,50%)':'hsl(240,5%,30%)' }}>
            {s.shortName}
          </span>
        ))}
      </div>
      <div style={{ height:3, borderRadius:99, background:'hsl(240,20%,8%)', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${MOCK_PROGRESS}%`, borderRadius:99, background:'linear-gradient(90deg,hsl(240,70%,45%),hsl(240,70%,68%))', boxShadow:'0 0 12px hsl(240,70%,55%,0.5)' }} />
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PICKER PAGE
// ─────────────────────────────────────────────────────────────────────────────

const DESIGNS = [
  { id: 1, name: 'Apex Violet',   sub: 'Brand-true monochrome violet',    component: Design1 },
  { id: 2, name: 'Ghost White',   sub: 'Editorial white on black',         component: Design2 },
  { id: 3, name: 'Amber Ember',   sub: 'Warm cinematic orange',            component: Design3 },
  { id: 4, name: 'Emerald',       sub: 'Hacker-chic terminal green',       component: Design4 },
  { id: 5, name: 'Glacier',       sub: 'Ice-cold premium cyan',            component: Design5 },
  { id: 6, name: 'Rose',          sub: 'Bold magenta creative',            component: Design6 },
  { id: 7, name: 'Titanium',      sub: 'Hyper-minimal greyscale luxury',   component: Design7 },
  { id: 8, name: 'Indigo Dusk',   sub: 'Deep indigo cinematic depth',      component: Design8 },
];

export default function DesignPicker() {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div style={{ minHeight:'100vh', background:'#030303', padding:'40px 24px', fontFamily:'system-ui,sans-serif' }}>
      {/* header */}
      <div style={{ maxWidth:900, margin:'0 auto 40px', textAlign:'center' }}>
        <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.2em', color:'rgba(255,255,255,0.25)', textTransform:'uppercase', marginBottom:12 }}>
          Production Loading State
        </div>
        <h1 style={{ fontSize:32, fontWeight:800, color:'rgba(255,255,255,0.9)', margin:'0 0 10px', letterSpacing:'-0.03em' }}>
          Pick a design
        </h1>
        <p style={{ fontSize:14, color:'rgba(255,255,255,0.28)', margin:0 }}>
          All 8 are live and animated. Click one to select it.
        </p>
        {selected && (
          <div style={{ marginTop:16, display:'inline-flex', alignItems:'center', gap:8, padding:'8px 20px', borderRadius:99, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)' }}>
            <CheckCircle2 style={{ width:14, height:14, color:'hsl(160,80%,50%)' }} />
            <span style={{ fontSize:13, color:'rgba(255,255,255,0.7)' }}>
              Selected: <strong style={{ color:'rgba(255,255,255,0.95)' }}>Design {selected} — {DESIGNS.find(d=>d.id===selected)?.name}</strong>
            </span>
          </div>
        )}
      </div>

      {/* grid */}
      <div style={{ maxWidth:1100, margin:'0 auto', display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))', gap:24 }}>
        {DESIGNS.map(({ id, name, sub, component: Component }) => (
          <motion.div
            key={id}
            onClick={() => setSelected(id)}
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.99 }}
            style={{
              cursor:'pointer',
              borderRadius:24,
              overflow:'hidden',
              position:'relative',
              outline: selected===id ? '2px solid rgba(255,255,255,0.5)' : '2px solid transparent',
              outlineOffset: 3,
              transition:'outline 0.2s',
            }}
          >
            {/* number badge */}
            <div style={{ position:'absolute', top:12, left:12, zIndex:10, fontSize:10, fontWeight:700, letterSpacing:'0.1em', padding:'3px 8px', borderRadius:6, background:'rgba(0,0,0,0.6)', color:'rgba(255,255,255,0.4)', backdropFilter:'blur(8px)' }}>
              {String(id).padStart(2,'0')}
            </div>

            {/* selected badge */}
            {selected===id && (
              <div style={{ position:'absolute', top:12, right:12, zIndex:10 }}>
                <CheckCircle2 style={{ width:20, height:20, color:'hsl(160,80%,50%)' }} />
              </div>
            )}

            {/* the actual design */}
            <div style={{ position:'relative', pointerEvents:'none' }}>
              <Component />
            </div>

            {/* name bar */}
            <div style={{ background:'rgba(0,0,0,0.85)', padding:'12px 16px', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.85)' }}>{name}</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.3)', marginTop:2 }}>{sub}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {selected && (
        <div style={{ maxWidth:900, margin:'32px auto 0', textAlign:'center' }}>
          <p style={{ fontSize:14, color:'rgba(255,255,255,0.35)' }}>
            Tell me "<strong style={{color:'rgba(255,255,255,0.6)'}}>Design {selected}</strong>" and I'll apply it immediately.
          </p>
        </div>
      )}
    </div>
  );
}
