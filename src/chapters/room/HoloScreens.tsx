import { HoloPanes } from '../holo/HoloPanes.tsx';
import { createHoloAtlas } from './holoAtlas.ts';
import { ATLAS, PANES } from './holoLayout.ts';

/** The developer's workstation (SC02/SC03): floating screens over the desk. */
export function HoloScreens() {
  return <HoloPanes panes={PANES} size={ATLAS} createAtlas={createHoloAtlas} />;
}
