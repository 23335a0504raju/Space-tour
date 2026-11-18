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

const P = [SRC.portfolio];

/** Technology stack (SC09, Saturn ring bands), regrouped from Portfolio.jsx `techStack`. */
export const stack: readonly StackGroup[] = [
  {
    id: 'languages',
    label: 'Languages',
    items: fromSource(['Java', 'Python', 'C/C++', 'TypeScript', 'JavaScript'], P),
  },
  {
    id: 'frontend-mobile',
    label: 'Frontend & Mobile',
    items: fromSource(['HTML5', 'CSS3', 'React', 'Vite', 'React Native', 'Expo'], P),
  },
  {
    id: 'backend',
    label: 'Backend & APIs',
    items: fromSource(['Node.js', 'Express.js', 'Django REST'], P),
  },
  {
    id: 'data-cloud',
    label: 'Data & Cloud',
    items: fromSource(
      ['MySQL', 'PostgreSQL', 'MongoDB', 'Supabase', 'Vercel', 'Render', 'Docker'],
      P,
      'AWS appears in ResumeNew.jsx but in no project. Excluded unless you can support it.',
    ),
  },
  {
    id: 'ai-automation',
    label: 'AI & Automation',
    items: fromSource(
      [
        'Machine learning (TensorFlow, TensorFlow.js)',
        'YOLOv8',
        'LangChain / RAG',
        'OpenRouter API',
        'n8n',
      ],
      P,
    ),
  },
];
