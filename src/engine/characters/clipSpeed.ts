import * as THREE from 'three';
import { measureWalk } from './stride.ts';
import type { FootSample, WalkMeasurement } from './stride.ts';

/**
 * Samples an in-place walk clip on a rig (at the origin, untransformed) and measures the ground
 * speed implied by its planted feet (spike S2 method: toe bones, horizontal axis with most travel).
 * Leaves every action at weight 0 afterwards.
 */
export function measureClipWalk(
  root: THREE.Object3D,
  mixer: THREE.AnimationMixer,
  walk: THREE.AnimationAction,
  others: readonly THREE.AnimationAction[],
  leftFoot: THREE.Object3D,
  rightFoot: THREE.Object3D,
  samples = 120,
): WalkMeasurement & { axis: 'x' | 'z' } {
  const v = new THREE.Vector3();
  const lx: FootSample[] = [];
  const lz: FootSample[] = [];
  const rx: FootSample[] = [];
  const rz: FootSample[] = [];
  for (const a of others) a.setEffectiveWeight(0);
  walk.play();
  walk.setEffectiveWeight(1);
  const duration = walk.getClip().duration;
  for (let i = 0; i < samples; i += 1) {
    const t = (i / samples) * duration;
    walk.time = t;
    mixer.update(0);
    root.updateMatrixWorld(true);
    leftFoot.getWorldPosition(v);
    lx.push({ t, y: v.y, h: v.x });
    lz.push({ t, y: v.y, h: v.z });
    rightFoot.getWorldPosition(v);
    rx.push({ t, y: v.y, h: v.x });
    rz.push({ t, y: v.y, h: v.z });
  }
  walk.setEffectiveWeight(0);
  const alongX = measureWalk([lx, rx]);
  const alongZ = measureWalk([lz, rz]);
  return alongZ.speed >= alongX.speed ? { ...alongZ, axis: 'z' } : { ...alongX, axis: 'x' };
}
