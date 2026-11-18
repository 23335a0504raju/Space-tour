import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useProgress } from '@react-three/drei';
import gsap from 'gsap';
import { content } from '../content/index.ts';
import { preloadJourney } from '../engine/assets/preload.ts';
import { useJourneyStore } from '../engine/store.ts';
import { FactText, shouldShow } from './FactText.tsx';
import styles from './StartGate.module.css';

const { identity } = content;

/** Loader quiet for this long (ms) means the first scene's assets are in. */
const QUIET_MS = 1200;
/** Pause between "100%" and the reveal, so shaders finish compiling behind the curtain. */
const REVEAL_DELAY_MS = 450;
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+<>/';

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fileName = (url: string) => url.split(/[?#]/)[0]?.split('/').pop() ?? url;
const canvasEl = () => document.querySelector<HTMLElement>('[data-journey-canvas]');
/** Letterbox bar height in px: a 2.39:1-ish frame on desktop, thinner but tappable on phones. */
const barHeight = () => Math.round(Math.max(window.innerHeight * 0.1, 76));

/** Decode reveal: characters resolve left to right out of random glyphs (UI only, not story). */
function scramble(el: HTMLElement, text: string, duration: number): gsap.core.Tween {
  const o = { p: 0 };
  return gsap.to(o, {
    p: 1,
    duration,
    ease: 'power1.inOut',
    onStart: () => void (el.style.opacity = '1'),
    onUpdate: () => {
      const settled = Math.floor(o.p * text.length);
      let out = '';
      for (let i = 0; i < text.length; i += 1) {
        const ch = text[i] ?? '';
        out +=
          i < settled || ch === ' '
            ? ch
            : (GLYPHS[Math.floor(Math.random() * GLYPHS.length)] ?? '');
      }
      el.textContent = out;
    },
    onComplete: () => void (el.textContent = text),
  });
}

/**
 * Opening sequence (FIX_LIST 8). Three beats, all UI state before the journey starts (story
 * state stays a pure function of scroll progress):
 *  1. Signal: black frame, starfield, a ring and counter driven by the real asset loader, and the
 *     files arriving as a telemetry log.
 *  2. Title: the stars jump to warp, the black splits into letterbox bars that open on the live
 *     SC02 shot (slow push-in, pointer parallax), and the name decodes in. One Begin action.
 *  3. Hand-off (< 2 s): copy blurs out, bars retract, the camera eases to SC02's title card.
 * The header (Projects, Contact, Brief) sits above it, so every action works from the first frame.
 */
export function StartGate() {
  const entered = useJourneyStore((s) => s.entered);
  const enter = useJourneyStore((s) => s.enter);
  const assetsReady = useJourneyStore((s) => s.assetsReady);
  // scene loaders (from the in-memory copies): used only to know the first scene is built
  const { progress, active } = useProgress();
  const [skipped] = useState(entered); // ?gate=off: no gate, no hint (tests, captures)
  const [pct, setPct] = useState(0);
  const [ready, setReady] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [gone, setGone] = useState(false);
  const [log, setLog] = useState<readonly string[]>([]);

  const root = useRef<HTMLElement>(null);
  const stars = useRef<HTMLDivElement>(null);
  const loader = useRef<HTMLDivElement>(null);
  const barTop = useRef<HTMLDivElement>(null);
  const barBottom = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLDivElement>(null);
  const kicker = useRef<HTMLParagraphElement>(null);
  const name = useRef<HTMLParagraphElement>(null);
  const role = useRef<HTMLParagraphElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const warp = useRef({ v: 0 });

  // Real download progress of every journey file (bytes), and the files as they land.
  useEffect(() => {
    const { unsubscribe } = preloadJourney((p) => {
      setPct((prev) => Math.max(prev, Math.min(99, Math.floor(p.fraction * 100))));
      setLog(p.done.slice(-4).map(fileName));
    });
    return unsubscribe;
  }, []);

  // then wait for the first scene to finish building from those copies
  useEffect(() => {
    if (!assetsReady || (active && progress < 100)) return;
    const id = window.setTimeout(() => setReady(true), progress >= 100 ? 0 : QUIET_MS);
    return () => window.clearTimeout(id);
  }, [assetsReady, progress, active]);

  useEffect(() => {
    if (!ready) return;
    const id = window.setTimeout(() => setRevealed(true), REVEAL_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [ready]);

  const stage = gone ? 'gone' : entered ? 'leaving' : revealed ? 'title' : 'loading';
  const nameText = shouldShow(identity.name) ? String(identity.name.value) : '';

  useLayoutEffect(() => {
    root.current?.style.setProperty('--bar', `${barHeight()}px`);
  }, []);

  // Beat 2: warp, letterbox reveal, push-in, decode.
  useLayoutEffect(() => {
    if (stage !== 'title' || skipped) return;
    const els = { kicker: kicker.current, name: name.current, role: role.current };
    const bars = [barTop.current, barBottom.current];
    const cam = canvasEl();
    const barPx = barHeight();
    if (prefersReducedMotion()) {
      gsap.set([loader.current, stars.current], { autoAlpha: 0 });
      gsap.set(bars, { height: barPx });
      gsap.set([scrim.current, els.kicker, els.name, els.role, dock.current], { opacity: 1 });
      button.current?.focus({ preventScroll: true });
      return;
    }
    const tl = gsap.timeline();
    tl.to(warp.current, { v: 1, duration: 0.7, ease: 'power2.in' }, 0)
      .to(loader.current, { scale: 1.5, autoAlpha: 0, duration: 0.55, ease: 'power2.in' }, 0.05)
      .to(stars.current, { autoAlpha: 0, duration: 0.35 }, 0.6)
      .to(bars, { height: barPx, duration: 1.15, ease: 'expo.inOut' }, 0.5)
      .fromTo(scrim.current, { opacity: 0 }, { opacity: 1, duration: 1 }, 0.9)
      .fromTo(
        els.kicker,
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' },
        1.1,
      )
      .fromTo(
        els.role,
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' },
        1.7,
      )
      .fromTo(
        dock.current,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' },
        1.5,
      )
      .call(() => button.current?.focus({ preventScroll: true }), undefined, 1.6);
    if (els.name) tl.add(scramble(els.name, nameText, 1.1), 1.2);
    if (cam) {
      tl.fromTo(cam, { scale: 1.14 }, { scale: 1.03, duration: 5, ease: 'power2.out' }, 0.5);
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
  }, [stage, skipped, nameText]);

  // Beat 3: hand-off. The Journey eases the camera to SC02's title card at the same moment.
  useLayoutEffect(() => {
    if (stage !== 'leaving' || skipped) return;
    const cam = canvasEl();
    const finish = () => {
      if (cam) gsap.set(cam, { clearProps: 'transform' });
      setGone(true);
    };
    if (prefersReducedMotion()) {
      finish();
      return;
    }
    if (cam) gsap.killTweensOf(cam);
    const tl = gsap.timeline({ onComplete: finish });
    tl.to(
      title.current,
      { opacity: 0, y: -12, filter: 'blur(12px)', duration: 0.45, ease: 'power2.in' },
      0,
    )
      .to([dock.current, loader.current, stars.current], { autoAlpha: 0, duration: 0.3 }, 0)
      .to(
        [barTop.current, barBottom.current],
        { height: 0, duration: 0.9, ease: 'expo.inOut' },
        0.1,
      )
      .to(scrim.current, { opacity: 0, duration: 0.8 }, 0.1);
    if (cam) tl.to(cam, { scale: 1, x: 0, y: 0, duration: 1.1, ease: 'power2.inOut' }, 0);
    return () => void tl.kill();
  }, [stage, skipped]);

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
  if (stage === 'gone') return <ScrollHint />;
  const shown = ready ? 100 : pct;
  return (
    <section ref={root} className={styles.gate} aria-label="Start" inert={entered}>
      <div ref={scrim} className={styles.scrim} />
      <div ref={barTop} className={`${styles.bar} ${styles.barTop}`} />
      <div ref={barBottom} className={`${styles.bar} ${styles.barBottom}`} />
      <div ref={stars} className={styles.stars}>
        <Starfield warp={warp} />
      </div>

      <div ref={loader} className={styles.loader} aria-hidden="true">
        <p className={styles.loaderKicker}>{ready ? 'Signal acquired' : 'Acquiring signal'}</p>
        <div className={styles.dial}>
          <svg className={styles.ring} viewBox="0 0 100 100">
            <circle className={styles.ringTicks} cx="50" cy="50" r="46" pathLength={120} />
            <circle className={styles.ringTrack} cx="50" cy="50" r="40" />
            <circle
              className={styles.ringFill}
              cx="50"
              cy="50"
              r="40"
              pathLength={100}
              strokeDasharray={100}
              strokeDashoffset={100 - shown}
            />
          </svg>
          <span className={styles.count}>{String(shown).padStart(3, '0')}</span>
        </div>
        <ol className={styles.log}>
          {log.map((f, i) => (
            <li key={`${f}-${i}`}>{f}</li>
          ))}
        </ol>
      </div>
      <progress
        className="visually-hidden"
        max={100}
        value={shown}
        aria-label="Loading the journey"
      />

      <div ref={title} className={styles.title} aria-hidden="true">
        <p ref={kicker} className={styles.kicker}>
          SC01 · Signal
        </p>
        <p ref={name} className={styles.name}>
          {nameText}
        </p>
        <p ref={role} className={styles.role}>
          <FactText fact={identity.role} />
        </p>
      </div>

      <div ref={dock} className={styles.dock}>
        <p className={styles.status} aria-hidden="true">
          <span className={styles.dot} /> All systems ready
        </p>
        <button
          ref={button}
          type="button"
          className={styles.begin}
          disabled={stage !== 'title'}
          onClick={enter}
        >
          Begin mission <span aria-hidden="true">→</span>
        </button>
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

/**
 * Starfield for the Signal beat: drifts, leans with the pointer, and streaks into a warp as the
 * reveal starts. Plain 2D canvas on the GSAP ticker (the one clock); a still frame for reduced
 * motion; fewer stars on touch screens. Stops once hidden.
 */
function Starfield({ warp }: { warp: React.RefObject<{ v: number }> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    const count = window.matchMedia('(pointer: coarse)').matches ? 110 : 260;
    const stars = Array.from({ length: count }, () => ({
      x: Math.random() * 2 - 1,
      y: Math.random() * 2 - 1,
      z: Math.random() * 0.95 + 0.05,
    }));
    let w = 0;
    let h = 0;
    const look = { x: 0, y: 0, tx: 0, ty: 0 };
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      w = el.clientWidth;
      h = el.clientHeight;
      el.width = w * dpr;
      el.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const draw = (ratio: number) => {
      ctx.clearRect(0, 0, w, h);
      const v = warp.current.v;
      const speed = (0.0018 + v * v * 0.09) * ratio;
      look.x += (look.tx - look.x) * 0.05;
      look.y += (look.ty - look.y) * 0.05;
      const cx = w / 2 + look.x * 28;
      const cy = h / 2 + look.y * 28;
      const scale = Math.max(w, h) * 0.55;
      ctx.lineCap = 'round';
      for (const s of stars) {
        const prevZ = s.z + speed * 1.8;
        s.z -= speed;
        if (s.z <= 0.02) {
          s.x = Math.random() * 2 - 1;
          s.y = Math.random() * 2 - 1;
          s.z = 1;
          continue;
        }
        const sx = cx + (s.x / s.z) * scale;
        const sy = cy + (s.y / s.z) * scale;
        const px = cx + (s.x / prevZ) * scale;
        const py = cy + (s.y / prevZ) * scale;
        const a = Math.min(1, (1 - s.z) * 1.4 + 0.12);
        ctx.strokeStyle = `rgba(233, 231, 225, ${a})`;
        ctx.lineWidth = 0.5 + (1 - s.z) * 1.7;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(sx + 0.01, sy);
        ctx.stroke();
      }
    };
    const onMove = (e: PointerEvent) => {
      look.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      look.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    resize();
    window.addEventListener('resize', resize);
    if (prefersReducedMotion()) {
      draw(0);
      return () => window.removeEventListener('resize', resize);
    }
    const tick = () => {
      if (el.parentElement?.style.visibility === 'hidden') return; // faded out by the reveal: stop drawing
      draw(gsap.ticker.deltaRatio());
    };
    gsap.ticker.add(tick);
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      gsap.ticker.remove(tick);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
    };
  }, [warp]);

  return <canvas ref={canvas} className={styles.starsCanvas} aria-hidden="true" />;
}
