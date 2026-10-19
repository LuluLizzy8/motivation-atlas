import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  cells, COLS, dealer, fallIntervalMs, hardDrop, KINDS, landing, level, move, newGame, rotate, ROWS, stackHeight, stars, step,
  type Board, type TenLinesOptions, type TenLinesState,
} from "../src/minigames/ten-lines/game";
import { dynamicsFor, SOURCES } from "../src/minigames/ten-lines/sources";

const classic: TenLinesOptions = { rising: true, target: 10 };

/** A copy of the state with some squares of the board filled in. */
function withBlocks(s: TenLinesState, filled: (x: number, y: number) => boolean): TenLinesState {
  const board: Board = s.board.map((row, y) => row.map((_, x) => (filled(x, y) ? "O" : null)));
  return { ...s, board };
}

describe("Ten Lines", () => {
  // The central rule, and the game's one toggle: rising difficulty.
  it("speeds up every two lines when rising difficulty is on, and never when it is off", () => {
    const at = (rising: boolean, lines: number) => ({ ...newGame({ ...classic, rising }, "O", "O"), lines });
    expect([0, 1, 2, 4, 6, 8].map((lines) => fallIntervalMs(at(true, lines)))).toEqual([800, 800, 640, 512, 410, 328]);
    expect([0, 1, 2, 4, 6, 8].map((lines) => fallIntervalMs(at(false, lines)))).toEqual([800, 800, 800, 800, 800, 800]);
    expect(level(at(true, 9))).toBe(4);
    expect(level(at(false, 9))).toBe(0);
  });

  it("speeds up as lines are really cleared in play, not only on paper", () => {
    // The bottom row lacks only the four columns a flat I fills, twice over.
    const rows = (x: number, y: number) => y >= ROWS - 2 && (x < 3 || x > 6);
    const play = (rising: boolean) => hardDrop(hardDrop(withBlocks(newGame({ ...classic, rising }, "I", "I"), rows), "I"), "I");
    expect(play(true).lines).toBe(2);
    expect(fallIntervalMs(play(true))).toBe(640);
    expect(fallIntervalMs(play(false))).toBe(800);
  });

  it("gives every piece four squares and brings it home after four turns", () => {
    for (const kind of KINDS) {
      let s = step(newGame(classic, kind, "O"), "O");
      const start = cells(s.piece);
      expect(start.length).toBe(4);
      for (let i = 0; i < 4; i++) s = rotate(s);
      expect(cells(s.piece)).toEqual(start);
    }
  });

  it("stops a piece at the walls", () => {
    let s = newGame(classic, "O", "T");
    for (let i = 0; i < COLS; i++) s = move(s, -1);
    expect(Math.min(...cells(s.piece).map(([x]) => x))).toBe(0);
    for (let i = 0; i < 2 * COLS; i++) s = move(s, 1);
    expect(Math.max(...cells(s.piece).map(([x]) => x))).toBe(COLS - 1);
  });

  it("nudges a piece off the wall when a turn would not fit", () => {
    let s = rotate(newGame(classic, "I", "O"));
    for (let i = 0; i < COLS; i++) s = move(s, -1);
    expect(cells(s.piece).every(([x]) => x === 0)).toBe(true);
    s = rotate(s);
    expect(cells(s.piece).map(([x]) => x).sort()).toEqual([0, 1, 2, 3]);
  });

  it("falls one row per step and lands at the bottom", () => {
    let s = newGame(classic, "O", "T");
    s = step(s, "L");
    expect(s.piece.y).toBe(1);
    expect(s.lastEvent).toBe("moved");
    for (let i = 0; i < ROWS; i++) s = step(s, "L");
    expect(s.board[ROWS - 1].filter((c) => c === "O").length).toBe(2);
    expect(s.piece.kind).toBe("T");
    expect(s.next).toBe("L");
    expect(s.heightHistory).toEqual([0, 2]);
  });

  it("drops a piece where the landing preview shows it", () => {
    const s = newGame(classic, "T", "O");
    const target = cells(landing(s));
    expect(s.piece.y).toBe(0);
    const dropped = hardDrop(s, "O");
    for (const [x, y] of target) expect(dropped.board[y][x]).toBe("T");
    expect(dropped.lastEvent).toBe("locked");
  });

  it("clears a full row and moves the stack down", () => {
    // The bottom row lacks only the four columns a flat I fills; one block sits above it.
    const start = withBlocks(newGame(classic, "I", "O"), (x, y) => (y === ROWS - 1 && (x < 3 || x > 6)) || (y === ROWS - 2 && x === 0));
    const s = hardDrop(start, "T");
    expect(s.lines).toBe(1);
    expect(s.lastEvent).toBe("cleared");
    expect(s.board[ROWS - 1].filter((c) => c !== null).length).toBe(1);
    expect(stackHeight(s.board)).toBe(1);
  });

  it("is won at the target and then ignores every move", () => {
    const start = withBlocks(newGame({ ...classic, target: 1 }, "I", "O"), (x, y) => y === ROWS - 1 && (x < 3 || x > 6));
    const s = hardDrop(start, "T");
    expect(s.over).toBe("won");
    expect(step(s, "T")).toBe(s);
    expect(move(s, 1)).toBe(s);
    expect(rotate(s)).toBe(s);
    expect(hardDrop(s, "T")).toBe(s);
  });

  it("is lost when the next piece has no room to appear", () => {
    const start = withBlocks(newGame(classic, "O", "O"), (x, y) => x === 4 && y >= 2);
    const s = step(start, "T");
    expect(s.over).toBe("lost");
    expect(s.lastEvent).toBe("lost");
  });

  it("grades a finish with one to three stars", () => {
    expect([40, 75, 76, 110, 111].map(stars)).toEqual([3, 3, 2, 2, 1]);
  });

  it("deals shuffled sets: all seven shapes, in a fresh order, before any repeats", () => {
    const draw = dealer();
    const sets = Array.from({ length: 40 }, () => Array.from({ length: KINDS.length }, draw));
    for (const set of sets) expect([...set].sort()).toEqual([...KINDS].sort());
    expect(new Set(sets.map((set) => set.join(""))).size).toBeGreaterThan(1);
    // The longest wait for any one shape is the end of one set to the end of the next.
    const run = sets.flat();
    for (const kind of KINDS) {
      const at = run.flatMap((k, i) => (k === kind ? [i] : []));
      for (let i = 1; i < at.length; i++) expect(at[i] - at[i - 1]).toBeLessThanOrEqual(2 * KINDS.length - 1);
    }
  });

  it("quotes the note verbatim", () => {
    const note = readFileSync("content/player-motivations.md", "utf8");
    for (const text of Object.values(SOURCES)) expect(note).toContain(text);
  });

  it("names the dynamics each setting produces", () => {
    expect(dynamicsFor(classic)).toEqual([SOURCES.rising, SOURCES.timePressure, SOURCES.sameButDifferent]);
    const flat = dynamicsFor({ ...classic, rising: false });
    expect(flat).toContain(SOURCES.sameButDifferent);
    expect(flat).not.toContain(SOURCES.rising);
  });
});
