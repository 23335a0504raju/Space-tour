import { contact } from './contact.ts';
import { achievements, certifications, futureDirection, learning } from './credentials.ts';
import { education } from './education.ts';
import { experience } from './experience.ts';
import { identity } from './identity.ts';
import { projects } from './projects.ts';
import { stack, strengths } from './skills.ts';
import type { PortfolioContent } from './types.ts';

/** Single source of truth for the journey AND the Mission Brief. */
export const content: PortfolioContent = {
  identity,
  experience,
  education,
  strengths,
  stack,
  projects,
  certifications,
  achievements,
  learning,
  futureDirection,
  contact,
};

export * from './fact.ts';
export type * from './types.ts';
