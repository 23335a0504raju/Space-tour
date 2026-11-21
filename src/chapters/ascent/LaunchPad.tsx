import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { gltfExtender } from '../../engine/assets/loaders.ts';

/**
 * The SC05 launch platform: "SCI FI HANGAR" by Lezalit (Sketchfab, shown there as Kerem Kavalci),
 * CC BY 4.0 (asset A037; credit in the Mission Brief). Optimised by `node scripts/optimize-launch-pad.ts`
 * (about 27k triangles, 3 draw calls). Despite its title it is a circular launch deck with a
 * central well, a runway strip, blast fins and a support shaft.
 *
 * Model frame: the deck well is on the model's origin; the runway extends toward +z and the shaft
 * hangs below. `PLATFORM` places it in the scene: the well centre sits under the ship, the runway
 * points along the flight path (-x), and the deck top is at y = 0 (the shaft goes under the ground).
 */
export const LAUNCH_PAD_URL = '/assets/models/launch-pad.glb';

export const PLATFORM = {
  scale: 12,
  /** model y of the main deck surface (set from the render) */
  deckY: 0.68,
  /** yaw (rad) turning the runway (+z in the model) toward -x */
  yaw: Math.PI / 2,
  /** model-space centre of the well, in x and z */
  centre: [0, 0.2] as const,
} as const;

export function LaunchPad() {
  const gl = useThree((s) => s.gl);
  const { scene } = useGLTF(LAUNCH_PAD_URL, false, true, gltfExtender(gl));
  const model = useMemo(() => scene.clone(true), [scene]);
  useEffect(() => {
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.side = THREE.FrontSide;
      mat.emissiveIntensity = 1.6;
      mat.metalness = Math.min(mat.metalness, 0.45);
      mat.roughness = Math.min(mat.roughness, 0.8);
      mat.envMapIntensity = 2.5;
      mat.needsUpdate = true;
    });
  }, [model]);
  const s = PLATFORM.scale;
  return (
    <>
      {/* deck floodlights: the model has no light sources of its own */}
      <pointLight
        position={[-30, 22, 38]}
        color="#bcd0ff"
        intensity={26000}
        distance={160}
        decay={2}
      />
      <pointLight
        position={[30, 22, 38]}
        color="#ffd9a8"
        intensity={20000}
        distance={160}
        decay={2}
      />
      <group rotation={[0, PLATFORM.yaw, 0]} position={[0, -PLATFORM.deckY * s, 0]} scale={s}>
        <primitive object={model} position={[-PLATFORM.centre[0], 0, -PLATFORM.centre[1]]} />
      </group>
    </>
  );
}
