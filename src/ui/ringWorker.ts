/**
 * The start gate's ring in a worker (see RingLoop). It draws on an OffscreenCanvas transferred from
 * the page, on its own frame loop, so main-thread work never freezes the loader.
 */
import { RingLoop } from './ringLoop.ts';
import type { RingCommand, RingReport } from './ringLoop.ts';

interface WorkerScope {
  onmessage: ((e: MessageEvent<RingCommand>) => void) | null;
  postMessage(message: RingReport): void;
  close(): void;
  requestAnimationFrame?: (cb: (now: number) => void) => number;
}

const scope = self as unknown as WorkerScope;
let loop: RingLoop | null = null;
let running = false;

// Workers have requestAnimationFrame in Chromium and Firefox; elsewhere a 60 Hz timer.
const nextFrame = (cb: (now: number) => void) =>
  scope.requestAnimationFrame
    ? scope.requestAnimationFrame(cb)
    : setTimeout(() => cb(performance.now()), 16);

const tick = (now: number) => {
  if (!running || !loop) return;
  loop.frame(now);
  nextFrame(tick);
};

scope.onmessage = (e) => {
  const m = e.data;
  switch (m.t) {
    case 'init':
      loop = new RingLoop(m.canvas, m.opts, m.reduced, (value) =>
        scope.postMessage({ t: 'assemble', value }),
      );
      loop.setGuideLengths(m.lengths);
      loop.resize(m.width, m.height);
      running = true;
      nextFrame(tick);
      break;
    case 'resize':
      loop?.resize(m.width, m.height);
      break;
    case 'load':
      loop?.setLoad(m.value, m.ceiling);
      break;
    case 'open':
      loop?.setOpen(m.value);
      break;
    case 'scene':
      loop?.setScene(m.image);
      break;
    case 'stop':
      running = false;
      loop?.setScene(null);
      scope.close();
      break;
  }
};
