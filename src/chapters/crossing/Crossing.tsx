import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { createAnomalyMaterial, createTunnelMaterial } from '../../shaders/crossing.ts';
import type { ChapterImpl, ChapterSceneProps } from '../contract.ts';
import { Starfield, seeded } from '../greybox/parts.tsx';
import { PAINTED_CLOUDS, SUN_BEYOND } from '../anime/clouds.ts';
import { Clouds } from '../anime/parts.tsx';
import { HelVela } from '../ship/HelVela.tsx';
import { GATE, TUNNEL, T_GATE, crossingShot, gateOpen, shipZ, styleAt } from './crossing.ts';

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
  const anomaly = useMemo(() => createAnomalyMaterial(), []);
  const tunnel = useMemo(() => createTunnelMaterial(), []);
  useDisposeOnUnmount(anomaly, tunnel);
  const ship = useRef<THREE.Group>(null);
  const light = useRef<THREE.DirectionalLight>(null);
  const sunTarget = useMemo(() => new THREE.Object3D(), []);
  const ring = useRef<THREE.Mesh>(null);
  const tunnelGroup = useRef<THREE.Group>(null);
  const beyond = useRef<THREE.Group>(null);
  useFrame(({ clock }, delta) => {
    // story: ship position, gate opening, light follows the ship
    if (frame.id === id) {
      const z = shipZ(frame.t);
      ship.current?.position.set(0, 0, z);
      light.current?.position.set(SUN_DIR[0] ?? 0, SUN_DIR[1] ?? 0, (SUN_DIR[2] ?? 0) + z);
      sunTarget.position.set(0, 0, z);
      anomaly.uniforms['uOpen']!.value = gateOpen(frame.t);
      // the far side stays hidden until the ship is about to enter (pure function of t)
      if (tunnelGroup.current) tunnelGroup.current.visible = frame.t > T_GATE - 0.06;
      if (beyond.current) beyond.current.visible = frame.t > T_GATE;
    }
    // ambient: swirl and tunnel flow
    anomaly.uniforms['uTime']!.value = clock.elapsedTime;
    tunnel.uniforms['uTime']!.value = clock.elapsedTime;
    if (ring.current) ring.current.rotation.z -= delta * 0.35;
  });
  const tunnelLen = TUNNEL.start - TUNNEL.end;
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

      {/* the gate */}
      <group position={[0, 0, GATE.z]}>
        <mesh>
          <torusGeometry args={[GATE.radius, 0.55, 16, 128]} />
          <meshBasicMaterial
            color={new THREE.Color('#d6a756').multiplyScalar(1.4)}
            toneMapped={false}
          />
        </mesh>
        <mesh ref={ring}>
          <torusGeometry args={[GATE.radius * 1.12, 0.18, 8, 96]} />
          <meshBasicMaterial
            color={new THREE.Color('#9fd0ff').multiplyScalar(1.2)}
            toneMapped={false}
          />
        </mesh>
        <mesh material={anomaly}>
          <circleGeometry args={[GATE.radius, 96]} />
        </mesh>
      </group>

      {/* the tunnel behind the gate */}
      <group ref={tunnelGroup} visible={false}>
        <mesh
          position={[0, 0, (TUNNEL.start + TUNNEL.end) / 2]}
          rotation={[Math.PI / 2, 0, 0]}
          material={tunnel}
        >
          <cylinderGeometry args={[TUNNEL.radius, TUNNEL.radius, tunnelLen, 48, 1, true]} />
        </mesh>
      </group>

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
