/**
 * DesignPicker — 20 live animated pipeline progress UI concepts
 * Visit /design-picker to browse all designs.
 */

import { useState, useEffect, useRef, memo } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';

// ─── mock data ────────────────────────────────────────────────────────────────
const STAGES = ['Script','Identity','Assets','Render','Stitch'];
const STAGE_STATUSES = ['complete','complete','active','pending','pending'] as const;
const PCT = 58;
const STATUS_MSG = 'Generating cinematic assets — scene 3 of 8';
const STATUS_SHORT = 'Scene 3 of 8';

// ─── waveform hooks ───────────────────────────────────────────────────────────
type Palette = { lit: string; dim: string; glow: string };

function useLinearWave(ref: React.RefObject<HTMLCanvasElement>, palette: Palette, bars = 44, barW = 3, gap = 2.6) {
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const r = c.getBoundingClientRect();
    c.width = r.width * dpr; c.height = r.height * dpr;
    ctx.scale(dpr, dpr);
    const W = r.width, H = r.height;
    const totalW = bars * (barW + gap);
    let t = 0, raf = 0;
    const draw = () => {
      t += 0.016; ctx.clearRect(0,0,W,H);
      const sx = (W - totalW) / 2, cy = H * 0.52, filled = PCT / 100;
      for (let i = 0; i < bars; i++) {
        const norm = i / bars, lit = norm <= filled;
        const bh = Math.max(2, Math.abs(3 + Math.sin(i*0.3)*4 + Math.sin(t*1.9+i*0.18)*11 + Math.sin(t*1.1+i*0.3+1.2)*5));
        const x = sx + i*(barW+gap);
        if (lit) {
          ctx.save(); ctx.filter='blur(3px)'; ctx.globalAlpha=0.18; ctx.fillStyle=palette.glow;
          ctx.beginPath(); ctx.roundRect(x-1, cy-bh-1, barW+2, bh*2+2, 2); ctx.fill(); ctx.restore();
          ctx.fillStyle = palette.lit;
        } else { ctx.fillStyle = palette.dim; }
        ctx.beginPath(); ctx.roundRect(x, cy-bh, barW, bh, 1.5); ctx.fill();
        if (lit) { ctx.globalAlpha=0.12; ctx.beginPath(); ctx.roundRect(x,cy+2,barW,bh*0.28,1); ctx.fill(); ctx.globalAlpha=1; }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [ref, palette, bars, barW, gap]);
}

function useCircularWave(ref: React.RefObject<HTMLCanvasElement>, color: string) {
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const r = c.getBoundingClientRect();
    c.width = r.width * dpr; c.height = r.height * dpr;
    ctx.scale(dpr, dpr);
    const W = r.width, H = r.height, cx = W/2, cy = H/2;
    const R = Math.min(W,H)*0.36, BARS = 48;
    let t = 0, raf = 0;
    const draw = () => {
      t += 0.016; ctx.clearRect(0,0,W,H);
      // progress arc
      ctx.beginPath(); ctx.arc(cx,cy,R,(-Math.PI/2),((-Math.PI/2)+(2*Math.PI*PCT/100)));
      ctx.strokeStyle=color; ctx.lineWidth=2.5; ctx.globalAlpha=0.25; ctx.stroke(); ctx.globalAlpha=1;
      // bars
      for (let i = 0; i < BARS; i++) {
        const angle = (i/BARS)*Math.PI*2 - Math.PI/2;
        const norm = (i/BARS); const lit = norm <= PCT/100;
        const bh = Math.max(2, 3 + Math.sin(i*0.4)*3 + Math.sin(t*2+i*0.2)*8);
        const x1 = cx + Math.cos(angle)*R, y1 = cy + Math.sin(angle)*R;
        const x2 = cx + Math.cos(angle)*(R+bh), y2 = cy + Math.sin(angle)*(R+bh);
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2);
        ctx.strokeStyle = lit ? color : 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 2.2; ctx.globalAlpha = lit ? 1 : 0.5; ctx.stroke();
      }
      ctx.globalAlpha=1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [ref, color]);
}

function useSineWave(ref: React.RefObject<HTMLCanvasElement>, color: string) {
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const r = c.getBoundingClientRect();
    c.width = r.width * dpr; c.height = r.height * dpr;
    ctx.scale(dpr, dpr);
    const W = r.width, H = r.height;
    let t = 0, raf = 0;
    const draw = () => {
      t += 0.016; ctx.clearRect(0,0,W,H);
      const cy = H/2;
      // glow
      ctx.save(); ctx.filter='blur(6px)';
      ctx.beginPath(); ctx.moveTo(0,cy);
      for (let x = 0; x < W; x++) {
        const y = cy + Math.sin(x*0.045+t*2)*14 + Math.sin(x*0.02+t*1.3)*8;
        ctx.lineTo(x,y);
      }
      ctx.strokeStyle=color; ctx.lineWidth=3; ctx.globalAlpha=0.3; ctx.stroke(); ctx.restore();
      // main line
      ctx.beginPath(); ctx.moveTo(0,cy);
      for (let x = 0; x < W; x++) {
        const norm = x/W, lit = norm <= PCT/100;
        const y = cy + Math.sin(x*0.045+t*2)*14 + Math.sin(x*0.02+t*1.3)*8;
        ctx.lineTo(x,y);
      }
      ctx.strokeStyle=color; ctx.lineWidth=2; ctx.globalAlpha=0.9; ctx.stroke();
      // filled section only
      ctx.beginPath(); ctx.moveTo(0,cy);
      for (let x = 0; x < W*(PCT/100); x++) {
        const y = cy + Math.sin(x*0.045+t*2)*14 + Math.sin(x*0.02+t*1.3)*8;
        ctx.lineTo(x,y);
      }
      ctx.strokeStyle=color; ctx.lineWidth=2.5; ctx.globalAlpha=1; ctx.stroke(); ctx.globalAlpha=1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [ref, color]);
}

// ─── reusable parts ───────────────────────────────────────────────────────────
const StagePills = ({ color, bg, borderActive, colorComplete, borderComplete, colorDim, borderDim }: {
  color: string; bg: string; borderActive: string;
  colorComplete: string; borderComplete: string; colorDim: string; borderDim: string;
}) => (
  <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'center' }}>
    {STAGES.map((s,i) => {
      const st = STAGE_STATUSES[i];
      return (
        <span key={s} style={{ fontSize:10, fontWeight:600, padding:'3px 10px', borderRadius:20, letterSpacing:'0.04em',
          background: st==='active' ? bg : 'transparent',
          border: `1px solid ${st==='active'?borderActive:st==='complete'?borderComplete:borderDim}`,
          color: st==='active' ? color : st==='complete' ? colorComplete : colorDim }}>
          {s}
        </span>
      );
    })}
  </div>
);

// ─── DESIGN 1 — Apex Void (brand violet, razor-thin, surgical) ────────────────
const D1 = memo(() => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLinearWave(ref, { lit:'hsl(263,70%,65%)', dim:'hsla(263,15%,25%,0.08)', glow:'hsl(263,70%,58%)' });
  return (
    <div style={{ background:'hsl(252,20%,4%)', border:'1px solid hsl(252,12%,10%)', borderRadius:20, padding:'28px 20px', display:'flex', flexDirection:'column', gap:18, position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:0, left:'15%', right:'15%', height:1, background:'linear-gradient(90deg,transparent,hsl(263,70%,58%,0.4),transparent)' }} />
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:100, fontWeight:900, lineHeight:1, letterSpacing:'-0.05em', background:'linear-gradient(165deg,hsl(263,70%,85%) 0%,hsl(263,70%,58%) 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', filter:'drop-shadow(0 0 50px hsl(263,70%,50%,0.28))' }}>
          {PCT}<span style={{ fontSize:'0.3em', opacity:0.4, fontWeight:300 }}>%</span>
        </div>
        <p style={{ fontSize:12, color:'hsl(263,25%,55%)', marginTop:4, letterSpacing:'0.01em' }}>{STATUS_MSG}</p>
      </div>
      <div style={{ height:76, borderRadius:12, overflow:'hidden', background:'hsl(252,20%,5%)', border:'1px solid hsl(263,15%,11%)' }}>
        <canvas ref={ref} style={{ width:'100%', height:'100%', display:'block' }} />
      </div>
      <StagePills color="hsl(263,70%,75%)" bg="hsl(263,70%,55%,0.1)" borderActive="hsl(263,70%,55%,0.35)" colorComplete="hsl(263,60%,50%)" borderComplete="hsl(263,60%,50%,0.2)" colorDim="hsl(252,8%,28%)" borderDim="hsl(252,8%,13%)" />
      <div style={{ height:2, borderRadius:99, background:'hsl(252,12%,8%)', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${PCT}%`, background:'hsl(263,70%,58%)', boxShadow:'0 0 12px hsl(263,70%,58%,0.6)' }} />
      </div>
    </div>
  );
});

// ─── DESIGN 2 — Monolith (pure white on pure black, editorial) ────────────────
const D2 = memo(() => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLinearWave(ref, { lit:'rgba(255,255,255,0.92)', dim:'rgba(255,255,255,0.05)', glow:'rgba(255,255,255,0.6)' });
  return (
    <div style={{ background:'#050505', border:'1px solid rgba(255,255,255,0.07)', borderRadius:20, padding:'28px 20px', display:'flex', flexDirection:'column', gap:18 }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:100, fontWeight:900, lineHeight:1, letterSpacing:'-0.07em', color:'#fff' }}>
          {PCT}<span style={{ fontSize:'0.28em', fontWeight:200, opacity:0.2 }}>%</span>
        </div>
        <p style={{ fontSize:10, color:'rgba(255,255,255,0.25)', marginTop:10, letterSpacing:'0.18em', textTransform:'uppercase' }}>{STATUS_MSG}</p>
      </div>
      <div style={{ height:76, borderRadius:10, overflow:'hidden', background:'rgba(255,255,255,0.015)', border:'1px solid rgba(255,255,255,0.04)' }}>
        <canvas ref={ref} style={{ width:'100%', height:'100%', display:'block' }} />
      </div>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center' }}>
        {STAGES.map((s,i)=>{const st=STAGE_STATUSES[i];return(
          <span key={s} style={{ fontSize:9, fontWeight:400, padding:'2px 9px', borderRadius:3, letterSpacing:'0.12em', textTransform:'uppercase', border:`1px solid ${st==='active'?'rgba(255,255,255,0.5)':st==='complete'?'rgba(255,255,255,0.15)':'rgba(255,255,255,0.05)'}`, color:st==='active'?'#fff':st==='complete'?'rgba(255,255,255,0.35)':'rgba(255,255,255,0.1)' }}>{s}</span>
        )})}
      </div>
      <div style={{ height:1, background:'rgba(255,255,255,0.05)', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${PCT}%`, background:'rgba(255,255,255,0.85)' }} />
      </div>
    </div>
  );
});

// ─── DESIGN 3 — Ember (warm amber, cinematic heat, one-color discipline) ──────
const D3 = memo(() => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLinearWave(ref, { lit:'hsl(38,95%,62%)', dim:'hsla(38,20%,15%,0.1)', glow:'hsl(38,95%,55%)' });
  return (
    <div style={{ background:'hsl(30,18%,4%)', border:'1px solid hsl(30,12%,9%)', borderRadius:20, padding:'28px 20px', display:'flex', flexDirection:'column', gap:18, position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:0, left:'15%', right:'15%', height:1, background:'linear-gradient(90deg,transparent,hsl(38,95%,55%,0.4),transparent)' }} />
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:100, fontWeight:900, lineHeight:1, letterSpacing:'-0.05em', background:'linear-gradient(165deg,hsl(48,100%,75%),hsl(28,95%,55%))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', filter:'drop-shadow(0 0 50px hsl(38,95%,50%,0.3))' }}>
          {PCT}<span style={{ fontSize:'0.3em', opacity:0.4 }}>%</span>
        </div>
        <p style={{ fontSize:12, color:'hsl(38,40%,48%)', marginTop:4 }}>{STATUS_MSG}</p>
      </div>
      <div style={{ height:76, borderRadius:12, overflow:'hidden', background:'hsl(30,18%,5%)', border:'1px solid hsl(30,12%,10%)' }}>
        <canvas ref={ref} style={{ width:'100%', height:'100%', display:'block' }} />
      </div>
      <StagePills color="hsl(38,95%,68%)" bg="hsl(38,95%,55%,0.1)" borderActive="hsl(38,95%,55%,0.35)" colorComplete="hsl(38,80%,48%)" borderComplete="hsl(38,80%,48%,0.25)" colorDim="hsl(30,8%,28%)" borderDim="hsl(30,8%,12%)" />
      <div style={{ height:2, borderRadius:99, background:'hsl(30,10%,8%)', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${PCT}%`, background:'linear-gradient(90deg,hsl(48,100%,58%),hsl(28,95%,58%))', boxShadow:'0 0 14px hsl(38,95%,55%,0.55)' }} />
      </div>
    </div>
  );
});

// ─── DESIGN 4 — Velvet (deep plum/burgundy, fashion luxury) ──────────────────
const D4 = memo(() => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLinearWave(ref, { lit:'hsl(320,55%,62%)', dim:'hsla(320,20%,18%,0.1)', glow:'hsl(320,55%,50%)' });
  return (
    <div style={{ background:'hsl(320,22%,4%)', border:'1px solid hsl(320,15%,10%)', borderRadius:20, padding:'28px 20px', display:'flex', flexDirection:'column', gap:18, position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:0, left:'15%', right:'15%', height:1, background:'linear-gradient(90deg,transparent,hsl(320,55%,45%,0.4),transparent)' }} />
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:100, fontWeight:900, lineHeight:1, letterSpacing:'-0.05em', background:'linear-gradient(165deg,hsl(320,55%,78%),hsl(320,55%,48%))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', filter:'drop-shadow(0 0 40px hsl(320,55%,45%,0.3))' }}>
          {PCT}<span style={{ fontSize:'0.3em', opacity:0.4 }}>%</span>
        </div>
        <p style={{ fontSize:12, color:'hsl(320,25%,50%)', marginTop:4 }}>{STATUS_MSG}</p>
      </div>
      <div style={{ height:76, borderRadius:12, overflow:'hidden', background:'hsl(320,22%,5%)', border:'1px solid hsl(320,15%,10%)' }}>
        <canvas ref={ref} style={{ width:'100%', height:'100%', display:'block' }} />
      </div>
      <StagePills color="hsl(320,55%,72%)" bg="hsl(320,55%,45%,0.1)" borderActive="hsl(320,55%,45%,0.35)" colorComplete="hsl(320,45%,45%)" borderComplete="hsl(320,45%,45%,0.25)" colorDim="hsl(320,8%,25%)" borderDim="hsl(320,8%,12%)" />
      <div style={{ height:2, borderRadius:99, background:'hsl(320,12%,8%)', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${PCT}%`, background:'hsl(320,55%,52%)', boxShadow:'0 0 12px hsl(320,55%,48%,0.5)' }} />
      </div>
    </div>
  );
});

// ─── DESIGN 5 — Glacier (arctic cyan, cold precision) ────────────────────────
const D5 = memo(() => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLinearWave(ref, { lit:'hsl(192,90%,58%)', dim:'hsla(192,30%,15%,0.08)', glow:'hsl(192,90%,50%)' });
  return (
    <div style={{ background:'hsl(210,28%,4%)', border:'1px solid hsl(195,20%,10%)', borderRadius:20, padding:'28px 20px', display:'flex', flexDirection:'column', gap:18, position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:0, left:'15%', right:'15%', height:1, background:'linear-gradient(90deg,transparent,hsl(192,90%,48%,0.4),transparent)' }} />
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:100, fontWeight:900, lineHeight:1, letterSpacing:'-0.05em', background:'linear-gradient(165deg,hsl(192,90%,82%),hsl(192,90%,48%))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', filter:'drop-shadow(0 0 50px hsl(192,90%,45%,0.28))' }}>
          {PCT}<span style={{ fontSize:'0.3em', opacity:0.4 }}>%</span>
        </div>
        <p style={{ fontSize:12, color:'hsl(192,45%,48%)', marginTop:4 }}>{STATUS_MSG}</p>
      </div>
      <div style={{ height:76, borderRadius:12, overflow:'hidden', background:'hsl(210,28%,5%)', border:'1px solid hsl(195,20%,9%)' }}>
        <canvas ref={ref} style={{ width:'100%', height:'100%', display:'block' }} />
      </div>
      <StagePills color="hsl(192,90%,68%)" bg="hsl(192,90%,48%,0.1)" borderActive="hsl(192,90%,48%,0.35)" colorComplete="hsl(192,75%,42%)" borderComplete="hsl(192,75%,42%,0.25)" colorDim="hsl(210,8%,25%)" borderDim="hsl(210,8%,12%)" />
      <div style={{ height:2, borderRadius:99, background:'hsl(210,15%,8%)', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${PCT}%`, background:'linear-gradient(90deg,hsl(192,90%,42%),hsl(192,90%,62%))', boxShadow:'0 0 12px hsl(192,90%,50%,0.5)' }} />
      </div>
    </div>
  );
});

// ─── DESIGN 6 — Orbital (circular radial waveform) ───────────────────────────
const D6 = memo(() => {
  const ref = useRef<HTMLCanvasElement>(null);
  useCircularWave(ref, 'hsl(263,70%,62%)');
  return (
    <div style={{ background:'hsl(252,22%,4%)', border:'1px solid hsl(252,12%,10%)', borderRadius:20, padding:'20px', display:'flex', flexDirection:'column', gap:14, position:'relative', overflow:'hidden' }}>
      <div style={{ position:'relative', height:160 }}>
        <canvas ref={ref} style={{ width:'100%', height:'100%', display:'block' }} />
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
          <div style={{ fontSize:52, fontWeight:900, lineHeight:1, letterSpacing:'-0.04em', background:'linear-gradient(165deg,hsl(263,70%,85%),hsl(263,70%,58%))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>{PCT}%</div>
          <p style={{ fontSize:10, color:'hsl(263,25%,50%)', marginTop:3, textAlign:'center', maxWidth:120 }}>{STATUS_SHORT}</p>
        </div>
      </div>
      <StagePills color="hsl(263,70%,75%)" bg="hsl(263,70%,55%,0.1)" borderActive="hsl(263,70%,55%,0.35)" colorComplete="hsl(263,60%,50%)" borderComplete="hsl(263,60%,50%,0.2)" colorDim="hsl(252,8%,25%)" borderDim="hsl(252,8%,12%)" />
      <div style={{ height:2, borderRadius:99, background:'hsl(252,12%,8%)', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${PCT}%`, background:'hsl(263,70%,58%)', boxShadow:'0 0 10px hsl(263,70%,58%,0.5)' }} />
      </div>
    </div>
  );
});

// ─── DESIGN 7 — Titanium (pure greyscale, no color, brutalist luxury) ─────────
const D7 = memo(() => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLinearWave(ref, { lit:'rgba(230,230,230,0.88)', dim:'rgba(255,255,255,0.04)', glow:'rgba(210,210,210,0.5)' });
  return (
    <div style={{ background:'#070707', border:'1px solid rgba(255,255,255,0.05)', borderRadius:20, padding:'28px 20px', display:'flex', flexDirection:'column', gap:18 }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:100, fontWeight:900, lineHeight:1, letterSpacing:'-0.07em', color:'rgba(255,255,255,0.9)' }}>
          {PCT}<span style={{ fontSize:'0.28em', fontWeight:100, opacity:0.2 }}>%</span>
        </div>
        <p style={{ fontSize:9, color:'rgba(255,255,255,0.2)', marginTop:10, letterSpacing:'0.22em', textTransform:'uppercase' }}>{STATUS_MSG}</p>
      </div>
      <div style={{ height:68, borderRadius:8, overflow:'hidden', background:'rgba(255,255,255,0.015)', border:'1px solid rgba(255,255,255,0.035)' }}>
        <canvas ref={ref} style={{ width:'100%', height:'100%', display:'block' }} />
      </div>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center' }}>
        {STAGES.map((s,i)=>{const st=STAGE_STATUSES[i];return(
          <span key={s} style={{ fontSize:8, fontWeight:500, padding:'2px 8px', borderRadius:2, letterSpacing:'0.15em', textTransform:'uppercase', border:`1px solid ${st==='active'?'rgba(255,255,255,0.4)':st==='complete'?'rgba(255,255,255,0.12)':'rgba(255,255,255,0.04)'}`, color:st==='active'?'rgba(255,255,255,0.88)':st==='complete'?'rgba(255,255,255,0.28)':'rgba(255,255,255,0.08)' }}>{s}</span>
        )})}
      </div>
      <div style={{ height:1, background:'rgba(255,255,255,0.05)', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${PCT}%`, background:'rgba(255,255,255,0.72)' }} />
      </div>
    </div>
  );
});

// ─── DESIGN 8 — Aurora (navy + violet aurora sine wave) ──────────────────────
const D8 = memo(() => {
  const ref = useRef<HTMLCanvasElement>(null);
  useSineWave(ref, 'hsl(255,80%,68%)');
  return (
    <div style={{ background:'hsl(230,35%,5%)', border:'1px solid hsl(230,20%,11%)', borderRadius:20, padding:'28px 20px', display:'flex', flexDirection:'column', gap:18, position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, bottom:0, background:'radial-gradient(ellipse 80% 60% at 50% 0%,hsl(255,80%,55%,0.07),transparent)', pointerEvents:'none' }} />
      <div style={{ textAlign:'center', position:'relative' }}>
        <div style={{ fontSize:100, fontWeight:900, lineHeight:1, letterSpacing:'-0.05em', background:'linear-gradient(165deg,hsl(220,80%,85%),hsl(255,80%,62%))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', filter:'drop-shadow(0 0 50px hsl(255,80%,55%,0.28))' }}>
          {PCT}<span style={{ fontSize:'0.3em', opacity:0.4 }}>%</span>
        </div>
        <p style={{ fontSize:12, color:'hsl(230,35%,55%)', marginTop:4 }}>{STATUS_MSG}</p>
      </div>
      <div style={{ height:76, borderRadius:12, overflow:'hidden', background:'hsl(230,35%,5%)', border:'1px solid hsl(230,20%,10%)' }}>
        <canvas ref={ref} style={{ width:'100%', height:'100%', display:'block' }} />
      </div>
      <StagePills color="hsl(255,80%,75%)" bg="hsl(255,80%,55%,0.1)" borderActive="hsl(255,80%,55%,0.35)" colorComplete="hsl(255,65%,52%)" borderComplete="hsl(255,65%,52%,0.25)" colorDim="hsl(230,12%,25%)" borderDim="hsl(230,12%,12%)" />
      <div style={{ height:2, borderRadius:99, background:'hsl(230,20%,8%)', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${PCT}%`, background:'linear-gradient(90deg,hsl(220,80%,52%),hsl(255,80%,65%))', boxShadow:'0 0 14px hsl(255,80%,55%,0.5)' }} />
      </div>
    </div>
  );
});

// ─── DESIGN 9 — Verdant (deep forest green, organic) ─────────────────────────
const D9 = memo(() => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLinearWave(ref, { lit:'hsl(152,65%,48%)', dim:'hsla(152,25%,15%,0.09)', glow:'hsl(152,65%,42%)' });
  return (
    <div style={{ background:'hsl(155,25%,4%)', border:'1px solid hsl(152,18%,9%)', borderRadius:20, padding:'28px 20px', display:'flex', flexDirection:'column', gap:18, position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:0, left:'15%', right:'15%', height:1, background:'linear-gradient(90deg,transparent,hsl(152,65%,42%,0.4),transparent)' }} />
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:100, fontWeight:900, lineHeight:1, letterSpacing:'-0.05em', background:'linear-gradient(165deg,hsl(152,65%,78%),hsl(152,65%,42%))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', filter:'drop-shadow(0 0 50px hsl(152,65%,40%,0.28))' }}>
          {PCT}<span style={{ fontSize:'0.3em', opacity:0.4 }}>%</span>
        </div>
        <p style={{ fontSize:12, color:'hsl(152,30%,42%)', marginTop:4 }}>{STATUS_MSG}</p>
      </div>
      <div style={{ height:76, borderRadius:12, overflow:'hidden', background:'hsl(155,25%,5%)', border:'1px solid hsl(152,18%,9%)' }}>
        <canvas ref={ref} style={{ width:'100%', height:'100%', display:'block' }} />
      </div>
      <StagePills color="hsl(152,65%,60%)" bg="hsl(152,65%,42%,0.1)" borderActive="hsl(152,65%,42%,0.35)" colorComplete="hsl(152,55%,38%)" borderComplete="hsl(152,55%,38%,0.25)" colorDim="hsl(155,8%,22%)" borderDim="hsl(155,8%,11%)" />
      <div style={{ height:2, borderRadius:99, background:'hsl(155,15%,7%)', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${PCT}%`, background:'hsl(152,65%,46%)', boxShadow:'0 0 12px hsl(152,65%,42%,0.5)' }} />
      </div>
    </div>
  );
});

// ─── DESIGN 10 — Crimson (dark red, danger/drama) ────────────────────────────
const D10 = memo(() => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLinearWave(ref, { lit:'hsl(0,72%,58%)', dim:'hsla(0,25%,15%,0.1)', glow:'hsl(0,72%,50%)' });
  return (
    <div style={{ background:'hsl(0,22%,4%)', border:'1px solid hsl(0,15%,9%)', borderRadius:20, padding:'28px 20px', display:'flex', flexDirection:'column', gap:18, position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:0, left:'15%', right:'15%', height:1, background:'linear-gradient(90deg,transparent,hsl(0,72%,48%,0.4),transparent)' }} />
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:100, fontWeight:900, lineHeight:1, letterSpacing:'-0.05em', background:'linear-gradient(165deg,hsl(0,72%,78%),hsl(0,72%,50%))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', filter:'drop-shadow(0 0 50px hsl(0,72%,45%,0.32))' }}>
          {PCT}<span style={{ fontSize:'0.3em', opacity:0.4 }}>%</span>
        </div>
        <p style={{ fontSize:12, color:'hsl(0,28%,48%)', marginTop:4 }}>{STATUS_MSG}</p>
      </div>
      <div style={{ height:76, borderRadius:12, overflow:'hidden', background:'hsl(0,22%,5%)', border:'1px solid hsl(0,15%,9%)' }}>
        <canvas ref={ref} style={{ width:'100%', height:'100%', display:'block' }} />
      </div>
      <StagePills color="hsl(0,72%,68%)" bg="hsl(0,72%,48%,0.1)" borderActive="hsl(0,72%,48%,0.35)" colorComplete="hsl(0,60%,44%)" borderComplete="hsl(0,60%,44%,0.25)" colorDim="hsl(0,8%,22%)" borderDim="hsl(0,8%,11%)" />
      <div style={{ height:2, borderRadius:99, background:'hsl(0,12%,7%)', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${PCT}%`, background:'hsl(0,72%,52%)', boxShadow:'0 0 14px hsl(0,72%,48%,0.6)' }} />
      </div>
    </div>
  );
});

// ─── DESIGN 11 — Hologram (iridescent gradient bars) ─────────────────────────
const D11 = memo(() => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const dpr = window.devicePixelRatio||1;
    const r = c.getBoundingClientRect();
    c.width=r.width*dpr; c.height=r.height*dpr; ctx.scale(dpr,dpr);
    const W=r.width, H=r.height, BARS=44, BW=3, GAP=2.6;
    const totalW=BARS*(BW+GAP);
    let t=0, raf=0;
    const draw=()=>{
      t+=0.016; ctx.clearRect(0,0,W,H);
      const sx=(W-totalW)/2, cy=H*0.52, filled=PCT/100;
      for(let i=0;i<BARS;i++){
        const norm=i/BARS, lit=norm<=filled;
        const bh=Math.max(2,Math.abs(3+Math.sin(i*0.3)*4+Math.sin(t*1.9+i*0.18)*11+Math.sin(t*1.1+i*0.3+1.2)*5));
        const x=sx+i*(BW+GAP);
        if(lit){
          const hue=(i/BARS)*180+240+t*15; // shifting hue
          const grad=ctx.createLinearGradient(x,cy-bh,x,cy+bh);
          grad.addColorStop(0,`hsla(${hue},80%,70%,0.9)`);
          grad.addColorStop(0.5,`hsla(${hue+40},90%,62%,1)`);
          grad.addColorStop(1,`hsla(${hue+80},80%,70%,0.9)`);
          ctx.fillStyle=grad;
        } else {
          ctx.fillStyle='rgba(255,255,255,0.04)';
        }
        ctx.beginPath(); ctx.roundRect(x,cy-bh,BW,bh,1.5); ctx.fill();
        if(lit){ ctx.globalAlpha=0.1; ctx.beginPath(); ctx.roundRect(x,cy+2,BW,bh*0.28,1); ctx.fill(); ctx.globalAlpha=1; }
      }
      raf=requestAnimationFrame(draw);
    };
    raf=requestAnimationFrame(draw);
    return ()=>cancelAnimationFrame(raf);
  }, []);
  return (
    <div style={{ background:'hsl(240,25%,4%)', border:'1px solid hsl(240,15%,10%)', borderRadius:20, padding:'28px 20px', display:'flex', flexDirection:'column', gap:18, position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:1, background:'linear-gradient(90deg,hsl(280,80%,55%,0),hsl(240,80%,62%,0.5),hsl(180,80%,55%,0))' }} />
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:100, fontWeight:900, lineHeight:1, letterSpacing:'-0.05em', background:'linear-gradient(135deg,hsl(280,80%,72%),hsl(240,80%,65%),hsl(180,80%,65%))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', filter:'drop-shadow(0 0 50px hsl(240,80%,55%,0.3))' }}>
          {PCT}<span style={{ fontSize:'0.3em', opacity:0.4 }}>%</span>
        </div>
        <p style={{ fontSize:12, color:'hsl(240,30%,52%)', marginTop:4 }}>{STATUS_MSG}</p>
      </div>
      <div style={{ height:76, borderRadius:12, overflow:'hidden', background:'hsl(240,25%,5%)', border:'1px solid hsl(240,15%,10%)' }}>
        <canvas ref={ref} style={{ width:'100%', height:'100%', display:'block' }} />
      </div>
      <StagePills color="hsl(260,80%,72%)" bg="hsl(260,80%,55%,0.1)" borderActive="hsl(260,80%,55%,0.35)" colorComplete="hsl(240,70%,52%)" borderComplete="hsl(240,70%,52%,0.25)" colorDim="hsl(240,8%,22%)" borderDim="hsl(240,8%,11%)" />
      <div style={{ height:2, borderRadius:99, background:'hsl(240,15%,8%)', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${PCT}%`, background:'linear-gradient(90deg,hsl(280,80%,58%),hsl(240,80%,62%),hsl(200,80%,58%))', boxShadow:'0 0 14px hsl(240,80%,55%,0.5)' }} />
      </div>
    </div>
  );
});

// ─── DESIGN 12 — Obsidian (near-invisible ultra minimal) ─────────────────────
const D12 = memo(() => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLinearWave(ref, { lit:'rgba(180,180,190,0.55)', dim:'rgba(255,255,255,0.025)', glow:'rgba(160,160,180,0.3)' }, 36, 2.5, 3);
  return (
    <div style={{ background:'#040404', border:'1px solid rgba(255,255,255,0.04)', borderRadius:20, padding:'32px 20px', display:'flex', flexDirection:'column', gap:20 }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:88, fontWeight:800, lineHeight:1, letterSpacing:'-0.06em', color:'rgba(255,255,255,0.75)', textShadow:'none' }}>
          {PCT}
        </div>
        <div style={{ fontSize:10, color:'rgba(255,255,255,0.12)', marginTop:12, letterSpacing:'0.3em', textTransform:'uppercase' }}>percent</div>
        <p style={{ fontSize:10, color:'rgba(255,255,255,0.15)', marginTop:6, letterSpacing:'0.06em' }}>{STATUS_MSG}</p>
      </div>
      <div style={{ height:56, borderRadius:6, overflow:'hidden' }}>
        <canvas ref={ref} style={{ width:'100%', height:'100%', display:'block' }} />
      </div>
      <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
        {STAGES.map((s,i)=>{const st=STAGE_STATUSES[i];return(
          <span key={s} style={{ fontSize:8, color:st==='active'?'rgba(255,255,255,0.45)':st==='complete'?'rgba(255,255,255,0.18)':'rgba(255,255,255,0.06)', letterSpacing:'0.12em', textTransform:'uppercase' }}>{s}</span>
        )})}
      </div>
      <div style={{ height:1, background:'rgba(255,255,255,0.04)' }}>
        <div style={{ height:'100%', width:`${PCT}%`, background:'rgba(255,255,255,0.35)' }} />
      </div>
    </div>
  );
});

// ─── DESIGN 13 — Solar (deep black, warm gold solar accent) ──────────────────
const D13 = memo(() => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLinearWave(ref, { lit:'hsl(45,95%,55%)', dim:'hsla(45,20%,12%,0.1)', glow:'hsl(45,95%,50%)' });
  return (
    <div style={{ background:'#060504', border:'1px solid hsl(40,15%,9%)', borderRadius:20, padding:'28px 20px', display:'flex', flexDirection:'column', gap:18, position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, bottom:0, background:'radial-gradient(ellipse 60% 50% at 50% 0%,hsl(45,95%,42%,0.07),transparent)', pointerEvents:'none' }} />
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:100, fontWeight:900, lineHeight:1, letterSpacing:'-0.05em', background:'linear-gradient(165deg,hsl(55,100%,75%),hsl(38,95%,48%))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', filter:'drop-shadow(0 0 50px hsl(45,95%,45%,0.35))' }}>
          {PCT}<span style={{ fontSize:'0.3em', opacity:0.4 }}>%</span>
        </div>
        <p style={{ fontSize:12, color:'hsl(45,35%,42%)', marginTop:4 }}>{STATUS_MSG}</p>
      </div>
      <div style={{ height:76, borderRadius:12, overflow:'hidden', background:'hsl(40,18%,4%)', border:'1px solid hsl(40,12%,8%)' }}>
        <canvas ref={ref} style={{ width:'100%', height:'100%', display:'block' }} />
      </div>
      <StagePills color="hsl(45,95%,62%)" bg="hsl(45,95%,48%,0.1)" borderActive="hsl(45,95%,48%,0.35)" colorComplete="hsl(45,80%,42%)" borderComplete="hsl(45,80%,42%,0.25)" colorDim="hsl(40,8%,22%)" borderDim="hsl(40,8%,10%)" />
      <div style={{ height:2, borderRadius:99, background:'hsl(40,10%,7%)', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${PCT}%`, background:'linear-gradient(90deg,hsl(38,95%,48%),hsl(55,100%,58%))', boxShadow:'0 0 14px hsl(45,95%,48%,0.6)' }} />
      </div>
    </div>
  );
});

// ─── DESIGN 14 — Studio (asymmetric layout, left-anchored number) ─────────────
const D14 = memo(() => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLinearWave(ref, { lit:'hsl(263,70%,64%)', dim:'hsla(263,15%,20%,0.08)', glow:'hsl(263,70%,58%)' });
  return (
    <div style={{ background:'hsl(250,20%,4%)', border:'1px solid hsl(250,12%,10%)', borderRadius:20, padding:'24px 20px', display:'flex', flexDirection:'column', gap:16, position:'relative', overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'flex-end', gap:16, paddingBottom:4 }}>
        <div style={{ fontSize:88, fontWeight:900, lineHeight:0.9, letterSpacing:'-0.06em', background:'linear-gradient(165deg,hsl(263,70%,85%),hsl(263,70%,58%))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>{PCT}</div>
        <div style={{ paddingBottom:8 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'hsl(263,25%,55%)', letterSpacing:'0.12em', textTransform:'uppercase' }}>percent</div>
          <p style={{ fontSize:11, color:'hsl(263,15%,38%)', marginTop:3, maxWidth:140, lineHeight:1.4 }}>{STATUS_MSG}</p>
        </div>
      </div>
      <div style={{ height:72, borderRadius:10, overflow:'hidden', background:'hsl(250,20%,5%)', border:'1px solid hsl(250,12%,10%)' }}>
        <canvas ref={ref} style={{ width:'100%', height:'100%', display:'block' }} />
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <StagePills color="hsl(263,70%,72%)" bg="hsl(263,70%,55%,0.1)" borderActive="hsl(263,70%,55%,0.3)" colorComplete="hsl(263,55%,48%)" borderComplete="hsl(263,55%,48%,0.2)" colorDim="hsl(250,8%,24%)" borderDim="hsl(250,8%,12%)" />
      </div>
      <div style={{ height:2, borderRadius:99, background:'hsl(250,10%,8%)', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${PCT}%`, background:'hsl(263,70%,58%)', boxShadow:'0 0 10px hsl(263,70%,55%,0.55)' }} />
      </div>
    </div>
  );
});

// ─── DESIGN 15 — Midnight (deep navy, subtle starfield) ──────────────────────
const D15 = memo(() => {
  const ref = useRef<HTMLCanvasElement>(null);
  const starRef = useRef<HTMLCanvasElement>(null);
  useLinearWave(ref, { lit:'hsl(218,80%,65%)', dim:'hsla(218,30%,18%,0.1)', glow:'hsl(218,80%,55%)' });
  useEffect(()=>{
    const c=starRef.current; if(!c) return;
    const ctx=c.getContext('2d'); if(!ctx) return;
    const dpr=window.devicePixelRatio||1;
    const r=c.getBoundingClientRect();
    c.width=r.width*dpr; c.height=r.height*dpr; ctx.scale(dpr,dpr);
    const W=r.width, H=r.height;
    const stars=Array.from({length:60},()=>({ x:Math.random()*W, y:Math.random()*H, r:Math.random()*1.2, a:Math.random() }));
    let t=0, raf=0;
    const draw=()=>{ t+=0.01; ctx.clearRect(0,0,W,H);
      stars.forEach(s=>{ ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fillStyle=`rgba(200,210,255,${s.a*(0.5+0.5*Math.sin(t+s.x))})`; ctx.fill(); });
      raf=requestAnimationFrame(draw);
    };
    raf=requestAnimationFrame(draw); return()=>cancelAnimationFrame(raf);
  },[]);
  return (
    <div style={{ background:'hsl(222,40%,4%)', border:'1px solid hsl(218,25%,11%)', borderRadius:20, padding:'28px 20px', display:'flex', flexDirection:'column', gap:18, position:'relative', overflow:'hidden' }}>
      <canvas ref={starRef} style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:0.5, pointerEvents:'none' }} />
      <div style={{ position:'absolute', top:0, left:'15%', right:'15%', height:1, background:'linear-gradient(90deg,transparent,hsl(218,80%,55%,0.4),transparent)' }} />
      <div style={{ textAlign:'center', position:'relative' }}>
        <div style={{ fontSize:100, fontWeight:900, lineHeight:1, letterSpacing:'-0.05em', background:'linear-gradient(165deg,hsl(218,80%,85%),hsl(218,80%,55%))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', filter:'drop-shadow(0 0 50px hsl(218,80%,50%,0.3))' }}>
          {PCT}<span style={{ fontSize:'0.3em', opacity:0.4 }}>%</span>
        </div>
        <p style={{ fontSize:12, color:'hsl(218,35%,52%)', marginTop:4 }}>{STATUS_MSG}</p>
      </div>
      <div style={{ height:76, borderRadius:12, overflow:'hidden', background:'hsl(222,40%,5%)', border:'1px solid hsl(218,25%,10%)', position:'relative' }}>
        <canvas ref={ref} style={{ width:'100%', height:'100%', display:'block' }} />
      </div>
      <StagePills color="hsl(218,80%,72%)" bg="hsl(218,80%,52%,0.1)" borderActive="hsl(218,80%,52%,0.35)" colorComplete="hsl(218,65%,46%)" borderComplete="hsl(218,65%,46%,0.25)" colorDim="hsl(222,12%,24%)" borderDim="hsl(222,12%,12%)" />
      <div style={{ height:2, borderRadius:99, background:'hsl(222,20%,8%)', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${PCT}%`, background:'linear-gradient(90deg,hsl(218,80%,48%),hsl(218,80%,65%))', boxShadow:'0 0 12px hsl(218,80%,52%,0.5)' }} />
      </div>
    </div>
  );
});

// ─── DESIGN 16 — Signal (thin horizontal lines, oscilloscope style) ───────────
const D16 = memo(() => {
  const ref = useRef<HTMLCanvasElement>(null);
  useSineWave(ref, 'hsl(140,70%,52%)');
  return (
    <div style={{ background:'#030803', border:'1px solid hsl(140,20%,8%)', borderRadius:20, padding:'28px 20px', display:'flex', flexDirection:'column', gap:18, position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, bottom:0, backgroundImage:'repeating-linear-gradient(0deg,rgba(0,255,100,0.012) 0px,rgba(0,255,100,0.012) 1px,transparent 1px,transparent 18px)', pointerEvents:'none' }} />
      <div style={{ textAlign:'center', position:'relative' }}>
        <div style={{ fontSize:88, fontWeight:900, lineHeight:1, letterSpacing:'-0.04em', color:'hsl(140,70%,52%)', fontFamily:'monospace', textShadow:'0 0 30px hsl(140,70%,42%,0.6)' }}>
          {PCT}<span style={{ fontSize:'0.35em', opacity:0.5 }}>%</span>
        </div>
        <p style={{ fontSize:11, color:'hsl(140,40%,35%)', marginTop:4, fontFamily:'monospace', letterSpacing:'0.05em' }}>&gt; {STATUS_MSG}</p>
      </div>
      <div style={{ height:76, borderRadius:8, overflow:'hidden', background:'#020702', border:'1px solid hsl(140,20%,7%)' }}>
        <canvas ref={ref} style={{ width:'100%', height:'100%', display:'block' }} />
      </div>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'center' }}>
        {STAGES.map((s,i)=>{const st=STAGE_STATUSES[i];return(
          <span key={s} style={{ fontSize:9, fontWeight:600, padding:'2px 8px', borderRadius:3, fontFamily:'monospace', letterSpacing:'0.06em', border:`1px solid ${st==='active'?'hsl(140,70%,42%,0.6)':st==='complete'?'hsl(140,70%,42%,0.2)':'hsl(140,12%,10%)'}`, color:st==='active'?'hsl(140,70%,58%)':st==='complete'?'hsl(140,55%,32%)':'hsl(140,8%,22%)' }}>
            {st==='complete'?'✓':st==='active'?'▶':' '} {s}
          </span>
        )})}
      </div>
      <div style={{ height:2, background:'hsl(140,15%,7%)', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${PCT}%`, background:'hsl(140,70%,48%)', boxShadow:'0 0 10px hsl(140,70%,42%,0.7)' }} />
      </div>
    </div>
  );
});

// ─── DESIGN 17 — Glass (frosted glass card on gradient bg) ───────────────────
const D17 = memo(() => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLinearWave(ref, { lit:'rgba(255,255,255,0.85)', dim:'rgba(255,255,255,0.08)', glow:'rgba(255,255,255,0.5)' });
  return (
    <div style={{ background:'linear-gradient(135deg,hsl(263,45%,12%),hsl(230,45%,9%),hsl(280,35%,8%))', border:'1px solid rgba(255,255,255,0.1)', borderRadius:20, padding:'28px 20px', display:'flex', flexDirection:'column', gap:18, position:'relative', overflow:'hidden', backdropFilter:'blur(20px)' }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:1, background:'rgba(255,255,255,0.12)' }} />
      <div style={{ position:'absolute', top:-40, right:-40, width:180, height:180, borderRadius:'50%', background:'hsl(263,70%,55%,0.1)', filter:'blur(40px)', pointerEvents:'none' }} />
      <div style={{ textAlign:'center', position:'relative' }}>
        <div style={{ fontSize:100, fontWeight:900, lineHeight:1, letterSpacing:'-0.05em', color:'rgba(255,255,255,0.95)', textShadow:'0 4px 40px rgba(140,100,255,0.4)' }}>
          {PCT}<span style={{ fontSize:'0.3em', fontWeight:200, opacity:0.35 }}>%</span>
        </div>
        <p style={{ fontSize:12, color:'rgba(255,255,255,0.45)', marginTop:4 }}>{STATUS_MSG}</p>
      </div>
      <div style={{ height:76, borderRadius:12, overflow:'hidden', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}>
        <canvas ref={ref} style={{ width:'100%', height:'100%', display:'block' }} />
      </div>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'center' }}>
        {STAGES.map((s,i)=>{const st=STAGE_STATUSES[i];return(
          <span key={s} style={{ fontSize:10, fontWeight:600, padding:'3px 10px', borderRadius:20, background:st==='active'?'rgba(255,255,255,0.12)':'rgba(255,255,255,0.04)', border:`1px solid ${st==='active'?'rgba(255,255,255,0.3)':st==='complete'?'rgba(255,255,255,0.12)':'rgba(255,255,255,0.05)'}`, color:st==='active'?'rgba(255,255,255,0.9)':st==='complete'?'rgba(255,255,255,0.4)':'rgba(255,255,255,0.15)' }}>{s}</span>
        )})}
      </div>
      <div style={{ height:2, borderRadius:99, background:'rgba(255,255,255,0.07)', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${PCT}%`, background:'linear-gradient(90deg,hsl(263,70%,62%),rgba(255,255,255,0.85))', boxShadow:'0 0 14px rgba(255,255,255,0.3)' }} />
      </div>
    </div>
  );
});

// ─── DESIGN 18 — Infrared (thermal deep red, barely visible) ─────────────────
const D18 = memo(() => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLinearWave(ref, { lit:'hsl(15,80%,52%)', dim:'hsla(15,30%,12%,0.08)', glow:'hsl(15,80%,45%)' }, 40, 2.8, 2.8);
  return (
    <div style={{ background:'hsl(12,28%,4%)', border:'1px solid hsl(12,18%,8%)', borderRadius:20, padding:'28px 20px', display:'flex', flexDirection:'column', gap:18, position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, bottom:0, background:'radial-gradient(ellipse 70% 55% at 50% 0%,hsl(15,80%,40%,0.06),transparent)', pointerEvents:'none' }} />
      <div style={{ textAlign:'center', position:'relative' }}>
        <div style={{ fontSize:100, fontWeight:900, lineHeight:1, letterSpacing:'-0.05em', background:'linear-gradient(165deg,hsl(25,80%,70%),hsl(8,80%,50%))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', filter:'drop-shadow(0 0 50px hsl(15,80%,42%,0.35))' }}>
          {PCT}<span style={{ fontSize:'0.3em', opacity:0.4 }}>%</span>
        </div>
        <p style={{ fontSize:12, color:'hsl(15,28%,42%)', marginTop:4 }}>{STATUS_MSG}</p>
      </div>
      <div style={{ height:76, borderRadius:12, overflow:'hidden', background:'hsl(12,28%,5%)', border:'1px solid hsl(12,18%,8%)' }}>
        <canvas ref={ref} style={{ width:'100%', height:'100%', display:'block' }} />
      </div>
      <StagePills color="hsl(15,80%,62%)" bg="hsl(15,80%,45%,0.1)" borderActive="hsl(15,80%,45%,0.35)" colorComplete="hsl(15,65%,40%)" borderComplete="hsl(15,65%,40%,0.25)" colorDim="hsl(12,8%,22%)" borderDim="hsl(12,8%,10%)" />
      <div style={{ height:2, borderRadius:99, background:'hsl(12,15%,7%)', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${PCT}%`, background:'hsl(15,80%,50%)', boxShadow:'0 0 12px hsl(15,80%,45%,0.55)' }} />
      </div>
    </div>
  );
});

// ─── DESIGN 19 — Orbital Circular Amber ──────────────────────────────────────
const D19 = memo(() => {
  const ref = useRef<HTMLCanvasElement>(null);
  useCircularWave(ref, 'hsl(38,95%,58%)');
  return (
    <div style={{ background:'hsl(30,22%,4%)', border:'1px solid hsl(30,14%,9%)', borderRadius:20, padding:'20px', display:'flex', flexDirection:'column', gap:14, position:'relative', overflow:'hidden' }}>
      <div style={{ position:'relative', height:160 }}>
        <canvas ref={ref} style={{ width:'100%', height:'100%', display:'block' }} />
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
          <div style={{ fontSize:52, fontWeight:900, lineHeight:1, letterSpacing:'-0.04em', background:'linear-gradient(165deg,hsl(48,100%,72%),hsl(28,95%,52%))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>{PCT}%</div>
          <p style={{ fontSize:10, color:'hsl(38,35%,42%)', marginTop:3, textAlign:'center' }}>{STATUS_SHORT}</p>
        </div>
      </div>
      <StagePills color="hsl(38,95%,65%)" bg="hsl(38,95%,52%,0.1)" borderActive="hsl(38,95%,52%,0.35)" colorComplete="hsl(38,80%,42%)" borderComplete="hsl(38,80%,42%,0.25)" colorDim="hsl(30,8%,22%)" borderDim="hsl(30,8%,11%)" />
      <div style={{ height:2, borderRadius:99, background:'hsl(30,10%,7%)', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${PCT}%`, background:'linear-gradient(90deg,hsl(28,95%,50%),hsl(48,100%,58%))', boxShadow:'0 0 12px hsl(38,95%,52%,0.55)' }} />
      </div>
    </div>
  );
});

// ─── DESIGN 20 — Genesis (mesh gradient, the APEX signature look) ─────────────
const D20 = memo(() => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLinearWave(ref, { lit:'hsl(263,70%,68%)', dim:'hsla(263,15%,22%,0.09)', glow:'hsl(263,70%,60%)' }, 48, 3, 2.2);
  return (
    <div style={{ background:'hsl(250,25%,4%)', border:'1px solid hsl(263,20%,12%)', borderRadius:20, padding:'28px 20px', display:'flex', flexDirection:'column', gap:18, position:'relative', overflow:'hidden' }}>
      {/* mesh bg */}
      <div style={{ position:'absolute', inset:0, backgroundImage:`
        radial-gradient(ellipse 80% 60% at 20% 20%, hsl(263,70%,55%,0.08) 0%, transparent 60%),
        radial-gradient(ellipse 60% 50% at 80% 80%, hsl(220,80%,55%,0.06) 0%, transparent 60%),
        radial-gradient(ellipse 50% 40% at 50% 50%, hsl(300,60%,45%,0.04) 0%, transparent 70%)
      `, pointerEvents:'none' }} />
      <div style={{ position:'absolute', top:0, left:0, right:0, height:1, background:'linear-gradient(90deg,transparent,hsl(263,70%,60%,0.5),transparent)' }} />
      <div style={{ textAlign:'center', position:'relative' }}>
        <div style={{ fontSize:96, fontWeight:900, lineHeight:1, letterSpacing:'-0.05em', background:'linear-gradient(135deg,hsl(220,80%,80%) 0%,hsl(263,70%,68%) 40%,hsl(300,65%,68%) 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', filter:'drop-shadow(0 0 60px hsl(263,70%,55%,0.35))' }}>
          {PCT}<span style={{ fontSize:'0.3em', opacity:0.4 }}>%</span>
        </div>
        <p style={{ fontSize:12, color:'hsl(263,25%,52%)', marginTop:4 }}>{STATUS_MSG}</p>
      </div>
      <div style={{ height:76, borderRadius:12, overflow:'hidden', background:'hsl(250,25%,5%)', border:'1px solid hsl(263,18%,11%)' }}>
        <canvas ref={ref} style={{ width:'100%', height:'100%', display:'block' }} />
      </div>
      <StagePills color="hsl(263,70%,76%)" bg="hsl(263,70%,55%,0.12)" borderActive="hsl(263,70%,55%,0.4)" colorComplete="hsl(263,60%,52%)" borderComplete="hsl(263,60%,52%,0.25)" colorDim="hsl(250,8%,24%)" borderDim="hsl(250,8%,12%)" />
      <div style={{ height:2, borderRadius:99, background:'hsl(250,14%,8%)', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${PCT}%`, background:'linear-gradient(90deg,hsl(220,80%,58%),hsl(263,70%,65%),hsl(300,65%,62%))', boxShadow:'0 0 16px hsl(263,70%,58%,0.55)' }} />
      </div>
    </div>
  );
});

// ─── DESIGNS REGISTRY ─────────────────────────────────────────────────────────
const DESIGNS = [
  { id:1,  name:'Apex Void',     sub:'Surgical brand violet',         C:D1  },
  { id:2,  name:'Monolith',      sub:'Editorial white on black',      C:D2  },
  { id:3,  name:'Ember',         sub:'Cinematic warm amber',          C:D3  },
  { id:4,  name:'Velvet',        sub:'Deep plum luxury',              C:D4  },
  { id:5,  name:'Glacier',       sub:'Arctic precision cyan',         C:D5  },
  { id:6,  name:'Orbital Violet',sub:'Circular radial waveform',      C:D6  },
  { id:7,  name:'Titanium',      sub:'Pure greyscale brutalism',      C:D7  },
  { id:8,  name:'Aurora',        sub:'Navy violet sine wave',         C:D8  },
  { id:9,  name:'Verdant',       sub:'Deep forest green',             C:D9  },
  { id:10, name:'Crimson',       sub:'Dark red drama',                C:D10 },
  { id:11, name:'Hologram',      sub:'Iridescent shifting hues',      C:D11 },
  { id:12, name:'Obsidian',      sub:'Near-invisible ultra-minimal',  C:D12 },
  { id:13, name:'Solar',         sub:'Warm gold on deep black',       C:D13 },
  { id:14, name:'Studio',        sub:'Asymmetric editorial layout',   C:D14 },
  { id:15, name:'Midnight',      sub:'Navy with starfield',           C:D15 },
  { id:16, name:'Signal',        sub:'Oscilloscope terminal green',   C:D16 },
  { id:17, name:'Glass',         sub:'Frosted glass mesh gradient',   C:D17 },
  { id:18, name:'Infrared',      sub:'Thermal dark orange',           C:D18 },
  { id:19, name:'Orbital Amber', sub:'Circular radial waveform',      C:D19 },
  { id:20, name:'Genesis',       sub:'APEX signature mesh gradient',  C:D20 },
];

// ─── PICKER PAGE ─────────────────────────────────────────────────────────────
export default function DesignPicker() {
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <div style={{ minHeight:'100vh', background:'#030303', padding:'40px 20px 60px', fontFamily:'system-ui,sans-serif' }}>
      {/* header */}
      <div style={{ maxWidth:1000, margin:'0 auto 40px', textAlign:'center' }}>
        <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.22em', color:'rgba(255,255,255,0.2)', textTransform:'uppercase', marginBottom:10 }}>
          Pipeline Progress UI
        </div>
        <h1 style={{ fontSize:30, fontWeight:800, color:'rgba(255,255,255,0.88)', margin:'0 0 8px', letterSpacing:'-0.03em' }}>
          20 Designs — Pick One
        </h1>
        <p style={{ fontSize:13, color:'rgba(255,255,255,0.22)', margin:0 }}>All live and animated. Click to select.</p>
        {selected && (
          <motion.div initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} style={{ marginTop:16, display:'inline-flex', alignItems:'center', gap:8, padding:'8px 20px', borderRadius:99, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)' }}>
            <CheckCircle2 style={{ width:13, height:13, color:'hsl(152,70%,50%)' }} />
            <span style={{ fontSize:13, color:'rgba(255,255,255,0.65)' }}>
              Selected: <strong style={{ color:'rgba(255,255,255,0.92)' }}>Design {selected} — {DESIGNS.find(d=>d.id===selected)?.name}</strong>
            </span>
          </motion.div>
        )}
      </div>

      {/* grid */}
      <div style={{ maxWidth:1100, margin:'0 auto', display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(330px,1fr))', gap:20 }}>
        {DESIGNS.map(({ id, name, sub, C }) => (
          <motion.div key={id} onClick={() => setSelected(id)} whileHover={{ scale:1.012 }} whileTap={{ scale:0.99 }}
            style={{ cursor:'pointer', borderRadius:24, overflow:'hidden', position:'relative', outline:selected===id?'2px solid rgba(255,255,255,0.45)':'2px solid transparent', outlineOffset:3, transition:'outline 0.2s' }}>
            {/* number */}
            <div style={{ position:'absolute', top:11, left:11, zIndex:10, fontSize:9, fontWeight:700, letterSpacing:'0.12em', padding:'2px 7px', borderRadius:5, background:'rgba(0,0,0,0.55)', color:'rgba(255,255,255,0.35)', backdropFilter:'blur(8px)' }}>
              {String(id).padStart(2,'0')}
            </div>
            {selected===id && (
              <div style={{ position:'absolute', top:11, right:11, zIndex:10 }}>
                <CheckCircle2 style={{ width:18, height:18, color:'hsl(152,70%,50%)' }} />
              </div>
            )}
            <div style={{ pointerEvents:'none' }}><C /></div>
            <div style={{ background:'rgba(0,0,0,0.88)', padding:'10px 14px', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.82)' }}>{name}</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.28)', marginTop:1 }}>{sub}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {selected && (
        <div style={{ maxWidth:900, margin:'32px auto 0', textAlign:'center' }}>
          <p style={{ fontSize:13, color:'rgba(255,255,255,0.3)' }}>
            Tell me <strong style={{ color:'rgba(255,255,255,0.55)' }}>"Design {selected}"</strong> and I'll apply it immediately.
          </p>
        </div>
      )}
    </div>
  );
}
