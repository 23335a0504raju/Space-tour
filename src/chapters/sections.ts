import { chapters } from './registry.ts';

/**
 * Visitor-facing sections of the journey (UI_SCROLL_AUDIT.md §8). Chapters are story units; a
 * visitor navigates by what they want to read. Each section groups consecutive chapters from the
 * registry (sections.test.ts checks every chapter belongs to exactly one, in registry order).
 * Used by the header highlight, the progress ticks and label, and the Flight Plan menu.
 */
export type HeaderItem = 'about' | 'experience' | 'projects' | 'skills' | 'contact';

export interface Section {
  readonly id: string;
  readonly label: string;
  readonly chapterIds: readonly string[];
  /** Chapter a jump lands in (at its first rest point). */
  readonly target: string;
  /** Header item lit while this section is on screen (Strengths and Stack both light Skills). */
  readonly header: HeaderItem | null;
}

export const sections: readonly Section[] = [
  {
    id: 'intro',
    label: 'Introduction',
    chapterIds: ['sc02-room', 'sc03-departure'],
    target: 'sc02-room',
    header: 'about',
  },
  {
    id: 'experience',
    label: 'Experience',
    chapterIds: ['sc04-crew-record', 'sc05-ascent'],
    target: 'sc04-crew-record',
    header: 'experience',
  },
  {
    id: 'strengths',
    label: 'Strengths',
    chapterIds: ['sc06-sunrise'],
    target: 'sc06-sunrise',
    header: 'skills',
  },
  {
    id: 'projects',
    label: 'Projects',
    chapterIds: ['sc07-outbound', 'sc08-jupiter'],
    target: 'sc08-jupiter',
    header: 'projects',
  },
  {
    id: 'stack',
    label: 'Tech Stack',
    chapterIds: ['sc09-saturn'],
    target: 'sc09-saturn',
    header: 'skills',
  },
  {
    id: 'beyond',
    label: 'Beyond',
    chapterIds: [
      'sc10-crossing',
      'sc11a-discipline',
      'sc11b-proof',
      'sc11c-horizon',
      'sc12-return',
    ],
    target: 'sc11a-discipline',
    header: null,
  },
  {
    id: 'contact',
    label: 'Contact',
    chapterIds: ['sc13-transmission'],
    target: 'sc13-transmission',
    header: 'contact',
  },
];

const byChapter = new Map<string, number>();
sections.forEach((s, i) => s.chapterIds.forEach((id) => byChapter.set(id, i)));

/** Index into `sections` of the section a registry chapter index belongs to. */
export function sectionIndexFor(chapterIndex: number): number {
  const id = chapters[chapterIndex]?.id;
  return (id !== undefined ? byChapter.get(id) : undefined) ?? 0;
}

/** Target chapter for a header item (the first section that lights it). */
export function headerTarget(item: HeaderItem): string | null {
  const s = sections.find((x) => x.header === item);
  return s ? s.target : null;
}
