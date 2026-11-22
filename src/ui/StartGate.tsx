import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useProgress } from '@react-three/drei';
import { addAfterEffect } from '@react-three/fiber';
import gsap from 'gsap';
import { content } from '../content/index.ts';
import type { Fact } from '../content/fact.ts';
import { preloadJourney } from '../engine/assets/preload.ts';
import { useJourneyStore } from '../engine/store.ts';
import { PACING, wheelStep } from '../engine/scroll/pacing.ts';
import { shouldShow } from './FactText.tsx';
import { createRingState, ShardRing } from './shardRing.ts';
import styles from './StartGate.module.css';

const { identity } = content;

/** Loader quiet for this long (ms) means the first scene's assets are in. */
const QUIET_MS = 1200;
/** Pause after loading, so shaders finish compiling behind the cover. */
const REVEAL_DELAY_MS = 450;
/** Fastest the ring may assemble (fraction per second): a cached visit still sees it gather. */
const ASSEMBLE_RATE = 0.62;
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+<>/';
/** Scroll distance (screens) that burns the opening all the way through. */
const OPEN_SCREENS = 1.25;
/** Opening at which the journey starts (the hole has cleared the screen). */
const OPEN_DONE = 0.985;

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvasEl = () => document.querySelector<HTMLElement>('[data-journey-canvas]');
const factText = (f: Fact<unknown>) => (shouldShow(f) ? String(f.value) : '');

/**
 * Grow a short label into its full form, the way "The ai Edition" grows into "Renaissance":
 * the missing text is typed in on both sides of the short word, through a short glyph scramble.
 */
function grow(el: HTMLElement, short: string, full: string, duration: number): gsap.core.Tween {
  const at = full.indexOf(short);
  const pre = at >= 0 ? full.slice(0, at) : '';
  const post = at >= 0 ? full.slice(at + short.length) : full.slice(short.length);
  const core = at >= 0 ? short : full.slice(0, short.length);
  const o = { p: 0 };
  const junk = (n: number) => {
    let s = '';
    for (let i = 0; i < n; i += 1) s += GLYPHS[Math.floor(Math.random() * GLYPHS.length)] ?? '';
    return s;
  };
  return gsap.to(o, {
    p: 1,
    duration,
    ease: 'power2.inOut',
    onUpdate: () => {
      const nPre = Math.round(o.p * pre.length);
      const nPost = Math.round(o.p * post.length);
      const edge = o.p < 1 ? 2 : 0;
      const left = pre.slice(pre.length - nPre);
      const right = post.slice(0, nPost);
      el.textContent =
        (nPre > 0 && edge ? junk(Math.min(edge, nPre)) + left.slice(edge) : left) +
        core +
        (nPost > 0 && edge ? right.slice(0, -edge) + junk(Math.min(edge, nPost)) : right);
    },
    onComplete: () => void (el.textContent = full),
  });
}

/**
 * Guide lines of the opening (after the reference's architectural construction lines): a golden
 * rectangle and its spiral arcs around the title, two long diagonals, two large circles and
 * registration marks. Each draws in over its own window of the load fraction ([from, to]).
 */
const GUIDES: readonly { d: string; from: number; to: number }[] = [
  { d: 'M60 0 L1600 960', from: 0, to: 0.35 },
  { d: 'M1540 0 L0 960', from: 0.05, to: 0.4 },
  { d: 'M640 0 V300', from: 0.08, to: 0.25 },
  { d: 'M760 0 V300', from: 0.12, to: 0.3 },
  { d: 'M476 300 H1124 V700 H476 Z', from: 0.15, to: 0.5 },
  { d: 'M876 300 V700', from: 0.3, to: 0.45 },
  { d: 'M876 548 H1124', from: 0.38, to: 0.5 },
  { d: 'M972 548 V700', from: 0.45, to: 0.55 },
  { d: 'M476 700 A400 400 0 0 1 876 300', from: 0.4, to: 0.62 },
  { d: 'M876 300 A248 248 0 0 1 1124 548', from: 0.5, to: 0.68 },
  { d: 'M1124 548 A152 152 0 0 1 972 700', from: 0.58, to: 0.74 },
  { d: 'M540 250 A520 520 0 1 1 1580 250', from: 0.25, to: 0.75 },
  { d: 'M-140 960 A560 560 0 0 1 980 960', from: 0.35, to: 0.8 },
  { d: 'M1124 860 H1600', from: 0.6, to: 0.75 },
  { d: 'M540 230 h40 v40 h-40 Z M520 250 h80 M560 210 v80', from: 0.55, to: 0.7 },
  { d: 'M1180 760 h40 v40 h-40 Z M1160 780 h80 M1200 740 v80', from: 0.65, to: 0.82 },
];

/**
 * Opening sequence (task 8, after Shopify Editions Winter '26). UI state before the journey
 * starts; story state stays a pure function of scroll progress.
 *  1. Loading: guide lines draw in and a ring of shards and sparkles assembles around the name,
 *     both driven by the real download fraction.
 *  2. Title: the role grows to its full form, the tagline and the Begin / Explore projects
 *     actions appear. The cover stays solid.
 *  3. Opening (scroll, reversible; or Begin): the cover burns away. A spark at the centre eats an
 *     organic hole outward, two smaller spots join it, and the burn front shows the first scene
 *     arriving in fragments under a bright fibrous edge (shardRing.ts). The camera pushes through.
 * The header sits above the gate, so every header action works from the first frame.
 */
export function StartGate() {
  const entered = useJourneyStore((s) => s.entered);
  const enter = useJourneyStore((s) => s.enter);
  const enteredBy = useJourneyStore((s) => s.enteredBy);
  const assetsReady = useJourneyStore((s) => s.assetsReady);
  // scene loaders (from the in-memory copies): used only to know the first scene is built
  const { progress, active } = useProgress();
  const [skipped] = useState(entered); // ?gate=off: no gate, no hint (tests, captures)
  const [pct, setPct] = useState(0);
  const [ready, setReady] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [gone, setGone] = useState(false);

  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const guides = useRef<SVGSVGElement>(null);
  const title = useRef<HTMLDivElement>(null);
  const role = useRef<HTMLSpanElement>(null);
  const tagline = useRef<HTMLParagraphElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const ring = useRef(createRingState());
  /** Where the visitor's scroll has taken the opening (0..1); `ring.open` eases toward it. */
  const openTarget = useRef(0);
  const phase = useRef<'loading' | 'title' | 'leaving'>('loading');
  const chrome = useRef<HTMLDivElement>(null);
  /** real download fraction (0..1), read by the ticker */
  const fraction = useRef(0);
  const readyRef = useRef(false);

  const [first = '', ...rest] = factText(identity.name).split(' ');
  const last = rest.join(' ');
  const shortRole = factText(identity.shortRole);
  const fullRole = factText(identity.role) || shortRole;
  const taglineText = factText(identity.tagline);

  // Real download progress of every journey file (bytes).
  useEffect(() => {
    const { unsubscribe } = preloadJourney((p) => {
      fraction.current = Math.max(fraction.current, p.fraction);
      setPct((prev) => Math.max(prev, Math.min(99, Math.floor(p.fraction * 100))));
    });
    return unsubscribe;
  }, []);

  // then wait for the first scene to finish building from those copies
  useEffect(() => {
    if (!assetsReady || (active && progress < 100)) return;
    const id = window.setTimeout(() => setReady(true), progress >= 100 ? 0 : QUIET_MS);
    return () => window.clearTimeout(id);
  }, [assetsReady, progress, active]);

  // reveal once the ring has had time to close (it assembles at a capped rate)
  useEffect(() => {
    readyRef.current = ready;
    if (!ready) return;
    const left = prefersReducedMotion() ? 0 : (1 - ring.current.assemble) / ASSEMBLE_RATE;
    const id = window.setTimeout(() => setRevealed(true), Math.max(REVEAL_DELAY_MS, left * 1000));
    return () => window.clearTimeout(id);
  }, [ready]);

  const stage = gone ? 'gone' : entered ? 'leaving' : revealed ? 'title' : 'loading';

  // Once loaded, the 3D scene starts drawing behind the solid cover. Its first frame links the
  // first scene's shaders (a one-off stall, as on the reference site at its reveal); it happens
  // here, before the title animates in, so the title and the opening stay smooth.
  useEffect(() => {
    if (ready) useJourneyStore.getState().showScene();
  }, [ready]);

  // The page does not scroll before the journey starts: during the title the scroll burns the
  // opening instead. Header jumps still work: they enter and unlock.
  useEffect(() => {
    if (skipped || (stage !== 'loading' && stage !== 'title')) return;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = '';
    };
  }, [skipped, stage]);

  // From the title on, scrolling burns the opening (after the reference site): a spark at the
  // centre eats a hole outward as the visitor scrolls, and scrolling back closes it again. The
  // journey starts once the hole has cleared the screen. Begin plays the same opening by itself.
  useEffect(() => {
    if (skipped || stage !== 'title') return;
    phase.current = 'title';
    const reduced = prefersReducedMotion();
    const modal = () => document.querySelector('dialog[open]') !== null;
    const push = (px: number) => {
      if (modal()) return;
      if (reduced) {
        if (px > 0) enter('scroll');
        return;
      }
      const dist = window.innerHeight * OPEN_SCREENS;
      openTarget.current = Math.min(1, Math.max(0, openTarget.current + px / dist));
    };
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || modal()) return;
      e.preventDefault();
      push(wheelStep(e.deltaY, e.deltaMode, window.innerHeight));
    };
    let lastY: number | null = null;
    const onTouchStart = (e: TouchEvent) => {
      lastY = e.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY;
      if (lastY === null || y === undefined || modal()) return;
      e.preventDefault();
      push((lastY - y) * 1.5);
      lastY = y;
    };
    const FORWARD = new Set(['ArrowDown', 'PageDown', ' ', 'ArrowRight']);
    const BACK = new Set(['ArrowUp', 'PageUp', 'ArrowLeft']);
    const onKey = (e: KeyboardEvent) => {
      // Space on the focused Begin button is a Begin press, not a scroll
      if (e.key === ' ' && (e.target as HTMLElement | null)?.closest('button, a')) return;
      const step = window.innerHeight * OPEN_SCREENS * 0.34;
      if (FORWARD.has(e.key)) push(step);
      else if (BACK.has(e.key)) push(-step);
      else if (e.key === 'End') push(window.innerHeight * OPEN_SCREENS);
      else return;
      e.preventDefault();
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKey);
    };
  }, [skipped, stage, enter]);

  // The ring: one 2D canvas drawn on the GSAP ticker (the one clock) until the gate is gone.
  useEffect(() => {
    const el = canvas.current;
    if (skipped || !el) return;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const small = Math.min(window.innerWidth, window.innerHeight) < 600;
    const renderer = new ShardRing(el, {
      shards: coarse || small ? 900 : 2600,
      sparks: coarse || small ? 220 : 480,
      fragments: coarse || small ? 380 : 1500,
      cover: '#05060a',
    });
    const paths = guides.current ? [...guides.current.querySelectorAll('path')] : [];
    const reduced = prefersReducedMotion();
    const state = ring.current;
    let shown = -1;
    let lastOpen = -1;
    let started = false;
    const cam = canvasEl();
    renderer.resize();
    const onResize = () => renderer.resize();
    window.addEventListener('resize', onResize);
    const tick = (time: number, dt: number) => {
      // the displayed assembly follows the real fraction, eased and rate-capped
      const target = readyRef.current ? 1 : fraction.current * 0.97;
      if (reduced) state.assemble = target;
      else if (state.assemble < target) {
        const step = Math.min(
          target - state.assemble,
          Math.max((target - state.assemble) * (1 - Math.exp(-2.4 * (dt / 1000))), 0.002),
          ASSEMBLE_RATE * (dt / 1000),
        );
        state.assemble += step;
      }
      if (Math.abs(state.assemble - shown) > 0.0005) {
        shown = state.assemble;
        for (let i = 0; i < paths.length; i += 1) {
          const g = GUIDES[i];
          if (!g) continue;
          const k = Math.min(1, Math.max(0, (shown - g.from) / (g.to - g.from)));
          paths[i]!.style.strokeDashoffset = String(1 - k);
        }
        if (title.current && !readyRef.current) {
          title.current.style.opacity = String(0.2 + 0.8 * Math.min(1, shown * 1.4));
        }
      }
      if (phase.current === 'title' && !reduced) {
        // same ease as the page scroll (pacing.ts): one smoothing layer, frame-rate independent
        const k = 1 - Math.pow(1 - PACING.ease, gsap.ticker.deltaRatio());
        const gap = openTarget.current - state.open;
        state.open = Math.abs(gap) < 0.0004 ? openTarget.current : state.open + gap * k;
        if (!started && openTarget.current >= 1 && state.open > OPEN_DONE) {
          started = true;
          useJourneyStore.getState().enter('scroll');
        }
      }
      if (phase.current !== 'loading' && state.open !== lastOpen) {
        lastOpen = state.open;
        // the title, guides and actions burn away with the first stretch of the opening
        const ease = (v: number) => v * v * (3 - 2 * v);
        const keep = 1 - ease(Math.min(1, Math.max(0, (state.open - 0.38) / 0.32)));
        if (chrome.current) {
          chrome.current.style.opacity = String(keep);
          chrome.current.style.visibility = keep < 0.01 ? 'hidden' : '';
        }
        if (dock.current && phase.current === 'title') {
          dock.current.style.opacity = String(1 - ease(Math.min(1, state.open / 0.08)));
        }
        // and the camera pushes through the hole
        if (cam) gsap.set(cam, { scale: 1.06 - 0.06 * state.open });
      }
      renderer.draw(state, reduced ? 0 : time);
    };
    gsap.ticker.add(tick);
    const copy = document.createElement('canvas');
    const copyCtx = copy.getContext('2d');
    const source = () => document.querySelector<HTMLCanvasElement>('[data-journey-canvas] canvas');
    const stopCopy = addAfterEffect(() => {
      const open = state.open;
      if (!copyCtx || open <= 0 || open >= 1) return;
      const src = source();
      if (!src) return;
      const cw = Math.max(1, Math.round(window.innerWidth / 3));
      const ch = Math.max(1, Math.round(window.innerHeight / 3));
      if (copy.width !== cw || copy.height !== ch) {
        copy.width = cw;
        copy.height = ch;
      }
      copyCtx.drawImage(src, 0, 0, cw, ch);
      renderer.scene = copy;
    });
    return () => {
      gsap.ticker.remove(tick);
      stopCopy();
      window.removeEventListener('resize', onResize);
    };
  }, [skipped]);

  // Beat 2: the portal opens on the live first shot, the role grows, the actions arrive.
  useLayoutEffect(() => {
    if (stage !== 'title' || skipped) return;
    const cam = canvasEl();
    if (prefersReducedMotion()) {
      gsap.set([title.current, tagline.current, dock.current], { opacity: 1, y: 0 });
      if (role.current) role.current.textContent = fullRole;
      button.current?.focus({ preventScroll: true });
      return;
    }
    const rise = { opacity: 1, y: 0, ease: 'power3.out' };
    const tl = gsap.timeline();
    tl.to(title.current, { opacity: 1, duration: 0.4 }, 0)
      .fromTo(tagline.current, { opacity: 0, y: 10 }, { ...rise, duration: 0.7 }, 1.3)
      .fromTo(dock.current, { opacity: 0, y: 10 }, { ...rise, duration: 0.6 }, 1.6)
      .call(() => button.current?.focus({ preventScroll: true }), undefined, 1.7);
    if (role.current && fullRole !== shortRole) {
      tl.add(grow(role.current, shortRole, fullRole, 1.1), 0.35);
    }

    // pointer parallax on the live shot (fine pointers only)
    let onMove: ((e: PointerEvent) => void) | null = null;
    if (cam && window.matchMedia('(pointer: fine)').matches) {
      const qx = gsap.quickTo(cam, 'x', { duration: 1.4, ease: 'power3.out' });
      const qy = gsap.quickTo(cam, 'y', { duration: 1.4, ease: 'power3.out' });
      onMove = (e) => {
        qx((e.clientX / window.innerWidth - 0.5) * -22);
        qy((e.clientY / window.innerHeight - 0.5) * -14);
      };
      window.addEventListener('pointermove', onMove, { passive: true });
    }
    return () => {
      tl.kill();
      if (onMove) window.removeEventListener('pointermove', onMove);
    };
  }, [stage, skipped, fullRole, shortRole]);

  // Beat 3: the opening finishes. After a scroll entry the hole has already cleared the screen;
  // Begin and header jumps play the whole burn by themselves.
  useLayoutEffect(() => {
    if (stage !== 'leaving' || skipped) return;
    phase.current = 'leaving';
    const cam = canvasEl();
    const state = ring.current;
    const finish = () => {
      if (cam) gsap.set(cam, { clearProps: 'transform' });
      setGone(true);
    };
    if (prefersReducedMotion()) {
      finish();
      return;
    }
    gsap.killTweensOf(state);
    state.assemble = 1;
    const left = 1 - state.open;
    const byScroll = enteredBy === 'scroll';
    const tween = gsap.to(state, {
      open: 1,
      duration: byScroll ? 0.25 : 0.3 + 2.1 * left,
      ease: byScroll ? 'power1.out' : 'power1.inOut',
      onComplete: finish,
    });
    return () => void tween.kill();
  }, [stage, skipped, enteredBy]);

  // never leave the canvas transformed, whatever path unmounts the gate
  useEffect(
    () => () => {
      const cam = canvasEl();
      if (cam) {
        gsap.killTweensOf(cam);
        gsap.set(cam, { clearProps: 'transform' });
      }
    },
    [],
  );

  if (skipped) return null;
  // a visitor who entered by scrolling already knows how to move on
  if (stage === 'gone') return enteredBy === 'scroll' ? null : <ScrollHint />;
  const shown = ready ? 100 : pct;
  return (
    <section ref={root} className={styles.gate} aria-label="Start" inert={entered}>
      <canvas ref={canvas} className={styles.ring} aria-hidden="true" />
      <div ref={chrome} className={styles.chrome}>
        <svg
          ref={guides}
          className={styles.guides}
          viewBox="0 0 1600 1000"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          {GUIDES.map((g) => (
            <path key={g.d} d={g.d} pathLength={1} />
          ))}
        </svg>
        <progress
          className="visually-hidden"
          max={100}
          value={shown}
          aria-label="Loading the journey"
        />

        {/* aria-hidden: the header's h1 and the first chapter's introduction carry the same facts */}
        <div ref={title} className={styles.title} aria-hidden="true">
          <p className={styles.name}>
            <span className={styles.first}>{first}</span>
            {last && <span className={styles.script}>{last}</span>}
            <span ref={role} className={styles.role}>
              {shortRole}
            </span>
          </p>
          {taglineText && (
            <p ref={tagline} className={styles.tagline}>
              {taglineText}
            </p>
          )}
        </div>

        <div ref={dock} className={styles.dock}>
          <p className={styles.status} aria-hidden="true">
            <span className={styles.dot} /> Scroll to begin <span className={styles.arrow}>↓</span>
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondary}
              disabled={stage !== 'title'}
              onClick={() => useJourneyStore.getState().navigate?.('sc08-jupiter')}
            >
              Explore projects
            </button>
            <button
              ref={button}
              type="button"
              className={styles.begin}
              disabled={stage !== 'title'}
              onClick={() => enter('begin')}
            >
              Begin mission <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Wheel, swipe and keys hint: appears after the hand-off, gone on the first input. */
function ScrollHint() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const hide = () => setHidden(true);
    const opts = { once: true, passive: true } as const;
    window.addEventListener('wheel', hide, opts);
    window.addEventListener('touchmove', hide, opts);
    window.addEventListener('keydown', hide, { once: true });
    return () => {
      window.removeEventListener('wheel', hide);
      window.removeEventListener('touchmove', hide);
      window.removeEventListener('keydown', hide);
    };
  }, []);
  return (
    <p className={`${styles.hint} ${hidden ? styles.hintGone : ''}`} aria-hidden="true">
      Scroll · swipe · ← →
    </p>
  );
}
