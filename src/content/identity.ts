import { confirmed, fromSource } from './fact.ts';
import { SRC } from './sources.ts';
import type { Identity } from './types.ts';

/** Raju's answers in session, 2026-11-19 (closes Q1). */
const DECISION_Q1 = 'Decision by Raju, 2026-11-19 (Q1)';

export const identity: Identity = {
  name: confirmed(
    'Raju Chowdavada',
    [SRC.hero, SRC.connect, SRC.resume],
    `${DECISION_Q1}: given name first, as on the live site (resume header reads "CHOWDAVADA RAJU").`,
  ),
  portrait: confirmed(
    '/assets/me/portrait.webp',
    [SRC.userPhoto],
    'Raju asked for this photo to be shown across the portfolio.',
  ),
  role: confirmed(
    'Full-Stack Software Engineer & AI Builder',
    [SRC.hero],
    `${DECISION_Q1}: the live site's hero wording (resume says "Software Engineer").`,
  ),
  shortRole: confirmed(
    'Software Engineer',
    [SRC.resume],
    "The resume's title; chosen by Raju for the header brand line (navbar brief, 2026-11-21).",
  ),
  tagline: confirmed(
    'Building beyond the ordinary',
    [DECISION_Q1],
    'Opening hook line, approved by Raju 2026-11-19. Copy, not a factual claim.',
  ),
  summary: fromSource(
    'Full-stack developer with hands-on experience in REST API design, cloud deployment on AWS and CI/CD automation, building with Java, Python, Node.js, React, FastAPI and Django REST.',
    [SRC.resume2026],
    'Shortened from the current resume summary. Approve wording.',
  ),
  location: fromSource('Visakhapatnam, Andhra Pradesh', [SRC.resume, SRC.linkedin]),
  availability: fromSource(
    'Open to software engineering roles at product-based companies and high-growth startups',
    [SRC.linkedin],
    'From the LinkedIn About ("Open to SWE roles at product-based companies and high-growth startups"). Approve wording (Q11).',
  ),
};
