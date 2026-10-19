export type Kind = "I" | "O" | "T" | "S" | "Z" | "J" | "L";
export type Board = (Kind | null)[][];
export interface TenLinesOptions { rising: boolean; target: number }
export interface Piece { kind: Kind; rot: number; x: number; y: number }
export interface TenLinesState {
  options: TenLinesOptions;
  board: Board;
  piece: Piece;
  next: Kind;
  lines: number;
  lastEvent: "start" | "moved" | "locked" | "cleared" | "won" | "lost";
  over: "won" | "lost" | null;
  /** How tall the stack stood after each piece landed, starting at 0. */
  heightHistory: number[];
}

export const COLS = 10;
export const ROWS = 16;
export const KINDS: Kind[] = ["I", "O", "T", "S", "Z", "J", "L"];
/** Milliseconds a piece takes to fall one row at the start of a game. */
export const START_INTERVAL_MS = 800;
export const LINES_PER_LEVEL = 2;
/** With rising difficulty on, each level multiplies the fall interval by this. */
export const SPEED_UP = 0.8;
/** Finish within these many seconds for three stars or two; any finish earns one. */
export const STAR_SECONDS = [75, 110];

/** Each piece in its spawn orientation, inside a square box it rotates within. */
const SHAPES: Record<Kind, { size: number; cells: [number, number][] }> = {
  I: { size: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
  O: { size: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  T: { size: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  S: { size: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  Z: { size: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  J: { size: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  L: { size: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
};
/** Sideways shifts tried, in order, when a rotation would not fit where the piece is. */
const KICKS = [0, -1, 1, -2, 2];

/** The board squares a piece covers, as [column, row] pairs. */
export function cells(p: Piece): [number, number][] {
  const { size, cells: base } = SHAPES[p.kind];
  return base.map(([cx, cy]) => {
    let x = cx;
    let y = cy;
    for (let i = 0; i < p.rot; i++) [x, y] = [size - 1 - y, x];
    return [p.x + x, p.y + y];
  });
}

export function fits(board: Board, p: Piece): boolean {
  return cells(p).every(([x, y]) => x >= 0 && x < COLS && y >= 0 && y < ROWS && board[y][x] === null);
}

export function spawn(kind: Kind): Piece {
  return { kind, rot: 0, x: Math.floor((COLS - SHAPES[kind].size) / 2), y: 0 };
}

const emptyRow = (): (Kind | null)[] => Array<Kind | null>(COLS).fill(null);

export function newGame(options: TenLinesOptions, first: Kind, next: Kind): TenLinesState {
  return {
    options, board: Array.from({ length: ROWS }, emptyRow), piece: spawn(first), next,
    lines: 0, lastEvent: "start", over: null, heightHistory: [0],
  };
}

export function stackHeight(board: Board): number {
  const top = board.findIndex((row) => row.some((c) => c !== null));
  return top === -1 ? 0 : ROWS - top;
}

/** Speed level: 0 at the start, one higher for every two lines when difficulty rises. */
export function level(s: TenLinesState): number {
  return s.options.rising ? Math.floor(s.lines / LINES_PER_LEVEL) : 0;
}

export function fallIntervalMs(s: TenLinesState): number {
  return Math.round(START_INTERVAL_MS * SPEED_UP ** level(s));
}

export function move(s: TenLinesState, dx: -1 | 1): TenLinesState {
  const piece = { ...s.piece, x: s.piece.x + dx };
  return s.over || !fits(s.board, piece) ? s : { ...s, piece, lastEvent: "moved" };
}

/** Turn the piece clockwise, nudging it sideways if a wall or the stack is in the way. */
export function rotate(s: TenLinesState): TenLinesState {
  if (s.over) return s;
  for (const kick of KICKS) {
    const piece = { ...s.piece, rot: (s.piece.rot + 1) % 4, x: s.piece.x + kick };
    if (fits(s.board, piece)) return { ...s, piece, lastEvent: "moved" };
  }
  return s;
}

function lock(s: TenLinesState, refill: Kind): TenLinesState {
  const board = s.board.map((row) => [...row]);
  for (const [x, y] of cells(s.piece)) board[y][x] = s.piece.kind;
  const kept = board.filter((row) => row.some((c) => c === null));
  const cleared = ROWS - kept.length;
  const settled = [...Array.from({ length: cleared }, emptyRow), ...kept];
  const lines = s.lines + cleared;
  const landed = { ...s, board: settled, lines, heightHistory: [...s.heightHistory, stackHeight(settled)] };
  if (lines >= s.options.target) return { ...landed, lastEvent: "won", over: "won" };
  const piece = spawn(s.next);
  if (!fits(settled, piece)) return { ...landed, piece, lastEvent: "lost", over: "lost" };
  return { ...landed, piece, next: refill, lastEvent: cleared > 0 ? "cleared" : "locked" };
}

/** Where the piece would land if dropped now. */
export function landing(s: TenLinesState): Piece {
  let piece = s.piece;
  for (let down = { ...piece, y: piece.y + 1 }; fits(s.board, down); down = { ...piece, y: piece.y + 1 }) piece = down;
  return piece;
}

/** Gravity: the piece falls one row, or lands if it cannot. `refill` is the piece after next. */
export function step(s: TenLinesState, refill: Kind): TenLinesState {
  if (s.over) return s;
  const piece = { ...s.piece, y: s.piece.y + 1 };
  return fits(s.board, piece) ? { ...s, piece, lastEvent: "moved" } : lock(s, refill);
}

export function hardDrop(s: TenLinesState, refill: Kind): TenLinesState {
  return s.over ? s : lock({ ...s, piece: landing(s) }, refill);
}

export function stars(seconds: number): 1 | 2 | 3 {
  return seconds <= STAR_SECONDS[0] ? 3 : seconds <= STAR_SECONDS[1] ? 2 : 1;
}

/**
 * A source of pieces for one game. It deals all seven kinds in a random order, then shuffles again,
 * so the order is never predictable but no shape stays away for long.
 */
export function dealer(random: () => number = Math.random): () => Kind {
  let bag: Kind[] = [];
  return () => {
    if (bag.length === 0) {
      bag = [...KINDS];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    return bag.pop()!;
  };
}
