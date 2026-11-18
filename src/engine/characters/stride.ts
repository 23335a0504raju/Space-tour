/**
 * Measures the ground speed implied by an in-place walk clip, so scroll-driven movement can be
 * matched to the animation and feet do not slide (TECHNICAL_BLUEPRINT.md §6).
 *
 * Idea: while a foot is planted, it moves backwards relative to the body at exactly the speed
 * the body should move forwards. Sample the clip, keep samples where a foot is near its lowest
 * height, and take the median horizontal velocity of those samples.
 */
export interface FootSample {
  /** Clip time in seconds. */
  readonly t: number;
  /** Foot height (model space). */
  readonly y: number;
  /** Foot position along the walking axis (model space). */
  readonly h: number;
}

export interface WalkMeasurement {
  /** Metres per second of ground travel implied by the clip. */
  readonly speed: number;
  /** +1 if the body moves towards +h, -1 if towards -h. */
  readonly direction: 1 | -1;
  /** Number of planted velocity samples used. */
  readonly samples: number;
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? (s[mid] ?? 0) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2;
};

/**
 * @param feet one sample series per foot, each ordered by time over one clip cycle
 * @param plantedFraction samples within this fraction of the foot's height range above its
 *   lowest point count as planted
 */
export function measureWalk(
  feet: readonly (readonly FootSample[])[],
  plantedFraction = 0.12,
): WalkMeasurement {
  const velocities: number[] = [];
  for (const series of feet) {
    if (series.length < 3) continue;
    const ys = series.map((s) => s.y);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const threshold = minY + (maxY - minY) * plantedFraction;
    for (let i = 1; i < series.length; i += 1) {
      const a = series[i - 1];
      const b = series[i];
      if (!a || !b || a.y > threshold || b.y > threshold) continue;
      const dt = b.t - a.t;
      if (dt > 0) velocities.push((b.h - a.h) / dt);
    }
  }
  if (velocities.length === 0) return { speed: 0, direction: 1, samples: 0 };
  const v = median(velocities);
  // The planted foot moves opposite to the body.
  return { speed: Math.abs(v), direction: v <= 0 ? 1 : -1, samples: velocities.length };
}
