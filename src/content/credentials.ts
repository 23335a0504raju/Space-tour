import { confirmed, fromSource } from './fact.ts';
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
    {
      name: 'Cloud Computing: Distributed Systems & Reliability (84%)',
      issuer: 'NPTEL',
      year: '2024',
    },
    { name: 'Python Essentials 1 & 2', issuer: 'Cisco', year: '2024' },
  ],
  [SRC.resume2026, SRC.resume, SRC.linkedinCertifications],
  'Deloitte simulations: LinkedIn, issued Jul 2025 (credential ID za8Qenw9cDxXJhyoH) and Jun 2025 (yuiNqJkzirAWvQcZr). The others are from the resume and are not on LinkedIn. Credential URLs not in any source.',
);

/** Course completions (Udemy certificates posted on LinkedIn). Mission Brief only. */
export const courses: Fact<readonly Certification[]> = fromSource(
  [
    {
      name: 'Master RAG: Retrieval-Augmented Generation',
      issuer: 'Udemy / TCS',
      year: '2026',
    },
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
  [SRC.postCourses, SRC.resume2026],
  "Master RAG is on the current resume; the rest are Raju's LinkedIn certificate posts (years from their ages on 2026-11-24).",
);

/**
 * Achievements: every one needs evidence (Q7). Unverified metrics from the old site
 * ("+25% API speed", "99.9% uptime") are deliberately NOT included (decision B3-5).
 */
export const achievements: readonly Fact<string>[] = [
  confirmed(
    'Hackathon finalist: built a blogging platform with authentication and role-based access in under 24 hours',
    [SRC.userAnswers, SRC.resume2026, SRC.portfolio],
    'Raju, 2026-11-24: publish it, no proof required. Event name not given.',
  ),
  confirmed(
    'Solved 450+ problems on LeetCode and CodeChef',
    [SRC.userAnswers, SRC.resume2026, SRC.linkedin],
    'Raju, 2026-11-24: publish it, no proof required (LeetCode alone shows 243).',
  ),
  fromSource(
    'Reduced the Stash Android APK from 218 MB to about 29 MB',
    [SRC.postStash, SRC.portfolio],
    'From the Stash post by Raju: "My first Android build was a hefty 218 MB" … "the shareable APK dropped to ~29 MB" (ARM64-only, R8 shrinking and minification).',
  ),
];

export const learning: Fact<string> = fromSource(
  'Retrieval-augmented generation, from RAG pipelines to agentic RAG with LangGraph, and the software engineering underneath: architecture, design and modularity.',
  [SRC.postAgenticRag, SRC.postCourses, SRC.resume2026, SRC.userAnswers],
  'From the RAG and Software Engineering 101 certificates and posts, which he pointed to (2026-11-24). Approve wording.',
);

export const futureDirection: Fact<string> = confirmed(
  'Becoming a full-stack, AI and Java developer.',
  [SRC.userAnswers],
  'Raju, 2026-11-24: "I am going to become full stack, AI and Java developer".',
);
