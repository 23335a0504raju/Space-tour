/**
 * The painted clouds and sun that SC10 emerges into, shared with SC11-A so the two chapters join
 * without a cut. Positions are in SC10's frame (ship ends at z = -220).
 */
function seeded(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export const PAINTED_CLOUDS = (() => {
  const rand = seeded(23);
  return Array.from({ length: 46 }, () => ({
    p: [(rand() - 0.5) * 140, -22 + rand() * 40, -215 - rand() * 150] as const,
    s: 5 + rand() * 11,
  }));
})();

/** The warm sun beyond the gate, in SC10's frame. */
export const SUN_BEYOND = [60, 55, -520] as const;
