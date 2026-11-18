import { forwardRef } from 'react';

interface Props {
  /** Total scroll length in screens (viewport heights). */
  readonly screens: number;
}

/**
 * The only element that scrolls. Its height uses `lvh` (large viewport height), so the
 * mobile address bar showing/hiding never changes the track length.
 */
export const ScrollTrack = forwardRef<HTMLDivElement, Props>(function ScrollTrack(
  { screens },
  ref,
) {
  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{ height: `calc(${screens} * 100lvh)`, width: 1, pointerEvents: 'none' }}
    />
  );
});
