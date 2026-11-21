import { forwardRef, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { gltfExtender } from '../../engine/assets/loaders.ts';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { HELVELA } from './helvelaDimensions.ts';
import type { EngineLevel } from './Spacecraft.tsx';

/**
 * The hero ship: "HelVela II" (Sketchfab, CC BY; asset A024), chosen by Raju on 2026-11-17 to replace
 * the code-built crew vehicle. Optimised by `npm run assets:ship` (62k triangles, 6 draw calls).
 *
 * Local frame (metres): origin on the keel at the hull's centre; the bow points to -x; +y up.
 * Materials are rebuilt from the source's material names (its textures were missing): a brushed
 * gunmetal hull, flat-shaded (the mesh has no normals), and the model's own emissive light colours
 * (cyan graviton strips, red warning lights, white lamps, yellow dock lights, orange engines).
 */
export const HELVELA_URL = '/assets/models/helvela.glb';

/**
 * Procedural hull plating (the source shipped without textures): a triplanar grid in the model's own
 * units, so the panels ride with the ship. Each panel gets its own tone and roughness, seams are thin
 * dark lines, and a few panels are darker service hatches. The face normal comes from screen-space
 * derivatives because the mesh has no normals. Costs a handful of ALU ops, no texture taps.
 */
/**
 * The GLB is quantized (positions normalised to ±1 per mesh), so raw positions are not model units.
 * Store each vertex in the model's native frame once, as a float attribute the panel shader reads.
 * The geometry is shared by every clone, so this runs once per load.
 */
function addHullPositions(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const m = new THREE.Matrix4();
  const v = new THREE.Vector3();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || mesh.geometry.getAttribute('hullPos')) return;
    const pos = mesh.geometry.getAttribute('position');
    m.multiplyMatrices(inv, mesh.matrixWorld);
    const out = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i += 1) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      out[i * 3] = v.x;
      out[i * 3 + 1] = v.y;
      out[i * 3 + 2] = v.z;
    }
    mesh.geometry.setAttribute('hullPos', new THREE.BufferAttribute(out, 3));
  });
}

function panelHull(shader: { vertexShader: string; fragmentShader: string }): void {
  shader.vertexShader = shader.vertexShader
    .replace(
      '#include <common>',
      '#include <common>\nattribute vec3 hullPos;\nvarying vec3 vHullPos;',
    )
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHullPos = hullPos;');
  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>
      varying vec3 vHullPos;
      float hullHash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
      // panel id and distance to the nearest seam for one projection plane
      vec3 hullPanel(vec2 p, vec2 size) {
        vec2 q = p / size;
        vec2 id = floor(q);
        // stagger alternate rows like real plating
        q.x += 0.5 * mod(id.y, 2.0);
        id = floor(q);
        vec2 f = fract(q);
        vec2 edge = min(f, 1.0 - f) * size;
        return vec3(hullHash(id), hullHash(id + 17.0), min(edge.x, edge.y));
      }`,
    )
    .replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      vec3 hn = abs(normalize(cross(dFdx(vHullPos), dFdy(vHullPos))));
      vec3 panel = hn.y > max(hn.x, hn.z) ? hullPanel(vHullPos.xz, vec2(9.0, 4.5))
                 : hn.x > hn.z ? hullPanel(vHullPos.zy, vec2(4.5, 3.0))
                 : hullPanel(vHullPos.xy, vec2(9.0, 3.0));
      // seam: ~0.12 model units wide, softened by the pixel footprint so it never aliases
      float px = length(fwidth(vHullPos)) * 0.7;
      float seam = smoothstep(0.06, 0.06 + px + 0.05, panel.z);
      float tone = 0.86 + 0.24 * panel.x;
      float hatch = step(0.93, panel.y) * 0.45;
      diffuseColor.rgb *= tone * (1.0 - hatch) * mix(0.58, 1.0, seam);
      float hullRough = 0.75 + 0.5 * panel.y;`,
    )
    .replace(
      '#include <roughnessmap_fragment>',
      `#include <roughnessmap_fragment>
      roughnessFactor = clamp(roughnessFactor * hullRough + (1.0 - seam) * 0.3, 0.05, 1.0);`,
    );
}
export { HELVELA } from './helvelaDimensions.ts';

const LIGHTS: Record<string, { color: string; intensity: number }> = {
  'SG-LightW': { color: '#ffffff', intensity: 2.2 },
  'LIGHTKRAFT GRAVITON': { color: '#22d8e8', intensity: 2.4 },
  'ORDNUNGSKRAFT Graviton': { color: '#ff2a1a', intensity: 2 },
  'JÄGERDOCK LICHT': { color: '#e8ec6a', intensity: 1.6 },
};
const ENGINE = 'Engine';

interface Props {
  readonly engine?: EngineLevel;
  readonly position?: [number, number, number];
  readonly rotation?: [number, number, number];
  readonly children?: ReactNode;
}

const ORIGIN: [number, number, number] = [0, 0, 0];

export const HelVela = forwardRef<THREE.Group, Props>(function HelVela(
  { engine, position = ORIGIN, rotation = ORIGIN, children },
  ref,
) {
  const gl = useThree((s) => s.gl);
  const { scene } = useGLTF(HELVELA_URL, false, true, gltfExtender(gl));

  const { model, hull, engineMat, lights } = useMemo(() => {
    const hullMat = new THREE.MeshStandardMaterial({
      color: '#6b717a',
      // moderately metallic: at night a mirror-like hull reflects only black sky
      metalness: 0.5,
      roughness: 0.46,
      flatShading: true,
      side: THREE.DoubleSide,
    });
    hullMat.onBeforeCompile = panelHull;
    hullMat.customProgramCacheKey = () => 'helvela-panels';
    const engineMaterial = new THREE.MeshStandardMaterial({
      color: '#000000',
      emissive: '#ff5a1a',
      emissiveIntensity: 1,
      flatShading: true,
    });
    const lightMats = Object.entries(LIGHTS).map(
      ([name, l]) =>
        [
          name.trim(),
          new THREE.MeshStandardMaterial({
            color: '#000000',
            emissive: l.color,
            emissiveIntensity: l.intensity,
            flatShading: true,
          }),
        ] as const,
    );
    const byName = new Map<string, THREE.Material>(lightMats);
    addHullPositions(scene);
    const c = scene.clone(true);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const name = (m.material as THREE.Material).name.trim();
      m.material = name === ENGINE ? engineMaterial : (byName.get(name) ?? hullMat);
      m.castShadow = false;
      m.receiveShadow = false;
    });
    // centre on the keel, scale to the hero length (bow stays toward -x)
    c.scale.setScalar(HELVELA.scale);
    c.position.set(
      -HELVELA.nativeCentre[0] * HELVELA.scale,
      -HELVELA.nativeBottom * HELVELA.scale,
      -HELVELA.nativeCentre[2] * HELVELA.scale,
    );
    const g = new THREE.Group();
    g.add(c);
    return {
      model: g,
      hull: hullMat,
      engineMat: engineMaterial,
      lights: lightMats.map(([, m]) => m),
    };
  }, [scene]);
  useDisposeOnUnmount(hull, engineMat, ...lights);

  const last = useRef(-1);
  useFrame(() => {
    const e = engine?.current ?? 0;
    if (Math.abs(e - last.current) < 1e-3) return;
    last.current = e;
    engineMat.emissiveIntensity = 0.6 + 3.2 * e;
  });

  return (
    <group ref={ref} position={position} rotation={rotation} name="Ship">
      <primitive object={model} />
      {children}
    </group>
  );
});
