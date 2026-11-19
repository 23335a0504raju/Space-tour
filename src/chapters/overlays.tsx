import type { ReactNode } from 'react';
import { content } from '../content/index.ts';
import type { Project } from '../content/index.ts';
import { useJourneyStore } from '../engine/store.ts';
import { ContactPanel } from '../ui/ContactPanel.tsx';
import { FactText, shouldShow } from '../ui/FactText.tsx';
import styles from './overlays.module.css';

/**
 * Text shown at chapter rest points (SCROLL_EXPERIENCE_MAP.md). Real DOM, so it stays crisp,
 * selectable and readable by assistive tech. All text comes from src/content.
 */
export interface OverlayDef {
  readonly key: string;
  readonly chapterId: string;
  readonly rest: number;
  readonly placement: 'center' | 'left' | 'right' | 'bottom';
  /** 'editorial': large type straight over the scene on a soft vignette, no panel box. */
  readonly variant?: 'editorial';
  /** Half-width of the readable band around the rest point, in local t (default 0.12). */
  readonly band?: number;
  readonly label: string;
  readonly holdToEnd?: boolean;
  /** When false the panel is left out entirely (e.g. its facts are not confirmed yet). */
  readonly available?: () => boolean;
  readonly render: () => ReactNode;
}

const {
  identity,
  experience,
  education,
  strengths,
  stack,
  projects,
  certifications,
  achievements,
} = content;

const LINKS = { live: 'Live', code: 'Code', demo: 'Demo', docs: 'Docs' } as const;

function ProjectLinks({ project }: { project: Project }) {
  if (!shouldShow(project.links)) return null;
  const entries = Object.entries(project.links.value) as Array<[keyof typeof LINKS, string]>;
  return (
    <p className={styles.links}>
      {entries
        .filter(([k]) => k !== 'docs')
        .map(([k, href]) => (
          <a key={k} href={href} target="_blank" rel="noopener noreferrer">
            {LINKS[k]}
          </a>
        ))}
      <a href={`/brief/#projects`}>Details</a>
    </p>
  );
}

function Kicker({ children }: { children: ReactNode }) {
  return <p className={styles.kicker}>{children}</p>;
}

const flagships = projects.filter((p) => p.tier === 'diorama' || p.tier === 'architecture');
const supporting = projects.filter((p) => p.tier === 'dossier');

const allOverlayDefs: readonly OverlayDef[] = [
  {
    // The introduction: who, what, and the two ways on (UI_SCROLL_AUDIT.md §5). The summary used
    // to follow alone in SC03; it lives here now so the opening says everything at once.
    key: 'title',
    chapterId: 'sc02-room',
    rest: 0.6,
    band: 0.25,
    placement: 'left',
    variant: 'editorial',
    label: 'Introduction',
    render: () => (
      <>
        <Kicker>Mission 001 · Origin</Kicker>
        <h2 className={styles.display}>
          <FactText fact={identity.name} />
        </h2>
        <p className={styles.role}>
          <FactText fact={identity.role} />
        </p>
        <p className={styles.lead}>
          <FactText fact={identity.summary} />
        </p>
        <p className={styles.ctas}>
          <button
            type="button"
            className={styles.bay}
            onClick={() => useJourneyStore.getState().navigate?.('sc08-jupiter')}
          >
            Explore projects
          </button>
          <a className={styles.ghost} href="/brief/">
            Mission Brief
          </a>
        </p>
      </>
    ),
  },
  {
    key: 'experience',
    chapterId: 'sc04-crew-record',
    rest: 0.35,
    placement: 'right',
    label: 'Experience',
    render: () => (
      <>
        <Kicker>Crew record · Experience</Kicker>
        <ol className={styles.record}>
          {experience.map((job) => (
            <li key={job.id}>
              <h3>
                <FactText fact={job.role} />
              </h3>
              <p className={styles.meta}>
                <FactText fact={job.organisation} /> ·{' '}
                <FactText fact={job.period}>
                  {job.period.value.start} – {job.period.value.end}
                </FactText>
              </p>
              <p>
                <FactText fact={job.summary} />
              </p>
            </li>
          ))}
        </ol>
      </>
    ),
  },
  {
    key: 'education',
    chapterId: 'sc04-crew-record',
    rest: 0.7,
    placement: 'left',
    label: 'Education',
    render: () => (
      <>
        <Kicker>Crew record · Education</Kicker>
        <ol className={styles.record}>
          {education
            .filter((e) => e.placement === 'journey')
            .map((e) => (
              <li key={e.id}>
                <h3>
                  <FactText fact={e.qualification} />
                </h3>
                <p className={styles.meta}>
                  <FactText fact={e.institution} /> ·{' '}
                  <FactText fact={e.period}>
                    {e.period.value.start} – {e.period.value.end}
                  </FactText>{' '}
                  · <FactText fact={e.grade} />
                </p>
              </li>
            ))}
        </ol>
      </>
    ),
  },
  {
    key: 'strengths',
    chapterId: 'sc06-sunrise',
    rest: 0.7,
    placement: 'bottom',
    label: 'Core strengths',
    render: () => (
      <>
        <Kicker>You can tell what a star is made of by its light</Kicker>
        <div className={styles.spectrum} aria-hidden="true" />
        <ul className={styles.lines}>
          {strengths.value.map((s) => (
            <li key={s}>
              <FactText fact={strengths}>{s}</FactText>
            </li>
          ))}
        </ul>
      </>
    ),
  },
  {
    key: 'supporting',
    chapterId: 'sc07-outbound',
    rest: 0.8,
    placement: 'right',
    label: 'More projects',
    render: () => (
      <>
        <Kicker>Beacons in the belt · More projects</Kicker>
        <ul className={styles.beacons}>
          {supporting.map((p) => (
            <li key={p.id}>
              <a
                href={p.links.value.live ?? '/brief/#projects'}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FactText fact={p.name} />
              </a>
            </li>
          ))}
        </ul>
      </>
    ),
  },
  ...flagships.map((p, i): OverlayDef => ({
    key: `flagship-${p.id}`,
    chapterId: 'sc08-jupiter',
    rest: [0.25, 0.5, 0.75][i] ?? 0.5,
    placement: i % 2 ? 'left' : 'right',
    label: p.name.value,
    render: () => (
      <>
        <Kicker>
          Installation {i + 1} of {flagships.length}
        </Kicker>
        <h3 className={styles.title}>
          <FactText fact={p.name} />
        </h3>
        <p className={styles.meta}>
          <FactText fact={p.role} />
        </p>
        <p>
          <FactText fact={p.summary} />
        </p>
        <p className={styles.stack}>
          <FactText fact={p.stack}>{p.stack.value.join(' · ')}</FactText>
        </p>
        <ProjectLinks project={p} />
        <button
          type="button"
          className={styles.bay}
          onClick={() => useJourneyStore.getState().openBay(p.id)}
        >
          Enter Project Bay
        </button>
      </>
    ),
  })),
  {
    key: 'stack',
    chapterId: 'sc09-saturn',
    rest: 0.75,
    placement: 'left',
    label: 'Technology stack',
    render: () => (
      <>
        <Kicker>Rings · Technology stack</Kicker>
        <dl className={styles.rings}>
          {stack.map((g) => (
            <div key={g.id}>
              <dt>{g.label}</dt>
              <dd>
                <FactText fact={g.items}>{g.items.value.join(' · ')}</FactText>
              </dd>
            </div>
          ))}
        </dl>
      </>
    ),
  },
  {
    key: 'certifications',
    chapterId: 'sc11a-discipline',
    rest: 0.55,
    placement: 'right',
    label: 'Certifications',
    render: () => (
      <>
        <Kicker>Discipline · Certifications</Kicker>
        <ul className={styles.lines}>
          {certifications.value.map((c) => (
            <li key={c.name}>
              <FactText fact={certifications}>
                {c.name}{' '}
                <span className={styles.metaInline}>
                  · {c.issuer}, {c.year}
                </span>
              </FactText>
            </li>
          ))}
        </ul>
      </>
    ),
  },
  {
    key: 'achievements',
    chapterId: 'sc11b-proof',
    rest: 0.55,
    placement: 'left',
    label: 'Achievements',
    render: () => (
      <>
        <Kicker>Proof · Achievements</Kicker>
        <ul className={styles.lines}>
          {achievements.filter(shouldShow).map((a) => (
            <li key={a.value}>
              <FactText fact={a} />
            </li>
          ))}
        </ul>
      </>
    ),
  },
  {
    key: 'horizon',
    chapterId: 'sc11c-horizon',
    // learning and future direction are still [TO CONFIRM]: no empty panel until they are supplied
    available: () => shouldShow(content.learning) || shouldShow(content.futureDirection),
    rest: 0.55,
    placement: 'right',
    label: 'What comes next',
    render: () => (
      <>
        <Kicker>Horizon · What comes next</Kicker>
        <p className={styles.lead}>
          <FactText fact={content.learning} />
        </p>
        <p>
          <FactText fact={content.futureDirection} />
        </p>
      </>
    ),
  },
  {
    key: 'contact',
    chapterId: 'sc13-transmission',
    rest: 0.6,
    placement: 'left',
    label: 'Contact',
    holdToEnd: true,
    render: () => (
      <>
        <ContactPanel id="final-transmission" />
        <button
          type="button"
          className={styles.bay}
          onClick={() => {
            const go = useJourneyStore.getState().navigate;
            if (go) go('sc02-room');
            else window.scrollTo({ top: 0, behavior: 'instant' });
          }}
        >
          Replay mission
        </button>
      </>
    ),
  },
];

export const overlayDefs: readonly OverlayDef[] = allOverlayDefs.filter(
  (d) => d.available?.() ?? true,
);
