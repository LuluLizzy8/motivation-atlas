export const FINISH = 120;
export const OBSTACLE_COUNT = 12;
export const CATCH_UP_GAP = 3;
export const ACTION_WINDOW_MS = 750;
export const SLOWDOWN_MS = 1800;
export interface Obstacle { at: number; kind: "jump" | "squat" }

export interface RaceState {
  player: number;
  bot: number;
  elapsedMs: number;
  obstacles: Obstacle[];
  actionMs: number;
  actionKind: "jump" | "squat" | null;
  botActionMs: number;
  botActionKind: "jump" | "squat" | null;
  slowMs: number;
  collisions: number;
  running: boolean;
  winner: "you" | "bot" | null;
  lastEvent: "start" | "jump" | "squat" | "hit" | "won" | "lost";
}

export function newRace(random: () => number = Math.random): RaceState {
  const obstacles = Array.from({ length: OBSTACLE_COUNT }, (_, i) => ({
    at: 8 + i * 9 + Math.floor(random() * 5),
    kind: random() < 0.5 ? "jump" as const : "squat" as const,
  }));
  return { player: 0, bot: 0, elapsedMs: 0, obstacles, actionMs: 0, actionKind: null, botActionMs: 0, botActionKind: null, slowMs: 0, collisions: 0, running: false, winner: null, lastEvent: "start" };
}

export function startRace(state: RaceState): RaceState {
  return state.winner ? state : { ...state, running: true };
}

export function pauseRace(state: RaceState): RaceState {
  return { ...state, running: false };
}

export function act(state: RaceState, kind: "jump" | "squat"): RaceState {
  if (!state.running || state.winner || state.actionMs > 0 || state.slowMs > 0) return state;
  return { ...state, actionMs: ACTION_WINDOW_MS, actionKind: kind, lastEvent: kind };
}

export function jump(state: RaceState): RaceState { return act(state, "jump"); }
export function squat(state: RaceState): RaceState { return act(state, "squat"); }

function crossedObstacle(from: number, to: number, obstacles: Obstacle[]): Obstacle | undefined {
  return obstacles.find((obstacle) => from < obstacle.at && to >= obstacle.at);
}

export function botPace(player: number, bot: number, pace: number, catchUp: boolean): number {
  return pace * (catchUp && player - bot >= CATCH_UP_GAP ? 1.35 : 1);
}

export function advanceRace(state: RaceState, elapsedMs: number, pace: number, catchUp: boolean): RaceState {
  if (!state.running || state.winner || elapsedMs <= 0) return state;
  const seconds = elapsedMs / 1000;
  const playerSpeed = pace * (state.slowMs > 0 ? 0.28 : 1);
  const proposedPlayer = Math.min(FINISH, state.player + playerSpeed * seconds);
  const obstacle = crossedObstacle(state.player, proposedPlayer, state.obstacles);
  let player = proposedPlayer;
  let slowMs = Math.max(0, state.slowMs - elapsedMs);
  let actionMs = Math.max(0, state.actionMs - elapsedMs);
  let collisions = state.collisions;
  let lastEvent: RaceState["lastEvent"] = state.lastEvent;

  if (obstacle !== undefined && state.actionKind !== obstacle.kind && state.slowMs === 0) {
    player = obstacle.at + 0.2;
    slowMs = SLOWDOWN_MS;
    actionMs = 0;
    collisions++;
    lastEvent = "hit";
  }

  const botSpeed = botPace(player, state.bot, pace * 0.95, catchUp);
  const proposedBot = Math.min(FINISH, state.bot + botSpeed * seconds);
  const botObstacle = crossedObstacle(state.bot, proposedBot, state.obstacles);
  const botActionMs = botObstacle === undefined ? Math.max(0, state.botActionMs - elapsedMs) : 400;
  const botActionKind = botObstacle?.kind ?? (botActionMs > 0 ? state.botActionKind : null);
  const bot = proposedBot;
  const winner = player >= FINISH ? "you" : bot >= FINISH ? "bot" : null;
  if (winner === "you") lastEvent = "won";
  if (winner === "bot") lastEvent = "lost";

  return {
    player, bot, elapsedMs: state.elapsedMs + elapsedMs, obstacles: state.obstacles, actionMs, actionKind: actionMs > 0 ? state.actionKind : null,
    botActionMs, botActionKind, slowMs, collisions,
    running: winner === null && state.running, winner, lastEvent,
  };
}
