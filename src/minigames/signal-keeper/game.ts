export const TRIAL_MS = 6000;
export const TRIALS = 10;
export const INITIAL_WIDTH = 36;

/** A sweep out and back every three seconds, independent of frame rate. */
export function markerPosition(elapsed: number): number {
  const phase = (Math.max(0, elapsed) % 3000) / 1500;
  return (phase <= 1 ? phase : 2 - phase) * 100;
}
export function isHit(position: number, width: number): boolean {
  return Math.abs(position - 50) <= width / 2;
}
/** Only adaptive mode changes the target; misses widen it for recovery. */
export function nextWidth(width: number, hit: boolean, adaptive: boolean): number {
  return adaptive ? Math.max(3, Math.min(60, width + (hit ? -6 : 6))) : INITIAL_WIDTH;
}
