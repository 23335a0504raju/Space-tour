import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import gsap from 'gsap';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Bloom, EffectComposer, SMAA, ToneMapping, wrapEffect } from '@react-three/postprocessing';
import type { EffectComposer as EffectComposerImpl } from 'postprocessing';
import { StyleBlendEffect } from '../../shaders/styleBlend.ts';
import { LensEffect } from '../../shaders/lens.ts';
import { ToneMappingMode } from 'postprocessing';
import { chapters } from '../../chapters/registry.ts';
import { implementations } from '../../chapters/implementations.ts';
import { overlayDefs } from '../../chapters/overlays.tsx';
import { buildReveal } from '../../ui/cardReveal.ts';
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
import { sectionIndexFor, sections } from '../../chapters/sections.ts';
import { ScrollTrack } from '../scroll/ScrollTrack.tsx';
import { usePacedWheel } from '../scroll/usePacedWheel.ts';
import { useScrollMaster } from '../scroll/useScrollMaster.ts';
import { preloadJourney } from '../assets/preload.ts';
import { compileChapter } from '../assets/warm.ts';
import { useJourneyStore } from '../store.ts';
import styles from './Journey.module.css';

/**
 * No second smoothing layer: the wheel follower (pacing.ts) is the one ease, and the story follows
 * the page directly, as on the reference site (Lenis + direct scrub). The old 0.35 s scrub on top of
 * the wheel ease made motion lag and float (scroll fix, 2026-11-22).
 */
const SCRUB = true;
/** Chapters kept mounted around the active one (lifecycle "warm" window). */
const WARM_WINDOW = 1;
/** Slow networks: stop waiting for the full download after this and stream the rest. */
const PRELOAD_GIVE_UP_MS = 45_000;

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Readable band around a rest point, in local t (was 0.12 with a 0.05 ramp: text was fully readable
 * for only ±7 % of a chapter). Chapters with rest points closer than 2 × band set their own.
 */
const DEFAULT_BAND = 0.16;

/** Longest a jump keeps its fade up while the target chapter mounts. */
const JUMP_WAIT_MAX_MS = 2500;

/**
 * Resolves once chapter `id` is mounted and has drawn meshes for a few frames (or after
 * JUMP_WAIT_MAX_MS). Runs on the GSAP ticker, the one clock; touches no story state.
 */
function waitForChapter(links: DirectorLinks, id: string): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    let drawn = 0;
    const tick = () => {
      const group = links.groups.get(id);
      let meshes = 0;
      group?.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) meshes += 1;
      });
      if (meshes > 0) drawn += 1;
      if (drawn >= 3 || performance.now() - start > JUMP_WAIT_MAX_MS) {
        gsap.ticker.remove(tick);
        resolve();
      }
    };
    gsap.ticker.add(tick);
  });
}

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

/**
 * Before the first frame is drawn, compile the whole scene as it will be drawn (off the main
 * thread), then report ready. Drawing it straight away linked every shader of the first scene
 * synchronously: a 1.2 s freeze of the start gate when its title appeared.
 */
function FirstFrame({
  when,
  links,
  drawTarget,
  onReady,
}: {
  when: boolean;
  links: DirectorLinks;
  drawTarget: () => THREE.WebGLRenderTarget | null;
  onReady: () => void;
}) {
  const { gl, camera, scene } = useThree();
  useEffect(() => {
    if (!when) return;
    let live = true;
    const done = () => live && onReady();
    // a slow driver must not keep the scene hidden: draw anyway after a while
    const giveUp = window.setTimeout(done, 4000);
    // as the Director will show it: only the active chapter visible
    const active = chapters[useJourneyStore.getState().activeIndex]?.id;
    const saved = new Map<THREE.Group, boolean>();
    for (const [id, g] of links.groups) {
      saved.set(g, g.visible);
      g.visible = id === active;
    }
    const previous = gl.getRenderTarget();
    gl.setRenderTarget(drawTarget());
    const pending = gl.compileAsync(scene, camera);
    gl.setRenderTarget(previous);
    for (const [g, v] of saved) g.visible = v;
    void pending.catch(() => undefined).then(done);
    return () => {
      live = false;
      window.clearTimeout(giveUp);
    };
  }, [when, gl, camera, scene, links, drawTarget, onReady]);
  return null;
}

/** Runs `onCommit` once its Suspense boundary has committed (the scene's content exists). */
function Committed({ onCommit }: { onCommit: () => void }) {
  useEffect(() => onCommit(), [onCommit]);
  return null;
}

/**
 * Mounts one chapter's scene and registers its group with the Director. Once the scene's content
 * is in (after its Suspense boundary resolves), its shaders compile off the main thread and its
 * textures upload, while it is still hidden in the warm window. (Compiling on mount, as before, compiled an empty
 * group: the shaders then linked synchronously on the chapter's first frame.)
 */
function ChapterSlot({
  id,
  frame,
  links,
  drawTarget,
}: {
  id: string;
  frame: JourneyFrame;
  links: DirectorLinks;
  /** Where the scene is really drawn (the post chain's input buffer), so shaders compile for it. */
  drawTarget: () => THREE.WebGLRenderTarget | null;
}) {
  const ref = useRef<THREE.Group>(null);
  const { gl, camera, scene } = useThree();
  const impl = implementations[id];

  useEffect(() => {
    const group = ref.current;
    if (!group) return;
    links.groups.set(id, group);
    group.visible = frame.id === id;
    return () => {
      links.groups.delete(id);
    };
  }, [id, links, frame]);

  const compile = useCallback(() => {
    const group = ref.current;
    if (!group) return;
    let live = true;
    // a frame later: the scene's own effects (materials made in effects) have run
    requestAnimationFrame(() => {
      if (!live) return;
      void compileChapter(gl, camera, scene, group, links.groups, drawTarget());
    });
    return () => {
      live = false;
    };
  }, [gl, camera, scene, links, drawTarget]);

  if (!impl) return null;
  const { Scene } = impl;
  return (
    <group ref={ref}>
      {/* Per-chapter boundary: a chapter streaming in assets never blanks the others. */}
      <Suspense fallback={null}>
        <Scene id={id} frame={frame} />
        <Committed onCommit={compile} />
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
          className={`${overlayStyles.panel} ${overlayStyles[def.placement]} ${def.variant ? overlayStyles[def.variant] : ''}`}
          ref={(el) => {
            if (el) {
              // React re-runs this inline ref on every re-render (e.g. when the active chapter
              // changes). Re-creating the entry reset `last`/`visible` while the DOM still showed
              // the panel, so the Director never hid it again: SC04's Education panel stayed on
              // screen in SC05 after a jump (found in P4). Keep the entry for the same element.
              if (links.overlays.get(def.key)?.el === el) return;
              el.inert = true;
              el.setAttribute('aria-hidden', 'true');
              el.style.setProperty('--o', '0');
              el.style.visibility = 'hidden';
              links.overlays.set(def.key, {
                el,
                chapterId: def.chapterId,
                rest: def.rest,
                half: def.band ?? DEFAULT_BAND,
                holdToEnd: def.holdToEnd ?? false,
                reveal: buildReveal(el, {
                  editorial: def.variant === 'editorial',
                  reduced: prefersReducedMotion(),
                }),
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

const num = (i: number) => String(i + 1).padStart(2, '0');

/**
 * Story progress under the header (navbar brief, 2026-11-21): chapter number and title, the
 * overall percentage, and a hairline gold fill. The fill and the percentage are written by the
 * Director from the one master progress (no React state, no extra scroll listener); the label
 * changes once per section, so it never flickers.
 */
function StoryLine({ links }: { links: DirectorLinks }) {
  const current = useJourneyStore((s) => sectionIndexFor(s.activeIndex));
  const section = sections[current];
  return (
    <div className={styles.story}>
      <p className={styles.storyLabel} aria-live="polite">
        <span className={styles.storyNum}>{num(current)}</span>
        <span className={styles.storySep} aria-hidden="true">
          /
        </span>
        {section?.label}
      </p>
      <span
        className={styles.storyPct}
        aria-hidden="true"
        ref={(el) => {
          links.progressText = el;
        }}
      >
        0%
      </span>
      <div className={styles.storyTrack} aria-hidden="true">
        <div
          className={styles.storyFill}
          ref={(el) => {
            links.progressBar = el;
          }}
        />
      </div>
    </div>
  );
}

/**
 * Bottom bar: Flight Plan menu, the progress track with one tick per visitor section, the current
 * section, and previous/next. The fill is written by the Director every frame (no React state);
 * the label changes once per chapter.
 */
function BottomBar({
  entered,
  onJump,
  onStep,
}: {
  entered: boolean;
  onJump: (id: string) => void;
  onStep: (dir: 1 | -1) => void;
}) {
  const current = useJourneyStore((s) => sectionIndexFor(s.activeIndex));
  return (
    <div className={styles.bottom}>
      {/* hidden behind the start gate (its dock owns that corner); the header stays reachable */}
      {entered && <FlightPlan current={current} onJump={onJump} />}
      <span className={styles.spacer} />
      {entered && (
        <span className={styles.stepper}>
          <button type="button" aria-label="Previous stop" onClick={() => onStep(-1)}>
            ←
          </button>
          <button type="button" aria-label="Next stop" onClick={() => onStep(1)}>
            →
          </button>
        </span>
      )}
    </div>
  );
}

function FlightPlan({ current, onJump }: { current: number; onJump: (id: string) => void }) {
  const tier = useJourneyStore((s) => s.tier);
  const setTier = useJourneyStore((s) => s.setTier);
  const choose = (t: QualityTier) => {
    setTier(t);
    writeTierOverride(t);
  };
  return (
    <details className={styles.plan}>
      <summary>Flight plan</summary>
      <div className={styles.planBody}>
        <ol>
          {sections.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                aria-current={i === current ? 'location' : undefined}
                onClick={() => onJump(s.target)}
              >
                <span className={styles.planScene}>{num(i)}</span> {s.label}
              </button>
            </li>
          ))}
        </ol>
        <p className={styles.quality}>
          Graphics{' '}
          {(['balanced', 'low'] as const).map((t) => (
            <button key={t} type="button" aria-pressed={tier === t} onClick={() => choose(t)}>
              {t === 'balanced' ? 'High' : 'Low'}
            </button>
          ))}
        </p>
      </div>
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
    () => ({
      groups: new Map(),
      overlays: new Map(),
      progressBar: null,
      progressText: null,
      track,
    }),
    // links is created once; track updates are written in the effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const master = useScrollMaster(trackEl, { scrub: SCRUB });
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

  const composerRef = useRef<EffectComposerImpl>(null);
  const drawTarget = useCallback(() => composerRef.current?.inputBuffer ?? null, []);
  const tier = useJourneyStore((s) => s.tier);
  const webgl = useJourneyStore((s) => s.webgl);
  const activeIndex = useJourneyStore((s) => s.activeIndex);
  const setWebgl = useJourneyStore((s) => s.setWebgl);
  const setNavigate = useJourneyStore((s) => s.setNavigate);
  const [reducedNotice, setReducedNotice] = useState(prefersReducedMotion);
  const sceneShown = useJourneyStore((s) => s.sceneShown);
  // no drawing behind the start gate's opaque cover (see store.sceneShown), and none before the
  // first scene's shaders have compiled (FirstFrame)
  const [firstFrameReady, setFirstFrameReady] = useState(false);
  const onFirstFrameReady = useCallback(() => setFirstFrameReady(true), []);
  useGsapDrivenFrames(webgl === 'ok' && firstFrameReady);

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
        // lift the fade only once the target chapter has drawn (a cold chapter used to show
        // black for over 1.5 s after the fade: UI_SCROLL_AUDIT.md J1)
        void waitForChapter(links, id).then(() => (fade.style.opacity = '0'));
      }, 180);
    },
    [links, master, enter],
  );

  // ←/→ keys and the bottom bar's buttons step between rest points (native scroll keys still work)
  const step = useCallback(
    (dir: 1 | -1) => {
      const rests = chapters.flatMap((c) => c.restPoints.map((r) => progressFor(track, c.id, r)));
      const p = master.state.progress;
      const next =
        dir > 0
          ? rests.find((r) => r > p + 0.002)
          : [...rests].reverse().find((r) => r < p - 0.002);
      if (next !== undefined) master.scrollToProgress(next, !prefersReducedMotion());
      return next !== undefined;
    },
    [track, master],
  );

  // the quality tier as a document attribute, for tier-gated CSS (panel blur on High only)
  useEffect(() => {
    document.documentElement.dataset.tier = tier;
  }, [tier]);

  useEffect(() => {
    setNavigate(jump);
    return () => setNavigate(null);
  }, [jump, setNavigate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, dialog[open]')) return;
      if (step(e.key === 'ArrowRight' ? 1 : -1)) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step]);

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
          <FirstFrame
            when={(sceneShown || entered) && assetsReady}
            links={links}
            drawTarget={drawTarget}
            onReady={onFirstFrameReady}
          />
          {mounted.map((c) => (
            <ChapterSlot key={c.id} id={c.id} frame={frame} links={links} drawTarget={drawTarget} />
          ))}
          {tier === 'balanced' && (
            <EffectComposer ref={composerRef} multisampling={0}>
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
            <EffectComposer ref={composerRef} multisampling={0}>
              <Lens ref={lensRef} />
              <ToneMapping mode={ToneMappingMode.AGX} />
              <StyleBlend ref={styleRef} />
            </EffectComposer>
          )}
        </Canvas>
      </div>
      <OverlayLayer links={links} />
      <div ref={fadeRef} className={styles.jumpFade} aria-hidden="true" />
      <StoryLine links={links} />
      <BottomBar entered={entered} onJump={jump} onStep={step} />

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
