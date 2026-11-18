import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { gltfExtender } from '../../engine/assets/loaders.ts';
import { measureClipWalk } from '../../engine/characters/clipSpeed.ts';
import { useJourneyStore } from '../../engine/store.ts';
import type { JourneyFrame } from '../contract.ts';
import { dressAstronaut } from './suit.ts';

/**
 * The astronaut: Mixamo "Y Bot" rig + clips (converted by scripts/convert-mixamo.ts), dressed in
 * code as a flight suit with a gold-visor helmet (faceless, decision C23); see suit.ts.
 * Story motion is driven per chapter by a pure function of story time (see `Drive`).
 */
export const ASTRONAUT_URL = '/assets/models/astronaut.glb';
export type ClipName = 'typing' | 'sitIdle' | 'walk' | 'standUp' | 'sitDown';
const CLIPS: readonly ClipName[] = ['typing', 'sitIdle', 'walk', 'standUp', 'sitDown'];

export interface AstronautApi {
  /** Set a clip's time (seconds) and weight for this frame. Unset clips have weight 0. */
  set(name: ClipName, time: number, weight: number): void;
  duration(name: ClipName): number;
  /** Ground speed implied by the walk clip (m/s), measured from the toe bones. */
  readonly walkSpeed: number;
}

/**
 * Called every frame while the chapter is active. Must be a pure function of `t` for story motion
 * (reverse scrolling); `elapsed` (wall clock) is allowed only for ambient loops such as typing.
 */
export type Drive = (t: number, api: AstronautApi, body: THREE.Group, elapsed: number) => void;

interface Props {
  readonly chapterId: string;
  readonly frame: JourneyFrame;
  readonly drive: Drive;
}

export function Astronaut({ chapterId, frame, drive }: Props) {
  const gl = useThree((s) => s.gl);
  const shadows = useJourneyStore((s) => s.tier === 'balanced');
  const gltf = useGLTF(ASTRONAUT_URL, false, true, gltfExtender(gl));
  const body = useRef<THREE.Group>(null);

  // Skinned meshes must be cloned with SkeletonUtils (neighbouring chapters mount simultaneously).
  const model = useMemo(() => {
    const c = cloneSkinned(gltf.scene);
    dressAstronaut(c, shadows);
    return c;
  }, [gltf.scene, shadows]);
  const mixer = useMemo(() => new THREE.AnimationMixer(model), [model]);
  // Per-clone GPU resources: each skeleton owns a bone texture. Release them when the chapter
  // unmounts (geometry and materials are shared and stay cached).
  // (No mixer.uncacheRoot here: StrictMode's mount → cleanup → mount kept the same `actions`
  // and the second mount's play() crashed on uncached actions. The mixer is garbage with the
  // model. skeleton.dispose() is safe: three rebuilds the bone texture on the next render.)
  useEffect(
    () => () => {
      model.traverse((o) => {
        const m = o as THREE.SkinnedMesh;
        if (m.isSkinnedMesh) m.skeleton.dispose();
      });
    },
    [model, mixer],
  );
  const actions = useMemo(() => {
    const map = new Map<ClipName, THREE.AnimationAction>();
    for (const name of CLIPS) {
      const clip = gltf.animations.find((a) => a.name === name);
      if (clip) map.set(name, mixer.clipAction(clip));
    }
    return map;
  }, [gltf.animations, mixer]);

  const walkSpeed = useMemo(() => {
    const walk = actions.get('walk');
    const left =
      model.getObjectByName('mixamorigLeftToeBase') ?? model.getObjectByName('mixamorigLeftFoot');
    const right =
      model.getObjectByName('mixamorigRightToeBase') ?? model.getObjectByName('mixamorigRightFoot');
    if (!walk || !left || !right) return 0;
    const others = [...actions.values()].filter((a) => a !== walk);
    return measureClipWalk(model, mixer, walk, others, left, right).speed;
  }, [actions, model, mixer]);

  const api = useMemo<AstronautApi>(
    () => ({
      set(name, time, weight) {
        const a = actions.get(name);
        if (!a) return;
        a.time = time;
        a.setEffectiveWeight(weight);
      },
      duration: (name) => actions.get(name)?.getClip().duration ?? 1,
      walkSpeed,
    }),
    [actions, walkSpeed],
  );

  const pose = (t: number, elapsed: number) => {
    const g = body.current;
    if (!g) return;
    for (const a of actions.values()) a.setEffectiveWeight(0);
    drive(t, api, g, elapsed);
    mixer.update(0);
  };

  // Start/stop in one effect (StrictMode-safe, spike S2 lesson); pose once so a warm (hidden)
  // chapter is already in its first pose when it becomes active.
  useEffect(() => {
    for (const a of actions.values()) a.play();
    pose(0, 0);
    return () => void mixer.stopAllAction();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions, mixer]);

  useFrame(({ clock }) => {
    if (frame.id !== chapterId) return;
    pose(frame.t, clock.elapsedTime);
  });

  return (
    <group ref={body}>
      <primitive object={model} />
    </group>
  );
}
