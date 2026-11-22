import * as THREE from 'three';
import { LIGHT_10 } from '../handoff.ts';

/**
 * SC10's look back (Raju, 2026-11-22: "the solar system's final view before the black hole"; task 6:
 * Venus, Uranus and Neptune join the planets). At the quiet edge of the system the camera turns
 * round: the Sun, clearly visible, and all eight planets lie behind the ship along the ecliptic,
 * each lit from the Sun (so their phases and terminators are right). Pure data, unit-tested.
 *
 * Kept inside the camera's 2 km far plane: the Sun 1.65 km out, the planets 0.35–1.3 km, their
 * sizes raised a little so each reads as a disc.
 */

/** Direction to the Sun: SC10's key light comes from it, so the ship is lit by the Sun we see. */
export const SUN_DIR = new THREE.Vector3(...LIGHT_10.direction).normalize();
export const SUN_DISTANCE = 1650;
export const SUN_POSITION = SUN_DIR.clone().multiplyScalar(SUN_DISTANCE);
export const SUN_RADIUS = 24;

/** The ecliptic through the Sun's direction: a(0) points at the Sun, a(90°) to its side. */
const SIDE = new THREE.Vector3().crossVectors(SUN_DIR, new THREE.Vector3(0, 1, 0)).normalize();
const TILT = new THREE.Vector3().crossVectors(SIDE, SUN_DIR).normalize();
export function ecliptic(deg: number, out = new THREE.Vector3()): THREE.Vector3 {
  const a = THREE.MathUtils.degToRad(deg);
  return out.copy(SUN_DIR).multiplyScalar(Math.cos(a)).addScaledVector(SIDE, Math.sin(a));
}

export type PlanetKind =
  'mercury' | 'venus' | 'earth' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune';

export interface SolarPlanet {
  readonly kind: PlanetKind;
  /** angle along the ecliptic from the Sun's direction (deg), height above it (deg) */
  readonly along: number;
  readonly above: number;
  /** distance from the start of the chapter (m) and radius (m) */
  readonly distance: number;
  readonly radius: number;
}

/**
 * Spread round the Sun so each shows a clear phase: the inner planets near it as thin crescents,
 * the giants further round, half lit. In order out from the Sun's side of the frame.
 */
export const PLANETS: readonly SolarPlanet[] = [
  { kind: 'mercury', along: 16, above: 2, distance: 1250, radius: 9 },
  { kind: 'venus', along: 24, above: -1.5, distance: 1100, radius: 15 },
  { kind: 'earth', along: 32, above: 1.5, distance: 960, radius: 15 },
  { kind: 'mars', along: 39, above: -2, distance: 840, radius: 10 },
  { kind: 'jupiter', along: 49, above: 0.5, distance: 700, radius: 34 },
  { kind: 'saturn', along: 60, above: -2.5, distance: 580, radius: 26 },
  { kind: 'uranus', along: 70, above: 2, distance: 460, radius: 14 },
  { kind: 'neptune', along: 79, above: -1, distance: 370, radius: 13 },
];

export function planetPosition(p: SolarPlanet, out = new THREE.Vector3()): THREE.Vector3 {
  ecliptic(p.along, out).addScaledVector(TILT, Math.tan(THREE.MathUtils.degToRad(p.above)));
  return out.normalize().multiplyScalar(p.distance);
}

/** Unit direction from a planet to the Sun (its lighting). */
export function sunFrom(position: THREE.Vector3, out = new THREE.Vector3()): THREE.Vector3 {
  return out.copy(SUN_POSITION).sub(position).normalize();
}

/** Where the look-back camera aims: between the Sun (left of frame) and the outer planets. */
export const LOOK_BACK = ecliptic(42).multiplyScalar(300);

/**
 * Each planet's orbit: a circle round the Sun in the shared ecliptic plane. `segments` points, closed.
 */
export function orbitPoints(p: SolarPlanet, segments = 256): THREE.Vector3[] {
  const at = planetPosition(p);
  // one plane for every orbit (the ecliptic, normal TILT), as in the real system; each circle
  // passes through its planet's place projected onto it (the planets sit within 2.5° of it)
  const radial = at.clone().sub(SUN_POSITION).projectOnPlane(TILT);
  const r = radial.length();
  const u = radial.normalize();
  const v = new THREE.Vector3().crossVectors(TILT, u).normalize();
  const out: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    out.push(
      SUN_POSITION.clone()
        .addScaledVector(u, Math.cos(a) * r)
        .addScaledVector(v, Math.sin(a) * r),
    );
  }
  return out;
}
