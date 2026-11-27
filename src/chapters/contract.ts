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
  /** How far dark pixels count as open space for the style pass, 0..1 (see `backdrop` below). */
  backdrop: number;
  aspect: AspectClass;
}

export const createJourneyFrame = (): JourneyFrame => ({
  progress: 0,
  index: 0,
  id: '',
  localT: 0,
  t: 0,
  style: 0,
  backdrop: 0,
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
  /** Camera for story time t; must be a pure function of t and the aspect class (writes into `out`).
   *  Chapters that frame the same for every aspect can ignore `aspect`. */
  shot(t: number, out: ShotState, aspect: AspectClass): void;
  /** Portrait only: fraction of the screen height the picture is lifted to clear the text panel
   *  (default 0.17). Chapters without text set 0 so the subject stays centred. */
  readonly portraitShift?: number;
  /** Art-style blend at story time t (0 realistic, 1 line art, 2 cel). Default: the chapter art style. */
  style?(t: number): number;
  /**
   * 1 while dark pixels are open space that the painted sky replaces (the SC10 crossing), 0 where
   * they are drawn things that keep their colour (the anime worlds). Default 0.
   */
  backdrop?(t: number): number;
  /**
   * True where the background is left empty (cleared with no alpha) so the style pass paints its
   * sky there whatever is drawn in front. Default false: `background` is drawn.
   */
  emptyBackground?(t: number): boolean;
  readonly background: string;
  /** Colour of the dip when leaving this chapter (default black; white for the door → hatch cut). */
  readonly exitColor?: string;
  /** Image-based lighting registered via engine/environment.ts (applied by the Director). */
  readonly environment?: {
    readonly key: string;
    /** A number, or a function of story time t (SC05 lets its IBL go as it reaches orbit). */
    readonly intensity: number | ((t: number) => number);
  };
}
