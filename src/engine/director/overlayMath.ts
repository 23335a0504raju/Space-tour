const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * Opacity of a text block anchored to a rest point, as a function of local scroll position.
 * Fully visible in a band around the rest point, ramping out at the edges, so text is only
 * readable while motion is slow (cinematic-ui skill). Pure, so it reverses exactly.
 *
 * @param holdToEnd keep the block visible from its rest point to the end of the chapter
 *   (used by the final contact panel so the page ends on it).
 */
export function restOpacity(
  localT: number,
  rest: number,
  {
    half = 0.12,
    // the ramp is where the staged reveal plays (kicker → heading → body → actions), so it scales
    // with the band: wide enough to read as a sequence, never eating the fully readable middle
    ramp = Math.min(0.08, half * 0.4),
    holdToEnd = false,
  } = {},
): number {
  if (holdToEnd && localT >= rest) return 1;
  const d = Math.abs(localT - rest);
  if (d >= half) return 0;
  if (d <= half - ramp) return 1;
  return (half - d) / ramp;
}

/** Seconds a card takes to make its entrance, and to leave. */
export const CARD_IN_S = 0.9;
export const CARD_OUT_S = 0.35;

/**
 * The card's visibility on screen, following the scroll's answer (`wanted`, 0 or 1) over a short
 * minimum time. Scrubbed straight from the scroll, the whole entrance fitted inside one wheel notch
 * and cards popped in (Raju, 2026-11-27). Where the page rests, the result is still decided by the
 * scroll position alone, in either direction; only the way there takes its own time.
 */
export function easeVisibility(shown: number, wanted: number, seconds: number): number {
  const span = wanted > shown ? CARD_IN_S : CARD_OUT_S;
  const step = Math.max(0, seconds) / span;
  return wanted > shown ? Math.min(wanted, shown + step) : Math.max(wanted, shown - step);
}

/**
 * Dip-to-colour at chapter boundaries, masking grey-box hard cuts. 1 = fully covered.
 * No dip at the very start or very end of the journey, nor across a seamless boundary.
 */
export function boundaryDip(
  localT: number,
  skipStart: boolean,
  skipEnd: boolean,
  width = 0.035,
): number {
  const intoChapter = skipStart ? 0 : clamp01(1 - localT / width);
  const outOfChapter = skipEnd ? 0 : clamp01(1 - (1 - localT) / width);
  // eased, so the cut breathes in and out instead of switching on a linear ramp
  return smooth(Math.max(intoChapter, outOfChapter));
}

const smooth = (x: number) => x * x * (3 - 2 * x);
