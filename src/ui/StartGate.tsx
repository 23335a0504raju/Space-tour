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
import { createRingHost } from './ringHost.ts';
import type { RingHost } from './ringHost.ts';
import { chromeKeep } from './shardRing.ts';
import styles from './StartGate.module.css';

const { identity } = content;

/** Loader quiet for this long (ms) means the first scene's assets are in. */
const QUIET_MS = 600;
/** The title shows this long after the ring has closed on a drawn scene. */
const REVEAL_DELAY_MS = 250;
/** A first frame that never settles (a very slow driver) must not keep the title away. */
const DRAWN_GIVE_UP_MS = 8000;
/** Frames this short (ms) mean the first scene draws smoothly: its one-off work is done. */
const SMOOTH_FRAME_MS = 60;
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
 * Opening sequence (task 8, after Shopify Editions Winter '26). UI state before the journey
 * starts; story state stays a pure function of scroll progress.
 *  1. Loading: guide lines draw in and a ring of shards and sparkles assembles around the name.
 *     It runs in a worker (ringLoop.ts), so it stays smooth while the page builds the first scene,
 *     and follows the whole load: the first scenes' files, then the scene built and first drawn.
 *     The rest of the journey keeps downloading in the background.
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
  /** the first scene has drawn smooth frames behind the cover (its one-off stalls are over) */
  const [drawn, setDrawn] = useState(false);
  /** the ring has closed */
  const [assembled, setAssembled] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [gone, setGone] = useState(false);

  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const host = useRef<RingHost | null>(null);
  const title = useRef<HTMLDivElement>(null);
  const role = useRef<HTMLSpanElement>(null);
  const tagline = useRef<HTMLParagraphElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  /** The opening as shown (0..1), eased toward `openTarget` and sent to the ring. */
  const opening = useRef({ open: 0 });
  /** Where the visitor's scroll has taken the opening (0..1). */
  const openTarget = useRef(0);
  const phase = useRef<'loading' | 'title' | 'leaving'>('loading');
  const chrome = useRef<HTMLDivElement>(null);
  /** download fraction of the first scenes' files (0..1) */
  const fraction = useRef(0);

  const [first = '', ...rest] = factText(identity.name).split(' ');
  const last = rest.join(' ');
  const shortRole = factText(identity.shortRole);
  const fullRole = factText(identity.role) || shortRole;
  const taglineText = factText(identity.tagline);

  // The ring follows the whole load in three stages: the first scenes' files (bytes, to 78 %),
  // the scene built from them (to 96 %, creeping while it builds), its first frames drawn (100 %).
  // Within a stage the ring keeps creeping ahead a little, so it never sits still.
  useEffect(() => {
    const ring = host.current;
    if (!ring) return;
    if (drawn) ring.setLoad(1);
    else if (ready) ring.setLoad(0.82, 0.96);
    else ring.setLoad(0.78 * fraction.current, Math.min(0.8, 0.78 * fraction.current + 0.08));
  }, [ready, drawn, pct]);

  // Real download progress of the first scenes' files (bytes); the rest continue in the background.
  useEffect(() => {
    const { unsubscribe } = preloadJourney((p) => {
      fraction.current = Math.max(fraction.current, p.critical);
      setPct((prev) => Math.max(prev, Math.min(99, Math.floor(p.critical * 100))));
    });
    return unsubscribe;
  }, []);

  // then wait for the first scene to finish building from those copies
  useEffect(() => {
    if (!assetsReady || (active && progress < 100)) return;
    const id = window.setTimeout(() => setReady(true), progress >= 100 ? 0 : QUIET_MS);
    return () => window.clearTimeout(id);
  }, [assetsReady, progress, active]);

  // Then let the scene draw behind the cover until its frames are smooth. Its first frames do
  // one-off work (shader links, texture uploads) that froze the title as it animated in; now it
  // happens while the loader, in its worker, keeps moving.
  useEffect(() => {
    if (!ready || drawn) return;
    let frames = 0;
    let last = 0;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setDrawn(true);
    };
    const stop = addAfterEffect((now) => {
      const gap = last ? now - last : Infinity;
      last = now;
      frames += 1;
      if (frames >= 3 && gap < SMOOTH_FRAME_MS) finish();
    });
    const giveUp = window.setTimeout(finish, DRAWN_GIVE_UP_MS);
    return () => {
      stop();
      window.clearTimeout(giveUp);
    };
  }, [ready, drawn]);

  // reveal once the ring has closed on a drawn scene
  useEffect(() => {
    if (!drawn || !assembled) return;
    const id = window.setTimeout(() => setRevealed(true), REVEAL_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [drawn, assembled]);

  const stage = gone ? 'gone' : entered ? 'leaving' : revealed ? 'title' : 'loading';

  // Once loaded, the 3D scene starts drawing behind the solid cover (see the effect above).
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

  // The ring (in its worker) and, on the page, the opening: the visitor's scroll eased into the
  // burn, the title, guides and actions burning away with it, and the camera pushing through.
  useEffect(() => {
    const el = canvas.current;
    if (skipped || !el) return;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const small = Math.min(window.innerWidth, window.innerHeight) < 600;
    const reduced = prefersReducedMotion();
    const ring = createRingHost(
      el,
      {
        shards: coarse || small ? 900 : 2600,
        sparks: coarse || small ? 220 : 480,
        fragments: coarse || small ? 380 : 1500,
        cover: '#05060a',
      },
      reduced,
      (assemble) => {
        // the name gathers with the ring
        if (phase.current === 'loading' && title.current) {
          title.current.style.opacity = String(0.2 + 0.8 * Math.min(1, assemble * 1.4));
        }
        if (assemble >= 0.999) setAssembled(true);
      },
    );
    host.current = ring;
    ring.setLoad(0.78 * fraction.current, 0.08);
    const state = opening.current;
    let lastOpen = -1;
    let started = false;
    const cam = canvasEl();
    const onResize = () => ring.resize();
    window.addEventListener('resize', onResize);
    const tick = () => {
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
      if (phase.current === 'loading' || state.open === lastOpen) return;
      lastOpen = state.open;
      ring.setOpen(state.open);
      // the title, guides and actions burn away with the first stretch of the opening
      const keep = chromeKeep(state.open);
      if (chrome.current) {
        chrome.current.style.opacity = String(keep);
        chrome.current.style.visibility = keep < 0.01 ? 'hidden' : '';
      }
      if (dock.current && phase.current === 'title') {
        const ease = (v: number) => v * v * (3 - 2 * v);
        dock.current.style.opacity = String(1 - ease(Math.min(1, state.open / 0.08)));
      }
      // and the camera pushes through the hole
      if (cam) gsap.set(cam, { scale: 1.06 - 0.06 * state.open });
    };
    gsap.ticker.add(tick);
    const source = () => document.querySelector<HTMLCanvasElement>('[data-journey-canvas] canvas');
    const stopCopy = addAfterEffect(() => {
      const open = state.open;
      if (open <= 0 || open >= 1) return;
      const src = source();
      if (src) ring.sendScene(src);
    });
    return () => {
      gsap.ticker.remove(tick);
      stopCopy();
      window.removeEventListener('resize', onResize);
      ring.dispose();
      host.current = null;
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
    const state = opening.current;
    const finish = () => {
      if (cam) gsap.set(cam, { clearProps: 'transform' });
      setGone(true);
    };
    if (prefersReducedMotion()) {
      finish();
      return;
    }
    gsap.killTweensOf(state);
    host.current?.setLoad(1);
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
