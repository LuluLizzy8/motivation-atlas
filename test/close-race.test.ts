import { describe, expect, it } from "vitest";
import { act, advanceRace, botPace, jump, newRace, squat, startRace, type RaceState } from "../src/minigames/close-race/game";

describe("Road Race", () => {
  it("speeds up the trailing bot only when the catch-up rule is on", () => {
    expect(botPace(8, 5, 1, true)).toBe(1.35);
    expect(botPace(8, 5, 1, false)).toBe(1);
    expect(botPace(7, 5, 1, true)).toBe(1);
  });

  it("moves on its own at the selected pace", () => {
    const moving = startRace(newRace());
    expect(advanceRace(moving, 1000, 0.8, false).player).toBeCloseTo(0.8);
    expect(advanceRace(moving, 1000, 1.25, false).player).toBeCloseTo(1.25);
  });

  it("slows the runner after a hurdle collision", () => {
    const atHurdle: RaceState = { ...startRace(newRace()), obstacles: [{ at: 12, kind: "jump" }], player: 11.5 };
    const hit = advanceRace(atHurdle, 1000, 1, false);
    expect(hit.collisions).toBe(1);
    expect(hit.slowMs).toBe(1800);
    const recovering = advanceRace(hit, 1000, 1, false);
    expect(recovering.player - hit.player).toBeCloseTo(0.28);
    expect(recovering.slowMs).toBe(800);
  });

  it("lets a timely jump pass the hurdle without slowing", () => {
    const atHurdle: RaceState = { ...startRace(newRace()), obstacles: [{ at: 12, kind: "jump" }], player: 11.9 };
    const airborne = jump(atHurdle);
    const cleared = advanceRace(airborne, 200, 1, false);
    expect(cleared.player).toBeGreaterThan(12);
    expect(cleared.collisions).toBe(0);
    expect(cleared.slowMs).toBe(0);
  });

  it("requires a squat under a high bar", () => {
    const atBar: RaceState = { ...startRace(newRace()), obstacles: [{ at: 24, kind: "squat" }], player: 23.9 };
    const ducking = squat(atBar);
    const cleared = advanceRace(ducking, 200, 1, false);
    expect(cleared.player).toBeGreaterThan(24);
    expect(cleared.collisions).toBe(0);
    const wrongAction = advanceRace(act(atBar, "jump"), 200, 1, false);
    expect(wrongAction.collisions).toBe(1);
  });

  it("creates twelve spaced obstacles with a fresh random layout", () => {
    const first = newRace(() => 0);
    const second = newRace(() => 0.99);
    expect(first.obstacles).toHaveLength(12);
    expect(new Set(first.obstacles.map((obstacle) => obstacle.at)).size).toBe(12);
    expect(first.obstacles.map((obstacle) => obstacle.at)).not.toEqual(second.obstacles.map((obstacle) => obstacle.at));
  });

  it("does not restart or extend an action while it is active", () => {
    const airborne = jump(startRace(newRace(() => 0)));
    expect(act(airborne, "jump")).toBe(airborne);
  });
});
