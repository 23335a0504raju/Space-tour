import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { gltfExtender } from '../../engine/assets/loaders.ts';
import type { JourneyFrame } from '../contract.ts';

/**
 * One anime-world model (SC11), fitted by measurement: the Sketchfab exports come in every scale
 * and unit (a character 0.02 or 130 units tall), so each is measured after skinning and scaled so
 * its height (or longest side) is `size` metres, centred, with its feet on y = 0 of the group.
 * Skinned models are cloned with SkeletonUtils (neighbouring chapters mount at the same time).
 * Ambient motion only (the looping pose clips, a slow spin, a bob): never story state.
 */
export const ANIME_MODELS = {
  naruto: '/assets/models/anime_naruto.glb',
  ichiraku: '/assets/models/anime_ichiraku.glb',
  deathNote: '/assets/models/anime_deathnote.glb',
  ryuk: '/assets/models/anime_ryuk.glb',
  kinnaird: '/assets/models/anime_kinnaird.glb',
  tanjiro: '/assets/models/anime_tanjiro.glb',
  nezuko: '/assets/models/anime_nezuko.glb',
  katana: '/assets/models/anime_katana.glb',
  farm: '/assets/models/anime_farm.glb',
} as const;

interface Props {
  readonly url: string;
  /** metres: the model's height, or its longest side with fit="max" */
  readonly size: number;
  readonly fit?: 'height' | 'max';
  readonly position: readonly [number, number, number];
  readonly rotationY?: number;
  /** slow spin about the vertical (rad/s) and a gentle bob (m) */
  readonly spin?: number;
  readonly bob?: number;
  /** play the model's `Anim_*` clips on a loop */
  readonly animate?: boolean;
  readonly id: string;
  readonly frame: JourneyFrame;
}

const box = new THREE.Box3();
const dims = new THREE.Vector3();
const centre = new THREE.Vector3();

export function AnimeModel({
  url,
  size,
  fit = 'height',
  position,
  rotationY = 0,
  spin = 0,
  bob = 0,
  animate = false,
  id,
  frame,
}: Props) {
  const gl = useThree((s) => s.gl);
  const gltf = useGLTF(url, false, true, gltfExtender(gl));
  const built = useMemo(() => {
    const root = cloneSkinned(gltf.scene);
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      // normals were dropped for welding and simplifying (scripts/optimize-anime.ts)
      if (!mesh.geometry.getAttribute('normal')) mesh.geometry.computeVertexNormals();
      mesh.frustumCulled = false;
    });
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      const skinned = o as THREE.SkinnedMesh;
      if (skinned.isSkinnedMesh) {
        skinned.skeleton.update();
        skinned.computeBoundingBox();
      }
    });
    box.setFromObject(root);
    box.getSize(dims);
    box.getCenter(centre);
    const base = fit === 'height' ? dims.y : Math.max(dims.x, dims.y, dims.z);
    const scale = base > 0 ? size / base : 1;
    const holder = new THREE.Group();
    holder.add(root);
    root.position.set(-centre.x * scale, -box.min.y * scale, -centre.z * scale);
    root.scale.multiplyScalar(scale);
    const clips = gltf.animations.filter((a) => a.name.includes('Anim_'));
    return { holder, root, clips };
  }, [gltf, size, fit]);

  const mixer = useMemo(() => {
    if (!animate || built.clips.length === 0) return null;
    const m = new THREE.AnimationMixer(built.root);
    for (const clip of built.clips) m.clipAction(clip).play();
    return m;
  }, [animate, built]);

  // per-clone GPU resources: each skeleton owns a bone texture
  useEffect(
    () => () => {
      mixer?.stopAllAction();
      built.root.traverse((o) => {
        const skinned = o as THREE.SkinnedMesh;
        if (skinned.isSkinnedMesh) skinned.skeleton.dispose();
      });
    },
    [built, mixer],
  );

  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (frame.id !== id || !group.current) return;
    mixer?.update(Math.min(delta, 0.1));
    if (spin) group.current.rotation.y += delta * spin;
    if (bob) group.current.position.y = position[1] + Math.sin(performance.now() / 1000) * bob;
  });
  return (
    <group ref={group} position={[...position]} rotation={[0, rotationY, 0]}>
      <primitive object={built.holder} />
    </group>
  );
}
