/**
 * Every piece of personal/professional content is wrapped in a Fact so its
 * provenance and verification status travel with it (PORTFOLIO_CONTENT_MAPPING.md).
 *
 *  confirmed  – approved by Raju for publication
 *  source     – stated consistently in the existing portfolio; awaiting final read-through
 *  conflict   – sources disagree; a decision is required
 *  unverified – present in a source but a metric/award/claim that needs evidence
 *  missing    – not available yet; `value` is a template placeholder, never published
 */
export type FactStatus = 'confirmed' | 'source' | 'conflict' | 'unverified' | 'missing';

export interface Fact<T> {
  readonly kind: 'fact';
  readonly value: T;
  readonly status: FactStatus;
  /** File paths (relative to c:\projects) or other evidence the value came from. */
  readonly source: readonly string[];
  /** Why it is not confirmed / what needs deciding. */
  readonly note?: string;
}

const make = <T>(
  value: T,
  status: FactStatus,
  source: readonly string[],
  note?: string,
): Fact<T> =>
  note === undefined
    ? { kind: 'fact', value, status, source }
    : { kind: 'fact', value, status, source, note };

/** Value stated consistently in the existing portfolio. */
export const fromSource = <T>(value: T, source: readonly string[], note?: string): Fact<T> =>
  make(value, 'source', source, note);

/** Approved by Raju. */
export const confirmed = <T>(value: T, source: readonly string[], note?: string): Fact<T> =>
  make(value, 'confirmed', source, note);

/** Sources disagree; `value` is the provisional choice. */
export const conflict = <T>(value: T, source: readonly string[], note: string): Fact<T> =>
  make(value, 'conflict', source, note);

/** Claim present in a source but needing evidence. */
export const unverified = <T>(value: T, source: readonly string[], note: string): Fact<T> =>
  make(value, 'unverified', source, note);

/** Placeholder to be filled later. Never rendered in production. */
export const missing = <T>(placeholder: T, note: string): Fact<T> =>
  make(placeholder, 'missing', [], note);

export const isFact = (x: unknown): x is Fact<unknown> =>
  typeof x === 'object' && x !== null && (x as { kind?: unknown }).kind === 'fact';

/** Whether a fact may be shown to visitors in a production build. */
export const isPublishable = (fact: Fact<unknown>): boolean => fact.status !== 'missing';
