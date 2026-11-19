import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { gltfExtender } from '../../engine/assets/loaders.ts';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { BRIDGE } from './layout.ts';

/**
 * The launch-control bridge around the developer's desk (SC02/SC03): "SF bridge console /
 * 科幻風艦橋" by 林柏勳 (Lin), Sketchfab, CC BY 4.0 (asset A036; credit in the Mission Brief).
 * Optimised by `node scripts/optimize-bridge.ts`: an opaque shell material and a transparent
 * hologram material (the globe and its rings).
 *
 * The hologram's rotation clip is ambient motion (wall-clock time), like the typing loop: it carries
 * no story meaning, so it may run on the clock without breaking reverse scrolling.
 */
export const BRIDGE_URL = '/assets/models/bridge.glb';

/** Multiplied into the shell's (pale tile) colour map: dark deck and walls, glow panels untouched. */
const SHELL_TINT = '#5d646f';

export function Bridge() {
  const gl = useThree((s) => s.gl);
  const { scene, animations } = useGLTF(BRIDGE_URL, false, true, gltfExtender(gl));

  const { model, materials, mixer } = useMemo(() => {
    const c = scene.clone(true);
    const owned: THREE.Material[] = [];
    const swap = new Map<THREE.Material, THREE.Material>();
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const src = m.material as THREE.MeshStandardMaterial;
      let mat = swap.get(src);
      if (!mat) {
        const copy = src.clone();
        if (src.name === 'Bridge_Shell') copy.color.set(SHELL_TINT);
        else copy.depthWrite = false; // hologram: transparent glass over the deck
        swap.set(src, copy);
        owned.push(copy);
        mat = copy;
      }
      m.material = mat;
      m.receiveShadow = true;
    });
    const mx = new THREE.AnimationMixer(c);
    for (const clip of animations) mx.clipAction(clip).play();
    return { model: c, materials: owned, mixer: mx };
  }, [scene, animations]);
  useDisposeOnUnmount(...materials);
  useEffect(() => () => void mixer.stopAllAction(), [mixer]);

  useFrame((_, delta) => mixer.update(delta));

  return (
    <primitive
      object={model}
      position={BRIDGE.position}
      rotation={[0, BRIDGE.rotationY, 0]}
      scale={BRIDGE.scale}
    />
  );
}
