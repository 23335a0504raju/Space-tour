/**
 * Wheel pacing: pure maths for the scroll governor (unit-tested; the DOM wiring is in
 * usePacedWheel.ts). Each wheel event moves a *target* by the full wheel delta; the page follows
 * it with one exponential ease (the only smoothing layer: the story follows the page directly).
 * A hard flick or trackpad momentum still travels about one chapter, never the whole story: the
 * target may not run far ahead of the page, and a fling's budget runs out.
 *
 * 2026-11-22 (scroll fix): the ease matches the reference site (Shopify Editions, Lenis): one wheel
 * notch is half done in ~0.1 s and 90 % done in ~0.33 s. The hard speed cap is gone: it made
 * flings travel at a constant speed and stop abruptly. Speed is now bounded smoothly by
 * maxLead × ease, about 2.7 screens per second at most.
 *
 * Distances are fractions of the viewport height (vh), so the feel is the same on any screen.
 * History: v1 kept 55 % of each notch and dropped the rest after 120 ms of silence, which made one
 * 100 px notch move 32 px and Projects 350 notches away (UI_SCROLL_AUDIT.md, step 0).
 */
export const PACING = {
  /** Largest target change one wheel event can make (vh). A mouse notch (~100 px) passes whole. */
  maxStep: 0.3,
  /** Fraction of the remaining gap closed per 60 fps frame (~50 % in 0.1 s, ~90 % in 0.33 s). */
  ease: 0.11,
  /** Furthest the target may run ahead of the page (vh). Input beyond it is discarded, never queued. */
  maxLead: 0.45,
  /** Wheel silence (ms) that ends a continuous input stream (a fling and its momentum). */
  streamGapMs: 150,
  /**
   * Travel (vh) one stream may make while it outruns the page (lead saturated). Only flings
   * saturate the lead; a steady wheel or a slow trackpad drag never does, so they are never cut.
   * With the lead it can still drain, a fling ends after about one chapter (1.5–2 screens).
   */
  burstBudget: 1.3,
} as const;

/** Per-stream fling budget (mutable, owned by the wheel hook). */
export interface Burst {
  lastEvent: number;
  /** px travelled in this stream while the lead was saturated */
  spent: number;
}

export const createBurst = (): Burst => ({ lastEvent: -Infinity, spent: 0 });

/** Should this wheel event count? A pause starts a fresh stream; a spent stream is ignored. */
export function admitWheel(b: Burst, now: number, viewportH: number): boolean {
  if (now - b.lastEvent > PACING.streamGapMs) b.spent = 0;
  b.lastEvent = now;
  return b.spent < PACING.burstBudget * viewportH;
}

/** Charge one frame's travel to the stream when the target is (nearly) at the lead cap. */
export function chargeBurst(b: Burst, moved: number, lead: number, viewportH: number): void {
  if (Math.abs(lead) >= 0.9 * PACING.maxLead * viewportH) b.spent += Math.abs(moved);
}

/** Keep the target within `maxLead` of where the page really is. */
export function clampLead(current: number, target: number, viewportH: number): number {
  const lead = PACING.maxLead * viewportH;
  return Math.max(current - lead, Math.min(current + lead, target));
}

/** Normalise a wheel event's delta to pixels (line/page modes) and clamp it. */
export function wheelStep(deltaY: number, deltaMode: number, viewportH: number): number {
  const px = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * viewportH : deltaY;
  const cap = PACING.maxStep * viewportH;
  return Math.max(-cap, Math.min(cap, px));
}

/** One follower step toward `target`; `ratio` = frame time / (1/60 s). Frame-rate independent. */
export function follow(current: number, target: number, ratio: number): number {
  const gap = target - current;
  if (Math.abs(gap) < 0.25) return target;
  return current + gap * (1 - Math.pow(1 - PACING.ease, ratio));
}
