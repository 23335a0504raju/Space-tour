import { confirmed, conflict, fromSource, missing } from './fact.ts';
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
const A = [SRC.userAnswers];
/** Raju, 2026-11-24: "yes no issue, under Spotmies mention them". */
const permission = () => confirmed(true, A, 'Raju confirmed these may be named under Spotmies.');

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
      [
        'Worked with AWS end to end: SMS, SNS and IAM',
        'Connected the services and kept them working',
        'Built internal tools',
      ],
      [...U, ...A],
      'Raju: "in cloud I completely worked with AWS, SMS, SNS, IAM connectivity and working".',
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
    role: confirmed(
      'Full-Stack Developer',
      [...A, SRC.resume2026, SRC.linkedin],
      'Raju chose "Full stack developer" (2026-11-24). LinkedIn experience says "Mern Stack Developer".',
    ),
    period: conflict(
      { start: 'Dec 2025', end: 'Present' },
      [SRC.linkedinExperience, SRC.resume2026],
      'Still open: LinkedIn says Dec 2025 – Present (full-time); the current resume says Dec 2025 – Jun 2026 (intern). Are you still at Spotmies?',
    ),
    summary: fromSource(
      'Builds and ships full-stack features with React.js and Node.js, from API design to frontend integration: RESTful APIs used by both web and mobile apps, and production deployments on Vercel and Render.',
      [SRC.linkedinExperience, SRC.resume],
      'Rephrased from the LinkedIn description. Its "zero-downtime release strategies" claim is left out until there is evidence (decision B3-5). Approve wording.',
    ),
    responsibilities: fromSource(
      [
        'Integrated Redis for API response caching, session storage and rate limiting, cutting average API response time by about 20–40%',
        'Raised test coverage from about 30% to 60% with JUnit/TestNG unit and integration tests and Postman API checks',
        'Containerised services with Docker and automated builds and deployments with Jenkins and GitHub Actions',
        'Payment handling, bug fixes, and cloud and database management',
        'Git and repository management across projects',
        'Agile/Scrum: sprint planning, daily stand-ups and code reviews',
      ],
      [...U, SRC.resume2026, ...A],
      `Raju's message and the current resume's Spotmies bullets; the metrics are the resume's own, published on Raju's word ("no proof required", 2026-11-24). ${LATER}`,
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
    role: confirmed(
      'Frontend Developer Intern',
      [...A, SRC.resume2026, SRC.linkedinExperience],
      'Raju chose "frontend developer" (2026-11-24); the resume and LinkedIn both say it was an internship.',
    ),
    period: fromSource(
      { start: 'Dec 2022', end: 'May 2023' },
      [SRC.resume2026, SRC.resume],
      'The current resume. LinkedIn says Jun 2023.',
    ),
    summary: fromSource(
      'Built 5+ responsive frontend modules for client dashboards with React.js and JavaScript, integrating REST APIs and using Git for version control.',
      [SRC.resume2026],
      'From the current resume.',
    ),
    projects: [
      projectTemplate(
        'pit-solutions-project-1',
        'No project named on the resume or LinkedIn (checked 2026-11-24).',
      ),
    ],
  },
];
