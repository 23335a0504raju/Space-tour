import { Suspense, forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { useLoader, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { gltfExtender } from '../../engine/assets/loaders.ts';
import { registerEnvironment } from '../../engine/environment.ts';
import { useJourneyStore } from '../../engine/store.ts';
import { ROOM_HDRI, ROOM_MODELS } from './assets.ts';
import { createCodeScreenTexture } from './codeScreen.ts';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { CHAIR_REST, DESK, HOLOGRAM, KEYBOARD, LIFT, MOUSE } from './layout.ts';
import { CrewChair, CrewDesk } from './Furniture.tsx';
import { Bridge } from './Bridge.tsx';
import { Hologram } from './Hologram.tsx';

/**
 * SC02/SC03 set: a compact futuristic developer room (FINAL_STORYLINE.md SC02).
 * Layout constants live in layout.ts (shared with the pure motion maths).
 */

/** Imperative handle for the animated parts of the set; called from a chapter's frame loop. */
export interface RoomSetHandle {
  /** Lift platform light, 0 = off, 1 = full (SC03's walk ends on it). */
  setLift(level: number): void;
  setChair(x: number, z: number, rotY: number): void;
}

// ── Image-based lighting (shared, ref-counted, generated once per renderer + tier) ──
const iblCache = new Map<
  string,
  { target: THREE.WebGLRenderTarget; users: number; unregister: () => void }
>();

/** Interior image-based lighting, registered under the "room" environment key (room + cockpit). */
export function RoomLighting() {
  const gl = useThree((s) => s.gl);
  const tier = useJourneyStore((s) => s.tier);
  // Balanced: real 1K HDRI. Low: procedural RoomEnvironment (0 bytes to download).
  return tier === 'balanced' ? <HdriIbl gl={gl} /> : <ProceduralIbl gl={gl} />;
}

/**
 * PMREM results are render targets: only renderTarget.dispose() frees their GL texture in three
 * r187 (texture.dispose() returns early for render-target textures), so the cache keeps the target.
 */
function useSharedIbl(key: string, make: () => THREE.WebGLRenderTarget) {
  useEffect(() => {
    let entry = iblCache.get(key);
    if (!entry) {
      const target = make();
      entry = { target, users: 0, unregister: registerEnvironment('room', target.texture) };
      iblCache.set(key, entry);
    }
    entry.users += 1;
    return () => {
      // Unregister only when the last user leaves: SC02, SC03 and SC04 share this texture, and
      // SC02 unmounting used to drop the "room" environment while SC03/SC04 still needed it
      // (the cockpit rendered unlit after a jump; P3 corrections).
      const e = iblCache.get(key);
      if (e && --e.users === 0) {
        e.unregister();
        e.target.dispose();
        iblCache.delete(key);
      }
    };
  }, [key, make]);
}

function HdriIbl({ gl }: { gl: THREE.WebGLRenderer }) {
  const hdr = useLoader(HDRLoader, ROOM_HDRI);
  const make = useMemo(
    () => () => {
      const pmrem = new THREE.PMREMGenerator(gl);
      hdr.mapping = THREE.EquirectangularReflectionMapping;
      const t = pmrem.fromEquirectangular(hdr);
      pmrem.dispose();
      return t;
    },
    [gl, hdr],
  );
  useSharedIbl('room-hdri', make);
  return null;
}

function ProceduralIbl({ gl }: { gl: THREE.WebGLRenderer }) {
  const make = useMemo(
    () => () => {
      const pmrem = new THREE.PMREMGenerator(gl);
      const t = pmrem.fromScene(new RoomEnvironment(), 0.04);
      pmrem.dispose();
      return t;
    },
    [gl],
  );
  useSharedIbl('room-procedural', make);
  return null;
}

// ── Props ──────────────────────────────────────────────────────────────────────
function Prop({
  url,
  position,
  rotation = [0, 0, 0],
  scale = 1,
}: {
  url: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
}) {
  const gl = useThree((s) => s.gl);
  const { scene } = useGLTF(url, false, true, gltfExtender(gl));
  const shadows = useJourneyStore((s) => s.tier === 'balanced');
  // Clone: SC02 and SC03 are mounted at the same time and an Object3D can only have one parent.
  const object = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = shadows;
        m.receiveShadow = true;
      }
    });
    return c;
  }, [scene, shadows]);
  return <primitive object={object} position={position} rotation={rotation} scale={scale} />;
}

// ── Monitors with real code ───────────────────────────────────────────────────
function Monitor({
  position,
  rotationY,
  firstLine,
}: {
  position: [number, number, number];
  rotationY: number;
  firstLine: number;
}) {
  const texture = useMemo(() => createCodeScreenTexture(firstLine), [firstLine]);
  useDisposeOnUnmount(texture);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh castShadow>
        <boxGeometry args={[0.62, 0.37, 0.025]} />
        <meshStandardMaterial color="#14161b" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0, 0.0135]}>
        <planeGeometry args={[0.6, 0.3375]} />
        <meshStandardMaterial
          color="#000000"
          emissive="#ffffff"
          emissiveMap={texture}
          emissiveIntensity={1.15}
          roughness={0.25}
        />
      </mesh>
      <mesh position={[0, -0.25, -0.03]}>
        <boxGeometry args={[0.04, 0.16, 0.04]} />
        <meshStandardMaterial color="#2a2d33" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, -0.33, -0.03]}>
        <boxGeometry args={[0.2, 0.012, 0.14]} />
        <meshStandardMaterial color="#2a2d33" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}

/** Spot light whose target is part of the scene graph (an un-added target always points at the origin). */
function TargetedSpot({
  position,
  target,
  angle,
  intensity,
  distance,
  color,
}: {
  position: [number, number, number];
  target: [number, number, number];
  angle: number;
  intensity: number;
  distance: number;
  color: string;
}) {
  const targetObject = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(target[0], target[1], target[2]);
    return o;
    // depend on the numbers, not the (new-every-render) array literal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target[0], target[1], target[2]]);
  return (
    <>
      <primitive object={targetObject} />
      <spotLight
        position={position}
        target={targetObject}
        angle={angle}
        penumbra={0.7}
        intensity={intensity}
        distance={distance}
        color={color}
        decay={2}
      />
    </>
  );
}

/**
 * The opening room is the launch-control bridge model (Bridge.tsx, asset A036; Raju's choice,
 * 2026-11-19). It replaced the code-built cabin (see git history before that date).
 */
/** Lift light at full (candela-ish, decay 2): bright enough to read as a lit platform. */
const LIFT_LIGHT = 14;

// ── The set ─────────────────────────────────────────────────────────────────
interface RoomSetProps {
  /** Astronaut (and anything else animated) is placed by the chapter. */
  readonly children?: ReactNode;
}

export const RoomSet = forwardRef<RoomSetHandle, RoomSetProps>(function RoomSet(
  { children },
  handle,
) {
  const tier = useJourneyStore((s) => s.tier);
  const shadows = tier === 'balanced';
  const lift = useRef<THREE.PointLight>(null);
  const chair = useRef<THREE.Group>(null);
  useImperativeHandle(
    handle,
    () => ({
      setLift: (k) => {
        if (lift.current) lift.current.intensity = LIFT_LIGHT * k;
      },
      setChair: (x, z, rotY) => {
        if (!chair.current) return;
        chair.current.position.set(x, 0, z);
        chair.current.rotation.y = rotY;
      },
    }),
    [],
  );

  return (
    <group>
      <RoomLighting />
      <Suspense fallback={null}>
        <Bridge />
      </Suspense>
      {/* the hologram's cool glow over the deck, and the lift light SC03 raises (setLift) */}
      <pointLight
        position={[HOLOGRAM.centre[0], HOLOGRAM.centre[1], HOLOGRAM.centre[2]]}
        color="#7fb4ff"
        intensity={7}
        distance={9}
        decay={2}
      />
      <pointLight
        ref={lift}
        position={[LIFT.light[0], LIFT.light[1], LIFT.light[2]]}
        color="#f4f7ff"
        intensity={0}
        distance={5}
        decay={2}
      />

      {/* furniture (Poly Haven CC0) */}
      <CrewDesk z={DESK.z} />
      {/* the model faces +z; rotate to face the desk (verified with the seated Mixamo pose) */}
      {/* SC03 pushes it back from the desk as the astronaut stands (RoomSetHandle.setChair) */}
      <group
        ref={chair}
        position={[CHAIR_REST.x, 0, CHAIR_REST.z]}
        rotation={[0, CHAIR_REST.rotY, 0]}
      >
        <CrewChair />
      </group>
      <Prop url={ROOM_MODELS.plant} position={[-0.85, DESK.top, -2.62]} />
      {/* its own boundary: the room never waits on the photo */}
      <Suspense fallback={null}>
        <Hologram />
      </Suspense>

      {/* developer workstation (code-built) */}
      <Monitor position={[0, DESK.top + 0.343, -2.7]} rotationY={0} firstLine={60} />
      <Monitor position={[-0.64, DESK.top + 0.343, -2.6]} rotationY={0.32} firstLine={0} />
      <Monitor position={[0.64, DESK.top + 0.343, -2.6]} rotationY={-0.32} firstLine={118} />
      <mesh
        position={[KEYBOARD.x, DESK.top + KEYBOARD.size[1] / 2, KEYBOARD.z]}
        castShadow={shadows}
        receiveShadow
      >
        <boxGeometry args={[...KEYBOARD.size]} />
        <meshStandardMaterial color="#1a1c21" metalness={0.4} roughness={0.5} />
      </mesh>
      {/* mouse pad + mouse where the typing clip's right hand reaches */}
      <mesh position={[MOUSE.x, DESK.top + MOUSE.pad[1] / 2, MOUSE.z]} receiveShadow>
        <boxGeometry args={[...MOUSE.pad]} />
        <meshStandardMaterial color="#121418" roughness={0.9} />
      </mesh>
      <mesh
        position={[MOUSE.x, DESK.top + MOUSE.pad[1] + 0.013, MOUSE.z]}
        scale={[0.032, 0.013, 0.05]}
        castShadow={shadows}
      >
        <sphereGeometry args={[1, 20, 12]} />
        <meshStandardMaterial color="#1a1c21" metalness={0.4} roughness={0.45} />
      </mesh>

      {/* lights */}
      <hemisphereLight args={['#9fb4d8', '#1a1612', 0.35]} />
      <directionalLight
        position={[1.8, 5, -9]}
        intensity={1.4}
        color="#b8c8ff"
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-camera-near={1}
        shadow-camera-far={20}
      />
      <pointLight
        position={[0, 1.2, -2.35]}
        color="#86a8ff"
        intensity={3.5}
        distance={3.2}
        decay={2}
      />
      <TargetedSpot
        position={[0.72, 1.42, -2.5]}
        target={[0.35, DESK.top, -2.25]}
        angle={0.7}
        intensity={18}
        distance={4}
        color="#ffc98f"
      />
      <pointLight position={[0, 2.1, -0.6]} color="#ffd9b0" intensity={4} distance={6} decay={2} />

      {children}
    </group>
  );
});
