import { fromSource, missing, unverified } from './fact.ts';
import { SRC } from './sources.ts';
import type { Fact } from './fact.ts';
import type { Certification } from './types.ts';

export const certifications: Fact<readonly Certification[]> = fromSource(
  [
    { name: 'Java Full Stack Developer', issuer: 'Wipro', year: '2025' },
    { name: 'Digital Business Skills', issuer: 'HP', year: '2025' },
    { name: 'GenAI Data Analytics Simulation', issuer: 'Tata iQ', year: '2025' },
    { name: 'AWS Solutions Architecture', issuer: 'Forage', year: '2024' },
    { name: 'Cloud Computing (84%)', issuer: 'NPTEL', year: '2024' },
    { name: 'Python Essentials 1 & 2', issuer: 'Cisco', year: '2024' },
  ],
  [SRC.resume],
  'Credential URLs not in source. Add if available.',
);

/**
 * Achievements: every one needs evidence (Q7). Unverified metrics from the old site
 * ("+25% API speed", "99.9% uptime") are deliberately NOT included (decision B3-5).
 */
export const achievements: readonly Fact<string>[] = [
  unverified(
    'Hackathon finalist: built a blogging platform with authentication and role-based access in under 24 hours',
    [SRC.portfolio],
    'Which hackathon? Is it the same event as the Fitness Tracker hackathon?',
  ),
  unverified(
    'Solved 450+ problems on LeetCode and CodeChef',
    [SRC.portfolio, SRC.resume],
    'Confirm the current count.',
  ),
  unverified(
    'Reduced the Stash Android APK from 218 MB to 29 MB',
    [SRC.portfolio],
    'Specific and plausible. Confirm before use.',
  ),
];

export const learning: Fact<string> = missing(
  'What you are learning right now.',
  'Not in any source. Write it for anime-universe area C (Q8).',
);

export const futureDirection: Fact<string> = missing(
  'The kind of engineering work you want to do next.',
  'Not in any source. Write it for anime-universe area C (Q8).',
);
