// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pebbleSort } from "../src/minigames/pebble-sort";
import { newRound, place, tick, timeLeft, type Kind, type SortOptions } from "../src/minigames/pebble-sort/game";
import { dynamicsFor, SOURCES } from "../src/minigames/pebble-sort/sources";

const counter: SortOptions = { moveCounter: true, pebbles: 3, seconds: 20 };
const clock: SortOptions = { ...counter, moveCounter: false };
/** random() values that give the basket round, sharp, flat. */
const basket = (options: SortOptions) => {
  const picks = [0, 0.5, 0.9];
  return newRound(options, () => picks.shift()!);
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("Pebble Sort rules", () => {
  it("keeps a pebble in the right bowl and hands it back from a wrong one", () => {
    let s = basket(counter);
    expect(s.basket).toEqual([0, 1, 2]);
    s = place(s, 1);
    expect(s.lastEvent).toBe("bounced");
    expect(s.basket).toEqual([0, 1, 2]);
    expect(s.moves).toBe(1);
    s = place(s, 0);
    expect(s.lastEvent).toBe("sorted");
    expect(s.basket).toEqual([1, 2]);
    expect(s.sorted).toBe(1);
  });

  it("ends the round only when the basket is empty, with the move counter on", () => {
    let s = place(basket(counter), 0);
    s = tick(s, 60 * 60 * 1000);
    expect(s.status).toBe("playing");
    expect(s.elapsed).toBe(0);
    expect(timeLeft(s)).toBe(Infinity);
    s = place(place(s, 1), 2);
    expect(s.status).toBe("cleared");
    expect(s.moves).toBe(3);
  });

  it("ends the round when the clock runs out, with pebbles still in the basket, with the counter off", () => {
    let s = place(basket(clock), 0);
    s = tick(s, 19_900);
    expect(s.status).toBe("playing");
    expect(timeLeft(s)).toBe(100);
    s = tick(s, 500);
    expect(s.status).toBe("timeUp");
    expect(timeLeft(s)).toBe(0);
    expect(s.basket).toEqual([1, 2]);
    expect(place(s, 1)).toBe(s);
  });

  it("starts the clock on the first move, not before", () => {
    const ready = basket(clock);
    expect(tick(ready, 30_000)).toBe(ready);
    expect(timeLeft(ready)).toBe(20_000);
  });

  it("rejects a bowl that is not 0, 1 or 2", () => {
    expect(() => place(basket(counter), 3)).toThrow(RangeError);
  });

  it("fills a basket of the right size with the three kinds", () => {
    const s = newRound({ ...counter, pebbles: 30 });
    expect(s.basket).toHaveLength(30);
    for (const k of s.basket) expect([0, 1, 2]).toContain(k as Kind);
  });
});

describe("Pebble Sort sources", () => {
  it("quotes the note verbatim", () => {
    const note = readFileSync("content/player-motivations.md", "utf8");
    for (const text of Object.values(SOURCES)) expect(note).toContain(text);
  });
  it("names the counter's dynamics when it is on, and time pressure when it is off", () => {
    expect(dynamicsFor(counter)).toContain(SOURCES.counter);
    expect(dynamicsFor(clock)).toContain(SOURCES.pressure);
    expect(dynamicsFor(clock)).not.toContain(SOURCES.counter);
  });
});

describe("Pebble Sort on the page", () => {
  function setup() {
    vi.spyOn(Math, "random").mockReturnValue(0); // every pebble is round
    const el = document.createElement("div");
    document.body.append(el);
    const unmount = pebbleSort.mount(el);
    const q = <T extends Element>(sel: string) => el.querySelector(sel) as T;
    return { el, unmount, q };
  }

  it("sorts by click and by key, counting moves with no clock", () => {
    vi.useFakeTimers();
    const { q, unmount } = setup();
    q<HTMLButtonElement>("[data-bowl='0']").click();
    q("[data-bowl='0']").dispatchEvent(new KeyboardEvent("keydown", { key: "1", bubbles: true }));
    expect(q("[data-sorted]").textContent).toBe("2");
    expect(q("[data-gauge]").textContent).toBe("Moves 2");
    expect(vi.getTimerCount()).toBe(0);
    unmount();
  });

  it("runs a clock when the toggle is off, ends the round, and cleans up", () => {
    vi.useFakeTimers();
    const { q, el, unmount } = setup();
    const toggle = q<HTMLInputElement>("[data-mechanic='move-counter']");
    toggle.click();
    expect(toggle.checked).toBe(false);
    q<HTMLButtonElement>("[data-bowl='0']").click();
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(21_000);
    expect(q("[data-status]").textContent).toMatch(/^Time\./);
    expect(q("[data-bowl='0']").getAttribute("aria-disabled")).toBe("true");
    expect(vi.getTimerCount()).toBe(0);
    q<HTMLButtonElement>("[data-new]").click();
    q<HTMLButtonElement>("[data-bowl='0']").click();
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(el.childNodes.length).toBe(0);
  });

  it("asks the player to reflect, without scoring them", () => {
    const { q, unmount } = setup();
    expect(q(".ps-reflect")!.textContent).toContain("feel");
    expect(q(".ps-reflect")!.querySelector("input, textarea, select")).toBeNull();
    unmount();
  });
});
