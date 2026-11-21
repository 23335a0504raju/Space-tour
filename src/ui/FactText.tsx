import type { ReactNode } from 'react';
import { isPublishable } from '../content/index.ts';
import type { Fact } from '../content/index.ts';
import styles from './FactText.module.css';

const DEV = import.meta.env.DEV;
/**
 * The dotted "unconfirmed" markers are opt-in (`?flags` in the URL): on by default they covered the
 * hero in development and hid the real typography (review 2026-11-21). Production never shows them.
 */
const MARK =
  DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('flags');

/** Whether a fact should be rendered: production hides templates; development shows everything. */
export const shouldShow = (fact: Fact<unknown>): boolean => DEV || isPublishable(fact);

interface Props {
  readonly fact: Fact<unknown>;
  readonly children?: ReactNode;
}

/**
 * Renders a fact's text. In development, unconfirmed facts get a dotted marker
 * and a tooltip with their status and note, so nothing unverified slips through unnoticed.
 */
export function FactText({ fact, children }: Props) {
  if (!shouldShow(fact)) return null;
  const body = children ?? String(fact.value);
  if (!MARK || fact.status === 'confirmed') return <>{body}</>;
  return (
    <span
      className={styles.flag}
      data-status={fact.status}
      title={`[${fact.status}] ${fact.note ?? ''}`.trim()}
    >
      {body}
    </span>
  );
}
