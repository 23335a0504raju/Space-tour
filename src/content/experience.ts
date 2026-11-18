import { fromSource, missing } from './fact.ts';
import { SRC } from './sources.ts';
import type { Experience, WorkProject } from './types.ts';

/**
 * Internship project TEMPLATE. Raju will supply the real details later
 * (instruction, 2026-11-16). Every field is `missing`, so nothing here is
 * rendered in production until it is filled in and confirmed.
 */
const projectTemplate = (id: string, hint: string): WorkProject => ({
  id,
  name: missing('Project name', `Template. ${hint}`),
  summary: missing('One-sentence description of what the project does.', 'Template.'),
  contribution: missing(
    ['What you built or owned', 'A technical decision you made', 'How it was shipped / deployed'],
    'Template: 2–4 verified bullet points on your personal contribution.',
  ),
  stack: missing(['Technology 1', 'Technology 2'], 'Template: technologies you actually used.'),
  links: missing({}, 'Template: live / repository / demo links, only if public.'),
  publicPermission: missing(
    false,
    'Confirm the employer allows this project to be shown publicly (confidentiality).',
  ),
});

export const experience: readonly Experience[] = [
  {
    id: 'spotmies',
    organisation: fromSource('Spotmies', [SRC.resume]),
    role: fromSource('Full-Stack Developer Intern', [SRC.resume]),
    period: fromSource({ start: 'Dec 2025', end: 'Jun 2026' }, [SRC.resume]),
    summary: fromSource(
      'Built full-stack applications with React.js and Node.js, including backend APIs and frontend interfaces, and deployed them to production on Vercel and Render.',
      [SRC.resume],
      'Rephrased from the resume description (less promotional). Approve wording.',
    ),
    projects: [
      projectTemplate(
        'spotmies-project-1',
        'Possible candidate mentioned in Batch 1: MeraSports / Sports Paramount (employer not stated).',
      ),
      projectTemplate(
        'spotmies-project-2',
        'Possible candidate mentioned in Batch 1: Arcslot (employer not stated).',
      ),
    ],
  },
  {
    id: 'pit-solutions',
    organisation: fromSource('Pit Solutions', [SRC.resume]),
    role: fromSource('Frontend Development Intern', [SRC.resume]),
    period: fromSource({ start: 'Dec 2022', end: 'May 2023' }, [SRC.resume]),
    summary: fromSource(
      'Designed and built responsive client-facing dashboards with HTML, CSS, and JavaScript, working in Agile sprints with multidisciplinary teams.',
      [SRC.resume],
      'Rephrased from the resume description. Approve wording.',
    ),
    projects: [projectTemplate('pit-solutions-project-1', 'No project named in any source yet.')],
  },
];
