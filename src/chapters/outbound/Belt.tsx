import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { seeded } from '../greybox/parts.tsx';
import { useUnitGeometry } from '../nasa/NasaModel.tsx';

/**
 * The asteroid belt built from NASA's 3D model of Bennu (OSIRIS-REx target, asset A030). A real
 * field is thin, clumped and dominated by small rocks, so: a flat disc (gaussian thickness),
 * dense clusters, a power-law size distribution, and a clear corridor around the flight line.
 * Positions come from a seeded RNG, so the field is identical on every visit.
 */
interface Rock {
  readonly matrix: THREE.Matrix4;
  readonly color: THREE.Color;
  readonly size: number;
}

// stony grey with a little warmth (review 2026-11-21: the reference rocks are grey regolith, the
// brown read as mud); the hard key light and the crater shading carry the form
const BASE = ['#8a8782', '#76736e', '#9a9690', '#6b6864', '#827d75'] as const;
const HERO_COUNT = 9;
const MID_COUNT = 36;

export function makeRocks(
  count: number,
  spread: readonly [number, number, number],
  seed: number,
  corridor: number,
): Rock[] {
  const rand = seeded(seed);
  const clusters = Array.from({ length: 7 }, () => ({
    x: (rand() - 0.5) * spread[0] * 0.8,
    y: (rand() - 0.5) * spread[1] * 0.3,
    z: (rand() - 0.5) * spread[2] * 0.8,
    r: 14 + rand() * 26,
  }));
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const rocks: Rock[] = [];
  let guard = 0;
  while (rocks.length < count && guard < count * 20) {
    guard += 1;
    let x: number;
    let y: number;
    let z: number;
    if (rand() < 0.55) {
      const c = clusters[Math.floor(rand() * clusters.length)];
      if (!c) continue;
      x = c.x + (rand() + rand() + rand() - 1.5) * c.r;
      z = c.z + (rand() + rand() + rand() - 1.5) * c.r;
      y = c.y + (rand() + rand() + rand() - 1.5) * c.r * 0.35;
    } else {
      x = (rand() - 0.5) * spread[0];
      z = (rand() - 0.5) * spread[2];
      y = (rand() + rand() + rand() - 1.5) * spread[1] * 0.45;
    }
    // power law: many small rocks, a few large ones
    const size = 0.3 + 4.2 * rand() ** 5;
    // keep the flight line (x = 0, y = 0) clear, more for big rocks
    if (Math.hypot(x, y) < corridor + size * 1.2) continue;
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      q.setFromEuler(e.set(rand() * 6.3, rand() * 6.3, rand() * 6.3)),
      new THREE.Vector3(size, size * (0.75 + rand() * 0.4), size * (0.85 + rand() * 0.3)),
    );
    const c = new THREE.Color(BASE[Math.floor(rand() * BASE.length)] ?? '#7d756a');
    c.multiplyScalar(0.8 + rand() * 0.5);
    rocks.push({ matrix: m, color: c, size });
  }
  return rocks;
}

/**
 * Regolith shading: a procedural pitted surface (Worley craters with raised rims, plus fine grit)
 * evaluated in each rock's own unit space, applied as a bump to the shading normal from screen-space
 * derivatives. No textures; the low tier drops the second crater octave.
 */
function createRockMaterial(low: boolean): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRock;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRock = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vRock;
        vec3 rh3(vec3 p) {
          p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
          return fract(sin(p) * 43758.5453);
        }
        // crater field: bowl inside, raised rim, flat between (Worley distance, varied radii)
        float craters(vec3 p) {
          vec3 i = floor(p); vec3 f = fract(p);
          float h = 0.0;
          for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
            vec3 g = vec3(x, y, z);
            vec3 o = rh3(i + g);
            float r = 0.25 + 0.3 * o.x;
            float d = length(g + o - f) / r;
            float bowl = (d * d - 1.0) * 0.6;
            float rim = exp(-pow((d - 1.0) * 4.0, 2.0)) * 0.35;
            h += d < 1.0 ? bowl : rim;
          }
          return h;
        }
        
        float rockHeight(vec3 p) {
          float h = craters(p * 3.0) * 0.6;
          ${low ? '' : 'h += craters(p * 8.0 + 3.7) * 0.22;'}
          
          return h;
        }`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          float hgt = rockHeight(vRock);
          vec3 sp = -vViewPosition;
          vec3 dpx = dFdx(sp); vec3 dpy = dFdy(sp);
          vec3 r1 = cross(dpy, normal); vec3 r2 = cross(normal, dpx);
          float det = dot(dpx, r1);
          float dhx = dFdx(hgt); float dhy = dFdy(hgt);
          // fade the bump where a crater spans only a few pixels (it would alias into sparkle)
          float fp = length(fwidth(vRock * 3.0));
          float keep = 1.0 - smoothstep(0.08, 0.3, fp);
          vec3 grad = sign(det) * (dhx * r1 + dhy * r2) * 0.45 * keep;
          normal = normalize(abs(det) * normal - grad);
          // crater floors are a touch darker (shadowed regolith)
          diffuseColor.rgb *= 0.82 + 0.25 * clamp(hgt + 0.5, 0.0, 1.0);
        }`,
      );
  };
  m.customProgramCacheKey = () => `belt-rock-${low ? 'lo' : 'hi'}`;
  return m;
}

function Field({
  geometry,
  rocks,
  material,
}: {
  geometry: THREE.BufferGeometry;
  rocks: readonly Rock[];
  material: THREE.Material;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    rocks.forEach((r, i) => {
      mesh.setMatrixAt(i, r.matrix);
      mesh.setColorAt(i, r.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [rocks]);
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, Math.max(1, rocks.length)]}
      count={rocks.length}
      frustumCulled={false}
    />
  );
}

export function Belt({
  count,
  spread,
  seed = 9,
  low = false,
}: {
  readonly count: number;
  readonly spread: readonly [number, number, number];
  readonly seed?: number;
  /** Low tier: fewer detailed rocks (triangle budget 200k). */
  readonly low?: boolean;
}) {
  const lo = useUnitGeometry('bennuLo', { roughen: 0.3, seed: 3 });
  const midA = useUnitGeometry('bennuMid', { roughen: 0.1, craters: 30, seed: 5 });
  const midB = useUnitGeometry('bennuMid', { roughen: 0.14, craters: 26, seed: 17 });
  // Three cratered hero shapes from the same NASA model; every hero uses one of them.
  const heroA = useUnitGeometry('bennu', { roughen: 0.1, craters: 46, seed: 11 });
  const heroB = useUnitGeometry('bennu', { roughen: 0.14, craters: 38, seed: 23 });
  const heroC = useUnitGeometry('bennu', { roughen: 0.08, craters: 54, seed: 37 });
  const material = useMemo(() => createRockMaterial(low), [low]);
  useDisposeOnUnmount(material);
  const { field, mids, groups } = useMemo(() => {
    const all = makeRocks(count, spread, seed, 7);
    const sorted = [...all].sort((a, b) => b.size - a.size);
    const hero = sorted.slice(0, low ? 4 : HERO_COUNT);
    const mid = sorted.slice(low ? 4 : HERO_COUNT, (low ? 4 : HERO_COUNT) + (low ? 12 : MID_COUNT));
    const used = new Set([...hero, ...mid]);
    return {
      field: all.filter((r) => !used.has(r)),
      mids: [0, 1].map((k) => mid.filter((_, i) => i % 2 === k)),
      groups: [0, 1, 2].map((k) => hero.filter((_, i) => i % 3 === k)),
    };
  }, [count, spread, seed, low]);
  const heroGeos = [heroA, heroB, heroC];
  return (
    <group>
      <Field geometry={lo} rocks={field} material={material} />
      <Field geometry={midA} rocks={mids[0] ?? []} material={material} />
      <Field geometry={midB} rocks={mids[1] ?? []} material={material} />
      {groups.map((rocks, k) => (
        <Field key={k} geometry={heroGeos[k] ?? heroA} rocks={rocks} material={material} />
      ))}
    </group>
  );
}
