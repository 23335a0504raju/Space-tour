import type { WebGLRenderer } from 'three';
import type { useGLTF } from '@react-three/drei';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

/**
 * Shared loader configuration (asset-pipeline skill: configure decoders once, never per component).
 * Basis transcoder files are served from /basis/ (copied from three/examples/jsm/libs/basis).
 * Meshopt decoding is enabled by drei's useGLTF; Draco is deliberately not used.
 */
const TRANSCODER_PATH = '/basis/';
const ktx2ByRenderer = new WeakMap<WebGLRenderer, KTX2Loader>();

export function getKTX2Loader(gl: WebGLRenderer): KTX2Loader {
  let loader = ktx2ByRenderer.get(gl);
  if (!loader) {
    loader = new KTX2Loader().setTranscoderPath(TRANSCODER_PATH).detectSupport(gl);
    ktx2ByRenderer.set(gl, loader);
  }
  return loader;
}

/** drei's loader-extension callback type (typed against three-stdlib's GLTFLoader). */
type ExtendLoader = NonNullable<Parameters<typeof useGLTF>[3]>;

/**
 * Pass as drei useGLTF's `extendLoader` argument: useGLTF(url, false, true, gltfExtender(gl)).
 * three-stdlib's GLTFLoader accepts three's KTX2Loader at runtime (verified in spike S3);
 * only the TypeScript declarations differ, hence the narrow structural cast.
 */
export const gltfExtender =
  (gl: WebGLRenderer): ExtendLoader =>
  (loader) => {
    (loader as unknown as { setKTX2Loader(l: KTX2Loader): void }).setKTX2Loader(getKTX2Loader(gl));
  };
