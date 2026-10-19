import { h } from "../../lib/dom";
import type { Minigame } from "../types";
import { INITIAL_WIDTH, isHit, markerPosition, nextWidth, TRIAL_MS, TRIALS } from "./game";
import "./style.css";

function mount(el: HTMLElement): () => void {
  const adaptive = h("input", { type: "checkbox", checked: true, "data-mechanic": "adaptive-target" });
  const start = h("button", { type: "button" }, "Start 60-second round");
  const lock = h("button", { type: "button", "aria-disabled": "true" }, "Lock signal");
  const status = h("p", { role: "status" }, "Ready. Choose a mode, then start.");
  const clock = h("p", {}, "10 trials · 6 seconds each · one attempt per trial");
  const target = h("span", { class: "signal-target" });
  const marker = h("span", { class: "signal-marker" });
  const track = h("div", { class: "signal-track", "aria-hidden": "true" }, target, marker);
  const history = h("ol", { class: "signal-history", "aria-label": "Completed trials" });
  const reflection = h("div", { class: "signal-reflection", hidden: true },
    h("h4", {}, "Check it against your own play"),
    h("p", {}, "What did you feel as the target changed? Did you wait longer, rush, or change your timing? Play again with the toggle off. Did a fixed target change the challenge or your satisfaction? Your experience may differ from the prediction."),
  );
  const root = h("div", { class: "signal-keeper" },
    h("label", {}, adaptive, " Adaptive difficulty (applies to the next round)"),
    h("p", {}, "Catch the marker inside the outlined center target. Use a tap, click, or focus Lock signal and press Space/Enter. Every trial lasts six seconds, even after you lock."),
    h("div", { class: "signal-controls" }, start, lock), clock, track,
    h("p", { class: "signal-track-label" }, "0 ← moving marker → 100 · target centered at 50"), status, history, reflection,
  );
  el.append(root);
  let timer: ReturnType<typeof setInterval> | undefined;
  let began = 0;
  let trial = 0;
  let width = INITIAL_WIDTH;
  let score = 0;
  let attempt: boolean | null = null;
  let running = false;
  let mode = true;
  let lastResult = "";

  function paintTarget(): void {
    target.style.left = `${50 - width / 2}%`;
    target.style.width = `${width}%`;
  }
  function finishTrial(): void {
    const hit = attempt === true;
    if (hit) score++;
    lastResult = `Trial ${trial + 1}: ${hit ? "hit" : attempt === null ? "no attempt" : "miss"}; target ${width}%.`;
    history.append(h("li", {}, lastResult));
    width = nextWidth(width, hit, mode);
    trial++;
    attempt = null;
  }
  function update(now = performance.now()): void {
    if (!running) return;
    const elapsed = now - began;
    while (trial < TRIALS && elapsed >= (trial + 1) * TRIAL_MS) finishTrial();
    if (trial === TRIALS) {
      running = false;
      clearInterval(timer);
      timer = undefined;
      lock.setAttribute("aria-disabled", "true");
      clock.textContent = "Round complete · 60 seconds";
      status.textContent = `${mode ? "Adaptive ON" : "Adaptive OFF"}: ${score}/${TRIALS} hits. Try the other mode and compare how it felt.`;
      reflection.hidden = false;
      return;
    }
    paintTarget();
    marker.style.left = `${markerPosition(elapsed - trial * TRIAL_MS)}%`;
    clock.textContent = `Trial ${trial + 1}/${TRIALS} · ${Math.ceil((TRIALS * TRIAL_MS - elapsed) / 1000)}s left · ${score} hits · target ${width}%`;
    lock.setAttribute("aria-disabled", String(attempt !== null));
    const message = attempt === null
      ? `${lastResult} Aim for the center. ${mode ? "Hits narrow the next target; misses widen it." : "The target stays 36% wide."}`
      : `${attempt ? "Hit!" : "Miss."} Wait for the next trial; one attempt per trial.`;
    if (status.textContent !== message) status.textContent = message;
  }
  start.addEventListener("click", () => {
    clearInterval(timer);
    began = performance.now();
    trial = 0; width = INITIAL_WIDTH; score = 0; attempt = null;
    mode = adaptive.checked; running = true; lastResult = "";
    history.replaceChildren();
    reflection.hidden = true;
    start.textContent = "Restart 60-second round";
    update(began);
    lock.focus();
    timer = setInterval(update, 40);
  });
  lock.addEventListener("click", () => {
    const now = performance.now();
    update(now);
    if (!running || attempt !== null) return;
    attempt = isHit(markerPosition(now - began - trial * TRIAL_MS), width);
    update(now);
  });
  paintTarget();
  return () => { clearInterval(timer); root.remove(); };
}

export const signalKeeper: Minigame = {
  slug: "signal-keeper",
  title: "Signal Keeper: a moving target",
  motivators: ["challenge"],
  author: "ghanikhalid",
  mount,
};
