import { h, s } from "../../lib/dom";
import type { Minigame } from "../types";
import {
  FLOWER_TYPES, LIMIT_MS, PLOT_COUNT, advanceGarden, createGarden, remainingMs,
  selectFlower, startGarden, tendPlot, waterTargets, type FlowerType, type GardenPlot,
} from "./game";
import "./calm-garden.css";

const NAMES: Record<FlowerType, string> = { daisy: "Daisy", poppy: "Poppy", bellflower: "Bellflower" };
let mounts = 0;

/** Original decorative SVG; every flower and action also has a written label. */
function gardenArt(plot: GardenPlot, animate = false): SVGSVGElement {
  const art = s("svg", {
    viewBox: "0 0 160 100", "aria-hidden": "true", focusable: "false",
    class: `calm-garden-art${animate ? ` calm-garden-${plot.stage}` : ""}`,
    "data-flower": plot.flower ?? "empty",
  });
  art.append(s("ellipse", { cx: 80, cy: 85, rx: 60, ry: 9, class: "calm-garden-soil" }));
  if (plot.stage === "empty") {
    for (const x of [55, 80, 105]) art.append(s("path", { d: `M${x - 5} 84q5-4 10 0`, class: "calm-garden-furrow" }));
    return art;
  }
  const bloomed = plot.stage === "bloomed";
  const top = bloomed ? 35 : 66;
  art.append(
    s("path", { d: `M80 85V${top}`, class: "calm-garden-stem" }),
    s("path", { d: "M80 70q-28 0-24-16q24-3 24 16m0 9q28 0 24-16q-24-3-24 16", class: "calm-garden-leaf" }),
  );
  if (!bloomed) {
    art.append(s("ellipse", { cx: 80, cy: 63, rx: 6, ry: 9, class: "calm-garden-bud" }));
    return art;
  }
  if (plot.flower === "daisy") {
    for (let angle = 0; angle < 360; angle += 45) {
      art.append(s("ellipse", { cx: 80, cy: 19, rx: 6, ry: 12, transform: `rotate(${angle} 80 35)`, class: "calm-garden-daisy-petal" }));
    }
    art.append(s("circle", { cx: 80, cy: 35, r: 9, class: "calm-garden-daisy-center" }));
  } else if (plot.flower === "poppy") {
    for (let angle = 0; angle < 360; angle += 90) {
      art.append(s("ellipse", { cx: 80, cy: 24, rx: 14, ry: 15, transform: `rotate(${angle} 80 35)`, class: "calm-garden-poppy-petal" }));
    }
    art.append(s("circle", { cx: 80, cy: 35, r: 7, class: "calm-garden-poppy-center" }));
  } else {
    art.append(s("path", { d: "M80 45V22M80 23Q61 20 58 35M80 23Q99 20 102 35", class: "calm-garden-stem" }));
    for (const [x, y] of [[58, 33], [80, 22], [102, 33]]) {
      art.append(s("path", { d: `M${x} ${y}c-9 0-6 13-12 17q12 7 24 0c-6-4-3-17-12-17Z`, class: "calm-garden-bell" }));
    }
  }
  if (animate) art.append(s("ellipse", { cx: 80, cy: 80, rx: 45, ry: 10, class: "calm-garden-ripple" }));
  return art;
}

// Retains the template's mount/export contract and the v1 lifecycle/deadline handling.
function mount(el: HTMLElement): () => void {
  const id = ++mounts;
  let state = createGarden();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  let hovered: number | null = null;
  let focused: number | null = null;
  let previewTarget: number | null = null;
  const listeners: Array<() => void> = [];

  const toggle = h("input", { type: "checkbox", "data-mechanic": "time-limit" });
  const start = h("button", { type: "button", class: "calm-garden-button", "data-start": "" }, "Start garden");
  const restart = h("button", { type: "button", class: "calm-garden-button calm-garden-secondary", "data-restart": "" }, "Restart");
  const mode = h("strong", { class: "calm-garden-mode" });
  const countdown = h("span", { "data-countdown": "", role: "timer", "aria-live": "off" });
  const planted = h("span", { "data-planted": "" });
  const completed = h("span", { "data-completed": "" });
  const totalProgress = h("progress", { max: PLOT_COUNT, value: 0, "aria-label": "Flowers blooming" });
  const status = h("p", { class: "calm-garden-status", "data-status": "", role: "status", "aria-live": "polite", "aria-atomic": "true" });
  const modeHint = h("p", { class: "calm-garden-hint" });
  const selectionHint = h("p", { class: "calm-garden-hint" });
  const choices = FLOWER_TYPES.map(flower => {
    const input = h("input", { type: "radio", name: `calm-garden-flower-${id}`, value: flower, checked: flower === "daisy" });
    const label = h("label", { class: "calm-garden-choice" },
      input, gardenArt({ stage: "bloomed", flower }), h("span", {}, NAMES[flower]),
    );
    return { flower, input, label };
  });
  const grid = h("ol", { class: "calm-garden-grid", "aria-label": "Garden: three columns and four rows" });
  const plots = Array.from({ length: PLOT_COUNT }, (_, index) => {
    const art = h("span", { class: "calm-garden-picture" });
    const stage = h("span", { class: "calm-garden-stage" });
    const action = h("span", { class: "calm-garden-plot-action" });
    const button = h("button", { type: "button", class: "calm-garden-plot-button" },
      h("span", { class: "calm-garden-plot-number" }, `Plot ${index + 1}`), art, stage, action,
    );
    const card = h("li", { class: "calm-garden-plot", "data-plot": index }, button);
    grid.append(card);
    return { art, stage, action, button, card };
  });
  const reflection = h("section", { class: "calm-garden-reflection", "data-reflection": "", "aria-label": "Reflect on your garden" },
    h("h4", {}, "Then check it against your own play"),
    h("p", {}, "Restart and try the other mode. These questions are for you; no answers are collected."),
    h("ul", {},
      h("li", {}, "What did you feel while arranging flowers without a timer?"),
      h("li", {}, "Did choosing flowers and blooming a group feel satisfying, repetitive, or something else?"),
      h("li", {}, "What changed in your actions and feelings with the countdown enabled?"),
      h("li", {}, "Did either mode help you disengage from thoughts outside the game?"),
    ),
  );
  const root = h("div", { class: "calm-garden", role: "group", "aria-label": "Calm Garden: Bloom & Arrange" },
    h("div", { class: "calm-garden-intro" },
      h("span", { class: "calm-garden-eyebrow" }, "A little garden, arranged by you"),
      h("p", {}, "Choose a flower and plant an empty plot. Water a planted flower to bloom it and its planted neighbors above, below, left, and right. No chains, no perfect arrangement."),
    ),
    h("fieldset", { class: "calm-garden-controls" },
      h("legend", {}, "Choose your pace"),
      h("label", { class: "calm-garden-toggle" }, toggle, ` Time limit: ${LIMIT_MS / 1000} seconds`),
      modeHint, h("div", { class: "calm-garden-actions" }, start, restart),
    ),
    h("fieldset", { class: "calm-garden-flowers" },
      h("legend", {}, "Choose your flower"),
      h("div", { class: "calm-garden-palette" }, ...choices.map(choice => choice.label)),
      selectionHint,
    ),
    h("div", { class: "calm-garden-summary" }, mode, countdown, planted, completed, totalProgress),
    status, grid, reflection,
  );
  el.append(root);

  function listen(element: HTMLElement, event: keyof HTMLElementEventMap, handler: () => void): void {
    element.addEventListener(event, handler);
    listeners.push(() => element.removeEventListener(event, handler));
  }
  function cancelTimer(): void {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }
  function preview(): void {
    const targets = state.status === "playing" && previewTarget !== null ? waterTargets(state, previewTarget) : [];
    plots.forEach(({ card }, index) => { card.dataset.preview = String(targets.includes(index)); });
  }

  function render(now: number): void {
    const count = state.plots.filter(plot => plot.stage === "bloomed").length;
    const plantedCount = state.plots.filter(plot => plot.stage !== "empty").length;
    const ended = state.status === "complete" || state.status === "timeout";
    root.dataset.state = state.status;
    toggle.checked = state.timed;
    toggle.disabled = state.status !== "ready";
    start.setAttribute("aria-disabled", String(state.status !== "ready"));
    choices.forEach(({ flower, input, label }) => {
      input.checked = state.selectedFlower === flower;
      input.disabled = ended;
      label.dataset.selected = String(input.checked);
    });
    selectionHint.textContent = `Planting ${NAMES[state.selectedFlower]}. All three flowers grow the same way.`;
    mode.textContent = state.timed ? "Timed Mode" : "Relaxed Mode · no time limit";
    modeHint.textContent = state.status === "ready"
      ? "Only the deadline changes. Start whenever you’re ready."
      : "Restart to reset the garden and choose either mode.";
    const remaining = remainingMs(state, now);
    countdown.hidden = remaining === null;
    if (remaining !== null) {
      const seconds = Math.ceil(remaining / 1000);
      countdown.textContent = `Time left: ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
    }
    planted.textContent = `${plantedCount} of ${PLOT_COUNT} planted`;
    completed.textContent = `${count} of ${PLOT_COUNT} blooming`;
    totalProgress.value = count;
    let message = "Choose a flower, then press Start garden.";
    if (state.status === "complete") message = "Garden complete. Every flower is blooming. Take a moment to enjoy your arrangement.";
    else if (state.status === "timeout") message = `Time’s up. Your garden has ${count} of ${PLOT_COUNT} flowers blooming. Your work stays here to enjoy.`;
    else if (state.status === "playing" && state.lastAction) {
      const action = state.lastAction;
      const plot = action.plots[0];
      message = action.kind === "plant"
        ? `${NAMES[state.plots[plot].flower!]} planted on plot ${plot + 1}. Water it whenever you like.`
        : `Watered plot ${plot + 1}: ${action.plots.length === 1 ? "one flower bloomed" : `${action.plots.length} flowers bloomed together`}.`;
    } else if (state.status === "playing") message = "Plant and water at your own pace. Nothing in the garden deteriorates.";
    if (status.textContent !== message) status.textContent = message;
    reflection.hidden = !ended;
    plots.forEach(({ art, stage, action, button, card }, index) => {
      const plot = state.plots[index];
      const flower = plot.flower ?? "empty";
      if (card.dataset.stage !== plot.stage || card.dataset.flower !== flower) {
        card.dataset.stage = plot.stage;
        card.dataset.flower = flower;
        art.replaceChildren(gardenArt(plot, plot.stage !== "empty"));
        stage.textContent = plot.flower ? NAMES[plot.flower] : "Empty soil";
      }
      const targets = waterTargets(state, index).length;
      action.textContent = plot.stage === "empty" ? "Plant" : plot.stage === "bloomed" ? "Bloomed" : `Water ${targets}`;
      const description = plot.stage === "empty" ? `Plant ${NAMES[state.selectedFlower]}`
        : plot.stage === "bloomed" ? `${NAMES[plot.flower]} blooming`
        : `Water ${targets} ${targets === 1 ? "flower" : "flowers"}, ${NAMES[plot.flower]}`;
      button.setAttribute("aria-label", `Plot ${index + 1}: ${description}`);
      // Keep native buttons and stable focus, as in v1; the rules guard unavailable actions.
      button.setAttribute("aria-disabled", String(state.status !== "playing" || plot.stage === "bloomed"));
    });
    preview();
  }

  function update(): void {
    cancelTimer();
    if (disposed) return;
    const now = performance.now();
    state = advanceGarden(state, now);
    render(now);
    if (state.status === "playing" && state.deadline !== null) {
      timer = setTimeout(update, Math.min(250, Math.max(1, state.deadline - now)));
    }
  }
  listen(toggle, "change", () => {
    if (state.status === "ready") state = { ...createGarden(toggle.checked), selectedFlower: state.selectedFlower };
    update();
  });
  choices.forEach(({ flower, input }) => listen(input, "change", () => {
    state = selectFlower(advanceGarden(state, performance.now()), flower);
    update();
  }));
  listen(start, "click", () => {
    state = startGarden(state, performance.now());
    update();
  });
  listen(restart, "click", () => {
    cancelTimer();
    state = createGarden(state.timed);
    hovered = focused = previewTarget = null;
    update();
  });
  plots.forEach(({ button }, index) => {
    listen(button, "click", () => {
      state = tendPlot(state, index, performance.now());
      update();
    });
    // Follow the latest input, so a parked mouse cannot override keyboard focus.
    listen(button, "pointerenter", () => { hovered = previewTarget = index; preview(); });
    listen(button, "pointerleave", () => { hovered = null; previewTarget = focused; preview(); });
    listen(button, "focus", () => { focused = previewTarget = index; preview(); });
    listen(button, "blur", () => { focused = null; previewTarget = hovered; preview(); });
  });
  update();

  return () => {
    disposed = true;
    cancelTimer();
    listeners.splice(0).forEach(remove => remove());
    root.remove();
  };
}

export const calmGarden: Minigame = {
  slug: "calm-garden", title: "Calm Garden: Bloom & Arrange", motivators: ["submission"], author: "RuaJ77", mount,
};
