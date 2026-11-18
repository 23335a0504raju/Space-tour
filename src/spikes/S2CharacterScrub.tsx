import { Suspense, useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { gltfExtender } from '../engine/assets/loaders.ts';
import { useGsapDrivenFrames } from '../engine/clock.ts';
import { measureWalk } from '../engine/characters/stride.ts';
import type { FootSample } from '../engine/characters/stride.ts';
import { ScrollTrack } from '../engine/scroll/ScrollTrack.tsx';
import { useScrollMaster } from '../engine/scroll/useScrollMaster.ts';
import type { ScrollMasterState } from '../engine/scroll/useScrollMaster.ts';
import etc1sUrl from './assets/Soldier.etc1s.glb?url';
import ktx2Url from './assets/Soldier.ktx2.glb?url';
import optimisedUrl from './assets/Soldier.nosimplify.glb?url';
import simplifiedUrl from './assets/Soldier.opt.glb?url';
import styles from './spikes.module.css';

/**
 * S2 questions:
 *  1. Can a free rigged model's in-place walk be driven by scroll with feet planted (no sliding)?
 *  2. Does it reverse cleanly (walk backwards when scrolling up) with no pops at clip blends?
 *  3. Does the Meshopt-compressed GLB (from S3) load and deform correctly?
 *  4. Does gltf-transform's default simplification visibly damage a skinned mesh?
 */
const VARIANTS = {
  optimised: optimisedUrl, // Meshopt + WebP, no simplify (0.56 MB)
  simplified: simplifiedUrl, // Meshopt + WebP + default simplify
  ktx2: ktx2Url, // Meshopt + KTX2 (UASTC normal, ETC1S colour) (1.54 MB)
  etc1s: etc1sUrl, // Meshopt + KTX2 all ETC1S (0.64 MB)
} as const;
type Variant = keyof typeof VARIANTS;
const requested = new URLSearchParams(window.location.search).get('v') ?? '';
const variant: Variant = requested in VARIANTS ? (requested as Variant) : 'optimised';
const MODEL_URL = VARIANTS[variant];
const PATH_LENGTH = 6; // metres walked across the scroll range
const WALK_START = 0.15;
const WALK_END = 0.95;
const SAMPLES = 120;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeInOutSine = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2;

/** Story functions of scroll progress t. Pure, so reversing is exact. */
export const walkDistance = (t: number) =>
  PATH_LENGTH * easeInOutSine(clamp01((t - WALK_START) / (WALK_END - WALK_START)));
export const walkWeight = (t: number) =>
  smoothstep(WALK_START, WALK_START + 0.1, t) * (1 - smoothstep(WALK_END - 0.1, WALK_END, t));

interface Meter {
  plantedFoot: THREE.Object3D | null;
  plantedAt: THREE.Vector3;
  slideMaxCm: number;
  slideTotal: number;
  travelTotal: number;
  lastRootH: number;
}

function Character({
  master,
  hudRef,
}: {
  master: ScrollMasterState;
  hudRef: RefObject<HTMLPreElement | null>;
}) {
  const gl = useThree((s) => s.gl);
  const gltf = useGLTF(MODEL_URL, false, true, gltfExtender(gl));
  const scene = gltf.scene;
  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene]);

  const rig = useMemo(() => {
    // Prefer toe bones: during heel-lift the ankle ("Foot") rises and moves while the toes are
    // still planted, which would read as false slide and skew the speed estimate.
    let left: THREE.Object3D | null = null;
    let right: THREE.Object3D | null = null;
    let leftToe: THREE.Object3D | null = null;
    let rightToe: THREE.Object3D | null = null;
    let triangles = 0;
    scene.traverse((o) => {
      if (/LeftFoot$/i.test(o.name)) left = o;
      if (/RightFoot$/i.test(o.name)) right = o;
      if (/LeftToeBase$/i.test(o.name)) leftToe = o;
      if (/RightToeBase$/i.test(o.name)) rightToe = o;
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        const index = mesh.geometry.index;
        triangles += (index ? index.count : (mesh.geometry.attributes.position?.count ?? 0)) / 3;
      }
    });
    const idleClip = gltf.animations.find((a) => a.name === 'Idle');
    const walkClip = gltf.animations.find((a) => a.name === 'Walk');
    if (!left || !right || !idleClip || !walkClip) {
      throw new Error('S2: expected LeftFoot/RightFoot bones and Idle/Walk clips');
    }
    const idle = mixer.clipAction(idleClip);
    const walk = mixer.clipAction(walkClip);
    idle.play();
    walk.play();
    const usingToes = leftToe !== null && rightToe !== null;
    return {
      left: (leftToe ?? left) as THREE.Object3D,
      right: (rightToe ?? right) as THREE.Object3D,
      footBone: usingToes ? 'ToeBase' : 'Foot',
      idle,
      walk,
      walkDuration: walkClip.duration,
      triangles,
    };
  }, [scene, gltf.animations, mixer]);

  // Measure the clip's implied ground speed once, from the foot bones (engine/characters/stride.ts).
  const measurement = useMemo(() => {
    const v = new THREE.Vector3();
    const series = {
      lx: [] as FootSample[],
      lz: [] as FootSample[],
      rx: [] as FootSample[],
      rz: [] as FootSample[],
    };
    let minFootY = Infinity;
    rig.idle.setEffectiveWeight(0);
    rig.walk.setEffectiveWeight(1);
    for (let i = 0; i < SAMPLES; i += 1) {
      const t = (i / SAMPLES) * rig.walkDuration;
      rig.walk.time = t;
      mixer.update(0);
      scene.updateMatrixWorld(true);
      rig.left.getWorldPosition(v);
      series.lx.push({ t, y: v.y, h: v.x });
      series.lz.push({ t, y: v.y, h: v.z });
      minFootY = Math.min(minFootY, v.y);
      rig.right.getWorldPosition(v);
      series.rx.push({ t, y: v.y, h: v.x });
      series.rz.push({ t, y: v.y, h: v.z });
      minFootY = Math.min(minFootY, v.y);
    }
    const alongX = measureWalk([series.lx, series.rx]);
    const alongZ = measureWalk([series.lz, series.rz]);
    const useZ = alongZ.speed >= alongX.speed;
    const m = useZ ? alongZ : alongX;
    const dir = new THREE.Vector3(useZ ? 0 : m.direction, 0, useZ ? m.direction : 0);
    return { speed: m.speed, dir, axis: useZ ? 'z' : 'x', samples: m.samples, minFootY };
  }, [rig, mixer, scene]);

  const meter = useRef<Meter>({
    plantedFoot: null,
    plantedAt: new THREE.Vector3(),
    slideMaxCm: 0,
    slideTotal: 0,
    travelTotal: 0,
    lastRootH: 0,
  });
  const tmp = useMemo(
    () => ({
      l: new THREE.Vector3(),
      r: new THREE.Vector3(),
      cam: new THREE.Vector3(),
      side: new THREE.Vector3(),
    }),
    [],
  );
  const hudTick = useRef(0);

  // Start/stop symmetrically in one effect. (Bug found by the slide meter: a cleanup-only
  // effect let StrictMode's simulated unmount stop the actions permanently, so the walk never
  // played at runtime even though load-time measurement worked.)
  useEffect(() => {
    rig.idle.play();
    rig.walk.play();
    return () => void mixer.stopAllAction();
  }, [rig, mixer]);

  useFrame(({ camera, clock }) => {
    const t = master.progress;
    const distance = walkDistance(t);
    const wWalk = walkWeight(t);

    // Story time: position and walk-clip phase come from distance only.
    scene.position.copy(measurement.dir).multiplyScalar(distance);
    rig.walk.time = measurement.speed > 0 ? (distance / measurement.speed) % rig.walkDuration : 0;
    rig.walk.setEffectiveWeight(wWalk);
    // Ambient time: idle breathing runs on the wall clock (allowed; carries no story meaning).
    rig.idle.time = clock.elapsedTime % (rig.idle.getClip().duration || 1);
    rig.idle.setEffectiveWeight(1 - wWalk);
    mixer.update(0);
    scene.updateMatrixWorld(true);

    // Camera: side tracking shot, pure function of distance.
    tmp.side.set(-measurement.dir.z, 0, measurement.dir.x).multiplyScalar(4.2);
    tmp.cam
      .copy(scene.position)
      .add(tmp.side)
      .add(new THREE.Vector3(0, 1.5, 0));
    camera.position.copy(tmp.cam);
    camera.lookAt(scene.position.x, 1, scene.position.z);

    // Foot-slide meter: a planted foot should not move horizontally while fully walking.
    const m = meter.current;
    rig.left.getWorldPosition(tmp.l);
    rig.right.getWorldPosition(tmp.r);
    const lower = tmp.l.y < tmp.r.y ? rig.left : rig.right;
    const lowerPos = lower === rig.left ? tmp.l : tmp.r;
    const planted = lowerPos.y < measurement.minFootY + 0.01;
    const rootH = distance;
    if (wWalk > 0.98 && planted && m.plantedFoot === lower) {
      const dx = lowerPos.x - m.plantedAt.x;
      const dz = lowerPos.z - m.plantedAt.z;
      const slide = Math.hypot(dx, dz);
      m.slideTotal += slide;
      m.travelTotal += Math.abs(rootH - m.lastRootH);
      m.slideMaxCm = Math.max(m.slideMaxCm, slide * 100);
    }
    m.plantedFoot = planted ? lower : null;
    m.plantedAt.copy(lowerPos);
    m.lastRootH = rootH;

    hudTick.current += 1;
    if (hudRef.current && hudTick.current % 8 === 0) {
      const pct = m.travelTotal > 0 ? (100 * m.slideTotal) / m.travelTotal : 0;
      hudRef.current.textContent = [
        `S2 · scroll-scrubbed walk   [${variant}]`,
        `model      ${Math.round(rig.triangles).toLocaleString()} triangles`,
        `walk speed ${measurement.speed.toFixed(3)} m/s along ${measurement.axis} (${measurement.samples} planted samples, ${rig.footBone})`,
        `progress   ${t.toFixed(4)}`,
        `distance   ${distance.toFixed(3)} m   walk weight ${wWalk.toFixed(2)}`,
        `walk time  ${rig.walk.time.toFixed(3)} s`,
        `state hash ${scene.position.x.toFixed(3)},${scene.position.z.toFixed(3)},${rig.walk.time.toFixed(3)}`,
        `foot slide max ${m.slideMaxCm.toFixed(2)} cm/frame · total ${pct.toFixed(1)}% of travel`,
        `           (target: ≈0; measured only at full walk weight)`,
      ].join('\n');
    }
  });

  return <primitive object={scene} />;
}

export default function S2CharacterScrub() {
  const trackRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLPreElement>(null);
  const master = useScrollMaster(trackRef, { scrub: 0.6 });
  useGsapDrivenFrames();

  return (
    <>
      <Canvas
        className={styles.canvas}
        frameloop="never"
        shadows="percentage"
        dpr={[1, 1.5]}
        camera={{ fov: 40, near: 0.1, far: 100 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#05060a']} />
        <hemisphereLight args={['#d6dcff', '#262019', 1.2]} />
        <directionalLight
          position={[4, 8, 3]}
          intensity={2.2}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-4}
          shadow-camera-right={4}
          shadow-camera-top={4}
          shadow-camera-bottom={-4}
        />
        <mesh rotation-x={-Math.PI / 2} receiveShadow position={[0, 0, PATH_LENGTH / 2]}>
          <planeGeometry args={[12, PATH_LENGTH + 8]} />
          <meshStandardMaterial color="#15171d" />
        </mesh>
        <gridHelper args={[20, 40, '#3a3a3a', '#24262c']} position={[0, 0.002, PATH_LENGTH / 2]} />
        <Suspense fallback={null}>
          <Character master={master.state} hudRef={hudRef} />
        </Suspense>
      </Canvas>
      <pre ref={hudRef} className={styles.hud} />
      <nav className={styles.controls} aria-label="Spike controls">
        {(Object.keys(VARIANTS) as Variant[])
          .filter((v) => v !== variant)
          .map((v) => (
            <button key={v} type="button" onClick={() => window.location.assign(`?s=s2&v=${v}`)}>
              {v}
            </button>
          ))}
      </nav>
      <ScrollTrack ref={trackRef} screens={5} />
    </>
  );
}
