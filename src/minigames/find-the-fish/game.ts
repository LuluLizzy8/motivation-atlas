export const BOARD_SIZE = 4;
export const TOTAL_ROUNDS = 3;

export interface Position {
  row: number;
  col: number;
}

export type GuessFeedback = "found" | "strong" | "faint" | "none" | "unguided";
export type GamePhase = "playing" | "round-won" | "complete";

export interface RevealedTile {
  position: Position;
  feedback: GuessFeedback;
}

export interface FishGameState {
  scentHints: boolean;
  round: number;
  fish: Position;
  revealed: RevealedTile[];
  roundGuesses: number;
  totalGuesses: number;
  completedRoundGuesses: number[];
  phase: GamePhase;
  lastFeedback: GuessFeedback | null;
}

function assertPosition(position: Position): void {
  if (!Number.isInteger(position.row) || !Number.isInteger(position.col)
    || position.row < 0 || position.row >= BOARD_SIZE
    || position.col < 0 || position.col >= BOARD_SIZE) {
    throw new RangeError(`position must be inside the ${BOARD_SIZE}x${BOARD_SIZE} board`);
  }
}

export function samePosition(a: Position, b: Position): boolean {
  return a.row === b.row && a.col === b.col;
}

export function manhattanDistance(a: Position, b: Position): number {
  assertPosition(a);
  assertPosition(b);
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

export function feedbackForGuess(selected: Position, fish: Position, scentHints: boolean): GuessFeedback {
  const distance = manhattanDistance(selected, fish);
  if (distance === 0) return "found";
  if (!scentHints) return "unguided";
  if (distance === 1) return "strong";
  if (distance <= 3) return "faint";
  return "none";
}

export function randomFish(random: () => number = Math.random): Position {
  const value = random();
  if (value < 0 || value >= 1) throw new RangeError(`random must return a value from 0 up to 1, got ${value}`);
  const index = Math.floor(value * BOARD_SIZE * BOARD_SIZE);
  return { row: Math.floor(index / BOARD_SIZE), col: index % BOARD_SIZE };
}

export function newGame(scentHints = true, fish: Position = randomFish()): FishGameState {
  assertPosition(fish);
  return {
    scentHints,
    round: 1,
    fish: { ...fish },
    revealed: [],
    roundGuesses: 0,
    totalGuesses: 0,
    completedRoundGuesses: [],
    phase: "playing",
    lastFeedback: null,
  };
}

export function guessTile(state: FishGameState, selected: Position): FishGameState {
  assertPosition(selected);
  if (state.phase !== "playing" || state.revealed.some((tile) => samePosition(tile.position, selected))) return state;

  const feedback = feedbackForGuess(selected, state.fish, state.scentHints);
  const roundGuesses = state.roundGuesses + 1;
  const revealed = [...state.revealed, { position: { ...selected }, feedback }];
  if (feedback !== "found") {
    return { ...state, revealed, roundGuesses, totalGuesses: state.totalGuesses + 1, lastFeedback: feedback };
  }

  return {
    ...state,
    revealed,
    roundGuesses,
    totalGuesses: state.totalGuesses + 1,
    completedRoundGuesses: [...state.completedRoundGuesses, roundGuesses],
    phase: state.round === TOTAL_ROUNDS ? "complete" : "round-won",
    lastFeedback: "found",
  };
}

export function nextRound(state: FishGameState, fish: Position = randomFish()): FishGameState {
  assertPosition(fish);
  if (state.phase !== "round-won") return state;
  return {
    ...state,
    round: state.round + 1,
    fish: { ...fish },
    revealed: [],
    roundGuesses: 0,
    phase: "playing",
    lastFeedback: null,
  };
}
