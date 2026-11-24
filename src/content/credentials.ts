import { fromSource, unverified } from './fact.ts';
import { SRC } from './sources.ts';
import type { Fact } from './fact.ts';
import type { Certification } from './types.ts';

/** Newest first; the SC11-A panel shows the first six, the Mission Brief all of them. */
export const certifications: Fact<readonly Certification[]> = fromSource(
  [
    { name: 'Deloitte Australia: Data Analytics Job Simulation', issuer: 'Forage', year: '2025' },
    { name: 'Deloitte Australia: Technology Job Simulation', issuer: 'Forage', year: '2025' },
    { name: 'Java Full Stack Developer', issuer: 'Wipro', year: '2025' },
    { name: 'Digital Business Skills', issuer: 'HP', year: '2025' },
    { name: 'GenAI Data Analytics Simulation', issuer: 'Tata iQ', year: '2025' },
    { name: 'AWS Solutions Architecture', issuer: 'Forage', year: '2024' },
    { name: 'Cloud Computing (84%)', issuer: 'NPTEL', year: '2024' },
    { name: 'Python Essentials 1 & 2', issuer: 'Cisco', year: '2024' },
  ],
  [SRC.resume, SRC.linkedinCertifications],
  'Deloitte simulations: LinkedIn, issued Jul 2025 (credential ID za8Qenw9cDxXJhyoH) and Jun 2025 (yuiNqJkzirAWvQcZr). The others are from the resume and are not on LinkedIn. Credential URLs not in any source.',
);

/** Course completions (Udemy certificates posted on LinkedIn). Mission Brief only. */
export const courses: Fact<readonly Certification[]> = fromSource(
  [
    {
      name: 'Software Engineering 101: Plan and Execute Better Software',
      issuer: 'Udemy',
      year: '2026',
    },
    {
      name: 'Generative AI for Beginners: Fundamentals, Tools & Prompts',
      issuer: 'Udemy',
      year: '2026',
    },
    { name: 'AI for Every Employee: Understanding and Using AI', issuer: 'Udemy', year: '2026' },
    { name: 'Complete Data Privacy (GDPR) Fundamentals', issuer: 'Udemy', year: '2026' },
  ],
  [SRC.postCourses],
  "Years from the posts' ages on 2026-11-24 (6 hours to 2 months old). The Agentic RAG course is not named in its post, so it is not listed.",
);

/**
 * Achievements: every one needs evidence (Q7). Unverified metrics from the old site
 * ("+25% API speed", "99.9% uptime") are deliberately NOT included (decision B3-5).
 */
export const achievements: readonly Fact<string>[] = [
  unverified(
    'Hackathon finalist: built a blogging platform with authentication and role-based access in under 24 hours',
    [SRC.portfolio],
    'Not on LinkedIn (checked 2026-11-24). Which hackathon, and when? Is it the same event as the Fitness Tracker hackathon?',
  ),
  unverified(
    'Solved 450+ problems on LeetCode and CodeChef',
    [SRC.portfolio, SRC.resume, SRC.linkedin, SRC.linkedinFeatured],
    'LinkedIn says 450+ too, but LeetCode shows 243 solved (2026-11-24) and no CodeChef profile is linked anywhere. Share the CodeChef profile, or lower the number.',
  ),
  fromSource(
    'Reduced the Stash Android APK from 218 MB to about 29 MB',
    [SRC.postStash, SRC.portfolio],
    'Raju\'s Stash post: "My first Android build was a hefty 218 MB" … "the shareable APK dropped to ~29 MB" (ARM64-only, R8 shrinking and minification).',
  ),
];

export const learning: Fact<string> = fromSource(
  'Agentic RAG with LangGraph: workflows that check what they retrieve, rewrite the question, call tools and route themselves, instead of a fixed retrieve-then-generate pipeline.',
  [SRC.postAgenticRag, SRC.postCourses],
  'From Raju\'s LinkedIn post "Exploring Agentic RAG with LangGraph" (about 2 months before 2026-11-24). Approve wording, or write it yourself (Q8).',
);

export const futureDirection: Fact<string> = fromSource(
  'Building real-time backend systems with teams that value ownership, move fast, and care about what happens after merge.',
  [SRC.linkedin],
  'Combined from the LinkedIn About ("production-grade, real-time backend systems"; "teams that value ownership, move fast, and care about what happens after merge"). Approve wording, or write it yourself (Q8).',
);
