/** Browser-independent rules. Time is in seconds; coordinates are logical pixels. */
export const WORLD = {
  width: 360, height: 480, ground: 460,
  birdX: 90, birdY: 230, radius: 11,
  gravity: 850, flapVelocity: -290, maxFall: 420,
  pipeWidth: 56, spawnX: 388,
  minCenter: 140, maxCenter: 320, maxShift: 60,
  duration: 90,
} as const;
export const FIXED_STEP = 1 / 120;
export const COMPARISON_SEED = 2026;

export interface Settings {
  faster: boolean;
  narrower: boolean;
  frequent: boolean;
}
export const DEFAULT_SETTINGS: Readonly<Settings> = { faster: false, narrower: false, frequent: false };
export interface Config {
  readonly speed: number;
  readonly gap: number;
  readonly interval: number;
}
export function configuration(settings: Settings): Config {
  return { speed: settings.faster ? 180 : 130, gap: settings.narrower ? 120 : 160, interval: settings.frequent ? 1.45 : 1.9 };
}
export function settingsKey(settings: Settings): string {
  return `${+settings.faster}${+settings.narrower}${+settings.frequent}`;
}
export interface Pipe {
  readonly id: number;
  readonly x: number;
  readonly center: number;
  readonly scored: boolean;
}
export interface GameState {
  readonly phase: "ready" | "running" | "paused" | "ended";
  readonly settings: Readonly<Settings>;
  readonly config: Config;
  readonly seed: number;
  readonly rng: number;
  readonly birdY: number;
  readonly velocity: number;
  readonly pipes: readonly Pipe[];
  readonly elapsed: number;
  readonly score: number;
  readonly nextSpawn: number;
  readonly nextId: number;
  readonly lastCenter: number;
  readonly outcome: "collision" | "complete" | null;
}
export function ready(settings: Settings = DEFAULT_SETTINGS, seed = COMPARISON_SEED): GameState {
  return {
    phase: "ready", settings: { ...settings }, config: configuration(settings), seed, rng: seed >>> 0,
    birdY: WORLD.birdY, velocity: 0, pipes: [], elapsed: 0, score: 0,
    nextSpawn: 0, nextId: 0, lastCenter: WORLD.birdY, outcome: null,
  };
}
/** Start and retry always copy settings and supply exactly one initial flap. */
export function start(settings: Settings = DEFAULT_SETTINGS, seed = COMPARISON_SEED): GameState {
  const state = ready(settings, seed);
  return {
    ...state, phase: "running", velocity: WORLD.flapVelocity,
    pipes: [{ id: 0, x: WORLD.spawnX, center: WORLD.birdY, scored: false }],
    nextSpawn: state.config.interval, nextId: 1,
  };
}
export function flap(state: GameState): GameState {
  if (state.phase === "ready") return start(state.settings, state.seed);
  return state.phase === "running" ? { ...state, velocity: WORLD.flapVelocity } : state;
}
export function pause(state: GameState): GameState {
  return state.phase === "running" ? { ...state, phase: "paused" } : state;
}
export function resume(state: GameState): GameState {
  return state.phase === "paused" ? { ...state, phase: "running" } : state;
}
export function reset(state: GameState, settings: Settings = state.settings): GameState {
  return ready(settings, state.seed);
}

export interface Rect { x: number; y: number; width: number; height: number }
/** These exact rectangles are also used to draw the pipes. */
export function pipeRects(pipe: Pipe, gap: number): [Rect, Rect] {
  const x = pipe.x - WORLD.pipeWidth / 2;
  const bottomY = pipe.center + gap / 2;
  return [
    { x, y: 0, width: WORLD.pipeWidth, height: pipe.center - gap / 2 },
    { x, y: bottomY, width: WORLD.pipeWidth, height: WORLD.ground - bottomY },
  ];
}
export function circleTouchesRect(x: number, y: number, radius: number, rect: Rect): boolean {
  const dx = x - Math.max(rect.x, Math.min(x, rect.x + rect.width));
  const dy = y - Math.max(rect.y, Math.min(y, rect.y + rect.height));
  return dx * dx + dy * dy <= radius * radius;
}
export function collides(state: GameState): boolean {
  return state.birdY - WORLD.radius <= 0 || state.birdY + WORLD.radius >= WORLD.ground ||
    state.pipes.some((pipe) => pipeRects(pipe, state.config.gap)
      .some((rect) => circleTouchesRect(WORLD.birdX, state.birdY, WORLD.radius, rect)));
}

function tick(state: GameState, dt: number): GameState {
  const elapsed = Math.min(WORLD.duration, state.elapsed + dt);
  const velocity = Math.min(WORLD.maxFall, state.velocity + WORLD.gravity * dt);
  let next: GameState = {
    ...state, elapsed, velocity, birdY: state.birdY + velocity * dt,
    pipes: state.pipes.map((pipe) => ({ ...pipe, x: pipe.x - state.config.speed * dt })),
  };
  // Resolve contact before scoring or spawning on this step.
  if (collides(next)) return { ...next, phase: "ended", outcome: "collision" };

  let score = state.score;
  const pipes = next.pipes.map((pipe) => {
    if (!pipe.scored && pipe.x + WORLD.pipeWidth / 2 < WORLD.birdX - WORLD.radius) {
      score++;
      return { ...pipe, scored: true };
    }
    return pipe;
  }).filter((pipe) => pipe.x + WORLD.pipeWidth / 2 >= 0);
  next = { ...next, pipes, score };
  if (elapsed >= WORLD.duration - 1e-9) return { ...next, elapsed: WORLD.duration, phase: "ended", outcome: "complete" };

  if (elapsed + 1e-9 >= state.nextSpawn) {
    // Explicit local PRNG state keeps every comparison's centers identical.
    const rng = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0;
    const center = Math.max(WORLD.minCenter, Math.min(WORLD.maxCenter,
      state.lastCenter + (rng / 4294967296 * 2 - 1) * WORLD.maxShift));
    pipes.push({
      id: state.nextId, center, scored: false,
      x: WORLD.spawnX - state.config.speed * Math.max(0, elapsed - state.nextSpawn),
    });
    next = { ...next, rng, lastCenter: center, nextId: state.nextId + 1, nextSpawn: state.nextSpawn + state.config.interval };
  }
  return next;
}

/** Subdivide explicit elapsed time so even a delayed caller cannot tunnel through a pipe. */
export function step(state: GameState, seconds = FIXED_STEP): GameState {
  if (!Number.isFinite(seconds) || seconds <= 0 || state.phase !== "running") return state;
  let remaining = seconds;
  let next = state;
  while (remaining > 1e-10 && next.phase === "running") {
    const dt = Math.min(FIXED_STEP, remaining, WORLD.duration - next.elapsed);
    next = tick(next, dt);
    remaining -= dt;
  }
  return next;
}
