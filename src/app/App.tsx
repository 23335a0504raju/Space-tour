import { lazy, Suspense, useRef } from 'react';
import { content } from '../content/index.ts';
import { useJourneyStore } from '../engine/store.ts';
import { ContactPanel } from '../ui/ContactPanel.tsx';
import { ProjectBay } from '../ui/ProjectBay.tsx';
import { StartGate } from '../ui/StartGate.tsx';
import { FactText, shouldShow } from '../ui/FactText.tsx';
import styles from './App.module.css';

// The WebGL journey (three, drei, every chapter) loads after first paint, so the header,
// start gate and Mission Brief link never wait on it.
const Journey = lazy(() =>
  import('../engine/journey/Journey.tsx').then((m) => ({ default: m.Journey })),
);

const { identity, contact } = content;

/**
 * Journey page: persistent UI (always reachable, from the first frame) + the cinematic journey
 * + the contact sheet. Name, role, Projects, Resume, Contact and Mission Brief never require
 * finishing the journey (FINAL_STORYLINE.md SC01).
 */
export function App() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const navigate = useJourneyStore((s) => s.navigate);

  return (
    <>
      <header className={styles.bar}>
        {/* Inside the header landmark (axe: region); it links to another page, so it is not an in-page skip link. */}
        <a className="skip-link" href="/brief/">
          Skip to Mission Brief
        </a>
        <h1 className={styles.identity}>
          <span className={styles.name}>
            <FactText fact={identity.name} />
          </span>
          <span className={styles.role}>
            <FactText fact={identity.role} />
          </span>
        </h1>
        <nav aria-label="Primary" className={styles.actions}>
          {navigate ? (
            <button type="button" onClick={() => navigate('sc08-jupiter')}>
              Projects
            </button>
          ) : (
            <a href="/brief/#projects">Projects</a>
          )}
          {shouldShow(contact.resumeUrl) && (
            <a href={contact.resumeUrl.value} download>
              <FactText fact={contact.resumeUrl}>Resume</FactText>
            </a>
          )}
          <button type="button" onClick={() => dialogRef.current?.showModal()}>
            Contact
          </button>
          <a href="/brief/">Mission Brief</a>
        </nav>
      </header>

      <Suspense fallback={<main aria-busy="true" aria-label="Loading the journey" />}>
        <Journey />
      </Suspense>
      <StartGate />
      <ProjectBay />

      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-label="Contact"
        onClick={(e) => {
          // A click on the backdrop (the dialog element itself) closes it.
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
      >
        <div className={styles.dialogBody}>
          <ContactPanel id="contact-sheet" />
          <form method="dialog">
            <button type="submit" className={styles.close}>
              Close
            </button>
          </form>
        </div>
      </dialog>
    </>
  );
}
