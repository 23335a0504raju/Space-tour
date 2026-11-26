import { useState } from 'react';
import { content } from '../content/index.ts';
import { FactText, shouldShow } from './FactText.tsx';
import styles from './ContactPanel.module.css';

const { identity, contact } = content;

interface Props {
  /** Heading level for the name, so the panel fits the host page's outline. */
  readonly headingLevel?: 2 | 3;
  readonly id?: string;
  /** The SC13 card: the name as a large two-line title (first name, then last name fading out). */
  readonly display?: boolean;
}

/**
 * The one contact component used by the journey's contact overlay, the SC13 ending
 * and the Mission Brief (CONTACT_EXPERIENCE.md §2), so they can never disagree.
 */
export function ContactPanel({ headingLevel = 2, id, display = false }: Props) {
  const [copied, setCopied] = useState(false);
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const email = contact.email.value;
  const [first = '', ...rest] = identity.name.value.split(' ');
  const last = rest.join(' ');

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section
      className={display ? `${styles.panel} ${styles.cardMode}` : styles.panel}
      aria-labelledby={id ? `${id}-title` : undefined}
    >
      <p className={styles.kicker}>Open channel</p>
      {display ? (
        <Heading id={id ? `${id}-title` : undefined} className={styles.display}>
          <FactText fact={identity.name}>
            <span className={styles.first}>{first}</span>{' '}
            <span className={styles.last}>
              {last}
              <span aria-hidden="true">.</span>
            </span>
          </FactText>
        </Heading>
      ) : (
        <Heading id={id ? `${id}-title` : undefined} className={styles.name}>
          <FactText fact={identity.name} />
        </Heading>
      )}
      <p className={styles.role}>
        <FactText fact={identity.role} />
      </p>
      {shouldShow(identity.availability) && (
        <p className={styles.availability}>
          <FactText fact={identity.availability} />
        </p>
      )}

      <div className={styles.primary}>
        <a className={styles.button} href={`mailto:${email}`}>
          Email <FactText fact={contact.email} />
        </a>
        <button type="button" className={styles.ghost} onClick={copyEmail}>
          Copy email
        </button>
        {shouldShow(contact.resumeUrl) && (
          <a className={styles.button} href={contact.resumeUrl.value} download>
            <FactText fact={contact.resumeUrl}>Download resume</FactText>
          </a>
        )}
      </div>

      <ul className={styles.links}>
        {contact.links
          .filter((l) => shouldShow(l.href))
          .map((link) => (
            <li key={link.id}>
              <a href={link.href.value} target="_blank" rel="noopener noreferrer">
                <FactText fact={link.href}>{link.label}</FactText>
              </a>
            </li>
          ))}
      </ul>

      <p className={styles.location}>
        <FactText fact={identity.location} />
      </p>

      <p className="visually-hidden" aria-live="polite">
        {copied ? 'Email address copied' : ''}
      </p>
    </section>
  );
}
