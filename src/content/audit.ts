import { isFact } from './fact.ts';
import type { Fact, FactStatus } from './fact.ts';

export interface AuditEntry {
  readonly path: string;
  readonly fact: Fact<unknown>;
}

/** Walk any content tree and return every Fact with its dotted path. */
export function collectFacts(node: unknown, path = 'content'): AuditEntry[] {
  if (isFact(node)) return [{ path, fact: node }];
  if (Array.isArray(node)) {
    return node.flatMap((child, i) => {
      const id = (child as { id?: unknown } | null)?.id;
      return collectFacts(child, `${path}[${typeof id === 'string' ? id : i}]`);
    });
  }
  if (typeof node === 'object' && node !== null) {
    return Object.entries(node).flatMap(([key, child]) => collectFacts(child, `${path}.${key}`));
  }
  return [];
}

export function countByStatus(entries: readonly AuditEntry[]): Record<FactStatus, number> {
  const counts: Record<FactStatus, number> = {
    confirmed: 0,
    source: 0,
    conflict: 0,
    unverified: 0,
    missing: 0,
  };
  for (const { fact } of entries) counts[fact.status] += 1;
  return counts;
}
