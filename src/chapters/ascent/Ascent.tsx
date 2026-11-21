import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { registerEnvironment } from '../../engine/environment.ts';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { useJourneyStore } from '../../engine/store.ts';
import {
  createCloudMaterial,
  createGroundMaterial,
  createSkyMaterial,
  createSmokeMaterial,
} from '../../shaders/atmosphere.ts';
import { createPlumeGeometry, createPlumeMaterial } from '../../shaders/plume.ts';
import type { ChapterImpl, ChapterSceneProps } from '../contract.ts';
import { seeded } from '../greybox/parts.tsx';
import { HELVELA, HelVela } from '../ship/HelVela.tsx';
import { LaunchPad, PIT } from './LaunchPad.tsx';
import type { EngineLevel } from '../ship/Spacecraft.tsx';
import {
  CLOUDS,
  PAD,
  altitude,
  armSwing,
  ascentShot,
  REDUCED_MOTION as REDUCED_MOTION_FLAG,
  clampsOpen,
  engine as engineAt,
  groundGlow,
  liftJets,
  shipPose,
  thinAir,
} from './ascent.ts';

/**
 * SC05 · Ignition & Ascent (FINAL_STORYLINE SC05; storyboard S06 + S07). The energy peak and the
 * first full view of the ship: night pad under floodlights → ignition → the crew arm swings away,
 * clamps release → liftoff → through the cloud deck → the sky goes black. No content (a breath).
 * Every story value comes from ascent.ts as a pure function of t.
 */

// ── Night environment for reflections (procedural, 0 bytes) ─────────────────────
function useLaunchEnvironment() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const scene = new THREE.Scene();
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(50, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        vertexShader: `varying vec3 d; void main(){ d = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `varying vec3 d; void main(){
          vec3 c = mix(vec3(0.05,0.07,0.12), vec3(0.01,0.015,0.03), smoothstep(0.0,0.6,d.y));
          c = mix(c, vec3(0.012,0.012,0.014), smoothstep(0.0,-0.25,d.y));
          gl_FragColor = vec4(c,1.0); }`,
      }),
    );
    scene.add(dome);
    // floodlight panels low around the horizon: the hull picks up their highlights
    const lamp = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 6.3, 7) });
    for (let i = 0; i < 4; i += 1) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), lamp);
      m.position.set(Math.cos(a) * 40, 12, Math.sin(a) * 40);
      m.lookAt(0, 6, 0);
      scene.add(m);
    }
    const pmrem = new THREE.PMREMGenerator(gl);
    // keep the render target: in three r187 only renderTarget.dispose() frees a PMREM result
    // (texture.dispose() skips render-target textures; it leaked one per visit)
    const target = pmrem.fromScene(scene, 0.02);
    const tex = target.texture;
    pmrem.dispose();
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
    });
    const unregister = registerEnvironment('launch-night', tex);
    return () => {
      unregister();
      target.dispose();
    };
  }, [gl]);
}

// ── Launch tower (instanced lattice) + crew access arm ───────────────────────────
// The tower stands beside the ship on its -z side; the arm reaches across to the hull.
const TOWER = { ...PAD.tower, bay: 2 } as const;
/** The ship's side faces the tower at z = -width/2; the arm stops just short of it. */
const HULL_SIDE_Z = -HELVELA.width / 2 - 0.2;

function towerMatrices(): THREE.Matrix4[] {
  const out: THREE.Matrix4[] = [];
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const box = (pos: THREE.Vector3, size: THREE.Vector3, rot = e.set(0, 0, 0)) =>
    out.push(new THREE.Matrix4().compose(pos, q.setFromEuler(rot), size));
  const h = TOWER.half;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      box(
        new THREE.Vector3(sx * h, TOWER.height / 2, sz * h),
        new THREE.Vector3(0.3, TOWER.height, 0.3),
      );
  const diag = Math.hypot(2 * h, TOWER.bay);
  const ang = Math.atan2(TOWER.bay, 2 * h);
  for (let y = TOWER.bay; y <= TOWER.height; y += TOWER.bay) {
    for (const s of [-1, 1]) {
      box(new THREE.Vector3(0, y, s * h), new THREE.Vector3(2 * h, 0.16, 0.16));
      box(new THREE.Vector3(s * h, y, 0), new THREE.Vector3(0.16, 0.16, 2 * h));
      // one diagonal per face per bay, alternating: the classic launch-tower lattice
      const flip = (y / TOWER.bay) % 2 ? 1 : -1;
      box(
        new THREE.Vector3(0, y - TOWER.bay / 2, s * h),
        new THREE.Vector3(diag, 0.1, 0.1),
        new THREE.Euler(0, 0, flip * ang),
      );
      box(
        new THREE.Vector3(s * h, y - TOWER.bay / 2, 0),
        new THREE.Vector3(0.1, 0.1, diag),
        new THREE.Euler(flip * ang, 0, 0),
      );
    }
  }
  // lightning mast
  box(new THREE.Vector3(0, TOWER.height + 4, 0), new THREE.Vector3(0.18, 8, 0.18));
  return out;
}

function Tower({ arm }: { arm: RefObject<THREE.Group | null> }) {
  const matrices = useMemo(() => towerMatrices(), []);
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    matrices.forEach((mx, i) => m.setMatrixAt(i, mx));
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [matrices]);
  const armY = PAD.mountY + HELVELA.height * 0.55;
  const armLen = HULL_SIDE_Z - (TOWER.z + TOWER.half); // tower face → just short of the hull
  return (
    <group position={[TOWER.x, 0, TOWER.z]}>
      {/* pedestal: the tower stands inside the pit, on its floor */}
      <mesh position={[0, PIT.floorY / 2, 0]}>
        <boxGeometry args={[2 * TOWER.half + 1.2, -PIT.floorY, 2 * TOWER.half + 1.2]} />
        <meshStandardMaterial color="#22262d" roughness={0.7} metalness={0.4} />
      </mesh>
      <instancedMesh ref={ref} args={[undefined, undefined, matrices.length]}>
        <boxGeometry />
        <meshStandardMaterial color="#2b3038" roughness={0.55} metalness={0.5} />
      </instancedMesh>
      {/* cool light strip up the ship-facing corner, matching the platform floods */}
      <mesh position={[TOWER.half, TOWER.height / 2, TOWER.half + 0.2]}>
        <boxGeometry args={[0.12, TOWER.height, 0.06]} />
        <meshBasicMaterial color={new THREE.Color(0.7, 1.6, 2.2)} toneMapped={false} />
      </mesh>
      {/* red aircraft-warning beacons */}
      {[TOWER.height, TOWER.height + 8].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <sphereGeometry args={[0.22, 12, 8]} />
          <meshBasicMaterial color={new THREE.Color(4, 0.35, 0.25)} toneMapped={false} />
        </mesh>
      ))}
      {/* crew access arm: pivots at the tower face, swings away before ignition */}
      <group ref={arm} position={[0, armY, TOWER.half]}>
        <mesh position={[0, 0, armLen / 2]} castShadow>
          <boxGeometry args={[1.5, 2.1, armLen]} />
          <meshStandardMaterial color="#3b4049" roughness={0.5} metalness={0.55} />
        </mesh>
        <mesh position={[0, -1.12, armLen / 2]}>
          <boxGeometry args={[1.7, 0.14, armLen]} />
          <meshStandardMaterial color="#3a3d44" roughness={0.6} metalness={0.6} />
        </mesh>
        {/* window strip along the walkway (both sides) */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.76, 0.25, armLen / 2]}>
            <boxGeometry args={[0.02, 0.35, armLen - 0.6]} />
            <meshStandardMaterial
              color="#000000"
              emissive="#ffe3b8"
              emissiveIntensity={1.4}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ── Pad, cradles, clamps, floodlights ─────────────────────────────────────────────
/** Two cradles carry the keel; four clamps hold the hull sides until release. */
const CRADLE_X = [-16, 16] as const;
const CLAMPS = CRADLE_X.flatMap((x) => [-1, 1].map((side) => [x, side] as const));

function Pad({ clamps }: { clamps: RefObject<(THREE.Group | null)[]> }) {
  const ground = useMemo(() => createGroundMaterial(), []);
  useDisposeOnUnmount(ground);
  return (
    <group>
      {/* ground: dissolves into the horizon before the far plane */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.05, 0]}
        material={ground}
        name="Ground"
      >
        {/* open over the launch pit */}
        <ringGeometry args={[PIT.radius, 1900, 96, 1]} />
      </mesh>
      {/* pit wall: dark concrete between the ground cut and the bowl */}
      <mesh position={[0, PIT.floorY / 2, 0]}>
        <cylinderGeometry args={[PIT.radius, PIT.radius, -PIT.floorY, 96, 1, true]} />
        <meshStandardMaterial
          color="#15171b"
          roughness={0.9}
          metalness={0.1}
          side={THREE.BackSide}
        />
      </mesh>
      {/* cradles under the keel: tapered steel pylons on the pit floor, a saddle that takes the
          keel, a cyan service strip on each face (they were plain grey boxes) */}
      {CRADLE_X.map((x) => (
        <group key={x} position={[x, 0, 0]}>
          {[-2.2, 2.2].map((z) => (
            <mesh key={z} position={[0, (PAD.mountY + PIT.floorY) / 2 - 0.2, z]}>
              <cylinderGeometry args={[0.55, 0.9, PAD.mountY - PIT.floorY - 0.4, 6]} />
              <meshStandardMaterial color="#23272e" roughness={0.45} metalness={0.7} />
            </mesh>
          ))}
          <mesh position={[0, PAD.mountY - 0.45, 0]}>
            <boxGeometry args={[2.4, 0.5, 6.6]} />
            <meshStandardMaterial color="#2b3038" roughness={0.4} metalness={0.75} />
          </mesh>
          <mesh position={[0, PAD.mountY - 0.12, 0]}>
            <boxGeometry args={[2.8, 0.16, 7.2]} />
            <meshStandardMaterial color="#14161a" roughness={0.6} metalness={0.5} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 1.21, PAD.mountY - 0.45, 0]}>
              <boxGeometry args={[0.02, 0.08, 6.0]} />
              <meshBasicMaterial color={new THREE.Color(0.5, 1.7, 2.2)} toneMapped={false} />
            </mesh>
          ))}
        </group>
      ))}
      {/* hold-down clamps against the hull sides: gunmetal arms with a hazard band and a red
          status lamp; they swing out and down at release */}
      {CLAMPS.map(([x, side], i) => (
        <group key={`${x}${side}`} position={[x, PAD.mountY, side * (HELVELA.width / 2 + 0.4)]}>
          <group
            ref={(g) => {
              clamps.current[i] = g;
            }}
          >
            <mesh position={[0, 0.7, side * 0.05]}>
              <boxGeometry args={[1.0, 1.4, 0.5]} />
              <meshStandardMaterial color="#2e333b" roughness={0.4} metalness={0.75} />
            </mesh>
            <mesh position={[0, 1.15, side * -0.12]}>
              <boxGeometry args={[1.05, 0.22, 0.32]} />
              <meshStandardMaterial color="#c8892a" roughness={0.55} metalness={0.3} />
            </mesh>
            <mesh position={[0, 0.35, side * 0.32]}>
              <sphereGeometry args={[0.08, 10, 8]} />
              <meshBasicMaterial color={new THREE.Color(3, 0.3, 0.2)} toneMapped={false} />
            </mesh>
          </group>
        </group>
      ))}
      {/* floodlight masts */}
      {FLOODS.map(([x, z]) => (
        <group key={`${x},${z}`} position={[x, 0, z]}>
          <mesh position={[0, 7, 0]}>
            <boxGeometry args={[0.35, 14, 0.35]} />
            <meshStandardMaterial color="#2c2e33" roughness={0.7} metalness={0.5} />
          </mesh>
          <mesh position={[0, 14.2, 0]} rotation={[0, Math.atan2(-x, -z), 0]}>
            <boxGeometry args={[1.8, 0.8, 0.3]} />
            <meshBasicMaterial color={new THREE.Color(2.2, 2.3, 2.5)} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
/** Clamp i's side (+1 / -1 in z): they swing outwards. */
const CLAMP_SIDES = CLAMPS.map(([, side]) => side);
// placed off the camera lines (the wide shot looks from +z, slightly toward the stern)
const FLOODS: ReadonlyArray<[number, number]> = [
  [44, 22],
  [-46, 24],
  [36, -34],
  [-40, -32],
];

/** Spot light with its target in the scene graph (the TargetedSpot lesson from P3). */
function Flood({ position, intensity }: { position: [number, number, number]; intensity: number }) {
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(0, 8, 0);
    return o;
  }, []);
  return (
    <>
      <primitive object={target} />
      <spotLight
        position={position}
        target={target}
        angle={0.32}
        penumbra={0.6}
        intensity={intensity}
        distance={90}
        decay={2}
        color="#dfe7ff"
      />
    </>
  );
}

// ── Smoke (instanced billboards, pure in t) ──────────────────────────────────────
interface Puff {
  born: number;
  /** direction around the pit (rad) */
  angle: number;
  /** column puffs rise through the pit under the belly; the rest vent over the rim and roll out */
  column: boolean;
  start: number;
  reach: number;
  rise: number;
  life: number;
  spin: number;
}

function makePuffs(n: number): Puff[] {
  const rand = seeded(505);
  return Array.from({ length: n }, () => {
    const column = rand() < 0.22;
    return {
      born: 0.11 + rand() * 0.26,
      angle: rand() * Math.PI * 2,
      column,
      start: column ? rand() * PIT.radius * 0.55 : PIT.radius * (0.9 + 0.12 * rand()),
      reach: column ? 4 + rand() * 6 : 10 + rand() * 38,
      rise: column ? 8 + rand() * 10 : 2 + rand() * 9,
      life: 6 + rand() * 8,
      spin: rand() * 6.28,
    };
  });
}

/** Story-time smoke age scale: one unit of t = 60 "seconds" of billow. */
const AGE = 60;

function Smoke({ count, t }: { count: number; t: { current: number } }) {
  const puffs = useMemo(() => makePuffs(count), [count]);
  const material = useMemo(() => createSmokeMaterial(), []);
  const geometry = useMemo(() => {
    const g = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);
    g.index = quad.index;
    g.setAttribute('position', quad.getAttribute('position'));
    g.setAttribute('uv', quad.getAttribute('uv'));
    g.setAttribute('iCenter', new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('iParams', new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4));
    g.instanceCount = count;
    return g;
  }, [count]);
  useDisposeOnUnmount(geometry, material);

  useFrame(() => {
    const now = t.current;
    const centers = geometry.getAttribute('iCenter') as THREE.InstancedBufferAttribute;
    const params = geometry.getAttribute('iParams') as THREE.InstancedBufferAttribute;
    const c = centers.array as Float32Array;
    const pa = params.array as Float32Array;
    material.uniforms.uGlow!.value = groundGlow(now);
    puffs.forEach((p, i) => {
      // only puffs born while the ship is still near the pad and the engines are lit
      const emitted = engineAt(p.born) > 0.05 && altitude(p.born) < 60;
      const age = (now - p.born) * AGE;
      if (!emitted || age <= 0 || age >= p.life) {
        pa[i * 4 + 1] = 0;
        return;
      }
      const k = age / p.life;
      const out = 1 - Math.exp(-age * 0.4);
      const r = p.start + p.reach * out;
      const x = Math.cos(p.angle) * r;
      const z = Math.sin(p.angle) * r;
      const y = p.column
        ? PIT.floorY * 0.4 + p.rise * Math.pow(k, 0.7)
        : 0.8 + p.rise * Math.pow(k, 0.9);
      c[i * 3] = x;
      c[i * 3 + 1] = y;
      c[i * 3 + 2] = z;
      const size = p.column ? 7 + 9 * Math.pow(k, 0.6) : 6 + 15 * Math.pow(k, 0.6);
      const alpha = Math.min(1, age / 0.6) * (1 - Math.max(0, (k - 0.5) / 0.5)) * 0.26;
      // engine light reaches the column and the rim, not the far billows
      const lit =
        Math.exp(-Math.max(0, r - PIT.radius * 0.6) / 18) * Math.exp(-Math.max(0, y) / 14);
      pa[i * 4] = size;
      pa[i * 4 + 1] = alpha;
      pa[i * 4 + 2] = p.spin + age * 0.03 * (p.angle > Math.PI ? 1 : -1);
      pa[i * 4 + 3] = lit;
    });
    centers.needsUpdate = true;
    params.needsUpdate = true;
  });

  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={2} />;
}

// ── Clouds, sky, stars, ground lights ────────────────────────────────────────────
function CloudDeck({
  layers,
  octaves,
  glow,
}: {
  layers: number;
  octaves: number;
  glow: { current: THREE.ShaderMaterial[] };
}) {
  const mats = useMemo(
    () =>
      Array.from({ length: layers }, (_, i) => {
        const m = createCloudMaterial(i * 1.7 + 0.3, octaves);
        m.uniforms.uOpacity!.value = 0.55 + 0.35 * ((i * 7) % 3) * 0.5;
        return m;
      }),
    [layers, octaves],
  );
  useEffect(() => {
    glow.current = mats;
  }, [mats, glow]);
  useDisposeOnUnmount(...mats);
  return (
    <group>
      {mats.map((m, i) => (
        <mesh
          key={i}
          material={m}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[
            0,
            CLOUDS.bottom + ((CLOUDS.top - CLOUDS.bottom) * i) / Math.max(1, layers - 1),
            0,
          ]}
          renderOrder={1}
          frustumCulled={false}
        >
          <planeGeometry args={[3600, 3600]} />
        </mesh>
      ))}
    </group>
  );
}

function makeStars(n: number) {
  const rand = seeded(77);
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 1) {
    const u = rand() * 0.98 + 0.02; // upper hemisphere (plus a sliver below the horizon at altitude)
    const th = rand() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u) * 1400;
    pos.set([r * Math.cos(th), u * 1400 - 60, r * Math.sin(th)], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return g;
}

function makeGroundLights(n: number) {
  const rand = seeded(303);
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  // clustered settlements: a handful of centres with lights scattered around each
  const centres = Array.from({ length: 14 }, () => {
    const a = rand() * Math.PI * 2;
    const r = 180 + rand() * 1300;
    return [Math.cos(a) * r, Math.sin(a) * r, 30 + rand() * 120] as const;
  });
  const warm = new THREE.Color('#ffc27a');
  const cool = new THREE.Color('#cfe2ff');
  const c = new THREE.Color();
  for (let i = 0; i < n; i += 1) {
    const ctr = centres[Math.floor(rand() * centres.length)] ?? [500, 500, 50];
    const a = rand() * Math.PI * 2;
    const r = Math.pow(rand(), 0.6) * ctr[2];
    pos.set([ctr[0] + Math.cos(a) * r, 0.5, ctr[1] + Math.sin(a) * r], i * 3);
    c.copy(warm)
      .lerp(cool, rand() * 0.4)
      .multiplyScalar(0.45 + rand() * 0.7);
    col.set([c.r, c.g, c.b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

// ── The scene ────────────────────────────────────────────────────────────────────
function AscentScene({ id, frame }: ChapterSceneProps) {
  const low = useJourneyStore((s) => s.tier === 'low');
  useLaunchEnvironment();

  const ship = useRef<THREE.Group>(null);
  const arm = useRef<THREE.Group>(null);
  const clamps = useRef<(THREE.Group | null)[]>([]);
  const plumeLight = useRef<THREE.PointLight>(null);
  const sky = useRef<THREE.Group>(null);
  const mainPlumes = useRef<(THREE.Mesh | null)[]>([]);
  const mainGlows = useRef<(THREE.Mesh | null)[]>([]);
  const liftPlumes = useRef<(THREE.Mesh | null)[]>([]);
  const shipPos = useMemo(() => new THREE.Vector3(), []);
  const engine = useRef<EngineLevel>({ current: 0 }).current;
  const story = useRef({ current: 0 }).current;
  const clouds = useRef<THREE.ShaderMaterial[]>([]);

  const skyMat = useMemo(() => createSkyMaterial(), []);
  const plumeMat = useMemo(() => createPlumeMaterial(low), [low]);
  const glowMat = useMemo(() => createPlumeMaterial(low, true), [low]);
  const liftMat = useMemo(() => createPlumeMaterial(low), [low]);
  const plumeGeo = useMemo(() => createPlumeGeometry(low ? 16 : 28), [low]);
  const stars = useMemo(() => makeStars(low ? 1200 : 2600), [low]);
  const starMat = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 1.4,
        sizeAttenuation: false,
        color: '#e6ebff',
        transparent: true,
        depthWrite: false,
      }),
    [],
  );
  const lights = useMemo(() => makeGroundLights(low ? 1400 : 3200), [low]);
  const lightsMat = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 1.6,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );
  useDisposeOnUnmount(
    skyMat,
    plumeMat,
    glowMat,
    liftMat,
    plumeGeo,
    stars,
    starMat,
    lights,
    lightsMat,
  );
  const ground = useRef<THREE.Mesh>(null);

  useFrame(({ camera, clock }) => {
    if (frame.id !== id) return;
    const t = frame.t;
    story.current = t;
    const e = engineAt(t);
    engine.current = e;
    const thin = thinAir(t);
    const lift = liftJets(t);
    const rz = shipPose(t, shipPos);
    if (ship.current) {
      ship.current.position.copy(shipPos);
      ship.current.rotation.z = rz;
    }
    if (arm.current) arm.current.rotation.y = -armSwing(t) * Math.PI * 0.5;
    const k = clampsOpen(t);
    clamps.current.forEach((c, i) => {
      if (!c) return;
      const side = CLAMP_SIDES[i] ?? 1;
      c.position.z = side * 1.2 * k;
      c.rotation.x = side * 1.1 * k;
    });

    // main engines: longer and wider in thin air (under-expanded exhaust)
    const len = (14 + 46 * thin) * (0.35 + 0.65 * e);
    const width = 1.1 * (1 + 1.6 * thin);
    plumeMat.uniforms.uIntensity!.value = e;
    plumeMat.uniforms.uExpand!.value = thin;
    plumeMat.uniforms.uLength!.value = len;
    plumeMat.uniforms.uTime!.value = clock.elapsedTime; // ambient flicker only
    for (const u of ['uIntensity', 'uExpand', 'uLength', 'uTime'] as const)
      glowMat.uniforms[u]!.value = plumeMat.uniforms[u]!.value;
    for (const p of mainPlumes.current) {
      if (!p) continue;
      p.visible = e > 0.01;
      p.scale.set(width, len, width);
    }
    for (const p of mainGlows.current) {
      if (!p) continue;
      p.visible = e > 0.01;
      p.scale.set(width * 2.6, len * 1.15, width * 2.6);
    }
    // belly lift jets: short downward columns during the VTOL lift
    liftMat.uniforms.uIntensity!.value = lift;
    liftMat.uniforms.uExpand!.value = 0;
    liftMat.uniforms.uLength!.value = 6;
    liftMat.uniforms.uTime!.value = clock.elapsedTime;
    for (const p of liftPlumes.current) {
      if (!p) continue;
      p.visible = lift > 0.01;
      p.scale.set(0.7, 3.2 + 2.6 * lift, 0.7);
    }
    if (plumeLight.current) {
      // behind the stern in flight, under the belly while the lift jets fire
      plumeLight.current.position.set(shipPos.x + 34 * (1 - lift), shipPos.y - 3 * lift, 0);
      plumeLight.current.intensity = 1500 * Math.max(e * 0.3, lift);
    }

    // clouds lit by the exhaust as the ship approaches and passes
    for (const m of clouds.current) {
      m.uniforms.uGlow!.value = e;
      (m.uniforms.uGlowPos!.value as THREE.Vector3).set(shipPos.x + 30, shipPos.y, 0);
      m.uniforms.uTime!.value = clock.elapsedTime;
    }

    const gm = ground.current?.material as THREE.ShaderMaterial | undefined;
    if (gm) {
      gm.uniforms.uGlow!.value = groundGlow(t);
      (gm.uniforms.uGlowPos!.value as THREE.Vector3).set(0, 0, 0);
      gm.uniforms.uThin!.value = thin;
    }

    // sky follows the camera (presentation only); darkens and reveals stars with altitude
    if (sky.current) sky.current.position.copy(camera.position);
    skyMat.uniforms.uThin!.value = thin;
    starMat.opacity = 0.35 + 0.65 * thin;
    // settlements vanish under the deck once the camera is above it (they glittered through it)
    lightsMat.opacity =
      1 - 0.9 * Math.min(1, Math.max(0, (camera.position.y - CLOUDS.bottom) / 160));
  });

  return (
    <group>
      <group ref={sky}>
        <mesh material={skyMat} renderOrder={-1} frustumCulled={false}>
          <sphereGeometry args={[1500, 48, 24]} />
        </mesh>
        <points geometry={stars} material={starMat} frustumCulled={false} renderOrder={0} />
      </group>

      {/* low fill so the shadow side stays dark; the moon sits behind the pad as a cool rim light,
          the floods and the engine glow are the warm keys (contrast, not even grey) */}
      <hemisphereLight args={['#33415c', '#070708', 0.28]} />
      <directionalLight position={[-30, 70, -110]} intensity={2.6} color="#a9c2ff" />
      <Flood position={[44, 16, 22]} intensity={3600} />
      <Flood position={[-46, 16, 24]} intensity={3200} />
      <pointLight ref={plumeLight} color="#ff9a52" intensity={0} distance={0} decay={2} />

      <PadWithGround ground={ground} clamps={clamps} />
      <LaunchPad />
      <Tower arm={arm} />
      <points geometry={lights} material={lightsMat} frustumCulled={false} />

      <group ref={ship} position={[0, PAD.mountY, 0]}>
        <HelVela engine={engine} />
        {/* stern thrusters: exhaust points +x (the plume geometry points -y; Rz(π/2) turns it) */}
        {HELVELA.mainEngines.map(([x, y, z], i) => (
          <group key={i} position={[x, y, z]} rotation={[0, 0, Math.PI / 2]}>
            <mesh
              ref={(m) => {
                mainPlumes.current[i] = m;
              }}
              geometry={plumeGeo}
              material={plumeMat}
              visible={false}
              frustumCulled={false}
              renderOrder={3}
            />
            <mesh
              ref={(m) => {
                mainGlows.current[i] = m;
              }}
              geometry={plumeGeo}
              material={glowMat}
              visible={false}
              frustumCulled={false}
              renderOrder={4}
            />
          </group>
        ))}
        {/* belly lift jets for the vertical lift-off */}
        {HELVELA.liftJets.map(([x, y, z], i) => (
          <mesh
            key={i}
            ref={(m) => {
              liftPlumes.current[i] = m;
            }}
            position={[x, y, z]}
            geometry={plumeGeo}
            material={liftMat}
            visible={false}
            frustumCulled={false}
            renderOrder={3}
          />
        ))}
      </group>

      <Smoke count={low ? 90 : 220} t={story} />
      <CloudDeck layers={low ? 3 : 6} octaves={low ? 3 : 5} glow={clouds} />
    </group>
  );
}

/** Pad + ground, exposing the ground mesh so its shader uniforms can be driven. */
function PadWithGround({
  ground,
  clamps,
}: {
  ground: RefObject<THREE.Mesh | null>;
  clamps: RefObject<(THREE.Group | null)[]>;
}) {
  const ref = useRef<THREE.Group>(null);
  useEffect(() => {
    ground.current = (ref.current?.getObjectByName('Ground') as THREE.Mesh | undefined) ?? null;
  }, [ground]);
  return (
    <group ref={ref}>
      <Pad clamps={clamps} />
    </group>
  );
}

export const sc05Ascent: ChapterImpl = {
  Scene: AscentScene,
  shot: (t, out, aspect) => ascentShot(t, out, REDUCED_MOTION_FLAG, aspect),
  portraitShift: 0, // no text in SC05: keep the ship centred
  background: '#050912',
  environment: { key: 'launch-night', intensity: 0.6 },
};
