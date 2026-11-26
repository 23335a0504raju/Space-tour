/**
 * A 2D context for a canvas that becomes a WebGL texture (CanvasTexture, generated maps).
 *
 * Chrome draws 2D canvases on the GPU by default (Skia Graphite on Dawn on this hardware). The first
 * time a kind of draw appears in a session (a radial gradient, a blurred shadow, a new text mode),
 * Skia compiles a GPU pipeline for it in the GPU process, and turning the canvas into a WebGL texture
 * waits for that work: SolarSystem's two 256 px glow sprites cost a 220–375 ms stall in SC09 when
 * SC10 mounted (scripts/measure-freezes.ts --why, Chrome trace: DoEndRasterCHROMIUM + Dawn workers).
 *
 * `willReadFrequently` keeps the canvas in CPU memory: Skia rasterises it in software (no pipeline
 * compiles), and the texture upload is a plain copy instead of a GPU readback. Canvases shown on
 * the page (the start gate's ring) keep the default GPU canvas.
 */
export function textureContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  return canvas.getContext('2d', { willReadFrequently: true });
}
