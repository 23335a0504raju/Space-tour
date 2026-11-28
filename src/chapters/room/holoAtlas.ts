import type * as THREE from 'three';
// This portfolio's own source code, shown on the screens (no third-party code, no permission issue).
import resolverSource from '../../engine/scroll/resolver.ts?raw';
import { INK, arc, createAtlasTexture, header, line, text } from '../holo/draw.ts';
import type { Ctx } from '../holo/draw.ts';
import { hudPainters } from '../holo/hud.ts';
import { sections } from '../sections.ts';
import { ATLAS, CODE, HUD_TOP, RADAR, RECTS } from './holoLayout.ts';

/**
 * The pictures on the desk's floating screens, drawn once as light on black (the shader adds it to
 * the scene, so black is clear glass). Everything shown is about this site itself: its source, its
 * scroll engine and its flight plan. Costs nothing per frame; the motion is in shaders/holoScreen.ts.
 */

const { cyan: CYAN, pale: PALE, dim: DIM, faint: FAINT, gold: GOLD } = INK;

const KEYWORDS =
  /\b(export|import|from|const|let|function|return|if|else|for|of|type|interface|readonly|new|throw)\b/;

function drawMain(ctx: Ctx, w: number, h: number) {
  header(ctx, w, 'resolver.ts', 'engine / scroll');
  const source = resolverSource.split('\n').filter((l) => l.trim() !== '');
  for (let i = 0; i < CODE.lines; i += 1) {
    const code = source[i % source.length] ?? '';
    const y = CODE.top + i * CODE.line + 18;
    text(ctx, String(i + 1).padStart(3, ' '), 24, y, 18, FAINT);
    const trimmed = code.trimStart();
    const comment = trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, CODE.width - 20, h);
    ctx.clip();
    if (comment) {
      text(ctx, code, 80, y, 19, DIM);
    } else {
      let x = 80;
      for (const part of code.split(KEYWORDS)) {
        if (!part) continue;
        text(ctx, part, x, y, 19, KEYWORDS.test(part) && /^[a-z]+$/.test(part) ? GOLD : PALE);
        x += ctx.measureText(part).width;
      }
    }
    ctx.restore();
  }

  // the module map beside the code
  line(ctx, FAINT, 2, CODE.width, 84, CODE.width, h - 28);
  const x = CODE.width + 36;
  text(ctx, 'MODULES', x, 110, 22, CYAN, true);
  const modules = ['engine/scroll', 'engine/camera', 'engine/assets', 'chapters', 'shaders', 'ui'];
  modules.forEach((name, i) => {
    const y = 164 + i * 62;
    line(ctx, DIM, 2, x + 10, y - 40, x + 10, y - 6, x + 34, y - 6);
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 34, y - 26, 300, 40);
    ctx.fillStyle = i === 0 ? GOLD : CYAN;
    ctx.fillRect(x + 46, y - 13, 12, 12);
    text(ctx, name, x + 74, y, 21, PALE);
  });
  for (let i = 0; i < 46; i += 1) {
    ctx.fillStyle = i % 9 === 4 ? GOLD : DIM;
    ctx.fillRect(x + i * 7.4, h - 62, 3, 14 + 20 * Math.abs(Math.sin(i * 1.7)));
  }
}

function drawEngine(ctx: Ctx, w: number, h: number) {
  header(ctx, w, 'SCROLL ENGINE', 'one clock');
  const nodes = ['wheel', 'pacing', 'progress', 'timeline', 'camera'];
  nodes.forEach((name, i) => {
    const x = 40 + i * 62;
    const y = 96 + i * 52;
    ctx.strokeStyle = i === 2 ? GOLD : CYAN;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, 230, 38);
    text(ctx, name, x + 18, y + 27, 24, PALE);
    if (i < nodes.length - 1) {
      line(ctx, DIM, 3, x + 230, y + 19, x + 262, y + 19, x + 262, y + 52);
      ctx.fillStyle = CYAN;
      ctx.beginPath();
      ctx.moveTo(x + 256, y + 44);
      ctx.lineTo(x + 268, y + 44);
      ctx.lineTo(x + 262, y + 52);
      ctx.fill();
    }
  });
  // a gauge in the free upper right, and the base line of the live bars the shader draws below
  arc(ctx, FAINT, 14, 640, 170, 70);
  arc(ctx, CYAN, 14, 640, 170, 70, -0.25, 0.42);
  arc(ctx, DIM, 2, 640, 170, 90);
  text(ctx, 't', 630, 182, 36, PALE, true);
  line(ctx, DIM, 2, 40, h - 30, w - 40, h - 30);
}

function drawFlight(ctx: Ctx, w: number, h: number) {
  header(ctx, w, 'FLIGHT PLAN', 'in order');
  const { x, y, radius } = RADAR;
  for (const k of [0.28, 0.52, 0.76, 1]) arc(ctx, k === 1 ? CYAN : DIM, 2, x, y, radius * k);
  line(ctx, FAINT, 2, x - radius, y, x + radius, y);
  line(ctx, FAINT, 2, x, y - radius, x, y + radius);
  sections.forEach((s, i) => {
    // one stop per section, spiralling outward in flight order
    const a = -Math.PI / 2 + i * 1.75;
    const r = radius * (0.2 + (0.75 * i) / (sections.length - 1));
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    ctx.fillStyle = i === 0 ? GOLD : PALE;
    ctx.beginPath();
    ctx.arc(px, py, i === 0 ? 9 : 6, 0, Math.PI * 2);
    ctx.fill();
    if (i === 0) arc(ctx, GOLD, 2, px, py, 17);
    const ty = 112 + i * 52;
    text(ctx, String(i + 1).padStart(2, '0'), 490, ty, 20, i === 0 ? GOLD : DIM);
    text(ctx, s.label.toUpperCase(), 530, ty, 22, i === 0 ? GOLD : PALE);
    line(ctx, FAINT, 2, 490, ty + 14, w - 30, ty + 14);
  });
  text(ctx, 'ORIGIN  >  CONTACT', 40, h - 18, 18, DIM);
}

function drawKeys(ctx: Ctx, w: number, h: number) {
  const rows = [13, 13, 12, 11, 7];
  const rowH = (h - 20) / rows.length;
  rows.forEach((count, r) => {
    let x = 12;
    const unit = (w - 24) / (r === 4 ? 12 : count);
    for (let i = 0; i < count; i += 1) {
      // the bottom row has the long space bar in its middle
      const wide = r === 4 && i === 3 ? 6 : 1;
      const keyW = unit * wide - 10;
      ctx.fillStyle = FAINT;
      ctx.fillRect(x, 12 + r * rowH, keyW, rowH - 12);
      ctx.strokeStyle = CYAN;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, 12 + r * rowH, keyW, rowH - 12);
      x += unit * wide;
    }
  });
}

export function createHoloAtlas(scale: number): THREE.CanvasTexture {
  return createAtlasTexture(
    ATLAS,
    [
      [RECTS.main, (ctx, r) => drawMain(ctx, r.w, r.h)],
      [RECTS.engine, (ctx, r) => drawEngine(ctx, r.w, r.h)],
      [RECTS.flight, (ctx, r) => drawFlight(ctx, r.w, r.h)],
      [RECTS.keys, (ctx, r) => drawKeys(ctx, r.w, r.h)],
      ...hudPainters(HUD_TOP),
    ],
    scale,
  );
}
