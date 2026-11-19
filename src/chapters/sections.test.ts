import { describe, expect, it } from 'vitest';
import { chapters } from './registry.ts';
import { headerTarget, sectionIndexFor, sections } from './sections.ts';

describe('visitor sections', () => {
  it('cover every registry chapter exactly once, in registry order', () => {
    const flat = sections.flatMap((s) => s.chapterIds);
    expect(flat).toEqual(chapters.map((c) => c.id));
  });

  it('jump to a chapter inside their own section', () => {
    for (const s of sections) expect(s.chapterIds).toContain(s.target);
  });

  it('map chapters to sections monotonically', () => {
    let prev = 0;
    chapters.forEach((_, i) => {
      const s = sectionIndexFor(i);
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    });
    expect(sectionIndexFor(chapters.length - 1)).toBe(sections.length - 1);
  });

  it('send Skills to Strengths first (the tech stack follows it in the journey)', () => {
    expect(headerTarget('skills')).toBe('sc06-sunrise');
  });
});
