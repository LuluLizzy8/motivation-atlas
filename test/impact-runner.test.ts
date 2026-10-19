import { describe, expect, it } from "vitest";
import { jump, newRun, step, type RunnerState } from "../src/minigames/impact-runner/game";
const running = (): RunnerState => ({ ...newRun(), phase: "running" });
describe("Impact Runner rules", () => {
  it("ends the run when the player hits a block and freezes the result", () => {
    const state = { ...running(), block: { x: 120, width: 30, height: 38 } };
    const lost = step(state, .1);
    expect(lost.phase).toBe("lost");
    expect(step(lost, 1)).toBe(lost);
    expect(jump(lost)).toBe(lost);
  });
  it("lets a well-timed jump clear a block and land safely", () => {
    let state = jump({ ...running(), block: { x: 170, width: 30, height: 38 } });
    state = step(state, .7);
    expect(state.phase).toBe("running");
    expect(state.cleared).toBe(1);
    expect(state.y).toBe(0);
  });
  it("keeps a cleared block moving offscreen and counts it only once", () => {
    const cleared = step(jump({ ...running(), block: { x: 170, width: 30, height: 38 } }), .7);
    expect(cleared.block.x).toBeCloseTo(16);
    expect(cleared.cleared).toBe(1);
    const leaving = step(cleared, .15);
    expect(leaving.block.x).toBeLessThan(0);
    expect(leaving.block.x + leaving.block.width).toBeGreaterThan(0);
    expect(leaving.cleared).toBe(1);
    const replaced = step(leaving, .1);
    expect(replaced.block.x).toBeGreaterThan(500);
    expect(replaced.cleared).toBe(1);
  });
  it("rejects midair jumps", () => {
    const airborne = step(jump(running()), .1);
    expect(airborne.y).toBeGreaterThan(0);
    expect(jump(airborne)).toBe(airborne);
  });
  it("finishes a surviving run at 90 seconds", () => {
    const state = step({ ...running(), elapsed: 89.99 }, .02);
    expect(state.phase).toBe("complete");
  });
});
