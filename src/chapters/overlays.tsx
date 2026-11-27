import type { ReactNode } from 'react';
import { content } from '../content/index.ts';
import type { Project } from '../content/index.ts';
import { useJourneyStore } from '../engine/store.ts';
import { ContactPanel } from '../ui/ContactPanel.tsx';
import { CARD_REST, MOON_ANCHOR } from './homecoming/homecoming.ts';
import { WORLD_TITLES, WorldTitleCard } from './anime/titles.tsx';
import { FactText, shouldShow } from '../ui/FactText.tsx';
import { PROJECT_MEDIA } from '../ui/projectMedia.ts';
import { WorkCard } from './WorkCard.tsx';
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
  /**
   * 'editorial': large type straight over the scene on a soft vignette, no panel box.
   * 'world': an anime world's floating title.
   */
  readonly variant?: 'editorial' | 'showcase' | 'card' | 'world';
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

const LINK_LABELS = { live: 'Live site', code: 'Source code', demo: 'Demo' } as const;
/** Certifications on the SC11-A panel (newest first); the Mission Brief lists them all. */
const PANEL_CERTS = 6;
/** Features shown on a showcase panel; the Project Bay lists them all. */
const SHOWCASE_FEATURES = 3;

/**
 * A flagship project at its SC08 stop (UI_SCROLL_AUDIT.md §7): name, role, one-line summary, a
 * preview, key features, the stack, and the way on (full details, live site, source). Every field
 * comes from src/content/projects.ts; nothing is written here.
 */
function ProjectShowcase({
  project,
  index,
  total,
}: {
  project: Project;
  index: number;
  total: number;
}) {
  const media = PROJECT_MEDIA[project.id];
  const links = shouldShow(project.links) ? project.links.value : {};
  const linkEntries = (Object.keys(LINK_LABELS) as Array<keyof typeof LINK_LABELS>).flatMap((k) => {
    const href = links[k];
    return href ? [[k, href] as const] : [];
  });
  return (
    <>
      <div className={styles.showHead}>
        <Kicker>
          Project {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </Kicker>
        <h3 className={styles.showTitle}>
          <FactText fact={project.name} />
        </h3>
        <p className={styles.role}>
          <FactText fact={project.role} />
        </p>
      </div>
      <p className={styles.showLead}>
        <FactText fact={project.summary} />
      </p>
      {media && (
        <figure className={styles.showMedia}>
          <img
            src={media}
            alt={`Interface of ${project.name.value}`}
            loading="lazy"
            decoding="async"
          />
        </figure>
      )}
      <div className={styles.showCols}>
        {shouldShow(project.features) && (
          <div>
            <p className={styles.label}>Key features</p>
            <ul className={styles.showList}>
              {project.features.value.slice(0, SHOWCASE_FEATURES).map((f) => (
                <li key={f}>
                  <FactText fact={project.features}>{f}</FactText>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <p className={styles.label}>Built with</p>
          <ul className={styles.chips}>
            {project.stack.value.map((t) => (
              <li key={t}>
                <FactText fact={project.stack}>{t}</FactText>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className={styles.showActions}>
        <button
          type="button"
          className={styles.bay}
          onClick={() => useJourneyStore.getState().openBay(project.id)}
        >
          Open full details
        </button>
        {linkEntries.map(([k, href]) => (
          <a key={k} className={styles.ghost} href={href} target="_blank" rel="noopener noreferrer">
            {LINK_LABELS[k]}
          </a>
        ))}
      </p>
    </>
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
            Read the Mission Brief
          </a>
        </p>
      </>
    ),
  },
  {
    key: 'experience',
    chapterId: 'sc04-crew-record',
    rest: 0.35,
    band: 0.1,
    placement: 'right',
    label: 'Experience',
    render: () => (
      <>
        <Kicker>Crew record</Kicker>
        <h2 className={styles.heading}>Experience</h2>
        <ol className={styles.record}>
          {experience.map((job) => (
            <li key={job.id}>
              <h3>
                <FactText fact={job.role} />
              </h3>
              <p className={styles.meta}>
                <FactText fact={job.organisation} />{' '}
                <span className={styles.date}>
                  ·{' '}
                  <FactText fact={job.period}>
                    {job.period.value.start} – {job.period.value.end}
                  </FactText>
                </span>
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
  // what was done there: one card for each job that has projects it may show
  ...experience
    .filter((job) => job.projects.some((p) => shouldShow(p.name)))
    .slice(0, 1)
    .map((job): OverlayDef => ({
      key: `work-${job.id}`,
      chapterId: 'sc04-crew-record',
      rest: 0.525,
      band: 0.075,
      placement: 'left',
      label: `Work at ${job.organisation.value}`,
      render: () => <WorkCard job={job} />,
    })),
  {
    key: 'education',
    chapterId: 'sc04-crew-record',
    rest: 0.7,
    band: 0.1,
    placement: 'left',
    label: 'Education',
    render: () => (
      <>
        <Kicker>Crew record</Kicker>
        <h2 className={styles.heading}>Education</h2>
        <ol className={styles.record}>
          {education
            .filter((e) => e.placement === 'journey')
            .map((e) => (
              <li key={e.id}>
                <h3>
                  <FactText fact={e.qualification} />
                </h3>
                <p className={styles.meta}>
                  <FactText fact={e.institution} />{' '}
                  <span className={styles.date}>
                    ·{' '}
                    <FactText fact={e.period}>
                      {e.period.value.start} – {e.period.value.end}
                    </FactText>{' '}
                    · <FactText fact={e.grade} />
                  </span>
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
    placement: 'left', // bottom-centre covered the ship and the sunrise
    label: 'Core strengths',
    render: () => (
      <>
        <Kicker>Spectral analysis</Kicker>
        <h2 className={styles.heading}>Core strengths</h2>
        <p className={styles.lead}>You can tell what a star is made of by its light.</p>
        <ol className={styles.strengths}>
          {strengths.value.map((s) => (
            <li key={s}>
              <FactText fact={strengths}>{s}</FactText>
            </li>
          ))}
        </ol>
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
        <Kicker>Beacons in the belt</Kicker>
        <h2 className={styles.heading}>More projects</h2>
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
    band: 0.12, // rest points 0.25 apart: neighbours must not overlap
    placement: i % 2 ? 'left' : 'right',
    label: p.name.value,
    variant: 'showcase',
    render: () => <ProjectShowcase project={p} index={i} total={flagships.length} />,
  })),
  {
    key: 'stack',
    chapterId: 'sc09-saturn',
    rest: 0.75,
    placement: 'left',
    label: 'Technology stack',
    render: () => (
      <>
        <Kicker>Rings</Kicker>
        <h2 className={styles.heading}>Tech stack</h2>
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
  // each anime world opens with its series' name, gone before the world's card arrives
  ...Object.entries(WORLD_TITLES).map(([chapterId, title]): OverlayDef => ({
    key: `world-${chapterId}`,
    chapterId,
    rest: 0.22,
    band: 0.18,
    placement: 'center',
    variant: 'world',
    label: title.name,
    render: () => <WorldTitleCard title={title} />,
  })),
  {
    key: 'certifications',
    chapterId: 'sc11a-discipline',
    rest: 0.55,
    placement: 'right',
    label: 'Certifications',
    render: () => (
      <>
        <Kicker>Discipline</Kicker>
        <h2 className={styles.heading}>Certifications</h2>
        <ul className={styles.lines}>
          {certifications.value.slice(0, PANEL_CERTS).map((c) => (
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
        {certifications.value.length > PANEL_CERTS && (
          <p className={styles.metaInline}>
            <a href="/brief/#certifications">
              {certifications.value.length - PANEL_CERTS} more, and courses, in the Mission Brief
            </a>
          </p>
        )}
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
        <Kicker>Proof</Kicker>
        <h2 className={styles.heading}>Achievements</h2>
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
    // no empty panel while learning and future direction are both still missing
    available: () => shouldShow(content.learning) || shouldShow(content.futureDirection),
    rest: 0.55,
    placement: 'right',
    label: 'What comes next',
    render: () => (
      <>
        <Kicker>Horizon</Kicker>
        <h2 className={styles.heading}>What comes next</h2>
        {shouldShow(content.learning) && (
          <>
            <p className={styles.kicker}>Learning now</p>
            <p className={styles.lead}>
              <FactText fact={content.learning} />
            </p>
          </>
        )}
        {shouldShow(content.futureDirection) && (
          <>
            <p className={styles.kicker}>Next</p>
            <p>
              <FactText fact={content.futureDirection} />
            </p>
          </>
        )}
      </>
    ),
  },
  {
    key: 'contact',
    chapterId: 'sc13-transmission',
    rest: CARD_REST,
    placement: 'center',
    // the final card (after the user's Lunar Gravity reference): copy on the left over a fading
    // scrim, the Moon and its ring in the empty right half (LunarMoon places it there)
    variant: 'card',
    label: 'Contact',
    holdToEnd: true,
    render: () => (
      <>
        <div className={styles.cardMoon} {...{ [MOON_ANCHOR]: '' }} aria-hidden="true" />
        <div className={styles.cardCopy}>
          <ContactPanel id="final-transmission" display />
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
        </div>
      </>
    ),
  },
];

export const overlayDefs: readonly OverlayDef[] = allOverlayDefs.filter(
  (d) => d.available?.() ?? true,
);
