import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { headerTarget, sectionIndexFor, sections } from '../chapters/sections.ts';
import type { HeaderItem } from '../chapters/sections.ts';
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

/** Section links (Contact opens the sheet instead). `brief` is the no-journey fallback. */
const NAV: ReadonlyArray<{ item: HeaderItem; label: string; brief: string }> = [
  { item: 'about', label: 'About', brief: '/brief/' },
  { item: 'experience', label: 'Experience', brief: '/brief/#experience' },
  { item: 'projects', label: 'Projects', brief: '/brief/#projects' },
];

/** "Raju Chowdavada" → "Raju" (the brand mark is the given name from the confirmed fact). */
const brand = identity.name.value.split(' ')[0] ?? identity.name.value;

/**
 * The gold indicator under the active link: placed from the active button's own box, so it fits
 * every label exactly. Runs on the discrete active change (and on resize), never per frame.
 */
function useIndicator(active: HeaderItem | null) {
  const group = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const place = () => {
      const g = group.current;
      const b = bar.current;
      if (!g || !b) return;
      const el = active ? g.querySelector<HTMLElement>(`[data-item="${active}"]`) : null;
      if (!el) {
        b.style.opacity = '0';
        return;
      }
      b.style.opacity = '1';
      b.style.width = `${el.offsetWidth}px`;
      b.style.transform = `translateX(${el.offsetLeft}px)`;
    };
    place();
    // fonts arrive after first paint and change the label widths
    void document.fonts?.ready.then(place);
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [active]);
  return { group, bar };
}

/**
 * Journey page: persistent UI (always reachable, from the first frame) + the cinematic journey
 * + the contact sheet. Name, role, Projects, Resume, Contact and Mission Brief never require
 * finishing the journey (FINAL_STORYLINE.md SC01).
 */
export function App() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const navigate = useJourneyStore((s) => s.navigate);
  // discrete: changes once per chapter, never per frame
  const active = useJourneyStore((s) => sections[sectionIndexFor(s.activeIndex)]?.header ?? null);
  const { group: navGroup, bar: navBar } = useIndicator(active);
  const [menuOpen, setMenuOpen] = useState(false);
  // the phone menu: Escape closes it; the page does not scroll behind it
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    document.documentElement.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.documentElement.style.overflow = '';
    };
  }, [menuOpen]);

  return (
    <>
      <header className={styles.bar} data-menu={menuOpen || undefined}>
        {/* Inside the header landmark (axe: region); it links to another page, so it is not an in-page skip link. */}
        <a className="skip-link" href="/brief/">
          Skip to Mission Brief
        </a>
        <h1 className={styles.identity}>
          <span className={styles.name}>
            <FactText fact={identity.name}>{brand}</FactText>
            <span className={styles.dot} aria-hidden="true">
              .
            </span>
            <span className="visually-hidden"> {identity.name.value.slice(brand.length)}</span>
          </span>
          <span className={styles.role}>
            <FactText fact={identity.shortRole} />
          </span>
        </h1>
        <button
          type="button"
          className={styles.menuToggle}
          aria-expanded={menuOpen}
          aria-controls="primary-nav"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span className="visually-hidden">{menuOpen ? 'Close menu' : 'Menu'}</span>
          <span className={styles.burger} aria-hidden="true" />
        </button>
        <nav aria-label="Primary" id="primary-nav" className={styles.nav}>
          <div className={styles.links} ref={navGroup}>
            <span className={styles.indicator} ref={navBar} aria-hidden="true" />
            {NAV.map(({ item, label, brief }) => {
              const target = headerTarget(item);
              const current = active === item ? ('location' as const) : undefined;
              return navigate && target ? (
                <button
                  key={item}
                  type="button"
                  data-item={item}
                  aria-current={current}
                  onClick={() => {
                    setMenuOpen(false);
                    navigate(target);
                  }}
                >
                  {label}
                </button>
              ) : (
                <a key={item} href={brief} data-item={item} aria-current={current}>
                  {label}
                </a>
              );
            })}
            <button
              type="button"
              data-item="contact"
              aria-current={active === 'contact' ? 'location' : undefined}
              onClick={() => {
                setMenuOpen(false);
                dialogRef.current?.showModal();
              }}
            >
              Contact
            </button>
          </div>
          <div className={styles.end}>
            {shouldShow(contact.resumeUrl) && (
              <a className={styles.pill} href={contact.resumeUrl.value} download>
                <FactText fact={contact.resumeUrl}>Resume</FactText>
              </a>
            )}
            {/* the Resume pill's place until the resume link exists (Q5) */}
            <a
              className={shouldShow(contact.resumeUrl) ? styles.quiet : styles.pill}
              href="/brief/"
            >
              Mission Brief
            </a>
          </div>
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
