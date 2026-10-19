import { h } from "../../lib/dom";
import type { Minigame } from "../types";
import { isOver, newRound, PEBBLES, place, SECONDS, tick, timeLeft, type Kind, type SortOptions, type SortState } from "./game";
import { dynamicsFor } from "./sources";
import "./pebble-sort.css";

const TICK_MS = 100;
const NEXT_SHOWN = 5;
const PEBBLE: Record<Kind, { glyph: string; name: string }> = {
  0: { glyph: "●", name: "Round" },
  1: { glyph: "▲", name: "Sharp" },
  2: { glyph: "■", name: "Flat" },
};

function mount(el: HTMLElement): () => void {
  let options: SortOptions = { moveCounter: true, pebbles: PEBBLES, seconds: SECONDS };
  let state: SortState = newRound(options);
  let timer: ReturnType<typeof setInterval> | null = null;
  let lastTick = 0;

  const status = h("p", { class: "ps-status", "aria-live": "polite", "data-status": "" });
  const hand = h("div", { class: "ps-hand", "data-hand": "" });
  const next = h("div", { class: "ps-next", "aria-label": "Next pebbles" });
  const sorted = h("span", { "data-sorted": "" }, "0");
  const gauge = h("span", { "data-gauge": "" });
  const barFill = h("div", { class: "ps-bar-fill" });
  const bar = h("div", { class: "ps-bar", "aria-hidden": "true" }, barFill);
  const bowls = ([0, 1, 2] as Kind[]).map((k) =>
    h("button", { type: "button", class: `ps-bowl ps-kind-${k}`, "data-bowl": k },
      h("span", { class: "ps-glyph", "aria-hidden": "true" }, PEBBLE[k].glyph),
      h("span", {}, PEBBLE[k].name),
      h("kbd", {}, String(k + 1)),
    ));
  const counter = h("input", { type: "checkbox", "data-mechanic": "move-counter", checked: true });
  const newBtn = h("button", { type: "button", class: "ps-btn secondary", "data-new": "" }, "New round");
  const dynamics = h("ul", { class: "ps-dynamics", "data-dynamics": "" });

  const root = h("div", { class: "pebble-sort" },
    h("div", { class: "ps-board" },
      status,
      h("div", { class: "ps-tray" }, hand, next),
      h("p", { class: "ps-readout" }, "Sorted ", sorted, ` of ${PEBBLES}`, " · ", gauge),
      bar,
      h("div", { class: "ps-bowls" }, ...bowls),
    ),
    h("fieldset", { class: "ps-mechanics" },
      h("legend", {}, "Mechanic, applied at once with a fresh basket"),
      h("label", {}, counter, ` Move counter in place of a clock. Turn it off to sort against a ${SECONDS}-second clock.`),
      newBtn,
    ),
    h("section", { class: "ps-panel" },
      h("h4", {}, "What the sources say emerges"),
      dynamics,
    ),
    h("section", { class: "ps-reflect" },
      h("h4", {}, "Then check it against your own play"),
      h("ul", {},
        h("li", {}, "How did the last ten pebbles feel with the move counter, and with the clock?"),
        h("li", {}, "Did you look ahead at the next pebbles, or only at the one in your hand? Did that change with the clock?"),
        h("li", {}, "Did your experience match what the sources say emerges? Where did it differ?"),
      ),
    ),
  );
  el.append(root);

  function message(): string {
    const counting = options.moveCounter;
    if (state.status === "cleared") {
      return counting
        ? `All ${PEBBLES} sorted in ${state.moves} moves. Nothing was waiting on you.`
        : `All ${PEBBLES} sorted with ${seconds(timeLeft(state))} to spare.`;
    }
    if (state.status === "timeUp") return `Time. ${state.basket.length} ${state.basket.length === 1 ? "pebble is" : "pebbles are"} still in the basket.`;
    if (state.lastEvent === "bounced") return counting ? "Wrong bowl. The pebble comes back to your hand." : "Wrong bowl. The pebble comes back, and the clock keeps running.";
    if (state.status === "ready") {
      return counting
        ? "Drop each pebble into its bowl. There is no clock; take your time."
        : `Sort all ${PEBBLES} before the clock runs out. It starts on your first move.`;
    }
    return counting ? "Keep sorting." : "Keep sorting. The clock is running.";
  }

  function seconds(ms: number): string {
    return `${(Math.max(0, ms) / 1000).toFixed(1)} s`;
  }

  function render(): void {
    const current = state.basket[0];
    hand.textContent = current === undefined ? "" : PEBBLE[current].glyph;
    hand.className = `ps-hand${current === undefined ? "" : ` ps-kind-${current}`}`;
    hand.setAttribute("aria-label", current === undefined ? "Basket empty" : `In your hand: ${PEBBLE[current].name}`);
    next.replaceChildren(...state.basket.slice(1, 1 + NEXT_SHOWN).map((k) => h("span", { class: `ps-kind-${k}` }, PEBBLE[k].glyph)));
    sorted.textContent = String(state.sorted);
    gauge.textContent = options.moveCounter ? `Moves ${state.moves}` : `Time left ${seconds(timeLeft(state))}`;
    bar.hidden = options.moveCounter;
    barFill.style.width = `${(timeLeft(state) / (options.seconds * 1000)) * 100}%`;
    status.textContent = message();
    // aria-disabled instead of disabled, so keyboard focus stays on the bowl when a round ends.
    for (const bowl of bowls) bowl.setAttribute("aria-disabled", String(isOver(state)));
    dynamics.replaceChildren(...dynamicsFor(options).map((text) => h("li", {}, text)));
  }

  function stopClock(): void {
    if (timer !== null) clearInterval(timer);
    timer = null;
  }

  function startClock(): void {
    if (options.moveCounter || timer !== null || state.status !== "playing") return;
    lastTick = Date.now();
    timer = setInterval(() => {
      const now = Date.now();
      state = tick(state, now - lastTick);
      lastTick = now;
      if (state.status !== "playing") stopClock();
      render();
    }, TICK_MS);
  }

  function bounce(): void {
    hand.classList.remove("ps-bounce");
    void hand.offsetWidth; // restart the animation
    hand.classList.add("ps-bounce");
  }

  function drop(bowl: number): void {
    if (isOver(state)) return;
    state = place(state, bowl);
    if (isOver(state)) stopClock();
    else startClock();
    render();
    if (state.lastEvent === "bounced") bounce();
  }

  function reset(): void {
    stopClock();
    options = { ...options, moveCounter: counter.checked };
    state = newRound(options);
    render();
  }

  bowls.forEach((bowl, k) => bowl.addEventListener("click", () => drop(k)));
  root.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || !["1", "2", "3"].includes(e.key)) return;
    e.preventDefault();
    drop(Number(e.key) - 1);
  });
  counter.addEventListener("change", reset);
  newBtn.addEventListener("click", reset);

  render();
  return () => {
    stopClock();
    root.remove();
  };
}

export const pebbleSort: Minigame = {
  slug: "pebble-sort",
  title: "Pebble Sort: a counter or a clock",
  motivators: ["submission"],
  author: "rajvardhan19",
  mount,
};
