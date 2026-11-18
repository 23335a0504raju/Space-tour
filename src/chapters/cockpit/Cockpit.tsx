import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { useJourneyStore } from '../../engine/store.ts';
import { sampleKeys } from '../../engine/camera/shots.ts';
import type { ShotKey } from '../../engine/camera/shots.ts';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Astronaut as Crew } from '../astronaut/Astronaut.tsx';
import type { Drive } from '../astronaut/Astronaut.tsx';
import type { ChapterImpl, ChapterSceneProps } from '../contract.ts';
import { Astronaut as StandIn, seeded, Starfield } from '../greybox/parts.tsx';
import { useCabinSurface } from '../room/surfaces.ts';
import { RoomLighting } from '../room/RoomSet.tsx';
import { educationScreen, experienceScreen, flightPlanScreen } from './screens.ts';

/**
 * SC04 Cockpit (P3 vertical slice): code-built near-future cockpit with Poly Haven CC0 panel
 * textures and diegetic Crew Record screens. Metres; origin = cockpit floor centre; nose → -z.
 */

const SHELL = { color: '#cdd2da', roughness: 0.55, metalness: 0.1 } as const;
const GRAPHITE = { color: '#1b1f26', roughness: 0.5, metalness: 0.4 } as const;

/** A touchscreen set into the dash panel: bezel flush with the panel, glass inside it (dash-local frame). */
function Screen({ texture, x }: { texture: THREE.Texture; x: number }) {
  useDisposeOnUnmount(texture);
  return (
    <group position={[x, 0.1, 0.04]}>
      <mesh position={[0, 0, 0.006]}>
        <boxGeometry args={[0.7, 0.47, 0.012]} />
        <meshStandardMaterial {...GRAPHITE} />
      </mesh>
      <mesh position={[0, 0, 0.013]}>
        <planeGeometry args={[0.62, 0.3875]} />
        <meshBasicMaterial map={texture} color="#e8e8e8" toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Rows of small indicator lights (one instanced draw call). */
function SwitchBank({
  position,
  rotation,
  cols,
  rows,
  seed,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  cols: number;
  rows: number;
  seed: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = cols * rows;
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const rand = seeded(seed);
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    const palette = ['#ffb04a', '#5fd3a1', '#7fa2ff', '#3a3f48', '#3a3f48'];
    for (let i = 0; i < count; i += 1) {
      const x = (i % cols) * 0.045 - ((cols - 1) * 0.045) / 2;
      const y = Math.floor(i / cols) * 0.045 - ((rows - 1) * 0.045) / 2;
      mesh.setMatrixAt(i, m.makeTranslation(x, y, 0));
      mesh.setColorAt(i, c.set(palette[Math.floor(rand() * palette.length)] ?? '#3a3f48'));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [cols, rows, count, seed]);
  return (
    <group position={position} rotation={rotation}>
      <instancedMesh ref={ref} args={[undefined, undefined, count]}>
        <boxGeometry args={[0.022, 0.022, 0.012]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

const STEEL = { color: '#8d95a3', metalness: 0.85, roughness: 0.3 } as const;
const SEAT_TRIM = { color: '#d6a756', metalness: 0.6, roughness: 0.35 } as const;

type Dims = readonly [number, number, number, number];

/** Rounded-box sizes (w, h, d, corner radius) for one couch. */
const COUCH_GEO = {
  pan: [0.54, 0.08, 0.62, 0.035],
  panPad: [0.42, 0.07, 0.52, 0.03],
  bolster: [0.07, 0.14, 0.56, 0.03],
  arm: [0.07, 0.05, 0.3, 0.02],
  leg: [0.46, 0.08, 0.42, 0.035],
  legPad: [0.36, 0.07, 0.36, 0.03],
  back: [0.58, 0.86, 0.09, 0.04],
  backPad: [0.42, 0.72, 0.07, 0.035],
  wing: [0.08, 0.64, 0.2, 0.035],
  headPad: [0.28, 0.24, 0.09, 0.04],
  headEar: [0.06, 0.28, 0.18, 0.03],
  cap: [0.42, 0.07, 0.12, 0.03],
} as const satisfies Record<string, Dims>;

type CouchGeometries = { [K in keyof typeof COUCH_GEO]: THREE.BufferGeometry };

interface Couch {
  shell: THREE.Material;
  pad: THREE.Material;
  strap: THREE.Material;
  metal: THREE.Material;
  geo: CouchGeometries;
}

/** Shared materials and moulded (rounded) geometry for every couch; disposed with the cockpit. */
function useCouch(): Couch {
  const couch = useMemo(() => {
    const geo = {} as Record<string, THREE.BufferGeometry>;
    for (const [k, [w, h, d, r]] of Object.entries(COUCH_GEO))
      geo[k] = new RoundedBoxGeometry(w, h, d, 3, r);
    return {
      shell: new THREE.MeshStandardMaterial({ color: '#c4c9d2', roughness: 0.4, metalness: 0.1 }),
      pad: new THREE.MeshStandardMaterial({ color: '#2b303a', roughness: 0.85, metalness: 0 }),
      strap: new THREE.MeshStandardMaterial({ color: '#d9582b', roughness: 0.7, metalness: 0 }),
      metal: new THREE.MeshStandardMaterial({ color: '#9aa2af', roughness: 0.3, metalness: 0.9 }),
      geo: geo as CouchGeometries,
    };
  }, []);
  useDisposeOnUnmount(
    couch.shell,
    couch.pad,
    couch.strap,
    couch.metal,
    ...Object.values(couch.geo),
  );
  return couch;
}

/**
 * A reclined crew couch in the Crew Dragon / Orion style: moulded white shell with rounded
 * edges, dark cushions, side wings, headrest with ears, raised leg rest and a harness.
 * Faces -z; origin on the floor.
 */
function Seat({ position, couch }: { position: [number, number, number]; couch: Couch }) {
  const { shell, pad, strap, metal, geo } = couch;
  return (
    <group position={position}>
      {/* floor plate and slide struts */}
      <mesh position={[0, 0.02, 0.05]} material={pad}>
        <boxGeometry args={[0.58, 0.04, 0.84]} />
      </mesh>
      {[-1, 1].map((k) => (
        <mesh key={'s' + k} position={[k * 0.2, 0.2, 0.05]} material={metal}>
          <boxGeometry args={[0.05, 0.3, 0.5]} />
        </mesh>
      ))}

      <group position={[0, 0.37, 0.05]} rotation={[0.16, 0, 0]}>
        <mesh geometry={geo.pan} material={shell} />
        <mesh geometry={geo.panPad} position={[0, 0.055, 0]} material={pad} />
        {[-1, 1].map((k) => (
          <group key={'a' + k}>
            <mesh
              geometry={geo.bolster}
              position={[k * 0.265, 0.08, 0]}
              rotation={[0, 0, k * -0.25]}
              material={shell}
            />
            <mesh geometry={geo.arm} position={[k * 0.35, 0.22, 0.03]} material={pad} />
            <mesh position={[k * 0.35, 0.13, 0.03]} material={metal}>
              <boxGeometry args={[0.025, 0.18, 0.04]} />
            </mesh>
          </group>
        ))}
        {/* raised leg rest */}
        <group position={[0, -0.01, -0.3]} rotation={[0.5, 0, 0]}>
          <mesh geometry={geo.leg} position={[0, 0, -0.2]} material={shell} />
          <mesh geometry={geo.legPad} position={[0, 0.055, -0.2]} material={pad} />
        </group>
        {/* backrest, hinged at the rear of the pan */}
        <group position={[0, 0.02, 0.3]} rotation={[0.3, 0, 0]}>
          <mesh geometry={geo.back} position={[0, 0.43, 0]} material={shell} />
          <mesh geometry={geo.backPad} position={[0, 0.41, -0.07]} material={pad} />
          {[-1, 1].map((k) => (
            <mesh
              key={'w' + k}
              geometry={geo.wing}
              position={[k * 0.285, 0.4, -0.07]}
              rotation={[0, k * 0.3, 0]}
              material={shell}
            />
          ))}
          {/* headrest */}
          <mesh geometry={geo.headPad} position={[0, 0.92, -0.08]} material={pad} />
          {[-1, 1].map((k) => (
            <mesh
              key={'h' + k}
              geometry={geo.headEar}
              position={[k * 0.17, 0.92, -0.09]}
              rotation={[0, k * 0.4, 0]}
              material={shell}
            />
          ))}
          <mesh geometry={geo.cap} position={[0, 1.06, -0.02]} material={shell} />
          {/* harness: shoulder straps converge on a centre buckle */}
          {[-1, 1].map((k) => (
            <mesh
              key={'r' + k}
              position={[k * 0.085, 0.5, -0.108]}
              rotation={[0, 0, -k * 0.21]}
              material={strap}
            >
              <boxGeometry args={[0.05, 0.56, 0.012]} />
            </mesh>
          ))}
          <mesh position={[0, 0.2, -0.112]} material={metal}>
            <boxGeometry args={[0.08, 0.06, 0.02]} />
          </mesh>
        </group>
        <mesh position={[0, 0.1, -0.05]} material={strap}>
          <boxGeometry args={[0.46, 0.012, 0.05]} />
        </mesh>
      </group>
    </group>
  );
}

/** Glowing trim line (emissive, unlit: reads as a light strip). */
function Trim({
  position,
  size,
  color,
  intensity = 0.85,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  intensity?: number;
}) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshBasicMaterial
        color={new THREE.Color(color).multiplyScalar(intensity)}
        toneMapped={false}
      />
    </mesh>
  );
}

/** Centre pedestal between the seats: throttle levers and a status strip. */
function Pedestal() {
  return (
    <group position={[0.03, 0, -0.55]}>
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[0.24, 0.6, 0.8]} />
        <meshStandardMaterial color="#3f4857" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.62, 0]} rotation={[-0.15, 0, 0]}>
        <boxGeometry args={[0.26, 0.04, 0.82]} />
        <meshStandardMaterial color="#232830" metalness={0.5} roughness={0.4} />
      </mesh>
      {[-0.06, 0.06].map((x) => (
        <group key={x} position={[x, 0.66, -0.1]} rotation={[-0.5, 0, 0]}>
          <mesh position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.2, 8]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
          <mesh position={[0, 0.21, 0]}>
            <sphereGeometry args={[0.025, 12, 8]} />
            <meshStandardMaterial {...SEAT_TRIM} />
          </mesh>
        </group>
      ))}
      <group position={[0, 0.66, 0.2]} rotation={[0.25, 0, 0]}>
        <mesh position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.016, 0.02, 0.2, 10]} />
          <meshStandardMaterial {...STEEL} />
        </mesh>
        <mesh position={[0, 0.25, 0]}>
          <capsuleGeometry args={[0.03, 0.09, 6, 12]} />
          <meshStandardMaterial {...GRAPHITE} />
        </mesh>
      </group>
      <Trim position={[0, 0.5, -0.41]} size={[0.2, 0.012, 0.012]} color="#4fd8ff" />
    </group>
  );
}

/** Launch tower and pad under floodlights, seen through the windscreen. Lambert: no room IBL. */
function TowerView() {
  return (
    <group>
      <Starfield count={2500} radius={260} seed={17} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -6, -40]}>
        <planeGeometry args={[200, 120]} />
        <meshLambertMaterial color="#06080c" />
      </mesh>
      <group position={[-3.4, -6, -9]}>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <mesh key={i} position={[0, i * 2.4, 0]}>
            <boxGeometry args={[1.6, 0.18, 1.6]} />
            <meshLambertMaterial color="#2d3037" />
          </mesh>
        ))}
        {[-0.75, 0.75].map((x) =>
          [-0.75, 0.75].map((z) => (
            <mesh key={`${x}${z}`} position={[x, 8, z]}>
              <boxGeometry args={[0.12, 16, 0.12]} />
              <meshLambertMaterial color="#3a3d44" />
            </mesh>
          )),
        )}
        {[3, 7, 11].map((y) => (
          <mesh key={y} position={[0.9, y, 0.9]}>
            <sphereGeometry args={[0.09, 10, 8]} />
            <meshBasicMaterial color="#ff5a4a" toneMapped={false} />
          </mesh>
        ))}
      </group>
      <spotLight
        position={[4, 10, -2]}
        angle={0.5}
        penumbra={0.8}
        intensity={260}
        distance={40}
        color="#dfe8ff"
      />
    </group>
  );
}

const PILOT_SEAT: [number, number, number] = [-0.5, 0.06, -0.12];

/** Seated in the left seat; the sitting-idle loop is ambient (wall-clock). */
const pilotDrive: Drive = (_t, api, body, elapsed) => {
  body.position.set(PILOT_SEAT[0], PILOT_SEAT[1], PILOT_SEAT[2]);
  body.rotation.set(0, Math.PI, 0);
  api.set('sitIdle', elapsed % api.duration('sitIdle'), 1);
};

function CockpitScene({ id, frame }: ChapterSceneProps) {
  const shadows = useJourneyStore((s) => s.tier === 'balanced');
  const hull = useCabinSurface('wall', [5, 3]);
  const deck = useCabinSurface('floor', [4, 3]);
  const couch = useCouch();
  const screens = useMemo(
    () => ({
      experience: experienceScreen(),
      plan: flightPlanScreen(),
      education: educationScreen(),
    }),
    [],
  );

  return (
    <group>
      <RoomLighting />
      {/* hull: half-cylinder shell around the crew (inside faces), floor, rear bulkhead */}
      <mesh position={[0, 1.0, -0.1]} rotation={[Math.PI / 2, 0, 0]} material={hull}>
        <cylinderGeometry args={[1.9, 1.9, 3.4, 32, 1, true, -Math.PI / 2 - 0.15, Math.PI + 0.3]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -0.1]} material={deck} receiveShadow>
        <planeGeometry args={[3.6, 3.4]} />
      </mesh>
      <mesh position={[0, 1.4, 1.6]} rotation={[0, Math.PI, 0]} material={hull}>
        <planeGeometry args={[3.8, 2.8]} />
      </mesh>

      {/* front bulkhead with the windscreen opening x ∈ [-1.25, 1.25], y ∈ [1.4, 2.15] */}
      <mesh position={[0, 0.65, -1.75]}>
        <boxGeometry args={[3.8, 1.3, 0.1]} />
        <meshStandardMaterial {...SHELL} />
      </mesh>
      <mesh position={[0, 2.675, -1.75]}>
        <boxGeometry args={[3.8, 0.55, 0.1]} />
        <meshStandardMaterial {...SHELL} />
      </mesh>
      {[-1, 1].map((k) => (
        <mesh key={k} position={[k * 1.75, 1.85, -1.75]}>
          <boxGeometry args={[0.3, 1.1, 0.1]} />
          <meshStandardMaterial {...SHELL} />
        </mesh>
      ))}
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} position={[x, 1.85, -1.72]}>
          <boxGeometry args={[0.07, 1.1, 0.08]} />
          <meshStandardMaterial color="#2a2f38" metalness={0.8} roughness={0.35} />
        </mesh>
      ))}
      {/* canopy frame: a lit sill and header, so the windscreen reads as a designed shape */}
      <Trim position={[0, 1.31, -1.68]} size={[3.2, 0.025, 0.03]} color="#4fd8ff" />
      <Trim position={[0, 2.39, -1.68]} size={[3.2, 0.02, 0.03]} color="#ffb870" intensity={0.8} />
      {[-1, 1].map((k) => (
        <Trim
          key={k}
          position={[k * 1.6, 1.85, -1.68]}
          size={[0.02, 1.1, 0.03]}
          color="#4fd8ff"
          intensity={0.75}
        />
      ))}

      {/* Crew Dragon-style dash: lower body, tilted panel with inset screens, curved glare shield */}
      <mesh position={[0, 0.35, -1.38]}>
        <boxGeometry args={[3.0, 0.7, 0.5]} />
        <meshStandardMaterial {...SHELL} color="#9aa1ad" />
      </mesh>
      <group position={[0, 1.0, -1.3]} rotation={[-0.5, 0, 0]}>
        <mesh>
          <boxGeometry args={[3.0, 0.72, 0.08]} />
          <meshStandardMaterial {...GRAPHITE} />
        </mesh>
        <mesh position={[0, 0.36, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.1, 0.1, 3.1, 24, 1, false, 0, Math.PI]} />
          <meshStandardMaterial {...SHELL} />
        </mesh>
        <Screen texture={screens.experience} x={-0.75} />
        <Screen texture={screens.plan} x={0} />
        <Screen texture={screens.education} x={0.75} />
        <SwitchBank position={[-1.28, 0, 0.056]} rotation={[0, 0, 0]} cols={4} rows={6} seed={3} />
        <SwitchBank position={[1.28, 0, 0.056]} rotation={[0, 0, 0]} cols={4} rows={6} seed={5} />
        <SwitchBank
          position={[-0.75, -0.28, 0.056]}
          rotation={[0, 0, 0]}
          cols={12}
          rows={2}
          seed={9}
        />
        <SwitchBank
          position={[0.75, -0.28, 0.056]}
          rotation={[0, 0, 0]}
          cols={12}
          rows={2}
          seed={11}
        />
        <Trim position={[0, -0.365, 0.045]} size={[3.0, 0.012, 0.012]} color="#4fd8ff" />
        {/* ignition switch (the close-up at the end of the chapter) */}
        <group position={[0, -0.22, 0.04]}>
          <mesh>
            <boxGeometry args={[0.2, 0.11, 0.02]} />
            <meshStandardMaterial {...SHELL} color="#8d95a3" />
          </mesh>
          <mesh position={[0, 0, 0.03]}>
            <boxGeometry args={[0.05, 0.05, 0.04]} />
            <meshStandardMaterial color="#8a1f18" emissive="#ff3b2e" emissiveIntensity={0.25} />
          </mesh>
        </group>
      </group>
      <SwitchBank
        position={[0, 2.62, -0.9]}
        rotation={[Math.PI / 2 + 0.4, 0, 0]}
        cols={14}
        rows={3}
        seed={7}
      />
      <mesh position={[0, 2.78, -0.8]} rotation={[0.25, 0, 0]}>
        <boxGeometry args={[2.2, 0.1, 0.9]} />
        <meshStandardMaterial {...SHELL} />
      </mesh>
      <Trim position={[0, 2.71, -0.4]} size={[2.0, 0.014, 0.02]} color="#ffb870" intensity={0.8} />
      {[-1, 1].map((k) => (
        <Trim
          key={'f' + k}
          position={[k * 1.1, 0.012, -0.2]}
          size={[0.03, 0.01, 2.6]}
          color="#4fd8ff"
          intensity={0.8}
        />
      ))}
      <Pedestal />
      <Seat position={[-0.5, 0, -0.2]} couch={couch} />
      <Seat position={[0.55, 0, -0.2]} couch={couch} />
      <Suspense
        fallback={<StandIn position={[-0.5, 0.18, -0.22]} rotation={[0, Math.PI, 0]} seated />}
      >
        <Crew chapterId={id} frame={frame} drive={pilotDrive} />
      </Suspense>

      {/* light */}
      <hemisphereLight args={['#b4c6e8', '#2a2622', 0.55]} />
      <pointLight
        position={[0, 1.9, 0.9]}
        color="#dfe8ff"
        intensity={3.2}
        distance={4.5}
        decay={2}
      />
      <pointLight
        position={[0, 1.35, -1.0]}
        color="#86a8ff"
        intensity={2.6}
        distance={3}
        decay={2}
      />
      <pointLight
        position={[0, 2.5, -0.3]}
        color="#ffcf9a"
        intensity={1.6}
        distance={3}
        decay={2}
      />
      <directionalLight
        position={[2.5, 6, -9]}
        intensity={0.9}
        color="#c8d6ff"
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-2.5}
        shadow-camera-right={2.5}
        shadow-camera-top={2.5}
        shadow-camera-bottom={-2.5}
      />
      <TowerView />
    </group>
  );
}

const cockpitKeys: ShotKey[] = [
  // through the hatch from behind the seats
  { t: 0, position: [0.9, 1.7, 2.0], target: [0.05, 0.95, -1.0], fov: 52 },
  // over the shoulder onto the Experience screen (camera line checked to clear the astronaut's head)
  { t: 0.35, position: [0.35, 1.75, 0.45], target: [-0.75, 1.11, -1.31], fov: 40 },
  // across to the Education screen (clears the astronaut and the empty seat back)
  { t: 0.7, position: [-0.15, 1.78, 0.45], target: [0.75, 1.11, -1.31], fov: 40 },
  // down onto the ignition switch
  { t: 1, position: [0.05, 1.38, -0.3], target: [0, 0.88, -1.15], fov: 36 },
];

export const sc04CrewRecord: ChapterImpl = {
  Scene: CockpitScene,
  shot: (t, out) => void sampleKeys(cockpitKeys, t, out),
  background: '#04060b',
  environment: { key: 'room', intensity: 0.4 },
};
