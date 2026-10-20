export interface HarvestOptions { keep: boolean; days: number; secondsPerDay: number; secondsPerNight: number }
export interface HarvestState {
  options: HarvestOptions;
  day: number;
  phase: "day" | "night";
  elapsed: number;
  wood: number;
  stone: number;
  built: number;
  structures: boolean[];
  bestBuilt: number;
  lastBuilding: number | null;
  gathered: number;
  player: number;
  patches: number[];
  recoverAt: number[];
  lastEvent: "start" | "walk" | "chop" | "mine" | "build" | "cannot-build" | "night-kept" | "night-reset";
  over: boolean;
  won: boolean;
}

export const BUILDINGS = [
  { name: "Tent", wood: 3, stone: 1 },
  { name: "Hut", wood: 5, stone: 2 },
  { name: "House", wood: 8, stone: 6 },
  { name: "Castle", wood: 10, stone: 12 },
] as const;
export const DEFAULT_OPTIONS: HarvestOptions = { keep: true, days: 5, secondsPerDay: 20, secondsPerNight: 6 };
export const WIDTH = 7;
export const RECOVERY_SECONDS = 12;
export const FARM = [
  ".......",
  ".......",
  ".T...R.",
  "T.....R",
  ".T...R.",
  "..T.R..",
].join("");
export const PLOTS = [0, 2, 4, 6];
const freshPatches = () => [...FARM].map((tile) => tile === "T" || tile === "R" ? 3 : 0);

export function newGame(options: HarvestOptions = DEFAULT_OPTIONS): HarvestState {
  if (![options.days, options.secondsPerDay, options.secondsPerNight].every((n) => Number.isSafeInteger(n) && n > 0)) {
    throw new RangeError("Days and seconds per day must be positive whole numbers.");
  }
  return {
    options: { ...options }, day: 1, phase: "day", elapsed: 0, wood: 0, stone: 0, built: 0,
    structures: BUILDINGS.map(() => false), bestBuilt: 0, lastBuilding: null, gathered: 0, player: 24,
    patches: freshPatches(), recoverAt: [...FARM].map(() => 0), lastEvent: "start", over: false, won: false,
  };
}

/** Absolute elapsed seconds, supplied by the UI clock. Handles delayed/background ticks. */
export function tick(s: HarvestState, elapsed: number): HarvestState {
  if (s.over || !Number.isFinite(elapsed) || elapsed < s.elapsed) return s;
  const cycle = s.options.secondsPerDay + s.options.secondsPerNight;
  elapsed = Math.min(Math.floor(elapsed), s.options.days * cycle);
  if (elapsed === s.elapsed) return s;
  const over = elapsed === s.options.days * cycle;
  const day = Math.min(s.options.days, Math.floor(elapsed / cycle) + 1);
  const phase = over || elapsed % cycle >= s.options.secondsPerDay ? "night" : "day";
  const nights = (time: number) => Math.min(s.options.days, Math.floor((time + s.options.secondsPerNight) / cycle));
  const night = nights(elapsed) > nights(s.elapsed);
  const dawn = day > s.day;
  const recoverAt = [...s.recoverAt];
  const patches = s.patches.map((health, i) => {
    if (health === 3 || recoverAt[i] === 0 || elapsed < recoverAt[i]) return health;
    recoverAt[i] = 0;
    return 3;
  });
  return {
    ...s, elapsed, day, phase, over, patches, recoverAt,
    ...(dawn ? { patches: freshPatches(), recoverAt: [...FARM].map(() => 0) } : {}),
    ...(night ? {
      lastEvent: s.options.keep ? "night-kept" as const : "night-reset" as const,
      ...(s.options.keep ? {} : { wood: 0, stone: 0, built: 0, structures: BUILDINGS.map(() => false) }),
    } : {}),
  };
}

export function canBuild(s: HarvestState): boolean {
  const plot = PLOTS.indexOf(s.player);
  const building = BUILDINGS[plot];
  return !s.over && s.phase === "day" && !!building && !s.structures[plot] && s.wood >= building.wood && s.stone >= building.stone;
}

export function build(s: HarvestState): HarvestState {
  const plot = PLOTS.indexOf(s.player);
  if (s.over || s.phase === "night" || plot < 0 || s.structures[plot]) return s;
  if (!canBuild(s)) return { ...s, lastEvent: "cannot-build", lastBuilding: plot };
  const next = BUILDINGS[plot];
  const structures = s.structures.map((built, i) => built || i === plot);
  const won = structures.every(Boolean);
  return {
    ...s, wood: s.wood - next.wood, stone: s.stone - next.stone,
    structures, built: s.built + 1, bestBuilt: Math.max(s.bestBuilt, plot + 1), lastBuilding: plot, lastEvent: "build",
    over: won, won, player: won ? 24 : s.player,
  };
}

export function adjacent(a: number, b: number): boolean {
  return Math.abs(a % WIDTH - b % WIDTH) + Math.abs(Math.floor(a / WIDTH) - Math.floor(b / WIDTH)) === 1;
}

/** Gather from the tile under the farmer. There is no gathering cooldown. */
export function interact(s: HarvestState, target: number): HarvestState {
  if (s.over || s.phase === "night" || target !== s.player) return s;
  if (PLOTS.includes(target)) return build(s);
  if (s.patches[target] > 0) {
    const resource = FARM[target] === "T" ? "wood" : "stone";
    return {
      ...s, [resource]: s[resource] + 1, gathered: s.gathered + 1,
      patches: s.patches.map((n, i) => i === target ? n - 1 : n),
      recoverAt: s.recoverAt.map((at, i) => i === target && at === 0 ? s.elapsed + RECOVERY_SECONDS : at),
      lastEvent: resource === "wood" ? "chop" : "mine",
    };
  }
  return s;
}

export function step(s: HarvestState, dx: number, dy: number): HarvestState {
  if (Math.abs(dx) + Math.abs(dy) !== 1) return s;
  const x = s.player % WIDTH + dx;
  const y = Math.floor(s.player / WIDTH) + dy;
  if (x < 0 || x >= WIDTH || y < 0 || y >= FARM.length / WIDTH) return s;
  const player = y * WIDTH + x;
  if (s.over || s.phase === "night") return s;
  return { ...s, player, lastEvent: "walk" };
}
