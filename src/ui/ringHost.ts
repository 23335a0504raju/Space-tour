import gsap from 'gsap';
import { RingLoop } from './ringLoop.ts';
import type { RingCommand, RingReport } from './ringLoop.ts';
import { GUIDES } from './shardRing.ts';
import type { ShardRingOptions } from './shardRing.ts';

/** The page's handle on the start gate's ring, wherever it runs. */
export interface RingHost {
  /** Load progress 0..1, and how far the ring may creep ahead while that stage is under way. */
  setLoad(value: number, ceiling?: number): void;
  setOpen(value: number): void;
  /** Hand over the 3D canvas as just drawn (a small copy: the fragments in the burn band). */
  sendScene(source: HTMLCanvasElement): void;
  resize(): void;
  dispose(): void;
}

/** Guide path lengths in frame units, measured once (Path2D cannot measure itself). */
function guideLengths(): number[] {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  document.body.append(svg);
  const lengths = GUIDES.map((g) => {
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', g.d);
    svg.append(p);
    return p.getTotalLength();
  });
  svg.remove();
  return lengths;
}

/** Scene copies are a third of the screen size (the fragments are small and blurred anyway). */
const sceneSize = () => ({
  width: Math.max(1, Math.round(window.innerWidth / 3)),
  height: Math.max(1, Math.round(window.innerHeight / 3)),
});

/** Running rings by canvas, with a pending shutdown (see createRingHost). */
const running = new WeakMap<
  HTMLCanvasElement,
  { host: RingHost; report: { current: (value: number) => void }; stop: number }
>();

/**
 * Start the ring on `canvas`, or take over the one already running there.
 *
 * A canvas can hand its control to a worker only once, but React StrictMode (dev) runs every
 * effect twice: mount, clean up, mount again. So `dispose` shuts the ring down a moment later, and
 * a new call for the same canvas in that moment cancels the shutdown and reuses the running ring.
 */
export function createRingHost(
  canvas: HTMLCanvasElement,
  opts: ShardRingOptions,
  reduced: boolean,
  onAssemble: (value: number) => void,
): RingHost {
  const live = running.get(canvas);
  if (live) {
    window.clearTimeout(live.stop);
    live.report.current = onAssemble;
    return live.host;
  }
  const report = { current: onAssemble };
  const inner = startRingHost(canvas, opts, reduced, (v) => report.current(v));
  const entry = { host: inner, report, stop: 0 };
  const host: RingHost = {
    ...inner,
    dispose: () => {
      window.clearTimeout(entry.stop);
      entry.stop = window.setTimeout(() => {
        running.delete(canvas);
        inner.dispose();
      }, 0);
    },
  };
  entry.host = host;
  running.set(canvas, entry);
  return host;
}

/**
 * Start the ring: in a worker on an OffscreenCanvas where the browser allows it (the loader then
 * never freezes while the page builds the scene), else on the page on the GSAP ticker.
 */
function startRingHost(
  canvas: HTMLCanvasElement,
  opts: ShardRingOptions,
  reduced: boolean,
  onAssemble: (value: number) => void,
): RingHost {
  const lengths = guideLengths();
  const size = () => ({ width: canvas.clientWidth, height: canvas.clientHeight });
  let lastOpen = -1;

  let worker: Worker | null = null;
  if (typeof canvas.transferControlToOffscreen === 'function' && typeof Worker !== 'undefined') {
    try {
      worker = new Worker(new URL('./ringWorker.ts', import.meta.url), { type: 'module' });
    } catch {
      worker = null;
    }
  }

  if (worker) {
    const w = worker;
    const post = (m: RingCommand, transfer: Transferable[] = []) => w.postMessage(m, transfer);
    const offscreen = canvas.transferControlToOffscreen();
    post({ t: 'init', canvas: offscreen, opts, reduced, ...size(), lengths }, [offscreen]);
    w.onmessage = (e: MessageEvent<RingReport>) => onAssemble(e.data.value);
    let copying = false;
    return {
      setLoad: (value, ceiling) => post({ t: 'load', value, ceiling: ceiling ?? value }),
      setOpen: (value) => {
        if (value === lastOpen) return;
        lastOpen = value;
        post({ t: 'open', value });
      },
      sendScene: (source) => {
        // one copy in flight at a time: the burn shows the latest picture, never a queue
        if (copying || typeof createImageBitmap !== 'function') return;
        copying = true;
        const { width, height } = sceneSize();
        createImageBitmap(source, { resizeWidth: width, resizeHeight: height })
          .then((image) => post({ t: 'scene', image }, [image]))
          .catch(() => undefined)
          .finally(() => (copying = false));
      },
      resize: () => post({ t: 'resize', ...size() }),
      dispose: () => {
        post({ t: 'stop' });
        w.onmessage = null;
      },
    };
  }

  // Fallback: the same loop on the page.
  const loop = new RingLoop(canvas, opts, reduced, onAssemble);
  loop.setGuideLengths(lengths);
  const { width, height } = size();
  loop.resize(width, height);
  const tick = () => loop.frame(performance.now());
  gsap.ticker.add(tick);
  const copy = document.createElement('canvas');
  const copyCtx = copy.getContext('2d');
  return {
    setLoad: (value, ceiling) => loop.setLoad(value, ceiling),
    setOpen: (value) => loop.setOpen(value),
    sendScene: (source) => {
      if (!copyCtx) return;
      const s = sceneSize();
      if (copy.width !== s.width || copy.height !== s.height) {
        copy.width = s.width;
        copy.height = s.height;
      }
      copyCtx.drawImage(source, 0, 0, s.width, s.height);
      loop.setScene(copy);
    },
    resize: () => {
      const s = size();
      loop.resize(s.width, s.height);
    },
    dispose: () => gsap.ticker.remove(tick),
  };
}
