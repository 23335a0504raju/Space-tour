import { describe, expect, it } from 'vitest';
import { chapters } from '../../chapters/registry.ts';
import { buildTrack, classifyAspect, dwell, progressFor, resolve } from './resolver.ts';

const track = buildTrack(chapters, 'landscape');

describe('classifyAspect', () => {
  it('classifies common viewports', () => {
    expect(classifyAspect(390, 844)).toBe('portrait');
    expect(classifyAspect(1440, 900)).toBe('landscape');
    expect(classifyAspect(2560, 1080)).toBe('ultrawide');
  });
});

describe('buildTrack', () => {
  it('covers [0, 1] contiguously', () => {
    const { segments } = track;
    expect(segments[0]?.start).toBe(0);
    expect(segments.at(-1)?.end).toBe(1);
    for (let i = 1; i < segments.length; i += 1) {
      expect(segments[i]?.start).toBeCloseTo(segments[i - 1]?.end ?? -1, 12);
    }
  });

  it('matches the scroll map within planning tolerance', () => {
    // SCROLL_EXPERIENCE_MAP.md: experience by ~10%, projects ~36%, contact ~87%.
    expect(progressFor(track, 'sc04-crew-record')).toBeCloseTo(0.1, 1);
    expect(progressFor(track, 'sc08-jupiter')).toBeGreaterThan(0.33);
    expect(progressFor(track, 'sc08-jupiter')).toBeLessThan(0.4);
    expect(progressFor(track, 'sc13-transmission')).toBeGreaterThan(0.84);
    // shortened from 33.5 for pace (UI_SCROLL_AUDIT.md step 1)
    expect(track.totalScreens).toBeGreaterThan(20);
    expect(track.totalScreens).toBeLessThan(25);
  });

  it('portrait tracks are shorter but keep the same proportions', () => {
    const portrait = buildTrack(chapters, 'portrait');
    expect(portrait.totalScreens).toBeLessThan(track.totalScreens);
    expect(progressFor(portrait, 'sc08-jupiter')).toBeCloseTo(
      progressFor(track, 'sc08-jupiter'),
      12,
    );
  });
});

describe('resolve', () => {
  it('maps the ends of the journey', () => {
    expect(resolve(track, 0)).toMatchObject({ id: 'sc02-room', localT: 0 });
    expect(resolve(track, 1)).toMatchObject({ id: 'sc13-transmission', localT: 1 });
  });

  it('clamps out-of-range and non-finite input', () => {
    expect(resolve(track, -3).localT).toBe(0);
    expect(resolve(track, 7).localT).toBe(1);
    expect(resolve(track, Number.NaN).id).toBe('sc02-room');
  });

  it('assigns exact boundaries to the later chapter', () => {
    const p = progressFor(track, 'sc04-crew-record');
    expect(resolve(track, p)).toMatchObject({ id: 'sc04-crew-record', localT: 0 });
  });

  it('round-trips with progressFor for every chapter', () => {
    for (const c of chapters) {
      for (const t of [0.1, 0.5, 0.9]) {
        const r = resolve(track, progressFor(track, c.id, t));
        expect(r.id).toBe(c.id);
        expect(r.localT).toBeCloseTo(t, 9);
      }
    }
  });

  it('is path-independent: same result whichever direction you arrive from', () => {
    // resolve is stateless, so seeking a→b equals seeking b. This test guards against
    // anyone later adding hidden state (the core reverse-scroll guarantee).
    const samples = Array.from({ length: 200 }, (_, i) => i / 199);
    const forward = samples.map((p) => resolve(track, p));
    const backward = [...samples]
      .reverse()
      .map((p) => resolve(track, p))
      .reverse();
    expect(backward).toEqual(forward);
  });
});

describe('dwell', () => {
  const rests = [0.25, 0.5, 0.75];

  it('fixes the endpoints', () => {
    expect(dwell(0, rests)).toBe(0);
    expect(dwell(1, rests)).toBe(1);
  });

  it('is monotonic (never runs time backwards while scrolling forwards)', () => {
    let prev = -1;
    for (let i = 0; i <= 1000; i += 1) {
      const t = dwell(i / 1000, rests);
      expect(t).toBeGreaterThanOrEqual(prev);
      prev = t;
    }
  });

  it('slows time near rest points and speeds it up between them', () => {
    const h = 0.01;
    const slopeAtRest = (dwell(0.5 + h, rests) - dwell(0.5 - h, rests)) / (2 * h);
    const slopeBetween = (dwell(0.375 + h, rests) - dwell(0.375 - h, rests)) / (2 * h);
    expect(slopeAtRest).toBeLessThan(0.3);
    expect(slopeBetween).toBeGreaterThan(1);
  });

  it('passes through each rest point', () => {
    for (const r of rests) expect(dwell(r, rests)).toBeCloseTo(r, 9);
  });

  it('is the identity when there are no rest points', () => {
    for (const s of [0, 0.2, 0.77, 1]) expect(dwell(s, [])).toBeCloseTo(s, 12);
  });
});
