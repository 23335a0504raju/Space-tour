import type { AspectClass, ChapterMeta } from '../../chapters/types.ts';

/** Scroll-length multipliers per aspect class (SCROLL_EXPERIENCE_MAP.md: mobile ~10% shorter). */
export const ASPECT_SCALE: Record<AspectClass, number> = {
  portrait: 0.9,
  landscape: 1,
  ultrawide: 1,
};

export function classifyAspect(width: number, height: number): AspectClass {
  const ratio = width / Math.max(height, 1);
  if (ratio < 0.8) return 'portrait';
  if (ratio > 2) return 'ultrawide';
  return 'landscape';
}

export interface TrackSegment {
  readonly id: string;
  readonly index: number;
  /** Master progress where the chapter starts / ends, in [0, 1]. */
  readonly start: number;
  readonly end: number;
  readonly screens: number;
}

export interface Track {
  readonly segments: readonly TrackSegment[];
  readonly totalScreens: number;
}

export function buildTrack(chapters: readonly ChapterMeta[], aspect: AspectClass): Track {
  if (chapters.length === 0) throw new Error('buildTrack: no chapters');
  const scale = ASPECT_SCALE[aspect];
  const lengths = chapters.map((c) => {
    if (!(c.screens > 0)) throw new Error(`buildTrack: chapter ${c.id} has no length`);
    return c.screens * scale;
  });
  const totalScreens = lengths.reduce((a, b) => a + b, 0);
  let cursor = 0;
  const segments = chapters.map((c, index) => {
    const screens = lengths[index] ?? 0;
    const start = cursor / totalScreens;
    cursor += screens;
    const end = index === chapters.length - 1 ? 1 : cursor / totalScreens;
    return { id: c.id, index, start, end, screens };
  });
  return { segments, totalScreens };
}

export interface Resolved {
  readonly index: number;
  readonly id: string;
  /** Progress within the chapter, in [0, 1]. */
  readonly localT: number;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * Master progress → (chapter, local t). Pure and stateless, so the result never
 * depends on scroll direction or history (the reverse-scroll guarantee).
 * A progress value exactly on a boundary belongs to the later chapter.
 */
export function resolve(track: Track, progress: number): Resolved {
  const p = clamp01(Number.isFinite(progress) ? progress : 0);
  const { segments } = track;
  let lo = 0;
  let hi = segments.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    const seg = segments[mid];
    if (seg && seg.start <= p) lo = mid;
    else hi = mid - 1;
  }
  const seg = segments[lo];
  if (!seg) throw new Error('resolve: empty track');
  const span = seg.end - seg.start;
  return { index: seg.index, id: seg.id, localT: span > 0 ? clamp01((p - seg.start) / span) : 0 };
}

/** Inverse of resolve: master progress for a chapter's local t (chapter jumps). */
export function progressFor(track: Track, id: string, localT = 0): number {
  const seg = track.segments.find((s) => s.id === id);
  if (!seg) throw new Error(`progressFor: unknown chapter ${id}`);
  return seg.start + (seg.end - seg.start) * clamp01(localT);
}

export interface DwellOptions {
  /** Width of each dwell band, in local scroll units. */
  readonly width: number;
  /** Fraction of the band's width that time advances while inside it (0 = frozen, 1 = no dwell). */
  readonly flatness: number;
}

/**
 * Remaps local scroll s → local time t so time nearly stops around each rest point
 * while scrolling continues (dwell zones without scroll locking).
 * Piecewise linear, monotonic, and fixes 0 → 0 and 1 → 1.
 */
export function dwell(
  s: number,
  restPoints: readonly number[],
  // narrower and less frozen than v1 (0.2 / 0.15), which held the picture still while the visitor
  // kept scrolling (UI_SCROLL_AUDIT.md S5)
  { width, flatness }: DwellOptions = { width: 0.16, flatness: 0.25 },
): number {
  const x = clamp01(s);
  const knots: Array<[number, number]> = [[0, 0]];
  const half = width / 2;
  for (const r of [...restPoints].sort((a, b) => a - b)) {
    const [prevS] = knots[knots.length - 1] ?? [0, 0];
    const a = Math.max(r - half, prevS);
    const b = Math.min(r + half, 1);
    if (b <= a) continue;
    const timeHalf = half * flatness;
    knots.push([a, Math.max(r - timeHalf, 0)], [b, Math.min(r + timeHalf, 1)]);
  }
  knots.push([1, 1]);

  for (let i = 1; i < knots.length; i += 1) {
    const [s0, t0] = knots[i - 1] ?? [0, 0];
    const [s1, t1] = knots[i] ?? [1, 1];
    if (x <= s1) {
      if (s1 === s0) return t1;
      return t0 + ((x - s0) / (s1 - s0)) * (t1 - t0);
    }
  }
  return 1;
}
