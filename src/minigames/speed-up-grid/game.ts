// Rules for Speed-up. No DOM code here, so the rules can be tested on their own.

export interface SpeedUpOptions { escalation: boolean }
export interface SpeedUpState {
  options: SpeedUpOptions;
  /** Which of the 9 cells (0 to 8) is lit. */
  target: number;
  hits: number;
  misses: number;
  /** How long the target stays lit before it moves, in milliseconds. */
  window: number;
  /** Milliseconds of play left in the round. */
  timeLeft: number;
  over: boolean;
}

export const CELLS = 9;
export const LIVES = 3;
export const ROUND_MS = 45_000;
export const START_WINDOW = 1100;
export const MIN_WINDOW = 320;
/** With escalation on, each hit multiplies the window by this. */
export const SPEED_UP = 0.95;

export function nextWindow(window: number, escalation: boolean): number {
  if (!escalation) return window;
  return Math.max(MIN_WINDOW, Math.round(window * SPEED_UP));
}

function pickCell(previous: number, random: () => number): number {
  // Never light the same cell twice in a row, so every hit asks for a new move.
  const step = 1 + Math.floor(random() * (CELLS - 1));
  return (previous + step) % CELLS;
}

export function newGame(options: SpeedUpOptions, random: () => number = Math.random): SpeedUpState {
  return { options, target: Math.floor(random() * CELLS), hits: 0, misses: 0, window: START_WINDOW, timeLeft: ROUND_MS, over: false };
}

function miss(s: SpeedUpState, random: () => number): SpeedUpState {
  const misses = s.misses + 1;
  return { ...s, misses, over: s.over || misses >= LIVES, target: pickCell(s.target, random) };
}

/** The player tapped a cell. A hit scores and, with escalation on, speeds the target up; a wrong cell costs a life. */
export function tap(s: SpeedUpState, cell: number, random: () => number = Math.random): SpeedUpState {
  if (s.over) return s;
  if (cell !== s.target) return miss(s, random);
  return { ...s, hits: s.hits + 1, window: nextWindow(s.window, s.options.escalation), target: pickCell(s.target, random) };
}

/** The target's window ran out before the player tapped it: a life lost, and the clock runs down. */
export function expire(s: SpeedUpState, random: () => number = Math.random): SpeedUpState {
  if (s.over) return s;
  const ticked = tick(s, s.window);
  // The clock ran out while this target was lit: the round ends on time, with no life lost.
  if (ticked.over) return ticked;
  return miss(ticked, random);
}

/** Run the round clock down. */
export function tick(s: SpeedUpState, ms: number): SpeedUpState {
  if (s.over) return s;
  const timeLeft = Math.max(0, s.timeLeft - ms);
  return { ...s, timeLeft, over: timeLeft === 0 };
}
