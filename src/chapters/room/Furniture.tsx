import { useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { DESK } from './layout.ts';

/**
 * Spacecraft-crew furniture, code-built so it matches the cabin surfaces: a moulded white desk
 * on slab legs with a lit edge, and an ergonomic crew chair (shell, dark cushions, headrest,
 * armrests, gas-lift column and a five-star base on casters). Metres; the chair faces +z.
 */
const rbox = (w: number, h: number, d: number, r: number) => new RoundedBoxGeometry(w, h, d, 3, r);

function useFurnitureKit() {
  const kit = useMemo(
    () => ({
      // graphite shell (was off-white): the white suit now separates from the desk and chair
      shell: new THREE.MeshStandardMaterial({ color: '#3a3f48', roughness: 0.36, metalness: 0.5 }),
      graphite: new THREE.MeshStandardMaterial({
        color: '#23272e',
        roughness: 0.6,
        metalness: 0.3,
      }),
      pad: new THREE.MeshStandardMaterial({ color: '#2b303a', roughness: 0.85, metalness: 0 }),
      metal: new THREE.MeshStandardMaterial({ color: '#9aa2af', roughness: 0.3, metalness: 0.9 }),
      glow: new THREE.MeshBasicMaterial({
        color: new THREE.Color('#4fd8ff').multiplyScalar(1.6),
        toneMapped: false,
      }),
      top: rbox(2.0, 0.045, 0.95, 0.02),
      leg: rbox(0.05, DESK.top - 0.045, 0.86, 0.015),
      unit: rbox(0.46, 0.5, 0.78, 0.03),
      seat: rbox(0.5, 0.09, 0.5, 0.04),
      seatPad: rbox(0.43, 0.07, 0.43, 0.035),
      back: rbox(0.5, 0.62, 0.08, 0.04),
      backPad: rbox(0.42, 0.52, 0.06, 0.035),
      head: rbox(0.26, 0.14, 0.07, 0.04),
      arm: rbox(0.07, 0.04, 0.3, 0.02),
    }),
    [],
  );
  useDisposeOnUnmount(
    kit.shell,
    kit.graphite,
    kit.pad,
    kit.metal,
    kit.glow,
    kit.top,
    kit.leg,
    kit.unit,
    kit.seat,
    kit.seatPad,
    kit.back,
    kit.backPad,
    kit.head,
    kit.arm,
  );
  return kit;
}

const BASE_ARMS = [0, 1, 2, 3, 4].map((i) => (i / 5) * Math.PI * 2);

/** The workstation desk. `z` is the desk centre; the top surface is at DESK.top. */
export function CrewDesk({ z }: { z: number }) {
  const k = useFurnitureKit();
  const topY = DESK.top - 0.0225;
  return (
    <group position={[0, 0, z]}>
      <mesh geometry={k.top} material={k.shell} position={[0, topY, 0]} />
      {/* lit front edge under the top */}
      <mesh material={k.glow} position={[0, DESK.top - 0.06, 0.46]}>
        <boxGeometry args={[1.9, 0.012, 0.012]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          geometry={k.leg}
          material={k.shell}
          position={[s * 0.95, (DESK.top - 0.045) / 2, 0]}
        />
      ))}
      <mesh material={k.graphite} position={[0, 0.45, 0.42]}>
        <boxGeometry args={[1.85, 0.4, 0.03]} />
      </mesh>
      {/* drawer unit under the right end */}
      <mesh geometry={k.unit} material={k.shell} position={[0.68, 0.27, 0.02]} />
      {[0.12, 0.34].map((y) => (
        <mesh key={y} material={k.graphite} position={[0.68, y, 0.415]}>
          <boxGeometry args={[0.4, 0.17, 0.012]} />
        </mesh>
      ))}
      {[0.12, 0.34].map((y) => (
        <mesh key={'h' + y} material={k.metal} position={[0.68, y + 0.04, 0.426]}>
          <boxGeometry args={[0.14, 0.012, 0.012]} />
        </mesh>
      ))}
    </group>
  );
}

/** The desk chair (the room moves this group; origin on the floor under the column). */
export function CrewChair() {
  const k = useFurnitureKit();
  return (
    <group>
      {/* gas-lift column and star base on casters */}
      <mesh material={k.metal} position={[0, 0.24, 0]}>
        <cylinderGeometry args={[0.035, 0.045, 0.34, 14]} />
      </mesh>
      {BASE_ARMS.map((a) => (
        <group key={a} rotation={[0, a, 0]}>
          <mesh material={k.graphite} position={[0.15, 0.06, 0]}>
            <boxGeometry args={[0.3, 0.035, 0.05]} />
          </mesh>
          <mesh material={k.pad} position={[0.3, 0.03, 0]}>
            <sphereGeometry args={[0.03, 10, 8]} />
          </mesh>
        </group>
      ))}
      <group position={[0, 0.37, -0.04]}>
        <mesh geometry={k.seat} material={k.shell} />
        <mesh geometry={k.seatPad} material={k.pad} position={[0, 0.06, 0]} />
        {/* backrest, slightly reclined, behind the sitter (-z) */}
        <group position={[0, 0.05, -0.27]} rotation={[-0.12, 0, 0]}>
          <mesh geometry={k.back} material={k.shell} position={[0, 0.33, 0]} />
          <mesh geometry={k.backPad} material={k.pad} position={[0, 0.32, 0.06]} />
          <mesh geometry={k.head} material={k.pad} position={[0, 0.74, 0.04]} />
          <mesh material={k.metal} position={[0, 0.66, 0]}>
            <boxGeometry args={[0.04, 0.12, 0.04]} />
          </mesh>
        </group>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.3, 0.16, -0.02]}>
            <mesh geometry={k.arm} material={k.pad} />
            <mesh material={k.metal} position={[0, -0.09, -0.05]}>
              <boxGeometry args={[0.025, 0.16, 0.03]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
