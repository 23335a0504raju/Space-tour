import type { Experience } from '../content/index.ts';
import { FactText, shouldShow } from '../ui/FactText.tsx';
import styles from './overlays.module.css';

/** Results shown on the card; the Mission Brief lists every responsibility. */
const HIGHLIGHTS = 3;

/**
 * The work inside one job (SC04, between Experience and Education): its projects in a line each,
 * then the first results. Every word comes from src/content/experience.ts, and a fact that is still
 * missing, or a project without permission to be shown, is left out.
 */
export function WorkCard({ job }: { job: Experience }) {
  const projects = job.projects.filter(
    (p) => shouldShow(p.name) && shouldShow(p.publicPermission) && p.publicPermission.value,
  );
  const results = job.responsibilities;
  return (
    <>
      <p className={styles.kicker}>Crew record</p>
      <h2 className={styles.heading}>
        Work at <FactText fact={job.organisation} />
      </h2>
      <ul className={styles.work}>
        {projects.map((p) => (
          <li key={p.id}>
            <h3>
              <FactText fact={p.name} />
            </h3>
            <p>
              {shouldShow(p.summary) && (
                <>
                  <FactText fact={p.summary} />{' '}
                </>
              )}
              {shouldShow(p.contribution) && (
                <FactText fact={p.contribution}>{p.contribution.value[0]}.</FactText>
              )}
            </p>
          </li>
        ))}
      </ul>
      {results && shouldShow(results) && (
        <>
          <p className={styles.label}>Results</p>
          <ul className={styles.showList}>
            {results.value.slice(0, HIGHLIGHTS).map((r) => (
              <li key={r}>
                <FactText fact={results}>{r}</FactText>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
