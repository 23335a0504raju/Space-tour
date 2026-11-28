import type * as THREE from 'three';
import { INK, MONO as FONT, arc, createAtlasTexture, header, line } from '../holo/draw.ts';
import type { Ctx } from '../holo/draw.ts';
import { brackets, hudPainters } from '../holo/hud.ts';
import { sections } from '../sections.ts';
import { content, isPublishable } from '../../content/index.ts';
import { ATLAS, HUD_TOP, RECTS } from './holoLayout.ts';

/**
 * The pictures on the cockpit's floating screens (FINAL_STORYLINE.md SC04). Drawn once from the
 * content module, so the in-world screens can never disagree with the DOM text (which stays the
 * accessible source).
 */
const W = RECTS.experience.w;
const H = RECTS.experience.h;
const TEXT = '#f2fbff';
const MUTED = '#86d4f0';
const BODY = '#cdeefc';
/** The faint wash of an inner window (added light, so it barely tints the glass). */
const PANEL = '#031a28';

function wrap(ctx: Ctx, text: string, maxWidth: number): string[] {
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

/** An inner window of the glass, with a marker on its left edge. */
function entry(ctx: Ctx, y: number, height: number, first: boolean) {
  ctx.fillStyle = PANEL;
  ctx.fillRect(30, y, W - 60, height);
  brackets(ctx, 30, y, W - 60, height, INK.cyan);
  ctx.fillStyle = first ? INK.gold : INK.cyan;
  ctx.fillRect(30, y + 20, 6, height - 40);
}

/** The strip of marks along a record's foot: ornament, no figures. */
function footer(ctx: Ctx, y: number) {
  for (let i = 0; i < 64; i += 1) {
    ctx.fillStyle = i % 11 === 4 ? INK.gold : INK.dim;
    const tall = 5 + 13 * Math.abs(Math.sin(i * 1.9));
    ctx.fillRect(40 + i * 9, y - tall, 4, tall);
  }
  line(ctx, INK.faint, 2, 640, y - 4, W - 190, y - 4);
  for (let i = 0; i < 5; i += 1) {
    ctx.strokeStyle = i === 0 ? INK.gold : INK.cyan;
    ctx.lineWidth = 2;
    ctx.strokeRect(W - 170 + i * 28, y - 16, 18, 14);
  }
}

function experience(ctx: Ctx) {
  header(ctx, W, 'CREW RECORD · EXPERIENCE');
  let y = 90;
  content.experience.forEach((job, index) => {
    if (!isPublishable(job.role) || !isPublishable(job.organisation)) return;
    ctx.font = `24px ${FONT}`;
    const lines = wrap(ctx, job.summary.value, W - 120).slice(0, 3);
    const height = 112 + lines.length * 31;
    entry(ctx, y, height, index === 0);
    ctx.fillStyle = TEXT;
    ctx.font = `600 34px ${FONT}`;
    ctx.fillText(job.role.value, 60, y + 44);
    ctx.fillStyle = MUTED;
    ctx.font = `26px ${FONT}`;
    ctx.fillText(
      `${job.organisation.value}  ·  ${job.period.value.start} – ${job.period.value.end}`,
      60,
      y + 82,
    );
    ctx.fillStyle = BODY;
    ctx.font = `24px ${FONT}`;
    lines.forEach((l, i) => ctx.fillText(l, 60, y + 122 + i * 31));
    y += height + 18;
  });
  footer(ctx, H - 22);
}

function education(ctx: Ctx) {
  header(ctx, W, 'CREW RECORD · EDUCATION');
  let y = 94;
  const records = content.education.filter((x) => x.placement === 'journey');
  records.forEach((e, index) => {
    ctx.font = `600 31px ${FONT}`;
    const title = wrap(ctx, e.qualification.value, W - 120);
    const height = 112 + title.length * 40;
    entry(ctx, y, height, index === 0);
    ctx.fillStyle = TEXT;
    title.forEach((l, i) => ctx.fillText(l, 60, y + 48 + i * 40));
    const below = y + 50 + title.length * 40;
    ctx.fillStyle = MUTED;
    ctx.font = `26px ${FONT}`;
    ctx.fillText(e.institution.value, 60, below);
    ctx.fillStyle = BODY;
    ctx.fillText(
      `${e.period.value.start} – ${e.period.value.end}  ·  ${e.grade.value}`,
      60,
      below + 38,
    );
    y += height + 22;
  });
  footer(ctx, H - 22);
}

/** The journey as orbits round a planet, with the list of its stops beside it. */
function flightPlan(ctx: Ctx) {
  header(ctx, W, 'FLIGHT PLAN');
  const cx = 280;
  const cy = 346;
  // the planet and its lines
  for (const k of [1, 0.66, 0.32]) {
    ctx.strokeStyle = INK.cyan;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 78 * k, 78, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy, 78 * Math.sqrt(1 - (1 - k) ** 2), 78 * (1 - k), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  const orbits = [118, 158, 198, 236];
  for (const r of orbits) arc(ctx, r === 236 ? INK.cyan : INK.faint, 2, cx, cy, r);
  arc(ctx, INK.gold, 6, cx, cy, 218, 0.58, 0.74);
  arc(ctx, INK.cyan, 6, cx, cy, 218, 0.04, 0.2);
  sections.forEach((sec, i) => {
    const a = -Math.PI / 2 + i * 1.9;
    const r =
      orbits[Math.min(orbits.length - 1, Math.floor((i * orbits.length) / sections.length))]!;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    const active = i === 1;
    ctx.fillStyle = active ? INK.gold : TEXT;
    ctx.beginPath();
    ctx.arc(px, py, active ? 10 : 6, 0, Math.PI * 2);
    ctx.fill();
    arc(ctx, active ? INK.gold : INK.cyan, 2, px, py, active ? 20 : 13);
    // the list, with a leader line to the stop being read
    const ty = 130 + i * 66;
    ctx.fillStyle = PANEL;
    ctx.fillRect(570, ty - 34, W - 600, 50);
    brackets(ctx, 570, ty - 34, W - 600, 50, active ? INK.gold : INK.cyan);
    ctx.fillStyle = active ? INK.gold : MUTED;
    ctx.font = `24px ${FONT}`;
    ctx.fillText(String(i + 1).padStart(2, '0'), 592, ty);
    ctx.fillStyle = active ? INK.gold : TEXT;
    ctx.font = `600 30px ${FONT}`;
    ctx.fillText(sec.label, 650, ty);
    if (active) line(ctx, INK.gold, 2, px + 20, py, 540, ty - 9, 570, ty - 9);
  });
  ctx.fillStyle = INK.gold;
  ctx.font = `22px ${FONT}`;
  ctx.fillText('● CREW RECORD ACTIVE', 40, H - 18);
}

export function createCockpitAtlas(scale: number): THREE.CanvasTexture {
  return createAtlasTexture(
    ATLAS,
    [
      [RECTS.experience, experience],
      [RECTS.plan, flightPlan],
      [RECTS.education, education],
      ...hudPainters(HUD_TOP),
    ],
    scale,
  );
}
