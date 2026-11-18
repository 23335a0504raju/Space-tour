import { fromSource, missing } from './fact.ts';
import { SRC } from './sources.ts';
import type { Contact } from './types.ts';

export const contact: Contact = {
  email: fromSource(
    'smilyraju8464@gmail.com',
    [SRC.resume, SRC.contact],
    'Confirm this is the recruiter-facing address (Q11).',
  ),
  resumeUrl: missing(
    '/resume.pdf',
    'Two different Google Drive resumes exist (ResumeNew.jsx vs Contact.jsx). Provide the current PDF (Q5).',
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
      href: fromSource('https://www.linkedin.com/in/raju-chowdavada-06b734347', [
        SRC.resume,
        SRC.contact,
        SRC.footer,
      ]),
    },
    {
      id: 'leetcode',
      label: 'LeetCode',
      href: fromSource('https://leetcode.com/u/Raju_Ch8464/', [SRC.resume, SRC.contact]),
    },
  ],
};
