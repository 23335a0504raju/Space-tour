import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Pane } from './panes.ts';

/** Columns across a curved pane. */
const CURVED_COLUMNS = 20;

/** A point of a pane (u, v from its centre, in metres) in its set's frame. */
export function panePoint(pane: Pane, u: number, v: number, out = new THREE.Vector3()) {
  const k = (2 * u) / pane.width; // -1 left edge, 1 right edge
  return out
    .set(u, v, pane.curve * k * k)
    .applyEuler(new THREE.Euler(pane.rotationX, pane.rotationY, 0, 'YXZ'))
    .add(new THREE.Vector3(...pane.position));
}

function paneGeometry(pane: Pane, index: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(pane.width, pane.height, pane.curve ? CURVED_COLUMNS : 1, 1);
  const position = g.getAttribute('position');
  const point = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 1) {
    // PlaneGeometry's four vertices run in the order of `corners`
    if (pane.corners) point.set(...pane.corners[i]!);
    else panePoint(pane, position.getX(i), position.getY(i), point);
    position.setXYZ(i, point.x, point.y, point.z);
  }
  g.deleteAttribute('normal');
  const fill = (name: string, values: number[]) => {
    const data = new Float32Array(position.count * values.length);
    for (let i = 0; i < position.count; i += 1) data.set(values, i * values.length);
    g.setAttribute(name, new THREE.BufferAttribute(data, values.length));
  };
  const r = pane.rect;
  fill('aRect', r ? [r.x, r.y, r.w, r.h] : [0, 0, 1, 1]);
  fill('aPane', [pane.width, pane.height, pane.kind, pane.screen]);
  fill('aMotion', [pane.float, index * 1.9, pane.folds ? 1 : 0, pane.delay]);
  fill('aLook', [pane.gain, pane.soft]);
  return g;
}

/** Every pane in one geometry (one draw call), in drawing order. */
export function createHoloGeometry(panes: readonly Pane[]): THREE.BufferGeometry {
  const parts = panes.map(paneGeometry);
  const merged = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  if (!merged) throw new Error('holo screens: panes could not be merged');
  return merged;
}
