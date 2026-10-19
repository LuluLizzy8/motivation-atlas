// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { BUILDINGS, DEFAULT_OPTIONS, FARM, PLOTS, WIDTH, build, canBuild, interact, newGame, step, tick, type HarvestState } from "../src/minigames/buildavillage/game";
import { buildAVillage } from "../src/minigames/buildavillage";

afterEach(() => { vi.useRealTimers(); document.body.replaceChildren(); });

function walk(s: HarvestState, target: number): HarvestState {
  while (s.player % WIDTH !== target % WIDTH) s = step(s, Math.sign(target % WIDTH - s.player % WIDTH), 0);
  while (Math.floor(s.player / WIDTH) !== Math.floor(target / WIDTH)) s = step(s, 0, Math.sign(Math.floor(target / WIDTH) - Math.floor(s.player / WIDTH)));
  return s;
}

/** Walk onto a patch, then explicitly gather. Resources never block walking. */
function harvest(s: HarvestState, kind: string): HarvestState {
  const target = [...FARM].findIndex((tile, i) => tile === kind && s.patches[i] > 0);
  if (target < 0) return s;
  return interact(walk(s, target), target);
}

function play(keep: boolean): HarvestState {
  let s = newGame({ ...DEFAULT_OPTIONS, keep });
  for (let second = 0; second < 130; second++) {
    s = tick(s, second);
    const objective = s.structures.findIndex((built) => !built);
    const next = BUILDINGS[objective];
    if (next && s.phase === "day" && !s.over) {
      const wood = s.wood < next.wood;
      const stone = s.stone < next.stone;
      const before = s.gathered;
      if (wood) s = harvest(s, "T");
      if (s.gathered === before && stone) s = harvest(s, "R");
      if (s.wood >= next.wood && s.stone >= next.stone) s = interact(walk(s, PLOTS[objective]), PLOTS[objective]);
    }
  }
  return tick(s, 130);
}

describe("Build a Village! rules", () => {
  it.each([true, false])("sustenance keeps gains at night only when enabled (%s)", (keep) => {
    const s: HarvestState = {
      ...newGame({ ...DEFAULT_OPTIONS, keep }), wood: 4, stone: 1, built: 2, bestBuilt: 2, structures: [true, true, false, false],
    };
    const before = structuredClone(s);
    const next = tick(s, 20);
    expect([next.wood, next.stone, next.built]).toEqual(keep ? [4, 1, 2] : [0, 0, 0]);
    expect(next.bestBuilt).toBe(2);
    expect(next.structures).toEqual(keep ? [true, true, false, false] : [false, false, false, false]);
    expect(next.day).toBe(1);
    expect(next.phase).toBe("night");
    expect(tick(next, 26).day).toBe(2);
    expect(s).toEqual(before);
  });

  it("walks freely, rejects distant tiles, and never wraps around map edges", () => {
    const s = newGame();
    expect(step(s, -1, 0).player).toBe(23);
    expect(step(s, -1, 0).elapsed).toBe(0);
    expect(step(s, -1, 0).gathered).toBe(0);
    expect(interact(s, 0)).toBe(s);
    expect(interact(s, -1)).toBe(s);
    const edge = { ...s, player: 21 };
    expect(step(edge, -1, 0)).toBe(edge);
    expect(step(s, 1, 1)).toBe(s);
    expect(s.player).toBe(24);
  });

  it("walks onto patches without harvesting, then gathers repeatedly with no cooldown", () => {
    let s = { ...newGame(), player: 16 }; // Adjacent to the tree at 15.
    const start = s;
    expect(interact(s, 15)).toBe(s);
    s = step(s, -1, 0);
    expect([s.player, s.wood, s.patches[15]]).toEqual([15, 0, 3]);
    s = interact(s, 15);
    expect([s.wood, s.gathered, s.patches[15]]).toEqual([1, 1, 2]);
    s = interact(s, 15);
    s = interact(s, 15);
    expect([s.wood, s.patches[15]]).toEqual([3, 0]);
    expect(s.elapsed).toBe(0);
    expect(interact(s, 15)).toBe(s);
    expect(interact(s, 15).player).toBe(15);
    expect(start.patches[15]).toBe(3);
    expect(tick(s, 26).patches[15]).toBe(3);
    const stone = interact({ ...newGame(), player: 19 }, 19);
    expect([stone.wood, stone.stone]).toEqual([0, 1]);
  });

  it("builds only underfoot, in any order, and never pays twice for a plot", () => {
    const s = newGame();
    expect(build(s)).toBe(s);
    expect(build({ ...s, player: 0, wood: 3 }).lastEvent).toBe("cannot-build");
    const ready = { ...s, player: 0, wood: 3, stone: 1 };
    const tent = interact(ready, 0);
    expect([tent.built, tent.bestBuilt, tent.wood, tent.stone, tent.elapsed]).toEqual([1, 1, 0, 0, 0]);
    expect(ready.built).toBe(0);
    expect(build(tent)).toBe(tent);
    const short = build({ ...s, player: 2, wood: 5, stone: 1 });
    expect([short.built, short.wood, short.lastEvent]).toEqual([0, 5, "cannot-build"]);
    const hutFirst = interact({ ...s, player: 2, wood: 5, stone: 2 }, 2);
    expect(hutFirst.structures).toEqual([false, true, false, false]);
    expect([hutFirst.built, hutFirst.bestBuilt]).toEqual([1, 2]);
    expect(step({ ...s, player: 7 }, 0, -1).player).toBe(0);
  });

  it("keeps a depleted patch empty until it recovers all three resources at once", () => {
    let s = { ...newGame(), player: 15 };
    s = interact(s, 15);
    s = interact(s, 15);
    s = interact(s, 15);
    expect([s.patches[15], s.recoverAt[15]]).toEqual([0, 12]);
    expect(tick(s, 11).patches[15]).toBe(0);
    const recovering = tick(s, 12);
    expect([recovering.patches[15], recovering.recoverAt[15]]).toEqual([3, 0]);
    expect(s.patches[15]).toBe(0);
    expect(tick(recovering, 26).patches[15]).toBe(3); // Morning replenishes the farm.
  });

  it("can reach the Castle by walking and gathering with carryover", () => {
    const final = play(true);
    expect([final.over, final.built, final.bestBuilt, final.gathered]).toEqual([true, 4, 4, 47]);
  });

  it("remembers the best town when the final reset clears everything", () => {
    const final = play(false);
    expect([final.over, final.built, final.bestBuilt]).toEqual([true, 0, 2]);
    expect(BUILDINGS.reduce((n, b) => n + b.wood, 0)).toBe(26);
    expect(4 * (3 + 3)).toBeLessThan(26); // Four trees, one full recovery each per day.
  });

  it("handles delayed ticks and stops all play after the fifth night", () => {
    const s = { ...newGame({ ...DEFAULT_OPTIONS, keep: false }), wood: 4, built: 1, bestBuilt: 1 };
    const late = tick(s, 62.9);
    expect([late.elapsed, late.day, late.wood, late.built]).toEqual([62, 3, 0, 0]);
    expect(tick(late, 61)).toBe(late);
    const final = tick(late, 999);
    expect([final.elapsed, final.day, final.over, final.bestBuilt]).toEqual([130, 5, true, 1]);
    expect(interact(final, 23)).toBe(final);
    expect(build(final)).toBe(final);
    expect(tick(final, 200)).toBe(final);
  });

  it("copies options so external changes cannot alter an active round", () => {
    const options = { ...DEFAULT_OPTIONS };
    const s = newGame(options);
    options.keep = false;
    expect(s.options.keep).toBe(true);
    expect(() => newGame({ ...options, secondsPerDay: 0 })).toThrow(RangeError);
  });
});

describe("night and victory", () => {
  it("rests for six seconds at night, blocking play until morning", () => {
    const night = tick({ ...newGame(), player: 15, wood: 3 }, 20);
    expect(night.phase).toBe("night");
    expect(interact(night, 15)).toBe(night);
    expect(step(night, 1, 0)).toBe(night);
    expect(build(night)).toBe(night);
    expect(tick(night, 25).phase).toBe("night");
    const dawn = tick(night, 26);
    expect([dawn.phase, dawn.day, dawn.player]).toEqual(["day", 2, 15]);
  });

  it("requires all four plots, even if the Castle is built first", () => {
    const castleFirst = interact({ ...newGame(), player: 6, wood: 10, stone: 12 }, 6);
    expect([castleFirst.won, castleFirst.over, castleFirst.built]).toEqual([false, false, 1]);
    expect(castleFirst.structures).toEqual([false, false, false, true]);
    const ready = { ...newGame(), elapsed: 45, player: 0, built: 3, bestBuilt: 4, structures: [false, true, true, true], wood: 3, stone: 1 };
    const win = build(ready);
    expect([win.won, win.over, win.built, win.elapsed]).toEqual([true, true, 4, 45]);
    expect(tick(win, 999)).toBe(win);
    expect(step(win, -1, 0)).toBe(win);
    expect(interact(win, win.player)).toBe(win);
    expect(ready.over).toBe(false);
  });
});

describe("Build a Village! controls", () => {
  it("offers Confirm and Skip inside the map before starting the round clock", () => {
    vi.useFakeTimers();
    const host = document.createElement("div");
    document.body.append(host);
    const unmount = buildAVillage.mount(host);
    const button = (label: string) => [...host.querySelectorAll("button")].find((el) => el.textContent === label)!;
    button("Start round").click();
    vi.advanceTimersByTime(0); // Flush DOM focus work without advancing the game clock.
    const intro = host.querySelector<HTMLElement>('.harvest-map [role="dialog"]')!;
    expect(intro.hidden).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    expect(document.activeElement).toBe(button("Confirm"));
    button("Skip").click();
    vi.advanceTimersByTime(0);
    expect(intro.hidden).toBe(true);
    expect(host.querySelector<HTMLElement>("[data-tutorial]")!.hidden).toBe(true);
    expect(vi.getTimerCount()).toBe(1);
    button("New round").click();
    vi.advanceTimersByTime(0);
    expect(vi.getTimerCount()).toBe(0);
    button("Confirm").click();
    vi.advanceTimersByTime(0);
    expect(host.querySelector<HTMLElement>("[data-tutorial]")!.hidden).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(60_000);
    expect(host.querySelector(".harvest-day")!.textContent).toContain("Tutorial · clock paused");
    unmount();
  });

  it("guides gathering and building inside the map, then stays dismissed after night", () => {
    vi.useFakeTimers();
    const host = document.createElement("div");
    document.body.append(host);
    const unmount = buildAVillage.mount(host);
    const map = host.querySelector<HTMLElement>(".harvest-map")!;
    const tutorial = map.querySelector<HTMLElement>("[data-tutorial]")!;
    map.focus();
    expect(tutorial.textContent).toContain("Find a tree");
    host.querySelector<HTMLInputElement>("[data-mechanic]")!.checked = false;
    const press = (key: string) => map.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    press("a"); press("a"); press("w");
    expect(tutorial.textContent).toContain("Press E to gather");
    press("e"); press("e"); press("e");
    expect(tutorial.textContent).toContain("Find a rock");
    vi.advanceTimersByTime(90_000);
    expect(tutorial.hidden).toBe(false);
    expect(host.querySelector(".harvest-day")!.textContent).toContain("Tutorial · clock paused");
    expect(host.querySelector("[data-resources]")!.textContent).toContain("3 wood");
    press("d"); press("d"); press("d"); press("d");
    expect(tutorial.textContent).toContain("Press E to mine");
    press("e");
    expect(tutorial.textContent).toContain("ONTO the highlighted Tent plot");
    press("w"); press("w"); press("a"); press("a"); press("a"); press("a"); press("a");
    expect(tutorial.textContent).toContain("Press E to build!");
    press("e");
    expect(tutorial.hidden).toBe(true);
    expect(host.querySelector('[data-tile="0"]')!.getAttribute("aria-label")).toContain("Tent plot: built");
    expect(document.activeElement).toBe(map);
    expect(host.querySelector("[data-objective]")!.textContent).toContain("Next objective: Build Hut (5 wood, 2 stone)");
    const complete = map.querySelector<HTMLElement>(".harvest-tutorial-complete")!;
    expect(complete.hidden).toBe(false);
    expect(complete.textContent).toBe("Tutorial complete!");
    expect(host.querySelector(".harvest-day")!.textContent).toContain("20s until night");
    vi.advanceTimersByTime(4_000);
    expect(complete.hidden).toBe(true);
    vi.advanceTimersByTime(22_000);
    expect(tutorial.hidden).toBe(true);
    [...host.querySelectorAll("button")].find((el) => el.textContent === "New round")!.click();
    [...host.querySelectorAll("button")].find((el) => el.textContent === "Confirm")!.click();
    expect(tutorial.hidden).toBe(false);
    unmount();
  });

  it("shows an in-map insufficient-materials pop-up for the occupied plot", () => {
    vi.useFakeTimers();
    const host = document.createElement("div");
    document.body.append(host);
    const unmount = buildAVillage.mount(host);
    const map = host.querySelector<HTMLElement>(".harvest-map")!;
    const press = (key: string) => map.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    press("w"); press("w"); press("w"); press("a"); press("a"); press("a"); press("e");
    const popup = map.querySelector<HTMLElement>(".harvest-popup")!;
    expect(popup.hidden).toBe(false);
    expect(popup.textContent).toContain("Not enough materials for Tent!");
    press("d");
    expect(popup.hidden).toBe(true);
    press("d"); press("e");
    expect(popup.textContent).toContain("Not enough materials for Hut!");
    expect(host.querySelector("[data-resources]")!.textContent).toContain("0 wood");
    unmount();
  });

  it("dims in two-second stages, sleeps six seconds, then gradually brightens", () => {
    vi.useFakeTimers();
    const host = document.createElement("div");
    document.body.append(host);
    const unmount = buildAVillage.mount(host);
    [...host.querySelectorAll("button")].find((el) => el.textContent === "Start round")!.click();
    [...host.querySelectorAll("button")].find((el) => el.textContent === "Skip")!.click();
    const shade = host.querySelector<HTMLElement>(".harvest-night-shade")!;
    vi.advanceTimersByTime(14_000);
    expect(shade.style.opacity).toBe("0.18");
    expect(host.querySelector(".harvest-transition")!.textContent).toContain("Night is approaching");
    vi.advanceTimersByTime(2_000);
    expect(shade.style.opacity).toBe("0.36");
    vi.advanceTimersByTime(2_000);
    expect(Number(shade.style.opacity)).toBeCloseTo(0.54);
    vi.advanceTimersByTime(2_000);
    expect(shade.style.opacity).toBe("0.8");
    expect(host.querySelector(".harvest-player")!.getAttribute("aria-label")).toBe("Farmer sleeping");
    vi.advanceTimersByTime(6_000);
    expect(shade.style.opacity).toBe("0.45");
    expect(host.querySelector(".harvest-player")!.getAttribute("aria-label")).toBe("Farmer awake");
    vi.advanceTimersByTime(4_000);
    expect(shade.hidden).toBe(true);
    unmount();
  });

  it("starts an untimed tutorial on a direction press and accepts keyboard movement from a button", () => {
    vi.useFakeTimers();
    const host = document.createElement("div");
    document.body.append(host);
    const unmount = buildAVillage.mount(host);
    const down = host.querySelector<HTMLButtonElement>('[aria-label="Move down"]')!;
    down.click();
    vi.advanceTimersByTime(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(host.querySelector('.harvest-map')!.getAttribute('aria-label')).toContain('row 5, column 4');
    down.focus();
    down.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', bubbles: true }));
    expect(host.querySelector('.harvest-map')!.getAttribute('aria-label')).toContain('row 5, column 5');
    down.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(host.querySelector('.harvest-map')!.getAttribute('aria-label')).toContain('row 4, column 5');
    unmount();
    vi.advanceTimersByTime(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("waits for Start, locks the running rule, and cleans up an active clock", () => {
    vi.useFakeTimers();
    const host = document.createElement("div");
    document.body.append(host);
    const unmount = buildAVillage.mount(host);
    const button = () => [...host.querySelectorAll("button")].find((el) => /^(Start|New) round$/.test(el.textContent ?? ""))!;
    const map = host.querySelector<HTMLElement>(".harvest-map")!;
    const keep = host.querySelector<HTMLInputElement>("[data-mechanic]")!;
    const press = (key: string) => map.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    expect(vi.getTimerCount()).toBe(0);
    button().click();
    [...host.querySelectorAll("button")].find((el) => el.textContent === "Skip")!.click();
    vi.advanceTimersByTime(0);
    press("ArrowLeft"); press("ArrowLeft"); press("ArrowUp"); // Stand on tree at 15.
    expect(host.querySelector("[data-resources]")!.textContent).toContain("0 wood");
    press("e");
    expect(host.querySelector("[data-resources]")!.textContent).toContain("1 wood");
    keep.checked = false; // Pending setting must not change the current round.
    vi.advanceTimersByTime(20_000);
    expect(host.querySelector("[data-resources]")!.textContent).toContain("1 wood");
    expect(document.activeElement).toBe(map);
    button().click();
    [...host.querySelectorAll("button")].find((el) => el.textContent === "Skip")!.click();
    vi.advanceTimersByTime(0);
    press("a"); press("a"); press("w");
    host.querySelector<HTMLButtonElement>("[data-gather]")!.click();
    expect(host.querySelector("[data-resources]")!.textContent).toContain("1 wood");
    vi.advanceTimersByTime(20_000);
    expect(host.querySelector("[data-resources]")!.textContent).toContain("0 wood");
    vi.advanceTimersByTime(110_000);
    expect(host.querySelector("[data-summary]")!.textContent).toContain("Time: 130 seconds");
    expect(vi.getTimerCount()).toBe(0);
    button().click();
    [...host.querySelectorAll("button")].find((el) => el.textContent === "Skip")!.click();
    vi.advanceTimersByTime(0);
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(host.childNodes.length).toBe(0);
  });
});
