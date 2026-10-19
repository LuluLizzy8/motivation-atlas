/** Three kinds of pebble, each with its own bowl. */
export type Kind = 0 | 1 | 2;
export interface SortOptions {
  /** On: a move counter in place of a clock, and no way to run out of time. Off: a clock of `seconds`. */
  moveCounter: boolean;
  pebbles: number;
  seconds: number;
}
export interface SortState {
  options: SortOptions;
  /** Pebbles still to sort. The first is the one in your hand. */
  basket: Kind[];
  sorted: number;
  moves: number;
  /** Milliseconds on the clock since the first move. Stays 0 with the move counter on. */
  elapsed: number;
  status: "ready" | "playing" | "cleared" | "timeUp";
  lastEvent: "start" | "sorted" | "bounced";
}

export const KINDS: readonly Kind[] = [0, 1, 2];
export const PEBBLES = 30;
export const SECONDS = 20;

export function newRound(options: SortOptions, random: () => number = Math.random): SortState {
  const basket = Array.from({ length: options.pebbles }, () => Math.floor(random() * KINDS.length) as Kind);
  return { options, basket, sorted: 0, moves: 0, elapsed: 0, status: "ready", lastEvent: "start" };
}

export function isOver(s: SortState): boolean {
  return s.status === "cleared" || s.status === "timeUp";
}

/** Drop the pebble in your hand into a bowl. The right bowl keeps it; a wrong one hands it back. */
export function place(s: SortState, bowl: number): SortState {
  if (isOver(s)) return s;
  if (!KINDS.includes(bowl as Kind)) throw new RangeError(`bowl must be 0, 1 or 2, got ${bowl}`);
  const moves = s.moves + 1;
  if (bowl !== s.basket[0]) return { ...s, moves, status: "playing", lastEvent: "bounced" };
  const basket = s.basket.slice(1);
  return { ...s, basket, moves, sorted: s.sorted + 1, status: basket.length === 0 ? "cleared" : "playing", lastEvent: "sorted" };
}

/** Let time pass. Only the clock reads time: with the move counter on, nothing changes. */
export function tick(s: SortState, ms: number): SortState {
  if (s.options.moveCounter || s.status !== "playing") return s;
  const limit = s.options.seconds * 1000;
  const elapsed = Math.min(limit, s.elapsed + ms);
  return { ...s, elapsed, status: elapsed >= limit ? "timeUp" : "playing" };
}

/** Milliseconds left on the clock, or Infinity with the move counter on. */
export function timeLeft(s: SortState): number {
  return s.options.moveCounter ? Infinity : s.options.seconds * 1000 - s.elapsed;
}
