/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { DESK, KEYBOARD, MOUSE, SEAT } from './layout.ts';

/**
 * The seated typing pose against the desk (P4 review: "the typing fingers blended into the desk").
 * Plays the real Mixamo clip from the shipped GLB, seated at SEAT facing the desk, and checks
 * every sampled frame:
 *  - wrists never go into the desktop (they may rest on it: 1.5 cm tolerance for soft contact);
 *  - fingertips reach the keyboard without sinking into it, and land on its footprint.
 * Surface offsets: wrist radius ~3 cm, fingertip pad ~1.2 cm, suit inflation 1.2 cm (suit.ts).
 */
const SUIT = 0.012;
const WRIST_R = 0.03;
const PAD = 0.012;

async function typingFrames() {
  const buf = readFileSync(
    join(import.meta.dirname, '../../../public/assets/models/astronaut.glb'),
  );
  // Node has no image decoder: the suit's palette texture is replaced by an empty texture (only
  // the skeleton and clips matter here)
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).register(() => ({
    name: 'node-no-textures',
    loadTexture: () => Promise.resolve(new THREE.Texture()),
  }));
  const gltf = await loader.parseAsync(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    '',
  );
  const body = new THREE.Group();
  body.position.set(...SEAT);
  body.rotation.set(0, Math.PI, 0); // the rig faces +z; the desk is at -z
  body.add(gltf.scene);
  const clip = gltf.animations.find((a) => a.name === 'typing');
  if (!clip) throw new Error('typing clip missing');
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const action = mixer.clipAction(clip);
  action.play();
  const bone = (n: string) => {
    const b = gltf.scene.getObjectByName(`mixamorig${n}`);
    if (!b) throw new Error(`bone ${n} missing`);
    return b;
  };
  const wrists = [bone('LeftHand'), bone('RightHand')];
  const tips = [bone('LeftHandIndex3'), bone('RightHandIndex3')];
  const frames: { wrists: THREE.Vector3[]; tips: THREE.Vector3[] }[] = [];
  for (let i = 0; i <= 60; i += 1) {
    action.time = (clip.duration * i) / 60;
    mixer.update(0);
    body.updateMatrixWorld(true);
    frames.push({
      wrists: wrists.map((b) => b.getWorldPosition(new THREE.Vector3())),
      tips: tips.map((b) => b.getWorldPosition(new THREE.Vector3())),
    });
  }
  return frames;
}

describe('SC02 typing pose fits the desk', async () => {
  const frames = await typingFrames();
  const keyTop = DESK.top + KEYBOARD.size[1];

  it('keeps the wrists out of the desktop', () => {
    const lowest = Math.min(...frames.flatMap((f) => f.wrists.map((w) => w.y - WRIST_R - SUIT)));
    expect(lowest).toBeGreaterThan(DESK.top - 0.015);
  });

  it('puts the fingertips on the keys, not inside them or above them', () => {
    const lowest = Math.min(...frames.flatMap((f) => f.tips.map((p) => p.y - PAD - SUIT)));
    expect(lowest).toBeGreaterThan(keyTop - 0.01);
    expect(lowest).toBeLessThan(keyTop + 0.03);
  });

  it('lands every fingertip on the keyboard or the mouse', () => {
    const [w, , d] = KEYBOARD.size;
    const [pw, , pd] = MOUSE.pad;
    for (const f of frames)
      for (const p of f.tips) {
        // only touch-downs count; a hand travelling between keys and mouse is in the air
        if (p.y - PAD - SUIT > keyTop + 0.015) continue;
        const onKeys = Math.abs(p.x - KEYBOARD.x) < w / 2 && Math.abs(p.z - KEYBOARD.z) < d / 2;
        const onMouse = Math.abs(p.x - MOUSE.x) < pw / 2 && Math.abs(p.z - MOUSE.z) < pd / 2;
        expect(onKeys || onMouse).toBe(true);
      }
  });
});
