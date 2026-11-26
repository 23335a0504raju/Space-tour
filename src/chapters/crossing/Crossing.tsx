import { useMemo, useRef, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import type { ChapterImpl, ChapterSceneProps } from '../contract.ts';
import { Starfield, seeded } from '../greybox/parts.tsx';
import { PAINTED_CLOUDS, SUN_BEYOND } from '../anime/clouds.ts';
import { Clouds, PaintedSun } from '../anime/parts.tsx';
import { HelVela } from '../ship/HelVela.tsx';
import { SolarSystem } from './SolarSystem.tsx';
import { LIGHT_10, TRAVEL_STARS, smooth } from '../handoff.ts';
import { TRAVEL_SKY } from '../space/skyFrame.ts';
import { BlackHole } from './BlackHole.tsx';
import {
  GATE,
  HOLE_RADIUS,
  TUNNEL,
  crossingShot,
  holeRadiusAt,
  gateOpen,
  shipZ,
  spaceSkyAt,
  styleAt,
} from './crossing.ts';

/**
 * SC10 · The Edge & The Crossing (FINAL_STORYLINE SC10). A quiet, cold edge of the system → the
 * gate → a tunnel → a painted sky. The re-drawing (line art, then cel colour) is the screen-space
 * style pass driven by `style()`; this scene only provides the world it acts on.
 */
const ENGINE = { current: 0.5 };
const SUN_DIR = new THREE.Vector3(...LIGHT_10.direction).normalize().multiplyScalar(100).toArray();

/** Sparse icy debris near the flight line, so the edge reads as cold and empty (parallax only). */
function EdgeDust({ id, frame }: ChapterSceneProps) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const rand = seeded(17);
    const n = 700;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 1) {
      pos[i * 3] = (rand() - 0.5) * 220;
      pos[i * 3 + 1] = (rand() - 0.5) * 60;
      pos[i * 3 + 2] = 40 - rand() * 160;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  const mat = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: '#9fb4d0',
        size: 2,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      }),
    [],
  );
  useDisposeOnUnmount(geo, mat);
  // fades in after the boundary (SC09 has no dust: nothing may pop in at the cut)
  useFrame(() => {
    if (frame.id === id) mat.opacity = 0.6 * smooth(frame.t / 0.08) * spaceSkyAt(frame.t);
  });
  return <points geometry={geo} material={mat} frustumCulled={false} />;
}

function CrossingScene({ id, frame }: ChapterSceneProps) {
  const ship = useRef<THREE.Group>(null);
  const light = useRef<THREE.DirectionalLight>(null);
  const sunTarget = useMemo(() => new THREE.Object3D(), []);
  const beyond = useRef<THREE.Group>(null);
  const stars = useMemo(() => ({ current: 1 }), []);
  useFrame(({ camera }) => {
    if (frame.id !== id) return;
    stars.current = spaceSkyAt(frame.t);
    // story: ship position, light follows the ship
    const z = shipZ(frame.t);
    ship.current?.position.set(0, 0, z);
    light.current?.position.set(SUN_DIR[0] ?? 0, SUN_DIR[1] ?? 0, (SUN_DIR[2] ?? 0) + z);
    sunTarget.position.set(0, 0, z);
    // the far side stays hidden until the camera nears the mouth (pure function of t)
    if (beyond.current)
      beyond.current.visible = camera.position.z < GATE.z - 0.5 * (TUNNEL.start - TUNNEL.end);
  });
  return (
    <group>
      <Starfield {...TRAVEL_STARS} follow orient={TRAVEL_SKY} fade={stars} fadeSky />
      {/* the Sun and the eight planets behind us: the look back (solarSystem.ts) */}
      <Suspense fallback={null}>
        <SolarSystem />
      </Suspense>
      <EdgeDust id={id} frame={frame} />
      <directionalLight
        ref={light}
        target={sunTarget}
        color={LIGHT_10.color}
        intensity={LIGHT_10.intensity}
      />
      <primitive object={sunTarget} />
      <hemisphereLight args={[LIGHT_10.sky, LIGHT_10.ground, LIGHT_10.ambient]} />

      <BlackHole
        id={id}
        frame={frame}
        z={GATE.z}
        radius={HOLE_RADIUS}
        radiusAt={holeRadiusAt}
        tunnel={TUNNEL}
        open={gateOpen}
      />

      {/* the world beyond: a big warm sun and painted clouds */}
      <group ref={beyond} visible={false}>
        <PaintedSun radius={34} position={SUN_BEYOND} halo={false} />
        <Clouds items={PAINTED_CLOUDS} />
      </group>

      <HelVela ref={ship} engine={ENGINE} rotation={[0, -Math.PI / 2, 0]} />
    </group>
  );
}

export const sc10Crossing: ChapterImpl = {
  Scene: CrossingScene,
  shot: crossingShot,
  style: styleAt,
  background: '#020308',
};
