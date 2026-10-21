// All distances are in logical board units; visual effects never enter the rules.
export const PLAYER_X = 100;
export const PLAYER_WIDTH = 24;
export const SPEED = 220;
export const ROUND_SECONDS = 90;
export interface Block { x: number; width: number; height: number }
export interface RunnerState {
  phase: "ready" | "running" | "lost" | "complete";
  y: number;
  velocity: number;
  elapsed: number;
  cleared: number;
  block: Block;
}
export function newRun(): RunnerState {
  return { phase: "ready", y: 0, velocity: 0, elapsed: 0, cleared: 0, block: { x: 600, width: 30, height: 38 } };
}
export function jump(state: RunnerState): RunnerState {
  if (state.phase !== "running" || state.y > 0) return state;
  return { ...state, velocity: 560 };
}
export function collides(state: RunnerState): boolean {
  return state.block.x < PLAYER_X + PLAYER_WIDTH / 2 &&
    state.block.x + state.block.width > PLAYER_X - PLAYER_WIDTH / 2 && state.y < state.block.height;
}
export function step(state: RunnerState, seconds: number): RunnerState {
  if (state.phase !== "running" || !Number.isFinite(seconds) || seconds <= 0) return state;
  let next = { ...state, block: { ...state.block } };
  // Small substeps prevent a block tunnelling through the player on a slow frame.
  let remaining = Math.min(seconds, ROUND_SECONDS - next.elapsed);
  while (remaining > 0.000001) {
    const dt = Math.min(remaining, 1 / 120);
    next.y = Math.max(0, next.y + next.velocity * dt - 800 * dt * dt);
    if (next.y < 1e-9) next.y = 0;
    next.velocity = next.y === 0 ? 0 : next.velocity - 1600 * dt;
    next.elapsed += dt;
    const previousRight = next.block.x + next.block.width;
    next.block.x -= SPEED * dt;
    if (collides(next)) return { ...next, phase: "lost" };
    const right = next.block.x + next.block.width;
    const clearance = PLAYER_X - PLAYER_WIDTH / 2;
    if (previousRight >= clearance && right < clearance) next.cleared++;
    // Keep a cleared block moving until its trailing edge leaves the board.
    if (right < 0) {
      next.block = { x: 600, width: 30, height: 38 };
    }
    remaining -= dt;
  }
  if (next.elapsed >= ROUND_SECONDS - 0.000001) next.phase = "complete";
  return next;
}
