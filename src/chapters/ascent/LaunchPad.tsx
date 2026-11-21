import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { gltfExtender } from '../../engine/assets/loaders.ts';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';

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
  /** the circular deck (~66 m across) must be wider than the 60 m hull, or the ship hangs off it */
  scale: 22,
  /** model y of the bowl rim: it sits just above the ground, so the bowl reads as a launch pit
   *  (at this scale the rim stands 11 m over the inner deck and would hide the 6 m tall hull) */
  rimY: 1.15,
  /** model y of the inner deck (the pit floor the cradles stand on) */
  deckY: 0.65,
  /** model radius of the pit opening: the ground is cut away inside it */
  pitRadius: 1.45,
  /** yaw (rad) turning the runway (+z in the model) toward -x */
  yaw: Math.PI / 2,
  /** model-space centre of the well, in x and z */
  centre: [0, 0.2] as const,
} as const;

/** World placement derived from PLATFORM (metres). */
export const PIT = {
  offset: 0.6 - PLATFORM.rimY * PLATFORM.scale,
  floorY: 0.6 - (PLATFORM.rimY - PLATFORM.deckY) * PLATFORM.scale,
  radius: PLATFORM.pitRadius * PLATFORM.scale,
} as const;

/** Guide lights around the pit opening: alternating white and cyan, one draw call. */
const RIM_LIGHTS = 72;
function RimLights() {
  const geometry = useMemo(() => new THREE.BoxGeometry(0.7, 0.22, 0.7), []);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);
  useDisposeOnUnmount(geometry, material);
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const mx = new THREE.Matrix4();
    const white = new THREE.Color(2.2, 2.3, 2.5);
    const cyan = new THREE.Color(0.5, 1.9, 2.4);
    for (let i = 0; i < RIM_LIGHTS; i += 1) {
      const a = (i / RIM_LIGHTS) * Math.PI * 2;
      mx.makeRotationY(-a).setPosition(
        Math.cos(a) * (PIT.radius + 0.6),
        0.75,
        Math.sin(a) * (PIT.radius + 0.6),
      );
      m.setMatrixAt(i, mx);
      m.setColorAt(i, i % 3 === 0 ? cyan : white);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, []);
  return <instancedMesh ref={ref} args={[geometry, material, RIM_LIGHTS]} />;
}

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
      // charcoal plating: the pale source albedo read as flat grey under the floods
      mat.color.multiplyScalar(0.5);
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
        position={[-48, 30, 62]}
        color="#bcd0ff"
        intensity={52000}
        distance={240}
        decay={2}
      />
      <pointLight
        position={[48, 30, 62]}
        color="#ffd9a8"
        intensity={40000}
        distance={240}
        decay={2}
      />
      <RimLights />
      <group rotation={[0, PLATFORM.yaw, 0]} position={[0, PIT.offset, 0]} scale={s}>
        <primitive object={model} position={[-PLATFORM.centre[0], 0, -PLATFORM.centre[1]]} />
      </group>
    </>
  );
}
