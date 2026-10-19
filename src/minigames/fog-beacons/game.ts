export type Direction = "up" | "right" | "down" | "left";
export interface Point { x: number; y: number }
export interface Board { size: number; seed: number; walls: boolean[]; start: Point; exit: Point; beacons: Point[] }
export interface GameState {
  board: Board; fog: boolean; player: Point; collected: number[]; revealed: number[];
  moves: number; bumps: number; revisits: number; visited: number[]; won: boolean;
}
const DELTAS: Record<Direction, Point> = {
  up: { x: 0, y: -1 }, right: { x: 1, y: 0 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 },
};
export const cellId = (board: Board, p: Point): number => p.y * board.size + p.x;
const same = (a: Point, b: Point): boolean => a.x === b.x && a.y === b.y;

export function makeBoard(seed: number): Board {
  if (!Number.isSafeInteger(seed) || seed < 1 || seed > 0xffffffff) throw new RangeError("Seed must be a positive 32-bit integer");
  const size = 7, walls = Array<boolean>(size * size).fill(true);
  let value = seed >>> 0;
  const random = (): number => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 0x100000000; };
  const start = { x: 1, y: 1 }, stack: Point[] = [start];
  walls[start.y * size + start.x] = false;
  while (stack.length) {
    const current = stack[stack.length - 1];
    const choices = Object.values(DELTAS).map(d => ({ x: current.x + 2 * d.x, y: current.y + 2 * d.y }))
      .filter(p => p.x > 0 && p.x < size - 1 && p.y > 0 && p.y < size - 1 && walls[p.y * size + p.x]);
    if (!choices.length) { stack.pop(); continue; }
    const next = choices[Math.floor(random() * choices.length)];
    walls[((current.y + next.y) / 2) * size + (current.x + next.x) / 2] = false;
    walls[next.y * size + next.x] = false;
    stack.push(next);
  }
  const board: Board = { size, seed, walls, start, exit: start, beacons: [] };
  const distance = new Map<number, number>([[cellId(board, start), 0]]), queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    for (const d of Object.values(DELTAS)) {
      const next = { x: p.x + d.x, y: p.y + d.y }, id = cellId(board, next);
      if (walls[id] === false && !distance.has(id)) { distance.set(id, distance.get(cellId(board, p))! + 1); queue.push(next); }
    }
  }
  const rooms = queue.filter(p => p.x % 2 === 1 && p.y % 2 === 1 && !same(p, start))
    .sort((a, b) => distance.get(cellId(board, b))! - distance.get(cellId(board, a))!);
  board.exit = rooms[0];
  board.beacons = rooms.slice(1, 4);
  return board;
}

function reveal(board: Board, p: Point, previous: number[]): number[] {
  const ids = new Set(previous);
  for (const q of [p, ...Object.values(DELTAS).map(d => ({ x: p.x + d.x, y: p.y + d.y }))]) {
    if (q.x >= 0 && q.x < board.size && q.y >= 0 && q.y < board.size) ids.add(cellId(board, q));
  }
  return [...ids].sort((a, b) => a - b);
}

export function newGame(seed = 1, fog = true): GameState {
  const board = makeBoard(seed), startId = cellId(board, board.start);
  return { board, fog, player: { ...board.start }, collected: [], revealed: reveal(board, board.start, []),
    moves: 0, bumps: 0, revisits: 0, visited: [startId], won: false };
}

export function isVisible(state: GameState, p: Point): boolean {
  return !state.fog || state.revealed.includes(cellId(state.board, p));
}

export function move(state: GameState, direction: Direction): GameState {
  if (state.won) return state;
  const d = DELTAS[direction];
  if (!d) throw new RangeError("Unknown direction");
  const p = { x: state.player.x + d.x, y: state.player.y + d.y }, id = cellId(state.board, p);
  if (p.x < 0 || p.y < 0 || p.x >= state.board.size || p.y >= state.board.size || state.board.walls[id]) {
    return { ...state, bumps: state.bumps + 1 };
  }
  const collected = [...state.collected];
  const beacon = state.board.beacons.findIndex(b => same(b, p));
  if (beacon >= 0 && !collected.includes(beacon)) collected.push(beacon);
  const revisited = state.visited.includes(id);
  return { ...state, player: p, collected, revealed: reveal(state.board, p, state.revealed),
    moves: state.moves + 1, revisits: state.revisits + Number(revisited),
    visited: revisited ? state.visited : [...state.visited, id],
    won: collected.length === state.board.beacons.length && same(p, state.board.exit) };
}
