/** Device/GPU description for benchmark reports. Read once; no fingerprinting beyond this local report. */
export interface DeviceInfo {
  readonly userAgent: string;
  readonly gpuRenderer: string;
  readonly gpuVendor: string;
  readonly screen: string;
  readonly devicePixelRatio: number;
  readonly hardwareConcurrency: number | null;
  readonly deviceMemoryGb: number | null;
}

export function readDeviceInfo(gl: WebGL2RenderingContext | WebGLRenderingContext): DeviceInfo {
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = debug
    ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
    : gl.getParameter(gl.RENDERER);
  const vendor = debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    userAgent: navigator.userAgent,
    gpuRenderer: String(renderer),
    gpuVendor: String(vendor),
    screen: `${window.screen.width}×${window.screen.height}`,
    devicePixelRatio: window.devicePixelRatio,
    hardwareConcurrency: navigator.hardwareConcurrency ?? null,
    deviceMemoryGb: nav.deviceMemory ?? null,
  };
}
