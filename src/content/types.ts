import type { Fact } from './fact.ts';

export interface Identity {
  readonly name: Fact<string>;
  readonly role: Fact<string>;
  /** Opening hook line (copy approved by Raju, not a factual claim). */
  readonly tagline: Fact<string>;
  readonly summary: Fact<string>;
  readonly location: Fact<string>;
  readonly availability: Fact<string>;
}

export interface Period {
  /** Display form, e.g. "Dec 2025". */
  readonly start: string;
  readonly end: string;
}

export interface ProjectLinks {
  readonly live?: string;
  readonly code?: string;
  readonly demo?: string;
  readonly docs?: string;
}

/** A project carried out as part of a job/internship. */
export interface WorkProject {
  readonly id: string;
  readonly name: Fact<string>;
  readonly summary: Fact<string>;
  /** What Raju personally did. */
  readonly contribution: Fact<readonly string[]>;
  readonly stack: Fact<readonly string[]>;
  readonly links: Fact<ProjectLinks>;
  /** Whether the employer allows it to be shown publicly. */
  readonly publicPermission: Fact<boolean>;
}

export interface Experience {
  readonly id: string;
  readonly organisation: Fact<string>;
  readonly role: Fact<string>;
  readonly period: Fact<Period>;
  readonly summary: Fact<string>;
  readonly projects: readonly WorkProject[];
}

export interface Education {
  readonly id: string;
  readonly qualification: Fact<string>;
  readonly institution: Fact<string>;
  readonly period: Fact<Period>;
  readonly grade: Fact<string>;
  /** Where it appears: the journey's Crew Record, or the Brief only. */
  readonly placement: 'journey' | 'brief-only';
}

/** PROJECT_PRESENTATION_PLAN.md §4 */
export type ProjectTier = 'diorama' | 'architecture' | 'dossier' | 'brief-only' | 'excluded';

export interface Project {
  readonly id: string;
  readonly tier: ProjectTier;
  readonly name: Fact<string>;
  readonly summary: Fact<string>;
  readonly role: Fact<string>;
  readonly stack: Fact<readonly string[]>;
  readonly features: Fact<readonly string[]>;
  readonly links: Fact<ProjectLinks>;
  /** Screenshot in the old repo; migrated + re-encoded later. */
  readonly image: Fact<string>;
}

export interface StackGroup {
  readonly id: string;
  readonly label: string;
  readonly items: Fact<readonly string[]>;
}

export interface Certification {
  readonly name: string;
  readonly issuer: string;
  readonly year: string;
}

export interface ContactLink {
  readonly id: 'github' | 'linkedin' | 'leetcode';
  readonly label: string;
  readonly href: Fact<string>;
}

export interface Contact {
  readonly email: Fact<string>;
  readonly resumeUrl: Fact<string>;
  readonly links: readonly ContactLink[];
}

export interface PortfolioContent {
  readonly identity: Identity;
  readonly experience: readonly Experience[];
  readonly education: readonly Education[];
  readonly strengths: Fact<readonly string[]>;
  readonly stack: readonly StackGroup[];
  readonly projects: readonly Project[];
  readonly certifications: Fact<readonly Certification[]>;
  readonly achievements: readonly Fact<string>[];
  readonly learning: Fact<string>;
  readonly futureDirection: Fact<string>;
  readonly contact: Contact;
}
