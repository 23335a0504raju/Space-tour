import { useEffect, useRef } from 'react';
import { projects } from '../content/projects.ts';
import { useJourneyStore } from '../engine/store.ts';
import { FactText, shouldShow } from './FactText.tsx';
import styles from './ProjectBay.module.css';

/**
 * Re-encoded project images (npm run assets:projects). File names are not personal content; what
 * the image shows is the project's own `image` fact. Projects without a file simply show no media.
 */
const MEDIA: Readonly<Record<string, string>> = {
  'smartway-traffic': '/assets/projects/smartway-traffic.webp',
  documentdb: '/assets/projects/documentdb.webp',
  stash: '/assets/projects/stash.webp',
};

const LINKS = { live: 'Live', code: 'Code', demo: 'Demo' } as const;

/**
 * Project Bay (PROJECT_PRESENTATION_PLAN.md §5). A native modal <dialog>: focus is trapped, Esc
 * closes, focus returns to the opener, the background is inert. The page never scrolls while it is
 * open (the dialog fills the viewport and contains its own scroll), and the scroll position is
 * restored exactly on close, so the visitor lands on the same journey frame.
 */
export function ProjectBay() {
  const id = useJourneyStore((s) => s.bayProject);
  const closeBay = useJourneyStore((s) => s.closeBay);
  const ref = useRef<HTMLDialogElement>(null);
  const savedY = useRef(0);
  const project = id ? projects.find((p) => p.id === id) : undefined;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (project && !dialog.open) {
      savedY.current = window.scrollY;
      dialog.showModal();
    }
    if (!project && dialog.open) dialog.close();
  }, [project]);

  const onClose = () => {
    // closed by Esc, the Close button or the backdrop: sync the store and restore the frame
    closeBay();
    window.scrollTo({ top: savedY.current, behavior: 'instant' });
  };

  const media = project ? MEDIA[project.id] : undefined;
  const links = project && shouldShow(project.links) ? project.links.value : {};
  const linkEntries = Object.entries(links).filter(([k]) => k in LINKS) as Array<
    [keyof typeof LINKS, string]
  >;

  return (
    <dialog
      ref={ref}
      className={styles.bay}
      aria-labelledby="bay-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
    >
      {project && (
        <article className={styles.sheet}>
          <header className={styles.head}>
            <p className={styles.kicker}>Project Bay</p>
            <h2 id="bay-title" className={styles.title}>
              <FactText fact={project.name} />
            </h2>
            <p className={styles.role}>
              <FactText fact={project.role} />
            </p>
            <p className={styles.lead}>
              <FactText fact={project.summary} />
            </p>
          </header>

          {media && (
            <figure className={styles.media}>
              <img
                src={media}
                alt={`Interface of ${project.name.value}`}
                loading="lazy"
                decoding="async"
              />
            </figure>
          )}

          <div className={styles.cols}>
            {shouldShow(project.features) && (
              <section aria-labelledby="bay-does">
                <h3 id="bay-does" className={styles.label}>
                  What it does
                </h3>
                <ul className={styles.list}>
                  {project.features.value.map((f) => (
                    <li key={f}>
                      <FactText fact={project.features}>{f}</FactText>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section aria-labelledby="bay-built">
              <h3 id="bay-built" className={styles.label}>
                How it&apos;s built
              </h3>
              <ul className={styles.chips}>
                {project.stack.value.map((s) => (
                  <li key={s}>
                    <FactText fact={project.stack}>{s}</FactText>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <footer className={styles.foot}>
            {linkEntries.length > 0 && (
              <p className={styles.links}>
                {linkEntries.map(([k, href]) => (
                  <a key={k} href={href} target="_blank" rel="noopener noreferrer">
                    {LINKS[k]}
                  </a>
                ))}
              </p>
            )}
            <button type="button" className={styles.close} onClick={() => ref.current?.close()}>
              Close · Esc
            </button>
          </footer>
        </article>
      )}
    </dialog>
  );
}
