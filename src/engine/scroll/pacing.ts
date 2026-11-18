/**
 * Wheel pacing: pure maths for the scroll governor (unit-tested; the DOM wiring is in
 * usePacedWheel.ts). A fast flick or trackpad momentum used to carry the whole story in one
 * gesture. Each wheel event now only moves a *target*, clamped per event, and the page follows
 * it at a capped speed.
 */
export const PACING = {
  /** Fraction of the raw wheel delta that counts (a notch is ~100 px). */
  gain: 0.55,
  /** Largest target change one wheel event can make (px). */
  maxStep: 90,
  /** Fraction of the remaining gap closed per 60 fps frame. */
  ease: 0.1,
  /** Fastest the page may travel (px per 60 fps frame): about 1.1 screens per second. */
  maxSpeed: 18,
} as const;

/** Normalise a wheel event's delta to pixels (line/page modes) and clamp it. */
export function wheelStep(deltaY: number, deltaMode: number, viewportH: number): number {
  const px = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * viewportH : deltaY;
  const scaled = px * PACING.gain;
  return Math.max(-PACING.maxStep, Math.min(PACING.maxStep, scaled));
}

/** One follower step toward `target`; `ratio` = frame time / (1/60 s). */
export function follow(current: number, target: number, ratio: number): number {
  const gap = target - current;
  if (Math.abs(gap) < 0.25) return target;
  const want = gap * (1 - Math.pow(1 - PACING.ease, ratio));
  const cap = PACING.maxSpeed * ratio;
  return current + Math.max(-cap, Math.min(cap, want));
}
