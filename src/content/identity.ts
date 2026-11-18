import { conflict, fromSource, missing } from './fact.ts';
import { SRC } from './sources.ts';
import type { Identity } from './types.ts';

export const identity: Identity = {
  name: conflict(
    'Raju Chowdavada',
    [SRC.hero, SRC.connect, SRC.resume],
    'Hero/Connect use "Raju Chowdavada"; resume header uses "CHOWDAVADA RAJU". Confirm order (Q1).',
  ),
  role: conflict(
    'Software Engineer',
    [SRC.resume, SRC.hero],
    'Resume: "Software Engineer". Hero: "Full-Stack Software Engineer & AI Builder". Choose one (Q1).',
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
