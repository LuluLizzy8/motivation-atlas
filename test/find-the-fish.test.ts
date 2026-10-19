import { describe, expect, it } from "vitest";
import { feedbackForGuess, guessTile, newGame, type Position } from "../src/minigames/find-the-fish/game";

const fish: Position = { row: 3, col: 3 };

describe("Find the Fish", () => {
  it("returns a strong scent for a miss at distance 1 with hints on", () => {
    expect(feedbackForGuess({ row: 2, col: 3 }, fish, true)).toBe("strong");
  });

  it("returns a faint scent at distance 2 or 3 with hints on", () => {
    expect(feedbackForGuess({ row: 1, col: 3 }, fish, true)).toBe("faint");
    expect(feedbackForGuess({ row: 1, col: 2 }, fish, true)).toBe("faint");
  });

  it("returns no scent at distance 4 or more with hints on", () => {
    expect(feedbackForGuess({ row: 0, col: 2 }, fish, true)).toBe("none");
    expect(feedbackForGuess({ row: 0, col: 0 }, fish, true)).toBe("none");
  });

  it("reveals no distance-based hint when hints are off", () => {
    expect(feedbackForGuess({ row: 2, col: 3 }, fish, false)).toBe("unguided");
    expect(feedbackForGuess({ row: 0, col: 0 }, fish, false)).toBe("unguided");
  });

  it("finds the fish in both modes", () => {
    expect(guessTile(newGame(true, fish), fish).lastFeedback).toBe("found");
    expect(guessTile(newGame(false, fish), fish).lastFeedback).toBe("found");
  });

  it("does not count an already revealed tile twice", () => {
    const first = guessTile(newGame(true, fish), { row: 0, col: 0 });
    const repeated = guessTile(first, { row: 0, col: 0 });
    expect(repeated).toBe(first);
    expect(repeated.roundGuesses).toBe(1);
    expect(repeated.totalGuesses).toBe(1);
  });
});
