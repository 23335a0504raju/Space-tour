import { createRingState, ShardRing } from './shardRing.ts';
import type { RingCanvas, ShardRingOptions } from './shardRing.ts';

/** Fastest the ring may assemble (fraction per second): a cached visit still sees it gather. */
const ASSEMBLE_RATE = 0.62;
/** How quickly the shown assembly closes on its target (per second, exponential). */
const APPROACH = 2.4;
/**
 * While a stage is under way (a big file downloading, the scene building), the ring keeps creeping
 * toward that stage's ceiling at this rate (fraction per second), so it never sits still waiting.
 */
const CREEP_RATE = 0.035;
/** Longest frame the easing will integrate (a stall must not make the ring jump). */
const MAX_DT_MS = 50;

/**
 * The start gate's ring, driven by its own frame loop. It runs inside a worker on an
 * OffscreenCanvas (ringWorker.ts), so the loader keeps moving while the page's main thread is busy
 * building the first scene (WebGL setup, React mounting the chapters, model parsing, shader links):
 * those stalls froze the ring for up to a second at a time. Browsers without OffscreenCanvas run
 * the same loop on the page (ringHost.ts).
 *
 * This is start-gate chrome, not story state: the journey's one clock starts after the gate.
 */
export class RingLoop {
  private readonly ring: ShardRing;
  private readonly state = createRingState();
  private target = 0;
  private ceiling = 0;
  private creep = 0;
  private last = -1;
  private reported = -1;

  private readonly reduced: boolean;
  /** told the shown assembly as it changes (the page fades the title in with it) */
  private readonly report: (assemble: number) => void;

  constructor(
    canvas: RingCanvas,
    opts: ShardRingOptions,
    reduced: boolean,
    report: (assemble: number) => void,
  ) {
    this.ring = new ShardRing(canvas, opts);
    this.reduced = reduced;
    this.report = report;
  }

  resize(width: number, height: number): void {
    this.ring.resize(width, height);
  }

  setGuideLengths(lengths: readonly number[]): void {
    this.ring.setGuideLengths(lengths);
  }

  /**
   * Target assembly, 0..1 (the load progress), and how far the ring may creep ahead of it while the
   * current stage is under way. The ring never runs backwards.
   */
  setLoad(value: number, ceiling = value): void {
    this.target = Math.max(this.target, Math.min(1, value));
    this.ceiling = Math.max(this.target, Math.min(1, ceiling));
  }

  /** The opening, 0..1 (eased on the page, where the visitor's scroll arrives). */
  setOpen(value: number): void {
    this.state.open = value;
  }

  setScene(image: CanvasImageSource | null): void {
    const old = this.ring.scene as ImageBitmap | null;
    this.ring.scene = image;
    if (old && old !== image && typeof old.close === 'function') old.close();
  }

  /** One frame at `now` (ms). */
  frame(now: number): void {
    const dt = this.last < 0 ? 16.7 : Math.min(MAX_DT_MS, now - this.last);
    this.last = now;
    const s = this.state;
    this.creep = Math.min(
      this.ceiling,
      Math.max(this.creep, this.target) + CREEP_RATE * (dt / 1000),
    );
    const goal = Math.max(this.target, this.creep);
    if (this.reduced) s.assemble = this.target;
    else if (s.assemble < goal) {
      const gap = goal - s.assemble;
      const step = Math.min(
        gap,
        Math.max(gap * (1 - Math.exp(-APPROACH * (dt / 1000))), 0.002),
        ASSEMBLE_RATE * (dt / 1000),
      );
      s.assemble += step;
    }
    if (Math.abs(s.assemble - this.reported) > 0.002 || (s.assemble >= 1 && this.reported < 1)) {
      this.reported = s.assemble;
      this.report(s.assemble);
    }
    this.ring.draw(s, this.reduced ? 0 : now / 1000);
  }
}

/** Messages from the page to the ring worker. */
export type RingCommand =
  | {
      readonly t: 'init';
      readonly canvas: OffscreenCanvas;
      readonly opts: ShardRingOptions;
      readonly reduced: boolean;
      readonly width: number;
      readonly height: number;
      readonly lengths: readonly number[];
    }
  | { readonly t: 'resize'; readonly width: number; readonly height: number }
  | { readonly t: 'load'; readonly value: number; readonly ceiling: number }
  | { readonly t: 'open'; readonly value: number }
  | { readonly t: 'scene'; readonly image: ImageBitmap }
  | { readonly t: 'stop' };

/** Messages from the ring worker to the page. */
export interface RingReport {
  readonly t: 'assemble';
  readonly value: number;
}
