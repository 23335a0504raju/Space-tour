/**
 * SC02/SC03 layout in metres (no React, so motion maths can be unit-tested in node). Room origin =
 * the floor under the centre of the old cabin; the desk faces -z. The set itself is the bridge
 * model (BRIDGE below); its deck is at y = 0.
 */

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

/**
 * The projector for Raju's hologram: right of the mouse pad, in front of the right monitor. The
 * figure turns toward whoever sits at SEAT.
 */
export const FACE_HOLOGRAM = { x: 0.64, z: -2.37 } as const;

/**
 * The launch-control bridge (Bridge.tsx, asset A036) placed around the desk. Its main deck lies at
 * y = 2.55 m in the model (measured by scripts/optimize-bridge.ts), so it is lowered by that much.
 * Unrotated: the desk sits in the south part of the deck facing north, so the hologram globe turns
 * 3.7 m ahead of the astronaut, beyond the monitors, and the camera has 1.8 m behind the chair
 * (between a low rail at z ≈ -0.4 and the south wall at z ≈ 0.7; the deck has a ceiling).
 * Room = model + (-0.2, -2.55, -5.3). Check any layout change with `node scripts/plan-view.ts`.
 */
export const BRIDGE = {
  position: [-0.2, -2.55, -5.3] as [number, number, number],
  rotationY: 0,
  scale: 1,
} as const;

/** Hologram globe (centre and radius, room metres) and the pit ring around it. */
export const HOLOGRAM = { centre: [0.04, 2.35, -5.35] as const, radius: 1.75 } as const;
export const PIT = { x: 0.04, z: -5.35, radius: 2.1 } as const;

/**
 * The lift in the north-west corner: SC03's walk ends in its doorway (east side), facing in, after
 * stepping down from the raised platform's north tip. `light` is inside the box (room metres).
 */
export const LIFT = {
  /** the doorway, on the box's east side (its other sides are walls) */
  x: -4.75,
  z: -8.8,
  y: 0,
  radius: 0.5,
  light: [-5.7, 2.0, -8.75] as const,
} as const;

/**
 * The raised platform on the west side (0.5 m above the deck, measured from the model): the only
 * way north to the lift. Stairs climb onto it westward at its south-east corner.
 */
export const PLATFORM = { height: 0.5 } as const;
