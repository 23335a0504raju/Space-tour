import { create } from 'zustand';
import type { QualityTier } from './quality/pixelBudget.ts';

/**
 * Discrete app state only (STACK_DECISIONS.md §3.7). Per-frame values (progress, camera,
 * local t) never live here; they are in the mutable JourneyFrame read by render loops.
 */
export type WebglStatus = 'ok' | 'unsupported' | 'lost';

interface JourneyStore {
  readonly activeIndex: number;
  readonly tier: QualityTier;
  readonly webgl: WebglStatus;
  /** Jump to a chapter; registered by the journey once it is ready (null before). */
  readonly navigate: ((chapterId: string) => void) | null;
  /** Project Bay: the open project's id, or null when closed. */
  readonly bayProject: string | null;
  /** Start gate passed (Begin pressed, or skipped with ?gate=off). Before it, scroll is locked. */
  readonly entered: boolean;
  /** Every journey asset downloaded (or the preload gave up); chapters mount only after this. */
  readonly assetsReady: boolean;
  setActiveIndex(index: number): void;
  setTier(tier: QualityTier): void;
  setWebgl(status: WebglStatus): void;
  setNavigate(fn: ((chapterId: string) => void) | null): void;
  openBay(projectId: string): void;
  closeBay(): void;
  enter(): void;
  setAssetsReady(): void;
}

export const useJourneyStore = create<JourneyStore>((set) => ({
  activeIndex: 0,
  tier: 'balanced',
  webgl: 'ok',
  navigate: null,
  bayProject: null,
  entered: typeof window !== 'undefined' && window.location.search.includes('gate=off'),
  setActiveIndex: (activeIndex) => set({ activeIndex }),
  setTier: (tier) => set({ tier }),
  setWebgl: (webgl) => set({ webgl }),
  setNavigate: (navigate) => set({ navigate }),
  openBay: (bayProject) => set({ bayProject }),
  closeBay: () => set({ bayProject: null }),
  enter: () => set({ entered: true }),
  assetsReady: false,
  setAssetsReady: () => set({ assetsReady: true }),
}));
