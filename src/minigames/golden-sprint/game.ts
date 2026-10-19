/** Per-second hunger drain for each room, including the 10% comfort adjustment. */
export const ROOM_DRAIN_RATES = [1.728, 2.448, 3.168, 3.888];

export interface ScoreEntry {
  name: string;
  time: number;
  points: number;
}

/** Higher points rank first; equal scores are broken by faster completion. */
export function rankScores<T extends ScoreEntry>(scores: T[]): T[] {
  return [...scores].sort((a, b) => b.points - a.points || a.time - b.time || a.name.localeCompare(b.name));
}

export function drainNourishment(health: number, seconds: number, enabled: boolean, rate: number): number {
  if (!enabled) return health;
  return Math.max(0, health - Math.max(0, seconds) * Math.max(0, rate));
}
