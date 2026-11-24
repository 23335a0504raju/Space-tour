import { confirmed, fromSource } from './fact.ts';
import { SRC } from './sources.ts';
import type { Fact } from './fact.ts';
import type { StackGroup } from './types.ts';

/**
 * Core strengths (SC06, orbital sunrise spectrum).
 * Derived from project and experience evidence, then chosen and approved by Raju (Q6 resolved,
 * 2026-11-17: all five, wording as proposed).
 */
export const strengths: Fact<readonly string[]> = confirmed(
  [
    'Full-stack web applications',
    'API and backend design',
    'Applied AI: computer vision and RAG',
    'Cloud deployment',
    'Cross-platform mobile',
  ],
  [SRC.portfolio, SRC.resume, SRC.userP4Sc06],
);

/** The current resume, then the old site. */
const R = [SRC.resume2026, SRC.portfolio];

/** Technology stack (SC09, Saturn ring bands): the current resume merged with Portfolio.jsx. */
export const stack: readonly StackGroup[] = [
  {
    id: 'languages',
    label: 'Languages',
    items: fromSource(['Java', 'Python', 'TypeScript', 'JavaScript', 'C/C++', 'SQL'], R),
  },
  {
    id: 'frontend-mobile',
    label: 'Frontend & Mobile',
    items: fromSource(
      ['React', 'React Native', 'Expo', 'Tailwind CSS', 'HTML5', 'CSS3', 'Vite'],
      R,
    ),
  },
  {
    id: 'backend',
    label: 'Backend & APIs',
    items: fromSource(['Node.js', 'Express.js', 'FastAPI', 'Django REST', 'REST APIs'], R),
  },
  {
    id: 'data-cloud',
    label: 'Data, Cloud & DevOps',
    items: fromSource(
      [
        'PostgreSQL',
        'MySQL',
        'MongoDB',
        'Redis',
        'Supabase',
        'AWS (EC2, S3, SNS, IAM)',
        'Docker',
        'Jenkins',
        'GitHub Actions',
        'Vercel',
        'Render',
        'Railway',
      ],
      [...R, SRC.userSpotmies],
      'AWS is now backed by the Spotmies cloud work (SMS, SNS, IAM) and the current resume (EC2, S3).',
    ),
  },
  {
    id: 'ai-automation',
    label: 'AI & Automation',
    items: fromSource(
      [
        'LangChain / RAG',
        'Vector databases',
        'LLM APIs (OpenRouter)',
        'YOLOv8',
        'TensorFlow',
        'scikit-learn',
        'n8n',
      ],
      R,
    ),
  },
];
