import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { chapters } from '../../chapters/registry.ts';
import { implementations } from '../../chapters/implementations.ts';
import type { JourneyFrame } from '../../chapters/contract.ts';
import { createShotState, fovForAspect } from '../camera/shots.ts';
import { getEnvironment } from '../environment.ts';
import { dwell, resolve } from '../scroll/resolver.ts';
import type { Track } from '../scroll/resolver.ts';
import type { ScrollMasterState } from '../scroll/useScrollMaster.ts';
import { useJourneyStore } from '../store.ts';
import { restOpacity } from './overlayMath.ts';

/**
 * Portrait screens put the text panel in the bottom half and the header at the top, leaving a
 * narrow free band above the panel. A lens shift (the projection window slides down the image)
 * moves the whole picture up by this fraction of the screen height, so the 3D subject lands in
 * that band instead of behind the panel. Exact and free: no change to any chapter's camera keys.
 */
const PORTRAIT_SHIFT = 0.17;

export interface OverlayEntry {
  readonly el: HTMLElement;
  readonly chapterId: string;
  readonly rest: number;
  /** Half-width of the readable band around the rest point (local t). */
  readonly half: number;
  readonly holdToEnd: boolean;
  /** The card's entrance timeline (src/ui/cardReveal.ts), seeked to the visibility each change. */
  readonly reveal?: { progress(p: number): unknown };
  last: number;
  visible: boolean;
}

/** Mutable registries shared between the DOM layer and the render loop (not React state). */
export interface DirectorLinks {
  readonly groups: Map<string, THREE.Group>;
  readonly overlays: Map<string, OverlayEntry>;
  progressBar: HTMLElement | null;
  /** Overall story percentage (header progress line); text written only when it changes. */
  progressText: HTMLElement | null;
  track: Track;
}

interface Props {
  readonly master: ScrollMasterState;
  readonly frame: JourneyFrame;
  readonly links: DirectorLinks;
}

/**
 * The Director: once per tick, turns master progress into the whole visible state.
 * Everything here is a pure function of progress except ambient effects owned by scenes,
 * so scrolling backwards and chapter jumps reproduce exactly the same frames.
 * Must be mounted BEFORE chapter scenes so their useFrame callbacks see this tick's frame.
 */
export function Director({ master, frame, links }: Props) {
  const shot = useMemo(() => createShotState(), []);
  const backgrounds = useMemo(() => {
    const m = new Map<string, THREE.Color>();
    for (const [id, impl] of Object.entries(implementations))
      m.set(id, new THREE.Color(impl.background));
    return m;
  }, []);
  // size the lens shift was last applied for (so it is only rewritten when something changes)
  const lens = useMemo(() => ({ w: 0, h: 0, shift: 0 }), []);

  useFrame(({ camera, scene, size, gl }) => {
    const progress = master.progress;
    const r = resolve(links.track, progress);
    const meta = chapters[r.index];
    const impl = implementations[r.id];
    if (!meta || !impl) return;

    frame.progress = progress;
    frame.index = r.index;
    frame.id = r.id;
    frame.localT = r.localT;
    frame.t = dwell(r.localT, meta.restPoints);
    frame.style = impl.style ? impl.style(frame.t) : meta.artStyle === 'anime' ? 2 : 0;
    frame.backdrop = impl.backdrop?.(frame.t) ?? 0;

    // Discrete: only when the chapter actually changes (mounting/unmounting neighbours).
    const store = useJourneyStore.getState();
    if (store.activeIndex !== r.index) store.setActiveIndex(r.index);

    for (const [id, group] of links.groups) group.visible = id === r.id;

    // Image-based lighting of the active chapter (looked up each frame: it may finish loading later).
    const env = getEnvironment(impl.environment?.key);
    if (scene.environment !== env) scene.environment = env;
    const ei = impl.environment?.intensity ?? 1;
    const envIntensity = typeof ei === 'function' ? ei(frame.t) : ei;
    if (scene.environmentIntensity !== envIntensity) scene.environmentIntensity = envIntensity;

    const bg = backgrounds.get(r.id);
    if (bg) {
      if (impl.emptyBackground?.(frame.t)) {
        scene.background = null;
        gl.setClearColor(bg, 0);
      } else if (scene.background instanceof THREE.Color) scene.background.copy(bg);
      else scene.background = bg.clone();
    }

    impl.shot(frame.t, shot, frame.aspect);
    camera.position.copy(shot.position);
    camera.lookAt(shot.target);
    const persp = camera as THREE.PerspectiveCamera;
    const fov = fovForAspect(shot.fov, frame.aspect);
    if (persp.isPerspectiveCamera && Math.abs(persp.fov - fov) > 1e-3) {
      persp.fov = fov;
      persp.updateProjectionMatrix();
    }
    if (persp.isPerspectiveCamera) {
      const shift = frame.aspect === 'portrait' ? (impl.portraitShift ?? PORTRAIT_SHIFT) : 0;
      if (lens.w !== size.width || lens.h !== size.height || lens.shift !== shift) {
        lens.w = size.width;
        lens.h = size.height;
        lens.shift = shift;
        if (shift > 0)
          persp.setViewOffset(
            size.width,
            size.height,
            0,
            size.height * shift,
            size.width,
            size.height,
          );
        else persp.clearViewOffset();
        persp.updateProjectionMatrix();
      }
    }

    // Overlays: direct style writes, only when values change.
    for (const entry of links.overlays.values()) {
      const o =
        entry.chapterId === r.id
          ? restOpacity(r.localT, entry.rest, { half: entry.half, holdToEnd: entry.holdToEnd })
          : 0;
      if (Math.abs(o - entry.last) < 0.002) continue;
      entry.last = o;
      // one value per panel; CSS derives the panel fade and the staged reveal of its parts from
      // it (overlays.module.css), so the stagger is still a pure function of progress
      entry.el.style.setProperty('--o', o.toFixed(3));
      entry.reveal?.progress(o);
      const visible = o > 0.01;
      if (visible !== entry.visible) {
        entry.visible = visible;
        entry.el.style.visibility = visible ? 'visible' : 'hidden';
        entry.el.inert = !visible;
        entry.el.setAttribute('aria-hidden', String(!visible));
      }
    }

    if (links.progressBar)
      links.progressBar.style.transform = `scaleX(${master.progress.toFixed(4)})`;
    if (links.progressText) {
      const pct = `${Math.round(master.progress * 100)}%`;
      if (links.progressText.textContent !== pct) links.progressText.textContent = pct;
    }
  });

  return null;
}
