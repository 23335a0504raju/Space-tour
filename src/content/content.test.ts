import { describe, expect, it } from 'vitest';
import { collectFacts } from './audit.ts';
import { content } from './index.ts';

const entries = collectFacts(content);

describe('content module', () => {
  it('contains facts', () => {
    expect(entries.length).toBeGreaterThan(50);
  });

  it('every non-missing fact cites at least one source', () => {
    const unsourced = entries.filter(
      (e) => e.fact.status !== 'missing' && e.fact.source.length === 0,
    );
    expect(unsourced.map((e) => e.path)).toEqual([]);
  });

  it('every unresolved fact explains what is needed', () => {
    const unexplained = entries.filter(
      (e) => ['conflict', 'unverified', 'missing'].includes(e.fact.status) && !e.fact.note,
    );
    expect(unexplained.map((e) => e.path)).toEqual([]);
  });

  it('ids are unique across projects and experience', () => {
    const ids = [
      ...content.projects.map((p) => p.id),
      ...content.experience.map((x) => x.id),
      ...content.experience.flatMap((x) => x.projects.map((p) => p.id)),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes the Pit Solutions and Spotmies internships, each with project templates', () => {
    const orgs = content.experience.map((x) => x.organisation.value);
    expect(orgs).toEqual(expect.arrayContaining(['Spotmies', 'Pit Solutions']));
    for (const job of content.experience) {
      expect(job.projects.length).toBeGreaterThan(0);
    }
  });

  it('internship project templates stay unpublishable until filled in', () => {
    const templates = content.experience.flatMap((x) => x.projects);
    for (const t of templates) {
      expect(t.name.status).toBe('missing');
      expect(t.publicPermission.status).toBe('missing');
    }
  });

  it('never contains the rejected unverified metrics', () => {
    const text = JSON.stringify(content);
    expect(text).not.toMatch(/99\.9%|\+25%|25% Speed/i);
  });

  it('project links are absolute http(s) URLs', () => {
    for (const p of content.projects) {
      for (const url of Object.values(p.links.value)) {
        expect(url).toMatch(/^https?:\/\//);
      }
    }
  });
});
