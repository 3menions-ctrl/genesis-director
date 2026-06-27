/**
 * Breakthrough FX — procedural container chrome painters.
 *
 * Draws the recognisable UI/scene a subject breaks out of (feed card, billboard,
 * aquarium, CCTV grid, group chat, wanted poster, app grid) plus the inner
 * "media window" content. Everything is drawn from code — no image assets — so
 * it's resolution-independent and tint-matched to the template's colour grade.
 */

import { rgba, type FrameCtx } from "./core";
import { roundRect } from "./sims";
import type { ContainerKind, NormRect } from "@/lib/templates/breakthrough";

interface ChromeCtx {
  kind: ContainerKind;
  fc: FrameCtx;
  /** 0 = window intact, 1 = window fully broken (inner content gone). */
  reveal: number;
}

/** Inner media-window content — an animated gradient standing in for the video. */
function drawInnerMedia(g: CanvasRenderingContext2D, w: number, h: number, m: NormRect, fc: FrameCtx, reveal: number) {
  const alpha = 1 - reveal;
  if (alpha <= 0) return;
  g.save();
  g.beginPath();
  roundRect(g, m.x * w, m.y * h, m.width * w, m.height * h, Math.min(m.width * w, m.height * h) * 0.05);
  g.clip();
  const t = fc.timeSec;
  const grad = g.createLinearGradient(m.x * w, m.y * h, (m.x + m.width) * w, (m.y + m.height) * h);
  grad.addColorStop(0, rgba(fc.palette.primary, alpha));
  grad.addColorStop(0.5 + 0.4 * Math.sin(t * 1.3), rgba(fc.palette.secondary, 0.55 * alpha));
  grad.addColorStop(1, rgba(fc.palette.accent, 0.4 * alpha));
  g.fillStyle = grad;
  g.fillRect(m.x * w, m.y * h, m.width * w, m.height * h);
  // a subtle pulse so it reads as a playing clip
  g.fillStyle = rgba(fc.palette.accent, 0.12 * alpha * (0.5 + 0.5 * Math.sin(t * 4)));
  g.fillRect(m.x * w, m.y * h, m.width * w, m.height * h);
  g.restore();
}

export function drawContainer(g: CanvasRenderingContext2D, w: number, h: number, c: ChromeCtx) {
  const { fc, kind, reveal } = c;
  const m = fc.mediaWindow;
  const P = fc.palette;
  // chrome dims slightly post-break but stays (it's the "outer space")
  const chromeA = 1 - reveal * 0.35;

  // base wash
  g.fillStyle = rgba(P.primary, 0.0); // engine paints the bg; keep transparent here

  switch (kind) {
    case "social-feed": {
      g.save(); g.globalAlpha = chromeA;
      // card
      g.fillStyle = "rgba(255,255,255,0.06)";
      roundRect(g, m.x * w - 18, m.y * h - 70, m.width * w + 36, m.height * h + 150, 22); g.fill();
      // avatar + handle
      g.fillStyle = rgba(P.secondary, 0.5); g.beginPath(); g.arc(m.x * w + 6, m.y * h - 40, 16, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(255,255,255,0.35)"; roundRect(g, m.x * w + 32, m.y * h - 48, 130, 10, 5); g.fill();
      // like/comment/share rail
      for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(m.x * w + 20 + i * 46, (m.y + m.height) * h + 34, 12, 0, Math.PI * 2); g.strokeStyle = "rgba(255,255,255,0.4)"; g.lineWidth = 2; g.stroke(); }
      g.restore();
      drawInnerMedia(g, w, h, m, fc, reveal); break;
    }
    case "billboard": {
      g.save(); g.globalAlpha = chromeA;
      g.strokeStyle = rgba(P.accent, 0.7); g.lineWidth = 6;
      roundRect(g, m.x * w - 10, m.y * h - 10, m.width * w + 20, m.height * h + 20, 8); g.stroke();
      // support posts
      g.fillStyle = "rgba(255,255,255,0.1)";
      g.fillRect(m.x * w + m.width * w * 0.3, (m.y + m.height) * h + 10, 14, h * 0.4);
      g.fillRect(m.x * w + m.width * w * 0.65, (m.y + m.height) * h + 10, 14, h * 0.4);
      g.restore();
      drawInnerMedia(g, w, h, m, fc, reveal);
      // pixel-grid sheen
      g.save(); g.globalAlpha = chromeA * (1 - reveal); g.strokeStyle = rgba(P.accent, 0.08);
      for (let x = m.x; x < m.x + m.width; x += 0.03) { g.beginPath(); g.moveTo(x * w, m.y * h); g.lineTo(x * w, (m.y + m.height) * h); g.stroke(); }
      g.restore(); break;
    }
    case "aquarium": {
      drawInnerMedia(g, w, h, m, fc, reveal);
      g.save(); g.globalAlpha = chromeA;
      g.strokeStyle = rgba(P.secondary, 0.8); g.lineWidth = 8;
      roundRect(g, m.x * w, m.y * h, m.width * w, m.height * h, 10); g.stroke();
      // waterline shimmer
      g.strokeStyle = rgba(P.accent, 0.5 * (1 - reveal)); g.lineWidth = 2;
      g.beginPath();
      for (let x = 0; x <= 1; x += 0.05) { const px = (m.x + x * m.width) * w; const py = (m.y + 0.12 * m.height) * h + Math.sin(x * 12 + fc.timeSec * 3) * 6; x === 0 ? g.moveTo(px, py) : g.lineTo(px, py); }
      g.stroke(); g.restore(); break;
    }
    case "cctv-grid": {
      g.save(); g.globalAlpha = chromeA;
      const cols = 3, rows = 2;
      for (let r = 0; r < rows; r++) for (let col = 0; col < cols; col++) {
        const gx = 0.05 + col * 0.32, gy = 0.1 + r * 0.42, gw = 0.28, gh = 0.36;
        g.strokeStyle = rgba(P.secondary, 0.6); g.lineWidth = 2;
        g.strokeRect(gx * w, gy * h, gw * w, gh * h);
        g.fillStyle = "#ff4d4d"; g.beginPath(); g.arc(gx * w + 12, gy * h + 12, 4, 0, Math.PI * 2); g.fill();
      }
      g.restore();
      drawInnerMedia(g, w, h, m, fc, reveal); break;
    }
    case "group-chat": {
      g.save(); g.globalAlpha = chromeA * (1 - reveal);
      for (let i = 0; i < 5; i++) {
        const left = i % 2 === 0;
        const bx = left ? m.x * w : (m.x + m.width) * w - 200;
        g.fillStyle = left ? "rgba(255,255,255,0.12)" : rgba(P.secondary, 0.5);
        roundRect(g, bx, m.y * h + 20 + i * 64, 200, 44, 22); g.fill();
      }
      g.restore();
      // input bar persists as chrome
      g.save(); g.globalAlpha = chromeA; g.fillStyle = "rgba(255,255,255,0.1)";
      roundRect(g, m.x * w, (m.y + m.height) * h + 16, m.width * w, 48, 24); g.fill(); g.restore(); break;
    }
    case "wanted-poster": {
      g.save(); g.globalAlpha = chromeA;
      g.fillStyle = rgba(P.secondary, 0.18);
      roundRect(g, m.x * w - 30, m.y * h - 90, m.width * w + 60, m.height * h + 200, 6); g.fill();
      g.fillStyle = rgba(P.accent, 0.85); g.font = `bold ${Math.round(h * 0.05)}px Georgia, serif`; g.textAlign = "center";
      g.fillText("WANTED", (m.x + m.width / 2) * w, m.y * h - 36);
      g.restore();
      drawInnerMedia(g, w, h, m, fc, reveal); break;
    }
    case "app-icon-home": {
      g.save(); g.globalAlpha = chromeA;
      for (let r = 0; r < 4; r++) for (let col = 0; col < 4; col++) {
        const gx = 0.32 + col * 0.1, gy = 0.34 + r * 0.1;
        const hero = r === 1 && col === 1;
        if (hero) continue;
        g.fillStyle = rgba(P.secondary, 0.3);
        roundRect(g, gx * w, gy * h, w * 0.07, w * 0.07, 14); g.fill();
      }
      g.restore();
      drawInnerMedia(g, w, h, m, fc, reveal); break;
    }
    default:
      drawInnerMedia(g, w, h, m, fc, reveal);
  }
}
