/** Chapter contract metadata (TECHNICAL_BLUEPRINT.md §3.1). Scene/timeline parts are added in P2. */

export type ArtStyle = 'realistic' | 'anime';
export type AspectClass = 'portrait' | 'landscape' | 'ultrawide';

export interface ChapterMeta {
  /** Stable id, e.g. "sc04-crew-record". Used for URLs, Brief anchors and tests. */
  readonly id: string;
  /** Storyline scene code from FINAL_STORYLINE.md, e.g. "SC04". */
  readonly scene: string;
  readonly title: string;
  readonly act: 'origin' | 'launch' | 'transit' | 'beyond' | 'homecoming';
  readonly artStyle: ArtStyle;
  /** Scroll length in screens (viewport heights) for landscape; other classes scale it. */
  readonly screens: number;
  /** Rest points as local progress values in (0, 1), where text is readable. */
  readonly restPoints: readonly number[];
  /** The camera and set continue from the previous chapter, so no dip-to-colour at the boundary. */
  readonly seamlessFromPrevious?: boolean;
  /** Label in the Flight Plan menu; omitted chapters are not jump targets. */
  readonly navLabel?: string;
  /** Mission Brief section anchor this chapter's content maps to. */
  readonly briefAnchor?: string;
  /** May be removed if its content slot has no verified content (B3-8). */
  readonly optional?: boolean;
}
