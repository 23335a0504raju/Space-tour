import { useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import gsap from 'gsap';
import * as THREE from 'three';
import { chapters } from '../chapters/registry.ts';
import { useGsapDrivenFrames } from '../engine/clock.ts';
import { FrameStats } from '../engine/metrics/frameStats.ts';
import { buildTrack, dwell, progressFor, resolve } from '../engine/scroll/resolver.ts';
import { ScrollTrack } from '../engine/scroll/ScrollTrack.tsx';
import { useScrollMaster } from '../engine/scroll/useScrollMaster.ts';
import type { ScrollMasterState } from '../engine/scroll/useScrollMaster.ts';
import styles from './spikes.module.css';

/**
 * S1 questions:
 *  1. Does one ScrollTrigger + scrub drive a smooth playhead on desktop and Android?
 *  2. Does the timeline update and the render happen in the same tick (single clock)?
 *  3. Is the rendered state identical whichever direction you arrive from (reversibility)?
 *  4. Does a chapter jump skip intermediate chapters entirely?
 */
const SCRUB_SECONDS = 0.6;
const SPACING = 24;
const track = buildTrack(chapters, 'landscape');
const navChapters = chapters.filter((c) => c.navLabel);

const ACT_COLOURS: Record<string, string> = {
  origin: '#c9a46a',
  launch: '#7d9cc4',
  transit: '#a7a29a',
  beyond: '#d07aa8',
  homecoming: '#8cc49a',
};

interface Diagnostics {
  sameFrame: number;
  lagged: number;
  lastProgress: number;
  jumpVisits: Set<string> | null;
  lastJump: string;
  lastChapter: string;
  stats: FrameStats;
  lastTime: number;
}

/** Camera flies along a gentle curve past one cluster per chapter. Pure function of progress. */
function useCameraCurve() {
  return useMemo(() => {
    const points = chapters.map(
      (_, i) =>
        new THREE.Vector3(Math.sin(i * 0.9) * 6, 2 + Math.cos(i * 0.6) * 1.5, -i * SPACING + 10),
    );
    points.push(new THREE.Vector3(0, 2, -chapters.length * SPACING + 10));
    return new THREE.CatmullRomCurve3(points, false, 'centripetal');
  }, []);
}

function GreyBoxWorld() {
  return (
    <>
      {chapters.map((c, i) => (
        <group key={c.id} position={[0, 0, -i * SPACING]}>
          <mesh position={[0, 1, 0]}>
            <boxGeometry args={[3, 2, 3]} />
            <meshStandardMaterial color={ACT_COLOURS[c.act] ?? '#888'} roughness={0.6} />
          </mesh>
          <mesh position={[4, 0.5, -3]}>
            <icosahedronGeometry args={[1, 1]} />
            <meshStandardMaterial
              color={c.artStyle === 'anime' ? '#ff9ad5' : '#6d6a64'}
              flatShading
            />
          </mesh>
        </group>
      ))}
      <gridHelper
        args={[60, 60, '#333', '#1a1a1a']}
        position={[0, 0, -chapters.length * SPACING * 0.5]}
        scale={[1, 1, (chapters.length * SPACING) / 60]}
      />
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 20, 10]} intensity={2} />
    </>
  );
}

function Director({
  master,
  diag,
  hudRef,
  captionRef,
}: {
  master: ScrollMasterState;
  diag: Diagnostics;
  hudRef: RefObject<HTMLPreElement | null>;
  captionRef: RefObject<HTMLDivElement | null>;
}) {
  const curve = useCameraCurve();
  const pos = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const hudTick = useRef(0);

  useFrame(({ camera }) => {
    const now = performance.now();
    if (diag.lastTime > 0) diag.stats.push(now - diag.lastTime);
    diag.lastTime = now;

    const p = master.progress;
    if (p !== diag.lastProgress) {
      if (master.updatedOnFrame === gsap.ticker.frame) diag.sameFrame += 1;
      else diag.lagged += 1;
      diag.lastProgress = p;
    }

    // ── Story state: a pure function of p ──
    const { id, index, localT } = resolve(track, p);
    const meta = chapters[index];
    const t = dwell(localT, meta?.restPoints ?? []);
    curve.getPointAt(p, pos);
    curve.getPointAt(Math.min(1, p + 0.02), look);
    look.y -= 1;
    camera.position.copy(pos);
    camera.lookAt(look);

    if (diag.jumpVisits) diag.jumpVisits.add(id);
    diag.lastChapter = id;

    // Caption visible only near rest points (text at rest, never in fast motion).
    const near = (meta?.restPoints ?? []).some((r) => Math.abs(localT - r) < 0.1);
    if (captionRef.current) {
      captionRef.current.style.opacity = near ? '1' : '0';
      captionRef.current.textContent = meta ? `${meta.scene} · ${meta.title}` : '';
    }

    // HUD at ~8 Hz: direct DOM write, no React state.
    hudTick.current += 1;
    if (hudRef.current && hudTick.current % 8 === 0) {
      const s = diag.stats.summary();
      const total = diag.sameFrame + diag.lagged;
      const hash = `${pos.x.toFixed(3)},${pos.y.toFixed(3)},${pos.z.toFixed(3)}`;
      hudRef.current.textContent = [
        `S1 · scroll + single clock`,
        `progress   ${p.toFixed(4)}   (raw scroll ${master.scrollProgress.toFixed(4)})`,
        `chapter    ${id}`,
        `local t    ${localT.toFixed(3)}   dwell t ${t.toFixed(3)}`,
        `state hash ${hash}`,
        `same-frame ${total ? ((100 * diag.sameFrame) / total).toFixed(1) : '–'}%  (${diag.sameFrame}/${total})`,
        `frame ms   p50 ${s.p50.toFixed(1)}  p95 ${s.p95.toFixed(1)}  max ${s.max.toFixed(1)}`,
        `last jump  ${diag.lastJump || '–'}`,
      ].join('\n');
    }
  });

  return null;
}

export default function S1ScrollSync() {
  const trackRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLPreElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const master = useScrollMaster(trackRef, { scrub: SCRUB_SECONDS });
  const diagRef = useRef<Diagnostics>({
    sameFrame: 0,
    lagged: 0,
    lastProgress: -1,
    jumpVisits: null,
    lastJump: '',
    lastChapter: '',
    stats: new FrameStats(),
    lastTime: 0,
  });
  useGsapDrivenFrames();

  const jump = (id: string) => {
    const diag = diagRef.current;
    const fade = fadeRef.current;
    if (fade) fade.style.opacity = '1';
    window.setTimeout(() => {
      diag.jumpVisits = new Set();
      master.jumpTo(progressFor(track, id, 0.0001));
      window.setTimeout(() => {
        const visited = [...(diag.jumpVisits ?? [])];
        diag.lastJump = `${id}: rendered [${visited.join(', ')}]${visited.length === 1 && visited[0] === id ? ' ✓' : ' ✗'}`;
        diag.jumpVisits = null;
        if (fade) fade.style.opacity = '0';
      }, 250);
    }, 160);
  };

  return (
    <>
      <Canvas
        className={styles.canvas}
        frameloop="never"
        dpr={[1, 1.5]}
        camera={{ fov: 50, near: 0.1, far: 500 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#05060a']} />
        <fog attach="fog" args={['#05060a', 30, 90]} />
        <GreyBoxWorld />
        <Director
          master={master.state}
          diag={diagRef.current}
          hudRef={hudRef}
          captionRef={captionRef}
        />
      </Canvas>
      <pre ref={hudRef} className={styles.hud} aria-live="off" />
      <div ref={captionRef} className={styles.caption} />
      <div ref={fadeRef} className={styles.fade} />
      <nav className={styles.controls} aria-label="Jump to chapter">
        {navChapters.map((c) => (
          <button key={c.id} type="button" onClick={() => jump(c.id)}>
            {c.navLabel}
          </button>
        ))}
      </nav>
      <ScrollTrack ref={trackRef} screens={track.totalScreens} />
    </>
  );
}
