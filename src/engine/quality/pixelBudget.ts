/**
 * Render-resolution control by pixel budget (PERFORMANCE_AND_ACCESSIBILITY_PLAN.md §2).
 * On an integrated GPU, fill rate dominates, so we cap total rendered pixels instead of
 * trusting the display's device pixel ratio.
 */
export type QualityTier = 'balanced' | 'low';

export const PIXEL_BUDGET_MP: Record<QualityTier, number> = {
  balanced: 2.1,
  low: 0.9,
};

/** Largest DPR ≤ deviceDpr that keeps width×height×dpr² within the budget (never below minDpr). */
export function dprForBudget(
  cssWidth: number,
  cssHeight: number,
  deviceDpr: number,
  budgetMegapixels: number,
  minDpr = 0.5,
): number {
  const area = Math.max(1, cssWidth) * Math.max(1, cssHeight);
  const fit = Math.sqrt((budgetMegapixels * 1_000_000) / area);
  const dpr = Math.min(deviceDpr, fit);
  return Math.max(minDpr, Math.round(dpr * 100) / 100);
}
