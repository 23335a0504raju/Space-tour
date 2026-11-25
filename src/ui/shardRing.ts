/**
 * The opening (task 8, after Shopify Editions Winter '26), drawn on one 2D canvas over the live
 * WebGL scene. No second WebGL context.
 *
 *  - Loading: a tilted ring of shards and sparkles assembles around the name as files arrive.
 *  - Opening (driven by the visitor's scroll): the dark cover burns away. A spark ignites at the
 *    centre and eats an organic hole outward; two smaller spots ignite later and merge into it.
 *    The burn front is the reference's "ring": a band where the scene behind appears as
 *    fragments (pixels copied from the 3D canvas), under a thick, bright, fibrous white edge with
 *    sparkles. The loading ring dissolves into the front as it passes.
 *
 * All randomness is seeded and computed once. Drawn at 1× pixel density: it is sparkle and glow,
 * and the fill rate is what made the loader stutter on the laptop.
 */

/** What the gate animates (plain numbers; GSAP and the gate's ticker set them). */
export interface RingState {
  /** 0..1: how far the loading ring has assembled (follows the real load progress). */
  assemble: number;
  /** 0..1: the opening, driven by the visitor's scroll (0 = solid cover, 1 = cleared). */
  open: number;
}

export const createRingState = (): RingState => ({ assemble: 0, open: 0 });

/** Seeded PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TAU = Math.PI * 2;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number) => v * v * (3 - 2 * v);
const easeOut = (v: number) => 1 - (1 - v) ** 3;

/** Muted journey palette (no neon): paper white, visor gold, sage, dusty blue, rust, lavender. */
const PALETTE: readonly (readonly [number, number, number])[] = [
  [248, 245, 238],
  [214, 167, 86],
  [150, 172, 140],
  [151, 176, 208],
  [196, 118, 86],
  [176, 160, 204],
];

/**
 * Burn-front shape: [frequency round the hole, amplitude, drift per second, change as it grows].
 * Strong low octaves make an organic blob, not a circle; the high ones fray the edge.
 */
const FRONT_OCTAVES: readonly (readonly [number, number, number, number])[] = [
  [2, 0.15, 0.05, 1.3],
  [3, 0.12, -0.07, -1.1],
  [5, 0.07, 0.1, 2.0],
  [8, 0.045, -0.15, -2.4],
  [13, 0.03, 0.2, 3.1],
  [21, 0.02, -0.3, 0],
  [37, 0.012, 0.5, 0],
  [67, 0.008, -0.8, 0],
  [121, 0.005, 1.3, 0],
  [211, 0.0035, -2, 0],
];

/** Burn spots: centre (fraction of the screen), when it ignites (open), final size (× diagonal). */
const SPOTS: readonly { x: number; y: number; start: number; size: number }[] = [
  { x: 0.5, y: 0.5, start: 0, size: 1.45 }, // big enough that even its dips clear the corners
  { x: 0.3, y: 0.22, start: 0.17, size: 0.42 },
  { x: 0.76, y: 0.74, start: 0.3, size: 0.38 },
];

/** Points round each burn front. */
const EDGE_N = 220;

interface Shard {
  theta: number;
  dr: number;
  dz: number;
  len: number;
  wid: number;
  rot: number;
  at: number;
  fromR: number;
  fromA: number;
  phase: number;
}

interface Spark {
  theta: number;
  dr: number;
  dz: number;
  size: number;
  at: number;
  phase: number;
  speed: number;
  star: boolean;
}

/** A piece of the scene in the burn band: where on the front, how far out, its size and turn. */
interface Fragment {
  /** edge position (0..EDGE_N) */
  e: number;
  /** across the band (0 inner .. 1 outer) */
  u: number;
  size: number;
  rot: number;
}

interface Fibre {
  e: number;
  len: number;
  tilt: number;
  bright: boolean;
}

interface Glint {
  e: number;
  off: number;
  size: number;
  phase: number;
}

interface SpotData {
  phases: number[];
  fragments: Fragment[];
  fibres: Fibre[];
  glints: Glint[];
  /** current edge (x, y per point), recomputed each frame */
  edge: Float32Array;
}

function ringProfile(seed: number) {
  const r = rng(seed);
  const p = Array.from({ length: 6 }, () => r() * TAU);
  return {
    density: (t: number) =>
      clamp01(
        0.55 +
          0.32 * Math.sin(2 * t + p[0]!) +
          0.22 * Math.sin(5 * t + p[1]!) +
          0.14 * Math.sin(11 * t + p[2]!),
      ),
    thickness: (t: number) =>
      0.03 + 0.065 * clamp01(0.5 + 0.5 * Math.sin(3 * t + p[3]!) + 0.3 * Math.sin(7 * t + p[4]!)),
  };
}

/** Normal deviate, clipped to ±2.2 so no shard strays far from the ring. */
function gauss(r: () => number) {
  const u = Math.max(1e-6, r());
  const g = Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * r());
  return Math.max(-2.2, Math.min(2.2, g));
}

/** A 2D canvas the ring can draw on: the page's own, or an OffscreenCanvas in the ring worker. */
export type RingCanvas = HTMLCanvasElement | OffscreenCanvas;
type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function makeSprite(star: boolean): OffscreenCanvas | HTMLCanvasElement {
  const s = 64;
  // OffscreenCanvas works on the page and in the ring worker (no document there)
  const c: OffscreenCanvas | HTMLCanvasElement =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(s, s)
      : Object.assign(document.createElement('canvas'), { width: s, height: s });
  const g = c.getContext('2d') as Ctx2D;
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.12, 'rgba(255,250,240,0.85)');
  grad.addColorStop(0.35, 'rgba(255,240,220,0.18)');
  grad.addColorStop(1, 'rgba(255,240,220,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  if (star) {
    g.globalCompositeOperation = 'lighter';
    for (const horizontal of [true, false]) {
      const lg = horizontal
        ? g.createLinearGradient(0, s / 2, s, s / 2)
        : g.createLinearGradient(s / 2, 0, s / 2, s);
      lg.addColorStop(0, 'rgba(255,255,255,0)');
      lg.addColorStop(0.5, 'rgba(255,255,255,0.95)');
      lg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = lg;
      if (horizontal) g.fillRect(0, s / 2 - 0.8, s, 1.6);
      else g.fillRect(s / 2 - 0.8, 0, 1.6, s);
    }
  }
  return c;
}

export interface ShardRingOptions {
  /** loading-ring shards and sparkles */
  shards: number;
  sparks: number;
  /** scene fragments in the main burn band (the smaller spots get fewer) */
  fragments: number;
  /** cover colour (the page background) */
  cover: string;
}

/**
 * Guide lines of the opening (after the reference's architectural construction lines): a golden
 * rectangle and its spiral arcs around the title, two long diagonals, two large circles and
 * registration marks, in a 1600 × 1000 frame laid over the screen like an SVG "slice". Each draws
 * in over its own window of the assembly ([from, to]).
 */
export const GUIDES: readonly { d: string; from: number; to: number }[] = [
  { d: 'M60 0 L1600 960', from: 0, to: 0.35 },
  { d: 'M1540 0 L0 960', from: 0.05, to: 0.4 },
  { d: 'M640 0 V300', from: 0.08, to: 0.25 },
  { d: 'M760 0 V300', from: 0.12, to: 0.3 },
  { d: 'M476 300 H1124 V700 H476 Z', from: 0.15, to: 0.5 },
  { d: 'M876 300 V700', from: 0.3, to: 0.45 },
  { d: 'M876 548 H1124', from: 0.38, to: 0.5 },
  { d: 'M972 548 V700', from: 0.45, to: 0.55 },
  { d: 'M476 700 A400 400 0 0 1 876 300', from: 0.4, to: 0.62 },
  { d: 'M876 300 A248 248 0 0 1 1124 548', from: 0.5, to: 0.68 },
  { d: 'M1124 548 A152 152 0 0 1 972 700', from: 0.58, to: 0.74 },
  { d: 'M540 250 A520 520 0 1 1 1580 250', from: 0.25, to: 0.75 },
  { d: 'M-140 960 A560 560 0 0 1 980 960', from: 0.35, to: 0.8 },
  { d: 'M1124 860 H1600', from: 0.6, to: 0.75 },
  { d: 'M540 230 h40 v40 h-40 Z M520 250 h80 M560 210 v80', from: 0.55, to: 0.7 },
  { d: 'M1180 760 h40 v40 h-40 Z M1160 780 h80 M1200 740 v80', from: 0.65, to: 0.82 },
];
const GUIDE_W = 1600;
const GUIDE_H = 1000;
const GUIDE_STROKE = 'rgba(233, 231, 225, 0.17)';

/** How much of the title, guides and actions remain as the opening burns (1 → 0). */
export function chromeKeep(open: number): number {
  return 1 - smooth(clamp01((open - 0.38) / 0.32));
}

export class ShardRing {
  private readonly canvas: RingCanvas;
  private readonly opts: ShardRingOptions;
  private readonly ctx: Ctx2D;
  private readonly shards: Shard[] = [];
  /** shard indices by palette colour (one pass per colour, not per colour × alpha step) */
  private readonly byColour: number[][] = PALETTE.map(() => []);
  private readonly sparks: Spark[] = [];
  private readonly spots: SpotData[] = [];
  private readonly dot = makeSprite(false);
  private readonly glint = makeSprite(true);
  private readonly verts: Float32Array;
  private readonly alpha: Float32Array;
  private w = 0;
  private h = 0;
  /** The 3D scene as last drawn (a small copy), for the fragments in the burn band. */
  scene: CanvasImageSource | null = null;
  /** Guide paths with their lengths (frame units), measured on the page: Path2D has no length. */
  private guides: { path: Path2D; len: number; from: number; to: number }[] = [];

  setGuideLengths(lengths: readonly number[]): void {
    this.guides = GUIDES.map((g, i) => ({ ...g, path: new Path2D(g.d), len: lengths[i] ?? 0 }));
  }

  /** The guides, drawn in by the assembly and faded out by the opening. */
  private drawGuides(assemble: number, alpha: number) {
    if (!this.guides.length || alpha <= 0.001) return;
    const c = this.ctx;
    const { w, h } = this;
    const k = Math.max(w / GUIDE_W, h / GUIDE_H);
    c.save();
    c.setTransform(k, 0, 0, k, (w - GUIDE_W * k) / 2, (h - GUIDE_H * k) / 2);
    c.globalAlpha = alpha;
    c.strokeStyle = GUIDE_STROKE;
    // one CSS pixel wide at any scale (the SVG's non-scaling stroke)
    c.lineWidth = 1 / k;
    for (const g of this.guides) {
      const t = clamp01((assemble - g.from) / (g.to - g.from));
      if (t <= 0 || g.len <= 0) continue;
      c.setLineDash(t >= 1 ? [] : [g.len * t, g.len]);
      c.stroke(g.path);
    }
    c.restore();
  }

  constructor(canvas: RingCanvas, opts: ShardRingOptions) {
    this.canvas = canvas;
    this.opts = opts;
    this.ctx = canvas.getContext('2d') as Ctx2D;
    const r = rng(20261122);
    const profile = ringProfile(7);
    const pickTheta = () => {
      for (;;) {
        const t = r() * TAU;
        if (r() < profile.density(t) ** 1.6) return t;
      }
    };
    const q = r() * TAU;
    const patch = (t: number) =>
      1 + (Math.floor(((t + 0.5 * Math.sin(3 * t + q) + TAU) / TAU) * 7) % (PALETTE.length - 1));
    for (let i = 0; i < opts.shards; i += 1) {
      const theta = pickTheta();
      const th = profile.thickness(theta);
      const sweep = (((theta + 1.1) % TAU) + TAU) % TAU;
      const colour =
        r() < 0.52 ? 0 : r() < 0.75 ? patch(theta) : 1 + Math.floor(r() * (PALETTE.length - 1));
      this.byColour[colour]!.push(i);
      this.shards.push({
        theta,
        dr: gauss(r) * th,
        dz: gauss(r) * th * 0.7,
        len: 2.2 + r() ** 2.2 * 13,
        wid: 0.7 + r() * 1.8,
        rot: (r() - 0.5) * 1.3,
        at: clamp01((sweep / TAU) * 0.72 + r() * 0.24),
        fromR: 1.9 + r() * 1.6,
        fromA: theta + (r() - 0.5) * 1.2,
        phase: r() * TAU,
      });
    }
    for (let i = 0; i < opts.sparks; i += 1) {
      const theta = pickTheta();
      const th = profile.thickness(theta);
      const inner = r() < 0.12;
      this.sparks.push({
        theta,
        dr: inner ? -0.2 - r() * 0.55 : gauss(r) * th * 1.1,
        dz: gauss(r) * th * 0.6,
        size: 3 + r() ** 3 * 22,
        at: clamp01(r() * 0.95),
        phase: r() * TAU,
        speed: 0.6 + r() * 2.2,
        star: r() < 0.035,
      });
    }
    SPOTS.forEach((_spot, k) => {
      const share = k === 0 ? 1 : 0.4;
      const nFrag = Math.round(opts.fragments * share);
      this.spots.push({
        phases: FRONT_OCTAVES.map(() => r() * TAU),
        fragments: Array.from({ length: nFrag }, () => ({
          e: r() * EDGE_N,
          u: r() ** 1.8,
          size: 2.5 + r() ** 2 * 12,
          rot: r() * TAU,
        })),
        fibres: Array.from({ length: Math.round(nFrag * 0.55) }, () => ({
          e: r() * EDGE_N,
          len: 3 + r() ** 2.2 * 26,
          tilt: (r() - 0.5) * 1.1,
          bright: r() < 0.45,
        })),
        glints: Array.from({ length: Math.round(nFrag * 0.18) }, () => ({
          e: r() * EDGE_N,
          off: (r() - 0.3) * 18,
          size: 3 + r() ** 3 * 22,
          phase: r() * TAU,
        })),
        edge: new Float32Array(EDGE_N * 2),
      });
    });
    this.verts = new Float32Array(opts.shards * 6);
    this.alpha = new Float32Array(opts.shards);
  }

  /** CSS size of the canvas element (an OffscreenCanvas has none of its own, so it is passed in). */
  resize(width: number, height: number): void {
    this.w = width;
    this.h = height;
    // 1× pixel density (see the header)
    this.canvas.width = Math.round(this.w);
    this.canvas.height = Math.round(this.h);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** Burn progress of spot k (0 before it ignites, 1 when the opening is complete). */
  private spotT(k: number, open: number): number {
    const s = SPOTS[k]!;
    return clamp01((open - s.start) / (1 - s.start));
  }

  /** Fill spot k's edge points for radius R (organic, frayed, changing as it grows). */
  private buildEdge(k: number, R: number, time: number, diag: number) {
    const spot = SPOTS[k]!;
    const d = this.spots[k]!;
    const cx = spot.x * this.w;
    const cy = spot.y * this.h;
    const grown = R / diag;
    for (let i = 0; i < EDGE_N; i += 1) {
      const a = (i / EDGE_N) * TAU;
      let v = 1;
      for (let o = 0; o < FRONT_OCTAVES.length; o += 1) {
        const [f, amp, drift, morph] = FRONT_OCTAVES[o]!;
        v += amp * Math.sin(f * a + d.phases[o]! + time * drift + grown * morph);
      }
      d.edge[i * 2] = cx + Math.cos(a) * R * v;
      d.edge[i * 2 + 1] = cy + Math.sin(a) * R * v;
    }
  }

  /** Point at a fractional edge index, pushed `out` px away from the spot's centre. */
  private at(k: number, e: number, out: number, res: number[]) {
    const d = this.spots[k]!.edge;
    const i0 = Math.floor(e) % EDGE_N;
    const i1 = (i0 + 1) % EDGE_N;
    const f = e - Math.floor(e);
    const x = d[i0 * 2]! + (d[i1 * 2]! - d[i0 * 2]!) * f;
    const y = d[i0 * 2 + 1]! + (d[i1 * 2 + 1]! - d[i0 * 2 + 1]!) * f;
    const spot = SPOTS[k]!;
    const dx = x - spot.x * this.w;
    const dy = y - spot.y * this.h;
    const len = Math.hypot(dx, dy) || 1;
    res[0] = x + (dx / len) * out;
    res[1] = y + (dy / len) * out;
    res[2] = dx / len;
    res[3] = dy / len;
  }

  private edgePath(k: number) {
    const d = this.spots[k]!.edge;
    const c = this.ctx;
    c.moveTo(d[0]!, d[1]!);
    for (let i = 1; i < EDGE_N; i += 1) c.lineTo(d[i * 2]!, d[i * 2 + 1]!);
    c.closePath();
  }

  /** Draw one frame. `time` is seconds on the GSAP clock (twinkle and drift only). */
  draw(s: RingState, time: number): void {
    const { ctx: c, w, h } = this;
    if (!w || !h) return;
    const open = clamp01(s.open);
    const diag = Math.hypot(w, h);
    const base = Math.min(w, h) * (w < h ? 0.45 : 0.36);
    const cx = w * 0.5;
    const cy = h * 0.5;
    const coverAlpha = 1 - smooth(clamp01((open - 0.88) / 0.12));

    // burn fronts: radius per spot (slow at first, then fast enough to clear the screen)
    const radii = SPOTS.map((spot, k) => {
      const t = this.spotT(k, open);
      return t <= 0 ? 0 : diag * spot.size * (0.02 + 0.98 * t ** 1.5);
    });
    radii.forEach((R, k) => R > 0 && this.buildEdge(k, R, time, diag));
    const mainR = radii[0]!;
    // the loading ring dissolves as the main front reaches it
    const ringFade = 1 - smooth(clamp01((mainR - base * 0.55) / (base * 0.55)));

    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.clearRect(0, 0, w, h);
    if (coverAlpha <= 0.001) return;

    // 1. The cover, with the burnt holes through it.
    c.globalAlpha = coverAlpha;
    c.fillStyle = this.opts.cover;
    c.fillRect(0, 0, w, h);
    if (open > 0) {
      c.globalCompositeOperation = 'destination-out';
      c.globalAlpha = 1;
      c.beginPath();
      radii.forEach((R, k) => R > 0.5 && this.edgePath(k));
      c.fill('nonzero');
      c.globalCompositeOperation = 'source-over';
    }

    // 1b. The guide lines, faded out with the first stretch of the opening.
    this.drawGuides(s.assemble, chromeKeep(open) * coverAlpha);

    // 2. The loading ring (behind the burn edge).
    if (ringFade > 0.001) this.drawRing(s, time, base, cx, cy, ringFade * coverAlpha);

    if (open <= 0) {
      c.globalAlpha = 1;
      return;
    }
    const p = [0, 0, 0, 0];
    const p2 = [0, 0, 0, 0];

    // 3. Fragments of the scene in each burn band: the picture arriving in pieces.
    const scene = this.scene;
    c.save();
    c.beginPath();
    let anyFragment = false;
    radii.forEach((R, k) => {
      if (R <= 0.5) return;
      const band = 14 + R * 0.09;
      for (const f of this.spots[k]!.fragments) {
        this.at(k, f.e, f.u * band, p);
        const sz = f.size * (1 - f.u * 0.55) * Math.min(1, 0.35 + R / 160);
        const ca = Math.cos(f.rot) * sz;
        const sa = Math.sin(f.rot) * sz;
        c.moveTo(p[0]! + ca, p[1]! + sa);
        c.lineTo(p[0]! - sa * 0.7, p[1]! + ca * 0.7);
        c.lineTo(p[0]! - ca, p[1]! - sa);
        c.lineTo(p[0]! + sa * 0.5, p[1]! - ca * 0.5);
        c.closePath();
        anyFragment = true;
      }
    });
    if (anyFragment) {
      c.clip();
      c.globalAlpha = coverAlpha;
      if (scene) c.drawImage(scene, 0, 0, w, h);
      else {
        c.fillStyle = 'rgb(120,128,150)';
        c.fillRect(0, 0, w, h);
      }
    }
    c.restore();

    // 4. The burning edge: a thick white glow, fibres and sparkles (additive).
    c.globalCompositeOperation = 'lighter';
    radii.forEach((R, k) => {
      if (R <= 0.5) return;
      // only the part of this edge outside the other holes: where fronts merge, the edge is gone
      // (one clip per other hole: successive clips intersect, so overlaps stay excluded)
      c.save();
      radii.forEach((Rj, j) => {
        if (j === k || Rj <= 0.5) return;
        c.beginPath();
        c.rect(0, 0, w, h);
        this.edgePath(j);
        c.clip('evenodd');
      });
      const t = this.spotT(k, open);
      const burn = smooth(clamp01(t / 0.02)) * coverAlpha;
      const thin = Math.min(1, R / 160);
      // the spark that starts each spot
      const spark = smooth(clamp01(t / 0.02)) * (1 - smooth(clamp01((t - 0.03) / 0.18)));
      if (spark > 0.01) {
        const spot = SPOTS[k]!;
        const sx = spot.x * w;
        const sy = spot.y * h;
        const r = 24 + R * 1.6;
        const g = c.createRadialGradient(sx, sy, 0, sx, sy, r);
        g.addColorStop(0, 'rgba(255,255,255,0.95)');
        g.addColorStop(0.3, 'rgba(255,240,215,0.5)');
        g.addColorStop(1, 'rgba(255,220,180,0)');
        c.globalAlpha = spark * coverAlpha;
        c.fillStyle = g;
        c.fillRect(sx - r, sy - r, r * 2, r * 2);
      }
      const glow: readonly [number, string][] = [
        [44, 'rgba(255,232,200,0.07)'],
        [20, 'rgba(255,238,215,0.16)'],
        [8, 'rgba(255,246,232,0.38)'],
        [2.2, 'rgba(255,252,246,0.9)'],
      ];
      c.beginPath();
      this.edgePath(k);
      for (const [lw, col] of glow) {
        c.globalAlpha = burn;
        c.strokeStyle = col;
        c.lineWidth = lw * (0.35 + 0.65 * thin);
        c.stroke();
      }
      // fibres: short bright strands frayed outward from the edge
      for (const bright of [false, true]) {
        c.beginPath();
        for (const f of this.spots[k]!.fibres) {
          if (f.bright !== bright) continue;
          this.at(k, f.e, -1.5, p);
          const len = f.len * (0.35 + 0.65 * thin);
          const ct = Math.cos(f.tilt);
          const st = Math.sin(f.tilt);
          const dx = p[2]! * ct - p[3]! * st;
          const dy = p[2]! * st + p[3]! * ct;
          c.moveTo(p[0]!, p[1]!);
          c.lineTo(p[0]! + dx * len, p[1]! + dy * len);
        }
        c.globalAlpha = burn * (bright ? 0.85 : 0.4);
        c.strokeStyle = 'rgb(255,248,236)';
        c.lineWidth = bright ? 1.2 : 0.8;
        c.stroke();
      }
      for (const g of this.spots[k]!.glints) {
        const tw = 0.5 + 0.5 * Math.sin(time * 3.3 + g.phase);
        const a = burn * (0.25 + 0.75 * tw * tw);
        if (a < 0.04) continue;
        this.at(k, g.e, g.off * (0.4 + 0.6 * thin), p2);
        const size = g.size * (0.5 + 0.5 * tw) * (0.5 + 0.5 * thin);
        c.globalAlpha = Math.min(1, a);
        c.drawImage(this.dot, p2[0]! - size / 2, p2[1]! - size / 2, size, size);
      }
      c.restore();
    });
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }

  /** The loading ring: tilted 3D ring of shards and sparkles. */
  private drawRing(s: RingState, time: number, R: number, cx: number, cy: number, fade: number) {
    const c = this.ctx;
    const assemble = clamp01(s.assemble);
    const scale = R / 300;
    const tilt = this.w < this.h ? 0.5 : 0.95;
    const ct = Math.cos(tilt);
    const st = Math.sin(tilt);
    const spin = time * 0.045 + 0.6;
    const roll = -0.38;
    const cr = Math.cos(roll);
    const sr = Math.sin(roll);
    const focal = R * 3.2;

    // soft halo (one gradient)
    c.globalCompositeOperation = 'lighter';
    {
      const glow = (0.25 + 0.75 * assemble) * fade;
      const g = c.createRadialGradient(cx, cy, R * 0.72, cx, cy, R * 1.22);
      g.addColorStop(0, 'rgba(255,240,220,0)');
      g.addColorStop(0.5, `rgba(255,236,210,${(0.028 * glow).toFixed(4)})`);
      g.addColorStop(1, 'rgba(255,240,220,0)');
      c.save();
      c.translate(cx, cy);
      c.rotate(roll);
      c.scale(1, ct * 0.65 + 0.35);
      c.translate(-cx, -cy);
      c.globalAlpha = 1;
      c.fillStyle = g;
      c.fillRect(cx - R * 1.3, cy - R * 1.3, R * 2.6, R * 2.6);
      c.restore();
    }

    const project = (theta: number, dr: number, dz: number, out: number[]) => {
      const a = theta + spin;
      const rr = R * (1 + dr);
      const x = Math.cos(a) * rr;
      const y0 = Math.sin(a) * rr;
      const z0 = dz * R;
      const y = y0 * ct - z0 * st;
      const z = y0 * st + z0 * ct;
      const k = focal / (focal + z);
      const px = x * k;
      const py = y * k;
      out[0] = cx + px * cr - py * sr;
      out[1] = cy + px * sr + py * cr;
      out[2] = k;
      out[3] = z / R;
    };
    const tmp = [0, 0, 0, 0];
    const { verts, alpha } = this;
    for (let i = 0; i < this.shards.length; i += 1) {
      const sh = this.shards[i]!;
      const arrive = easeOut(clamp01((assemble - sh.at) / 0.12));
      if (arrive <= 0.002) {
        alpha[i] = 0;
        continue;
      }
      project(sh.theta, sh.dr, sh.dz, tmp);
      let x = tmp[0]!;
      let y = tmp[1]!;
      const k = tmp[2]!;
      const front = 0.5 - tmp[3]! * 0.5;
      if (arrive < 1) {
        const fx = cx + Math.cos(sh.fromA + spin) * R * sh.fromR;
        const fy = cy + Math.sin(sh.fromA + spin) * R * sh.fromR * 0.7;
        x = fx + (x - fx) * arrive;
        y = fy + (y - fy) * arrive;
      }
      // the ring runs round its tangent; the tilt flattens the vertical component
      const a = sh.theta + spin;
      const tang =
        Math.atan2(
          Math.cos(a) * ct * cr + -Math.sin(a) * sr,
          -Math.sin(a) * cr - Math.cos(a) * ct * sr,
        ) + sh.rot;
      const L = sh.len * scale * k;
      const W = sh.wid * scale * k;
      const ux = Math.cos(tang);
      const uy = Math.sin(tang);
      const o = i * 6;
      verts[o] = x - ux * L * 0.5;
      verts[o + 1] = y - uy * L * 0.5;
      verts[o + 2] = x + ux * L * 0.5;
      verts[o + 3] = y + uy * L * 0.5;
      verts[o + 4] = x - uy * W;
      verts[o + 5] = y + ux * W;
      const shimmer = 0.75 + 0.25 * Math.sin(time * 1.3 + sh.phase);
      alpha[i] = arrive * (0.35 + 0.65 * front) * shimmer * fade;
    }
    // one pass per colour, two brightness steps (back of the ring dimmer)
    for (let col = 0; col < PALETTE.length; col += 1) {
      const [r, g, b] = PALETTE[col]!;
      const ids = this.byColour[col]!;
      c.globalCompositeOperation = col === 0 ? 'lighter' : 'source-over';
      for (const hi of [false, true]) {
        c.beginPath();
        let any = false;
        let sum = 0;
        let n = 0;
        for (const i of ids) {
          const av = alpha[i]!;
          if (av <= 0.02 || av > 0.55 !== hi) continue;
          const o = i * 6;
          c.moveTo(verts[o]!, verts[o + 1]!);
          c.lineTo(verts[o + 2]!, verts[o + 3]!);
          c.lineTo(verts[o + 4]!, verts[o + 5]!);
          sum += av;
          n += 1;
          any = true;
        }
        if (!any) continue;
        c.globalAlpha = Math.min(1, sum / n);
        c.fillStyle = `rgb(${r},${g},${b})`;
        c.fill();
      }
    }

    // sparkles (additive)
    c.globalCompositeOperation = 'lighter';
    for (const sp of this.sparks) {
      const arrive = clamp01((assemble - sp.at) / 0.1);
      if (arrive <= 0) continue;
      project(sp.theta, sp.dr, sp.dz, tmp);
      const front = 0.5 - tmp[3]! * 0.5;
      const tw = 0.5 + 0.5 * Math.sin(time * sp.speed + sp.phase);
      const a = arrive * (0.25 + 0.75 * tw * tw) * (0.4 + 0.6 * front) * fade;
      if (a < 0.02) continue;
      const size = sp.size * scale * tmp[2]! * (sp.star ? 2.4 : 1) * (0.7 + 0.3 * tw);
      c.globalAlpha = Math.min(1, a);
      c.drawImage(
        sp.star ? this.glint : this.dot,
        tmp[0]! - size / 2,
        tmp[1]! - size / 2,
        size,
        size,
      );
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }
}
