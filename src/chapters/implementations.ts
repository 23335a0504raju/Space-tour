import type { ChapterImpl } from './contract.ts';
import { sc12Return } from './return/Return.tsx';
import { sc11aDiscipline, sc11bProof, sc11cHorizon } from './anime/areas.tsx';
import { sc10Crossing } from './crossing/Crossing.tsx';
import { sc13Transmission } from './homecoming/Homecoming.tsx';
import { sc04CrewRecord } from './cockpit/Cockpit.tsx';
import { sc05Ascent } from './ascent/Ascent.tsx';
import { sc06Sunrise } from './sunrise/Sunrise.tsx';
import { sc02Room, sc03Departure } from './greybox/origin.tsx';
import { sc09Saturn } from './saturn/Saturn.tsx';
import { sc08Jupiter } from './jupiter/Jupiter.tsx';
import { sc07Outbound } from './outbound/Outbound.tsx';

/**
 * Chapter id → implementation. Grey-box (P2) implementations; each is replaced chapter by
 * chapter in P3/P4 without touching the engine.
 */
export const implementations: Readonly<Record<string, ChapterImpl>> = {
  'sc02-room': sc02Room,
  'sc03-departure': sc03Departure,
  'sc04-crew-record': sc04CrewRecord,
  'sc05-ascent': sc05Ascent,
  'sc06-sunrise': sc06Sunrise,
  'sc07-outbound': sc07Outbound,
  'sc08-jupiter': sc08Jupiter,
  'sc09-saturn': sc09Saturn,
  'sc10-crossing': sc10Crossing,
  'sc11a-discipline': sc11aDiscipline,
  'sc11b-proof': sc11bProof,
  'sc11c-horizon': sc11cHorizon,
  'sc12-return': sc12Return,
  'sc13-transmission': sc13Transmission,
};
