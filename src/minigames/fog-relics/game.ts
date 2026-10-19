export const SIZE = 5;
export const LIMIT = 40;
export type Direction = 'up' | 'down' | 'left' | 'right';
export type Layout = { home: number; walls: number[]; relics: number[] };
const first: Layout = { home: 20, walls: [6, 8, 16, 18], relics: [0, 4, 22] };
const mirror = (n: number) => Math.floor(n / SIZE) * SIZE + SIZE - 1 - n % SIZE;
export const MAPS: Layout[] = [first, { home: mirror(first.home), walls: first.walls.map(mirror), relics: first.relics.map(mirror) }];
export type State = { map: number; position: number; seen: number[]; collected: number[]; steps: number; revisits: number; visited: number[]; status: 'playing' | 'won' | 'ended' };
export function neighbor(position: number, direction: Direction): number | null {
  const row = Math.floor(position / SIZE), col = position % SIZE;
  if (direction === 'up') return row > 0 ? position - SIZE : null;
  if (direction === 'down') return row < SIZE - 1 ? position + SIZE : null;
  if (direction === 'left') return col > 0 ? position - 1 : null;
  return col < SIZE - 1 ? position + 1 : null;
}
function reveal(seen: number[], position: number): number[] {
  return [...new Set([...seen, position, ...(['up','down','left','right'] as Direction[]).map(d => neighbor(position, d)).filter((n): n is number => n !== null)])];
}
export function newGame(map = 0): State {
  if (!MAPS[map]) throw new RangeError('Unknown map');
  const position = MAPS[map].home;
  return { map, position, seen: reveal([], position), collected: [], steps: 0, revisits: 0, visited: [position], status: 'playing' };
}
export function visible(state: State, cell: number, fog: boolean): boolean { return !fog || state.seen.includes(cell); }
export function move(state: State, direction: Direction): State {
  if (state.status !== 'playing') return state;
  const target = neighbor(state.position, direction), layout = MAPS[state.map];
  if (target === null || layout.walls.includes(target)) return state;
  const collected = layout.relics.includes(target) ? [...new Set([...state.collected, target])] : state.collected;
  const steps = state.steps + 1;
  return { ...state, position: target, collected, steps, seen: reveal(state.seen, target), visited: [...new Set([...state.visited, target])], revisits: state.revisits + Number(state.visited.includes(target)), status: target === layout.home && collected.length === 3 ? 'won' : steps >= LIMIT ? 'ended' : 'playing' };
}
