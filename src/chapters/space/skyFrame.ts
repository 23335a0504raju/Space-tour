import * as THREE from 'three';
import { GALAXY } from './DeepSky.tsx';

/**
 * One sky for the whole flight (handoff.ts). SC05's Milky Way (as seen from the pad, approved
 * 2026-11-21) is the reference; the travel chapters (SC06–SC10) show the very same sky, so the
 * climb hands over to orbit, and orbit to deep space, without the stars or the Milky Way jumping.
 *
 * SC05 flies toward -x; the travel chapters fly toward -z. `SC05_TO_TRAVEL` turns SC05's frame
 * into theirs (a quarter turn about the vertical).
 */

/**
 * The Milky Way as seen from the pad (review 2026-11-21: the reference is a Milky Way night photo).
 * The band is a great circle through a low core ahead-left of the opening shot, rising steeply to the
 * upper right. `GALAXY_ROT` turns an SC05 direction into the baked deep sky's galaxy frame.
 */
const SC05_CORE = new THREE.Vector3(-0.5, 0.1, -0.86).normalize();
export const SC05_BAND = new THREE.Vector3()
  .crossVectors(SC05_CORE, new THREE.Vector3(0.35, 0.93, -0.1))
  .normalize();
export const GALAXY_ROT = (() => {
  const frame = (n: THREE.Vector3, c: THREE.Vector3) => {
    const cc = c
      .clone()
      .sub(n.clone().multiplyScalar(c.dot(n)))
      .normalize();
    return new THREE.Matrix4().makeBasis(n, cc, new THREE.Vector3().crossVectors(n, cc));
  };
  const from = frame(SC05_BAND, SC05_CORE);
  const to = frame(GALAXY.normal.clone(), GALAXY.core.clone());
  return new THREE.Matrix3().setFromMatrix4(to.multiply(from.transpose()));
})();

/** SC05's frame → the travel chapters' frame: the heading turns from -x to -z. */
export const SC05_TO_TRAVEL = new THREE.Matrix4().makeRotationY(-Math.PI / 2);
/** The travel frame → SC05's frame. */
export const TRAVEL_TO_SC05 = new THREE.Matrix4().makeRotationY(Math.PI / 2);

/** Rotation of the deep sky (and its stars) in SC05's frame: the galaxy frame seen through GALAXY_ROT. */
export const SC05_SKY = new THREE.Quaternion().setFromRotationMatrix(
  new THREE.Matrix4().setFromMatrix3(GALAXY_ROT).transpose(),
);
/** The same sky in the travel chapters' frame. */
export const TRAVEL_SKY = new THREE.Quaternion().setFromRotationMatrix(
  new THREE.Matrix4().multiplyMatrices(
    SC05_TO_TRAVEL,
    new THREE.Matrix4().setFromMatrix3(GALAXY_ROT).transpose(),
  ),
);

/** A travel-frame vector expressed in SC05's frame. */
export const toSC05 = (v: readonly [number, number, number]) =>
  new THREE.Vector3(...v).applyMatrix4(TRAVEL_TO_SC05);
