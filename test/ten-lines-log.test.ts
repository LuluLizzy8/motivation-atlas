import { describe, expect, it } from "vitest";
import { hardDrop, newGame, ROWS, type TenLinesOptions } from "../src/minigames/ten-lines/game";
import { loadLog, LOG_KEY, LOG_LIMIT, recordOf, saveLog, settingsLabel, summarize, type GameRecord } from "../src/minigames/ten-lines/log";

const classic: TenLinesOptions = { rising: true, target: 10 };

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) };
}

function game(overrides: Partial<GameRecord> = {}): GameRecord {
  return { ...recordOf("2026-10-11T12:00:00.000Z", newGame(classic, "I", "O"), 40, [], "lost"), ...overrides };
}

describe("the Ten Lines play log", () => {
  it("records how a game ended and what the field looked like", () => {
    const state = hardDrop(newGame(classic, "O", "T"), "L");
    const record = recordOf("2026-10-11T12:00:00.000Z", state, 12, [{ t: 900, kind: "O", rot: 0, x: 4, y: ROWS - 2, cleared: 0, height: 2 }], "lost");
    expect(record).toMatchObject({ outcome: "lost", lines: 0, seconds: 12, stars: null, fallMs: 800, options: classic });
    expect(record.board.length).toBe(ROWS);
    expect(record.board[ROWS - 1]).toBe("....OO....");
    expect(record.board[0]).toBe("..........");
  });

  it("gives stars only to a win", () => {
    const state = newGame(classic, "I", "O");
    expect(recordOf("x", state, 60, [], "won").stars).toBe(3);
    expect(recordOf("x", state, 60, [], "abandoned").stars).toBeNull();
  });

  it("summarizes the games with the toggle on and with it off", () => {
    const fixed = { ...classic, rising: false };
    const summary = summarize([
      game({ lines: 4 }),
      game({ lines: 10, outcome: "won", seconds: 90 }),
      game({ lines: 10, outcome: "won", seconds: 70 }),
      game({ options: fixed, lines: 3 }),
    ]);
    expect(summary).toEqual([
      { label: "Rising difficulty on", games: 3, won: 2, averageLines: 8, bestSeconds: 70 },
      { label: "Rising difficulty off", games: 1, won: 0, averageLines: 3, bestSeconds: null },
    ]);
    expect(settingsLabel(fixed)).toBe("Rising difficulty off");
  });

  it("saves the most recent games and reads them back", () => {
    const store = memory();
    const many = Array.from({ length: LOG_LIMIT + 5 }, (_, i) => game({ seconds: i }));
    const kept = saveLog(store, many);
    expect(kept.length).toBe(LOG_LIMIT);
    expect(kept[0].seconds).toBe(5);
    expect(loadLog(store)).toEqual(kept);
  });

  it("carries on when storage is missing, broken or full", () => {
    expect(loadLog(null)).toEqual([]);
    expect(loadLog(memory({ [LOG_KEY]: "not json" }))).toEqual([]);
    expect(loadLog(memory({ [LOG_KEY]: "{\"a\":1}" }))).toEqual([]);
    const full = { setItem: () => { throw new Error("quota"); } };
    expect(saveLog(full, [game()]).length).toBe(1);
    expect(saveLog(null, [game()]).length).toBe(1);
  });
});
