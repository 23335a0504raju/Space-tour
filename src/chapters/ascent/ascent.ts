import * as THREE from 'three';
import { EARTH as SC06_EARTH, OPENING as SC06_OPENING } from '../sunrise/sunrise.ts';
import type { ShotState } from '../../engine/camera/shots.ts';
import type { AspectClass } from '../types.ts';
import { HELVELA } from '../ship/helvelaDimensions.ts';

/**
 * SC05 Ignition & Ascent: story maths for the HelVela II's VTOL departure (the hero ship chosen by
 * Raju, 2026-11-17). Every value is a pure function of story time t (reverse scrolling is exact)
 * and this module has no React, so it is unit-tested in node (ascent.test.ts).
 *
 * World units are metres. The ship's local frame: origin on the keel at the hull centre, bow toward
 * -x. The climb is compressed to stay inside the camera's 2 km far plane: cloud deck ~360–520 m,
 * ship to ~1.15 km by the end.
 */
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => x * x * (3 - 2 * x);
export const span = (t: number, a: number, b: number) => smooth(clamp01((t - a) / (b - a)));

// ── Story beats ─────────────────────────────────────────────────────────────────
export const BEATS = {
  /** crew access arm swings away from the hull */
  arm: [0.06, 0.15],
  /** engines and lift jets spool up */
  ignition: [0.1, 0.22],
  /** cradle clamps retract */
  clamps: [0.2, 0.25],
  liftoff: 0.25,
  /** vertical lift ends in a hover; the nose pitches up and the climb begins */
  hover: 0.38,
  /** onboard deck camera, through the cloud deck */
  onboard: [0.6, 0.8],
} as const;

/** Pad layout shared by the scene and the maths. */
export const PAD = {
  /** keel height on the cradles */
  mountY: 3,
  /** launch tower beside the ship (-z side); the crew arm reaches across to the hull */
  tower: { x: -6, z: -17, half: 1.6, height: 26 },
  hoverAlt: 28,
} as const;

export const CLOUDS = { bottom: 360, top: 520 } as const;
const MAX_ALT = 1150;
const FORWARD = 650;

/**
 * Orbit insertion (handoff.ts, SC05 → SC06): over the last stretch the ship levels off, the main
 * engine cuts, and the camera settles into SC06's opening shot. SC06 flies toward -z, this chapter
 * toward -x: a travel-frame offset (x, y, z) is (z, y, -x) here.
 */
export const toOrbit = (t: number) => span(t, 0.88, 0.98);
const fromTravel = (v: readonly [number, number, number]) => [v[2], v[1], -v[0]] as const;
/** SC06's opening camera and Earth, relative to its ship (at its origin), in this frame. */
export const ORBIT_CAMERA = {
  position: fromTravel(SC06_OPENING.position),
  target: fromTravel(SC06_OPENING.target),
  fov: SC06_OPENING.fov,
} as const;
export const ORBIT_EARTH_FROM_SHIP = fromTravel(SC06_EARTH.centre);

/** Climb progress 0..1 after the hover. */
const climb = (t: number) => clamp01((t - BEATS.hover) / (1 - BEATS.hover));

/** Altitude of the keel above the cradles (m): a vertical lift to the hover, then the climb. */
export function altitude(t: number): number {
  const lift = PAD.hoverAlt * span(t, BEATS.liftoff, BEATS.hover + 0.02);
  return lift + (MAX_ALT - PAD.hoverAlt) * Math.pow(climb(t), 1.8);
}

/** Distance flown forward (toward -x) after the hover (m). */
export const forward = (t: number) => FORWARD * Math.pow(climb(t), 1.6);

/** Nose-up pitch (rad): follows the flight path once the climb starts. */
export function pitch(t: number): number {
  const dt = 0.002;
  const dy = altitude(t + dt) - altitude(t - dt);
  const dx = forward(t + dt) - forward(t - dt);
  // capped at ~31°: an aircraft-like climb (the flight path itself is steeper)
  const path = Math.min(0.55, Math.atan2(dy, Math.max(dx, 1e-6)));
  return path * span(t, BEATS.hover, BEATS.hover + 0.12) * (1 - toOrbit(t));
}

/** Ship pose: keel-centre position and the rotation about z (negative pitch lifts the -x bow). */
export function shipPose(t: number, out: THREE.Vector3): number {
  out.set(-forward(t), PAD.mountY + altitude(t), 0);
  return -pitch(t);
}

/** Main-engine intensity 0..1; the lift jets fade out once the climb is established. */
export const engine = (t: number) =>
  (0.6 * span(t, BEATS.ignition[0], BEATS.ignition[1]) + 0.4 * span(t, 0.2, BEATS.liftoff)) *
  (1 - span(t, 0.88, 0.97));
export const liftJets = (t: number) => engine(t) * (1 - span(t, BEATS.hover + 0.04, 0.55));

/** 0 at sea level → 1 high up: plume expansion, sky darkening, star visibility. */
export const thinAir = (t: number) => clamp01(altitude(t) / MAX_ALT);

export const armSwing = (t: number) => span(t, BEATS.arm[0], BEATS.arm[1]);
export const clampsOpen = (t: number) => span(t, BEATS.clamps[0], BEATS.clamps[1]);

/**
 * The curved Earth at the top of the climb (review 2026-11-21: the flat ground read as a plane). A
 * camera-centred planet, radius 1500 m with its surface 100 m under the camera (inside the 2 km far
 * plane; the limb dips ~20°), fades in over the flat ground and cloud deck, which fade out. It hands
 * over to SC06's low-orbit Earth: night side, city lights, a thin limb glowing ahead.
 */
export const ORBIT_EARTH = { radius: 1500, height: 100 } as const;
/** Limb dip below level (rad) seen from the camera once the planet is in. */
export const ORBIT_DIP = Math.acos(ORBIT_EARTH.radius / (ORBIT_EARTH.radius + ORBIT_EARTH.height));
/** 0 → 1 as the planet replaces the flat ground and deck. */
export const orbitEarth = (t: number) => span(t, 0.8, 0.9);

/** How strongly the jets light the ground and the smoke (falls off as the ship climbs). */
export const groundGlow = (t: number) =>
  Math.max(engine(t) * 0.5, liftJets(t)) * Math.exp(-altitude(t) / 90);

// ── Ship-local → world ─────────────────────────────────────────────────────────
const pose = new THREE.Vector3();
/** Transform a point in the ship's local frame to world space at story time t. */
export function shipToWorld(t: number, local: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
  const rz = shipPose(t, pose);
  const c = Math.cos(rz);
  const s = Math.sin(rz);
  return out.set(pose.x + local.x * c - local.y * s, pose.y + local.x * s + local.y * c, local.z);
}

// ── Camera ──────────────────────────────────────────────────────────────────────
const REDUCED_MOTION =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Light camera shake, a pure function of t. Off with reduced motion (FINAL_STORYLINE SC05). */
function shake(t: number, out: THREE.Vector3, reduced: boolean): THREE.Vector3 {
  if (reduced) return out.set(0, 0, 0);
  const pad = Math.max(engine(t), liftJets(t)) * Math.exp(-altitude(t) / 60);
  const onboard = span(t, 0.6, 0.62) * (1 - span(t, 0.78, 0.8));
  const a = 0.12 * pad + 0.03 * onboard;
  return out.set(
    a * (Math.sin(t * 731) + 0.5 * Math.sin(t * 1297 + 1.7)),
    a * (Math.sin(t * 913 + 0.4) + 0.5 * Math.sin(t * 1531 + 2.9)),
    a * Math.sin(t * 1069 + 0.9),
  );
}

const ship = new THREE.Vector3();
const p = new THREE.Vector3();
const q = new THREE.Vector3();
const tgtA = new THREE.Vector3();
const tgtB = new THREE.Vector3();
const local = new THREE.Vector3();
const jitter = new THREE.Vector3();

/**
 * The storyline shots (hard cuts into and out of the onboard shot, exactly reversible):
 *  A  wide side view of the pad (tower behind the ship), slow push in, tilting up with the lift;
 *  B  tracking alongside the climbing ship;
 *  C  deck camera on the dorsal hull looking forward past the bow as the cloud deck rushes in;
 *  D  above and behind, looking down the ship as it climbs out of the deck; at the end the view
 *     lifts to the horizon ahead: black sky over a thin glowing line (handover to SC06's limb).
 */
/** Portrait pulls the exterior shots back along their view line so the 60 m hull fits the narrow frame. */
const PORTRAIT_PULL = 2.2;

export { REDUCED_MOTION };

export function ascentShot(
  t: number,
  out: ShotState,
  reduced = REDUCED_MOTION,
  aspect: AspectClass = 'landscape',
): void {
  shipPose(t, ship);
  if (t < BEATS.onboard[0]) {
    const push = span(t, 0, 0.3);
    p.set(22 - 6 * push, 22 - 4 * push, 84 - 16 * push);
    tgtA.set(-2, 6 + Math.min(altitude(t), 34) * 0.85, 0);
    // B: alongside and slightly behind, rising with the ship
    const rise = span(t, 0.42, 0.6);
    q.set(ship.x + 30 - 6 * rise, Math.max(4, ship.y + 2 + 8 * rise), 46 - 6 * rise);
    tgtB.set(ship.x - 12, ship.y + 4, 0);
    const w = span(t, 0.33, 0.45);
    out.position.copy(p).lerp(q, w);
    out.target.copy(tgtA).lerp(tgtB, w);
    out.fov = 32 + 12 * w;
  } else if (t < BEATS.onboard[1]) {
    // C: deck camera above the dorsal hull, aft of the bridge, looking forward and up the climb
    const k = span(t, BEATS.onboard[0], BEATS.onboard[1]);
    shipToWorld(t, local.set(14, HELVELA.height + 2.6, 1.2), out.position);
    shipToWorld(t, local.set(-60, HELVELA.height + 6 + 6 * k, -2), out.target);
    out.fov = 60;
  } else {
    const k = span(t, BEATS.onboard[1], 1);
    out.position.set(ship.x + 46 - 8 * k, ship.y + 38 + 6 * k, 40 - 6 * k);
    const lift = span(t, 0.88, 0.99);
    tgtA.set(ship.x - 6, ship.y + 2, 0);
    tgtB.set(out.position.x - 460, ship.y - 30, out.position.z - 140);
    out.target.copy(tgtA).lerp(tgtB, lift);
    out.fov = 46 + 6 * lift;
  }
  // orbit insertion: SC06's opening shot, relative to the ship (exact at t = 1)
  const w = toOrbit(t);
  if (w > 0) {
    p.set(
      ship.x + ORBIT_CAMERA.position[0],
      ship.y + ORBIT_CAMERA.position[1],
      ORBIT_CAMERA.position[2],
    );
    q.set(ship.x + ORBIT_CAMERA.target[0], ship.y + ORBIT_CAMERA.target[1], ORBIT_CAMERA.target[2]);
    out.position.lerp(p, w);
    out.target.lerp(q, w);
    out.fov += (ORBIT_CAMERA.fov - out.fov) * w;
  }
  if (aspect === 'portrait') {
    // exterior shots only; the onboard deck camera keeps its place on the hull (hard cuts either side)
    const pull = t >= BEATS.onboard[0] && t < BEATS.onboard[1] ? 1 : PORTRAIT_PULL;
    out.position.sub(out.target).multiplyScalar(pull).add(out.target);
  }
  out.position.add(shake(t, jitter, reduced));
}
