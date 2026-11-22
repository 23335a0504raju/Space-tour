import type { QualityTier } from './pixelBudget.ts';

export interface DeviceSignals {
  readonly webgl2: boolean;
  readonly deviceMemoryGb: number | null;
  readonly cores: number | null;
  readonly saveData: boolean;
  readonly coarsePointer: boolean;
}

export type Recommendation = QualityTier | 'brief';

/**
 * Initial quality guess from cheap signals (PERFORMANCE_AND_ACCESSIBILITY_PLAN.md §2).
 * Pure, so it is unit-tested. Runtime adaptation refines it later.
 */
export function recommendTier(s: DeviceSignals): Recommendation {
  if (!s.webgl2) return 'brief';
  if (s.saveData) return 'low';
  if (s.deviceMemoryGb !== null && s.deviceMemoryGb <= 4) return 'low';
  if (s.cores !== null && s.cores <= 4) return 'low';
  if (s.coarsePointer) return 'low';
  return 'balanced';
}

export function readDeviceSignals(): DeviceSignals {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  // The API's presence, not a probe context: creating a throwaway WebGL2 context froze the page
  // for ~0.6 s at start-up (profile, 2026-11-22). A context that later fails is reported by the
  // canvas itself (webgl status 'lost').
  const webgl2 = typeof WebGL2RenderingContext !== 'undefined';
  return {
    webgl2,
    deviceMemoryGb: nav.deviceMemory ?? null,
    cores: navigator.hardwareConcurrency ?? null,
    saveData: nav.connection?.saveData === true,
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
  };
}

const KEY = 'mission.quality';

/** Manual override (High/Low menu), remembered per browser. Storage may be unavailable. */
export function readTierOverride(): QualityTier | null {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === 'balanced' || v === 'low' ? v : null;
  } catch {
    return null;
  }
}

export function writeTierOverride(tier: QualityTier): void {
  try {
    window.localStorage.setItem(KEY, tier);
  } catch {
    // Storage blocked (private mode etc.): the choice simply isn't remembered.
  }
}
