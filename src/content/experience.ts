import { conflict, fromSource, missing } from './fact.ts';
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

const U = [SRC.userSpotmies];
const LATER = 'Raju will send the full brief and links later (2026-11-24).';
const permission = () =>
  missing(false, 'Confirm Spotmies allows this project to be named publicly (confidentiality).');

/**
 * Spotmies projects as Raju described them (session, 2026-11-24). Only what he said is recorded;
 * everything else stays `missing` until he sends the details.
 */
const spotmiesProjects: readonly WorkProject[] = [
  {
    id: 'sports-paramount',
    name: fromSource('Sports Paramount', U, 'Raju wrote "sportsparamount". Confirm the spelling.'),
    summary: fromSource('A sports platform.', U, `"Completely related to sports side". ${LATER}`),
    contribution: fromSource(
      [
        'Designed the complete architecture',
        'Built it end to end on my own, from the start to a fully functional product',
      ],
      U,
      'Raju: "fully handled by me, complete architecture to full functional, start to end".',
    ),
    stack: missing(['Technology 1'], `Not stated yet. ${LATER}`),
    links: missing({}, `Not stated yet. ${LATER}`),
    publicPermission: permission(),
  },
  {
    id: 'spotmies-cloud',
    name: fromSource('Cloud and AWS management', U),
    summary: fromSource('AWS messaging and access management, and internal tools.', U),
    contribution: fromSource(
      ['Managed AWS SMS, SNS and IAM', 'Built internal tools'],
      U,
      'Raju also wrote "by syncing": what was synced (accounts, data, environments)? Not added until he says.',
    ),
    stack: fromSource(['AWS SNS', 'AWS SMS', 'AWS IAM'], U),
    links: missing({}, 'Internal work: probably no public links.'),
    publicPermission: permission(),
  },
  {
    id: 'openplan-ai',
    name: fromSource('OpenPlan AI landing page', U),
    summary: missing('What OpenPlan AI is.', `Not stated yet. ${LATER}`),
    contribution: fromSource(['Built the landing page'], U, 'Confirm this was your build.'),
    stack: missing(['Technology 1'], `Not stated yet. ${LATER}`),
    links: missing({}, `Not stated yet. ${LATER}`),
    publicPermission: permission(),
  },
  {
    id: 'mutiny',
    name: fromSource('Mutiny', U),
    summary: fromSource('A social media connectivity project.', U, LATER),
    contribution: missing(['What you built'], `Not stated yet. ${LATER}`),
    stack: missing(['Technology 1'], `Not stated yet. ${LATER}`),
    links: missing({}, `Not stated yet. ${LATER}`),
    publicPermission: permission(),
  },
];

export const experience: readonly Experience[] = [
  {
    id: 'spotmies',
    organisation: fromSource('Spotmies LLP', [SRC.linkedinExperience, SRC.resume]),
    role: conflict(
      'MERN Stack Developer',
      [SRC.linkedinExperience, SRC.linkedin, SRC.resume],
      'LinkedIn experience: "Mern Stack Developer", Full-time; LinkedIn About: "Full-Stack Developer at Spotmies"; resume: "Full-Stack Developer Intern". Which title should the site show?',
    ),
    period: conflict(
      { start: 'Dec 2025', end: 'Present' },
      [SRC.linkedinExperience, SRC.resume],
      'LinkedIn: Dec 2025 – Present (full-time). Resume: Dec 2025 – Jun 2026 (intern). Confirm.',
    ),
    summary: fromSource(
      'Builds and ships full-stack features with React.js and Node.js, from API design to frontend integration: RESTful APIs used by both web and mobile apps, and production deployments on Vercel and Render.',
      [SRC.linkedinExperience, SRC.resume],
      'Rephrased from the LinkedIn description. Its "zero-downtime release strategies" claim is left out until there is evidence (decision B3-5). Approve wording.',
    ),
    responsibilities: fromSource(
      [
        'Payment handling',
        'Bug fixes',
        'Cloud and database management',
        'Git and repository management across projects',
      ],
      U,
      `Raju: "payment handlings, bug fixes, cloud, DB management, everything through projects, git managing, everything handled". ${LATER}`,
    ),
    lessons: fromSource(
      [
        'Real-time is harder than it looks: the hard part is not sending the data but handling reconnections, dropped connections and stale state.',
        'A model is only as good as its data: the algorithm is the easy 20 percent; making the data trustworthy is the other 80.',
        'Performance is a feature: caching the right things, indexing the right columns, and not asking the database the same question a hundred times.',
      ],
      [SRC.postSpotmiesLessons],
      'Condensed from Raju\'s own LinkedIn post ("Three lessons that genuinely changed how I build"). Approve wording.',
    ),
    projects: spotmiesProjects,
  },
  {
    id: 'pit-solutions',
    organisation: fromSource('PIT Solutions', [SRC.resume, SRC.linkedinExperience]),
    role: conflict(
      'Full-Stack Developer Intern',
      [SRC.linkedinExperience, SRC.resume],
      'LinkedIn: "Full Stack Developer", Internship. Resume: "Frontend Development Intern". Which title?',
    ),
    period: conflict(
      { start: 'Dec 2022', end: 'Jun 2023' },
      [SRC.linkedinExperience, SRC.resume],
      'LinkedIn: Dec 2022 – Jun 2023 (7 months). Resume: Dec 2022 – May 2023. Confirm.',
    ),
    summary: fromSource(
      'Designed and built responsive client-facing dashboards with HTML, CSS, and JavaScript, working in Agile sprints with multidisciplinary teams.',
      [SRC.resume],
      'Rephrased from the resume. LinkedIn only says "Developed a full stack web application for my internship". Approve wording.',
    ),
    projects: [
      projectTemplate(
        'pit-solutions-project-1',
        'No project named on the resume or LinkedIn (checked 2026-11-24).',
      ),
    ],
  },
];
