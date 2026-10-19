export const MAP = [
  '#########',
  '#S..#..A#',
  '#.#.#.#.#',
  '#.#...#.#',
  '#.###.#.#',
  '#B....#.#',
  '###.###.#',
  '#C.....E#',
  '#########',
] as const;

export type Direction = 'up' | 'down' | 'left' | 'right';
export interface MazeState {
  position: number;
  seen: number[];
  collected: string[];
  steps: number;
  won: boolean;
}
export const LANDMARKS: Record<string, string> = { A: 'Moon pool', B: 'Crystal garden', C: 'Echo chamber' };
export function tile(position: number): string {
  return MAP[Math.floor(position / 9)]?.[position % 9] ?? '#';
}
function reveal(position: number, seen: number[]): number[] {
  const result = new Set(seen);
  for (let i = 0; i < 81; i++) {
    if (Math.abs(Math.floor(i / 9) - Math.floor(position / 9)) + Math.abs(i % 9 - position % 9) <= 1) result.add(i);
  }
  return [...result];
}
export function newGame(): MazeState {
  return { position: 10, seen: reveal(10, []), collected: [], steps: 0, won: false };
}
export function move(state: MazeState, direction: Direction): MazeState {
  if (state.won) return state;
  const position = state.position + { up: -9, down: 9, left: -1, right: 1 }[direction];
  const cell = tile(position);
  if (cell === '#') return state;
  const collected = LANDMARKS[cell] && !state.collected.includes(cell) ? [...state.collected, cell] : state.collected;
  return { position, seen: reveal(position, state.seen), collected, steps: state.steps + 1, won: cell === 'E' && collected.length === 3 };
}
