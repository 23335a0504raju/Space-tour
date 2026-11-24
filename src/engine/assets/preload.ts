import * as THREE from 'three';

/**
 * Every file the journey loads, fetched once during the start gate (FIX_LIST 8: "download
 * everything before showing the pages"). Kept in sync with the code by preload.test.ts.
 * Not listed on purpose: earth_day_4k.ktx2 (fetched by the NASA script, not used by any chapter).
 */
export const JOURNEY_ASSETS: readonly string[] = [
  // decoders first: every KTX2 texture needs them
  '/basis/basis_transcoder.js',
  '/basis/basis_transcoder.wasm',
  // SC02 room
  '/assets/env/empty_warehouse_01_1k.hdr',
  '/assets/models/astronaut.glb',
  '/assets/models/astronaut-eva.glb',
  '/assets/models/bridge.glb',
  '/assets/models/metal_office_desk.glb',
  '/assets/models/modern_arm_chair_01.glb',
  '/assets/models/desk_lamp_arm_01.glb',
  '/assets/models/potted_plant_04.glb',
  '/assets/models/office_notepads.glb',
  '/assets/models/Shelf_01.glb',
  '/assets/models/modern_ceiling_lamp_01.glb',
  // ship and space
  '/assets/models/helvela.glb',
  '/assets/models/launch-pad.glb',
  '/assets/models/nasa_bennu.glb',
  '/assets/models/nasa_bennu_mid.glb',
  '/assets/models/nasa_bennu_lo.glb',
  '/assets/models/nasa_juno.glb',
  '/assets/models/nasa_landsat8.glb',
  '/assets/models/nasa_voyager.glb',
  // SC11 anime worlds
  '/assets/models/anime_naruto.glb',
  '/assets/models/anime_ichiraku.glb',
  '/assets/models/anime_deathnote.glb',
  '/assets/models/anime_ryuk.glb',
  '/assets/models/anime_kinnaird.glb',
  '/assets/models/anime_tanjiro.glb',
  '/assets/models/anime_nezuko.glb',
  '/assets/models/anime_katana.glb',
  '/assets/models/anime_farm.glb',
  '/assets/models/anime_town.glb',
  '/assets/models/anime_rural.glb',
  '/assets/textures/earth_day_2k.ktx2',
  '/assets/textures/earth_night_2k.ktx2',
  '/assets/textures/moon_1k.ktx2',
  '/assets/textures/mars_2k.ktx2',
  '/assets/textures/jupiter_2k.ktx2',
  // Project Bay images (plain <img>: these only warm the HTTP cache)
  '/assets/projects/smartway-traffic.webp',
  '/assets/projects/documentdb.webp',
  '/assets/projects/stash.webp',
];

export interface PreloadProgress {
  /** 0..1, weighted by bytes once sizes are known. */
  readonly fraction: number;
  /** Files finished so far, in completion order. */
  readonly done: readonly string[];
}

/** Downloaded files as in-memory blob URLs; three.js loaders are pointed at them. */
const blobUrls = new Map<string, string>();
let installed = false;

function installUrlModifier() {
  if (installed) return;
  installed = true;
  // Every three.js FileLoader (GLTF, KTX2 and its transcoder, HDR) resolves through the default
  // manager. A blob URL hands each load a fresh ArrayBuffer, so workers that transfer (detach)
  // buffers, like KTX2's, never break a later load of the same file.
  THREE.DefaultLoadingManager.setURLModifier((url) => {
    const hit = blobUrls.get(url);
    if (hit) return hit;
    try {
      return blobUrls.get(new URL(url, window.location.href).pathname) ?? url;
    } catch {
      return url;
    }
  });
}

/** Average size used for a file whose size is not known yet (keeps the bar honest early on). */
const GUESS_BYTES = 350_000;

const size = new Map<string, number>();
const got = new Map<string, number>();
const done: string[] = [];
const listeners = new Set<(p: PreloadProgress) => void>();
let running: Promise<void> | null = null;

function snapshot(): PreloadProgress {
  let total = 0;
  let loaded = 0;
  for (const url of JOURNEY_ASSETS) {
    const s = size.get(url) ?? GUESS_BYTES;
    total += s;
    loaded += done.includes(url) ? s : Math.min(s, got.get(url) ?? 0);
  }
  return { fraction: total ? loaded / total : 1, done: [...done] };
}

function report() {
  const p = snapshot();
  for (const l of listeners) l(p);
}

async function fetchOne(url: string) {
  try {
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(String(res.status));
    // a compressed response's length is not the byte count we read: treat it as unknown
    const len = Number(res.headers.get('content-length'));
    if (len > 0 && !res.headers.get('content-encoding')) size.set(url, len);
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let n = 0;
    for (;;) {
      const { done: end, value } = await reader.read();
      if (end) break;
      chunks.push(value);
      n += value.byteLength;
      got.set(url, n);
      report();
    }
    if (!size.has(url)) size.set(url, n);
    const type = res.headers.get('content-type') ?? 'application/octet-stream';
    blobUrls.set(url, URL.createObjectURL(new Blob(chunks as BlobPart[], { type })));
  } catch {
    // leave it to the normal loader
  } finally {
    done.push(url);
    report();
  }
}

/**
 * Download all journey assets once (later calls share the same run), reporting byte progress to
 * `onProgress` until the returned unsubscribe is called. A failed file is skipped (its loader
 * falls back to the network later); the promise never rejects, so the gate can never get stuck.
 */
export function preloadJourney(onProgress?: (p: PreloadProgress) => void): {
  readonly finished: Promise<void>;
  readonly unsubscribe: () => void;
} {
  installUrlModifier();
  if (onProgress) listeners.add(onProgress);
  if (!running) {
    // 4 at a time: fast on HTTP/2, polite on HTTP/1 and mobile radios
    const queue = [...JOURNEY_ASSETS];
    const worker = async () => {
      for (let url = queue.shift(); url; url = queue.shift()) await fetchOne(url);
    };
    running = Promise.all([worker(), worker(), worker(), worker()]).then(() => undefined);
  }
  onProgress?.(snapshot());
  return {
    finished: running,
    unsubscribe: () => {
      if (onProgress) listeners.delete(onProgress);
    },
  };
}
