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
import { painted, paintedGround } from './painted.ts';
import type { Paint } from './painted.ts';
import { PaintedPuffs, foliagePalette } from './parts.tsx';

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

/**
 * Painted detail for the instanced village (Houses): Japanese town facades on the walls (a stone
 * base, timber posts between bays, a beam under the eaves, shoji windows on every floor, a
 * sliding door on some ground floors) and tile rows on the roofs. Drawn in the shader from the
 * instance's own size, so the whole village stays four draw calls. Detail fades out with distance
 * (far facades would only turn into ink noise). Chained after the haze patch.
 */
function paintVillage<M extends THREE.Material>(mat: M, kind: 'wall' | 'roof' | 'tower'): M {
  const hazeCompile = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    hazeCompile.call(mat, shader, renderer);
    shader.vertexShader =
      'varying vec3 vLoc; varying vec3 vSize; varying vec3 vObjN; varying float vSeedH; varying float vDepth;\n' +
      shader.vertexShader.replace(
        '#include <project_vertex>',
        `#include <project_vertex>
  vSize = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  vLoc = position * vSize;
  vObjN = normal;
  vSeedH = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
  vDepth = -mvPosition.z;`,
      );
    shader.fragmentShader =
      'varying vec3 vLoc; varying vec3 vSize; varying vec3 vObjN; varying float vSeedH; varying float vDepth;\n' +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
  {
    ${kind === 'tower' ? '#define VILLAGE_TOWER' : ''}
    float near = 1.0 - smoothstep(140.0, 320.0, vDepth);
    vec3 base = diffuseColor.rgb;
    ${kind === 'roof' ? ROOF_GLSL : WALL_GLSL}
  }`,
      );
  };
  mat.customProgramCacheKey = () => 'sc11-haze-village-' + kind;
  mat.needsUpdate = true;
  return mat;
}

const WALL_GLSL = /* glsl */ `
    // which face: u runs along it, v is the height above the ground
    float u;
    float span;
    if (abs(vObjN.y) > 0.5) {
      u = 0.0; span = 0.0;
    } else {
#ifdef VILLAGE_TOWER
      // around the drum
      u = atan(vLoc.z, vLoc.x) * vSize.x * 0.5; span = 3.14159 * vSize.x;
#else
      if (abs(vObjN.x) > 0.5) { u = vLoc.z; span = vSize.z; } else { u = vLoc.x; span = vSize.x; }
#endif
    }
    float v = vLoc.y + vSize.y * 0.5;
    if (span > 0.0) {
      vec3 col = base;
      // plaster: a faint vertical wash, lighter high up
      col *= 0.94 + 0.08 * smoothstep(0.0, vSize.y, v);
      // stone base
      float stone = 1.0 - step(0.9, v);
      col = mix(col, vec3(0.52, 0.5, 0.5), stone);
      // bays of ~3.4 m: timber posts between them
      float bays = max(1.0, floor(span / 5.5 + 0.5));
      float bw = span / bays;
      float bu = fract((u + span * 0.5) / bw);
      float post = 1.0 - step(0.07, min(bu, 1.0 - bu) * bw);
      // floors of 4.2 m: a beam at each floor and one under the eaves
      float fl = 5.0;
      float fv = fract(v / fl);
      float beam = (1.0 - step(0.06, fv)) * step(fl * 0.9, v) + step(vSize.y - 0.55, v);
      vec3 timber = vec3(0.33, 0.22, 0.17);
      col = mix(col, timber, max(post, beam) * (1.0 - stone));
      // shoji windows in each bay, one per floor (the ground floor of some bays is a door)
      float cu = (bu - 0.5) * bw;
      float cv = (fv - 0.5) * fl;
      float floorIx = floor(v / fl);
      float isTop = step(vSize.y - 1.2, (floorIx + 1.0) * fl);
      float bayIx = floor((u + span * 0.5) / bw);
      float door = step(floorIx, 0.5) * step(0.6, fract(sin(bayIx * 7.1 + vSeedH * 31.0) * 917.3));
      vec2 half_ = door > 0.5 ? vec2(bw * 0.3, fl * 0.38) : vec2(bw * 0.3, fl * 0.22);
      // not every bay has a window on every floor: some plaster stays blank
      float skip = step(0.62, fract(sin((bayIx + floorIx * 13.0) * 3.7 + vSeedH * 57.0) * 4131.7)) * (1.0 - door);
      float cvo = door > 0.5 ? cv + fl * 0.1 : cv - fl * 0.06;
      float inWin = step(abs(cu), half_.x) * step(abs(cvo), half_.y) * (1.0 - isTop * step(vSize.y - 0.7, v));
      inWin *= step(0.9, v) * (1.0 - skip);
      // paper with a lattice; doors are darker wood with a lattice too
      // one cross bar per pane, not a fine lattice (that only turned into ink noise)
      float grid = 1.0 - step(0.08, min(abs(cu), abs(cvo)));
      vec3 paper = door > 0.5 ? vec3(0.42, 0.3, 0.22) : vec3(0.97, 0.9, 0.74);
      vec3 win = mix(paper, timber, grid * 0.85);
      // a frame round each opening
      float frame = step(abs(cu), half_.x + 0.12) * step(abs(cvo), half_.y + 0.12) * (1.0 - step(abs(cu), half_.x) * step(abs(cvo), half_.y));
      col = mix(col, timber, frame * step(0.9, v) * (1.0 - skip) * (1.0 - isTop * step(vSize.y - 0.7, v)));
      col = mix(col, win, inWin);
      // contact shadow at the foot of the wall
      col *= 0.82 + 0.18 * smoothstep(0.0, 1.6, v);
      diffuseColor.rgb = mix(base, col, near);
    }
`;

const ROOF_GLSL = /* glsl */ `
    // tile rows across the slope, a darker eave band at the bottom edge
    float v = vLoc.y + vSize.y * 0.5;
    float rows = abs(fract(v / 0.7) - 0.5);
    vec3 col = base * (0.88 + 0.12 * smoothstep(0.0, 0.18, rows));
    // the ridge catches light
    col *= 1.0 + 0.12 * smoothstep(vSize.y * 0.75, vSize.y, v);
    col = mix(col, base * 0.55, 1.0 - step(0.45, v));
    diffuseColor.rgb = mix(base, col, near);
`;

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
  const wallMat = useMemo(() => paintVillage(flatStd(haze), 'wall'), [haze]);
  const roofMat = useMemo(() => paintVillage(flatStd(haze), 'roof'), [haze]);
  const towerMat = useMemo(() => paintVillage(flatStd(haze), 'tower'), [haze]);
  useDisposeOnUnmount(mat, wallMat, roofMat, towerMat);
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
      m.compose(v.set(h.x, h.y + h.h + rh / 2, h.z), q, s.set(h.w * 0.98, rh, h.d * 0.98));
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
      <instancedMesh ref={body} args={[undefined, wallMat, sets.box.length]}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      <instancedMesh ref={roof} args={[undefined, roofMat, sets.box.length]}>
        <coneGeometry args={[Math.SQRT1_2 * 1.25, 1, 4]} />
      </instancedMesh>
      <instancedMesh ref={tower} args={[undefined, towerMat, sets.tow.length]}>
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
