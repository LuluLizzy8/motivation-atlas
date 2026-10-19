// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { tenLines } from "../src/minigames/ten-lines";
import { COLS, ROWS } from "../src/minigames/ten-lines/game";
import { LOG_KEY, type GameRecord } from "../src/minigames/ten-lines/log";

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function setup() {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0); // the shuffle then deals I, L, J, Z, S, T, O
  // Start focuses the field, and jsdom's focus() sets a timer of its own that would muddy the counts below.
  vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(() => {});
  const el = document.createElement("div");
  document.body.append(el);
  const unmount = tenLines.mount(el);
  const q = <T extends Element>(sel: string) => el.querySelector(sel) as T;
  const click = (sel: string) => q<HTMLElement>(sel).click();
  /** The columns filled in a row of the field. */
  const row = (y: number) => [...q("[data-board]").children].slice(y * COLS, (y + 1) * COLS)
    .flatMap((square, x) => (square.getAttribute("data-kind") ? [x] : []));
  return { el, unmount, q, click, row };
}

describe("Ten Lines on the page", () => {
  it("waits for Start, then lets gravity pull the piece down", () => {
    const { click, row, unmount } = setup();
    expect(vi.getTimerCount()).toBe(0);
    click("[data-new]");
    expect(row(1)).toEqual([3, 4, 5, 6]);
    vi.advanceTimersByTime(800);
    expect(row(1)).toEqual([]);
    expect(row(2)).toEqual([3, 4, 5, 6]);
    unmount();
  });

  it("moves with the buttons and the keyboard, and drops to the bottom", () => {
    const { click, row, q, unmount } = setup();
    click("[data-new]");
    click("[data-control='left']");
    expect(row(1)).toEqual([2, 3, 4, 5]);
    q("[data-board]").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    q("[data-board]").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(row(1)).toEqual([4, 5, 6, 7]);
    click("[data-control='drop']");
    expect(row(ROWS - 1)).toEqual([4, 5, 6, 7]);
    expect(row(1)).toEqual([3, 4, 5]); // the L that follows
    unmount();
  });

  it("ignores the controls until the game starts and while it is paused", () => {
    const { click, row, q, unmount } = setup();
    click("[data-control='drop']");
    expect(row(ROWS - 1)).toEqual([]);
    click("[data-new]");
    click("[data-pause]");
    expect(vi.getTimerCount()).toBe(0);
    expect(q("[data-pause]").textContent).toBe("Resume");
    click("[data-control='left']");
    expect(row(1)).toEqual([3, 4, 5, 6]);
    click("[data-pause]");
    expect(vi.getTimerCount()).toBe(1);
    unmount();
  });

  it("applies the toggle on New game", () => {
    const { click, q, unmount } = setup();
    expect(q("[data-speed]").textContent).toContain("0.80 seconds");
    expect(q("[data-dynamics]").textContent).toContain("Difficulty that rises");
    click("[data-mechanic='rising-difficulty']");
    click("[data-new]");
    expect(q("[data-speed]").textContent).toContain("0.80 seconds");
    expect(q("[data-dynamics]").textContent).toContain("With the speed fixed");
    unmount();
  });

  it("ends when the stack reaches the top, and cleans up on unmount", () => {
    const { click, q, el, unmount } = setup();
    click("[data-new]");
    for (let i = 0; i < ROWS; i++) click("[data-control='drop']");
    expect(q("[data-status]").textContent).toContain("The stack reached the top");
    expect(vi.getTimerCount()).toBe(0);
    click("[data-new]");
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(el.childNodes.length).toBe(0);
  });

  it("logs each game in the browser, with the toggle setting and every placement", () => {
    const { click, q, unmount } = setup();
    expect(q("[data-log-count]").textContent).toBe("0 games");
    click("[data-mechanic='rising-difficulty']");
    click("[data-new]");
    for (let i = 0; i < ROWS; i++) click("[data-control='drop']");
    const saved = JSON.parse(window.localStorage.getItem(LOG_KEY)!) as GameRecord[];
    expect(saved.length).toBe(1);
    expect(saved[0].outcome).toBe("lost");
    expect(saved[0].options).toEqual({ rising: false, target: 10 });
    expect(saved[0].placements.length).toBeGreaterThan(3);
    expect(saved[0].placements[0]).toMatchObject({ kind: "I", x: 3, y: ROWS - 2, cleared: 0, height: 1 });
    expect(saved[0].board.length).toBe(ROWS);
    expect(q("[data-log-count]").textContent).toBe("1 game");
    expect(q("[data-log]").textContent).toContain("Topped out");
    expect(q("[data-log]").textContent).toContain("Rising difficulty off");
    unmount();
  });

  it("logs a game left unfinished, shows earlier games on the next visit, and clears on request", () => {
    const first = setup();
    first.click("[data-new]");
    first.click("[data-control='drop']");
    first.unmount();
    const { click, q, unmount } = setup();
    expect(q("[data-log-count]").textContent).toBe("1 game");
    expect(q("[data-log]").textContent).toContain("Left unfinished");
    click("[data-log-clear]");
    expect(q("[data-log-count]").textContent).toBe("0 games");
    expect(JSON.parse(window.localStorage.getItem(LOG_KEY)!)).toEqual([]);
    unmount();
  });

  it("asks the player to reflect, and frames the panel as the sources' claims", () => {
    const { q, unmount } = setup();
    expect(q(".tl-reflect").textContent).toContain("What did you feel");
    expect(q(".tl-reflect").querySelector("input, textarea, select")).toBeNull();
    expect(q(".tl-panel h4").textContent).toBe("What the sources say emerges");
    unmount();
  });
});
