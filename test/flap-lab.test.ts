// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { flapLab } from "../src/minigames/flap-lab";
import * as rules from "../src/minigames/flap-lab/game";
import {
  DEFAULT_SETTINGS, FIXED_STEP, WORLD, circleTouchesRect, collides, configuration, flap, pause,
  pipeRects, ready, reset, resume, settingsKey, start, step, type GameState, type Settings,
} from "../src/minigames/flap-lab/game";

const combinations: Settings[] = Array.from({ length: 8 }, (_, bits) => ({
  faster: !!(bits & 4), narrower: !!(bits & 2), frequent: !!(bits & 1),
}));
afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });

// Isolate pipe clocks from flight skill, advancing the real simulation one step at a time.
function pipeClock(settings: Settings, seconds: number): GameState {
  let state = start(settings);
  for (let i = 0; i < Math.round(seconds / FIXED_STEP); i++) {
    const nextPipe = state.pipes.find((pipe) => pipe.x + WORLD.pipeWidth / 2 >= WORLD.birdX - WORLD.radius);
    state = step({ ...state, birdY: nextPipe?.center ?? WORLD.birdY, velocity: 0 });
  }
  expect(state.phase).toBe("running");
  return state;
}

function layout(settings: Settings): number[] {
  let state = start(settings);
  const centers = [state.lastCenter];
  for (let i = 0; i < 40; i++) {
    state = step({ ...state, pipes: [], birdY: WORLD.birdY, velocity: 0, elapsed: state.nextSpawn - FIXED_STEP });
    centers.push(state.lastCenter);
  }
  return centers;
}

describe("Bouncy Ball rules", () => {
  it.each(combinations)("resolves independent, fixed settings: %j", (settings) => {
    const config = configuration(settings);
    expect(config).toEqual({ speed: settings.faster ? 180 : 130, gap: settings.narrower ? 120 : 160, interval: settings.frequent ? 1.45 : 1.9 });
    for (const [key, field] of [["faster", "speed"], ["narrower", "gap"], ["frequent", "interval"]] as const) {
      const changed = configuration({ ...settings, [key]: !settings[key] });
      expect(Object.keys(config).filter((name) => config[name as keyof typeof config] !== changed[name as keyof typeof config])).toEqual([field]);
    }
    const state = step({ ...start(settings), score: 25, elapsed: 40, nextSpawn: 42 });
    expect(state.config).toEqual(config);
    const mutable = { ...settings };
    const copied = start(mutable);
    mutable.faster = !mutable.faster;
    expect(copied.settings).toEqual(settings);
  });

  it("has eight distinct best-score keys", () => {
    expect(new Set(combinations.map(settingsKey)).size).toBe(8);
  });

  it("separates displacement, arrival cadence, and opening size", () => {
    for (const settings of combinations) {
      const state = pipeClock(settings, 1.5);
      expect(state.pipes[0].x).toBeCloseTo(WORLD.spawnX - configuration(settings).speed * 1.5, 8);
      expect(state.nextId).toBe(settings.frequent ? 2 : 1);
      if (settings.frequent) expect(state.pipes[1].x).toBeCloseTo(WORLD.spawnX - state.config.speed * 0.05, 8);
      expect(pipeClock(settings, 1.9).nextId).toBe(2);
    }
  });

  it("uses deterministic, bounded centers across all comparisons and retries", () => {
    const centers = layout(DEFAULT_SETTINGS);
    expect(centers[0]).toBe(230);
    expect(new Set(centers).size).toBeGreaterThan(10);
    for (const settings of combinations) expect(layout(settings)).toEqual(centers);
    expect(layout(DEFAULT_SETTINGS)).toEqual(centers);
    centers.forEach((center, i) => {
      expect(center).toBeGreaterThanOrEqual(140);
      expect(center).toBeLessThanOrEqual(320);
      if (i) expect(Math.abs(center - centers[i - 1])).toBeLessThanOrEqual(60);
    });
  });

  it("applies gravity and replaces, rather than adds to, vertical velocity on a flap", () => {
    const initial = start();
    const next = step(initial);
    expect(next.velocity).toBeCloseTo(-290 + 850 * FIXED_STEP);
    expect(next.birdY).toBeCloseTo(230 + next.velocity * FIXED_STEP);
    expect(initial.birdY).toBe(230);
    expect(flap(next).velocity).toBe(-290);
    expect(flap(flap(next)).velocity).toBe(-290);
    expect(flap(next).birdY).toBe(next.birdY);
    expect(step({ ...initial, velocity: 419 }).velocity).toBe(420);
    expect(flap(ready()).phase).toBe("running");
  });

  it("matches the visible rectangles, with concrete wide-safe / narrow-contact clearance", () => {
    const pipe = { id: 0, x: 90, center: 230, scored: false };
    const wide = { ...start(), birdY: 169, pipes: [pipe] };
    expect(pipeRects(pipe, 160)).toEqual([
      { x: 62, y: 0, width: 56, height: 150 },
      { x: 62, y: 310, width: 56, height: 150 },
    ]);
    expect(collides(wide)).toBe(false);
    expect(collides({ ...wide, config: configuration({ ...DEFAULT_SETTINGS, narrower: true }) })).toBe(true);
    expect(collides({ ...wide, birdY: 161 })).toBe(true); // upper edge touches at y=150
    expect(collides({ ...wide, birdY: 161.001 })).toBe(false);
    expect(collides({ ...wide, birdY: 299 })).toBe(true); // lower edge touches at y=310
  });

  it("uses a circle at corners instead of its bounding square", () => {
    const rect = { x: 100, y: 100, width: 56, height: 80 };
    expect(circleTouchesRect(90, 90, 11, rect)).toBe(false);
    expect(circleTouchesRect(100, 89, 11, rect)).toBe(true);
    expect(circleTouchesRect(89, 120, 11, rect)).toBe(true);
    expect(circleTouchesRect(88.999, 120, 11, rect)).toBe(false);
  });

  it("ends at ceiling and ground contact", () => {
    expect(collides({ ...start(), birdY: 11 })).toBe(true);
    expect(collides({ ...start(), birdY: 449 })).toBe(true);
    expect(step({ ...start(), birdY: 11.1 }).outcome).toBe("collision");
    expect(step({ ...start(), birdY: 448.9, velocity: 100 }).outcome).toBe("collision");
  });

  it("scores each fully cleared pair once and removes offscreen pipes", () => {
    let state: GameState = { ...start(), birdY: 230, velocity: 0, pipes: [{ id: 0, x: 52, center: 230, scored: false }] };
    state = step(state);
    expect(state.score).toBe(1);
    expect(state.pipes[0].scored).toBe(true);
    state = step(state);
    expect(state.score).toBe(1);
    expect(step({ ...state, pipes: [{ ...state.pipes[0], x: -28 }] }).pipes).toEqual([]);
  });

  it("resolves a collision before score/spawn and freezes ended attempts", () => {
    const initial: GameState = {
      ...start(), nextSpawn: FIXED_STEP, pipes: [
        { id: 0, x: 52, center: 230, scored: false },
        { id: 1, x: 90, center: 140, scored: false },
      ],
    };
    const ended = step(initial);
    expect(ended.outcome).toBe("collision");
    expect(ended.score).toBe(0);
    expect(ended.nextId).toBe(initial.nextId);
    expect(step(ended, 5)).toBe(ended);
    expect(flap(ended)).toBe(ended);
  });

  it("subdivides delayed physics without skipping a pipe", () => {
    const state = { ...start(), birdY: 350, velocity: 0, pipes: [{ id: 0, x: 140, center: 140, scored: false }] };
    expect(step(state, 0.8).outcome).toBe("collision");
    expect(step(state, 0.8).elapsed).toBeLessThan(0.2);
    let split = start();
    for (let i = 0; i < 24; i++) split = step(split);
    const batched = step(start(), 0.2);
    expect(batched.birdY).toBeCloseTo(split.birdY, 10);
    expect(batched.pipes[0].x).toBeCloseTo(split.pipes[0].x, 10);
  });

  it("pauses time and resumes unchanged; reset and retry preserve selected settings", () => {
    const settings = combinations[7];
    const running = step(start(settings), 0.2);
    const paused = pause(running);
    expect(step(paused, 30)).toBe(paused);
    expect(flap(paused)).toBe(paused);
    expect(resume(paused)).toEqual(running);
    const resetState = reset(paused);
    expect(resetState).toEqual(ready(settings));
    expect(start(resetState.settings, resetState.seed)).toEqual(start(settings));
    expect(reset(running, DEFAULT_SETTINGS).settings).toEqual(DEFAULT_SETTINGS);
  });

  it("completes at exactly 90 seconds of active play", () => {
    const state = step({ ...start(), elapsed: 90 - FIXED_STEP, nextSpawn: 92, pipes: [] });
    expect(state.phase).toBe("ended");
    expect(state.outcome).toBe("complete");
    expect(state.elapsed).toBe(90);
    expect(step(state, 30)).toBe(state);
  });

  it.each(combinations)("admits a full round with ordinary spaced flaps: %j", (settings) => {
    let state = start(settings);
    let lastFlap = 0;
    while (state.phase === "running") {
      const target = state.pipes.find((pipe) => pipe.x + WORLD.pipeWidth / 2 >= WORLD.birdX - WORLD.radius)?.center ?? WORLD.birdY;
      if (state.birdY > target + 24 && state.velocity > 0) {
        // Feasibility check, not a substitute for a person's playtest.
        expect(state.elapsed - lastFlap).toBeGreaterThan(0.3);
        lastFlap = state.elapsed;
        state = flap(state);
      }
      state = step(state);
    }
    expect(state.outcome).toBe("complete");
    expect(state.elapsed).toBe(90);
    expect(state.score).toBeGreaterThan(40);
  });
});

function setup() {
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  let time = 0;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => { frames.delete(id); });
  const el = document.createElement("div");
  document.body.append(el);
  const unmount = flapLab.mount(el);
  const q = <T extends Element = HTMLElement>(selector: string) => el.querySelector<T>(selector)!;
  const board = q<SVGSVGElement>("svg");
  function frame(ms = 1000 / 120) {
    time += ms;
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(time));
  }
  function advance(seconds: number) {
    for (let i = 0; i < Math.round(seconds * 120); i++) frame();
  }
  const click = (action: string) => q<HTMLButtonElement>(`[data-action="${action}"]`).click();
  const key = (target: Element, code = "Space", repeat = false) => target.dispatchEvent(new KeyboardEvent("keydown", {
    key: code === "Space" ? " " : code, code, repeat, bubbles: true, cancelable: true,
  }));
  const pointer = (button = 0, primary = true) => {
    const event = new MouseEvent("pointerdown", { button, bubbles: true, cancelable: true });
    Object.defineProperty(event, "isPrimary", { value: primary });
    board.dispatchEvent(event);
  };
  const birdY = () => Number(q("[data-bird]").getAttribute("cy"));
  const phase = () => q(".flap-lab").getAttribute("data-phase");
  return { el, q, board, click, key, pointer, birdY, phase, frames, frame, advance, unmount };
}

describe("Bouncy Ball input and lifecycle", () => {
  it("exposes labeled native controls, accessible scene, quiet timer, and reflection", () => {
    const ui = setup();
    const inputs = [...ui.el.querySelectorAll<HTMLInputElement>("input[data-mechanic]")];
    expect(inputs.map((input) => input.dataset.mechanic)).toEqual(["pipe-speed", "gap-size", "pipe-frequency"]);
    for (const input of inputs) { expect(input.labels?.length).toBe(1); expect(input.checked).toBe(false); }
    expect(ui.board.getAttribute("aria-describedby")).toBeTruthy();
    expect(ui.q("[data-status]").getAttribute("aria-live")).toBe("polite");
    expect(ui.q("[data-time]").closest("[aria-live]")?.getAttribute("aria-live")).toBe("off");
    expect(ui.q(".flap-lab-reflect").textContent).toContain("What did you feel");
    ui.unmount();
  });

  it("starts with one initial flap, ignores held keys, and leaves other controls' keys alone", () => {
    const startSpy = vi.spyOn(rules, "start");
    const flapSpy = vi.spyOn(rules, "flap");
    const ui = setup();
    const checkbox = ui.q<HTMLInputElement>("input");
    expect(ui.key(checkbox)).toBe(true); // native Space is not consumed
    expect(ui.phase()).toBe("ready");
    ui.board.focus();
    expect(ui.key(ui.board)).toBe(false);
    expect(startSpy).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(ui.board);
    ui.frame(); ui.advance(0.1);
    ui.key(ui.board, "Space", true);
    expect(flapSpy).not.toHaveBeenCalled();
    ui.key(ui.board, "ArrowUp");
    expect(flapSpy).toHaveBeenCalledTimes(1);
    const flapButton = ui.q<HTMLButtonElement>('[data-action="flap"]');
    ui.key(flapButton);
    expect(flapSpy).toHaveBeenCalledTimes(1);
    flapButton.click();
    expect(flapSpy).toHaveBeenCalledTimes(2);
    expect(ui.key(flapButton, "Enter", true)).toBe(false);
    ui.unmount();
  });

  it("uses only primary pointerdown, never the following click, for one physical flap", () => {
    const flapSpy = vi.spyOn(rules, "flap");
    const ui = setup();
    ui.pointer(2); ui.pointer(0, false);
    expect(ui.phase()).toBe("ready");
    ui.pointer();
    expect(ui.phase()).toBe("running");
    ui.frame(); ui.advance(0.1);
    ui.pointer();
    ui.board.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(flapSpy).toHaveBeenCalledTimes(1);
    ui.unmount();
  });

  it.each(combinations)("copies settings, locks them in play/pause, and preserves them on reset: %j", (settings) => {
    const ui = setup();
    const inputs = [...ui.el.querySelectorAll<HTMLInputElement>("input")];
    [settings.faster, settings.narrower, settings.frequent].forEach((on, i) => { if (on) inputs[i].click(); });
    ui.click("start");
    expect(inputs.every((input) => input.disabled)).toBe(true);
    const rect = ui.q<SVGRectElement>(".flap-lab-pipes rect");
    expect(Number(rect.getAttribute("height"))).toBe(230 - configuration(settings).gap / 2);
    ui.frame(); ui.advance(0.1);
    expect(Number(rect.getAttribute("x"))).toBeCloseTo(360 - configuration(settings).speed * 0.1, 6);
    ui.click("pause");
    expect(inputs.every((input) => input.disabled)).toBe(true);
    ui.click("reset");
    expect(ui.phase()).toBe("ready");
    expect(inputs.every((input) => !input.disabled)).toBe(true);
    expect(inputs.map((input) => input.checked)).toEqual([settings.faster, settings.narrower, settings.frequent]);
    expect(ui.frames.size).toBe(0);
    expect(ui.q("[data-score]").textContent).toBe("0");
    ui.unmount();
  });

  it("freezes all state on pause, resumes without a jump or flap, and handles long frames", () => {
    const ui = setup();
    ui.click("start"); ui.frame(); ui.advance(0.2);
    ui.key(ui.board, "Escape");
    const y = ui.birdY();
    const time = ui.q("[data-time]").textContent;
    ui.frame(10000);
    expect(ui.birdY()).toBe(y);
    expect(ui.q("[data-time]").textContent).toBe(time);
    ui.click("pause");
    ui.frame(10000);
    expect(ui.birdY()).toBe(y);
    ui.frame();
    const expected = step(step(start(), 0.2));
    expect(ui.birdY()).toBeCloseTo(expected.birdY, 6);
    const beforeGap = ui.birdY();
    ui.frame(1000);
    expect(ui.phase()).toBe("paused");
    expect(ui.birdY()).toBe(beforeGap);
    expect(ui.frames.size).toBe(0);
    ui.unmount();
  });

  it("flaps when clicking the button blurs the board without focusing the button", () => {
    const ui = setup();
    ui.click("start"); ui.frame(); ui.advance(0.2);
    // Safari can leave relatedTarget null instead of focusing the clicked button.
    ui.board.blur();
    expect(document.activeElement).toBe(document.body);
    ui.click("flap");
    expect(ui.phase()).toBe("running");
    ui.frame();
    expect(ui.birdY()).toBeCloseTo(step(flap(step(start(), 0.2))).birdY, 6);
    expect(ui.frames.size).toBe(1);
    ui.unmount();
  });

  it("pauses once and resumes when clicking Pause blurs the board without focusing the button", () => {
    const ui = setup();
    ui.click("start"); ui.frame(); ui.advance(0.2);
    const y = ui.birdY();
    const time = ui.q("[data-time]").textContent;
    ui.board.blur();
    expect(document.activeElement).toBe(document.body);
    ui.click("pause");
    expect(ui.phase()).toBe("paused");
    expect(ui.q('[data-action="pause"]').textContent).toBe("Resume");
    expect(ui.frames.size).toBe(0);
    ui.frame(1000);
    expect(ui.birdY()).toBe(y);
    expect(ui.q("[data-time]").textContent).toBe(time);
    ui.click("pause");
    expect(ui.phase()).toBe("running");
    expect(document.activeElement).toBe(ui.board);
    ui.frame();
    expect(ui.birdY()).toBe(y);
    ui.frame();
    expect(ui.birdY()).toBeCloseTo(step(step(start(), 0.2)).birdY, 6);
    ui.unmount();
  });

  it("keeps running when focus moves between controls or elsewhere on the page", () => {
    const ui = setup();
    ui.click("start"); ui.frame();
    ui.q<HTMLButtonElement>('[data-action="flap"]').focus();
    expect(ui.phase()).toBe("running");
    const outside = document.createElement("button");
    document.body.append(outside); outside.focus();
    expect(ui.phase()).toBe("running");
    expect(ui.frames.size).toBe(1);
    ui.unmount();
  });

  it("pauses on hidden tabs and window blur, requiring explicit resume", () => {
    const ui = setup();
    ui.click("start"); ui.frame();
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(ui.phase()).toBe("paused");
    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(ui.phase()).toBe("paused");
    ui.click("pause");
    window.dispatchEvent(new Event("blur"));
    expect(ui.phase()).toBe("paused");
    window.dispatchEvent(new Event("focus"));
    expect(ui.phase()).toBe("paused");
    ui.click("pause");
    expect(ui.phase()).toBe("running");
    ui.unmount();
  });

  it("requires deliberate Retry after failure and resets score and initial layout", () => {
    const ui = setup();
    ui.click("start"); ui.frame(); ui.advance(2);
    expect(ui.phase()).toBe("ended");
    expect(ui.q("[data-status]").textContent).toMatch(/Game over.*Score: 0.*Survival time/);
    const y = ui.birdY();
    ui.pointer(); ui.key(ui.board); ui.click("flap");
    expect(ui.phase()).toBe("ended");
    expect(ui.birdY()).toBe(y);
    ui.q<HTMLInputElement>("input").click();
    ui.click("start");
    expect(ui.phase()).toBe("running");
    expect(ui.birdY()).toBe(230);
    expect(ui.q("[data-score]").textContent).toBe("0");
    expect(ui.q("[data-time]").textContent).toBe("90.0");
    expect(ui.el.querySelectorAll(".flap-lab-pipes rect").length).toBe(2);
    ui.unmount();
  });

  it("keeps bests separate and retains them across visits", () => {
    const ui = setup();
    ui.click("start"); ui.frame();
    for (let i = 0; i < 360; i++) {
      if (ui.birdY() > 240) ui.click("flap");
      ui.frame();
    }
    expect(Number(ui.q("[data-score]").textContent)).toBeGreaterThan(0);
    ui.advance(2);
    expect(ui.phase()).toBe("ended");
    const best = ui.q("[data-best]").textContent;
    expect(Number(best)).toBeGreaterThan(0);
    ui.q<HTMLInputElement>("input").click();
    expect(ui.q("[data-best]").textContent).toBe("0");
    ui.q<HTMLInputElement>("input").click();
    expect(ui.q("[data-best]").textContent).toBe(best);
    ui.unmount();
    const again = setup();
    expect(again.q("[data-best]").textContent).toBe(best);
    again.unmount();
  });

  it("removes the loop and every global listener on repeated mount/unmount", () => {
    const addDocument = vi.spyOn(document, "addEventListener");
    const removeDocument = vi.spyOn(document, "removeEventListener");
    const addWindow = vi.spyOn(window, "addEventListener");
    const removeWindow = vi.spyOn(window, "removeEventListener");
    for (let i = 0; i < 3; i++) {
      const ui = setup();
      ui.click("start"); ui.frame(); ui.advance(0.1);
      expect(ui.frames.size).toBe(1);
      const pending = [...ui.frames.values()][0];
      const detachedBoard = ui.board;
      ui.unmount();
      expect(ui.frames.size).toBe(0);
      expect(ui.el.childNodes.length).toBe(0);
      detachedBoard.dispatchEvent(new MouseEvent("pointerdown", { button: 0 }));
      pending(1000);
      expect(ui.frames.size).toBe(0);
    }
    for (const [event, callback] of addDocument.mock.calls.filter(([event]) => event === "visibilitychange")) {
      expect(removeDocument).toHaveBeenCalledWith(event, callback);
    }
    for (const [event, callback] of addWindow.mock.calls.filter(([event]) => event === "blur")) {
      expect(removeWindow).toHaveBeenCalledWith(event, callback);
    }
  });
});
