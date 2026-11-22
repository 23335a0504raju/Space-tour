import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createShotState } from '../engine/camera/shots.ts';
import type { ShotState } from '../engine/camera/shots.ts';
import { END_Z, JUPITER_AHEAD, outboundShot, shipZ as outboundZ } from './outbound/outbound.ts';
import { EARTH as SC06_EARTH, shipZ as sunriseZ, sunriseShot } from './sunrise/sunrise.ts';
import { ORBIT_EARTH_FROM_SHIP, ascentShot, shipPose } from './ascent/ascent.ts';
import { JUPITER, SATURN_AHEAD, jupiterShip, jupiterShot } from './jupiter/jupiter.ts';
import { HOLE_AHEAD, saturnShip, saturnShot } from './saturn/saturn.ts';
import { GATE, crossingShot, shipZ as crossingZ } from './crossing/crossing.ts';
import type { Vec3 } from './handoff.ts';
import { departureShot } from './greybox/departure.ts';
import { LIFT } from './room/layout.ts';
import { COCKPIT_DOOR } from './cockpit/arrival.ts';
import { sc04CrewRecord } from './cockpit/Cockpit.tsx';

const v = (p: Vec3) => new THREE.Vector3(...p);
const shot = (fn: (t: number, out: ShotState) => void, t: number) => {
  const s = createShotState();
  fn(t, s);
  return s;
};
/** Every piece of the picture, relative to the camera. */
function picture(cam: ShotState, ship: THREE.Vector3, planet: THREE.Vector3) {
  return {
    look: cam.target.clone().sub(cam.position).normalize().toArray(),
    fov: cam.fov,
    ship: ship.clone().sub(cam.position).toArray(),
    planet: planet.clone().sub(cam.position).toArray(),
  };
}
const close = (a: number[], b: number[]) => a.forEach((x, i) => expect(x).toBeCloseTo(b[i]!, 4));

describe('continuous flight between chapters (handoff.ts)', () => {
  it('SC03 ends on the lift door exactly as SC04 opens on it (same distance, height and lens)', () => {
    const end = shot(departureShot, 1);
    const start = shot((t, o) => sc04CrewRecord.shot(t, o, 'landscape'), 0);
    // SC03's door faces +x at the lift; SC04's faces -z in the cockpit
    const endRel = end.position.clone().sub(new THREE.Vector3(LIFT.x, 0, LIFT.z));
    const startRel = start.position.clone().sub(new THREE.Vector3(...COCKPIT_DOOR));
    expect(endRel.x).toBeCloseTo(-startRel.z, 6);
    expect(endRel.y).toBeCloseTo(startRel.y, 6);
    expect(endRel.z).toBeCloseTo(startRel.x, 6);
    expect(end.fov).toBeCloseTo(start.fov, 6);
    expect(end.target.y).toBeCloseTo(start.target.y, 6);
  });

  it('SC05 ends on exactly the picture SC06 opens with (turned a quarter): ship, camera and Earth', () => {
    // SC05 flies toward -x, SC06 toward -z: (x, y, z) here is (-z, y, x) there
    const turn = (p: THREE.Vector3) => new THREE.Vector3(-p.z, p.y, p.x);
    const cam = createShotState();
    ascentShot(1, cam, true);
    const ship = new THREE.Vector3();
    shipPose(1, ship);
    const earth = v(ORBIT_EARTH_FROM_SHIP).add(ship);
    const end = picture(
      { position: turn(cam.position), target: turn(cam.target), fov: cam.fov } as ShotState,
      turn(ship),
      turn(earth),
    );
    const start = picture(
      shot(sunriseShot, 0),
      new THREE.Vector3(0, 0, sunriseZ(0)),
      v(SC06_EARTH.centre),
    );
    close(end.look, start.look);
    close(end.ship, start.ship);
    close(end.planet, start.planet);
    expect(end.fov).toBeCloseTo(start.fov, 6);
  });

  it('SC06 ends on exactly the picture SC07 opens with: the ship against the sky', () => {
    const end = picture(shot(sunriseShot, 1), new THREE.Vector3(0, 0, sunriseZ(1)), v([0, 0, 0]));
    const start = picture(
      shot(outboundShot, 0),
      new THREE.Vector3(0, 0, outboundZ(0)),
      v([0, 0, 0]),
    );
    close(end.look, start.look);
    close(end.ship, start.ship);
    expect(end.fov).toBeCloseTo(start.fov, 6);
  });

  it('SC07 ends on exactly the picture SC08 opens with: ship, camera and Jupiter', () => {
    const end = picture(shot(outboundShot, 1), new THREE.Vector3(0, 0, END_Z), v(JUPITER_AHEAD));
    const start = picture(
      shot(jupiterShot, 0),
      jupiterShip(0, new THREE.Vector3()),
      v(JUPITER.position),
    );
    close(end.look, start.look);
    close(end.ship, start.ship);
    close(end.planet, start.planet);
    expect(end.fov).toBeCloseTo(start.fov, 6);
  });

  it('SC08 ends on exactly the picture SC09 opens with: ship, camera and Saturn', () => {
    const end = picture(shot(jupiterShot, 1), jupiterShip(1, new THREE.Vector3()), v(SATURN_AHEAD));
    const start = picture(shot(saturnShot, 0), saturnShip(0, new THREE.Vector3()), v([0, 0, 0]));
    close(end.look, start.look);
    close(end.ship, start.ship);
    close(end.planet, start.planet);
    expect(end.fov).toBeCloseTo(start.fov, 6);
  });

  it('SC09 ends on exactly the picture SC10 opens with: ship, camera and the black hole', () => {
    const end = picture(shot(saturnShot, 1), saturnShip(1, new THREE.Vector3()), v(HOLE_AHEAD));
    const start = picture(
      shot(crossingShot, 0),
      new THREE.Vector3(0, 0, crossingZ(0)),
      v([0, 0, GATE.z]),
    );
    close(end.look, start.look);
    close(end.ship, start.ship);
    close(end.planet, start.planet);
    expect(end.fov).toBeCloseTo(start.fov, 6);
  });

  it('the ship keeps moving through each boundary (no stop at the cut)', () => {
    const a = jupiterShip(0, new THREE.Vector3());
    const b = jupiterShip(0.02, new THREE.Vector3());
    expect(a.distanceTo(b)).toBeGreaterThan(10);
    const c = jupiterShip(0.98, new THREE.Vector3());
    const d = jupiterShip(1, new THREE.Vector3());
    expect(c.distanceTo(d)).toBeGreaterThan(5);
  });
});
