export type PlayerIndex = 0 | 1;
export interface LifelineOptions { lifeline: boolean; target: number; turns: number }
export interface LifelineState {
  options: LifelineOptions;
  score: number;
  turnTotal: number;
  current: PlayerIndex;
  turnsTaken: number;
  lifelines: [boolean, boolean];
  /** Points lost to a bust, waiting for the partner to rescue or pass. */
  pendingRescue: number;
  lastRoll: number | null;
  lastEvent: "start" | "rolled" | "busted" | "held" | "rescued" | "passed";
  outcome: "won" | "lost" | null;
}

export function newGame(options: LifelineOptions): LifelineState {
  return {
    options, score: 0, turnTotal: 0, current: 0, turnsTaken: 0,
    lifelines: [options.lifeline, options.lifeline],
    pendingRescue: 0, lastRoll: null, lastEvent: "start", outcome: null,
  };
}

export function partnerOf(player: PlayerIndex): PlayerIndex {
  return player === 0 ? 1 : 0;
}

function endTurn(s: LifelineState, score: number, event: LifelineState["lastEvent"]): LifelineState {
  const turnsTaken = s.turnsTaken + 1;
  const outcome = score >= s.options.target ? "won" : turnsTaken >= s.options.turns ? "lost" : null;
  return { ...s, score, turnTotal: 0, pendingRescue: 0, turnsTaken, current: partnerOf(s.current), lastEvent: event, outcome };
}

function waiting(s: LifelineState): boolean {
  return s.outcome !== null || s.pendingRescue > 0;
}

export function roll(s: LifelineState, die: number): LifelineState {
  if (waiting(s)) return s;
  if (!Number.isInteger(die) || die < 1 || die > 6) throw new RangeError(`die must be 1 to 6, got ${die}`);
  if (die === 1) {
    const lost = s.turnTotal;
    if (lost > 0 && s.lifelines[partnerOf(s.current)]) {
      return { ...s, turnTotal: 0, pendingRescue: lost, lastRoll: 1, lastEvent: "busted" };
    }
    return { ...endTurn(s, s.score, "busted"), lastRoll: 1 };
  }
  const turnTotal = s.turnTotal + die;
  if (s.score + turnTotal >= s.options.target) return { ...endTurn(s, s.score + turnTotal, "held"), lastRoll: die };
  return { ...s, turnTotal, lastRoll: die, lastEvent: "rolled" };
}

export function hold(s: LifelineState): LifelineState {
  if (waiting(s) || s.turnTotal === 0) return s;
  return endTurn(s, s.score + s.turnTotal, "held");
}

export function rescue(s: LifelineState): LifelineState {
  if (s.outcome !== null || s.pendingRescue === 0) return s;
  const lifelines: [boolean, boolean] = [...s.lifelines];
  lifelines[partnerOf(s.current)] = false;
  return endTurn({ ...s, lifelines }, s.score + s.pendingRescue, "rescued");
}

export function pass(s: LifelineState): LifelineState {
  if (s.outcome !== null || s.pendingRescue === 0) return s;
  return endTurn(s, s.score, "passed");
}

export function rollDie(random: () => number = Math.random): number {
  return 1 + Math.floor(random() * 6);
}
