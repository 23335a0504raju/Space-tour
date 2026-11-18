import type { ComponentType } from 'react';
import type { ShotState } from '../engine/camera/shots.ts';
import type { AspectClass } from './types.ts';

/**
 * Per-frame journey state, written once per tick by the Director and read by chapter scenes.
 * A plain mutable object: never React state (TECHNICAL_BLUEPRINT.md §14).
 */
export interface JourneyFrame {
  /** Smoothed master progress, 0..1. */
  progress: number;
  index: number;
  id: string;
  /** Raw local progress within the active chapter (scroll space). */
  localT: number;
  /** Story time within the active chapter after dwell remapping. Scenes animate from this. */
  t: number;
  /** Art-style blend: 0 realistic, 1 ink line art, 2 cel colour (a pure function of progress). */
  style: number;
  aspect: AspectClass;
}

export const createJourneyFrame = (): JourneyFrame => ({
  progress: 0,
  index: 0,
  id: '',
  localT: 0,
  t: 0,
  style: 0,
  aspect: 'landscape',
});

export interface ChapterSceneProps {
  readonly id: string;
  readonly frame: JourneyFrame;
}

/** Implementation half of the chapter contract (metadata lives in registry.ts). */
export interface ChapterImpl {
  /** 3D content in the chapter's own local coordinate space. */
  readonly Scene: ComponentType<ChapterSceneProps>;
  /** Camera for story time t; must be a pure function of t (writes into `out`). */
  shot(t: number, out: ShotState): void;
  /** Art-style blend at story time t (0 realistic, 1 line art, 2 cel). Default: the chapter art style. */
  style?(t: number): number;
  readonly background: string;
  /** Colour of the dip when leaving this chapter (default black; white for the door → hatch cut). */
  readonly exitColor?: string;
  /** Image-based lighting registered via engine/environment.ts (applied by the Director). */
  readonly environment?: { readonly key: string; readonly intensity: number };
}
