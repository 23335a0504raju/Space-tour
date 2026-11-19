import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import gsap from 'gsap';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Bloom, EffectComposer, SMAA, ToneMapping, wrapEffect } from '@react-three/postprocessing';
import { StyleBlendEffect } from '../../shaders/styleBlend.ts';
import { LensEffect } from '../../shaders/lens.ts';
import { ToneMappingMode } from 'postprocessing';
import { chapters } from '../../chapters/registry.ts';
import { implementations } from '../../chapters/implementations.ts';
import { overlayDefs } from '../../chapters/overlays.tsx';
import overlayStyles from '../../chapters/overlays.module.css';
import { createJourneyFrame } from '../../chapters/contract.ts';
import type { JourneyFrame } from '../../chapters/contract.ts';
import { ContactPanel } from '../../ui/ContactPanel.tsx';
import { useGsapDrivenFrames } from '../clock.ts';
import { Director } from '../director/Director.tsx';
import type { DirectorLinks } from '../director/Director.tsx';
import {
  readDeviceSignals,
  readTierOverride,
  recommendTier,
  writeTierOverride,
} from '../quality/detect.ts';
import { dprForBudget, PIXEL_BUDGET_MP } from '../quality/pixelBudget.ts';
import type { QualityTier } from '../quality/pixelBudget.ts';
import { buildTrack, classifyAspect, progressFor } from '../scroll/resolver.ts';
import { ScrollTrack } from '../scroll/ScrollTrack.tsx';
import { usePacedWheel } from '../scroll/usePacedWheel.ts';
import { useScrollMaster } from '../scroll/useScrollMaster.ts';
import { preloadJourney } from '../assets/preload.ts';
import { useJourneyStore } from '../store.ts';
import styles from './Journey.module.css';

const SCRUB_SECONDS = 0.35;
/** Chapters kept mounted around the active one (lifecycle "warm" window). */
const WARM_WINDOW = 1;
/** Slow networks: stop waiting for the full download after this and stream the rest. */
const PRELOAD_GIVE_UP_MS = 45_000;

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Exactly one tone-mapping stage. With the post chain (Balanced) the ToneMapping effect owns it and
 * the renderer must not tone map again: doing both lifted night blacks to blue-grey (P3 review).
 * Without post (Low) the renderer applies AgX itself.
 */
const StyleBlend = wrapEffect(StyleBlendEffect);
const Lens = wrapEffect(LensEffect);

/** Copies the black hole's lens state to the lens pass each frame (no React state). */
function LensSync({ effect }: { effect: RefObject<LensEffect | null> }) {
  useFrame(() => effect.current?.sync());
  return null;
}

/** Copies the Director's art-style value to the style pass each frame (no React state). */
function StyleSync({
  frame,
  effect,
}: {
  frame: JourneyFrame;
  effect: RefObject<StyleBlendEffect | null>;
}) {
  useFrame(() => {
    if (effect.current) effect.current.style = frame.style;
  });
  return null;
}

function ToneMappingOwner({ composer }: { composer: boolean }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.toneMapping = composer ? THREE.NoToneMapping : THREE.AgXToneMapping;
  }, [gl, composer]);
  return null;
}

/** Mounts one chapter's scene, registers its group with the Director and precompiles shaders. */
function ChapterSlot({
  id,
  frame,
  links,
}: {
  id: string;
  frame: JourneyFrame;
  links: DirectorLinks;
}) {
  const ref = useRef<THREE.Group>(null);
  const { gl, camera, scene } = useThree();
  const impl = implementations[id];

  useEffect(() => {
    const group = ref.current;
    if (!group) return;
    links.groups.set(id, group);
    // compile() skips invisible objects, so show the group just for the synchronous part.
    group.visible = true;
    gl.compileAsync(group, camera, scene).catch(() => undefined);
    group.visible = frame.id === id;
    return () => {
      links.groups.delete(id);
    };
  }, [id, gl, camera, scene, links, frame]);

  if (!impl) return null;
  const { Scene } = impl;
  return (
    <group ref={ref}>
      {/* Per-chapter boundary: a chapter streaming in assets never blanks the others. */}
      <Suspense fallback={null}>
        <Scene id={id} frame={frame} />
      </Suspense>
    </group>
  );
}

function OverlayLayer({ links }: { links: DirectorLinks }) {
  return (
    <div className={overlayStyles.layer}>
      {overlayDefs.map((def) => (
        <section
          key={def.key}
          aria-label={def.label}
          className={`${overlayStyles.panel} ${overlayStyles[def.placement]}`}
          ref={(el) => {
            if (el) {
              // React re-runs this inline ref on every re-render (e.g. when the active chapter
              // changes). Re-creating the entry reset `last`/`visible` while the DOM still showed
              // the panel, so the Director never hid it again: SC04's Education panel stayed on
              // screen in SC05 after a jump (found in P4). Keep the entry for the same element.
              if (links.overlays.get(def.key)?.el === el) return;
              el.inert = true;
              el.setAttribute('aria-hidden', 'true');
              el.style.opacity = '0';
              el.style.visibility = 'hidden';
              links.overlays.set(def.key, {
                el,
                chapterId: def.chapterId,
                rest: def.rest,
                holdToEnd: def.holdToEnd ?? false,
                last: 0,
                visible: false,
              });
            }
            // (no delete on null: React passes null before re-attaching the same element; the
            // whole layer only unmounts with the Journey, taking the links object with it)
          }}
        >
          {def.render()}
        </section>
      ))}
    </div>
  );
}

function ProgressIndicator({ links }: { links: DirectorLinks }) {
  const index = useJourneyStore((s) => s.activeIndex);
  const meta = chapters[index];
  return (
    <div className={styles.progress}>
      <div
        className={styles.progressFill}
        ref={(el) => {
          links.progressBar = el;
        }}
      />
      <p className={styles.progressLabel} aria-live="polite">
        {meta ? `${meta.scene} · ${meta.title}` : ''}
      </p>
    </div>
  );
}

function FlightPlan({ onJump }: { onJump: (id: string) => void }) {
  const tier = useJourneyStore((s) => s.tier);
  const setTier = useJourneyStore((s) => s.setTier);
  const choose = (t: QualityTier) => {
    setTier(t);
    writeTierOverride(t);
  };
  return (
    <details className={styles.plan}>
      <summary>Flight plan</summary>
      <ol>
        {chapters
          .filter((c) => c.navLabel)
          .map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => onJump(c.id)}>
                <span className={styles.planScene}>{c.scene}</span> {c.navLabel}
              </button>
            </li>
          ))}
      </ol>
      <p className={styles.quality}>
        Quality:{' '}
        {(['balanced', 'low'] as const).map((t) => (
          <button key={t} type="button" aria-pressed={tier === t} onClick={() => choose(t)}>
            {t === 'balanced' ? 'High' : 'Low'}
          </button>
        ))}
      </p>
    </details>
  );
}

function NoWebGL() {
  return (
    <main className={styles.fallback}>
      <p className={styles.kicker}>Signal unavailable</p>
      <h1>The cinematic journey needs WebGL 2.</h1>
      <p>
        Everything is available in the <a href="/brief/">Mission Brief</a>, a fast, accessible
        version of this portfolio.
      </p>
      <ContactPanel id="fallback-contact" />
    </main>
  );
}

function JourneyCanvas() {
  const trackEl = useRef<HTMLDivElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const aspect = classifyAspect(viewport.w, viewport.h);
  const track = useMemo(() => buildTrack(chapters, aspect), [aspect]);
  const frame = useMemo(() => createJourneyFrame(), []);
  const styleRef = useRef<StyleBlendEffect>(null);
  const lensRef = useRef<LensEffect>(null);
  const links = useMemo<DirectorLinks>(
    () => ({ groups: new Map(), overlays: new Map(), dip: null, progressBar: null, track }),
    // links is created once; track updates are written in the effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const master = useScrollMaster(trackEl, { scrub: SCRUB_SECONDS });
  // wheel/trackpad: capped per event and followed at a capped speed (one flick no longer flies the whole story)
  const entered = useJourneyStore((s) => s.entered);
  const enter = useJourneyStore((s) => s.enter);
  const assetsReady = useJourneyStore((s) => s.assetsReady);
  const setAssetsReady = useJourneyStore((s) => s.setAssetsReady);

  // Download every journey asset before any chapter mounts (the start gate shows the progress).
  useEffect(() => {
    const { finished, unsubscribe } = preloadJourney();
    let live = true;
    const giveUp = window.setTimeout(setAssetsReady, PRELOAD_GIVE_UP_MS);
    void finished.then(() => live && setAssetsReady());
    return () => {
      live = false;
      window.clearTimeout(giveUp);
      unsubscribe();
    };
  }, [setAssetsReady]);
  usePacedWheel(!prefersReducedMotion() && entered);
  const tier = useJourneyStore((s) => s.tier);
  const webgl = useJourneyStore((s) => s.webgl);
  const activeIndex = useJourneyStore((s) => s.activeIndex);
  const setWebgl = useJourneyStore((s) => s.setWebgl);
  const setNavigate = useJourneyStore((s) => s.setNavigate);
  const [reducedNotice, setReducedNotice] = useState(prefersReducedMotion);
  useGsapDrivenFrames(webgl === 'ok');

  useEffect(() => {
    links.track = track;
    frame.aspect = aspect;
  }, [links, track, frame, aspect]);

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // (The start gate locks scroll only while assets load; from its title on, scrolling enters.)

  // Hand-off: after Begin, the camera eases into SC02's first rest point (title card) in 1.5 s.
  // Entering by scrolling or by a jump skips it: the visitor's own input stays in charge. Any
  // input during the hand-off also cancels it, so it never fights the wheel.
  const enteredBy = useJourneyStore((s) => s.enteredBy);
  const handoffDone = useRef(false);
  useEffect(() => {
    if (enteredBy !== 'begin' || handoffDone.current) return;
    handoffDone.current = true;
    if (prefersReducedMotion()) return;
    const meta = chapters.find((c) => c.id === 'sc02-room');
    if (!meta) return;
    const o = { p: master.state.progress };
    const tween = gsap.to(o, {
      p: progressFor(links.track, meta.id, meta.restPoints[0] ?? 0.5),
      duration: 1.5,
      ease: 'power2.inOut',
      onUpdate: () => master.scrollToProgress(o.p, false),
    });
    const cancel = () => void tween.kill();
    const opts = { once: true, passive: true } as const;
    window.addEventListener('wheel', cancel, opts);
    window.addEventListener('touchstart', cancel, opts);
    window.addEventListener('keydown', cancel, { once: true });
    return () => {
      tween.kill();
      window.removeEventListener('wheel', cancel);
      window.removeEventListener('touchstart', cancel);
      window.removeEventListener('keydown', cancel);
    };
  }, [enteredBy, master, links]);

  const jump = useCallback(
    (id: string) => {
      if (!useJourneyStore.getState().entered) enter('jump');
      const meta = chapters.find((c) => c.id === id);
      const target = progressFor(links.track, id, meta?.restPoints[0] ?? 0.05);
      const fade = fadeRef.current;
      if (prefersReducedMotion() || !fade) {
        master.jumpTo(target);
        return;
      }
      fade.style.opacity = '1';
      window.setTimeout(() => {
        master.jumpTo(target);
        window.setTimeout(() => (fade.style.opacity = '0'), 200);
      }, 180);
    },
    [links, master, enter],
  );

  useEffect(() => {
    setNavigate(jump);
    return () => setNavigate(null);
  }, [jump, setNavigate]);

  // Keyboard: ←/→ step between rest points (native scrolling keys keep working).
  useEffect(() => {
    const rests = chapters.flatMap((c) => c.restPoints.map((r) => progressFor(track, c.id, r)));
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, dialog[open]')) return;
      const p = master.state.progress;
      const next =
        e.key === 'ArrowRight'
          ? rests.find((r) => r > p + 0.002)
          : [...rests].reverse().find((r) => r < p - 0.002);
      if (next === undefined) return;
      e.preventDefault();
      master.scrollToProgress(next, !prefersReducedMotion());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [track, master]);

  const dpr = dprForBudget(viewport.w, viewport.h, window.devicePixelRatio, PIXEL_BUDGET_MP[tier]);
  const mounted = assetsReady
    ? chapters.filter((_, i) => Math.abs(i - activeIndex) <= WARM_WINDOW)
    : [];
  // Low tier has no post chain; it gets a minimal one only while art-style chapters are near.
  const lowStyle = tier !== 'balanced' && mounted.some((c) => c.act === 'beyond');
  const composer = tier === 'balanced' || lowStyle;

  return (
    <>
      {/* data-journey-canvas: the start gate's push-in and parallax (cleared before the journey) */}
      <div className={styles.canvas} aria-hidden="true" data-journey-canvas>
        <Canvas
          frameloop="never"
          dpr={dpr}
          shadows="percentage"
          camera={{ fov: 45, near: 0.05, far: 2000 }}
          // Balanced anti-aliases in post (SMAA); MSAA on the canvas would be wasted there.
          gl={{ antialias: false, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => {
            const el = gl.domElement;
            el.addEventListener('webglcontextlost', (e) => {
              e.preventDefault();
              setWebgl('lost');
            });
            el.addEventListener('webglcontextrestored', () => setWebgl('ok'));
          }}
        >
          <ToneMappingOwner composer={composer} />
          <StyleSync frame={frame} effect={styleRef} />
          <LensSync effect={lensRef} />
          <Director master={master.state} frame={frame} links={links} />
          {mounted.map((c) => (
            <ChapterSlot key={c.id} id={c.id} frame={frame} links={links} />
          ))}
          {tier === 'balanced' && (
            <EffectComposer multisampling={0}>
              <Lens ref={lensRef} />
              <Bloom
                mipmapBlur
                // HDR threshold: only genuinely bright pixels (screens, strips, light) bloom; a low
                // threshold spread a haze over the whole night frame (found in P3 review).
                intensity={0.45}
                luminanceThreshold={1}
                luminanceSmoothing={0.15}
                radius={0.6}
              />
              <SMAA />
              <ToneMapping mode={ToneMappingMode.AGX} />
              <StyleBlend ref={styleRef} />
            </EffectComposer>
          )}
          {lowStyle && (
            <EffectComposer multisampling={0}>
              <Lens ref={lensRef} />
              <ToneMapping mode={ToneMappingMode.AGX} />
              <StyleBlend ref={styleRef} />
            </EffectComposer>
          )}
        </Canvas>
      </div>
      <div
        className={styles.dip}
        aria-hidden="true"
        ref={(el) => {
          links.dip = el;
        }}
      />
      <OverlayLayer links={links} />
      <div ref={fadeRef} className={styles.jumpFade} aria-hidden="true" />
      <ProgressIndicator links={links} />
      {/* hidden behind the start gate (its dock owns that corner); the header stays reachable */}
      {entered && <FlightPlan onJump={jump} />}

      {reducedNotice && (
        <div className={styles.notice} role="status">
          <p>
            Reduced motion is on. The <a href="/brief/">Mission Brief</a> has everything without
            animation.
          </p>
          <button type="button" onClick={() => setReducedNotice(false)}>
            Continue with the journey
          </button>
        </div>
      )}
      {webgl === 'lost' && (
        <div className={styles.notice} role="alert">
          <p>
            Signal lost: the graphics context was reset.{' '}
            <a href="/brief/">Open the Mission Brief</a> or reload the page.
          </p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )}

      <ScrollTrack ref={trackEl} screens={track.totalScreens} />
    </>
  );
}

/** The cinematic journey, or the no-WebGL fallback. */
export function Journey() {
  const setTier = useJourneyStore((s) => s.setTier);
  const [recommendation] = useState(() => recommendTier(readDeviceSignals()));

  useEffect(() => {
    if (recommendation === 'brief') return;
    setTier(readTierOverride() ?? recommendation);
  }, [recommendation, setTier]);

  if (recommendation === 'brief') return <NoWebGL />;
  return <JourneyCanvas />;
}
