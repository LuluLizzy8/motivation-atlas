import { h, s } from "../../lib/dom";
import type { Minigame } from "../types";
import {
  DEFAULT_SETTINGS, FIXED_STEP, WORLD, flap, pause, pipeRects, ready, reset, resume, settingsKey, start, step,
  type Settings,
} from "./game";
import "./flap-lab.css";

let mounts = 0;
// Kept in memory across page visits; each combination has its own best score.
const bests = new Map<string, number>();
const MAX_FRAME_GAP_MS = 250;

function mount(el: HTMLElement): () => void {
  const id = `flap-lab-${++mounts}`;
  let selected: Settings = { ...DEFAULT_SETTINGS };
  let state = ready(selected);
  let frame: number | null = null;
  let lastTime: number | null = null;
  let accumulator = 0;
  let disposed = false;
  const listeners: Array<() => void> = [];
  function listen(target: EventTarget, event: string, handler: EventListener): void {
    target.addEventListener(event, handler);
    listeners.push(() => target.removeEventListener(event, handler));
  }

  const controls = h("p", { id: `${id}-controls`, class: "flap-lab-hint" },
    "Tap the board, press Space / ↑ on it, or use Flap. Escape pauses.");
  const settingsNote = h("p", { id: `${id}-settings-note`, class: "flap-lab-hint" }, "Change settings between attempts.");
  const settings = h("fieldset", { class: "flap-lab-settings", "aria-describedby": settingsNote.id },
    h("legend", {}, "Choose your challenge"));
  const inputs = new Map<keyof Settings, HTMLInputElement>();
  for (const [key, marker, label, description] of [
    ["faster", "pipe-speed", "Faster pipes", "Off: 130 · On: 180 units/second"],
    ["narrower", "gap-size", "Narrower openings", "Off: 160 · On: 120 units tall"],
    ["frequent", "pipe-frequency", "More frequent pipes", "Off: every 1.9s · On: every 1.45s"],
  ] as const) {
    const input = h("input", { type: "checkbox", id: `${id}-${key}`, "data-mechanic": marker });
    inputs.set(key, input);
    settings.append(h("label", { for: input.id }, input,
      h("span", {}, h("strong", {}, label), h("small", {}, description))));
    listen(input, "change", () => {
      if (state.phase === "running" || state.phase === "paused") return;
      selected = { ...selected, [key]: input.checked };
      if (state.phase === "ready") state = ready(selected);
      render();
    });
  }
  const summary = h("p", { class: "flap-lab-summary", "data-settings-summary": "" });
  const score = h("span", { "data-score": "" }, "0");
  const time = h("span", { "data-time": "" }, "90.0");
  const best = h("span", { "data-best": "" }, "0");
  const stats = h("div", { class: "flap-lab-stats", "aria-live": "off" },
    h("p", {}, "Score ", score), h("p", {}, "Time left ", time, "s"),
    h("p", { class: "flap-lab-best" }, "Best for these settings: ", best));
  const pipes = s("g", { class: "flap-lab-pipes" });
  const bird = s("circle", { cx: WORLD.birdX, cy: WORLD.birdY, r: WORLD.radius, class: "flap-lab-bird", "data-bird": "" });
  const board = s("svg", {
    class: "flap-lab-board", viewBox: `0 0 ${WORLD.width} ${WORLD.height}`, tabindex: 0, role: "img",
    "aria-label": "Bouncy Ball playfield: keep the ball between the rectangular pipes",
    "aria-describedby": controls.id,
  }, pipes, s("rect", { x: 0, y: WORLD.ground, width: WORLD.width, height: WORLD.height - WORLD.ground, class: "flap-lab-ground" }), bird);
  const status = h("p", { class: "flap-lab-status", role: "status", "aria-live": "polite", "aria-atomic": "true", "data-status": "" });
  const button = (action: string, label: string) => h("button", { type: "button", "data-action": action }, label);
  const startButton = button("start", "Start");
  const flapButton = button("flap", "Flap");
  const pauseButton = button("pause", "Pause");
  const resetButton = button("reset", "Reset");
  const reflection = h("section", { class: "flap-lab-reflect" },
    h("h4", {}, "Then check it against your own play"),
    h("p", {}, "Change one setting and try again. What changed in your timing or retries? What did you feel: improvement, satisfaction, frustration, or something else?"));
  const root = h("div", { class: "flap-lab", "data-phase": "ready" },
    controls, settings, settingsNote, summary, stats, status, board,
    h("div", { class: "flap-lab-actions" }, startButton, flapButton, pauseButton, resetButton), reflection);
  el.append(root);

  const pipeNodes = new Map<number, [SVGRectElement, SVGRectElement]>();
  function render(): void {
    root.dataset.phase = state.phase;
    const locked = state.phase === "running" || state.phase === "paused";
    for (const input of inputs.values()) input.disabled = locked;
    const labels = [selected.faster ? "Fast speed" : "Normal speed", selected.narrower ? "Narrow openings" : "Wide openings", selected.frequent ? "More frequent pipes" : "Normal frequency"];
    summary.textContent = `${state.phase === "ended" ? "Next attempt: " : ""}${labels.join(" · ")}`;
    score.textContent = String(state.score);
    time.textContent = Math.max(0, WORLD.duration - state.elapsed).toFixed(1);
    best.textContent = String(bests.get(settingsKey(selected)) ?? 0);
    const startLabel = state.phase === "ended" ? "Retry" : "Start";
    const pauseLabel = state.phase === "paused" ? "Resume" : "Pause";
    // Keep label nodes stable between pointerdown and click, including in Safari.
    if (startButton.textContent !== startLabel) startButton.textContent = startLabel;
    startButton.setAttribute("aria-disabled", String(locked));
    flapButton.setAttribute("aria-disabled", String(state.phase === "paused" || state.phase === "ended"));
    if (pauseButton.textContent !== pauseLabel) pauseButton.textContent = pauseLabel;
    pauseButton.setAttribute("aria-disabled", String(!locked));
    bird.setAttribute("cy", String(state.birdY));
    const active = new Set(state.pipes.map((pipe) => pipe.id));
    for (const [pipeId, nodes] of pipeNodes) {
      if (!active.has(pipeId)) { nodes.forEach((node) => node.remove()); pipeNodes.delete(pipeId); }
    }
    for (const pipe of state.pipes) {
      let nodes = pipeNodes.get(pipe.id);
      if (!nodes) {
        nodes = [s("rect"), s("rect")];
        pipeNodes.set(pipe.id, nodes);
        pipes.append(...nodes);
      }
      pipeRects(pipe, state.config.gap).forEach((rect, i) => {
        for (const [name, value] of Object.entries(rect)) nodes[i].setAttribute(name, String(value));
      });
    }
  }
  function stopLoop(): void {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    lastTime = null;
    accumulator = 0;
  }
  function pauseGame(message = "Paused. Choose Resume when ready."): void {
    if (state.phase !== "running") return;
    state = pause(state);
    stopLoop();
    status.textContent = message;
    render();
  }
  function animate(timestamp: number): void {
    frame = null;
    if (disposed || state.phase !== "running") return;
    if (lastTime !== null) {
      const delta = timestamp - lastTime;
      if (delta > MAX_FRAME_GAP_MS) {
        pauseGame("Paused after an interruption. Choose Resume when ready.");
        return;
      }
      accumulator += Math.max(0, delta) / 1000;
      while (accumulator + 1e-10 >= FIXED_STEP && state.phase === "running") {
        state = step(state, FIXED_STEP);
        accumulator -= FIXED_STEP;
      }
    }
    lastTime = timestamp;
    if (state.phase === "ended") {
      const key = settingsKey(state.settings);
      bests.set(key, Math.max(bests.get(key) ?? 0, state.score));
      stopLoop();
      status.textContent = `${state.outcome === "complete" ? "Round complete" : "Game over"}. Score: ${state.score}. Survival time: ${state.elapsed.toFixed(1)}s. Choose Retry to play again.`;
    } else {
      frame = requestAnimationFrame(animate);
    }
    render();
  }
  function startGame(): void {
    if (state.phase === "running" || state.phase === "paused") return;
    stopLoop();
    state = start(selected);
    board.focus({ preventScroll: true });
    status.textContent = "Started. Keep the ball in the openings.";
    render();
    frame = requestAnimationFrame(animate);
  }
  function doFlap(): void {
    if (state.phase === "ready") { startGame(); return; }
    state = flap(state);
  }
  listen(startButton, "click", startGame);
  listen(flapButton, "click", doFlap);
  listen(pauseButton, "click", () => {
    if (state.phase === "paused") {
      stopLoop();
      state = resume(state);
      board.focus({ preventScroll: true });
      status.textContent = "Resumed. Keep the ball in the openings.";
      render();
      frame = requestAnimationFrame(animate);
    } else pauseGame();
  });
  listen(resetButton, "click", () => {
    stopLoop();
    state = reset(state, selected);
    status.textContent = "Ready. Tap the board or press Space on it to start.";
    render();
  });
  listen(board, "pointerdown", (raw) => {
    const event = raw as PointerEvent;
    if (event.button !== 0 || event.isPrimary === false) return;
    event.preventDefault();
    board.focus({ preventScroll: true });
    doFlap();
  });
  listen(root, "keydown", (raw) => {
    const event = raw as KeyboardEvent;
    if (event.key === "Escape" && state.phase === "running") {
      event.preventDefault();
      pauseGame();
    }
    // Keep native buttons/checkboxes independent from playfield shortcuts.
    if (event.target === board && (event.code === "Space" || event.key === "ArrowUp")) {
      event.preventDefault();
      if (!event.repeat) doFlap();
    } else if (event.target instanceof HTMLButtonElement && event.repeat && (event.key === "Enter" || event.code === "Space")) {
      event.preventDefault();
    }
  });
  // Pause on tab/window changes. Safari can blur the board when a game button
  // is clicked without focusing that button, so focusout must not pause play.
  listen(document, "visibilitychange", () => {
    if (document.hidden) pauseGame("Paused while the tab is hidden. Choose Resume when ready.");
  });
  listen(window, "blur", () => pauseGame("Paused because the window lost focus. Choose Resume when ready."));
  status.textContent = "Ready. Tap the board or press Space on it to start.";
  render();
  return () => {
    disposed = true;
    stopLoop();
    listeners.forEach((remove) => remove());
    root.remove();
  };
}

export const flapLab: Minigame = {
  slug: "flap-lab", title: "Bouncy Ball", motivators: ["challenge"], author: "noahschwed", mount,
};
