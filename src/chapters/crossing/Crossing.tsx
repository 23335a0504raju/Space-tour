import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import type { ChapterImpl, ChapterSceneProps } from '../contract.ts';
import { Starfield, seeded } from '../greybox/parts.tsx';
import { PAINTED_CLOUDS, SUN_BEYOND } from '../anime/clouds.ts';
import { Clouds } from '../anime/parts.tsx';
import { HelVela } from '../ship/HelVela.tsx';
import { BlackHole } from './BlackHole.tsx';
import { GATE, TUNNEL, crossingShot, holeRadiusAt, gateOpen, shipZ, styleAt } from './crossing.ts';

/**
 * SC10 · The Edge & The Crossing (FINAL_STORYLINE SC10). A quiet, cold edge of the system → the
 * gate → a tunnel → a painted sky. The re-drawing (line art, then cel colour) is the screen-space
 * style pass driven by `style()`; this scene only provides the world it acts on.
 */
const ENGINE = { current: 0.5 };
const SUN_DIR = new THREE.Vector3(0.5, 0.35, 0.75).normalize().multiplyScalar(100).toArray();

/** Sparse icy debris near the flight line, so the edge reads as cold and empty (parallax only). */
function EdgeDust() {
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
  return <points geometry={geo} material={mat} frustumCulled={false} />;
}

function CrossingScene({ id, frame }: ChapterSceneProps) {
  const ship = useRef<THREE.Group>(null);
  const light = useRef<THREE.DirectionalLight>(null);
  const sunTarget = useMemo(() => new THREE.Object3D(), []);
  const beyond = useRef<THREE.Group>(null);
  useFrame(({ camera }) => {
    if (frame.id !== id) return;
    // story: ship position, light follows the ship
    const z = shipZ(frame.t);
    ship.current?.position.set(0, 0, z);
    light.current?.position.set(SUN_DIR[0] ?? 0, SUN_DIR[1] ?? 0, (SUN_DIR[2] ?? 0) + z);
    sunTarget.position.set(0, 0, z);
    // the far side stays hidden until the camera is well into the fall (pure function of t)
    if (beyond.current)
      beyond.current.visible = camera.position.z < GATE.z - 0.55 * (TUNNEL.start - TUNNEL.end);
  });
  return (
    <group>
      <Starfield count={2200} radius={1500} seed={71} />
      {/* the Sun, far behind: a small cold star */}
      <mesh position={[-300, 120, 1500]}>
        <sphereGeometry args={[5, 12, 8]} />
        <meshBasicMaterial color={new THREE.Color(3, 2.6, 2.2)} toneMapped={false} />
      </mesh>
      <EdgeDust />
      <directionalLight ref={light} target={sunTarget} color="#dfe8ff" intensity={2.2} />
      <primitive object={sunTarget} />
      <hemisphereLight args={['#4a5f8a', '#06070b', 0.5]} />

      <BlackHole
        id={id}
        frame={frame}
        z={GATE.z}
        radius={16}
        radiusAt={holeRadiusAt}
        tunnel={TUNNEL}
        open={gateOpen}
      />

      {/* the world beyond: a big warm sun and painted clouds */}
      <group ref={beyond} visible={false}>
        <mesh position={[...SUN_BEYOND]}>
          <sphereGeometry args={[34, 24, 16]} />
          <meshBasicMaterial color={new THREE.Color(2.2, 1.7, 1.2)} toneMapped={false} />
        </mesh>
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
