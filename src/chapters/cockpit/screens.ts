import * as THREE from 'three';
import { textureContext } from '../../engine/assets/canvas2d.ts';
import { sections } from '../sections.ts';
import { content, isPublishable } from '../../content/index.ts';

/**
 * Diegetic cockpit displays (FINAL_STORYLINE.md SC04). Drawn once from the content module, so the
 * in-world screens can never disagree with the DOM text (which stays the accessible source).
 */
const W = 1024;
const H = 640;
const GOLD = '#d6a756';
const TEXT = '#dfe6f2';
const MUTED = '#7f8aa0';
const FONT = 'Consolas, "Cascadia Code", monospace';

function frame(title: string): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = textureContext(canvas);
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.fillStyle = '#060a12';
  ctx.fillRect(0, 0, W, H);
  // scanline texture, very faint
  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  ctx.strokeStyle = 'rgba(214,167,86,0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(14, 14, W - 28, H - 28);
  ctx.fillStyle = GOLD;
  ctx.font = `600 30px ${FONT}`;
  ctx.fillText(title, 40, 66);
  ctx.fillStyle = 'rgba(214,167,86,0.35)';
  ctx.fillRect(40, 84, W - 80, 2);
  return { canvas, ctx };
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function toTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function experienceScreen(): THREE.CanvasTexture {
  const { canvas, ctx } = frame('CREW RECORD · EXPERIENCE');
  let y = 140;
  for (const job of content.experience) {
    if (!isPublishable(job.role) || !isPublishable(job.organisation)) continue;
    ctx.fillStyle = TEXT;
    ctx.font = `600 34px ${FONT}`;
    ctx.fillText(job.role.value, 40, y);
    ctx.fillStyle = MUTED;
    ctx.font = `26px ${FONT}`;
    ctx.fillText(
      `${job.organisation.value}  ·  ${job.period.value.start} – ${job.period.value.end}`,
      40,
      y + 40,
    );
    ctx.fillStyle = '#aab6cc';
    ctx.font = `24px ${FONT}`;
    const lines = wrap(ctx, job.summary.value, W - 80).slice(0, 3);
    lines.forEach((l, i) => ctx.fillText(l, 40, y + 84 + i * 32));
    y += 84 + lines.length * 32 + 48;
  }
  return toTexture(canvas);
}

export function educationScreen(): THREE.CanvasTexture {
  const { canvas, ctx } = frame('CREW RECORD · EDUCATION');
  let y = 150;
  for (const e of content.education.filter((x) => x.placement === 'journey')) {
    ctx.fillStyle = TEXT;
    ctx.font = `600 32px ${FONT}`;
    for (const l of wrap(ctx, e.qualification.value, W - 80)) {
      ctx.fillText(l, 40, y);
      y += 40;
    }
    ctx.fillStyle = MUTED;
    ctx.font = `26px ${FONT}`;
    ctx.fillText(`${e.institution.value}`, 40, y + 4);
    ctx.fillText(
      `${e.period.value.start} – ${e.period.value.end}  ·  ${e.grade.value}`,
      40,
      y + 40,
    );
    y += 110;
  }
  return toTexture(canvas);
}

export function flightPlanScreen(): THREE.CanvasTexture {
  const { canvas, ctx } = frame('FLIGHT PLAN');
  // the visitor's sections (same list as the header, progress bar and Flight Plan menu), not the
  // internal chapter codes
  sections.forEach((sec, i) => {
    const y = 150 + i * 62;
    ctx.fillStyle = i === 1 ? GOLD : MUTED;
    ctx.font = `26px ${FONT}`;
    ctx.fillText(String(i + 1).padStart(2, '0'), 40, y);
    ctx.fillStyle = i === 1 ? GOLD : TEXT;
    ctx.font = `600 32px ${FONT}`;
    ctx.fillText(sec.label, 130, y);
    ctx.fillStyle = 'rgba(127,138,160,0.35)';
    ctx.fillRect(40, y + 18, W - 80, 1);
  });
  ctx.fillStyle = GOLD;
  ctx.font = `24px ${FONT}`;
  ctx.fillText('● CREW RECORD ACTIVE', 40, H - 48);
  return toTexture(canvas);
}
