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
      color: '#7f858e',
      // moderately metallic: at night a mirror-like hull reflects only black sky
      metalness: 0.35,
      roughness: 0.5,
      flatShading: true,
      side: THREE.DoubleSide,
    });
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
