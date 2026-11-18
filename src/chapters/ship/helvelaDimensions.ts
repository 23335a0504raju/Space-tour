/**
 * HelVela II dimensions (no React/three imports, so story maths and tests can use them).
 * Measured from public/assets/models/helvela.glb (native units): x -105.12…136.94 (bow at -x),
 * y -3.02…22.33, z -52.61…-1.91. Scaled so the hull is 60 m long.
 */
const NATIVE_LENGTH = 136.94 - -105.12;
const LENGTH = 60;
const S = LENGTH / NATIVE_LENGTH;

export const HELVELA = {
  scale: S,
  nativeCentre: [(136.94 + -105.12) / 2, 0, (-1.91 + -52.61) / 2] as const,
  nativeBottom: -3.02,
  /** World size (m) in the local frame: origin on the keel at the hull's centre, bow toward -x. */
  length: LENGTH,
  height: (22.33 - -3.02) * S,
  width: (-1.91 - -52.61) * S,
  /** Stern thruster exits (x, y, z) in the local frame; exhaust points +x. */
  mainEngines: [
    [(136.5 - 15.91) * S, (9 + 3.02) * S, (-14 + 27.26) * S],
    [(136.5 - 15.91) * S, (9 + 3.02) * S, (-37 + 27.26) * S],
  ] as const,
  /** Belly lift-jet positions for the VTOL departure (local frame); exhaust points -y. */
  liftJets: [
    [-16, 0.4, 2.6],
    [-16, 0.4, -2.6],
    [14, 0.4, 2.6],
    [14, 0.4, -2.6],
  ] as const,
} as const;
