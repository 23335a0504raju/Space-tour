/**
 * Raju's own photo, re-encoded for the journey (A061, A062). Reads the original he supplied from
 * raw-assets/me/ (gitignored; raw sources never ship) and writes:
 *   portrait.webp   head and shoulders for the DOM (crew record, contact card, Mission Brief)
 *   hologram.ktx2   the figure alone (head to the bottom of the photo), background transparent,
 *                   for the desk hologram
 *   node scripts/prepare-portraits.ts [--preview=<file.png>]
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import sharp from 'sharp';

const ROOT = join(import.meta.dirname, '..');
const PHOTO = join(ROOT, 'raw-assets', 'me', 'raju-outdoor.jpeg'); // 900×1094
const OUT = join(ROOT, 'public', 'assets', 'me');

/** Crops in source pixels. */
const DOM_CROP = { left: 398, top: 335, width: 380, height: 380 };
/** The traced figure with a little air; the output's sides are multiples of 4 for GPU formats. */
const HOLO_CROP = { left: 228, top: 352, width: 660, height: 742 };
const HOLO_SIZE = { width: 640, height: 720 };

/** The silhouette, traced by hand on this photo (source pixels, clockwise from the lower left). */
// prettier-ignore
const OUTLINE = [
  [320, 827], [322, 800], [330, 780], [340, 760], [350, 740],
  [360, 721], [370, 712], [387, 705], [417, 698], [440, 695], [457, 689], [480, 682], [500, 674],
  [514, 665], [517, 645], [508, 622], [498, 601], [490, 587], [485, 573], [482, 553], [481, 537],
  [485, 529], [490, 524], [481, 513], [473, 500], [471, 480], [473, 463], [478, 450], [485, 440],
  [489, 430], [498, 420], [508, 407], [520, 400], [528, 390], [540, 383], [550, 374], [564, 370],
  [580, 370], [597, 373], [613, 373], [627, 378], [640, 384], [653, 391], [663, 401], [673, 406],
  [684, 418], [694, 431], [701, 444], [704, 460], [702, 480], [697, 500], [691, 516], [687, 526],
  [694, 537], [693, 553], [687, 570], [679, 583], [674, 597], [663, 599], [657, 608], [651, 623],
  [647, 635], [648, 652], [667, 665], [680, 678], [690, 690], [697, 707], [710, 716], [733, 727],
  [760, 739], [790, 753], [817, 772], [833, 787], [842, 802], [847, 820], [855, 840], [863, 867],
  [867, 893], [865, 930], [869, 965], [872, 1007], [876, 1035], [874, 1049], [879, 1070],
  [881, 1094], [426, 1094], [424, 1060], [421, 1039], [418, 1021], [414, 997], [408, 980],
  [401, 986], [392, 1002], [382, 1014], [372, 1035], [359, 1060], [347, 1081], [340, 1094],
  [233, 1094], [239, 1088], [249, 1063], [261, 1040], [256, 1037], [260, 1025], [275, 1000],
  [268, 995], [270, 986], [288, 976], [298, 948], [307, 906], [314, 860],
];

const ktxBin = join(process.env['LOCALAPPDATA'] ?? '', 'Programs', 'KTX-Software', 'bin');
const env = { ...process.env, PATH: `${process.env['PATH'] ?? ''}${delimiter}${ktxBin}` };
const work = mkdtempSync(join(tmpdir(), 'portraits-'));

function report(out: string) {
  console.log(`  → ${out.slice(ROOT.length + 1)}  ${(statSync(out).size / 1024).toFixed(0)} KB`);
}

/** UASTC: faces break up into blocks under ETC1S. */
function toKtx2(png: string, out: string) {
  const r = spawnSync(
    'toktx',
    [
      '--t2',
      '--encode',
      'uastc',
      '--uastc_rdo_l',
      '0.75',
      '--zcmp',
      '19',
      '--genmipmap',
      '--assign_oetf',
      'srgb',
      out,
      png,
    ],
    { env, stdio: ['ignore', 'ignore', 'pipe'] },
  );
  if (r.status !== 0) throw new Error(`toktx ${out}\n${r.stderr?.toString() ?? ''}`);
  report(out);
}

/** Mean of the (2r+1)² square round every pixel. */
function boxMean(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const sum = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y += 1) {
    let row = 0;
    for (let x = 0; x < w; x += 1) {
      row += src[y * w + x]!;
      sum[(y + 1) * (w + 1) + x + 1] = sum[y * (w + 1) + x + 1]! + row;
    }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y += 1) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x += 1) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w, x + r + 1);
      const s =
        sum[y1 * (w + 1) + x1]! -
        sum[y0 * (w + 1) + x1]! -
        sum[y1 * (w + 1) + x0]! +
        sum[y0 * (w + 1) + x0]!;
      out[y * w + x] = s / ((x1 - x0) * (y1 - y0));
    }
  }
  return out;
}

/**
 * The photo with everything outside the traced figure made transparent. A guided filter pulls the
 * traced edge onto the photo's own edges (hair, collar), which a hand-drawn polygon only follows
 * roughly.
 */
async function cutOut(): Promise<Buffer> {
  const { data, info } = await sharp(PHOTO)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#000"/><polygon fill="#fff" points="${OUTLINE.join(' ')}"/></svg>`;
  const traced = await sharp(Buffer.from(svg)).extractChannel(0).raw().toBuffer();
  const guide = new Float32Array(w * h);
  const mask = new Float32Array(w * h);
  for (let i = 0; i < w * h; i += 1) {
    guide[i] =
      (0.2126 * data[i * 3]! + 0.7152 * data[i * 3 + 1]! + 0.0722 * data[i * 3 + 2]!) / 255;
    mask[i] = traced[i]! / 255;
  }
  const R = 5;
  const EPS = 0.002;
  const mean = (a: Float32Array) => boxMean(a, w, h, R);
  const mI = mean(guide);
  const mP = mean(mask);
  const mII = mean(guide.map((v) => v * v));
  const mIP = mean(guide.map((v, i) => v * mask[i]!));
  const a = mI.map((v, i) => (mIP[i]! - v * mP[i]!) / (mII[i]! - v * v + EPS));
  const b = mP.map((v, i) => v - a[i]! * mI[i]!);
  const mA = mean(a);
  const mB = mean(b);
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i += 1) {
    data.copy(rgba, i * 4, i * 3, i * 3 + 3);
    // firm the soft result up so no halo of background is left
    const q = (mA[i]! * guide[i]! + mB[i]! - 0.3) / 0.45;
    rgba[i * 4 + 3] = Math.round(Math.min(1, Math.max(0, q)) * 255);
  }
  return sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toBuffer();
}

for (const f of [PHOTO]) {
  const sha = createHash('sha256').update(readFileSync(f)).digest('hex');
  console.log(`source ${f}  sha256 ${sha.slice(0, 7)}…${sha.slice(-4)}`);
}
mkdirSync(OUT, { recursive: true });
try {
  const dom = join(OUT, 'portrait.webp');
  await sharp(PHOTO).extract(DOM_CROP).resize(400, 400).webp({ quality: 84 }).toFile(dom);
  report(dom);

  const holoPng = join(work, 'hologram.png');
  await sharp(await cutOut())
    .extract(HOLO_CROP)
    .resize(HOLO_SIZE.width, HOLO_SIZE.height, { fit: 'fill' })
    .toFile(holoPng);
  // a copy for review, outside the shipped folder
  const preview = process.argv.find((a) => a.startsWith('--preview='))?.slice(10);
  if (preview) await sharp(holoPng).flatten({ background: '#0a3050' }).toFile(preview);
  toKtx2(holoPng, join(OUT, 'hologram.ktx2'));
} finally {
  rmSync(work, { recursive: true, force: true });
}
