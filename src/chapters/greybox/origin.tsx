import { Suspense, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { sampleKeys } from '../../engine/camera/shots.ts';
import type { ShotKey } from '../../engine/camera/shots.ts';
import { Astronaut } from '../astronaut/Astronaut.tsx';
import type { AstronautApi, Drive } from '../astronaut/Astronaut.tsx';
import type { ChapterImpl, ChapterSceneProps } from '../contract.ts';
import { RoomSet } from '../room/RoomSet.tsx';
import type { RoomSetHandle } from '../room/RoomSet.tsx';
import { SEAT } from '../room/layout.ts';
import {
  STAND,
  chairPose,
  clamp01,
  departureShot,
  doorOpen,
  span,
  walkedDistance,
  walkerAt,
} from './departure.ts';
import { Astronaut as StandIn } from './parts.tsx';

/**
 * SC02–SC03 (P3 vertical slice): real room set + the Mixamo astronaut (Y Bot rig, spacesuit built
 * in code). All story motion is a pure function of story time t (maths in departure.ts).
 */
const ROOM_ENV = { key: 'room', intensity: 0.45 } as const;

/**
 * Typing playback rate (× the Mixamo clip's natural speed): calm, focused typing (user review).
 * Note: the frantic typing in P3 was a clock bug (milliseconds passed as seconds), fixed in
 * engine/clock.ts; this rate only applies on top of real seconds.
 */
const TYPING_RATE = 0.7;
const typingTime = (api: AstronautApi, elapsed: number) =>
  (elapsed * TYPING_RATE) % api.duration('typing');

// ── SC02 · The Room ────────────────────────────────────────────────────────────
const roomKeys: ShotKey[] = [
  // Opening frame (behind the start gate's title): from behind-left of the astronaut, so the
  // figure at the desk sits on the right third and the ship on the pad shows right of the title
  // block, which owns the left half (UI_SCROLL_AUDIT.md F7). Was a view over the helmet at the
  // window frame, with the title covering the ship.
  { t: 0, position: [-1.0, 1.6, 1.2], target: [-1.52, 1.25, -8.8], fov: 42 },
  // pull back through the room to reveal the astronaut at the desk
  { t: 0.6, position: [2.35, 1.85, 0.5], target: [0, 1.0, -2.2], fov: 42 },
  { t: 1, position: [1.45, 1.5, -0.55], target: [0, 1.05, -2.3], fov: 40 },
];

/** Seated at the desk, typing (the typing loop is ambient: wall-clock time). */
const typingDrive: Drive = (_t, api, body, elapsed) => {
  body.position.set(SEAT[0], SEAT[1], SEAT[2]);
  body.rotation.set(0, Math.PI, 0); // the rig faces +z; the desk is at -z
  api.set('typing', typingTime(api, elapsed), 1);
};

function RoomScene({ id, frame }: ChapterSceneProps) {
  return (
    <RoomSet>
      <Suspense fallback={<StandIn position={SEAT} rotation={[0, Math.PI, 0]} seated />}>
        <Astronaut chapterId={id} frame={frame} drive={typingDrive} />
      </Suspense>
    </RoomSet>
  );
}

export const sc02Room: ChapterImpl = {
  Scene: RoomScene,
  shot: (t, out) => void sampleKeys(roomKeys, t, out),
  background: '#04060b',
  environment: ROOM_ENV,
};

// ── SC03 · Departure: stand up, push the chair back, walk to the door, into the light ──
const departureDrive: Drive = (t, api, body, elapsed) => {
  body.rotation.set(0, walkerAt(t, body.position), 0);

  // clips: typing → stand up → walk (weights cross-fade in story time)
  const toStand = span(t, 0.03, 0.08);
  const toWalk = span(t, 0.22, 0.3);
  api.set('typing', typingTime(api, elapsed), 1 - toStand);
  const standK = clamp01((t - STAND.start) / (STAND.end - STAND.start));
  api.set('standUp', standK * api.duration('standUp'), toStand * (1 - toWalk));
  // walk phase from distance (foot-locked; spike S2)
  const d = walkedDistance(t);
  const walkTime = api.walkSpeed > 0 ? (d / api.walkSpeed) % api.duration('walk') : 0;
  api.set('walk', walkTime, toWalk);
};

function DepartureScene({ id, frame }: ChapterSceneProps) {
  const set = useRef<RoomSetHandle>(null);
  useFrame(() => {
    if (frame.id !== id || !set.current) return;
    set.current.setDoor(doorOpen(frame.t));
    const c = chairPose(frame.t);
    set.current.setChair(c.x, c.z, c.rotY);
  });
  return (
    <RoomSet ref={set}>
      <Suspense fallback={<StandIn position={SEAT} rotation={[0, Math.PI, 0]} />}>
        <Astronaut chapterId={id} frame={frame} drive={departureDrive} />
      </Suspense>
    </RoomSet>
  );
}

export const sc03Departure: ChapterImpl = {
  Scene: DepartureScene,
  shot: departureShot,
  background: '#04060b',
  exitColor: '#ffffff', // the door opens onto white light → hatch (match cut)
  environment: ROOM_ENV,
};
