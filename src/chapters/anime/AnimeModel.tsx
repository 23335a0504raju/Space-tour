import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { gltfExtender } from '../../engine/assets/loaders.ts';
import type { JourneyFrame } from '../contract.ts';
import { hazed } from './haze.ts';
import type { Haze } from './haze.ts';
import { painted } from './painted.ts';
import type { Paint } from './painted.ts';

/**
 * One anime-world model (SC11), fitted by measurement: the Sketchfab exports come in every scale
 * and unit (a character 0.02 or 130 units tall), so each is measured after skinning and scaled so
 * its height (or longest side) is `size` metres, centred, with its feet on y = 0 of the group.
 * Everything stands on the ground: nothing hovers or spins (Raju, 2026-11-27).
 * Skinned models are cloned with SkeletonUtils (neighbouring chapters mount at the same time).
 * Ambient motion only (looping pose clips): never story state.
 */
export const ANIME_MODELS = {
  village: '/assets/models/anime_village.glb',
  sage: '/assets/models/anime_sage.glb',
  itachi: '/assets/models/anime_itachi.glb',
  jiraiya: '/assets/models/anime_jiraiya.glb',
  pain: '/assets/models/anime_pain.glb',
  obito: '/assets/models/anime_obito.glb',
  inosuke: '/assets/models/anime_inosuke.glb',
  deathNote: '/assets/models/anime_deathnote.glb',
  ryuk: '/assets/models/anime_ryuk.glb',
  kinnaird: '/assets/models/anime_kinnaird.glb',
  tanjiro: '/assets/models/anime_tanjiro.glb',
  nezuko: '/assets/models/anime_nezuko.glb',
  katana: '/assets/models/anime_katana.glb',
  farm: '/assets/models/anime_farm.glb',
  town: '/assets/models/anime_town.glb',
  rural: '/assets/models/anime_rural.glb',
} as const;

interface Props {
  readonly url: string;
  /**
   * metres: the model's height, or its longest side with fit="max"; with fit="none" it is a plain
   * scale factor and the model keeps its own origin (a measured placement, layout.ts TOWN)
   */
  readonly size: number;
  readonly fit?: 'height' | 'max' | 'none';
  readonly position: readonly [number, number, number];
  readonly rotationY?: number;
  /** play the model's `Anim_*` clips on a loop */
  readonly animate?: boolean;
  /** fade into this world's horizon (haze.ts) */
  readonly haze?: Haze;
  /** paint it (painted.ts) in place of the chapter's lighting; needs `haze` */
  readonly paint?: Paint;
  /** static props: let three cull them (skinned models stay unculled: their bounds lie) */
  readonly cull?: boolean;
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
  animate = false,
  haze,
  paint,
  cull = false,
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
      mesh.frustumCulled = cull && !(mesh as THREE.SkinnedMesh).isSkinnedMesh;
      if (haze) {
        const skin = (m: THREE.Material) => (paint ? painted(m, haze, paint) : hazed(m, haze));
        mesh.material = Array.isArray(mesh.material)
          ? mesh.material.map(skin)
          : skin(mesh.material);
      }
    });
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      const skinned = o as THREE.SkinnedMesh;
      if (skinned.isSkinnedMesh) {
        skinned.skeleton.update();
        skinned.computeBoundingBox();
      }
    });
    if (fit === 'none') {
      root.scale.multiplyScalar(size);
      const holder = new THREE.Group();
      holder.add(root);
      return { holder, root, clips: [] as THREE.AnimationClip[] };
    }
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
  }, [gltf, size, fit, haze, paint, cull]);

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

  useFrame((_, delta) => {
    if (frame.id !== id) return;
    mixer?.update(Math.min(delta, 0.1));
  });
  return (
    <group position={[...position]} rotation={[0, rotationY, 0]}>
      <primitive object={built.holder} />
    </group>
  );
}
