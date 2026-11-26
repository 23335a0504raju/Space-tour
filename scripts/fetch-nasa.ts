/**
 * Downloads the NASA public-domain planet maps for SC06 (approved by Raju 2026-11-17) into
 * raw-assets/nasa/ (gitignored; raw downloads never ship) and encodes web versions into
 * public/assets/textures/ with KTX-Software:
 *   Earth day    Blue Marble Next Generation, July 2004, 5400×2700  → 4096×2048 + 2048×1024 KTX2
 *   Earth night  Black Marble 2016 colour, 3600×1800                → 2048×1024 KTX2
 *   Mars         Viking MDIM 2.1 colour mosaic (via Wikimedia Commons)    → 2048×1024 KTX2
 *   Moon         SVS CGI Moon Kit, LROC colour, 1K                  → 1024×512 KTX2
 *   Venus, Uranus, Neptune (SC10): Solar System Scope maps via Wikimedia Commons. These are CC BY 4.0
 *   (based on NASA data, colours adjusted), not public domain: credited in the Mission Brief footer.
 * All colour maps (sRGB), ETC1S, mipmapped. Prints sizes and SHA-256 for the asset register.
 * Outputs that already exist are kept (pass --force to re-encode them).
 *   node scripts/fetch-nasa.ts [--force]
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const RAW = join(ROOT, 'raw-assets', 'nasa');
const OUT = join(ROOT, 'public', 'assets', 'textures');

const SOURCES = [
  {
    id: 'earth_day',
    url: 'https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography-bathymetry/july/world.topo.bathy.200407.3x5400x2700.jpg',
    file: 'world.topo.bathy.200407.3x5400x2700.jpg',
    outputs: [
      ['earth_day_4k.ktx2', '4096x2048'],
      ['earth_day_2k.ktx2', '2048x1024'],
    ],
  },
  {
    id: 'earth_night',
    url: 'https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg',
    file: 'BlackMarble_2016_01deg.jpg',
    outputs: [['earth_night_2k.ktx2', '2048x1024']],
  },
  {
    id: 'moon',
    url: 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_1k.jpg',
    file: 'lroc_color_poles_1k.jpg',
    outputs: [['moon_1k.ktx2', '1024x512']],
  },
  {
    id: 'mars',
    // Viking MDIM 2.1 colorized global mosaic (NASA/JPL/USGS, public domain) via Wikimedia Commons
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Mars_Viking_MDIM21_ClrMosaic_1km.jpg?width=2048',
    file: 'mars_viking_mdim21_2048.jpg',
    outputs: [['mars_2k.ktx2', '2048x1024']],
  },
  {
    id: 'jupiter',
    // Cassini narrow-angle cylindrical map, PIA07782 (NASA/JPL/SSI), via Wikimedia Commons
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Jupiter_Cylindrical_Map_-_Dec_2000_PIA07782.jpg?width=2048',
    file: 'jupiter_pia07782_2048.jpg',
    outputs: [['jupiter_2k.ktx2', '2048x1024']],
  },
  {
    id: 'venus',
    // cloud tops (what Venus looks like from space); Solar System Scope, CC BY 4.0, via Commons
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Solarsystemscope_texture_2k_venus_atmosphere.jpg',
    file: 'sss_2k_venus_atmosphere.jpg',
    outputs: [['venus_1k.ktx2', '1024x512']],
  },
  {
    id: 'uranus',
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Solarsystemscope_texture_2k_uranus.jpg',
    file: 'sss_2k_uranus.jpg',
    outputs: [['uranus_1k.ktx2', '1024x512']],
  },
  {
    id: 'neptune',
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Solarsystemscope_texture_2k_neptune.jpg',
    file: 'sss_2k_neptune.jpg',
    outputs: [['neptune_1k.ktx2', '1024x512']],
  },
] as const;

const force = process.argv.includes('--force');

const ktxBin = join(process.env['LOCALAPPDATA'] ?? '', 'Programs', 'KTX-Software', 'bin');
const env = { ...process.env, PATH: `${process.env['PATH'] ?? ''}${delimiter}${ktxBin}` };
const kb = (p: string) => `${(statSync(p).size / 1024).toFixed(0)} KB`;

mkdirSync(RAW, { recursive: true });
mkdirSync(OUT, { recursive: true });

for (const s of SOURCES) {
  const raw = join(RAW, s.file);
  if (!existsSync(raw)) {
    // Wikimedia asks automated clients for a descriptive User-Agent
    const res = await fetch(s.url, { headers: { 'User-Agent': 'portfolio-asset-fetch/1.0' } });
    if (!res.ok) throw new Error(`${s.url}: HTTP ${res.status}`);
    const type = res.headers.get('content-type') ?? '';
    if (!type.startsWith('image/')) throw new Error(`${s.url}: unexpected content-type ${type}`);
    writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
  }
  const sha = createHash('sha256').update(readFileSync(raw)).digest('hex');
  console.log(`raw     ${s.file}  ${kb(raw)}  sha256 ${sha}`);
  for (const [name, size] of s.outputs) {
    const out = join(OUT, name);
    if (existsSync(out) && !force) {
      console.log(`  kept  ${name}  ${kb(out)}`);
      continue;
    }
    const r = spawnSync(
      'toktx',
      [
        '--t2',
        '--encode',
        'etc1s',
        '--clevel',
        '2',
        '--qlevel',
        '200',
        '--genmipmap',
        '--resize',
        size,
        '--assign_oetf',
        'srgb',
        out,
        raw,
      ],
      // toktx is a plain executable: no shell (avoids unescaped-argument issues)
      { env, stdio: ['ignore', 'ignore', 'pipe'] },
    );
    if (r.status !== 0) throw new Error(`toktx ${name}\n${r.stderr?.toString() ?? ''}`);
    console.log(`  →     ${name}  ${size}  ${kb(out)}`);
  }
}
