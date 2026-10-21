/** Pure rules: no DOM, timers, randomness, or network access. */
export const WIDTH = 13;
export const HEIGHT = 17;
export const CAMERA_ROWS = 11;
/** Follow only the vertical axis and stop at the ends of the river. */
export function cameraTop(playerY: number): number {
  return Math.max(0, Math.min(HEIGHT - CAMERA_ROWS, playerY - Math.floor(CAMERA_ROWS / 2)));
}
export type Point = { x: number; y: number };
export type Direction = 'north' | 'south' | 'west' | 'east';
export const START: Point = { x: 2, y: 15 };
export const SAILOR: Point = { x: 10, y: 13 };
export const LANDING: Point = { x: 11, y: 1 };
export const CROCODILE: Point = { x: 6, y: 9 };
export const SNAKE: Point = { x: 11, y: 14 };
export const key = (p: Point): string => `${p.x},${p.y}`;
export const same = (a: Point, b: Point): boolean => a.x === b.x && a.y === b.y;
export const distance = (a: Point, b: Point): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const river = new Set<string>();
function channel(x1: number, y1: number, x2: number, y2: number) {
  for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) {
    river.add(key({ x: y >= HEIGHT - 8 ? x - 1 : x, y }));
  }
}
channel(3, 1, 3, 15);
channel(9, 1, 9, 15);
channel(3, 3, 11, 3);
channel(3, 9, 9, 9);
channel(3, 13, 11, 13);
channel(3, 15, 9, 15);
channel(1, 5, 5, 7);
channel(9, 6, 11, 6);
channel(11, 1, 11, 3);
channel(11, 11, 11, 15);
// Join the shifted lower river to the unchanged upper channel at the seam.
river.add(key({ x: 9, y: HEIGHT - 8 }));

export const SIGNS = {
  boat: { glyph: '𓊛', name: 'boat', gardiner: 'P1' },
  sailor: { glyph: '𓀌', name: 'sailor', gardiner: 'A10' },
  water: { glyph: '𓈗', name: 'water', gardiner: 'N35A' },
  bank: { glyph: '𓈃', name: 'land', gardiner: 'N19' },
  landing: { glyph: '𓉐', name: 'landing house', gardiner: 'O1' },
  fish: { glyph: '𓆛', name: 'tilapia', gardiner: 'K1' },
  barbel: { glyph: '𓆜', name: 'barbel', gardiner: 'K2' },
  mullet: { glyph: '𓆝', name: 'mullet', gardiner: 'K3' },
  elephantfish: { glyph: '𓆞', name: 'elephant-snout fish', gardiner: 'K4' },
  petrocephalus: { glyph: '𓆟', name: 'Petrocephalus fish', gardiner: 'K5' },
  puffer: { glyph: '𓆡', name: 'pufferfish', gardiner: 'K7' },
  plant: { glyph: '𓆰', name: 'plant', gardiner: 'M2' },
  lotusPool: { glyph: '𓆷', name: 'lotus pool', gardiner: 'M8' },
  lotusFlower: { glyph: '𓆸', name: 'lotus flower', gardiner: 'M9' },
  lotusBud: { glyph: '𓆹', name: 'lotus bud', gardiner: 'M10' },
  lotus: { glyph: '𓆼', name: 'lotus plant', gardiner: 'M12' },
  papyrusBuds: { glyph: '𓇇', name: 'papyrus with buds', gardiner: 'M15' },
  papyrus: { glyph: '𓇉', name: 'papyrus clump', gardiner: 'M16' },
  reeds: { glyph: '𓇏', name: 'reed bed', gardiner: 'M20' },
  sedge: { glyph: '𓇓', name: 'sedge', gardiner: 'M23' },
  floweringSedge: { glyph: '𓇗', name: 'flowering sedge', gardiner: 'M26' },
  emmer: { glyph: '𓇣', name: 'emmer', gardiner: 'M34' },
  turtle: { glyph: '𓆉', name: 'turtle', gardiner: 'I2' },
  crocodile: { glyph: '𓆊', name: 'crocodile', gardiner: 'I3' },
  snake: { glyph: '𓆚', name: 'snake', gardiner: 'I15' },
};
export type Sign = keyof typeof SIGNS;
export const PLANT_DESCRIPTIONS: Partial<Record<Sign, string>> = {
  plant: 'A small plant growing on dry land beside the river.',
  lotusPool: 'Lotus flowers rise from a quiet pool. Your boat can pass through.',
  lotusFlower: 'An open lotus flower on the water, beside the passing boat.',
  lotusBud: 'An unopened lotus bud with a straight stem rising from the water.',
  lotus: 'A lotus plant growing at the edge of the riverbank.',
  papyrusBuds: 'A clump of papyrus with buds, gathered along the riverbank.',
  papyrus: 'A thick clump of papyrus beside the water.',
  reeds: 'A bed of reeds lining the riverbank.',
  sedge: 'A sedge plant growing along the bank.',
  floweringSedge: 'Flowering sedge growing beside the channel.',
  emmer: 'An ear of emmer growing on land beyond the riverbank.',
};

/** Six complete fish signs; K6 is a scale, so it is deliberately excluded. */
export const FISH = [
  { sign: 'fish', point: { x: 1, y: 5 } },
  { sign: 'barbel', point: { x: 4, y: 6 } },
  { sign: 'mullet', point: { x: 2, y: 7 } },
  { sign: 'elephantfish', point: { x: 7, y: 3 } },
  { sign: 'petrocephalus', point: { x: 10, y: 6 } },
  { sign: 'puffer', point: { x: 7, y: 13 } },
] as const;
/** Plant placement is scenery; underlying river cells remain navigable. */
export const PLANTS = [
  { sign: 'plant', point: { x: 0, y: 11 } },
  { sign: 'lotusPool', point: { x: 1, y: 6 } },
  { sign: 'lotusFlower', point: { x: 5, y: 5 } },
  { sign: 'lotusBud', point: { x: 5, y: 7 } },
  { sign: 'lotus', point: { x: 4, y: 8 } },
  { sign: 'papyrusBuds', point: { x: 2, y: 4 } },
  { sign: 'papyrus', point: { x: 6, y: 6 } },
  { sign: 'reeds', point: { x: 7, y: 11 } },
  { sign: 'sedge', point: { x: 8, y: 7 } },
  { sign: 'floweringSedge', point: { x: 9, y: 10 } },
  { sign: 'emmer', point: { x: 6, y: 2 } },
] as const;
export const SCENES = [
  { id: 'fish', point: { x: 1, y: 5 }, text: 'A narrow channel opens into a pool full of fish.' },
  { id: 'turtle', point: { x: 11, y: 6 }, text: 'A turtle rests in a quiet backwater.' },
  { id: 'crocodile', point: CROCODILE, text: 'A crocodile blocks the shortcut. Another channel must go around.' },
  { id: 'sailor', point: SAILOR, text: 'A sailor is shipwrecked at the end of a side channel. Bring your boat alongside.' },
  { id: 'landing', point: LANDING, text: 'A landing house! This is where you can bring the sailor safely ashore.' },
];
export interface Game {
  fog: boolean;
  position: Point;
  explored: string[];
  discoveries: string[];
  fishFound: string[];
  plantsFound: string[];
  passenger: boolean;
  moves: number;
  won: boolean;
  message: string;
}
export function isWater(p: Point): boolean { return river.has(key(p)); }
export function canEnter(p: Point): boolean { return isWater(p) && !same(p, CROCODILE); }
function reveal(state: Game): Game {
  const explored = new Set(state.explored);
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
    if (distance(state.position, { x, y }) <= 2) explored.add(key({ x, y }));
  }
  const found = SCENES.filter((s) => distance(state.position, s.point) <= 2 && !state.discoveries.includes(s.id));
  const fish = FISH.filter((f) => distance(state.position, f.point) <= 2 && !state.fishFound.includes(f.sign));
  const plants = PLANTS.filter((p) => distance(state.position, p.point) <= 2 && !state.plantsFound.includes(p.sign));
  return { ...state, plantsFound: [...state.plantsFound, ...plants.map((p) => p.sign)], fishFound: [...state.fishFound, ...fish.map((f) => f.sign)], explored: [...explored], discoveries: [...state.discoveries, ...found.map((s) => s.id)],
    message: found.length ? found.map((s) => s.text).join(' ') : state.message };
}
export function createGame(fog = true): Game {
  return reveal({ fog, position: { ...START }, explored: [], discoveries: [], fishFound: [], plantsFound: [], passenger: false,
    moves: 0, won: false, message: 'Somewhere along this river, a shipwrecked sailor needs a ride. Explore the waters.' });
}
export function isVisible(state: Game, p: Point): boolean { return !state.fog || state.explored.includes(key(p)); }
export function signAt(state: Game, p: Point): Sign {
  if (same(p, state.position)) return 'boat';
  if (same(p, LANDING)) return 'landing';
  if (same(p, SAILOR) && !state.passenger) return 'sailor';
  if (same(p, CROCODILE)) return 'crocodile';
  if (same(p, SNAKE)) return 'snake';
  if (p.x === 11 && p.y === 6) return 'turtle';
  const fish = FISH.find((f) => same(f.point, p));
  if (fish) return fish.sign;
  const plant = PLANTS.find((plant) => same(plant.point, p));
  if (plant) return plant.sign;
  return isWater(p) ? 'water' : 'bank';
}
const ENCOUNTERS: Partial<Record<Sign, string>> = {
  fish: 'A tilapia slips beneath your boat, its broad shape flashing through the water.',
  barbel: 'A barbel glides under the hull. You pause to watch its whiskered outline.',
  mullet: 'A mullet darts past your boat and disappears into the ripples.',
  elephantfish: 'An elephant-snout fish passes below, its long snout tracing the water.',
  petrocephalus: 'A Petrocephalus fish swims beneath the boat, a small golden shape in the river.',
  puffer: 'A pufferfish drifts beneath your boat. You give it room as you pass.',
  turtle: 'A turtle slips gently beneath the boat. This quiet backwater is passable.',
  lotusPool: 'Your boat drifts through a lotus pool. Flowers rise from the water around you.',
  lotusFlower: 'A lotus flower nods beside the hull. You can glide through the flowers.',
  lotusBud: 'An unopened lotus bud rises from the water. Your boat brushes past its stem.',
};
export function move(state: Game, direction: Direction): Game {
  if (state.won) return state;
  const delta = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] }[direction];
  const next = { x: state.position.x + delta[0], y: state.position.y + delta[1] };
  const encountered = signAt(state, next);
  if (!canEnter(next)) return { ...state, message: same(next, CROCODILE)
    ? 'The crocodile holds this passage. Explore another branch to go around.'
    : same(next, SNAKE)
      ? 'A giant serpent of 30 cubits, where his beard alone is two cubits. His body is covered in gold and eyebrows of lapis.'
    : PLANTS.some((p) => same(p.point, next))
      ? `A ${SIGNS[encountered].name} grows on the land here. Your boat needs water; you cannot pass onto land.`
      : 'Land. Your boat needs water; you cannot pass onto land.' };
  let result = reveal({ ...state, position: next, moves: state.moves + 1,
    message: state.passenger ? 'The sailor is aboard. Find the landing house.' : 'Follow the river. What lies around the next bend?' });
  if (ENCOUNTERS[encountered]) result = { ...result, message: ENCOUNTERS[encountered]! };
  if (same(next, SAILOR) && !state.passenger) result = { ...result, passenger: true,
    message: 'The sailor climbs aboard, telling you all about the terrifying and wise serpent he met while shipwrecked. Help him get home further downstream.' };
  if (same(next, LANDING)) result = { ...result, won: result.passenger,
    message: result.passenger ? 'Safe ashore. You brought the sailor home.' : 'The landing is empty. Find the shipwrecked sailor, then return here.' };
  return result;
}
