import * as THREE from 'three';
import { textureContext } from '../../engine/assets/canvas2d.ts';
// This portfolio's own source code, shown on the monitors (no third-party code, no permission issue).
import resolverSource from '../../engine/scroll/resolver.ts?raw';

const KEYWORDS =
  /\b(export|import|from|const|let|function|return|if|else|for|of|type|interface|readonly|new|throw)\b/g;

/**
 * Draws a code editor frame onto a canvas texture. Static (drawn once), so it costs nothing per
 * frame; the monitor's emissive glow comes from the material.
 */
export function createCodeScreenTexture(
  firstLine = 0,
  width = 1024,
  height = 576,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = textureContext(canvas);
  if (!ctx) throw new Error('2D canvas unavailable');

  ctx.fillStyle = '#0b0e15';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#121725';
  ctx.fillRect(0, 0, width, 34);
  ctx.fillStyle = '#d6a756';
  ctx.font = '600 18px Consolas, "Cascadia Code", monospace';
  ctx.fillText('resolver.ts', 16, 23);

  const lines = resolverSource.split('\n').slice(firstLine, firstLine + 24);
  ctx.font = '18px Consolas, "Cascadia Code", monospace';
  lines.forEach((line, i) => {
    const y = 64 + i * 21;
    ctx.fillStyle = '#4a5368';
    ctx.fillText(String(firstLine + i + 1).padStart(3, ' '), 12, y);
    const isComment = line.trimStart().startsWith('//') || line.trimStart().startsWith('*');
    if (isComment) {
      ctx.fillStyle = '#5f6b80';
      ctx.fillText(line, 64, y);
      return;
    }
    // simple two-tone highlight: keywords gold, the rest light blue-grey
    let x = 64;
    for (const part of line.split(KEYWORDS)) {
      if (!part) continue;
      KEYWORDS.lastIndex = 0;
      ctx.fillStyle = KEYWORDS.test(part) && part.match(/^[a-z]+$/) ? '#d6a756' : '#b8c4dc';
      ctx.fillText(part, x, y);
      x += ctx.measureText(part).width;
    }
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
