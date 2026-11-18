import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import * as THREE from 'three';
import { readDeviceInfo } from '../engine/metrics/deviceInfo.ts';
import type { DeviceInfo } from '../engine/metrics/deviceInfo.ts';
import { FrameStats } from '../engine/metrics/frameStats.ts';
import type { FrameSummary } from '../engine/metrics/frameStats.ts';
import { dprForBudget, PIXEL_BUDGET_MP } from '../engine/quality/pixelBudget.ts';
import type { QualityTier } from '../engine/quality/pixelBudget.ts';
import soldierUrl from './assets/Soldier.nosimplify.glb?url';
import styles from './spikes.module.css';

/**
 * S4: performance baseline on the real reference devices (Radeon 780M laptop, Android phone).
 * Representative workloads at both tiers; frame times are measured, nothing is assumed.
 * Note: rAF intervals are capped by the display refresh, so p50 ≈ 16.7 ms (60 Hz) or 8.3 ms
 * (120 Hz) means "keeping up"; p95 above the refresh interval means dropped frames.
 */
const SCENES = ['empty', 'planet', 'character', 'instanced'] as const;
type SceneId = (typeof SCENES)[number];
const TIERS: QualityTier[] = ['balanced', 'low'];
const RUN_SECONDS = 8;
const WARMUP_SECONDS = 1.5;

const STARS: Record<QualityTier, number> = { balanced: 30_000, low: 10_000 };
const ROCKS: Record<QualityTier, number> = { balanced: 800, low: 250 };

// ── Workloads ───────────────────────────────────────────────────────────────

const planetVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPos;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const planetFragment = /* glsl */ `
  uniform vec3 uSunDir;
  uniform float uOctaves;
  varying vec3 vNormal;
  varying vec3 vPos;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float noise(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 8; i++) { if (float(i) >= uOctaves) break; v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }
  void main() {
    float n = fbm(vPos * 2.5);
    vec3 ocean = vec3(0.05, 0.12, 0.25);
    vec3 land = mix(vec3(0.25, 0.3, 0.15), vec3(0.55, 0.45, 0.3), n);
    vec3 base = mix(ocean, land, smoothstep(0.48, 0.52, n));
    float light = max(dot(normalize(vNormal), normalize(uSunDir)), 0.0);
    float rim = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 3.0);
    gl_FragColor = vec4(base * (0.04 + light) + vec3(0.3, 0.5, 1.0) * rim * 0.6, 1.0);
  }
`;

function Planet({ tier }: { tier: QualityTier }) {
  const uniforms = useMemo(
    () => ({
      uSunDir: { value: new THREE.Vector3(1, 0.3, 0.6) },
      uOctaves: { value: tier === 'balanced' ? 6 : 3 },
    }),
    [tier],
  );
  return (
    <mesh>
      <sphereGeometry args={[2, tier === 'balanced' ? 128 : 64, tier === 'balanced' ? 64 : 32]} />
      <shaderMaterial
        vertexShader={planetVertex}
        fragmentShader={planetFragment}
        uniforms={uniforms}
      />
    </mesh>
  );
}

function Stars({ count }: { count: number }) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(count * 3);
    let seed = 1;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < count; i += 1) {
      const u = rand() * 2 - 1;
      const th = rand() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u) * 200;
      p.set([r * Math.cos(th), u * 200, r * Math.sin(th)], i * 3);
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return g;
  }, [count]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <points geometry={geometry}>
      <pointsMaterial size={1.2} sizeAttenuation={false} color="#dfe6ff" />
    </points>
  );
}

function Rocks({ count }: { count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3();
    const pos = new THREE.Vector3();
    let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < count; i += 1) {
      const a = rand() * Math.PI * 2;
      const r = 6 + rand() * 6;
      pos.set(Math.cos(a) * r, (rand() - 0.5) * 2, Math.sin(a) * r);
      q.setFromEuler(e.set(rand() * 6, rand() * 6, rand() * 6));
      const k = 0.1 + rand() * 0.4;
      s.set(k, k * (0.6 + rand() * 0.6), k);
      mesh.setMatrixAt(i, m.compose(pos, q, s));
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [count]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color="#77736c" roughness={0.9} flatShading />
    </instancedMesh>
  );
}

function Character({ shadows }: { shadows: boolean }) {
  const { scene, animations } = useGLTF(soldierUrl, false, true);
  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene]);
  useEffect(() => {
    const walk = animations.find((a) => a.name === 'Walk');
    if (walk) mixer.clipAction(walk).play();
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = shadows;
    });
    return () => void mixer.stopAllAction();
  }, [mixer, animations, scene, shadows]);
  useFrame((_, dt) => mixer.update(dt));
  return <primitive object={scene} scale={1.4} position={[0, -1.3, 0]} />;
}

// ── Measurement ─────────────────────────────────────────────────────────────

interface RunResult extends FrameSummary {
  readonly scene: SceneId;
  readonly tier: QualityTier;
  readonly dpr: number;
  readonly renderSize: string;
  readonly megapixels: number;
  readonly drawCalls: number;
  readonly triangles: number;
  readonly textures: number;
  readonly geometries: number;
}

interface Job {
  scene: SceneId;
  tier: QualityTier;
}

function Measure({ job, onDone }: { job: Job; onDone: (r: RunResult) => void }) {
  const { gl, size, camera } = useThree();
  const stats = useMemo(() => new FrameStats(2000), []);
  const start = useRef(-1);
  const last = useRef(0);
  const done = useRef(false);
  const frameInfo = useRef({ calls: 0, triangles: 0 });

  // Post-processing renders several passes per frame and three.js resets its counters on each
  // pass, so accumulate manually: read the totals for the previous frame, then reset.
  useEffect(() => {
    const info = gl.info;
    info.autoReset = false;
    return () => {
      info.autoReset = true;
    };
  }, [gl]);

  useFrame(({ clock }) => {
    frameInfo.current.calls = Math.max(frameInfo.current.calls, gl.info.render.calls);
    frameInfo.current.triangles = Math.max(frameInfo.current.triangles, gl.info.render.triangles);
    gl.info.reset();
    const now = performance.now();
    if (start.current < 0) start.current = now;
    const elapsed = (now - start.current) / 1000;
    if (elapsed > WARMUP_SECONDS && last.current > 0) stats.push(now - last.current);
    last.current = now;

    // Camera orbit (wall-clock; this is a benchmark, not story).
    const a = clock.elapsedTime * 0.25;
    camera.position.set(Math.cos(a) * 8, 2.5, Math.sin(a) * 8);
    camera.lookAt(0, 0, 0);

    if (!done.current && elapsed > WARMUP_SECONDS + RUN_SECONDS) {
      done.current = true;
      const dpr = gl.getPixelRatio();
      const w = Math.round(size.width * dpr);
      const h = Math.round(size.height * dpr);
      onDone({
        ...stats.summary(),
        scene: job.scene,
        tier: job.tier,
        dpr,
        renderSize: `${w}×${h}`,
        megapixels: Math.round((w * h) / 10_000) / 100,
        drawCalls: frameInfo.current.calls,
        triangles: frameInfo.current.triangles,
        textures: gl.info.memory.textures,
        geometries: gl.info.memory.geometries,
      });
    }
  });
  return null;
}

/**
 * Finding (S4): calling `setDpr` from inside the canvas does not stick: whenever the parent
 * re-renders, <Canvas> re-applies its own `dpr` prop. The pixel budget must therefore be passed
 * AS the Canvas `dpr` prop (the quality system owns that prop in the engine).
 */
function budgetDpr(tier: QualityTier): number {
  return dprForBudget(
    window.innerWidth,
    window.innerHeight,
    window.devicePixelRatio,
    PIXEL_BUDGET_MP[tier],
  );
}

function DeviceProbe({ onInfo }: { onInfo: (d: DeviceInfo) => void }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => onInfo(readDeviceInfo(gl.getContext())), [gl, onInfo]);
  return null;
}

function Workload({ job }: { job: Job }) {
  const balanced = job.tier === 'balanced';
  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[5, 6, 4]}
        intensity={2.5}
        castShadow={balanced && job.scene === 'character'}
        shadow-mapSize={[1024, 1024]}
      />
      {job.scene !== 'empty' && <Stars count={STARS[job.tier]} />}
      {job.scene === 'planet' && <Planet tier={job.tier} />}
      {job.scene === 'instanced' && <Rocks count={ROCKS[job.tier]} />}
      {job.scene === 'character' && (
        <Suspense fallback={null}>
          <Character shadows={balanced} />
          <mesh rotation-x={-Math.PI / 2} position={[0, -1.3, 0]} receiveShadow>
            <planeGeometry args={[10, 10]} />
            <meshStandardMaterial color="#1b1d22" />
          </mesh>
        </Suspense>
      )}
      {balanced && (
        <EffectComposer multisampling={0}>
          <Bloom mipmapBlur intensity={0.6} luminanceThreshold={0.7} />
        </EffectComposer>
      )}
    </>
  );
}

export default function S4PerfBaseline() {
  const [queue, setQueue] = useState<Job[]>([]);
  const [results, setResults] = useState<RunResult[]>([]);
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [preview, setPreview] = useState<Job>({ scene: 'planet', tier: 'balanced' });
  const current = queue[0] ?? null;
  const job = current ?? preview;

  const runAll = () => {
    setResults([]);
    setQueue(SCENES.flatMap((scene) => TIERS.map((tier) => ({ scene, tier }))));
  };

  const report = useMemo(
    () =>
      results.length
        ? JSON.stringify(
            {
              spike: 'S4',
              date: new Date().toISOString(),
              runSeconds: RUN_SECONDS,
              device,
              results,
            },
            null,
            2,
          )
        : '',
    [results, device],
  );

  const download = () => {
    const blob = new Blob([report], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `s4-baseline-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const status = current
    ? `Running ${current.scene} · ${current.tier}  (${results.length + 1}/${SCENES.length * TIERS.length}), keep this tab visible`
    : results.length
      ? `Done: ${results.length} runs`
      : 'Idle: press “Run all” (≈ 80 s). Plug the laptop in; close other heavy tabs.';

  return (
    <>
      <Canvas
        key={`${job.scene}-${job.tier}-${queue.length}`}
        className={styles.canvas}
        shadows="percentage"
        dpr={budgetDpr(job.tier)}
        camera={{ fov: 45, near: 0.1, far: 1000, position: [8, 2.5, 0] }}
        gl={{ antialias: job.tier === 'balanced', powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#05060a']} />
        <DeviceProbe onInfo={setDevice} />
        <Workload job={job} />
        {current && (
          <Measure
            job={current}
            onDone={(r) => {
              setResults((prev) => [...prev, r]);
              setQueue((q) => q.slice(1));
            }}
          />
        )}
      </Canvas>
      <pre className={styles.hud}>
        {[
          'S4 · performance baseline',
          status,
          device ? `GPU  ${device.gpuRenderer}` : '',
          ...results.map(
            (r) =>
              `${r.scene.padEnd(9)} ${r.tier.padEnd(8)} p50 ${r.p50.toFixed(1)}  p95 ${r.p95.toFixed(1)} ms  ${r.avgFps.toFixed(0)} fps  ${r.renderSize}  ${r.drawCalls} calls`,
          ),
        ]
          .filter(Boolean)
          .join('\n')}
      </pre>
      {report && <pre className={styles.result}>{report}</pre>}
      <nav className={styles.controls} aria-label="Benchmark controls">
        {!current && (
          <>
            <select
              aria-label="Preview scene"
              value={preview.scene}
              onChange={(e) => setPreview((p) => ({ ...p, scene: e.target.value as SceneId }))}
            >
              {SCENES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select
              aria-label="Preview tier"
              value={preview.tier}
              onChange={(e) => setPreview((p) => ({ ...p, tier: e.target.value as QualityTier }))}
            >
              {TIERS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <button type="button" onClick={runAll}>
              Run all
            </button>
          </>
        )}
        {report && (
          <>
            <button type="button" onClick={() => void navigator.clipboard?.writeText(report)}>
              Copy JSON
            </button>
            <button type="button" onClick={download}>
              Download JSON
            </button>
          </>
        )}
      </nav>
    </>
  );
}
