import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { lensState } from '../../shaders/lens.ts';
import { useJourneyStore } from '../../engine/store.ts';
import {
  BLACK_HOLE_EXTENT,
  createBlackHoleMaterial,
  createFallMaterial,
} from '../../shaders/crossing.ts';
import type { JourneyFrame } from '../contract.ts';

/**
 * The black hole shared by SC10 (The Crossing) and SC12 (The Return): a camera-facing quad with
 * the horizon, photon ring and lensed accretion disk (`createBlackHoleMaterial`), and the fall
 * (`createFallMaterial`) that takes over once the camera is swallowed. Everything is a pure
 * function of the camera position and `open(t)`; only the disk rotation and light flow use the
 * clock, and they carry no story meaning.
 */
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

interface Props {
  readonly id: string;
  readonly frame: JourneyFrame;
  readonly z: number;
  /** Largest world radius of the event horizon (sizes the quad). */
  readonly radius: number;
  /** Horizon radius as a function of the chapter's t (it grows as the story approaches). */
  readonly radiusAt?: (t: number) => number;
  readonly tunnel: { readonly start: number; readonly end: number; readonly radius: number };
  /** Disk ignition 0..1 as a function of the chapter's local t. */
  readonly open: (t: number) => number;
  /** Multiplier for the flow of light in the fall. */
  readonly flow?: number;
}

export function BlackHole({ id, frame, z, radius, radiusAt, tunnel, open, flow = 1 }: Props) {
  const low = useJourneyStore((s) => s.tier !== 'balanced');
  const hole = useMemo(() => createBlackHoleMaterial(low), [low]);
  const fall = useMemo(() => createFallMaterial(), []);
  useDisposeOnUnmount(hole, fall);
  const quad = useRef<THREE.Mesh>(null);
  const fallGroup = useRef<THREE.Group>(null);
  const size = radius * BLACK_HOLE_EXTENT * 2;
  const length = tunnel.start - tunnel.end;

  const probe = useMemo(() => new THREE.Vector3(), []);
  const ahead = useMemo(() => new THREE.Vector3(), []);
  const toHole = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock, camera, size: viewport }) => {
    if (frame.id === id) {
      hole.uniforms['uOpen']!.value = open(frame.t);
      const R = radiusAt ? radiusAt(frame.t) : radius;
      const cz = camera.position.z;
      const d = Math.hypot(camera.position.x, camera.position.y, cz - z);
      // Swallowing is a cross-fade: while the horizon covers the view (d between 0.2 and 1.0 of its
      // radius) the hole quad fades out and the fall fades in, so there is never a black gap.
      const swallow = smoothstep(0.2 * R, R, d);
      const reveal = cz > z ? 1 - swallow : 1 - smoothstep(0.85, 1, (z - cz) / length);
      hole.uniforms['uFade']!.value = cz > z ? swallow : 0;
      if (quad.current) {
        quad.current.quaternion.copy(camera.quaternion);
        quad.current.scale.setScalar(R / radius);
        quad.current.visible = cz > z && d > 0.15 * R;
      }
      fall.uniforms['uReveal']!.value = reveal;
      // gravitational lensing of the sky: the Einstein ring (in screen-height units) grows as the
      // camera nears and is released once the camera is swallowed
      const persp = camera as THREE.PerspectiveCamera;
      const tanHalf = Math.tan((persp.fov * Math.PI) / 360);
      const re = (R * 1.7) / Math.max(d, 1) / (2 * tanHalf);
      // behind the camera (the look back) there is nothing to lens
      camera.getWorldDirection(ahead);
      const inFront = ahead.dot(toHole.set(0, 0, z).sub(camera.position)) > 0;
      probe.set(0, 0, z).project(camera);
      lensState.owner = id;
      lensState.x = probe.x * 0.5 + 0.5;
      lensState.y = probe.y * 0.5 + 0.5;
      lensState.aspect = viewport.width / viewport.height;
      lensState.re =
        cz > z && inFront && Number.isFinite(probe.x + probe.y) ? Math.min(0.75, re) * swallow : 0;
      if (fallGroup.current) fallGroup.current.visible = reveal > 0.002;
    } else if (lensState.owner === id) {
      lensState.re = 0;
      lensState.owner = '';
    }
    hole.uniforms['uTime']!.value = clock.elapsedTime;
    fall.uniforms['uTime']!.value = clock.elapsedTime * flow;
  });

  return (
    <>
      <mesh ref={quad} position={[0, 0, z]} material={hole} renderOrder={5}>
        <planeGeometry args={[size, size]} />
      </mesh>
      <group ref={fallGroup} visible={false}>
        <mesh
          position={[0, 0, (tunnel.start + tunnel.end) / 2]}
          rotation={[Math.PI / 2, 0, 0]}
          material={fall}
          renderOrder={-10}
        >
          <cylinderGeometry args={[tunnel.radius, tunnel.radius, length, 48, 1, true]} />
        </mesh>
      </group>
    </>
  );
}

/**
 * The same black hole seen from far away, for the chapter before (SC09, handoff.ts): the shader
 * at SC10's opening size and brightness, facing the camera. It never owns the lens: at this
 * distance SC10's Einstein ring is about 3 % of the screen height.
 */
export function DistantBlackHole({
  position,
  radius,
  size,
  open,
}: {
  position: readonly [number, number, number];
  /** apparent radius (SC10 at t = 0) */
  radius: number;
  /** the radius its quad is built for (SC10's full hole) */
  size: number;
  open: number;
}) {
  const low = useJourneyStore((s) => s.tier !== 'balanced');
  const hole = useMemo(() => createBlackHoleMaterial(low), [low]);
  useDisposeOnUnmount(hole);
  const quad = useRef<THREE.Mesh>(null);
  useFrame(({ clock, camera }) => {
    hole.uniforms['uOpen']!.value = open;
    hole.uniforms['uFade']!.value = 1;
    hole.uniforms['uTime']!.value = clock.elapsedTime;
    if (quad.current) {
      quad.current.quaternion.copy(camera.quaternion);
      quad.current.scale.setScalar(radius / size);
    }
  });
  const side = size * BLACK_HOLE_EXTENT * 2;
  return (
    <mesh ref={quad} position={[...position]} material={hole} renderOrder={5}>
      <planeGeometry args={[side, side]} />
    </mesh>
  );
}
