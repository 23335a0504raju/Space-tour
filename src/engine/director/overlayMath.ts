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
