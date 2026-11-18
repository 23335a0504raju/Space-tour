import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { useJourneyStore } from '../../engine/store.ts';
import { sampleKeys } from '../../engine/camera/shots.ts';
import type { ShotKey } from '../../engine/camera/shots.ts';
import * as THREE from 'three';
import { Astronaut as Crew } from '../astronaut/Astronaut.tsx';
import type { Drive } from '../astronaut/Astronaut.tsx';
import type { ChapterImpl, ChapterSceneProps } from '../contract.ts';
import { Astronaut as StandIn, seeded, Starfield } from '../greybox/parts.tsx';
import { PANEL_TEXTURES } from '../room/assets.ts';
import { usePbrMaterial } from '../room/pbr.ts';
import { RoomLighting } from '../room/RoomSet.tsx';
import { educationScreen, experienceScreen, flightPlanScreen } from './screens.ts';

/**
 * SC04 Cockpit (P3 vertical slice): code-built near-future cockpit with Poly Haven CC0 panel
 * textures and diegetic Crew Record screens. Metres; origin = cockpit floor centre; nose → -z.
 */
const HULL_OVERRIDES = { color: new THREE.Color('#aab2c0') };
const CONSOLE_OVERRIDES = { color: new THREE.Color('#566070') };

function Screen({
  texture,
  position,
  rotation,
}: {
  texture: THREE.Texture;
  position: [number, number, number];
  rotation: [number, number, number];
}) {
  useDisposeOnUnmount(texture);
  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <boxGeometry args={[0.66, 0.43, 0.03]} />
        <meshStandardMaterial color="#121418" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.016]}>
        <planeGeometry args={[0.62, 0.3875]} />
        <meshStandardMaterial
          color="#000000"
          emissive="#ffffff"
          emissiveMap={texture}
          emissiveIntensity={1.1}
          roughness={0.2}
        />
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

const SEAT_FABRIC = { color: '#5d687c', roughness: 0.8, metalness: 0.05 } as const;
const SEAT_TRIM = { color: '#d6a756', metalness: 0.6, roughness: 0.35 } as const;
const STEEL = { color: '#8d95a3', metalness: 0.85, roughness: 0.3 } as const;

/** A sculpted crew seat: cushion with side bolsters, slim reclined back, headrest, armrests, pedestal. */
function Seat({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.42, 0]}>
        <boxGeometry args={[0.5, 0.1, 0.52]} />
        <meshStandardMaterial {...SEAT_FABRIC} />
      </mesh>
      {[-1, 1].map((k) => (
        <mesh key={'b' + k} position={[k * 0.27, 0.47, 0]} rotation={[0, 0, k * -0.25]}>
          <boxGeometry args={[0.07, 0.14, 0.5]} />
          <meshStandardMaterial {...SEAT_FABRIC} />
        </mesh>
      ))}
      <mesh position={[0, 0.82, 0.27]} rotation={[-0.2, 0, 0]}>
        <boxGeometry args={[0.46, 0.7, 0.09]} />
        <meshStandardMaterial {...SEAT_FABRIC} />
      </mesh>
      <mesh position={[0, 0.82, 0.31]} rotation={[-0.2, 0, 0]}>
        <boxGeometry args={[0.1, 0.62, 0.05]} />
        <meshStandardMaterial {...SEAT_TRIM} />
      </mesh>
      <mesh position={[0, 1.27, 0.33]} rotation={[-0.2, 0, 0]}>
        <capsuleGeometry args={[0.085, 0.1, 6, 12]} />
        <meshStandardMaterial {...SEAT_FABRIC} />
      </mesh>
      {[-1, 1].map((k) => (
        <group key={k} position={[k * 0.33, 0.62, 0.0]}>
          <mesh>
            <boxGeometry args={[0.05, 0.035, 0.4]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
          <mesh position={[0, -0.1, 0.1]}>
            <boxGeometry args={[0.03, 0.2, 0.03]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.05, 0.09, 0.4, 12]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.25, 0.28, 0.04, 20]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
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
  const hull = usePbrMaterial(PANEL_TEXTURES, [4, 2], HULL_OVERRIDES);
  const consoleMat = usePbrMaterial(PANEL_TEXTURES, [2, 1], CONSOLE_OVERRIDES);
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
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, -0.1]}
        material={consoleMat}
        receiveShadow
      >
        <planeGeometry args={[3.6, 3.4]} />
      </mesh>
      <mesh position={[0, 1.4, 1.6]} rotation={[0, Math.PI, 0]} material={hull}>
        <planeGeometry args={[3.8, 2.8]} />
      </mesh>

      {/* front bulkhead with the windscreen opening x ∈ [-1.25, 1.25], y ∈ [1.4, 2.15] */}
      <mesh position={[0, 0.65, -1.75]} material={hull}>
        <boxGeometry args={[3.8, 1.3, 0.1]} />
      </mesh>
      <mesh position={[0, 2.675, -1.75]} material={hull}>
        <boxGeometry args={[3.8, 0.55, 0.1]} />
      </mesh>
      {[-1, 1].map((k) => (
        <mesh key={k} position={[k * 1.75, 1.85, -1.75]} material={hull}>
          <boxGeometry args={[0.3, 1.1, 0.1]} />
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

      {/* console, screens and switch banks */}
      <mesh
        position={[0, 0.98, -1.18]}
        rotation={[-0.45, 0, 0]}
        material={consoleMat}
        castShadow={shadows}
        receiveShadow
      >
        <boxGeometry args={[3.0, 0.06, 0.78]} />
      </mesh>
      <mesh position={[0, 0.5, -1.38]} material={consoleMat}>
        <boxGeometry args={[3.0, 1.0, 0.4]} />
      </mesh>
      <Screen
        texture={screens.experience}
        position={[-0.72, 1.2, -1.38]}
        rotation={[-0.25, 0.28, 0]}
      />
      <Screen texture={screens.plan} position={[0, 1.22, -1.43]} rotation={[-0.25, 0, 0]} />
      <Screen
        texture={screens.education}
        position={[0.72, 1.2, -1.38]}
        rotation={[-0.25, -0.28, 0]}
      />
      <SwitchBank
        position={[-1.15, 1.02, -1.06]}
        rotation={[-1.12, 0, 0]}
        cols={8}
        rows={5}
        seed={3}
      />
      <SwitchBank
        position={[1.15, 1.02, -1.06]}
        rotation={[-1.12, 0, 0]}
        cols={8}
        rows={5}
        seed={5}
      />
      <SwitchBank
        position={[0, 2.62, -0.9]}
        rotation={[Math.PI / 2 + 0.4, 0, 0]}
        cols={14}
        rows={3}
        seed={7}
      />
      {/* lit console edge, overhead housing and floor lights */}
      <Trim position={[0, 1.2, -0.84]} size={[3.0, 0.014, 0.02]} color="#4fd8ff" />
      <mesh position={[0, 2.78, -0.8]} rotation={[0.25, 0, 0]} material={consoleMat}>
        <boxGeometry args={[2.2, 0.1, 0.9]} />
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
      {/* ignition switch (the close-up at the end of the chapter) */}
      <group position={[0, 0.93, -0.88]} rotation={[-0.45, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.16, 0.02, 0.1]} />
          <meshStandardMaterial color="#1a1c21" metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.03, 0]}>
          <boxGeometry args={[0.05, 0.05, 0.05]} />
          <meshStandardMaterial color="#b0352c" emissive="#ff3b2e" emissiveIntensity={0.6} />
        </mesh>
      </group>

      <Seat position={[-0.5, 0, -0.2]} />
      <Seat position={[0.55, 0, -0.2]} />
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
  { t: 0, position: [0.25, 1.62, 1.45], target: [0, 1.3, -1.4], fov: 55 },
  // over the shoulder onto the Experience screen (camera line checked to clear the astronaut's head)
  { t: 0.35, position: [0.35, 1.75, 0.45], target: [-0.72, 1.18, -1.38], fov: 40 },
  // across to the Education screen (clears the astronaut and the empty seat back)
  { t: 0.7, position: [-0.15, 1.78, 0.45], target: [0.72, 1.18, -1.38], fov: 40 },
  // down onto the ignition switch
  { t: 1, position: [0.05, 1.3, -0.45], target: [0, 0.93, -0.9], fov: 36 },
];

export const sc04CrewRecord: ChapterImpl = {
  Scene: CockpitScene,
  shot: (t, out) => void sampleKeys(cockpitKeys, t, out),
  background: '#04060b',
  environment: { key: 'room', intensity: 0.4 },
};
