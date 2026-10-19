export const BOARD = [
  '.....',
  '.#.#.',
  '...#.',
  '.#...',
  '.....',
];
export const RELICS = [4, 12, 20];
export const LIMIT = 36;
export type Direction = 'up' | 'down' | 'left' | 'right';
export interface State { position: number; moves: number; seen: number[]; collected: number[]; carrying: number | null; delivered: number[] }
function nearby(position: number): number[] {
  return Array.from({ length: 25 }, (_, i) => i).filter(i =>
    Math.abs(i % 5 - position % 5) + Math.abs(Math.floor(i / 5) - Math.floor(position / 5)) <= 1);
}
export function create(): State { return { position: 0, moves: 0, seen: nearby(0), collected: [], carrying: null, delivered: [] }; }
export function won(s: State): boolean { return s.delivered.length === RELICS.length; }
export function finished(s: State): boolean { return won(s) || s.moves >= LIMIT; }
export function visible(s: State, position: number, fog: boolean): boolean { return !fog || s.seen.includes(position); }
export function step(s: State, direction: Direction): State {
  if (finished(s)) return s;
  const [dx, dy] = ({ up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] })[direction];
  const x = s.position % 5 + dx, y = Math.floor(s.position / 5) + dy;
  if (x < 0 || x >= 5 || y < 0 || y >= 5 || BOARD[y][x] === '#') return s;
  const position = y * 5 + x;
  const pickup = s.carrying === null && RELICS.includes(position) && !s.collected.includes(position);
  const carrying = pickup ? position : s.carrying;
  const deposit = position === 0 && carrying !== null;
  return { position, moves: s.moves + 1,
    seen: [...new Set([...s.seen, ...nearby(position)])],
    collected: pickup ? [...s.collected, position] : [...s.collected],
    carrying: deposit ? null : carrying,
    delivered: deposit ? [...s.delivered, carrying] : [...s.delivered],
  };
}
