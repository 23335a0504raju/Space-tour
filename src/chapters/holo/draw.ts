import * as THREE from 'three';
import { textureContext } from '../../engine/assets/canvas2d.ts';
import type { AtlasRect, AtlasSize } from './panes.ts';

/**
 * Drawing the pictures of the floating screens: light on black (the shader adds it to the scene,
 * so black is clear glass), once per atlas, costing nothing per frame.
 */
export const INK = {
  cyan: '#5fdcff',
  pale: '#d8f6ff',
  dim: '#2b7fa6',
  faint: '#12445c',
  gold: '#ffc266',
} as const;

export const MONO = 'Consolas, "Cascadia Code", monospace';

export type Ctx = CanvasRenderingContext2D;

export function line(ctx: Ctx, colour: string, width: number, ...points: number[]) {
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(points[0]!, points[1]!);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i]!, points[i + 1]!);
  ctx.stroke();
}

export function arc(
  ctx: Ctx,
  colour: string,
  width: number,
  x: number,
  y: number,
  r: number,
  from = 0,
  to = 1,
) {
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(x, y, r, from * Math.PI * 2, to * Math.PI * 2);
  ctx.stroke();
}

export function text(
  ctx: Ctx,
  value: string,
  x: number,
  y: number,
  size: number,
  colour: string,
  bold = false,
) {
  ctx.font = `${bold ? '700 ' : ''}${size}px ${MONO}`;
  ctx.fillStyle = colour;
  ctx.fillText(value, x, y);
}

/** A screen's title row: a gold mark, the title, an optional note and a rule under them. */
export function header(ctx: Ctx, width: number, title: string, note = '') {
  ctx.fillStyle = INK.gold;
  ctx.fillRect(28, 22, 8, 28);
  text(ctx, title, 50, 46, 28, INK.pale, true);
  ctx.textAlign = 'right';
  text(ctx, note, width - 30, 44, 20, INK.dim);
  ctx.textAlign = 'left';
  line(ctx, INK.faint, 2, 28, 62, width - 28, 62);
}

/** Rings of ticks and arcs; the shader turns the two outer bands against each other. */
export function dialArt(ctx: Ctx, size: number) {
  const c = size / 2;
  // outer band (r > 0.36 of the size)
  arc(ctx, INK.dim, 2, c, c, size * 0.47);
  for (let i = 0; i < 72; i += 1) {
    const a = (i / 72) * Math.PI * 2;
    const major = i % 6 === 0;
    const inner = size * (major ? 0.405 : 0.43);
    line(
      ctx,
      major ? INK.pale : INK.cyan,
      major ? 4 : 2,
      c + Math.cos(a) * inner,
      c + Math.sin(a) * inner,
      c + Math.cos(a) * size * 0.455,
      c + Math.sin(a) * size * 0.455,
    );
  }
  arc(ctx, INK.gold, 8, c, c, size * 0.385, 0.05, 0.2);
  // middle band (0.24 to 0.36)
  for (const [from, to] of [
    [0, 0.28],
    [0.36, 0.52],
    [0.62, 0.9],
  ] as const) {
    arc(ctx, INK.cyan, 12, c, c, size * 0.31, from, to);
  }
  arc(ctx, INK.dim, 2, c, c, size * 0.265);
  // still centre
  arc(ctx, INK.cyan, 3, c, c, size * 0.17);
  arc(ctx, INK.faint, 10, c, c, size * 0.12);
  ctx.fillStyle = INK.pale;
  ctx.beginPath();
  ctx.arc(c, c, size * 0.035, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * A black atlas with each painter drawing inside its own rectangle. `scale` sets the resolution;
 * painters and rectangles stay in the layout's own pixels.
 */
export function createAtlasTexture(
  size: AtlasSize,
  parts: ReadonlyArray<readonly [AtlasRect, (ctx: Ctx, rect: AtlasRect) => void]>,
  scale = 1,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size.width * scale;
  canvas.height = size.height * scale;
  const ctx = textureContext(canvas);
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.scale(scale, scale);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, size.width, size.height);
  for (const [rect, paint] of parts) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    ctx.translate(rect.x, rect.y);
    paint(ctx, rect);
    ctx.restore();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
