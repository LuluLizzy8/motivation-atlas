import { h } from "../../lib/dom";
import type { Minigame } from "../types";
import { act, advanceRace, FINISH, newRace, pauseRace, startRace, type RaceState } from "./game";
import "./race.css";

function mount(el: HTMLElement): () => void {
  let state: RaceState = newRace();
  let frame: number | null = null;
  let previousTime: number | null = null;
  const playerMarker = h("span", { class: "close-race-racer player-racer", "aria-hidden": "true" }, "●");
  const botMarker = h("span", { class: "close-race-racer bot-racer", "aria-hidden": "true" }, "●");
  const playerPosition = h("span", {});
  const botPosition = h("span", {});
  const status = h("p", { class: "close-race-status", role: "status", "aria-live": "polite" });
  const catchUpToggle = h("input", { type: "checkbox", checked: true, "data-mechanic": "catch-up-boost" });
  const pace = h("select", { class: "close-race-speed", "aria-label": "Race speed" },
    h("option", { value: "1.2" }, "Slow · about 100 seconds"),
    h("option", { value: "1.6", selected: true }, "Normal · about 75 seconds"),
    h("option", { value: "2" }, "Fast · about 60 seconds"),
  );
  const start = h("button", { type: "button", class: "close-race-button" }, "Start race");
  const jumpButton = h("button", { type: "button", class: "close-race-button secondary" }, "Jump · Space / ↑");
  const squatButton = h("button", { type: "button", class: "close-race-button secondary" }, "Squat · ↓");
  const reset = h("button", { type: "button", class: "close-race-button secondary" }, "New race");

  function makeLane(label: string, marker: HTMLElement, position: HTMLElement): { lane: HTMLElement; track: HTMLElement } {
    const track = h("div", { class: "close-race-track", role: "img", "aria-label": `${label} road to the finish` });
    track.append(marker);
    return { track, lane: h("div", { class: "close-race-lane" }, h("span", { class: "close-race-name" }, label), track, h("span", { class: "close-race-position" }, position)) };
  }

  const playerLane = makeLane("You", playerMarker, playerPosition);
  const botLane = makeLane("Bot", botMarker, botPosition);
  let renderedObstacles = "";
  function drawObstacles(): void {
    const signature = state.obstacles.map(({ at, kind }) => `${at}:${kind}`).join(",");
    if (signature === renderedObstacles) return;
    renderedObstacles = signature;
    for (const track of [playerLane.track, botLane.track]) {
      for (const old of track.querySelectorAll(".close-race-hazard")) old.remove();
      for (const obstacle of state.obstacles) {
        const obstacleClass = obstacle.kind === "jump" ? "is-low" : "is-high";
        const hazard = h("span", { class: `close-race-hazard ${obstacleClass}`, "aria-hidden": "true" }, obstacle.kind === "jump" ? "▲" : "▼");
        hazard.style.left = `${(obstacle.at / FINISH) * 100}%`;
        track.append(hazard);
      }
    }
  }

  const root = h("div", { class: "close-race" },
    h("p", { class: "close-race-intro" }, "Race the bot to the finish. Your runner moves on its own. Jump over a low hurdle or squat under a high bar as it approaches. Miss the timing and you slow down for a while. Choose a pace, then start."),
    h("div", { class: "close-race-tracks" },
      playerLane.lane,
      botLane.lane,
      h("p", { class: "close-race-finish" }, "▲ bottom hurdle: jump · ▼ top bar: squat · finish at 120"),
    ),
    h("div", { class: "close-race-controls" },
      h("label", { class: "close-race-pace-label" }, "Pace ", pace),
      h("fieldset", { class: "close-race-mechanics" },
        h("legend", {}, "Competition rule"),
        h("label", {}, catchUpToggle, " Catch-up boost: when the bot trails by 3 or more spaces, it runs faster briefly"),
      ),
      h("div", { class: "close-race-actions" }, start, jumpButton, squatButton, reset),
    ),
    status,
    h("p", { class: "close-race-reflect" }, "After the race: what did it feel like when the bot closed the gap? Did the catch-up rule change how you timed your jumps?"),
  );
  el.append(root);

  function paceValue(): number { return Number(pace.value); }

  function statusText(): string {
    if (state.winner === "you") return `You win after ${state.collisions} hurdle hit${state.collisions === 1 ? "" : "s"}. What did the finish feel like?`;
    if (state.winner === "bot") return "The bot wins this race. Try again with the catch-up boost changed.";
    if (state.running && state.slowMs > 0) return `You hit a hurdle. Slowed for ${Math.ceil(state.slowMs / 1000)} more second${state.slowMs > 1000 ? "s" : ""}.`;
    if (state.running && state.actionMs > 0) return state.actionKind === "jump" ? "Jumping! Keep watching the road." : "Squatting! Keep watching the road.";
    if (state.running) return "Race on. Watch for the next hurdle.";
    if (state.elapsedMs > 0) return "Race paused. Resume when ready.";
    return "Choose a pace and start. Jump over low hurdles; squat under high bars.";
  }

  function render(): void {
    drawObstacles();
    playerMarker.style.left = `${(state.player / FINISH) * 100}%`;
    botMarker.style.left = `${(state.bot / FINISH) * 100}%`;
    playerMarker.classList.toggle("is-jumping", state.actionMs > 0 && state.actionKind === "jump");
    playerMarker.classList.toggle("is-squatting", state.actionMs > 0 && state.actionKind === "squat");
    botMarker.classList.toggle("is-jumping", state.botActionMs > 0 && state.botActionKind === "jump");
    botMarker.classList.toggle("is-squatting", state.botActionMs > 0 && state.botActionKind === "squat");
    playerMarker.classList.toggle("is-slowed", state.slowMs > 0);
    playerPosition.textContent = `${Math.floor(state.player)}/${FINISH}`;
    botPosition.textContent = `${Math.floor(state.bot)}/${FINISH}`;
    start.textContent = state.winner ? "Race finished" : state.running ? "Pause" : state.elapsedMs ? "Resume" : "Start race";
    start.disabled = state.winner !== null;
    jumpButton.disabled = !state.running || state.winner !== null || state.actionMs > 0 || state.slowMs > 0;
    squatButton.disabled = !state.running || state.winner !== null || state.actionMs > 0 || state.slowMs > 0;
    pace.disabled = state.winner !== null;
    status.textContent = statusText();
  }

  function stopFrame(): void {
    if (frame !== null) window.cancelAnimationFrame(frame);
    frame = null;
    previousTime = null;
  }

  function animate(now: number): void {
    if (!state.running) { stopFrame(); return; }
    const elapsed = previousTime === null ? 0 : Math.min(100, now - previousTime);
    previousTime = now;
    state = advanceRace(state, elapsed, paceValue(), catchUpToggle.checked);
    render();
    if (state.running) frame = window.requestAnimationFrame(animate);
    else stopFrame();
  }

  start.addEventListener("click", () => {
    if (state.running) state = pauseRace(state);
    else state = startRace(state);
    render();
    if (state.running && frame === null) frame = window.requestAnimationFrame(animate);
    else if (!state.running) stopFrame();
  });
  jumpButton.addEventListener("click", () => { state = act(state, "jump"); render(); });
  squatButton.addEventListener("click", () => { state = act(state, "squat"); render(); });
  reset.addEventListener("click", () => { stopFrame(); state = newRace(); renderedObstacles = ""; render(); });
  const onKeyDown = (event: KeyboardEvent) => {
    const action = event.code === "Space" || event.code === "ArrowUp" ? "jump" : event.code === "ArrowDown" || event.key.toLowerCase() === "s" ? "squat" : null;
    if (action && state.running) {
      if (event.repeat) return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) return;
      event.preventDefault();
      state = act(state, action);
      render();
    }
  };
  window.addEventListener("keydown", onKeyDown);
  render();
  return () => {
    stopFrame();
    window.removeEventListener("keydown", onKeyDown);
    root.remove();
  };
}

export const closeRace: Minigame = { slug: "close-race", title: "Road Race: timed jumps", motivators: ["competition"], author: "yvnvii", mount };
