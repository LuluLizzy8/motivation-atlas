// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { fogBeacons } from "../src/minigames/fog-beacons";
import { cellId, isVisible, makeBoard, move, newGame, type Direction, type GameState } from "../src/minigames/fog-beacons/game";

const directions: Direction[] = ["up", "right", "down", "left"];
function winningRoute(seed: number): Direction[] {
  const start = newGame(seed), queue: [GameState, Direction[]][] = [[start, []]], seen = new Set<string>();
  for (let i = 0; i < queue.length; i++) {
    const [state, path] = queue[i];
    const key = `${cellId(state.board, state.player)}:${state.collected.slice().sort().join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (state.won) return path;
    for (const direction of directions) {
      const next = move(state, direction);
      if (next.moves > state.moves) queue.push([next, [...path, direction]]);
    }
  }
  throw new Error(`No winning route for map ${seed}`);
}

describe("fog beacons rules", () => {
  it("keeps the same map, goals, and legal moves in both visibility modes", () => {
    let fog = newGame(7, true), clear = newGame(7, false);
    expect(fog.board).toEqual(clear.board);
    for (const direction of winningRoute(7)) {
      fog = move(fog, direction); clear = move(clear, direction);
      expect(fog.player).toEqual(clear.player);
      expect(fog.collected).toEqual(clear.collected);
      expect(fog.moves).toBe(clear.moves);
      expect(fog.won).toBe(clear.won);
    }
  });

  it("hides distant tiles only when fog is on", () => {
    const fog = newGame(1, true), clear = newGame(1, false);
    expect(isVisible(fog, { x: 5, y: 5 })).toBe(false);
    expect(isVisible(clear, { x: 5, y: 5 })).toBe(true);
    expect(isVisible(fog, fog.player)).toBe(true);
    expect(isVisible(fog, { x: 1, y: 0 })).toBe(true);
    expect(isVisible(fog, { x: 1, y: 3 })).toBe(false);
  });

  it("preserves discovered information after moving away", () => {
    let state = newGame();
    for (const direction of winningRoute(1)) {
      const previous = [...state.revealed];
      state = move(state, direction);
      for (const id of previous) expect(state.revealed).toContain(id);
    }
  });

  it("does not count a wall collision as a successful move or mutate the input", () => {
    const start = newGame(), before = JSON.stringify(start), blocked = move(start, "up");
    expect(blocked.player).toEqual(start.player);
    expect(blocked.moves).toBe(0);
    expect(blocked.bumps).toBe(1);
    expect(JSON.stringify(start)).toBe(before);
  });

  it("counts a return visit and does not collect a beacon twice", () => {
    let state = newGame();
    const route = winningRoute(1), inverse: Record<Direction, Direction> = { up: "down", down: "up", left: "right", right: "left" };
    const first = route[0];
    state = move(move(state, first), inverse[first]);
    expect(state.revisits).toBe(1);
    expect(state.player).toEqual(state.board.start);
    for (const direction of route) state = move(state, direction);
    expect(new Set(state.collected).size).toBe(3);
    expect(state.won).toBe(true);
  });

  it("requires all three beacons before an exit visit wins", () => {
    const state = newGame();
    const queue: [GameState, Direction[]][] = [[state, []]], seen = new Set<number>();
    for (let i = 0; i < queue.length; i++) {
      const [current, path] = queue[i], id = cellId(current.board, current.player);
      if (seen.has(id)) continue;
      seen.add(id);
      if (current.player.x === state.board.exit.x && current.player.y === state.board.exit.y) {
        const empty = { ...current, collected: [], won: false };
        expect(empty.won).toBe(false);
        const incoming = path.at(-1)!;
        const delta: Record<Direction, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
        const [dx, dy] = delta[incoming];
        const beforeExit = { ...empty, player: { x: empty.player.x - dx, y: empty.player.y - dy } };
        expect(move(beforeExit, incoming).won).toBe(false);
        return;
      }
      for (const direction of directions) {
        const next = move(current, direction);
        if (next.moves > current.moves) queue.push([next, [...path, direction]]);
      }
    }
    throw new Error("Exit unreachable");
  });

  it("generates reproducible solvable boards with distinct goals", () => {
    for (let seed = 1; seed <= 80; seed++) {
      const board = makeBoard(seed);
      expect(board).toEqual(makeBoard(seed));
      expect(new Set([board.start, board.exit, ...board.beacons].map(p => cellId(board, p))).size).toBe(5);
      const final = winningRoute(seed).reduce((state, direction) => move(state, direction), newGame(seed));
      expect(final.won).toBe(true);
      expect(move(final, "up")).toBe(final);
    }
    expect(makeBoard(1).walls).not.toEqual(makeBoard(2).walls);
  });

  it("rejects invalid map seeds", () => {
    for (const seed of [0, -1, 1.5, NaN, 0x100000000]) expect(() => makeBoard(seed)).toThrow(RangeError);
  });
});

afterEach(() => { document.body.replaceChildren(); vi.useRealTimers(); });

describe("fog beacons controls", () => {
  it("does not expose hidden terrain in the DOM and restarts when visibility changes", () => {
    const host = document.createElement("div"); document.body.append(host);
    const cleanup = fogBeacons.mount(host), toggle = host.querySelector<HTMLInputElement>("[data-mechanic]")!;
    expect(host.querySelectorAll(".fog-beacons-unknown").length).toBeGreaterThan(0);
    for (const cell of host.querySelectorAll(".fog-beacons-unknown")) {
      expect(cell.textContent).toBe("?");
      expect(cell.getAttribute("aria-label")).toContain("unexplored");
      expect(cell.className).not.toMatch(/fog-beacons-(beacon|wall|exit)\b/);
    }
    host.querySelector<HTMLButtonElement>("[data-direction=up]")!.click();
    expect(host.querySelector("[data-stats]")!.textContent).toContain("1 blocked");
    toggle.checked = false; toggle.dispatchEvent(new Event("change"));
    expect(host.querySelectorAll(".fog-beacons-unknown").length).toBe(0);
    expect(host.querySelector("[data-stats]")!.textContent).toContain("0 blocked");
    cleanup();
  });

  it("supports arrows on the map without stealing arrows from the toggle", () => {
    const host = document.createElement("div"); document.body.append(host);
    const cleanup = fogBeacons.mount(host), board = host.querySelector<HTMLElement>(".fog-beacons-grid")!;
    const direction = winningRoute(1)[0], keys: Record<Direction, string> = { up: "ArrowUp", right: "ArrowRight", down: "ArrowDown", left: "ArrowLeft" };
    board.dispatchEvent(new KeyboardEvent("keydown", { key: keys[direction], bubbles: true, cancelable: true }));
    expect(host.querySelector("[data-stats]")!.textContent).toContain("1 moves");
    host.querySelector("input")!.dispatchEvent(new KeyboardEvent("keydown", { key: keys[direction], bubbles: true }));
    expect(host.querySelector("[data-stats]")!.textContent).toContain("1 moves");
    cleanup();
  });

  it("completes a map using touch/click controls, then supports restart and new map", () => {
    const host = document.createElement("div"); document.body.append(host);
    const cleanup = fogBeacons.mount(host);
    for (const direction of winningRoute(1)) host.querySelector<HTMLButtonElement>(`[data-direction=${direction}]`)!.click();
    expect(host.querySelector("[data-status]")!.textContent).toContain("You made it out");
    const before = host.querySelector("[data-stats]")!.textContent;
    host.querySelector<HTMLButtonElement>("[data-direction=up]")!.click();
    expect(host.querySelector("[data-stats]")!.textContent).toBe(before);
    [...host.querySelectorAll("button")].find(b => b.textContent === "Restart map")!.click();
    expect(host.querySelector("[data-stats]")!.textContent).toContain("0 moves");
    [...host.querySelectorAll("button")].find(b => b.textContent === "New map")!.click();
    expect(host.querySelector("[data-map]")!.textContent).toBe("Map 2.");
    cleanup();
  });

  it("cleans up without timers and allows two independent mounts", () => {
    vi.useFakeTimers();
    const a = document.createElement("div"), b = document.createElement("div");
    document.body.append(a, b);
    const ca = fogBeacons.mount(a), cb = fogBeacons.mount(b);
    a.querySelector<HTMLButtonElement>("[data-direction=up]")!.click();
    expect(b.querySelector("[data-stats]")!.textContent).toContain("0 blocked");
    const oldButton = a.querySelector<HTMLButtonElement>("[data-direction=up]")!;
    ca(); oldButton.click();
    expect(a.childNodes.length).toBe(0);
    expect(b.childNodes.length).toBeGreaterThan(0);
    cb(); expect(vi.getTimerCount()).toBe(0);
  });
});
