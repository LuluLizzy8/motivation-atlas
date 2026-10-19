// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { speedUpGrid } from "../src/minigames/speed-up-grid";
import { LIVES, MIN_WINDOW, START_WINDOW, expire, newGame, tap, tick } from "../src/minigames/speed-up-grid/game";

const rng = () => 0.5;
function hitN(escalation: boolean, n: number) {
  let s = newGame({ escalation }, rng);
  for (let i = 0; i < n; i++) s = tap(s, s.target, rng);
  return s;
}

describe("Speed-up grid rules", () => {
  it("central rule: with escalation on, every hit shortens the window; off, it never changes", () => {
    const on = [0, 1, 2, 3, 4].map((n) => hitN(true, n).window);
    for (let i = 1; i < on.length; i++) expect(on[i]).toBeLessThan(on[i - 1]);
    expect(hitN(false, 20).window).toBe(START_WINDOW);
    expect(hitN(false, 20).hits).toBe(20);
  });

  it("never speeds up past the floor", () => {
    expect(hitN(true, 200).window).toBe(MIN_WINDOW);
  });

  it("moves the target after a hit, and a wrong cell costs a life", () => {
    const s = newGame({ escalation: true }, rng);
    expect(tap(s, s.target, rng).target).not.toBe(s.target);
    const wrong = tap(s, (s.target + 1) % 9, rng);
    expect(wrong.misses).toBe(1);
    expect(wrong.hits).toBe(0);
  });

  it("ends the round after three misses or when the clock runs out", () => {
    let s = newGame({ escalation: false }, rng);
    for (let i = 0; i < LIVES; i++) s = expire(s, rng);
    expect(s.over).toBe(true);
    expect(tick(newGame({ escalation: false }, rng), 60_000).over).toBe(true);
  });

  it("ends on time, without costing a life, when the clock runs out while a target is lit", () => {
    const s = { ...newGame({ escalation: false }, rng), timeLeft: 500 }; // less than the 1100 ms window
    const after = expire(s, rng);
    expect(after.over).toBe(true);
    expect(after.misses).toBe(0);
    expect(after.timeLeft).toBe(0);
    expect(tap(after, after.target, rng)).toBe(after); // nothing scores after time is up
  });

  it("keeps a round over once the clock has ended it, even after a wrong tap", () => {
    const s = { ...newGame({ escalation: false }, rng), timeLeft: 0, over: true };
    expect(expire(s, rng).over).toBe(true);
  });
});

describe("Speed-up grid on the page", () => {
  afterEach(() => vi.useRealTimers());

  it("starts a round, scores a hit, and clears its timer on unmount", () => {
    vi.useFakeTimers();
    const el = document.createElement("div");
    document.body.append(el);
    const unmount = speedUpGrid.mount(el);
    (el.querySelector("[data-start]") as HTMLButtonElement).click();
    expect(vi.getTimerCount()).toBe(2); // the target's timeout and the clock's interval
    (el.querySelector(".su-cell.lit") as HTMLButtonElement).click();
    expect(el.querySelector("[data-hits]")!.textContent).toBe("1");
    expect(Number(el.querySelector("[data-window]")!.textContent)).toBeLessThan(START_WINDOW);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(el.childNodes.length).toBe(0);
  });

  it("counts the clock down between taps, and stops at time's up", () => {
    vi.useFakeTimers();
    const el = document.createElement("div");
    document.body.append(el);
    const unmount = speedUpGrid.mount(el);
    (el.querySelector("[data-start]") as HTMLButtonElement).click();
    vi.advanceTimersByTime(700); // less than one target window, so only the clock has moved
    expect(el.querySelector("[data-clock]")!.textContent).toBe("45");
    vi.advanceTimersByTime(400);
    expect(Number(el.querySelector("[data-clock]")!.textContent)).toBeLessThanOrEqual(44);
    vi.advanceTimersByTime(60_000);
    expect(el.querySelector("[data-status]")!.textContent).toMatch(/Time's up|Out of lives/);
    expect(vi.getTimerCount()).toBe(0);
    unmount();
  });

  it("takes number keys from anywhere on the page, and stops listening on unmount", () => {
    vi.useFakeTimers();
    const el = document.createElement("div");
    document.body.append(el);
    const unmount = speedUpGrid.mount(el);
    (el.querySelector("[data-start]") as HTMLButtonElement).click();
    const lit = Number(el.querySelector(".su-cell.lit")!.getAttribute("data-cell"));
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: String(lit + 1), bubbles: true }));
    expect(el.querySelector("[data-hits]")!.textContent).toBe("1");
    const remove = vi.spyOn(document, "removeEventListener");
    unmount();
    expect(remove).toHaveBeenCalledWith("keydown", expect.any(Function));
    expect(el.childNodes.length).toBe(0);
  });
});
