/** Fixed-size ring buffer of frame times (ms) with percentile summaries. Allocation-free per frame. */
export class FrameStats {
  private readonly buffer: Float32Array;
  private count = 0;
  private cursor = 0;

  constructor(capacity = 1200) {
    this.buffer = new Float32Array(capacity);
  }

  push(frameMs: number): void {
    if (!Number.isFinite(frameMs) || frameMs <= 0) return;
    this.buffer[this.cursor] = frameMs;
    this.cursor = (this.cursor + 1) % this.buffer.length;
    if (this.count < this.buffer.length) this.count += 1;
  }

  reset(): void {
    this.count = 0;
    this.cursor = 0;
  }

  get size(): number {
    return this.count;
  }

  summary(): FrameSummary {
    if (this.count === 0) return { frames: 0, p50: 0, p95: 0, p99: 0, max: 0, avgFps: 0 };
    const sorted = Array.from(this.buffer.subarray(0, this.count)).sort((a, b) => a - b);
    const pick = (q: number) =>
      sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
    const total = sorted.reduce((a, b) => a + b, 0);
    return {
      frames: this.count,
      p50: pick(0.5),
      p95: pick(0.95),
      p99: pick(0.99),
      max: sorted[sorted.length - 1] ?? 0,
      avgFps: (1000 * this.count) / total,
    };
  }
}

export interface FrameSummary {
  readonly frames: number;
  readonly p50: number;
  readonly p95: number;
  readonly p99: number;
  readonly max: number;
  readonly avgFps: number;
}
