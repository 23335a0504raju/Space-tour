import { useEffect, useRef } from 'react';

/**
 * S5 · Scroll-scrubbed image sequence (the "video instead of 3D" question, 2026-11-24).
 * Plays a pre-rendered chapter (scripts/render-sequence.ts) on a canvas, frame = f(scroll), so
 * forward and reverse scrolling are equally exact. Answers: download size, time until scrubbable,
 * and draw cost per frame on the laptop and the phone. Frames are served by the dev server from
 * spike-results/seq/ (not part of any build). Pick a set with ?set=sc11b-proof-portrait.
 */
interface Manifest {
  readonly count: number;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
}

export default function S5ImageSequence() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stats = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const portrait = window.innerHeight > window.innerWidth;
    const set = params.get('set') ?? `sc11b-proof-${portrait ? 'portrait' : 'desktop'}`;
    const root = `/spike-results/seq/${set}/`;
    const cv = canvas.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    let disposed = false;
    let manifest: Manifest | null = null;
    const frames: HTMLImageElement[] = [];
    const ready: boolean[] = [];
    const draws: number[] = [];
    let missed = 0;
    let loaded = 0;
    let readyMs = 0;
    let last = -1;
    const t0 = performance.now();

    const report = () => {
      if (!stats.current || !manifest) return;
      const s = [...draws].sort((a, b) => a - b);
      const p95 = s[Math.floor(s.length * 0.95)] ?? 0;
      stats.current.textContent = [
        `set ${set}  ${manifest.count} frames ${manifest.width}×${manifest.height}`,
        `download ${(manifest.bytes / 1024 / 1024).toFixed(2)} MB`,
        `decoded ${loaded}/${manifest.count}${readyMs ? `  all ready in ${(readyMs / 1000).toFixed(1)} s` : ''}`,
        `draw p95 ${p95.toFixed(2)} ms over ${draws.length} draws  missed ${missed}`,
      ].join('\n');
    };

    const draw = () => {
      if (!manifest) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      const i = Math.round(p * (manifest.count - 1));
      if (i === last) return;
      // nearest decoded frame at or before i, so a fast fling never shows a blank
      let j = i;
      while (j > 0 && !ready[j]) j -= 1;
      if (!ready[j]) return;
      if (j !== i) missed += 1;
      last = i;
      const img = frames[j]!;
      const a = performance.now();
      // cover-fit the frame into the canvas
      const k = Math.max(cv.width / img.naturalWidth, cv.height / img.naturalHeight);
      const w = img.naturalWidth * k;
      const h = img.naturalHeight * k;
      ctx.drawImage(img, (cv.width - w) / 2, (cv.height - h) / 2, w, h);
      draws.push(performance.now() - a);
    };

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(window.innerWidth * dpr);
      cv.height = Math.round(window.innerHeight * dpr);
      last = -1;
      draw();
    };

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        draw();
        report();
      });
    };

    void fetch(root + 'manifest.json')
      .then((r) => r.json() as Promise<Manifest>)
      .then((m) => {
        if (disposed) return;
        manifest = m;
        resize();
        for (let i = 0; i < m.count; i += 1) {
          const img = new Image();
          img.src = `${root}${String(i).padStart(4, '0')}.webp`;
          frames.push(img);
          ready.push(false);
          void img
            .decode()
            .then(() => {
              ready[i] = true;
              loaded += 1;
              if (loaded === m.count) readyMs = performance.now() - t0;
              if (i === 0) draw();
              report();
            })
            .catch(() => undefined);
        }
      });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', resize);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div style={{ height: '600vh', background: '#000' }}>
      <canvas
        ref={canvas}
        style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', display: 'block' }}
      />
      <pre
        ref={stats}
        style={{
          position: 'fixed',
          left: 12,
          bottom: 12,
          margin: 0,
          padding: '8px 10px',
          font: '12px/1.4 ui-monospace, monospace',
          color: '#fff',
          background: 'rgba(0,0,0,0.6)',
          borderRadius: 6,
        }}
      >
        loading…
      </pre>
    </div>
  );
}
