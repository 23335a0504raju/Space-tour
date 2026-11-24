import { useLayoutEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { gltfExtender } from '../../engine/assets/loaders.ts';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { applyHaze, hazed as hazedClone } from './haze.ts';
import type { Haze } from './haze.ts';
import type { Block } from './layout.ts';

/**
 * Landscape pieces for the SC11 worlds: ground, cloud sea, mountains, instanced houses, trees and
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

/**
 * The sea of cloud between worlds: a soft, puffy floor that follows the ship. Opacity is written
 * by the area scene from cloudSea(t) (anime.ts); the drift is ambient.
 */
export function CloudSea({
  level,
  opacity,
  tint,
  haze,
  follow,
}: {
  level: number;
  opacity: { current: number };
  tint: { current: THREE.Color };
  haze: Haze;
  follow: { current: number };
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uOpacity: { value: 0 },
          uTint: { value: new THREE.Color() },
          uHaze: haze.color,
          uTime: { value: 0 },
        },
        vertexShader: /* glsl */ `
          varying vec3 vW; varying vec3 vV;
          void main(){
            vec4 w = modelMatrix * vec4(position, 1.0);
            vW = w.xyz;
            vec4 mv = viewMatrix * w;
            vV = mv.xyz;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uOpacity; uniform vec3 uTint; uniform vec3 uHaze; uniform float uTime;
          varying vec3 vW; varying vec3 vV;
          float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
            return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
          void main(){
            vec2 p = vW.xz / 70.0 + vec2(uTime * 0.01, 0.0);
            float c = n(p) * 0.6 + n(p * 2.3) * 0.3 + n(p * 5.1) * 0.1;
            // puffs: bright tops, tinted hollows
            vec3 col = mix(uTint * 0.8, vec3(1.0, 0.98, 0.96), smoothstep(0.35, 0.7, c));
            col = mix(col, uHaze, smoothstep(250.0, 1100.0, length(vV)));
            gl_FragColor = vec4(col, uOpacity);
          }`,
      }),
    [haze],
  );
  useDisposeOnUnmount(mat);
  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    const o = opacity.current;
    m.visible = o > 0.002;
    m.position.z = follow.current;
    const u = mat.uniforms;
    u['uOpacity']!.value = o;
    (u['uTint']!.value as THREE.Color).copy(tint.current);
    u['uTime']!.value = clock.elapsedTime;
  });
  return (
    <mesh
      ref={mesh}
      material={mat}
      position={[0, level, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={2}
      visible={false}
    >
      <planeGeometry args={[4000, 4000]} />
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

/**
 * Village houses: a box body and a hipped roof per house, a round body and a cone cap per tower.
 * Four instanced draws for the whole village.
 */
export function Houses({
  houses,
  walls,
  roofs,
  haze,
}: {
  houses: ReadonlyArray<Block & { tower: boolean; wall: number; roof: number }>;
  walls: readonly string[];
  roofs: readonly string[];
  haze: Haze;
}) {
  const mat = useMemo(() => flatStd(haze), [haze]);
  useDisposeOnUnmount(mat);
  const sets = useMemo(() => {
    const box = houses.filter((h) => !h.tower);
    const tow = houses.filter((h) => h.tower);
    return { box, tow };
  }, [houses]);
  const wallCols = useMemo(() => walls.map((c) => new THREE.Color(c)), [walls]);
  const roofCols = useMemo(() => roofs.map((c) => new THREE.Color(c)), [roofs]);

  const body = useRef<THREE.InstancedMesh>(null);
  const roof = useRef<THREE.InstancedMesh>(null);
  const tower = useRef<THREE.InstancedMesh>(null);
  const cap = useRef<THREE.InstancedMesh>(null);
  const fBody = useMemo(
    () => (i: number, m: THREE.Matrix4, c: THREE.Color) => {
      const h = sets.box[i]!;
      m.compose(v.set(h.x, h.y + h.h / 2, h.z), q.identity(), s.set(h.w, h.h, h.d));
      c.copy(wallCols[h.wall]!);
      return true;
    },
    [sets, wallCols],
  );
  const fRoof = useMemo(
    () => (i: number, m: THREE.Matrix4, c: THREE.Color) => {
      const h = sets.box[i]!;
      const rh = Math.min(h.w, h.d) * 0.45;
      q.setFromAxisAngle(yAxis, Math.PI / 4);
      // a 4-sided cone turned 45° is a hipped roof; scale it to overhang the walls
      m.compose(v.set(h.x, h.y + h.h + rh / 2, h.z), q, s.set(h.w * 0.82, rh, h.d * 0.82));
      c.copy(roofCols[h.roof]!);
      return true;
    },
    [sets, roofCols],
  );
  const fTower = useMemo(
    () => (i: number, m: THREE.Matrix4, c: THREE.Color) => {
      const h = sets.tow[i]!;
      m.compose(v.set(h.x, h.y + h.h / 2, h.z), q.identity(), s.set(h.w, h.h, h.w));
      c.copy(wallCols[h.wall]!);
      return true;
    },
    [sets, wallCols],
  );
  const fCap = useMemo(
    () => (i: number, m: THREE.Matrix4, c: THREE.Color) => {
      const h = sets.tow[i]!;
      m.compose(
        v.set(h.x, h.y + h.h + h.w * 0.2, h.z),
        q.identity(),
        s.set(h.w * 1.25, h.w * 0.4, h.w * 1.25),
      );
      c.copy(roofCols[h.roof]!);
      return true;
    },
    [sets, roofCols],
  );
  useInstances(body, sets.box.length, fBody);
  useInstances(roof, sets.box.length, fRoof);
  useInstances(tower, sets.tow.length, fTower);
  useInstances(cap, sets.tow.length, fCap);
  return (
    <>
      <instancedMesh ref={body} args={[undefined, mat, sets.box.length]}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      <instancedMesh ref={roof} args={[undefined, mat, sets.box.length]}>
        <coneGeometry args={[Math.SQRT1_2 * 1.25, 1, 4]} />
      </instancedMesh>
      <instancedMesh ref={tower} args={[undefined, mat, sets.tow.length]}>
        <cylinderGeometry args={[0.5, 0.5, 1, 10]} />
      </instancedMesh>
      <instancedMesh ref={cap} args={[undefined, mat, sets.tow.length]}>
        <coneGeometry args={[0.5, 1, 10]} />
      </instancedMesh>
    </>
  );
}

/** Round-crowned trees: a trunk and a faceted crown each, two instanced draws. */
export function Trees({
  items,
  crowns,
  trunk = '#6b4a3a',
  size = 1,
  haze,
}: {
  items: ReadonlyArray<{ x: number; y: number; z: number; s: number }>;
  crowns: readonly string[];
  trunk?: string;
  size?: number;
  haze: Haze;
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
      m.compose(v.set(it.x, it.y + 5 * k, it.z), q.identity(), s.set(1.4 * k, 10 * k, 1.4 * k));
      col.copy(trunkCol);
      return true;
    },
    [items, size, trunkCol],
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
  useInstances(c, items.length, fC);
  return (
    <>
      <instancedMesh ref={t} args={[undefined, mat, items.length]}>
        <cylinderGeometry args={[0.35, 0.5, 1, 5]} />
      </instancedMesh>
      <instancedMesh ref={c} args={[undefined, mat, items.length]}>
        <icosahedronGeometry args={[1, 0]} />
      </instancedMesh>
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
}: {
  url: string;
  name: string;
  scale: number;
  position: readonly [number, number, number];
  rotationY?: number;
  haze: Haze;
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
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map((m) => hazedClone(m, haze))
        : hazedClone(mesh.material, haze);
    });
    return holder;
  }, [gltf, name, haze]);
  if (!obj) return null;
  return (
    <group position={[...position]} rotation={[0, rotationY, 0]} scale={scale}>
      <primitive object={obj} />
    </group>
  );
}
