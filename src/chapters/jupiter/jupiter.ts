import * as THREE from 'three';
import { createShotState, sampleKeys } from '../../engine/camera/shots.ts';
import type { ShotKey, ShotState } from '../../engine/camera/shots.ts';
import type { AspectClass } from '../types.ts';
import {
  CHASE_07_08,
  CHASE_08_09,
  LIGHT_07,
  blendShot,
  carry,
  chaseShot,
  run,
  smooth,
} from '../handoff.ts';
import type { Vec3 } from '../handoff.ts';
import { SHIP_START as SATURN_SHIP_START } from '../saturn/saturn.ts';

/**
 * SC08 Jupiter story data (no React; unit-tested). The three installations hold still in the
 * chapter's local frame; the camera visits each at the rest points 0.25 / 0.5 / 0.75 (the overlay
 * panel sits on the opposite side of the frame from the station: right, left, right).
 */
export const JUPITER = { radius: 230, position: [170, -190, -400] as const } as const;
/** The Sun as SC07 has it, so Jupiter is lit the same on both sides of the boundary. */
export const SUN = LIGHT_07.direction;

/**
 * The ship (handoff.ts): it arrives from the belt behind the chase camera, slows and parks out of
 * shot while the camera visits the installations, then leaves for Saturn, which waits ahead.
 */
export const SHIP_START: Vec3 = [0, 0, 1000];
export const SHIP_PARK: Vec3 = [-40, -8, 40];
export const SHIP_EXIT: Vec3 = [-110, 14, -170];
export const ARRIVE = 0.2;
export const LEAVE = 0.84;
export function jupiterShip(t: number, out: THREE.Vector3): THREE.Vector3 {
  if (t <= ARRIVE) return run(SHIP_START, SHIP_PARK, t / ARRIVE, 'out', out);
  if (t < LEAVE) return out.set(...SHIP_PARK);
  return run(SHIP_PARK, SHIP_EXIT, (t - LEAVE) / (1 - LEAVE), 'in', out);
}
/** SC09's Saturn (at its own origin) carried into this frame: ahead of the ship as it leaves. */
export const SATURN_AHEAD: Vec3 = carry(SHIP_EXIT, [0, 0, 0], SATURN_SHIP_START);
/** Saturn is there only for the way out (from the end of the last installation, still out of shot). */
export const SATURN_FROM = 0.8;

export type StationKind = 'traffic' | 'documents' | 'vault';
export const STATIONS: ReadonlyArray<{
  readonly kind: StationKind;
  readonly position: readonly [number, number, number];
}> = [
  { kind: 'traffic', position: [-14, 3, -24] },
  { kind: 'documents', position: [9, 0, -30] },
  { kind: 'vault', position: [16, 14, -50] },
];

const keys: ShotKey[] = [
  { t: 0, position: [6, 10, 34], target: [14, -22, -150], fov: 56 },
  // station 1 on the left of the frame (panel on the right)
  { t: 0.25, position: [-4, 4, -6], target: [-9, 2.5, -24], fov: 44 },
  // station 2 on the right (panel on the left)
  { t: 0.5, position: [-2, 0, -10], target: [5, -2, -30], fov: 44 },
  // station 3 on the left again
  { t: 0.75, position: [8, 9, -20], target: [21, 13, -50], fov: 44 },
  { t: 1, position: [12, 9, -6], target: [30, -4, -90], fov: 52 },
];

/**
 * Phones: the card fills the lower half, so each station is centred in the upper band instead of
 * sitting at a side of the frame (it was cut at the left edge), seen from a little further back.
 */
const pull = (k: ShotKey, s: readonly [number, number, number], k2: number): ShotKey => ({
  t: k.t,
  position: [
    s[0] + (k.position[0] - s[0]) * k2,
    s[1] + (k.position[1] - s[1]) * k2,
    s[2] + (k.position[2] - s[2]) * k2,
  ],
  // aim below the craft so it sits high in the frame, above the card
  target: [s[0], s[1] - 5, s[2]],
  fov: k.fov,
});
const portraitKeys: ShotKey[] = keys.map((k, i) => {
  const station = STATIONS[i - 1];
  return station && i >= 1 && i <= 3 ? pull(k, station.position, 1.35) : k;
});

const ship = new THREE.Vector3();
const chase = createShotState();
export function jupiterShot(t: number, out: ShotState, aspect: AspectClass = 'landscape'): void {
  sampleKeys(aspect === 'portrait' ? portraitKeys : keys, t, out);
  jupiterShip(t, ship);
  // arriving: the chase camera SC07 ended with, handing over to the first installation
  const arriving = 1 - smooth((t - 0.08) / 0.15);
  if (arriving > 0) {
    chaseShot(ship, CHASE_07_08, chase);
    blendShot(out, chase, arriving);
  }
  // leaving: back behind the ship, Saturn ahead, exactly as SC09 opens
  const leaving = smooth((t - LEAVE) / 0.1);
  if (leaving > 0) {
    chaseShot(ship, CHASE_08_09, chase);
    blendShot(out, chase, leaving);
  }
}
