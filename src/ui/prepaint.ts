/**
 * Paints every chapter card once, effectively invisibly, before the journey needs it.
 *
 * Chrome compiles the GPU pipelines for a kind of draw (a scaled image in a rounded clip, a new
 * text size, a gradient) the first time it rasterises one. The cards are hidden until their rest
 * point, so that compile used to land mid-scroll: SC08's first project card cost a 150–200 ms
 * stall in the GPU process while it faded in (scripts/measure-freezes.ts --why, Chrome trace:
 * RendererRasterWorker → DoEndRasterCHROMIUM + Dawn worker tasks), with the main thread idle.
 *
 * Once the fonts are in and the card images have decoded, each card is shown for two frames at
 * 1 % opacity (`className` overrides the inline visibility and opacity the Director and the reveal
 * timeline own; removing it hands both back untouched). The cards stay inert throughout.
 * Runs once per mount; returns a cancel function.
 */
export function prepaintCards(root: HTMLElement, className: string): () => void {
  let live = true;
  let raf = 0;
  const run = async () => {
    const images = [...root.querySelectorAll('img')];
    for (const img of images) img.loading = 'eager';
    await Promise.all([
      document.fonts.ready,
      ...images.map((img) => img.decode().catch(() => undefined)),
    ]);
    if (!live) return;
    const cards = [...root.children].filter((c): c is HTMLElement => c instanceof HTMLElement);
    for (const c of cards) c.classList.add(className);
    // two frames: one to raster the tiles, one to draw them (the compiles happen in both)
    raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        for (const c of cards) c.classList.remove(className);
      });
    });
  };
  void run();
  return () => {
    live = false;
    cancelAnimationFrame(raf);
    for (const c of root.children) c.classList.remove(className);
  };
}
