import { createShotState, sampleKeys } from '../../engine/camera/shots.ts';
import type { ShotKey, ShotState } from '../../engine/camera/shots.ts';
import { CHASE_06_07, blendShot, chaseShot } from '../handoff.ts';

/**
 * SC06 Orbital Sunrise story maths (no React/three, unit-tested). Everything is a pure function of
 * story time t, so reverse scrolling is exact.
 *
 * Composition (low orbit, not a globe portrait): a huge Earth curves across the lower frame with its
 * night side and city lights under the ship; the Sun climbs over the far limb straight ahead (east),
 * the limb turns from blue to gold, then sunlight floods the hull. The ship sits at the origin, bow -z.
 * Earth is kept inside the 2 km far plane: radius 900, about 100 m below the camera, so the visible
 * horizon is ~450 m away and dips ~26° below level.
 */
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
// (three only for the shot's scratch vector)
import * as THREE from 'three';
const ease = (x: number) => x * x * (3 - 2 * x);
export const span = (t: number, a: number, b: number) => ease(clamp01((t - a) / (b - a)));

export const EARTH = { radius: 900, centre: [0, -960, -200] as const } as const;
/** The Moon hangs up and left of the sunrise in the strengths rest frame, small and sharp. */
export const MOON = { radius: 30, position: [-252, 79, -1032] as const } as const;
export const SUN_DISTANCE = 1500;
/** Compass bearing of the sunrise: almost dead ahead (-z), a touch to the right. */
const SUN_AZIMUTH = 0.22;

/** Reference eye for the limb: the opening camera. Used to put the Sun relative to the horizon. */
const EYE = [10, 14, 66] as const;
const eyeToCentre = Math.hypot(
  EYE[0] - EARTH.centre[0],
  EYE[1] - EARTH.centre[1],
  EYE[2] - EARTH.centre[2],
);
/** How far the visible horizon sits below level, seen from the reference eye (rad). */
export const HORIZON_DIP = Math.acos(EARTH.radius / eyeToCentre);

/**
 * Sun elevation above the visible limb (rad): hidden behind the planet at first, it clears the limb
 * around t ≈ 0.2 and stands ~13° over it at the strengths rest point.
 */
export const sunAngle = (t: number) => -0.07 + span(t, 0.02, 0.62) * 0.32;

/** Local vertical at the reference eye (it is not world +y: the eye is not above Earth's centre). */
const UP = [
  (EYE[0] - EARTH.centre[0]) / eyeToCentre,
  (EYE[1] - EARTH.centre[1]) / eyeToCentre,
  (EYE[2] - EARTH.centre[2]) / eyeToCentre,
] as const;
/** Local level direction toward the sunrise bearing: the bearing with its vertical part removed. */
const FWD = (() => {
  const b = [Math.sin(SUN_AZIMUTH), 0, -Math.cos(SUN_AZIMUTH)];
  const k = b[0]! * UP[0] + b[1]! * UP[1] + b[2]! * UP[2];
  const f = [b[0]! - k * UP[0], b[1]! - k * UP[1], b[2]! - k * UP[2]];
  const l = Math.hypot(f[0]!, f[1]!, f[2]!);
  return [f[0]! / l, f[1]! / l, f[2]! / l] as const;
})();

/** Unit direction to the Sun (world), written into `out` (x,y,z): `sunAngle` above the visible limb. */
export function sunDirection(t: number, out: [number, number, number]): void {
  const e = sunAngle(t) - HORIZON_DIP;
  const c = Math.cos(e);
  const s = Math.sin(e);
  out[0] = FWD[0] * c + UP[0] * s;
  out[1] = FWD[1] * c + UP[1] * s;
  out[2] = FWD[2] * c + UP[2] * s;
}

/** Direct sunlight on the ship: earthshine-dark until the limb is cleared, then full. */
export const sunLight = (t: number) => 0.04 + 2.4 * span(t, 0.16, 0.42);

/**
 * Ship heading (rad about y): bow toward -z, the heading SC07 flies on. The departure is a burn
 * straight out (handoff.ts), so the ship is on SC07's line at the boundary.
 */
export const SHIP_YAW = -Math.PI / 2;
/** Main-engine level: the departure burn. */
export const engineLevel = (t: number) => span(t, 0.86, 0.94);
/** Where the burn starts and how far it carries the ship by the end of the chapter (m). */
export const BURN = { from: 0.86, distance: 140 } as const;
/** Ship position: a slow drift, then the departure burn (accelerating) down -z. */
export function shipZ(t: number): number {
  const k = clamp01((t - BURN.from) / (1 - BURN.from));
  return -t * 6 - k * k * BURN.distance;
}

/**
 * Earth's orientation: India (22°N 79°E) under the ship with east pointing ahead (-z), so the ship
 * flies into the sunrise. SphereGeometry: lon φ, colatitude θ → (-cosφ sinθ, cosθ, sinφ sinθ).
 * (Shared with SC05, whose orbit Earth turns into this one at the boundary.)
 */
export const EARTH_QUAT = (() => {
  const lat = THREE.MathUtils.degToRad(22);
  const lon = THREE.MathUtils.degToRad(79);
  const th = Math.PI / 2 - lat;
  const ph = lon + Math.PI;
  const up = new THREE.Vector3(
    -Math.cos(ph) * Math.sin(th),
    Math.cos(th),
    Math.sin(ph) * Math.sin(th),
  );
  const east = new THREE.Vector3(Math.sin(ph), 0, Math.cos(ph)).normalize();
  const north = new THREE.Vector3().crossVectors(up, east);
  const local = new THREE.Matrix4().makeBasis(east, north, up);
  // the point under the opening camera, a little ahead of it
  const U = new THREE.Vector3(0, 40, -60).sub(new THREE.Vector3(...EARTH.centre)).normalize();
  const E = new THREE.Vector3(0, 0, -1).projectOnPlane(U).normalize();
  const N = new THREE.Vector3().crossVectors(U, E);
  const world = new THREE.Matrix4().makeBasis(E, N, U);
  return new THREE.Quaternion().setFromRotationMatrix(world.multiply(local.transpose()));
})();

/** SC06's opening camera, exported for SC05's hand-over. */
export const OPENING = { position: EYE, target: [0, -150, -400], fov: 48 } as const;

const keys: ShotKey[] = [
  // behind and above the ship, looking along the hull at the dark limb: the sunrise is ahead
  { t: 0, position: [EYE[0], EYE[1], EYE[2]], target: [0, -150, -400], fov: 48 },
  // slow drift to the other quarter as the Sun breaks the limb
  { t: 0.35, position: [-28, 12, 74], target: [40, -140, -400], fov: 50 },
  // the strengths rest: the sunrise and the gold limb in the upper frame, the panel below
  { t: 0.7, position: [-42, 8, 96], target: [90, -120, -420], fov: 56 },
  // the ship turns outward and burns
  { t: 1, position: [-30, 12, 50], target: [-10, -20, -200], fov: 46 },
];

const ship = new THREE.Vector3();
const chase = createShotState();
export function sunriseShot(t: number, out: ShotState): void {
  sampleKeys(keys, t, out);
  // the departure: the camera drops in below-behind the ship as it burns away (SC07 opens here)
  const w = span(t, BURN.from, 0.97);
  if (w > 0) {
    chaseShot(ship.set(0, 0, shipZ(t)), CHASE_06_07, chase);
    blendShot(out, chase, w);
  }
}
