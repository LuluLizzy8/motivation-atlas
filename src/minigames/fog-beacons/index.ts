import { h } from "../../lib/dom";
import type { Minigame } from "../types";
import { cellId, isVisible, move, newGame, type Direction } from "./game";
import "./fog-beacons.css";

function mount(el: HTMLElement): () => void {
  let seed = 1, state = newGame(seed, true), closed = false;
  const fog = h("input", { type: "checkbox", checked: true, "data-mechanic": "fog-of-war" });
  const board = h("div", { class: "fog-beacons-grid", role: "img", tabindex: 0,
    "aria-label": "Map. Use arrow keys or WASD to move. Question marks are unexplored tiles." });
  const status = h("p", { class: "fog-beacons-status", role: "status", "data-status": "" });
  const stats = h("p", { class: "fog-beacons-stats", "data-stats": "" });
  const mapName = h("span", { "data-map": "" });
  const reset = h("button", { type: "button", class: "fog-beacons-button" }, "Restart map");
  const next = h("button", { type: "button", class: "fog-beacons-button" }, "New map");
  const directions: [Direction, string][] = [["up", "↑"], ["left", "←"], ["down", "↓"], ["right", "→"]];
  const buttons = directions.map(([direction, label]) => {
    const button = h("button", { type: "button", class: `fog-beacons-button fog-beacons-${direction}`,
      "aria-label": `Move ${direction}`, "data-direction": direction }, label);
    button.addEventListener("click", () => act(direction));
    return button;
  });
  const root = h("section", { class: "fog-beacons", "aria-label": "Fog Beacons game" },
    h("p", { class: "fog-beacons-intro" }, "Find 3 beacons, then reach the exit. No timer, no lost lives. ", mapName),
    h("label", { class: "fog-beacons-toggle" }, fog, " Fog of war: reveal nearby tiles as you move"),
    h("p", { class: "fog-beacons-note" }, "Changing visibility restarts this map. The route and goals stay the same, but you may remember them. Try New map for an unfamiliar layout."),
    board,
    h("p", { class: "fog-beacons-legend" }, "● You · ✦ Beacon · E Exit · ▪ Wall · ? Unexplored"),
    status, stats,
    h("div", { class: "fog-beacons-pad", "aria-label": "Movement controls" }, ...buttons),
    h("div", { class: "fog-beacons-actions" }, reset, next),
    h("section", { class: "fog-beacons-reflect" },
      h("h4", {}, "Then check it against your own play"),
      h("p", {}, "What made you choose your next direction? Did revealing a new path feel interesting, frustrating, or neither?"),
      h("p", {}, "Try the other visibility setting. What changed in your route and in how you felt? Remembering a route can make the second run easier, so alternate the starting mode when playing with someone else."),
    ),
  );
  el.append(root);

  function draw(message?: string): void {
    const cells: HTMLElement[] = [];
    for (let y = 0; y < state.board.size; y++) for (let x = 0; x < state.board.size; x++) {
      const p = { x, y }, id = cellId(state.board, p), visible = isVisible(state, p);
      let symbol = "?", kind = "unknown", label = "unexplored";
      if (visible) {
        const beacon = state.board.beacons.findIndex(b => b.x === x && b.y === y);
        if (state.player.x === x && state.player.y === y) { symbol = "●"; kind = "player"; label = "you"; }
        else if (state.board.walls[id]) { symbol = "▪"; kind = "wall"; label = "wall"; }
        else if (beacon >= 0 && !state.collected.includes(beacon)) { symbol = "✦"; kind = "beacon"; label = "beacon"; }
        else if (state.board.exit.x === x && state.board.exit.y === y) { symbol = "E"; kind = "exit"; label = "exit"; }
        else { symbol = "·"; kind = "path"; label = "path"; }
      }
      cells.push(h("span", { class: `fog-beacons-cell fog-beacons-${kind}`, "aria-label": `Row ${y + 1}, column ${x + 1}: ${label}` }, symbol));
    }
    board.replaceChildren(...cells);
    mapName.textContent = `Map ${seed}.`;
    const atExit = state.player.x === state.board.exit.x && state.player.y === state.board.exit.y;
    status.textContent = state.won ? "All beacons found. You made it out! Try the other setting and compare how it felt."
      : message ?? (atExit ? "This is the exit. Find the remaining beacons, then return here."
        : `${state.collected.length} of 3 beacons found. ${state.fog ? "Uncovered tiles stay visible." : "The whole map is visible."}`);
    stats.textContent = `${state.moves} moves · ${state.revisits} return visits · ${state.bumps} blocked moves`;
    for (const button of buttons) button.setAttribute("aria-disabled", String(state.won));
  }

  function act(direction: Direction): void {
    if (closed) return;
    const before = state;
    state = move(state, direction);
    draw(state.bumps > before.bumps ? "A wall blocks that direction. Try another path." : undefined);
  }
  function restart(): void {
    if (closed) return;
    state = newGame(seed, fog.checked);
    draw();
  }
  fog.addEventListener("change", restart);
  reset.addEventListener("click", restart);
  next.addEventListener("click", () => { seed = seed === 0xffffffff ? 1 : seed + 1; restart(); });
  const keys: Record<string, Direction> = { ArrowUp: "up", ArrowRight: "right", ArrowDown: "down", ArrowLeft: "left", w: "up", d: "right", s: "down", a: "left" };
  function keydown(event: KeyboardEvent): void {
    if (event.target !== board) return;
    const direction = keys[event.key] ?? keys[event.key.toLowerCase()];
    if (!direction) return;
    event.preventDefault();
    act(direction);
  }
  root.addEventListener("keydown", keydown);
  draw();
  return () => { closed = true; root.removeEventListener("keydown", keydown); root.remove(); };
}

export const fogBeacons: Minigame = {
  slug: "fog-beacons", title: "Fog Beacons: discover the route", motivators: ["discovery"], author: "liffsss", mount,
};
