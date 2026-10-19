import { describe, expect, it } from "vitest";
import { hold, newGame, pass, rescue, roll, type LifelineOptions } from "../src/minigames/lifeline/game";

const withLifeline: LifelineOptions = { lifeline: true, target: 60, turns: 8 };
const without: LifelineOptions = { ...withLifeline, lifeline: false };

describe("Lifeline", () => {
  it("lets the partner rescue a bust, banking the lost turn total and spending their lifeline", () => {
    let s = roll(roll(newGame(withLifeline), 6), 5);
    s = roll(s, 1);
    expect(s.pendingRescue).toBe(11);
    expect(s.current).toBe(0);
    s = rescue(s);
    expect(s.score).toBe(11);
    expect(s.lifelines).toEqual([true, false]);
    expect(s.current).toBe(1);
    expect(s.lastEvent).toBe("rescued");
  });

  it("loses a bust with the lifeline off and rejects a rescue", () => {
    const s = roll(roll(roll(newGame(without), 6), 5), 1);
    expect(s.score).toBe(0);
    expect(s.pendingRescue).toBe(0);
    expect(s.current).toBe(1);
    expect(rescue(s)).toBe(s);
  });

  it("offers no second rescue once the partner's lifeline is spent", () => {
    let s = rescue(roll(roll(newGame(withLifeline), 4), 1));
    s = hold(roll(s, 3));
    s = roll(roll(s, 6), 1);
    expect(s.pendingRescue).toBe(0);
    expect(s.score).toBe(7);
    expect(rescue(s)).toBe(s);
  });

  it("passes play on when the partner declines", () => {
    const s = pass(roll(roll(newGame(withLifeline), 6), 1));
    expect(s.score).toBe(0);
    expect(s.lifelines).toEqual([true, true]);
    expect(s.current).toBe(1);
  });

  it("blocks rolling and holding while a rescue is pending", () => {
    const s = roll(roll(newGame(withLifeline), 6), 1);
    expect(roll(s, 4)).toBe(s);
    expect(hold(s)).toBe(s);
  });

  it("wins at the target and loses when the turns run out", () => {
    const won = roll(roll(newGame({ ...withLifeline, target: 10 }), 6), 5);
    expect(won.outcome).toBe("won");
    let s = newGame({ ...without, turns: 2 });
    s = hold(roll(s, 3));
    s = hold(roll(s, 3));
    expect(s.outcome).toBe("lost");
    expect(roll(s, 4)).toBe(s);
  });
});
