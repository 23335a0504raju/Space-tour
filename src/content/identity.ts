import { confirmed, fromSource, missing } from './fact.ts';
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
  role: confirmed(
    'Full-Stack Software Engineer & AI Builder',
    [SRC.hero],
    `${DECISION_Q1}: the live site's hero wording (resume says "Software Engineer").`,
  ),
  tagline: confirmed(
    'Building beyond the ordinary',
    [DECISION_Q1],
    'Opening hook line, approved by Raju 2026-11-19. Copy, not a factual claim.',
  ),
  summary: fromSource(
    'Software Engineer specializing in scalable web applications, APIs, and full-stack systems using Java, Python, React.js, and Node.js.',
    [SRC.resume],
    'Shortened from the resume summary (dropped "Proficient in optimizing application performance"). Approve wording.',
  ),
  location: fromSource('Visakhapatnam, Andhra Pradesh', [SRC.resume]),
  availability: missing(
    'Open to full-time software engineering roles',
    'Not in any source. Provide or approve an availability line (Q11).',
  ),
};
