import { useLayoutEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { gltfExtender } from '../../engine/assets/loaders.ts';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { applyHaze, hazed as hazedClone } from './haze.ts';
import type { Haze } from './haze.ts';
import { VILLAGE } from './layout.ts';
import { painted, paintedAtlas, paintedGround } from './painted.ts';
import type { Paint } from './painted.ts';
import { PaintedPuffs, foliagePalette } from './parts.tsx';

/**
 * Landscape pieces for the SC11 worlds: ground, the village, mountains, instanced trees and
 * fields. Every surface is hazed into the world's horizon colour (haze.ts), and repeated objects are
 * one instanced draw per part. Static: nothing here changes with t (the world group moves).
 */

const flatStd = (haze: Haze, color = '#ffffff') =>
  applyHaze(
    new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0, flatShading: true }),
    haze,
  );

/** A ground plane far wider than the view; the haze dissolves it before its edge. */
export function Ground({ y, color, haze }: { y: number; color: string; haze: Haze }) {
  const mat = useMemo(
    () => applyHaze(new THREE.MeshLambertMaterial({ color }), haze),
    [color, haze],
  );
  useDisposeOnUnmount(mat);
  return (
    <mesh material={mat} position={[0, y, -300]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[5000, 5000]} />
    </mesh>
  );
}

/** A stretch of painted dirt (painted.ts): the frontier town's street and desert floor. */
export function PaintedGround({
  y,
  width,
  from,
  to,
  haze,
  paint,
}: {
  y: number;
  width: number;
  from: number;
  to: number;
  haze: Haze;
  paint: Paint;
}) {
  const mat = useMemo(() => paintedGround(haze, paint), [haze, paint]);
  useDisposeOnUnmount(mat);
  return (
    <mesh material={mat} position={[0, y, (from + to) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[width, from - to]} />
    </mesh>
  );
}

/**
 * The Hidden Leaf village: one model, one atlas, one draw. Painted from its own texture
 * (painted.ts paintedAtlas): its sheet is unlit, so the cel light comes from the shape.
 */
export function Village({ url, haze, paint }: { url: string; haze: Haze; paint: Paint }) {
  const gl = useThree((st) => st.gl);
  const gltf = useGLTF(url, false, true, gltfExtender(gl));
  const obj = useMemo(() => {
    const root = gltf.scene.clone(true);
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const skin = (m: THREE.Material) => paintedAtlas(m, haze, paint);
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(skin) : skin(mesh.material);
    });
    return root;
  }, [gltf, haze, paint]);
  return (
    <group position={[...VILLAGE.position]} rotation={[0, VILLAGE.yaw, 0]} scale={VILLAGE.scale}>
      <primitive object={obj} />
    </group>
  );
}

/** A flat coloured strip on the ground (a street, a road). */
export function Strip({
  y,
  halfWidth,
  from,
  to,
  color,
  haze,
}: {
  y: number;
  halfWidth: number;
  from: number;
  to: number;
  color: string;
  haze: Haze;
}) {
  const mat = useMemo(
    () =>
      applyHaze(
        new THREE.MeshLambertMaterial({ color, polygonOffset: true, polygonOffsetFactor: -2 }),
        haze,
      ),
    [color, haze],
  );
  useDisposeOnUnmount(mat);
  return (
    <mesh material={mat} position={[0, y, (from + to) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[halfWidth * 2, from - to]} />
    </mesh>
  );
}

/** Instanced placement helper: writes matrices (and optional colours) once. */
function useInstances(
  ref: RefObject<THREE.InstancedMesh | null>,
  count: number,
  fill: (i: number, m: THREE.Matrix4, c: THREE.Color) => boolean,
) {
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    let colours = false;
    for (let i = 0; i < count; i += 1) {
      c.set(1, 1, 1);
      colours = fill(i, m, c) || colours;
      mesh.setMatrixAt(i, m);
      if (colours) mesh.setColorAt(i, c);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [ref, count, fill]);
}

const q = new THREE.Quaternion();
const yAxis = new THREE.Vector3(0, 1, 0);
const v = new THREE.Vector3();
const s = new THREE.Vector3();

/** A ring of mountains on the horizon (instanced low-poly cones). */
export function Mountains({
  items,
  y,
  color,
  haze,
}: {
  items: ReadonlyArray<{ x: number; z: number; h: number; w: number }>;
  y: number;
  color: string;
  haze: Haze;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const mat = useMemo(() => flatStd(haze, color), [haze, color]);
  useDisposeOnUnmount(mat);
  const fill = useMemo(
    () => (i: number, m: THREE.Matrix4) => {
      const it = items[i]!;
      q.setFromAxisAngle(yAxis, i * 1.7);
      m.compose(v.set(it.x, y + it.h / 2 - 10, it.z), q, s.set(it.w, it.h, it.w));
      return false;
    },
    [items, y],
  );
  useInstances(ref, items.length, fill);
  return (
    <instancedMesh ref={ref} args={[undefined, mat, items.length]} frustumCulled={false}>
      <coneGeometry args={[0.5, 1, 6]} />
    </instancedMesh>
  );
}

/** Round-crowned trees: a trunk and a faceted crown each, two instanced draws. */
export function Trees({
  items,
  crowns,
  trunk = '#6b4a3a',
  size = 1,
  haze,
  painted = false,
}: {
  items: ReadonlyArray<{ x: number; y: number; z: number; s: number }>;
  crowns: readonly string[];
  trunk?: string;
  size?: number;
  haze: Haze;
  /** painted foliage crowns (PaintedPuffs, up to four crown colours) instead of faceted ones */
  painted?: boolean;
}) {
  const mat = useMemo(() => flatStd(haze), [haze]);
  useDisposeOnUnmount(mat);
  const trunkCol = useMemo(() => new THREE.Color(trunk), [trunk]);
  const crownCols = useMemo(() => crowns.map((c) => new THREE.Color(c)), [crowns]);
  const t = useRef<THREE.InstancedMesh>(null);
  const c = useRef<THREE.InstancedMesh>(null);
  const fT = useMemo(
    () => (i: number, m: THREE.Matrix4, col: THREE.Color) => {
      const it = items[i]!;
      const k = it.s * size;
      // painted crowns sit low: a short trunk (long ones read as sticks under distant crowns)
      const h = painted ? 5 : 10;
      m.compose(
        v.set(it.x, it.y + (h / 2) * k, it.z),
        q.identity(),
        s.set(1.4 * k, h * k, 1.4 * k),
      );
      col.copy(trunkCol);
      return true;
    },
    [items, size, trunkCol, painted],
  );
  const fC = useMemo(
    () => (i: number, m: THREE.Matrix4, col: THREE.Color) => {
      const it = items[i]!;
      const k = it.s * size;
      q.setFromAxisAngle(yAxis, i * 2.1);
      m.compose(v.set(it.x, it.y + 13 * k, it.z), q, s.set(8 * k, 6.5 * k, 8 * k));
      col.copy(crownCols[i % crownCols.length]!);
      return true;
    },
    [items, size, crownCols],
  );
  useInstances(t, items.length, fT);
  useInstances(c, painted ? 0 : items.length, fC);
  const palettes = useMemo(() => crowns.slice(0, 4).map(foliagePalette), [crowns]);
  // three crowns per tree: a tall middle one and two lower shoulders, so a tree reads as a tree
  const puffs = useMemo(
    () =>
      items.flatMap((it, i) => {
        const k = it.s * size;
        const pal = i % Math.min(4, crowns.length);
        const side = i % 2 ? 1 : -1;
        return [
          {
            p: [it.x - side * 2.4 * k, it.y + 6.6 * k, it.z + 0.8 * k] as const,
            s: 2.7 * k,
            k: pal,
          },
          {
            p: [it.x + side * 2.6 * k, it.y + 7.2 * k, it.z - 0.8 * k] as const,
            s: 2.5 * k,
            k: pal,
          },
          { p: [it.x, it.y + 9.2 * k, it.z] as const, s: 3.5 * k, k: pal },
        ];
      }),
    [items, size, crowns.length],
  );
  return (
    <>
      <instancedMesh ref={t} args={[undefined, mat, items.length]}>
        <cylinderGeometry args={[0.35, 0.5, 1, 5]} />
      </instancedMesh>
      {painted ? (
        <PaintedPuffs items={puffs} palettes={palettes} haze={haze} />
      ) : (
        <instancedMesh ref={c} args={[undefined, mat, items.length]}>
          <icosahedronGeometry args={[1, 0]} />
        </instancedMesh>
      )}
    </>
  );
}

/** Flat coloured field patches on the ground. */
export function Fields({
  items,
  y,
  colors,
  haze,
}: {
  items: ReadonlyArray<{ x: number; z: number; w: number; d: number; c: number }>;
  y: number;
  colors: readonly string[];
  haze: Haze;
}) {
  const mat = useMemo(
    () =>
      applyHaze(
        new THREE.MeshLambertMaterial({ polygonOffset: true, polygonOffsetFactor: -1 }),
        haze,
      ),
    [haze],
  );
  useDisposeOnUnmount(mat);
  const cols = useMemo(() => colors.map((c) => new THREE.Color(c)), [colors]);
  const ref = useRef<THREE.InstancedMesh>(null);
  const f = useMemo(
    () => (i: number, m: THREE.Matrix4, c: THREE.Color) => {
      const it = items[i]!;
      m.compose(v.set(it.x, y + 0.05, it.z), q.identity(), s.set(it.w, 0.1, it.d));
      c.copy(cols[it.c % cols.length]!);
      return true;
    },
    [items, y, cols],
  );
  useInstances(ref, items.length, f);
  return (
    <instancedMesh ref={ref} args={[undefined, mat, items.length]}>
      <boxGeometry args={[1, 1, 1]} />
    </instancedMesh>
  );
}

/**
 * One named part of a GLB (a building of the rural set), base on y = 0, centred on its footprint,
 * uniformly scaled. Geometry is shared between copies; materials are hazed per world.
 */
export function ModelPart({
  url,
  name,
  scale,
  position,
  rotationY = 0,
  haze,
  paint,
}: {
  url: string;
  name: string;
  scale: number;
  position: readonly [number, number, number];
  rotationY?: number;
  haze: Haze;
  paint?: Paint;
}) {
  const gl = useThree((st) => st.gl);
  const gltf = useGLTF(url, false, true, gltfExtender(gl));
  const obj = useMemo(() => {
    const src = gltf.scene.getObjectByName(name);
    if (!src) return null;
    gltf.scene.updateMatrixWorld(true);
    const part = src.clone(true);
    // bake the source's world transform (the Sketchfab root rotates and scales)
    part.matrixAutoUpdate = true;
    src.matrixWorld.decompose(part.position, part.quaternion, part.scale);
    const holder = new THREE.Group();
    holder.add(part);
    holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(holder);
    const c = box.getCenter(new THREE.Vector3());
    part.position.sub(new THREE.Vector3(c.x, box.min.y, c.z));
    part.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const skin = (m: THREE.Material) => (paint ? painted(m, haze, paint) : hazedClone(m, haze));
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(skin) : skin(mesh.material);
    });
    return holder;
  }, [gltf, name, haze, paint]);
  if (!obj) return null;
  return (
    <group position={[...position]} rotation={[0, rotationY, 0]} scale={scale}>
      <primitive object={obj} />
    </group>
  );
}
