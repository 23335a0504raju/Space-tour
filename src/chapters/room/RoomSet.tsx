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
import { Starfield } from '../greybox/parts.tsx';
import { HelVela } from '../ship/HelVela.tsx';
import { FLOOR_TEXTURES, PANEL_TEXTURES, ROOM_HDRI, ROOM_MODELS } from './assets.ts';
import { createCodeScreenTexture } from './codeScreen.ts';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { CHAIR_REST, DESK, KEYBOARD, MOUSE, ROOM, WINDOW_PAD } from './layout.ts';
import { SlidingDoor } from './SlidingDoor.tsx';
import type { DoorHandle } from './SlidingDoor.tsx';
import { usePbrMaterial } from './pbr.ts';

/**
 * SC02/SC03 set: a compact futuristic developer room (FINAL_STORYLINE.md SC02).
 * Layout constants live in layout.ts (shared with the pure motion maths).
 */
export { ROOM } from './layout.ts';

/** Imperative handle for the animated parts of the set; called from a chapter's frame loop. */
export interface RoomSetHandle {
  /** 0 = closed, 1 = open. */
  setDoor(open: number): void;
  setChair(x: number, z: number, rotY: number): void;
}

const WALL_OVERRIDES = { color: new THREE.Color('#8a919e'), envMapIntensity: 0.6 };
const CEILING_OVERRIDES = { color: new THREE.Color('#4a4f59') };
const FLOOR_OVERRIDES = { color: new THREE.Color('#9aa0a8') };

// ── Image-based lighting (shared, ref-counted, generated once per renderer + tier) ──
const iblCache = new Map<
  string,
  { texture: THREE.Texture; users: number; unregister: () => void }
>();

/** Interior image-based lighting, registered under the "room" environment key (room + cockpit). */
export function RoomLighting() {
  const gl = useThree((s) => s.gl);
  const tier = useJourneyStore((s) => s.tier);
  // Balanced: real 1K HDRI. Low: procedural RoomEnvironment (0 bytes to download).
  return tier === 'balanced' ? <HdriIbl gl={gl} /> : <ProceduralIbl gl={gl} />;
}

function useSharedIbl(key: string, make: () => THREE.Texture) {
  useEffect(() => {
    let entry = iblCache.get(key);
    if (!entry) {
      const texture = make();
      entry = { texture, users: 0, unregister: registerEnvironment('room', texture) };
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
        e.texture.dispose();
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
      const t = pmrem.fromEquirectangular(hdr).texture;
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
      const t = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
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

function LightStrip({
  position,
  size,
  color,
  intensity = 3,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  intensity?: number;
}) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color="#000000"
        emissive={color}
        emissiveIntensity={intensity}
        toneMapped={false}
      />
    </mesh>
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

/** Steel lattice launch tower (one instanced mesh), matching the SC05 tower's footprint. */
const TOWER_H = 26;
const TOWER_HALF = 1.6;
function WindowTower({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 4 + Math.floor(TOWER_H / 2) * 2;
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const mx = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    let i = 0;
    const put = (x: number, y: number, z: number, sx: number, sy: number, sz: number) =>
      m.setMatrixAt(i++, mx.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz)));
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        put(sx * TOWER_HALF, TOWER_H / 2, sz * TOWER_HALF, 0.3, TOWER_H, 0.3);
    for (let y = 2; y <= TOWER_H; y += 2) {
      put(0, y, TOWER_HALF, TOWER_HALF * 2, 0.16, 0.16);
      put(0, y, -TOWER_HALF, TOWER_HALF * 2, 0.16, 0.16);
    }
    m.count = i;
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, []);
  return (
    <group position={position}>
      <instancedMesh ref={ref} args={[undefined, undefined, count]}>
        <boxGeometry />
        <meshLambertMaterial color="#6b7380" />
      </instancedMesh>
      <mesh position={[0, TOWER_H + 0.3, 0]}>
        <sphereGeometry args={[0.25, 10, 8]} />
        <meshBasicMaterial color={new THREE.Color(4, 0.35, 0.25)} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ── The view through the window: spacecraft on a floodlit pad, at night ───────
function OutsideView() {
  return (
    <group>
      <Starfield count={3000} radius={300} seed={11} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, -90]}>
        <planeGeometry args={[400, 220]} />
        {/* Lambert ignores scene.environment: the exterior must not reflect the room IBL. (Standard
            materials use scene.environmentIntensity and ignore their own envMapIntensity, so a grazing
            Fresnel reflection turned this ground grey; found in P3 review.) */}
        <meshLambertMaterial color="#07090d" />
      </mesh>
      {/* the pad SC05 launches from: the HelVela II (60 m) on its cradles, the tower on its -z side */}
      <group position={WINDOW_PAD.position} rotation={[0, WINDOW_PAD.rotationY, 0]}>
        <mesh position={[0, 0.25, 0]}>
          <boxGeometry args={[80, 0.5, 34]} />
          <meshLambertMaterial color="#2b2e35" />
        </mesh>
        {[-16, 16].map((x) => (
          <mesh key={x} position={[x, 1.75, 0]}>
            <boxGeometry args={[3.2, 3, 7]} />
            <meshLambertMaterial color="#3a3d44" />
          </mesh>
        ))}
        <Suspense fallback={null}>
          <HelVela position={[0, 3, 0]} />
        </Suspense>
        <WindowTower position={[-6, 0, -17]} />
        {/* pad markings */}
        <mesh position={[0, 0.52, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[64, 9]} />
          <meshLambertMaterial color="#14161a" />
        </mesh>
        {[-1, 1].map((s) => (
          <LightStrip
            key={s}
            position={[s * 36, 0.8, 14]}
            size={[0.5, 0.5, 0.5]}
            color="#fff1d6"
            intensity={2.5}
          />
        ))}
      </group>
      <TargetedSpot
        position={[-30, 40, -40]}
        target={[WINDOW_PAD.position[0], 5, WINDOW_PAD.position[2]]}
        angle={0.4}
        intensity={2600}
        distance={140}
        color="#e4ecff"
      />
    </group>
  );
}

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
  const wall = usePbrMaterial(PANEL_TEXTURES, [3, 1.2], WALL_OVERRIDES);
  const sideWall = usePbrMaterial(PANEL_TEXTURES, [3, 1.2], WALL_OVERRIDES);
  const ceiling = usePbrMaterial(PANEL_TEXTURES, [3, 3], CEILING_OVERRIDES);
  const floor = usePbrMaterial(FLOOR_TEXTURES, [3, 3], FLOOR_OVERRIDES);
  const { halfW, back, front, height, doorZ, doorW, doorH } = ROOM;
  const door = useRef<DoorHandle>(null);
  const chair = useRef<THREE.Group>(null);
  useImperativeHandle(
    handle,
    () => ({
      setDoor: (open) => door.current?.set(open),
      setChair: (x, z, rotY) => {
        if (!chair.current) return;
        chair.current.position.set(x, 0, z);
        chair.current.rotation.y = rotY;
      },
    }),
    [],
  );
  const depth = front - back;
  const midZ = (front + back) / 2;

  return (
    <group>
      <RoomLighting />

      {/* floor + ceiling */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, midZ]} receiveShadow material={floor}>
        <planeGeometry args={[halfW * 2, depth]} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, height, midZ]} material={ceiling}>
        <planeGeometry args={[halfW * 2, depth]} />
      </mesh>

      {/* back wall with the window opening: x ∈ [-1.6, 1.6], y ∈ [0.85, 2.45] */}
      <mesh position={[-2.55, height / 2, back]} material={wall} receiveShadow>
        <boxGeometry args={[1.9, height, 0.12]} />
      </mesh>
      <mesh position={[2.55, height / 2, back]} material={wall} receiveShadow>
        <boxGeometry args={[1.9, height, 0.12]} />
      </mesh>
      <mesh position={[0, 0.425, back]} material={wall} receiveShadow>
        <boxGeometry args={[3.2, 0.85, 0.12]} />
      </mesh>
      <mesh position={[0, 2.625, back]} material={wall}>
        <boxGeometry args={[3.2, 0.35, 0.12]} />
      </mesh>
      {/* window frame + glass */}
      {[
        [0, 2.45, 3.3, 0.06],
        [0, 0.85, 3.3, 0.06],
        [-1.62, 1.65, 0.06, 1.66],
        [1.62, 1.65, 0.06, 1.66],
        [0, 1.65, 0.04, 1.6],
      ].map(([x, y, w, h], i) => (
        <mesh key={i} position={[x ?? 0, y ?? 0, back + 0.04]}>
          <boxGeometry args={[w ?? 0.05, h ?? 0.05, 0.08]} />
          <meshStandardMaterial color="#1b1e24" metalness={0.8} roughness={0.35} />
        </mesh>
      ))}
      <mesh position={[0, 1.65, back]}>
        <planeGeometry args={[3.2, 1.6]} />
        <meshBasicMaterial
          // unlit faint tint: a PBR pane would mirror the room IBL across the night view
          color="#9fb6d6"
          transparent
          opacity={0.02}
          depthWrite={false}
        />
      </mesh>

      {/* left wall with shelf */}
      <mesh
        position={[-halfW, height / 2, midZ]}
        rotation={[0, Math.PI / 2, 0]}
        material={sideWall}
        receiveShadow
      >
        <planeGeometry args={[depth, height]} />
      </mesh>
      {/* right wall around the door opening (z ∈ doorZ ± doorW/2, y ∈ [0, doorH]) */}
      <mesh
        position={[halfW, height / 2, (back + doorZ - doorW / 2) / 2]}
        rotation={[0, -Math.PI / 2, 0]}
        material={sideWall}
        receiveShadow
      >
        <planeGeometry args={[doorZ - doorW / 2 - back, height]} />
      </mesh>
      <mesh
        position={[halfW, height / 2, (front + doorZ + doorW / 2) / 2]}
        rotation={[0, -Math.PI / 2, 0]}
        material={sideWall}
      >
        <planeGeometry args={[front - doorZ - doorW / 2, height]} />
      </mesh>
      <mesh
        position={[halfW, (height + doorH) / 2, doorZ]}
        rotation={[0, -Math.PI / 2, 0]}
        material={sideWall}
      >
        <planeGeometry args={[doorW, height - doorH]} />
      </mesh>
      <SlidingDoor ref={door} shadows={shadows} />
      {/* front wall (behind the camera; contains light and reflections) */}
      <mesh position={[0, height / 2, front]} rotation={[0, Math.PI, 0]} material={wall}>
        <planeGeometry args={[halfW * 2, height]} />
      </mesh>

      {/* light strips: cool ceiling coves, warm uplights beside the window */}
      <LightStrip
        position={[-halfW + 0.06, height - 0.05, midZ]}
        size={[0.03, 0.03, depth - 0.2]}
        color="#cfe0ff"
        intensity={2}
      />
      <LightStrip
        position={[halfW - 0.06, height - 0.05, midZ]}
        size={[0.03, 0.03, depth - 0.2]}
        color="#cfe0ff"
        intensity={2}
      />
      <LightStrip
        position={[-1.75, 1.65, back + 0.08]}
        size={[0.025, 1.6, 0.025]}
        color="#ffb870"
        intensity={2.5}
      />
      <LightStrip
        position={[1.75, 1.65, back + 0.08]}
        size={[0.025, 1.6, 0.025]}
        color="#ffb870"
        intensity={2.5}
      />

      {/* furniture (Poly Haven CC0) */}
      <Prop url={ROOM_MODELS.desk} position={[0, 0, DESK.z]} scale={[1, DESK.scaleY, 1]} />
      {/* the model faces +z; rotate to face the desk (verified with the seated Mixamo pose) */}
      {/* SC03 pushes it back from the desk as the astronaut stands (RoomSetHandle.setChair) */}
      <group
        ref={chair}
        position={[CHAIR_REST.x, 0, CHAIR_REST.z]}
        rotation={[0, CHAIR_REST.rotY, 0]}
      >
        <Prop url={ROOM_MODELS.chair} position={[0, 0, 0]} />
      </group>
      <Prop url={ROOM_MODELS.lamp} position={[0.82, DESK.top, -2.62]} rotation={[0, -0.5, 0]} />
      <Prop url={ROOM_MODELS.plant} position={[-0.85, DESK.top, -2.62]} />
      <Prop
        url={ROOM_MODELS.notepads}
        position={[0.62, DESK.top, -2.45]}
        scale={0.45}
        rotation={[0, 0.2, 0]}
      />
      <Prop
        url={ROOM_MODELS.shelf}
        position={[-halfW + 0.02, 0, -1.2]}
        rotation={[0, Math.PI / 2, 0]}
      />
      <Prop url={ROOM_MODELS.ceilingLamp} position={[0, height - 1.172, -0.6]} />

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

      <OutsideView />
      {children}
    </group>
  );
});
