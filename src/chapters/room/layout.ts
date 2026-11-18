/**
 * SC02/SC03 room layout in metres (no React, so motion maths can be unit-tested in node).
 * Origin = room centre on the floor; the window wall faces -z.
 *   x ∈ [-3.5, 3.5], z ∈ [-3.2, 3.0], height 2.8. Door on the +x wall centred at z = doorZ.
 */
export const ROOM = {
  halfW: 3.5,
  back: -3.2,
  front: 3,
  height: 2.8,
  doorZ: 1.4,
  /** Clear door opening (m). */
  doorW: 1.2,
  doorH: 2.25,
} as const;

/** Where the astronaut sits (body root on the floor) and where the chair stands at rest. */
export const SEAT: [number, number, number] = [0, 0, -1.6];
export const CHAIR_REST = { x: 0, z: -1.62, rotY: Math.PI } as const;
/** Chair footprint half-extents (Poly Haven modern_arm_chair_01, measured from the GLB). */
export const CHAIR_HALF = { x: 0.41, z: 0.49 } as const;

/**
 * The desk (Poly Haven metal_office_desk, top 0.787 m) is scaled to 0.85 in height: the Mixamo
 * typing pose puts the wrists at 0.70–0.76 m and the lowest fingertip at 0.705 m, so on the
 * full-height desk the hands sank 3–8 cm into it (user review, P4). Measured in
 * room/typing.test.ts.
 */
export const DESK = { scaleY: 0.85, top: 0.787 * 0.85, z: -2.4 } as const;
/**
 * Keyboard and mouse under the measured fingertips over the whole typing clip: the left hand
 * types at x ≈ -0.17…-0.14; the right hand types and periodically reaches out to x ≈ 0.33 (the
 * clip includes a mouse reach), z ≈ -2.12…-2.32.
 */
export const KEYBOARD = { x: -0.01, z: -2.22, size: [0.38, 0.014, 0.18] } as const;
export const MOUSE = { x: 0.31, z: -2.2, pad: [0.22, 0.003, 0.24] } as const;

/** The launch pad seen through the window (SC02 opening shot looks at it). */
export const WINDOW_PAD = {
  position: [0, 0, -85] as [number, number, number],
  rotationY: 0.18,
} as const;
