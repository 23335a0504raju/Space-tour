import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/base.css';
import styles from './spikes.module.css';

/**
 * P1 spikes (DEVELOPMENT_WORKFLOW.md §1). Development-only: served by `npm run dev`
 * at /spikes/, never part of the production build.
 */
const SPIKES = {
  s1: {
    title: 'S1 · Scroll + single clock + reversibility',
    load: () => import('./S1ScrollSync.tsx'),
  },
  s2: {
    title: 'S2 · Scroll-scrubbed character, foot-locked walk',
    load: () => import('./S2CharacterScrub.tsx'),
  },
  s4: {
    title: 'S4 · Performance baseline (run on laptop + phone)',
    load: () => import('./S4PerfBaseline.tsx'),
  },
} as const;

type SpikeId = keyof typeof SPIKES;
const param = new URLSearchParams(window.location.search).get('s');
const active = param && param in SPIKES ? (param as SpikeId) : null;

function Index() {
  return (
    <main className={styles.index}>
      <h1>P1 spikes</h1>
      <p>
        Development-only experiments. Each one answers a risk question before chapters are built.
      </p>
      <ul>
        {(Object.keys(SPIKES) as SpikeId[]).map((id) => (
          <li key={id}>
            <a href={`?s=${id}`}>{SPIKES[id].title}</a>
          </li>
        ))}
      </ul>
      <p className={styles.note}>
        S3 (asset pipeline) is a command-line spike. Results are in{' '}
        <code>docs/reports/P1_SPIKES.md</code>.
      </p>
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');

const Spike = active ? lazy(SPIKES[active].load) : null;

createRoot(root).render(
  <StrictMode>
    {Spike ? (
      <Suspense fallback={<p className={styles.loading}>Loading spike…</p>}>
        <Spike />
      </Suspense>
    ) : (
      <Index />
    )}
  </StrictMode>,
);
