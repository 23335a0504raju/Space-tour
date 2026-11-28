import { INK, arc, dialArt, line } from './draw.ts';
import type { Ctx } from './draw.ts';
import type { AtlasRect } from './panes.ts';

/**
 * The shared pictures behind and around the screens: rings, a hex field, a network of nodes, a ship
 * blueprint, a data window, waveforms and a dial. Abstract display art with no words or figures, so
 * it claims nothing. Deterministic (the same every visit) and drawn once. Each set keeps a copy in
 * a band `HUD.height` tall across its atlas.
 */
export const HUD = { width: 2048, height: 768 } as const;

const NODE = '#46ffb0';

export function hudRects(top: number) {
  return {
    ring: { x: 0, y: top, w: 640, h: 640 },
    hex: { x: 640, y: top, w: 512, h: 384 },
    nodes: { x: 1152, y: top, w: 512, h: 384 },
    ship: { x: 640, y: top + 384, w: 640, h: 384 },
    data: { x: 1280, y: top + 384, w: 384, h: 384 },
    wave: { x: 1664, y: top, w: 384, h: 192 },
    dial: { x: 1664, y: top + 192, w: 352, h: 352 },
  } as const satisfies Record<string, AtlasRect>;
}

/** A seeded random sequence in [0, 1). */
function sequence(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function disc(ctx: Ctx, colour: string, x: number, y: number, r: number) {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** A node of light: a bright point in a faint halo and a thin ring. */
function node(ctx: Ctx, x: number, y: number, r: number, colour: string = NODE) {
  ctx.save();
  ctx.globalAlpha = 0.25;
  disc(ctx, colour, x, y, r * 2.4);
  ctx.restore();
  disc(ctx, colour, x, y, r);
  arc(ctx, colour, 1.5, x, y, r * 2.4);
}

/** Small corner brackets round a rectangle, with a faint outline. */
export function brackets(ctx: Ctx, x: number, y: number, w: number, h: number, colour: string) {
  ctx.strokeStyle = INK.faint;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, h);
  const k = Math.min(18, w / 4, h / 4);
  for (const [cx, cy, dx, dy] of [
    [x, y, 1, 1],
    [x + w, y, -1, 1],
    [x, y + h, 1, -1],
    [x + w, y + h, -1, -1],
  ] as const) {
    line(ctx, colour, 3, cx + dx * k, cy, cx, cy, cx, cy + dy * k);
  }
}

/** Great concentric rings. The shader turns the bands outside 0.36 and 0.24 of the width. */
function ringArt(ctx: Ctx, size: number) {
  const c = size / 2;
  const rand = sequence(11);
  const at = (a: number, r: number) =>
    [c + Math.cos(a) * r * size, c + Math.sin(a) * r * size] as const;
  // outer band
  arc(ctx, INK.cyan, 2, c, c, size * 0.485);
  arc(ctx, INK.dim, 1.5, c, c, size * 0.455);
  for (let i = 0; i < 180; i += 1) {
    const a = (i / 180) * Math.PI * 2;
    const [x0, y0] = at(a, i % 10 === 0 ? 0.425 : 0.44);
    const [x1, y1] = at(a, 0.453);
    line(ctx, i % 10 === 0 ? INK.pale : INK.dim, i % 10 === 0 ? 3 : 1.5, x0, y0, x1, y1);
  }
  for (let i = 0; i < 9; i += 1) {
    const from = i / 9 + rand() * 0.03;
    arc(ctx, i % 4 === 1 ? INK.gold : INK.cyan, 9, c, c, size * 0.398, from, from + rand() * 0.07);
  }
  for (let i = 0; i < 7; i += 1) node(ctx, ...at(rand() * Math.PI * 2, 0.47), 4);
  // middle band
  for (const [from, to] of [
    [0.02, 0.2],
    [0.27, 0.31],
    [0.38, 0.66],
    [0.74, 0.93],
  ] as const) {
    arc(ctx, INK.cyan, 4, c, c, size * 0.33, from, to);
    arc(ctx, INK.faint, 16, c, c, size * 0.3, from + 0.01, to - 0.01);
  }
  for (let i = 0; i < 48; i += 1) {
    const a = (i / 48) * Math.PI * 2;
    const [x, y] = at(a, 0.263);
    disc(ctx, i % 6 === 0 ? INK.pale : INK.dim, x, y, i % 6 === 0 ? 4 : 2);
  }
  // still centre
  arc(ctx, INK.dim, 1.5, c, c, size * 0.215);
  arc(ctx, INK.faint, 1.5, c, c, size * 0.14);
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    line(ctx, INK.faint, 1.5, ...at(a, 0.09), ...at(a, 0.215));
  }
}

function hexPath(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

/** A loose cluster of hexagons, thinning toward the edges. */
function hexArt(ctx: Ctx, w: number, h: number) {
  const rand = sequence(23);
  const r = 34;
  const stepY = Math.sqrt(3) * r;
  for (let col = 0; col * r * 1.5 < w + r; col += 1) {
    for (let row = 0; row * stepY < h + stepY; row += 1) {
      const x = col * r * 1.5;
      const y = row * stepY + (col % 2 ? stepY / 2 : 0);
      const away = Math.hypot((x - w / 2) / (w / 2), (y - h / 2) / (h / 2));
      const pick = rand();
      if (away > 0.98 - pick * 0.22) continue;
      hexPath(ctx, x, y, r - 4);
      ctx.strokeStyle = pick > 0.82 ? INK.cyan : INK.faint;
      ctx.lineWidth = pick > 0.82 ? 2.5 : 1.5;
      ctx.stroke();
      if (pick > 0.9) {
        ctx.save();
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = INK.cyan;
        ctx.fill();
        ctx.restore();
      } else if (pick < 0.16) {
        node(ctx, x, y, 6);
      } else if (pick < 0.3) {
        for (let k = 0; k < 3; k += 1) {
          ctx.fillStyle = INK.dim;
          ctx.fillRect(x - 14, y - 10 + k * 8, 10 + rand() * 20, 3);
        }
      }
    }
  }
}

/** A network: points of light joined to their nearest neighbours. */
function nodeArt(ctx: Ctx, w: number, h: number) {
  const rand = sequence(41);
  const points: Array<readonly [number, number]> = [];
  while (points.length < 34) {
    const x = 24 + rand() * (w - 48);
    const y = 24 + rand() * (h - 48);
    if (points.every(([px, py]) => Math.hypot(px - x, py - y) > 46)) points.push([x, y]);
  }
  for (const [x, y] of points) {
    const near = [...points]
      .sort((a, b) => Math.hypot(a[0] - x, a[1] - y) - Math.hypot(b[0] - x, b[1] - y))
      .slice(1, 4);
    for (const [px, py] of near) line(ctx, INK.faint, 2, x, y, px, py);
  }
  points.forEach(([x, y], i) => node(ctx, x, y, i % 7 === 0 ? 8 : 4, i % 3 ? NODE : INK.cyan));
  arc(ctx, INK.dim, 2, w * 0.5, h * 0.5, h * 0.3, 0.05, 0.4);
  arc(ctx, INK.dim, 2, w * 0.5, h * 0.5, h * 0.3, 0.55, 0.9);
}

/** A ship seen from above as a blueprint, with leader lines out to little boxes. */
function shipArt(ctx: Ctx, w: number, h: number) {
  const rand = sequence(57);
  const cy = h / 2;
  for (let x = 0; x <= w; x += 40) line(ctx, '#0a2838', 1, x, 0, x, h);
  for (let y = 0; y <= h; y += 40) line(ctx, '#0a2838', 1, 0, y, w, y);
  // half the outline, mirrored about the axis
  const hull = [
    [120, 0],
    [180, 22],
    [250, 30],
    [290, 108],
    [345, 118],
    [350, 46],
    [430, 40],
    [450, 66],
    [505, 62],
    [505, 20],
    [530, 0],
  ] as const;
  for (const k of [-1, 1]) {
    line(ctx, INK.cyan, 3, ...hull.flatMap(([x, y]) => [x, cy + k * y]));
    line(ctx, INK.dim, 1.5, 180, cy + k * 12, 430, cy + k * 18, 505, cy + k * 8);
    line(ctx, INK.dim, 1.5, 290, cy + k * 36, 300, cy + k * 104);
    ctx.strokeStyle = INK.pale;
    ctx.strokeRect(505, cy + k * 40 - 12, 28, 24);
  }
  line(ctx, INK.faint, 1.5, 80, cy, 590, cy);
  for (const r of [18, 34]) arc(ctx, INK.cyan, 2, 232, cy, r);
  for (const [px, py, bx, by] of [
    [232, cy - 34, 40, 36],
    [320, cy + 114, 90, h - 72],
    [430, cy - 40, 470, 30],
    [505, cy + 52, 540, h - 84],
  ] as const) {
    line(ctx, INK.gold, 1.5, px, py, (px + bx) / 2, by + 20, bx + 40, by + 20);
    disc(ctx, INK.gold, px, py, 4);
    brackets(ctx, bx, by, 86, 46, INK.cyan);
    for (let i = 0; i < 3; i += 1) {
      ctx.fillStyle = INK.dim;
      ctx.fillRect(bx + 10, by + 10 + i * 11, 20 + rand() * 46, 4);
    }
  }
}

/** A window of data: rows of marks, columns and a gauge. */
function dataArt(ctx: Ctx, w: number, h: number) {
  const rand = sequence(73);
  brackets(ctx, 8, 8, w - 16, h - 16, INK.cyan);
  ctx.fillStyle = INK.gold;
  ctx.fillRect(28, 28, 8, 22);
  ctx.fillStyle = INK.pale;
  ctx.fillRect(48, 34, 130, 9);
  line(ctx, INK.faint, 2, 28, 66, w - 28, 66);
  for (let i = 0; i < 7; i += 1) {
    const y = 86 + i * 22;
    disc(ctx, i % 3 ? INK.dim : NODE, 34, y + 3, 4);
    ctx.fillStyle = INK.dim;
    ctx.fillRect(50, y, 40 + rand() * 120, 6);
    ctx.fillStyle = INK.faint;
    ctx.fillRect(230, y, 20 + rand() * 120, 6);
  }
  for (let i = 0; i < 18; i += 1) {
    const tall = 16 + rand() * 90;
    ctx.fillStyle = i % 7 === 3 ? INK.gold : INK.cyan;
    ctx.fillRect(28 + i * 11, h - 30 - tall, 6, tall);
  }
  arc(ctx, INK.faint, 14, w - 90, h - 82, 46);
  arc(ctx, INK.cyan, 14, w - 90, h - 82, 46, -0.25, 0.38);
  arc(ctx, INK.dim, 2, w - 90, h - 82, 64);
}

/** Two traces over a ruled base. */
function waveArt(ctx: Ctx, w: number, h: number) {
  brackets(ctx, 6, 6, w - 12, h - 12, INK.cyan);
  for (let x = 24; x < w - 20; x += 14) line(ctx, INK.dim, 2, x, h - 26, x, h - 18);
  for (const [colour, a, b, mid] of [
    [INK.cyan, 0.045, 0.13, h * 0.36],
    [NODE, 0.07, 0.021, h * 0.62],
  ] as const) {
    const points: number[] = [];
    for (let x = 22; x <= w - 22; x += 4) {
      points.push(x, mid + 26 * Math.sin(x * a) * Math.sin(x * b + 1));
    }
    line(ctx, colour, 2.5, ...points);
  }
}

/** The painters for a set's shared band, for `createAtlasTexture`. */
export function hudPainters(top: number) {
  const r = hudRects(top);
  return [
    [r.ring, (ctx: Ctx, at: AtlasRect) => ringArt(ctx, at.w)],
    [r.hex, (ctx: Ctx, at: AtlasRect) => hexArt(ctx, at.w, at.h)],
    [r.nodes, (ctx: Ctx, at: AtlasRect) => nodeArt(ctx, at.w, at.h)],
    [r.ship, (ctx: Ctx, at: AtlasRect) => shipArt(ctx, at.w, at.h)],
    [r.data, (ctx: Ctx, at: AtlasRect) => dataArt(ctx, at.w, at.h)],
    [r.wave, (ctx: Ctx, at: AtlasRect) => waveArt(ctx, at.w, at.h)],
    [r.dial, (ctx: Ctx, at: AtlasRect) => dialArt(ctx, at.w)],
  ] as const;
}
