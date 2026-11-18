import { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { gltfExtender } from '../../engine/assets/loaders.ts';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';

/**
 * NASA public-domain spacecraft and asteroid models (NASA-3D-Resources; assets A030–A033),
 * optimised by `node scripts/optimize-nasa-models.ts`. The sources are in their own units, so
 * the model is centred and scaled to `size` (its longest side).
 */
export const NASA_MODELS = {
  bennu: '/assets/models/nasa_bennu.glb',
  bennuMid: '/assets/models/nasa_bennu_mid.glb',
  bennuLo: '/assets/models/nasa_bennu_lo.glb',
  juno: '/assets/models/nasa_juno.glb',
  landsat8: '/assets/models/nasa_landsat8.glb',
  voyager: '/assets/models/nasa_voyager.glb',
} as const;

export type NasaModelKey = keyof typeof NASA_MODELS;

/** Flat-shaded hard-surface craft (the optimiser drops split normals so they can simplify). */
export function NasaCraft({
  model,
  size,
}: {
  readonly model: NasaModelKey;
  readonly size: number;
}) {
  const gl = useThree((s) => s.gl);
  const { scene } = useGLTF(NASA_MODELS[model], false, true, gltfExtender(gl));
  const { root, materials } = useMemo(() => {
    const mats: THREE.Material[] = [];
    const c = scene.clone(true);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const src = m.material as THREE.MeshStandardMaterial;
      const mat = src.clone();
      mat.flatShading = true;
      mat.metalness = Math.min(src.metalness, 0.55);
      mat.roughness = Math.max(src.roughness, 0.45);
      mat.needsUpdate = true;
      m.material = mat;
      mats.push(mat);
      m.castShadow = false;
      m.receiveShadow = false;
    });
    const box = new THREE.Box3().setFromObject(c);
    const dim = box.getSize(new THREE.Vector3());
    const k = size / Math.max(dim.x, dim.y, dim.z);
    const centre = box.getCenter(new THREE.Vector3());
    c.scale.setScalar(k);
    c.position.copy(centre).multiplyScalar(-k);
    const g = new THREE.Group();
    g.add(c);
    return { root: g, materials: mats };
  }, [scene, size]);
  useDisposeOnUnmount(...materials);
  return <primitive object={root} />;
}

function hash(x: number, y: number, z: number): number {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
}

/** Smooth 3D value noise in [0, 1]. */
function noise3(x: number, y: number, z: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const fx = x - xi;
  const fy = y - yi;
  const fz = z - zi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const w = fz * fz * (3 - 2 * fz);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number) => hash(xi + dx, yi + dy, zi + dz);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  );
}

/**
 * The first mesh's geometry of a model, recentred with a bounding sphere of radius 1 (for
 * instancing). `roughen` adds boulder-scale relief to the smooth shape model (amplitude as a
 * fraction of the radius), shared by every instance.
 */
export interface RockOptions {
  /** Boulder-scale noise relief, as a fraction of the radius. */
  readonly roughen?: number;
  /** Number of impact craters to dig (power-law sizes). */
  readonly craters?: number;
  /** Seed: different seeds give different-looking rocks from the same NASA shape. */
  readonly seed?: number;
}

/** Tiny seeded RNG (mulberry32) so every visit digs the same craters. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NO_ROCK: RockOptions = {};

export function useUnitGeometry(
  model: NasaModelKey,
  options: RockOptions = NO_ROCK,
): THREE.BufferGeometry {
  const { roughen = 0, craters = 0, seed = 1 } = options;
  const gl = useThree((s) => s.gl);
  const { scene } = useGLTF(NASA_MODELS[model], false, true, gltfExtender(gl));
  const geometry = useMemo(() => {
    let found: THREE.BufferGeometry | null = null;
    scene.updateMatrixWorld(true);
    let world = new THREE.Matrix4();
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!found && m.isMesh) {
        found = m.geometry;
        world = m.matrixWorld.clone();
      }
    });
    if (!found) throw new Error(`${model}: no mesh`);
    // Meshopt quantises positions to normalised integers; applying a matrix to those would clip
    // and round them (shredded rocks), so copy to float first.
    const src = found as THREE.BufferGeometry;
    const pos = src.getAttribute('position');
    const floats = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i += 1) {
      floats[i * 3] = pos.getX(i);
      floats[i * 3 + 1] = pos.getY(i);
      floats[i * 3 + 2] = pos.getZ(i);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(floats, 3));
    if (src.index) g.setIndex(src.index.clone());
    g.applyMatrix4(world);
    g.computeBoundingSphere();
    const bs = g.boundingSphere;
    if (bs) {
      g.translate(-bs.center.x, -bs.center.y, -bs.center.z);
      g.scale(1 / bs.radius, 1 / bs.radius, 1 / bs.radius);
    }
    if (roughen > 0 || craters > 0) {
      const rand = rng(seed * 7919 + 13);
      const dirs: Array<[number, number, number, number]> = [];
      for (let c = 0; c < craters; c += 1) {
        // power law: many small craters, a few big ones
        const radius = 0.09 + 0.42 * rand() ** 3;
        let x = rand() * 2 - 1;
        let y = rand() * 2 - 1;
        let z = rand() * 2 - 1;
        const len = Math.hypot(x, y, z) || 1;
        x /= len;
        y /= len;
        z /= len;
        dirs.push([x, y, z, radius]);
      }
      const ox = rand() * 50;
      const p = g.getAttribute('position');
      for (let i = 0; i < p.count; i += 1) {
        const x = p.getX(i);
        const y = p.getY(i);
        const z = p.getZ(i);
        const rl = Math.hypot(x, y, z) || 1;
        const nx = x / rl;
        const ny = y / rl;
        const nz = z / rl;
        let k = 1;
        if (roughen > 0) {
          const n =
            noise3(x * 3 + ox, y * 3, z * 3) * 0.65 + noise3(x * 8 + ox, y * 8, z * 8) * 0.35;
          k += roughen * (n - 0.5) * 2;
        }
        for (const [cx, cy, cz, cr] of dirs) {
          const ang = Math.acos(Math.min(1, Math.max(-1, nx * cx + ny * cy + nz * cz)));
          const q = ang / cr;
          if (q > 1.6) continue;
          // bowl with a raised rim
          const bowl = q < 1 ? -(1 - q * q) : 0;
          const rim = 0.28 * Math.exp(-(((q - 1.12) / 0.22) ** 2));
          k += cr * 0.85 * (bowl + rim);
        }
        p.setXYZ(i, x * k, y * k, z * k);
      }
    }
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }, [scene, model, roughen, craters, seed]);
  useDisposeOnUnmount(geometry);
  return geometry;
}
