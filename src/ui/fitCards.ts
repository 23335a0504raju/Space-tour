/**
 * Desktop chapter cards shrink to fit the window instead of scrolling inside themselves (Raju,
 * 2026-11-27: on a zoomed laptop screen the tech stack and project cards showed a scrollbar). Each
 * card gets one number, `--fit`, and CSS scales its content, padding and width by it
 * (overlays.module.css), so a card keeps its shape and just gets smaller.
 *
 * Measured, not guessed: content differs per card. Runs once the fonts are in and again whenever
 * the window changes size; never on scroll. Phones use the same measure for their bottom sheets,
 * which may not scroll inside either (a swipe on a card has to move the page).
 */
const PHONE = '(max-width: 720px)';
/** The header with its progress line, and the bottom bar (rem; matches .left / .right). */
const TOP_REM = 7;
const BOTTOM_REM = 5.25;
/** A phone sheet's share of the screen height (matches max-height in overlays.module.css). */
const PHONE_SHEET = 0.52;
/** Below this the text would be too small to read: the card may scroll instead. */
export const MIN_FIT = 0.6;

/** The next scale to try for a card `height` tall in `room`, from the current scale. */
export function nextFit(current: number, height: number, room: number): number {
  if (height <= room || height <= 0) return current;
  return Math.max(MIN_FIT, current * (room / height) * 0.99);
}

function fit(panel: HTMLElement, body: HTMLElement, room: number): void {
  let k = 1;
  panel.style.setProperty('--fit', '1');
  for (let pass = 0; pass < 4; pass += 1) {
    const css = getComputedStyle(panel);
    const height =
      body.getBoundingClientRect().height +
      parseFloat(css.paddingTop) +
      parseFloat(css.paddingBottom) +
      parseFloat(css.borderTopWidth) +
      parseFloat(css.borderBottomWidth);
    const next = nextFit(k, height, room);
    if (next === k) return;
    k = next;
    panel.style.setProperty('--fit', k.toFixed(3));
  }
}

/** Keeps every `[data-fit]` card under `root` inside the window; returns a cancel function. */
export function fitCards(root: HTMLElement): () => void {
  let live = true;
  let raf = 0;
  const run = () => {
    if (!live) return;
    const phone = window.matchMedia(PHONE).matches;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const room = phone
      ? root.clientHeight * PHONE_SHEET
      : root.clientHeight - (TOP_REM + BOTTOM_REM) * rem;
    for (const body of root.querySelectorAll<HTMLElement>('[data-fit]')) {
      const panel = body.parentElement;
      if (!panel) continue;
      fit(panel, body, room);
    }
  };
  const queue = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(run);
  };
  const watch = new ResizeObserver(queue);
  watch.observe(root);
  void document.fonts.ready.then(queue);
  return () => {
    live = false;
    watch.disconnect();
    cancelAnimationFrame(raf);
  };
}
