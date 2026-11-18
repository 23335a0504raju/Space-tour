import type { ReactNode } from 'react';
import { isPublishable } from '../content/index.ts';
import type { Fact } from '../content/index.ts';
import styles from './FactText.module.css';

const DEV = import.meta.env.DEV;

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
  if (!DEV || fact.status === 'confirmed') return <>{body}</>;
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
