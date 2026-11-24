import { fromSource } from './fact.ts';
import { SRC } from './sources.ts';
import type { Contact } from './types.ts';

export const contact: Contact = {
  email: fromSource(
    'smilyraju8464@gmail.com',
    [SRC.resume, SRC.contact],
    'Confirm this is the recruiter-facing address (Q11).',
  ),
  resumeUrl: fromSource(
    '/resume.pdf',
    [SRC.resume2026],
    'The current resume Raju supplied (2026-11-24). It includes his phone number, so publishing it makes the number public.',
  ),
  links: [
    {
      id: 'github',
      label: 'GitHub',
      href: fromSource('https://github.com/23335a0504raju', [SRC.resume, SRC.contact, SRC.footer]),
    },
    {
      id: 'linkedin',
      label: 'LinkedIn',
      href: fromSource(
        'https://www.linkedin.com/in/rajuchowdavada/',
        [SRC.linkedin, SRC.resume, SRC.contact, SRC.footer],
        'The old URL (/in/raju-chowdavada-06b734347) redirects here; this is the public profile URL.',
      ),
    },
    {
      id: 'leetcode',
      label: 'LeetCode',
      href: fromSource('https://leetcode.com/u/Raju_Ch8464/', [SRC.resume, SRC.contact]),
    },
  ],
};
