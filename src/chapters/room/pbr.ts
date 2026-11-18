import { useMemo } from 'react';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getKTX2Loader } from '../../engine/assets/loaders.ts';

interface PbrSet {
  readonly map: string;
  readonly normalMap: string;
  /** glTF-style packed AO (R), roughness (G), metalness (B). */
  readonly arm: string;
}

/**
 * Tiled PBR material from KTX2 maps. Each call gets its own texture clones (sharing GPU image
 * data) so different surfaces can use different repeats.
 */
/** Stable default: a new {} per render would rebuild the material every render (leak). */
const NO_OVERRIDES: Partial<THREE.MeshStandardMaterialParameters> = {};

export function usePbrMaterial(
  set: PbrSet,
  repeat: [number, number],
  overrides: Partial<THREE.MeshStandardMaterialParameters> = NO_OVERRIDES,
): THREE.MeshStandardMaterial {
  const gl = useThree((s) => s.gl);
  // the one shared KTX2Loader (a second instance triggered three's "multiple active KTX2
  // loaders" warning and a second transcoder worker pool)
  const [map, normal, arm] = useLoader(getKTX2Loader(gl), [set.map, set.normalMap, set.arm]);
  const [rx, ry] = repeat;
  const material = useMemo(() => {
    const tile = (t: THREE.Texture) => {
      const c = t.clone();
      c.wrapS = THREE.RepeatWrapping;
      c.wrapT = THREE.RepeatWrapping;
      c.repeat.set(rx, ry);
      c.anisotropy = 4;
      c.needsUpdate = true;
      return c;
    };
    if (!map || !normal || !arm) throw new Error('usePbrMaterial: texture missing');
    const armTiled = tile(arm);
    return new THREE.MeshStandardMaterial({
      map: tile(map),
      normalMap: tile(normal),
      aoMap: armTiled,
      roughnessMap: armTiled,
      metalnessMap: armTiled,
      ...overrides,
    });
  }, [map, normal, arm, rx, ry, overrides]);
  // The clones and the material are per call: release them on unmount (they leaked on every
  // room remount; found by the P4 memory check). The shared KTX2 sources stay cached.
  useDisposeOnUnmount(material.map, material.normalMap, material.aoMap, material);
  return material;
}
