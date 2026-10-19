// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { calmGarden } from "../src/minigames/calm-garden";
import {
  COLUMNS, FLOWER_TYPES, LIMIT_MS, PLOT_COUNT, adjacentPlots, advanceGarden,
  createGarden, remainingMs, selectFlower, startGarden, tendPlot, waterTargets,
  type FlowerType, type GardenState,
} from "../src/minigames/calm-garden/game";

function plantedGarden(timed = false): GardenState {
  let state = startGarden(createGarden(timed), 0);
  for (let plot = 0; plot < PLOT_COUNT; plot++) state = tendPlot(state, plot, 0);
  return state;
}

function completedGarden(timed = false): GardenState {
  let state = plantedGarden(timed);
  for (const plot of [1, 3, 5, 10]) state = tendPlot(state, plot, 1000);
  return state;
}

describe("Calm Garden 2 rules", () => {
  it("starts with twelve empty plots, a default Daisy, three columns, and a 35-second deadline", () => {
    const state = createGarden();
    expect(PLOT_COUNT).toBe(12);
    expect(COLUMNS).toBe(3);
    expect(LIMIT_MS).toBe(35000);
    expect(FLOWER_TYPES).toEqual(["daisy", "poppy", "bellflower"]);
    expect(state.plots).toEqual(Array.from({ length: 12 }, () => ({ stage: "empty", flower: null })));
    expect(state.selectedFlower).toBe("daisy");
    expect(state.status).toBe("ready");
    expect(state.lastAction).toBeNull();
    expect(remainingMs(state, 100000)).toBeNull();
  });

  it("waits for Start before accepting work or consuming time", () => {
    const ready = createGarden(true);
    expect(tendPlot(ready, 0, 10000)).toBe(ready);
    expect(advanceGarden(ready, 100000)).toBe(ready);
    expect(remainingMs(ready, 100000)).toBe(35000);
    const playing = startGarden(ready, 10000);
    expect(playing.deadline).toBe(45000);
    expect(startGarden(playing, 20000)).toBe(playing);
  });

  it.each(["daisy", "poppy", "bellflower"] as const)("plants and waters %s immediately without advancing the clock", flower => {
    const ready = selectFlower(createGarden(), flower);
    let state = tendPlot(startGarden(ready, 0), 4, 0);
    expect(state.plots[4]).toEqual({ stage: "planted", flower });
    expect(state.lastAction).toEqual({ kind: "plant", plots: [4] });
    state = tendPlot(state, 4, 0);
    expect(state.plots[4]).toEqual({ stage: "bloomed", flower });
    expect(state.lastAction).toEqual({ kind: "water", plots: [4] });
  });

  it("stores planted flowers independently of subsequent selections", () => {
    const first = tendPlot(startGarden(createGarden(), 0), 0, 0);
    const second = tendPlot(selectFlower(first, "poppy"), 1, 0);
    expect(first.selectedFlower).toBe("daisy");
    expect(first.plots[1].stage).toBe("empty");
    expect(second.plots[0].flower).toBe("daisy");
    expect(second.plots[1].flower).toBe("poppy");
    expect(tendPlot(second, 0, 0).plots[0].flower).toBe("daisy");
  });

  it("ignores unknown flower selections", () => {
    const state = createGarden();
    expect(selectFlower(state, "unknown" as FlowerType)).toBe(state);
  });

  it.each([
    [0, [1, 3]], [1, [0, 2, 4]], [2, [1, 5]],
    [3, [0, 4, 6]], [4, [1, 3, 5, 7]], [5, [2, 4, 8]],
    [6, [3, 7, 9]], [7, [4, 6, 8, 10]], [8, [5, 7, 11]],
    [9, [6, 10]], [10, [7, 9, 11]], [11, [8, 10]],
  ] as const)("finds the orthogonal neighbors of plot %s", (plot, expected) => {
    expect(adjacentPlots(plot).sort((a, b) => a - b)).toEqual(expected);
  });

  it.each([
    [0, [0, 1, 3]], [1, [0, 1, 2, 4]], [4, [1, 3, 4, 5, 7]], [11, [8, 10, 11]],
  ] as const)("blooms only one ripple around corner, edge, or interior plot %s", (plot, expected) => {
    const state = plantedGarden();
    expect(waterTargets(state, plot).sort((a, b) => a - b)).toEqual(expected);
    const watered = tendPlot(state, plot, 0);
    expect(watered.plots.flatMap((p, index) => p.stage === "bloomed" ? [index] : [])).toEqual(expected);
    expect(state.plots.every(p => p.stage === "planted")).toBe(true);
  });

  it("never propagates diagonally, wraps rows, or recurses through newly bloomed neighbors", () => {
    const state = plantedGarden();
    const center = tendPlot(state, 4, 0);
    for (const plot of [0, 2, 6, 8, 9, 10, 11]) expect(center.plots[plot].stage).toBe("planted");
    const edge = tendPlot(state, 2, 0);
    expect(edge.plots[3].stage).toBe("planted");
    expect(edge.plots[8].stage).toBe("planted");
  });

  it("ignores empty and bloomed neighbors and preserves the flowers' appearances", () => {
    let state = startGarden(createGarden(), 0);
    state = tendPlot(tendPlot(state, 1, 0), 1, 0);
    state = tendPlot(state, 4, 0);
    state = tendPlot(selectFlower(state, "poppy"), 5, 0);
    state = tendPlot(selectFlower(state, "bellflower"), 7, 0);
    expect(waterTargets(state, 4).sort()).toEqual([4, 5, 7]);
    const watered = tendPlot(state, 4, 0);
    expect(watered.plots[3]).toEqual({ stage: "empty", flower: null });
    expect(watered.plots[1]).toEqual({ stage: "bloomed", flower: "daisy" });
    expect(watered.plots[5]).toEqual({ stage: "bloomed", flower: "poppy" });
    expect(watered.plots[7]).toEqual({ stage: "bloomed", flower: "bellflower" });
    expect(tendPlot(watered, 4, 0)).toBe(watered);
    expect(waterTargets(watered, 4)).toEqual([]);
    expect(waterTargets(watered, 3)).toEqual([]);
  });

  it.each([-1, 12, 0.5, NaN])("ignores invalid plot index %s", plot => {
    const state = startGarden(createGarden(), 0);
    expect(tendPlot(state, plot, 0)).toBe(state);
    expect(adjacentPlots(plot)).toEqual([]);
    expect(waterTargets(state, plot)).toEqual([]);
  });

  it("has identical progression in both modes before the deadline", () => {
    let relaxed = plantedGarden(false);
    let timed = plantedGarden(true);
    for (let plot = 0; plot < 12; plot++) {
      relaxed = tendPlot(relaxed, plot, 1000);
      timed = tendPlot(timed, plot, 1000);
      expect(timed.plots).toEqual(relaxed.plots);
      expect(timed.status).toBe(relaxed.status);
      expect(timed.lastAction).toEqual(relaxed.lastAction);
    }
  });

  it("never expires relaxed play, even after a long pause", () => {
    const state = startGarden(createGarden(), 0);
    expect(advanceGarden(state, 999999999)).toBe(state);
    expect(tendPlot(state, 2, 999999999).plots[2].stage).toBe("planted");
  });

  it("accepts planting and watering just before the deadline", () => {
    let state = startGarden(createGarden(true), 0);
    state = tendPlot(state, 0, LIMIT_MS - 1);
    state = tendPlot(state, 0, LIMIT_MS - 1);
    expect(state.plots[0].stage).toBe("bloomed");
    expect(state.status).toBe("playing");
  });

  it.each([35000, 35001, 45000])("rejects actions at or after expiry (%s), even before a scheduled tick", now => {
    const state = tendPlot(startGarden(createGarden(true), 0), 0, 0);
    const expired = tendPlot(state, 0, now);
    expect(expired.status).toBe("timeout");
    expect(expired.plots[0].stage).toBe("planted");
    expect(expired.endedAt).toBe(35000);
    expect(remainingMs(expired, 999999)).toBe(0);
    expect(tendPlot(expired, 1, now)).toBe(expired);
    expect(selectFlower(expired, "poppy")).toBe(expired);
  });

  it.each([false, true])("completes on the last ripple and freezes the outcome (timed: %s)", timed => {
    const state = completedGarden(timed);
    expect(state.status).toBe("complete");
    expect(state.plots.every(plot => plot.stage === "bloomed")).toBe(true);
    expect(state.endedAt).toBe(1000);
    expect(state.lastAction?.plots.length).toBeGreaterThan(1);
    expect(advanceGarden(state, 999999)).toBe(state);
    expect(tendPlot(state, 0, 999999)).toBe(state);
    expect(selectFlower(state, "poppy")).toBe(state);
    expect(remainingMs(state, 999999)).toBe(timed ? 34000 : null);
  });

  it("creates independent states without mutating previous gardens", () => {
    const ready = createGarden(true);
    const playing = startGarden(ready, 0);
    const planted = tendPlot(playing, 0, 0);
    expect(ready.status).toBe("ready");
    expect(playing.plots[0].stage).toBe("empty");
    expect(planted.plots[0].stage).toBe("planted");
    expect(createGarden(true)).toEqual(ready);
  });
});

const disposers: Array<() => void> = [];
function mountGarden(timed = false) {
  const host = document.createElement("div");
  document.body.append(host);
  const unmount = calmGarden.mount(host);
  disposers.push(() => { unmount(); host.remove(); });
  const q = <T extends HTMLElement = HTMLElement>(selector: string) => host.querySelector<T>(selector)!;
  const toggle = q<HTMLInputElement>("[data-mechanic='time-limit']");
  if (timed) toggle.click();
  return {
    host, q, toggle, unmount,
    start: () => q<HTMLButtonElement>("[data-start]").click(),
    restart: () => q<HTMLButtonElement>("[data-restart]").click(),
    plot: (index: number) => q<HTMLButtonElement>(`[data-plot='${index}'] button`),
    flower: (flower: FlowerType) => q<HTMLInputElement>(`input[type='radio'][value='${flower}']`),
  };
}
function finishUI(game: ReturnType<typeof mountGarden>) {
  for (let plot = 0; plot < 12; plot++) game.plot(plot).click();
  for (const plot of [1, 3, 5, 10]) game.plot(plot).click();
}

describe("Calm Garden 2 interface", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    vi.spyOn(performance, "now").mockImplementation(() => Date.now());
  });
  afterEach(() => {
    disposers.splice(0).forEach(dispose => dispose());
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("mounts twelve empty plots, native flower choices, and a time-limit checkbox", () => {
    const game = mountGarden();
    expect(calmGarden.slug).toBe("calm-garden");
    expect(calmGarden.author).toBe("RuaJ77");
    expect(calmGarden.motivators).toEqual(["submission"]);
    expect(game.host.querySelectorAll("[data-plot][data-stage='empty']")).toHaveLength(12);
    expect(game.host.querySelectorAll("input[type='radio']")).toHaveLength(3);
    expect(game.flower("daisy").checked).toBe(true);
    expect(game.flower("poppy").closest("label")?.textContent).toContain("Poppy");
    expect(game.toggle.type).toBe("checkbox");
    expect(game.toggle.closest("label")?.textContent).toContain("35 seconds");
    expect(game.q("[data-countdown]").hidden).toBe(true);
    expect(game.q("[data-reflection]").hidden).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("allows choosing a flower before Start but ignores plot input until then", () => {
    const game = mountGarden();
    game.flower("poppy").click();
    game.plot(0).click();
    expect(game.q("[data-plot='0']").dataset.stage).toBe("empty");
    game.start();
    expect(game.plot(0).getAttribute("aria-label")).toContain("Plant Poppy");
    game.plot(0).click();
    expect(game.q("[data-plot='0']").dataset.flower).toBe("poppy");
    game.flower("bellflower").click();
    game.plot(1).click();
    expect(game.q("[data-plot='1']").dataset.flower).toBe("bellflower");
    expect(game.q("[data-plot='0']").dataset.flower).toBe("poppy");
    expect(game.q("[data-planted]").textContent).toContain("2 of 12");
  });

  it("accepts successive actions instantly during visual feedback", () => {
    const game = mountGarden();
    game.start();
    game.plot(0).click();
    game.plot(1).click();
    expect(game.plot(0).getAttribute("aria-disabled")).toBe("false");
    game.plot(0).click();
    expect(game.q("[data-plot='0']").dataset.stage).toBe("bloomed");
    expect(game.q("[data-plot='1']").dataset.stage).toBe("bloomed");
    expect(game.q("[data-completed]").textContent).toContain("2 of 12");
    expect(game.q("[data-status]").textContent).toContain("2 flowers bloomed together");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("previews exactly the planted ripple targets on focus and preserves keyboard focus", () => {
    const game = mountGarden();
    game.start();
    for (const plot of [0, 1, 4, 5]) game.plot(plot).click();
    game.plot(1).focus();
    expect(game.plot(1).tagName).toBe("BUTTON");
    expect(game.plot(1).type).toBe("button");
    expect(game.plot(1).getAttribute("aria-label")).toContain("Water 3 flowers");
    const targets = Array.from(game.host.querySelectorAll<HTMLElement>("[data-preview='true']"), el => Number(el.dataset.plot));
    expect(targets).toEqual([0, 1, 4]);
    game.plot(1).click();
    expect(document.activeElement).toBe(game.plot(1));
    expect(game.q("[data-plot='5']").dataset.stage).toBe("planted");
    expect(game.plot(1).getAttribute("aria-disabled")).toBe("true");
    expect(game.host.querySelectorAll("[data-preview='true']")).toHaveLength(0);
  });

  it("uses visibly distinct original SVG geometry for each flower", () => {
    const game = mountGarden();
    game.start();
    for (const [plot, flower] of FLOWER_TYPES.entries()) {
      game.flower(flower).click();
      game.plot(plot).click();
      game.plot(plot).click();
    }
    const shapes = FLOWER_TYPES.map((_, plot) => game.q(`[data-plot='${plot}'] svg`).innerHTML);
    expect(new Set(shapes).size).toBe(3);
    expect(game.host.querySelector("img, audio, video, iframe")).toBeNull();
  });

  it("makes the ripple preview follow the latest pointer or keyboard interaction", () => {
    const game = mountGarden();
    game.start();
    for (let plot = 0; plot < 12; plot++) game.plot(plot).click();
    const previewed = () => Array.from(game.host.querySelectorAll<HTMLElement>("[data-preview='true']"), el => Number(el.dataset.plot));
    game.plot(0).dispatchEvent(new Event("pointerenter"));
    expect(previewed()).toEqual([0, 1, 3]);
    game.plot(1).focus();
    expect(previewed()).toEqual([0, 1, 2, 4]);
    game.plot(4).dispatchEvent(new Event("pointerenter"));
    expect(previewed()).toEqual([1, 3, 4, 5, 7]);
    game.plot(4).dispatchEvent(new Event("pointerleave"));
    expect(previewed()).toEqual([0, 1, 2, 4]);
    game.plot(1).click();
    expect(game.q("[data-plot='2']").dataset.stage).toBe("bloomed");
    expect(game.q("[data-plot='3']").dataset.stage).toBe("planted");
  });

  it("shows the selected countdown without consuming it before Start", () => {
    const game = mountGarden(true);
    expect(game.q("[data-countdown]").textContent).toContain("0:35");
    vi.advanceTimersByTime(100000);
    expect(game.q("[data-countdown]").textContent).toContain("0:35");
    game.start();
    vi.advanceTimersByTime(5000);
    expect(game.q("[data-countdown]").textContent).toContain("0:30");
  });

  it("locks only the time-limit toggle during play and restores forced changes", () => {
    const game = mountGarden(true);
    game.start();
    expect(game.toggle.disabled).toBe(true);
    expect(game.flower("poppy").disabled).toBe(false);
    game.toggle.checked = false;
    game.toggle.dispatchEvent(new Event("change"));
    expect(game.toggle.checked).toBe(true);
    vi.advanceTimersByTime(LIMIT_MS);
    expect(game.q("[data-status]").textContent).toContain("Time’s up");
  });

  it("checks the actual deadline on input before a delayed timer callback", () => {
    const game = mountGarden(true);
    game.start();
    game.plot(0).click();
    vi.setSystemTime(LIMIT_MS);
    game.plot(0).click();
    expect(game.q("[data-plot='0']").dataset.stage).toBe("planted");
    expect(game.q("[data-status]").textContent).toContain("Time’s up");
    expect(game.q("[data-countdown]").textContent).toContain("0:00");
    expect(game.q("[data-reflection]").hidden).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("lets relaxed play remain idle indefinitely without scheduling timers", () => {
    const game = mountGarden();
    game.start();
    vi.advanceTimersByTime(3600000);
    game.plot(0).click();
    game.plot(0).click();
    expect(game.q("[data-plot='0']").dataset.stage).toBe("bloomed");
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([false, true])("completes and offers reflection with the same actions (timed: %s)", timed => {
    const game = mountGarden(timed);
    game.start();
    finishUI(game);
    expect(game.q(".calm-garden").dataset.state).toBe("complete");
    expect(game.q("[data-completed]").textContent).toContain("12 of 12");
    expect(game.q("[data-reflection]").hidden).toBe(false);
    expect(game.q("[data-reflection]").textContent).toContain("What did you feel");
    expect(game.q("[data-reflection]").textContent).toContain("countdown");
    expect(game.q("[data-reflection]").querySelector("input, textarea")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    game.plot(0).click();
    game.start();
    expect(game.q(".calm-garden").dataset.state).toBe("complete");
  });

  it.each(["playing", "complete", "timeout"])("restart resets a %s garden and permits choosing either mode", phase => {
    const game = mountGarden(true);
    game.flower("poppy").click();
    game.start();
    if (phase === "complete") finishUI(game);
    else {
      game.plot(0).click();
      if (phase === "timeout") vi.advanceTimersByTime(LIMIT_MS);
    }
    game.restart();
    expect(game.q(".calm-garden").dataset.state).toBe("ready");
    expect(game.host.querySelectorAll("[data-stage='empty']")).toHaveLength(12);
    expect(game.flower("daisy").checked).toBe(true);
    expect(game.toggle.checked).toBe(true);
    expect(game.toggle.disabled).toBe(false);
    expect(game.q("[data-countdown]").textContent).toContain("0:35");
    expect(game.q("[data-reflection]").hidden).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(100000);
    expect(game.q(".calm-garden").dataset.state).toBe("ready");
    game.toggle.click();
    game.start();
    expect(game.q("[data-countdown]").hidden).toBe(true);
  });

  it("unmount clears timers and removes listeners from retained controls", () => {
    const game = mountGarden(true);
    const start = game.q<HTMLButtonElement>("[data-start]");
    const restart = game.q<HTMLButtonElement>("[data-restart]");
    const flower = game.flower("poppy");
    const plot = game.plot(0);
    game.start();
    plot.click();
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    game.unmount();
    expect(game.host.childNodes).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
    restart.click();
    start.click();
    flower.dispatchEvent(new Event("change"));
    plot.dispatchEvent(new Event("pointerenter"));
    plot.focus();
    plot.click();
    vi.advanceTimersByTime(100000);
    expect(game.host.childNodes).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
    game.unmount();
  });

  it("keeps state and native radio groups independent across mounts", () => {
    const first = mountGarden();
    const second = mountGarden(true);
    first.flower("poppy").click();
    expect(second.flower("daisy").checked).toBe(true);
    expect(first.flower("poppy").name).not.toBe(second.flower("poppy").name);
    first.start();
    second.start();
    first.plot(0).click();
    expect(second.q("[data-plot='0']").dataset.stage).toBe("empty");
    first.unmount();
    vi.advanceTimersByTime(LIMIT_MS);
    expect(second.q(".calm-garden").dataset.state).toBe("timeout");
  });
});

describe("Calm Garden documentation", () => {
  it("quotes the note accurately and records the actual v1 feedback without inventing v2 results", () => {
    const note = readFileSync("content/player-motivations.md", "utf8");
    const readme = readFileSync("src/minigames/calm-garden/README.md", "utf8");
    const quote = 'Rhythmic repetition, "the meditative patterns of Tetris" (Salen and Zimmerman 2003, ch. 24, "Patterns of Pleasure").';
    expect(note).toContain(quote);
    expect(readme).toContain(quote);
    for (const section of ["Mechanic", "Dynamic", "Aesthetic", "Sources"]) expect(readme).toContain(`## ${section}`);
    expect(readme).toContain("35-second");
    expect(readme).toContain("hypotheses");
    expect(readme).toContain("repetitive and boring");
    expect(readme).toContain("another player");
  });
});
