import { renderToString } from 'react-dom/server';
import { Brief } from './Brief.tsx';

/**
 * Build-time render of the Mission Brief (scripts/prerender-brief.ts) so the page works with
 * JavaScript disabled and is fully indexable (MISSION_BRIEF.md §3).
 */
export function render(): string {
  return renderToString(<Brief />);
}
