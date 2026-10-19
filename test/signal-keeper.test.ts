// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { INITIAL_WIDTH, isHit, markerPosition, nextWidth } from "../src/minigames/signal-keeper/game";
import { signalKeeper } from "../src/minigames/signal-keeper";

afterEach(() => vi.useRealTimers());

it("adaptation narrows after success and widens after failure; off stays fixed", () => {
  expect(nextWidth(INITIAL_WIDTH, true, true)).toBe(30);
  expect(nextWidth(30, false, true)).toBe(INITIAL_WIDTH);
  expect(nextWidth(INITIAL_WIDTH, true, false)).toBe(INITIAL_WIDTH);
  expect(nextWidth(INITIAL_WIDTH, false, false)).toBe(INITIAL_WIDTH);
  expect(nextWidth(12, true, true)).toBe(6);
  expect(nextWidth(6, true, true)).toBe(3);
  expect(nextWidth(3, true, true)).toBe(3);
  expect(nextWidth(3, false, true)).toBe(9);
  expect(isHit(52, 6)).toBe(true);
  expect(isHit(52, 3)).toBe(false);
  expect(nextWidth(60, false, true)).toBe(60);
  expect(isHit(66, INITIAL_WIDTH)).toBe(true);
  expect(isHit(66, nextWidth(INITIAL_WIDTH, true, true))).toBe(false);
});

it("sweeps through the target and back on a repeatable clock", () => {
  expect(markerPosition(0)).toBe(0);
  expect(markerPosition(750)).toBe(50);
  expect(markerPosition(1500)).toBe(100);
  expect(markerPosition(2250)).toBe(50);
  expect(markerPosition(3000)).toBe(0);
});

it("runs ten trials, prevents repeat scoring, and resets for the other mode", () => {
  vi.useFakeTimers();
  const host = document.createElement("div");
  const unmount = signalKeeper.mount(host);
  const [start, lock] = host.querySelectorAll("button");
  const toggle = host.querySelector("input")!;
  start.click();
  expect(toggle.disabled).toBe(false);
  vi.advanceTimersByTime(750);
  lock.click(); lock.click();
  expect(host.querySelector('[role="status"]')!.textContent).toContain("Hit!");
  vi.advanceTimersByTime(5250);
  expect(host.querySelectorAll("li")).toHaveLength(1);
  expect(host.textContent).toContain("target 30%");
  vi.advanceTimersByTime(54000);
  expect(host.textContent).toContain("Adaptive ON: 1/10 hits");
  expect(toggle.disabled).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
  toggle.checked = false;
  start.click();
  vi.advanceTimersByTime(6000);
  expect(host.textContent).toContain("target 36%");
  unmount();
  expect(host.childNodes).toHaveLength(0);
  expect(vi.getTimerCount()).toBe(0);
});

it("keeps mode changes pending until a mid-round restart", () => {
  vi.useFakeTimers();
  const host = document.createElement("div");
  const unmount = signalKeeper.mount(host);
  const start = host.querySelector("button")!;
  const toggle = host.querySelector("input")!;
  start.click();
  expect(toggle.disabled).toBe(false);
  toggle.click();
  expect(toggle.checked).toBe(false);
  vi.advanceTimersByTime(6000);
  expect(host.textContent).toContain("target 42%");
  start.click();
  vi.advanceTimersByTime(6000);
  expect(host.textContent).toContain("target 36%");
  expect(vi.getTimerCount()).toBe(1);
  toggle.click();
  start.click();
  vi.advanceTimersByTime(6000);
  expect(host.textContent).toContain("target 42%");
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
